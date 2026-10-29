// Quem pode entrar no Painel vindo do Portal da Gestão, e o registro de tokens já usados.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/tipos'

type Admin = SupabaseClient<Database>
export type UsuarioPortal = { id: string; perfil: 'rh' | 'analista' | 'gestor' }

const UM_DIA_MS = 24 * 60 * 60 * 1000
const PERFIS_DO_PORTAL = ['rh', 'analista', 'gestor']
// "_" e "%" são curingas no ilike; e-mails com "_" são comuns.
const literal = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`)

// Cliente nunca entra pelo portal, mesmo com token válido: protege contra um erro na lista do portal.
export async function usuarioDoPortal(admin: Admin, email: string): Promise<UsuarioPortal | null> {
  const { data, error } = await admin.from('usuarios').select('id, perfil, ativo, usuario_id').ilike('email', literal(email.trim().toLowerCase())).maybeSingle()
  if (error) throw new Error(`Não foi possível conferir o usuário: ${error.message}`)
  if (!data?.ativo || !data.usuario_id || !PERFIS_DO_PORTAL.includes(data.perfil)) return null
  return { id: data.id, perfil: data.perfil as UsuarioPortal['perfil'] }
}

// false quando o token já foi usado. Aproveita para apagar os registros com mais de um dia (sem rotina agendada).
export async function registrarUso(admin: Admin, jti: string): Promise<boolean> {
  await admin.from('entradas_portal').delete().lt('usado_em', new Date(Date.now() - UM_DIA_MS).toISOString())
  const { error } = await admin.from('entradas_portal').insert({ jti })
  if (!error) return true
  if (error.code === '23505') return false
  throw new Error(`Não foi possível registrar a entrada: ${error.message}`)
}
