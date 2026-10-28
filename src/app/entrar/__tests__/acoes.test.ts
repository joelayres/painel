import { beforeEach, expect, test, vi } from 'vitest'

const auth = {
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
}
const rpc = vi.fn()
vi.mock('@/lib/supabase/servidor', () => ({
  criarClienteServidor: async () => ({ auth, rpc }),
}))

const redirect = vi.fn()
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }))

const { enviarCodigo, sair, verificarCodigo } = await import('../acoes')

beforeEach(() => vi.clearAllMocks())

test('envia código sem criar usuário e com e-mail normalizado', async () => {
  auth.signInWithOtp.mockResolvedValue({ error: null })
  await enviarCodigo('  Joel.Ayres@Timenow.com.br ')
  expect(auth.signInWithOtp).toHaveBeenCalledWith({
    email: 'joel.ayres@timenow.com.br',
    options: { shouldCreateUser: false },
  })
})

test('não revela se o e-mail existe', async () => {
  auth.signInWithOtp.mockResolvedValue({ error: { message: 'Signups not allowed for otp' } })
  expect(await enviarCodigo('naoexiste@exemplo.com')).toEqual({ ok: true })
})

test('código errado', async () => {
  auth.verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } })
  expect(await verificarCodigo('a@b.com', '000000')).toEqual({ ok: false, erro: 'Código inválido ou expirado.' })
})

test('código certo leva ao painel', async () => {
  auth.verifyOtp.mockResolvedValue({ error: null })
  rpc.mockResolvedValue({ data: 'gestor', error: null })
  expect(await verificarCodigo('a@b.com', '123456')).toEqual({ ok: true, destino: '/' })
  expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'a@b.com', token: '123456', type: 'email' })
})

test('código certo sem perfil ativo encerra a sessão', async () => {
  auth.verifyOtp.mockResolvedValue({ error: null })
  rpc.mockResolvedValue({ data: null, error: null })
  expect(await verificarCodigo('a@b.com', '123456')).toEqual({ ok: true, destino: '/entrar?erro=sem-acesso' })
  expect(auth.signOut).toHaveBeenCalled()
})

test('sair encerra a sessão e volta para a entrada', async () => {
  await sair()
  expect(auth.signOut).toHaveBeenCalled()
  expect(redirect).toHaveBeenCalledWith('/entrar')
})

test('limite de envios do Supabase vira aviso para aguardar', async () => {
  auth.signInWithOtp.mockResolvedValue({ error: { status: 429, message: 'email rate limit exceeded' } })
  expect(await enviarCodigo('a@b.com')).toEqual({ ok: false, erro: 'Muitos pedidos de código. Aguarde um minuto e tente de novo.' })
})

test('falha de conexão ao ler o perfil não aparece como acesso inativo', async () => {
  auth.verifyOtp.mockResolvedValue({ error: null })
  rpc.mockResolvedValue({ data: null, error: { message: 'fetch failed' } })
  expect(await verificarCodigo('a@b.com', '123456')).toEqual({ ok: false, erro: 'Não foi possível entrar agora. Tente de novo em instantes.' })
})
