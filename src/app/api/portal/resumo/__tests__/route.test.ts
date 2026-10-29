import { afterEach, beforeEach, expect, test, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ criarClienteAdmin: () => ({}) }))
const usuarioDoPortal = vi.fn()
vi.mock('@/lib/portal/entrada', () => ({ usuarioDoPortal }))
const carregarResumoVagas = vi.fn()
vi.mock('@/lib/portal/resumoVagas', () => ({ carregarResumoVagas }))

const { GET } = await import('../route')
const chamar = (consulta: string, auth: string | null = 'Bearer segredo') =>
  GET(new Request(`http://x/api/portal/resumo?${consulta}`, { headers: auth ? { Authorization: auth } : {} }))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.PORTAL_SEGREDO = 'segredo'
  usuarioDoPortal.mockResolvedValue({ id: 'r1', perfil: 'gestor', usuarioId: 'u1' })
  carregarResumoVagas.mockResolvedValue({ versao: 1, secoes: [], alertas: [] })
})
afterEach(() => {
  delete process.env.PORTAL_SEGREDO
})

test('sem segredo configurado a rota não existe', async () => {
  delete process.env.PORTAL_SEGREDO
  expect((await chamar('email=a@x.com')).status).toBe(404)
})

test('segredo errado ou ausente', async () => {
  expect((await chamar('email=a@x.com', 'Bearer errado')).status).toBe(401)
  expect((await chamar('email=a@x.com', null)).status).toBe(401)
})

test('cliente ou inativo recebe 403', async () => {
  usuarioDoPortal.mockResolvedValue(null)
  expect((await chamar('email=cliente@x.com')).status).toBe(403)
  expect(carregarResumoVagas).not.toHaveBeenCalled()
})

test('sem e-mail é consulta inválida', async () => {
  expect((await chamar('')).status).toBe(400)
})

test('devolve o resumo da pessoa', async () => {
  const r = await chamar('email=Ana@X.com')
  expect(r.status).toBe(200)
  expect(await r.json()).toEqual({ versao: 1, secoes: [], alertas: [] })
  expect(usuarioDoPortal).toHaveBeenCalledWith({}, 'ana@x.com')
  expect(carregarResumoVagas).toHaveBeenCalledWith({}, { id: 'r1', perfil: 'gestor', usuarioId: 'u1' })
})

test('falha ao ler devolve 500 sem detalhes', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  carregarResumoVagas.mockRejectedValue(new Error('banco caiu'))
  const r = await chamar('email=a@x.com')
  expect(r.status).toBe(500)
  expect(await r.text()).not.toContain('banco caiu')
})
