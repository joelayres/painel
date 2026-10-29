// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest'

const atualizacoes: unknown[] = []
const admin = {
  from: () => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: { usuario_id: 'eu' } }) }) }),
    update: (d: unknown) => (atualizacoes.push(d), { eq: async () => ({ error: null }) }),
  }),
  auth: { admin: { updateUserById: async () => ({ error: null }) } },
}

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/perfil', () => ({ exigirAdmin: async () => ({ usuarioId: 'eu', perfil: 'rh' }) }))
vi.mock('@/lib/supabase/admin', () => ({ criarClienteAdmin: () => admin }))
vi.mock('@/lib/supabase/servidor', () => ({ criarClienteServidor: vi.fn() }))

import { salvarUsuario } from '../acoesCadastros'

beforeEach(() => { atualizacoes.length = 0 })

test('o Administrador não rebaixa a si mesmo para Analista', async () => {
  expect(await salvarUsuario('u1', { nome: 'Eu', perfil: 'analista', ativo: 'on' })).toEqual({ ok: false, erros: { _: 'Você não pode tirar o seu próprio acesso de Administrador.' } })
  expect(atualizacoes).toEqual([])
})

test('o Administrador edita outra pessoa para Analista', async () => {
  const outro = { ...admin, from: () => ({ ...admin.from(), select: () => ({ eq: () => ({ single: async () => ({ data: { usuario_id: 'outro' } }) }) }) }) }
  vi.spyOn(await import('@/lib/supabase/admin'), 'criarClienteAdmin').mockReturnValue(outro as never)
  expect(await salvarUsuario('u2', { nome: 'Ana', perfil: 'analista', ativo: 'on' })).toEqual({ ok: true })
  expect(atualizacoes).toEqual([expect.objectContaining({ perfil: 'analista', cliente_id: null })])
})
