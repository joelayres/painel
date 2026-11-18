import type { Client } from 'pg'
import { describe, expect, it } from 'vitest'
import { comoUsuario, emTransacao, etapasDoProjeto, novoCliente, novoProjeto } from './apoio'

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
const noRelatorio = async (c: Client, id: string) => (await c.query('select no_relatorio from projeto_etapas where id = $1', [id])).rows[0].no_relatorio

describe('etapas no relatório', () => {
  it('toda etapa começa no relatório; a equipe tira e põe de volta, com histórico', () =>
    emTransacao(async (c) => {
      const { projetoId } = await novoProjeto(c, { clienteId: await novoCliente(c), organizacao: 'ondas' })
      const lista = await etapasDoProjeto(c, projetoId)
      expect(await noRelatorio(c, lista[0].id)).toBe(true)
      await comoUsuario(c, 'rh')
      await c.query('select mostrar_etapa_no_relatorio($1, false)', [lista[0].id])
      expect(await noRelatorio(c, lista[0].id)).toBe(false)
      // A fixa também pode sair do relatório: ela só não sai da lista.
      await c.query('select mostrar_etapa_no_relatorio($1, false)', [lista[1].id])
      expect(await noRelatorio(c, lista[1].id)).toBe(false)
      await c.query('select mostrar_etapa_no_relatorio($1, true)', [lista[0].id])
      expect(await noRelatorio(c, lista[0].id)).toBe(true)
      const { rows } = await c.query("select acao from historico where vaga_id is null and detalhe->>'etapa' = $1 order by em", [lista[0].nome])
      expect(rows.map((r) => r.acao)).toEqual([`Tirou a etapa ${lista[0].nome} do relatório`, `Pôs a etapa ${lista[0].nome} no relatório`])
    }))

  it('projeto encerrado recusa', () =>
    emTransacao(async (c) => {
      const { projetoId } = await novoProjeto(c, { clienteId: await novoCliente(c), organizacao: 'ondas' })
      const lista = await etapasDoProjeto(c, projetoId)
      await comoUsuario(c, 'rh')
      await c.query('select encerrar_projeto($1)', [projetoId])
      expect(await erroSalvo(c, () => c.query('select mostrar_etapa_no_relatorio($1, false)', [lista[3].id]))).toContain('projeto encerrado')
    }))

  for (const perfil of ['gestor', 'cliente'] as const) {
    it(`gestor e cliente não mudam (${perfil})`, () =>
      emTransacao(async (c) => {
        const cli = await novoCliente(c)
        const { projetoId } = await novoProjeto(c, { clienteId: cli, organizacao: 'ondas' })
        const lista = await etapasDoProjeto(c, projetoId)
        await comoUsuario(c, perfil, perfil === 'cliente' ? cli : undefined)
        expect(await erroSalvo(c, () => c.query('select mostrar_etapa_no_relatorio($1, false)', [lista[3].id]))).toContain('sem permissão')
      }))
  }

  it('anon não chama a função', () =>
    emTransacao(async (c) => {
      const f = 'mostrar_etapa_no_relatorio(uuid, boolean)'
      expect((await c.query("select has_function_privilege('authenticated', $1, 'execute') as ok", [f])).rows[0].ok).toBe(true)
      expect((await c.query("select has_function_privilege('anon', $1, 'execute') as ok", [f])).rows[0].ok).toBe(false)
    }))
})
