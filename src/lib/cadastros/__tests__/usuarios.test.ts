// @vitest-environment node
import type { SupabaseClient } from '@supabase/supabase-js'
import { expect, test, vi } from 'vitest'
import { alterarUsuario, cadastrarUsuario } from '../usuarios'

function admin(opcoes: { existente?: boolean; banFalha?: boolean; emailNoAuth?: string }) {
  const inserts: unknown[] = []
  const updateUserById = vi.fn(async () => ({ error: opcoes.banFalha ? { message: 'falhou' } : null }))
  const cliente = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opcoes.existente ? { id: 'x' } : null }), single: async () => ({ data: { usuario_id: 'auth-1' } }) }) }),
      insert: async (d: unknown) => { inserts.push(d); return { error: null } },
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
    auth: {
      admin: {
        createUser: async () => (opcoes.emailNoAuth ? { data: { user: null }, error: { code: 'email_exists', message: 'already registered' } } : { data: { user: { id: 'novo' } }, error: null }),
        listUsers: async () => ({ data: { users: [{ id: 'antigo', email: opcoes.emailNoAuth }] }, error: null }),
        updateUserById,
        deleteUser: vi.fn(),
      },
    },
  }
  return { cliente: cliente as unknown as SupabaseClient, inserts, updateUserById }
}

test('e-mail que ainda existe no login (pessoa removida antes) é reaproveitado', async () => {
  const a = admin({ emailNoAuth: 'cliente@braskem.com.br' })
  expect(await cadastrarUsuario(a.cliente, { nome: 'Cliente', email: 'cliente@braskem.com.br', perfil: 'visualizador' })).toEqual({ ok: true })
  expect(a.inserts).toEqual([{ usuario_id: 'antigo', nome: 'Cliente', email: 'cliente@braskem.com.br', perfil: 'visualizador' }])
  expect(a.updateUserById).toHaveBeenCalledWith('antigo', { ban_duration: 'none' })
})

test('falha no bloqueio do login é avisada', async () => {
  const a = admin({ banFalha: true })
  expect(await alterarUsuario(a.cliente, 'u1', { nome: 'X', perfil: 'visualizador', ativo: false })).toEqual({
    ok: false,
    erros: { _: 'A situação foi gravada, mas o bloqueio do acesso falhou. Tente de novo.' },
  })
})
