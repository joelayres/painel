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

test('rotas do Portal da Gestão não exigem login (resumo tem segredo; entrada tem token)', async () => {
  const resumo = await middleware(new NextRequest('https://app/api/portal/resumo?email=a@x.com'))
  expect(resumo.headers.get('location')).toBeNull()
  const entrada = await middleware(new NextRequest('https://app/entrar/portal?t=abc'))
  expect(entrada.headers.get('location')).toBeNull()
})

test('leitura do Financeiro não exige login (tem segredo próprio)', async () => {
  const r = await middleware(new NextRequest('https://app/api/financeiro/vagas'))
  expect(r.headers.get('location')).toBeNull()
})
