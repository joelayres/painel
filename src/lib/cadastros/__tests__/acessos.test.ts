// @vitest-environment node
import type { SupabaseClient } from '@supabase/supabase-js'
import { expect, test } from 'vitest'
import { liberarAcesso, removerAcesso, usuariosLiberaveis } from '../acessos'

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
  expect(await liberarAcesso(sb('perfil sem acesso por projeto'), 'p', 'u')).toEqual({ ok: false, erro: 'O RH já vê todos os projetos.' })
})

test('liberarAcesso e removerAcesso ok', async () => {
  expect(await liberarAcesso(sb(), 'p', 'u')).toEqual({ ok: true })
  expect(await removerAcesso(sb(), 'p', 'u')).toEqual({ ok: true })
  expect(await removerAcesso(sb('x'), 'p', 'u')).toEqual({ ok: false, erro: 'Não foi possível salvar. Tente de novo.' })
})

test('usuariosLiberaveis: gestores ativos e clientes do cliente do projeto', () => {
  const us = [
    { id: 'g', perfil: 'gestor' as const, clienteId: null, ativo: true },
    { id: 'gi', perfil: 'gestor' as const, clienteId: null, ativo: false },
    { id: 'cb', perfil: 'cliente' as const, clienteId: 'braskem', ativo: true },
    { id: 'co', perfil: 'cliente' as const, clienteId: 'outro', ativo: true },
    { id: 'r', perfil: 'rh' as const, clienteId: null, ativo: true },
  ]
  expect(usuariosLiberaveis(us, 'braskem').map((u) => u.id)).toEqual(['g', 'cb'])
})
