import { redirect } from 'next/navigation'
import { rotaInicial } from '@/lib/auth/rotas'
import { registrarUso, usuarioDoPortal } from '@/lib/portal/entrada'
import { segredoPortal } from '@/lib/portal/segredo'
import { conferirEntrada } from '@/lib/portal/token'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { criarClienteServidor } from '@/lib/supabase/servidor'

export const dynamic = 'force-dynamic'

const AVISO = '/entrar?erro=portal'

// Confere o token e cria a sessão no servidor. Devolve para onde ir; o motivo de uma recusa fica só no log.
async function entrar(token: string, segredo: string): Promise<string> {
  const r = conferirEntrada(token, segredo, 'mobilizacao')
  if (!r.ok) {
    console.warn('Entrada pelo portal recusada:', r.motivo)
    return AVISO
  }
  const { email, jti } = r.entrada
  const admin = criarClienteAdmin()
  const usuario = await usuarioDoPortal(admin, email)
  if (!usuario) {
    console.warn('Entrada pelo portal recusada: sem perfil que entra pelo portal', email)
    return AVISO
  }
  if (!(await registrarUso(admin, jti))) {
    console.warn('Entrada pelo portal recusada: token já usado', email)
    return AVISO
  }
  // O link sai da conta encontrada (não do e-mail do token), para nunca abrir nem criar outra conta.
  const { data: conta, error: erroConta } = await admin.auth.admin.getUserById(usuario.usuarioId)
  if (erroConta || !conta.user?.email) throw new Error(`Não foi possível ler o acesso: ${erroConta?.message ?? 'sem e-mail'}`)
  // O link não é enviado: o hash vira a sessão aqui mesmo, nos cookies desta resposta.
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: conta.user.email })
  if (error || !data?.properties?.hashed_token) throw new Error(`Não foi possível gerar o acesso: ${error?.message ?? 'sem hash'}`)
  const supabase = await criarClienteServidor()
  const { error: erroSessao } = await supabase.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'email' })
  if (erroSessao) throw new Error(`Não foi possível criar a sessão: ${erroSessao.message}`)
  return rotaInicial(usuario.perfil)
}

export async function GET(req: Request) {
  const segredo = segredoPortal()
  if (!segredo) return new Response(null, { status: 404 })
  const token = new URL(req.url).searchParams.get('t') ?? ''
  const destino = await entrar(token, segredo).catch((e: unknown) => {
    console.error('Entrada pelo portal falhou:', e instanceof Error ? e.message : e)
    return AVISO
  })
  redirect(destino)
}
