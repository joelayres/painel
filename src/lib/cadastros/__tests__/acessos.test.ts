// @vitest-environment node
import type { SupabaseClient } from '@supabase/supabase-js'
import { expect, test } from 'vitest'
import { carregarPessoasDoProjeto, liberarAcesso, removerAcesso } from '../acessos'

function sb(mensagem?: string) {
  const r = { error: mensagem ? { message: mensagem } : null }
  return {
    from: () => ({
      insert: async () => r,
      delete: () => ({ eq: () => ({ eq: async () => r }) }),
    }),
  } as unknown as SupabaseClient
}

test('liberarAcesso traduz cliente diferente', async () => {
  expect(await liberarAcesso(sb('cliente diferente'), 'p', 'u')).toEqual({ ok: false, erro: 'Esta pessoa é de outro cliente e não pode ver este projeto.' })
})

test('liberarAcesso traduz perfil sem acesso por projeto', async () => {
  expect(await liberarAcesso(sb('perfil sem acesso por projeto'), 'p', 'u')).toEqual({ ok: false, erro: 'O Administrador já vê todos os projetos.' })
})

test('liberarAcesso e removerAcesso ok', async () => {
  expect(await liberarAcesso(sb(), 'p', 'u')).toEqual({ ok: true })
  expect(await removerAcesso(sb(), 'p', 'u')).toEqual({ ok: true })
  expect(await removerAcesso(sb('x'), 'p', 'u')).toEqual({ ok: false, erro: 'Não foi possível salvar. Tente de novo.' })
})

test('liberarAcesso traduz analista não libera este perfil', async () => {
  expect(await liberarAcesso(sb('analista não libera este perfil'), 'p', 'u')).toEqual({ ok: false, erro: 'Você não pode liberar nem remover o acesso de um Analista de RH ou de um Administrador.' })
})

test('carregarPessoasDoProjeto tira das liberáveis quem já tem acesso', async () => {
  const dados: Record<string, unknown[]> = {
    pessoas_do_projeto: [{ id: 'a', nome: 'Ana', perfil: 'gestor' }],
    pessoas_liberaveis: [
      { id: 'a', nome: 'Ana', perfil: 'gestor', cliente_id: null },
      { id: 'b', nome: 'Beto', perfil: 'cliente', cliente_id: 'c1' },
    ],
  }
  const cli = { rpc: async (nome: string, args: unknown) => (expect(args).toEqual({ p_projeto: 'p' }), { data: dados[nome], error: null }) } as unknown as SupabaseClient
  expect(await carregarPessoasDoProjeto(cli, 'p')).toEqual({
    liberadas: [{ id: 'a', nome: 'Ana', perfil: 'gestor' }],
    liberaveis: [{ id: 'b', nome: 'Beto', perfil: 'cliente', clienteId: 'c1' }],
  })
})
