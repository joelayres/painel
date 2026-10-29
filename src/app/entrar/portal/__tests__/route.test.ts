import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { assinarEntrada } from '@/lib/portal/token'

const generateLink = vi.fn()
const getUserById = vi.fn()
const verifyOtp = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ criarClienteAdmin: () => ({ auth: { admin: { generateLink, getUserById } } }) }))
vi.mock('@/lib/supabase/servidor', () => ({ criarClienteServidor: async () => ({ auth: { verifyOtp } }) }))
const usuarioDoPortal = vi.fn()
const registrarUso = vi.fn()
vi.mock('@/lib/portal/entrada', () => ({ usuarioDoPortal, registrarUso }))
const cookieSet = vi.fn()
vi.mock('next/headers', () => ({ cookies: async () => ({ set: cookieSet }) }))
const redirect = vi.fn()
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }))

const { GET } = await import('../route')
const chamar = (t: string) => GET(new Request(`http://x/entrar/portal?t=${encodeURIComponent(t)}`))
const token = (sistema = 'mobilizacao', agora?: Date) => assinarEntrada({ email: 'Ana@X.com', sistema }, 'segredo', agora)

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  process.env.PORTAL_SEGREDO = 'segredo'
  usuarioDoPortal.mockResolvedValue({ id: 'r1', perfil: 'gestor', usuarioId: 'u1' })
  registrarUso.mockResolvedValue(true)
  getUserById.mockResolvedValue({ data: { user: { email: 'ana.login@x.com' } }, error: null })
  generateLink.mockResolvedValue({ data: { properties: { hashed_token: 'hash1' } }, error: null })
  verifyOtp.mockResolvedValue({ error: null })
})
afterEach(() => {
  delete process.env.PORTAL_SEGREDO
})

test('sem PORTAL_SEGREDO a rota não existe', async () => {
  delete process.env.PORTAL_SEGREDO
  const r = await chamar(token())
  expect(r?.status).toBe(404)
  expect(redirect).not.toHaveBeenCalled()
})

test('token válido cria a sessão e leva ao painel', async () => {
  await chamar(token())
  expect(usuarioDoPortal).toHaveBeenCalledWith(expect.anything(), 'ana@x.com')
  // O link sai da conta encontrada no cadastro, não do e-mail escrito no token.
  expect(getUserById).toHaveBeenCalledWith('u1')
  expect(generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'ana.login@x.com' })
  // Troca a sessão mesmo que o navegador já esteja logado com outra conta.
  expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash1', type: 'email' })
  expect(redirect).toHaveBeenCalledWith('/')
  // Marca a sessão como vinda do portal, para o sistema mostrar o link de volta.
  expect(cookieSet).toHaveBeenCalledWith('veio_do_portal', '1', expect.objectContaining({ httpOnly: true, path: '/' }))
})

test('token já usado vai para o aviso, sem criar sessão', async () => {
  registrarUso.mockResolvedValue(false)
  await chamar(token())
  expect(generateLink).not.toHaveBeenCalled()
  expect(redirect).toHaveBeenCalledWith('/entrar?erro=portal')
  expect(cookieSet).not.toHaveBeenCalled()
})

test('token expirado, de outro sistema, adulterado ou de quem não pode entrar vai para o aviso', async () => {
  await chamar(token('mobilizacao', new Date(Date.now() - 120_000)))
  await chamar(token('he'))
  await chamar(`${token()}x`)
  usuarioDoPortal.mockResolvedValue(null)
  await chamar(token())
  expect(redirect.mock.calls).toEqual(Array(4).fill(['/entrar?erro=portal']))
  expect(generateLink).not.toHaveBeenCalled()
  expect(String(redirect.mock.calls)).not.toMatch(/expirado|assinatura/)
})

test('falha no Auth ou no banco vai para o aviso, nunca um erro 500', async () => {
  verifyOtp.mockResolvedValue({ error: { message: 'falhou' } })
  await chamar(token())
  usuarioDoPortal.mockRejectedValue(new Error('caiu'))
  await chamar(token())
  expect(redirect.mock.calls).toEqual([['/entrar?erro=portal'], ['/entrar?erro=portal']])
})
