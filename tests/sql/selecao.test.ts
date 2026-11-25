import type { Client } from 'pg'
import { describe, expect, it } from 'vitest'
import { comoUsuario, emTransacao, liberar, novoCliente, novoProjeto } from './apoio'

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

const TABELAS = ['candidatos', 'curriculos', 'selecoes', 'participacoes', 'analises_ia', 'entrevistas', 'historico_selecao']

async function contar(c: Client, tabela: string): Promise<number> {
  const { rows } = await c.query(`select count(*)::int as n from ${tabela}`)
  return rows[0].n
}

// Com o papel do banco (antes de comoUsuario): uma seleção com um candidato analisado e uma entrevista.
async function semente(c: Client) {
  const cli = await novoCliente(c)
  const { projetoId } = await novoProjeto(c, { clienteId: cli, organizacao: 'meta' })
  const sel = (await c.query("insert into selecoes (projeto_id, funcao, descritivo) values ($1, 'Caldeireiro', 'NR-13') returning id", [projetoId])).rows[0].id
  const cand = (await c.query("insert into candidatos (nome) values ('teste-sql Candidato') returning id")).rows[0].id
  const cv = (await c.query("insert into curriculos (candidato_id, caminho, nome_arquivo, enviado_por) values ($1, $2, 'cv.pdf', 'teste') returning id", [cand, `${sel}/x.pdf`])).rows[0].id
  const part = (await c.query("insert into participacoes (selecao_id, candidato_id, curriculo_id, situacao) values ($1, $2, $3, 'analisada') returning id", [sel, cand, cv])).rows[0].id
  await c.query("insert into analises_ia (participacao_id, modelo, versao_prompt, descritivo, nota, classificacao, resposta) values ($1, 'm', 'v', 'NR-13', 80, 'aderente', '{}')", [part])
  await c.query("insert into entrevistas (participacao_id, tipo, data, entrevistador, parecer, registrado_por) values ($1, 'timenow', '2026-11-25', 'Ana', 'recomendado', 'teste')", [part])
  await c.query("insert into historico_selecao (selecao_id, participacao_id, nome_usuario, acao) values ($1, $2, 'teste', 'x')", [sel, part])
  return { cli, projetoId, sel, cand, part }
}

describe('seleção: acesso', () => {
  it('gestor e cliente não leem nada', () =>
    emTransacao(async (c) => {
      const { cli, projetoId } = await semente(c)
      for (const perfil of ['gestor', 'cliente'] as const) {
        await c.query('reset role')
        const { usuarioId } = await comoUsuario(c, perfil, perfil === 'cliente' ? cli : undefined)
        await liberar(c, projetoId, usuarioId)
        for (const t of TABELAS) expect([perfil, t, await contar(c, t)]).toEqual([perfil, t, 0])
        const { rows } = await c.query("select count(*)::int as n from storage.objects where bucket_id = 'curriculos'")
        expect(rows[0].n).toBe(0)
      }
    }))

  it('analista lê o banco inteiro mas só seleções dos projetos dele', () =>
    emTransacao(async (c) => {
      const { projetoId } = await semente(c)
      const { usuarioId } = await comoUsuario(c, 'analista')
      expect(await contar(c, 'candidatos')).toBe(1)
      expect(await contar(c, 'curriculos')).toBe(1)
      for (const t of ['selecoes', 'participacoes', 'analises_ia', 'entrevistas', 'historico_selecao']) expect(await contar(c, t)).toBe(0)
      await liberar(c, projetoId, usuarioId)
      for (const t of ['selecoes', 'participacoes', 'analises_ia', 'entrevistas', 'historico_selecao']) expect(await contar(c, t)).toBe(1)
    }))

  it('rh lê tudo', () =>
    emTransacao(async (c) => {
      await semente(c)
      await comoUsuario(c, 'rh')
      for (const t of TABELAS) expect(await contar(c, t)).toBe(1)
    }))

  it('ninguém grava direto nas tabelas', () =>
    emTransacao(async (c) => {
      const { sel } = await semente(c)
      await comoUsuario(c, 'rh')
      expect(await erroSalvo(c, () => c.query("insert into candidatos (nome) values ('x')"))).toContain('row-level security')
      expect(await erroSalvo(c, () => c.query("insert into selecoes (projeto_id, funcao, descritivo) select projeto_id, 'f', 'd' from selecoes where id = $1", [sel]))).toContain('row-level security')
      // A análise da IA nunca muda: nem o RH tem o privilégio de alterar ou apagar.
      expect(await erroSalvo(c, () => c.query('update analises_ia set nota = 1'))).toContain('permission denied')
      expect(await erroSalvo(c, () => c.query('delete from analises_ia'))).toContain('permission denied')
    }))

  it('bucket existe e é privado', () =>
    emTransacao(async (c) => {
      const { rows } = await c.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'curriculos'")
      expect(rows[0]).toEqual({ public: false, file_size_limit: '10485760', allowed_mime_types: ['application/pdf'] })
    }))
})
