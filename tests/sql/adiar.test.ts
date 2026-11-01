import type { Client } from 'pg'
import { describe, expect, it } from 'vitest'
import { comoUsuario, concluirAte, emTransacao, etapasDoProjeto, liberar, novaVaga, novoCliente, novoProjeto } from './apoio'

// Erro esperado dentro da transação do teste: o savepoint deixa a transação seguir depois dele.
async function erroSalvo(c: Client, p: () => Promise<unknown>): Promise<string | null> {
  await c.query('savepoint s')
  try {
    await p()
    return null
  } catch (e) {
    return (e as Error).message
  } finally {
    await c.query('rollback to savepoint s')
  }
}

const adiar = (c: Client, vaga: string, data: string) => c.query('select adiar_etapa($1, $2::date)', [vaga, data])
const adiamento = async (c: Client, vaga: string) =>
  (await c.query("select to_char(adiada_ate, 'YYYY-MM-DD') as ate, adiada_etapa_id as etapa from vagas where id = $1", [vaga])).rows[0]
// Na mesma transação todas as entradas têm o mesmo `em`: compara sem depender da ordem.
const acoes = async (c: Client, vaga: string) =>
  (await c.query("select acao from historico where vaga_id = $1 and (acao like 'Adiou%' or acao like 'Tirou o adiamento%')", [vaga])).rows.map((r) => r.acao as string).sort()

// Projeto por ondas com uma vaga que concluiu a abertura (etapa atual: 2, Captura).
async function cenario(c: Client) {
  const cli = await novoCliente(c)
  const p = await novoProjeto(c, { clienteId: cli, organizacao: 'ondas' })
  const vaga = await novaVaga(c, { projetoId: p.projetoId, ondaId: p.ondaId })
  await concluirAte(c, vaga, 1, '2026-10-22')
  const etapas = await etapasDoProjeto(c, p.projetoId)
  return { cli, ...p, vaga, etapas }
}

describe('adiar etapa', () => {
  it('adia a etapa atual, troca a data e tira o adiamento com data passada', () =>
    emTransacao(async (c) => {
      const { vaga, etapas } = await cenario(c)
      await comoUsuario(c, 'rh')
      await adiar(c, vaga, '2099-11-16')
      expect(await adiamento(c, vaga)).toEqual({ ate: '2099-11-16', etapa: etapas[1].id })
      await adiar(c, vaga, '2099-12-01')
      expect((await adiamento(c, vaga)).ate).toBe('2099-12-01')
      await adiar(c, vaga, '2020-01-01')
      expect(await adiamento(c, vaga)).toEqual({ ate: null, etapa: null })
      expect(await acoes(c, vaga)).toEqual([
        `Adiou ${etapas[1].nome} para 16/11/2099`,
        `Adiou ${etapas[1].nome} para 01/12/2099`,
        `Tirou o adiamento de ${etapas[1].nome}`,
      ].sort())
    }))

  it('em grupo: adia todas e pula as mobilizadas', () =>
    emTransacao(async (c) => {
      const { projetoId, ondaId, vaga, etapas } = await cenario(c)
      const outra = await novaVaga(c, { projetoId, ondaId })
      const mobilizada = await novaVaga(c, { projetoId, ondaId })
      await concluirAte(c, mobilizada, etapas.length, '2026-10-22')
      await comoUsuario(c, 'rh')
      const { rows } = await c.query('select adiar_etapa_em_grupo($1::uuid[], $2::date) as r', [[vaga, outra, mobilizada], '2099-11-16'])
      expect(rows[0].r).toEqual({ alteradas: 2, puladas: 1 })
      expect((await adiamento(c, vaga)).etapa).toBe(etapas[1].id)
      expect((await adiamento(c, outra)).etapa).toBe(etapas[0].id)
      expect((await adiamento(c, mobilizada)).ate).toBeNull()
    }))

  it('quem não altera o projeto não adia; projeto encerrado também não', () =>
    emTransacao(async (c) => {
      const { cli, projetoId, vaga } = await cenario(c)
      const { usuarioId: cliente } = await comoUsuario(c, 'cliente', cli)
      await liberar(c, projetoId, cliente)
      expect(await erroSalvo(c, () => adiar(c, vaga, '2099-11-16'))).toContain('sem permissão')
      await c.query('reset role')
      await c.query('update projetos set encerrado_em = now() where id = $1', [projetoId])
      await comoUsuario(c, 'rh')
      expect(await erroSalvo(c, () => adiar(c, vaga, '2099-11-16'))).toContain('projeto encerrado')
    }))
})
