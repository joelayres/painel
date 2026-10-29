import type { Client } from 'pg'
import { describe, expect, it } from 'vitest'
import { comoUsuario, concluirAte, emTransacao, liberar, novaVaga, novoCliente, novoProjeto } from './apoio'

const erro = async (p: Promise<unknown>) => {
  try {
    await p
    return null
  } catch (e) {
    return (e as Error).message
  }
}

// Erro esperado dentro da transação do teste: o savepoint deixa a transação seguir depois dele.
async function erroSalvo(c: Client, p: () => Promise<unknown>): Promise<string | null> {
  await c.query('savepoint s')
  const msg = await erro(p())
  await c.query('rollback to savepoint s')
  return msg
}

const contar = async (c: Client, sql: string, params: unknown[] = []) => Number((await c.query(sql, params)).rows[0].n)

// Projeto com 3 vagas paradas na primeira etapa (criadas com o papel do banco).
async function cenario(c: Client, organizacao: 'ondas' | 'meta' = 'ondas') {
  const clienteId = await novoCliente(c)
  const { projetoId, ondaId } = await novoProjeto(c, { clienteId, organizacao })
  const meta = organizacao === 'meta' ? '2026-12-31' : null
  const vagas = [
    await novaVaga(c, { projetoId, ondaId, meta, dataInicio: '2026-10-01' }),
    await novaVaga(c, { projetoId, ondaId, meta, dataInicio: '2026-10-01' }),
    await novaVaga(c, { projetoId, ondaId, meta, dataInicio: '2026-10-01' }),
  ]
  return { clienteId, projetoId, ondaId, vagas }
}

describe('concluir_etapa_em_grupo', () => {
  it('concluir em grupo conclui a mesma etapa em todas', () =>
    emTransacao(async (c) => {
      const { vagas } = await cenario(c)
      await comoUsuario(c, 'rh')
      const { rows } = await c.query('select concluir_etapa_em_grupo($1::uuid[], 1::smallint, $2::date) as n', [vagas, '2026-10-05'])
      expect(rows[0].n).toBe(3)
      expect(await contar(c, 'select count(*) n from vaga_conclusoes where vaga_id = any($1::uuid[])', [vagas])).toBe(3)
      expect(await contar(c, "select count(*) n from historico where vaga_id = any($1::uuid[]) and acao = 'Concluiu Abertura de vaga'", [vagas])).toBe(3)
    }))

  it('uma vaga com data antes do início aborta o grupo', () =>
    emTransacao(async (c) => {
      const { vagas } = await cenario(c)
      await c.query("update vagas set data_inicio = '2026-10-10' where id = $1", [vagas[1]])
      await comoUsuario(c, 'rh')
      const msg = await erroSalvo(c, () => c.query('select concluir_etapa_em_grupo($1::uuid[], 1::smallint, $2::date)', [vagas, '2026-10-05']))
      expect(msg?.startsWith(`vaga ${vagas[1]}:`)).toBe(true)
      expect(msg).toContain('data antes do início da vaga')
      expect(await contar(c, 'select count(*) n from vaga_conclusoes where vaga_id = any($1::uuid[])', [vagas])).toBe(0)
    }))

  it('vaga de outro projeto é recusada', () =>
    emTransacao(async (c) => {
      const { vagas, clienteId } = await cenario(c)
      const outro = await novoProjeto(c, { clienteId, organizacao: 'ondas' })
      const intrusa = await novaVaga(c, { projetoId: outro.projetoId, ondaId: outro.ondaId, dataInicio: '2026-10-01' })
      await comoUsuario(c, 'rh')
      const msg = await erroSalvo(c, () => c.query('select concluir_etapa_em_grupo($1::uuid[], 1::smallint, $2::date)', [[...vagas, intrusa], '2026-10-05']))
      expect(msg).toContain('vagas de projetos diferentes')
      expect(await contar(c, 'select count(*) n from vaga_conclusoes where vaga_id = any($1::uuid[])', [[...vagas, intrusa]])).toBe(0)
    }))

  it('analista sem acesso não altera em grupo', () =>
    emTransacao(async (c) => {
      const { vagas, projetoId } = await cenario(c)
      await comoUsuario(c, 'analista')
      expect(await erroSalvo(c, () => c.query('select concluir_etapa_em_grupo($1::uuid[], 1::smallint, $2::date)', [vagas, '2026-10-05']))).toContain('sem permissão')
      expect(await erroSalvo(c, () => c.query("select alterar_vagas_em_grupo($1::uuid[], 'data_inicio', '2026-10-02')", [vagas]))).toContain('sem permissão')
      void projetoId
    }))

  it('analista com acesso altera em grupo', () =>
    emTransacao(async (c) => {
      const { vagas, projetoId } = await cenario(c)
      const { usuarioId } = await comoUsuario(c, 'analista')
      await liberar(c, projetoId, usuarioId)
      const { rows } = await c.query('select concluir_etapa_em_grupo($1::uuid[], 1::smallint, $2::date) as n', [vagas, '2026-10-05'])
      expect(rows[0].n).toBe(3)
    }))

  it('nenhuma vaga', () =>
    emTransacao(async (c) => {
      await comoUsuario(c, 'rh')
      expect(await erroSalvo(c, () => c.query("select concluir_etapa_em_grupo('{}'::uuid[], 1::smallint, '2026-10-05'::date)"))).toContain('nenhuma vaga')
      expect(await erroSalvo(c, () => c.query("select alterar_vagas_em_grupo('{}'::uuid[], 'meta', '2026-12-01')"))).toContain('nenhuma vaga')
    }))
})

