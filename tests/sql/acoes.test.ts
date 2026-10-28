import { describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { conexao, comoUsuario, emTransacao, novaVaga, novoCliente, novoProjeto } from './apoio'

const erro = async (p: Promise<unknown>) => {
  try {
    await p
    return null
  } catch (e) {
    return (e as Error).message
  }
}

// Vaga de teste num projeto por ondas novo, de um cliente novo.
async function vagaDeTeste(c: Client, dataInicio: string): Promise<string> {
  const { projetoId, ondaId } = await novoProjeto(c, { clienteId: await novoCliente(c), organizacao: 'ondas' })
  return novaVaga(c, { projetoId, ondaId, dataInicio })
}

describe('limites das datas de conclusão', () => {
  it('etapa 1 não pode ser concluída antes do início da vaga', () =>
    emTransacao(async (c) => {
      const vaga = await vagaDeTeste(c, '2026-10-22')
      await comoUsuario(c, 'rh')
      await c.query('savepoint s')
      expect(await erro(c.query('select concluir_etapa($1, 1::smallint, $2::date)', [vaga, '2026-10-21']))).toContain('data antes do início da vaga')
      await c.query('rollback to savepoint s')
      await c.query('select concluir_etapa($1, 1::smallint, $2::date)', [vaga, '2026-10-22'])
    }))

  it('depois da desistência, a captura não pode ser concluída antes da retomada', () =>
    emTransacao(async (c) => {
      const vaga = await vagaDeTeste(c, '2026-10-01')
      await comoUsuario(c, 'rh')
      await c.query('select concluir_etapa($1, 1::smallint, $2::date)', [vaga, '2026-10-01'])
      await c.query('select candidato_desistiu($1)', [vaga])
      const { rows } = await c.query('select (hoje_sp() - 1) as ontem')
      expect(await erro(c.query('select concluir_etapa($1, 2::smallint, $2::date)', [vaga, rows[0].ontem]))).toContain('data antes da retomada')
    }))
})

describe('desistência do candidato', () => {
  it('guarda no histórico as datas apagadas', () =>
    emTransacao(async (c) => {
      const vaga = await vagaDeTeste(c, '2026-10-01')
      await comoUsuario(c, 'rh')
      for (const [ordem, dia] of [[1, '2026-10-01'], [2, '2026-10-07'], [3, '2026-10-08']] as const) {
        await c.query('select concluir_etapa($1, $2::smallint, $3::date)', [vaga, ordem, dia])
      }
      await c.query('select candidato_desistiu($1)', [vaga])
      const { rows } = await c.query("select detalhe from historico where vaga_id = $1 and acao = 'Candidato desistiu'", [vaga])
      expect(rows[0].detalhe.conclusoes).toEqual([{ ordem: 2, concluida_em: '2026-10-07' }, { ordem: 3, concluida_em: '2026-10-08' }])
    }))

  it('não vale depois da admissão', () =>
    emTransacao(async (c) => {
      const vaga = await vagaDeTeste(c, '2026-10-01')
      for (let ordem = 1; ordem <= 11; ordem++) {
        await c.query('insert into vaga_conclusoes (vaga_id, ordem, concluida_em) values ($1, $2, $3)', [vaga, ordem, '2026-10-15'])
      }
      await comoUsuario(c, 'rh')
      expect(await erro(c.query('select candidato_desistiu($1)', [vaga]))).toContain('vaga já admitida')
    }))
})

describe('funções do banco', () => {
  it('as funções com permissão elevada fixam o search_path com pg_temp no fim', () =>
    emTransacao(async (c) => {
      const { rows } = await c.query(
        "select proname, proconfig from pg_proc where pronamespace = 'public'::regnamespace and prosecdef order by proname",
      )
      expect(rows.length).toBeGreaterThan(5)
      for (const r of rows) expect(r.proconfig, r.proname).toContain('search_path=public, pg_temp')
    }))
})

describe('dois cliques ao mesmo tempo', () => {
  it('a segunda conclusão espera a primeira em vez de avançar junto', async () => {
    const a = conexao()
    const b = conexao()
    await a.connect()
    await b.connect()
    try {
      await a.query('begin')
      await b.query('begin')
      // Vaga real já em andamento (etapa 1 concluída): as duas transações são desfeitas no fim.
      const { rows } = await a.query(
        `select v.id, etapa_atual(v.id) as atual from vagas v where v.cancelada_em is null and etapa_atual(v.id) between 2 and 13
           and not exists (select 1 from vaga_conclusoes vc where vc.vaga_id = v.id and vc.concluida_em > hoje_sp()) limit 1`,
      )
      expect(rows).toHaveLength(1)
      const { id, atual } = rows[0]
      await comoUsuario(a, 'rh')
      await comoUsuario(b, 'rh')
      await a.query('select concluir_etapa($1, $2::smallint, hoje_sp())', [id, atual])
      await b.query("set local lock_timeout = '1s'")
      expect(await erro(b.query('select concluir_etapa($1, $2::smallint, hoje_sp())', [id, atual]))).toMatch(/lock timeout/)
    } finally {
      await a.query('rollback')
      await b.query('rollback')
      await a.end()
      await b.end()
    }
  })
})
