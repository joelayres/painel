import { afterEach, beforeEach, expect, test, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ criarClienteAdmin: () => ({}) }))
const carregarVagasFinanceiro = vi.fn()
vi.mock('@/lib/financeiro/vagas', () => ({ carregarVagasFinanceiro }))

const { GET } = await import('../route')
const P1 = '11111111-1111-4111-8111-111111111111'
const chamar = (consulta = '', auth: string | null = 'Bearer segredo') =>
  GET(new Request(`http://x/api/financeiro/vagas?${consulta}`, { headers: auth ? { Authorization: auth } : {} }))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.FINANCEIRO_SEGREDO = 'segredo'
  carregarVagasFinanceiro.mockImplementation(async (_a, projetos: string[]) => ({
    versao: 1, projetos: [{ id: P1, nome: 'Braskem 2027', cliente: 'Braskem', encerrado: false }],
    vagas: projetos.length ? [{ id: 'v1', projetoId: P1 }] : [],
  }))
})
afterEach(() => {
  delete process.env.FINANCEIRO_SEGREDO
})

test('sem segredo configurado a rota não existe', async () => {
  delete process.env.FINANCEIRO_SEGREDO
  expect((await chamar()).status).toBe(404)
})

test('segredo errado', async () => {
  expect((await chamar('', 'Bearer errado')).status).toBe(401)
  expect(carregarVagasFinanceiro).not.toHaveBeenCalled()
})

test('sem projeto: todos os projetos e nenhuma vaga', async () => {
  const r = await chamar()
  expect(r.status).toBe(200)
  const corpo = await r.json()
  expect(corpo).toMatchObject({ versao: 1, vagas: [] })
  expect(corpo.projetos).toHaveLength(1)
  expect(carregarVagasFinanceiro).toHaveBeenCalledWith(expect.anything(), [], expect.any(String))
})

test('projetos pedidos são repassados', async () => {
  await chamar(`projeto=${P1}`)
  expect(carregarVagasFinanceiro).toHaveBeenCalledWith(expect.anything(), [P1], expect.any(String))
})

test('projeto que não é uuid', async () => {
  expect((await chamar('projeto=abc')).status).toBe(400)
  expect(carregarVagasFinanceiro).not.toHaveBeenCalled()
})