describe('alterar_vagas_em_grupo', () => {
  it('trocar meta em grupo', () =>
    emTransacao(async (c) => {
      const { vagas } = await cenario(c, 'meta')
      await comoUsuario(c, 'rh')
      const { rows } = await c.query("select alterar_vagas_em_grupo($1::uuid[], 'meta', '2027-01-15') as r", [vagas])
      expect(rows[0].r).toEqual({ alteradas: 3, puladas: 0 })
      expect(await contar(c, "select count(*) n from vagas where id = any($1::uuid[]) and meta = '2027-01-15'", [vagas])).toBe(3)
      expect(await contar(c, "select count(*) n from historico where vaga_id = any($1::uuid[]) and acao = 'Editou a vaga'", [vagas])).toBe(3)
    }))

  it('trocar onda em grupo', () =>
    emTransacao(async (c) => {
      const { vagas, projetoId, clienteId } = await cenario(c)
      const { rows: o } = await c.query("insert into ondas (projeto_id, nome, inicio, fim) values ($1, '2ª Onda', '2026-11-01', '2027-01-31') returning id", [projetoId])
      const outro = await novoProjeto(c, { clienteId, organizacao: 'ondas' })
      await comoUsuario(c, 'rh')
      const { rows } = await c.query("select alterar_vagas_em_grupo($1::uuid[], 'onda_id', $2) as r", [vagas, o[0].id])
      expect(rows[0].r).toEqual({ alteradas: 3, puladas: 0 })
      expect(await contar(c, 'select count(*) n from vagas where id = any($1::uuid[]) and onda_id = $2', [vagas, o[0].id])).toBe(3)
      const msg = await erroSalvo(c, () => c.query("select alterar_vagas_em_grupo($1::uuid[], 'onda_id', $2)", [vagas, outro.ondaId]))
      expect(msg?.startsWith('vaga ')).toBe(true)
    }))

  it('trocar início pula quem já concluiu etapa', () =>
    emTransacao(async (c) => {
      const { vagas } = await cenario(c)
      await concluirAte(c, vagas[0], 1, '2026-10-01')
      await comoUsuario(c, 'rh')
      const { rows } = await c.query("select alterar_vagas_em_grupo($1::uuid[], 'data_inicio', '2026-10-08') as r", [vagas])
      expect(rows[0].r).toEqual({ alteradas: 2, puladas: 1 })
      const { rows: v } = await c.query('select id, data_inicio::text as d from vagas where id = any($1::uuid[])', [vagas])
      const data = new Map(v.map((x) => [x.id, x.d]))
      expect(data.get(vagas[0])).toBe('2026-10-01')
      expect(data.get(vagas[1])).toBe('2026-10-08')
      expect(data.get(vagas[2])).toBe('2026-10-08')
    }))

  it('campo inválido e vaga cancelada', () =>
    emTransacao(async (c) => {
      const { vagas } = await cenario(c, 'meta')
      await c.query('update vagas set cancelada_em = now() where id = $1', [vagas[2]])
      await comoUsuario(c, 'rh')
      expect(await erroSalvo(c, () => c.query("select alterar_vagas_em_grupo($1::uuid[], 'funcao', 'x')", [vagas]))).toContain('campo inválido')
      const msg = await erroSalvo(c, () => c.query("select alterar_vagas_em_grupo($1::uuid[], 'meta', '2027-01-15')", [vagas]))
      expect(msg?.startsWith(`vaga ${vagas[2]}:`)).toBe(true)
      expect(msg).toContain('vaga cancelada')
    }))
})
