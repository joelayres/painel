import { NextRequest } from 'next/server'
import { expect, test, vi } from 'vitest'

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))
const { middleware } = await import('../middleware')

test('a tela de entrada não exige login', async () => {
  const r = await middleware(new NextRequest('https://app/entrar'))
  expect(r.headers.get('location')).toBeNull()
})

test('o painel exige login', async () => {
  const r = await middleware(new NextRequest('https://app/'))
  expect(r.headers.get('location')).toBe('https://app/entrar')
})

test('o detalhe da vaga exige login', async () => {
  const r = await middleware(new NextRequest('https://app/vagas/abc'))
  expect(r.headers.get('location')).toBe('https://app/entrar')
})
