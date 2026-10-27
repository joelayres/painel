import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function clienteAdmin(): SupabaseClient {
  return createClient(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
}

// Prefixo único por execução: tudo que o teste cria começa com ele (a trava usa isso).
export const prefixo = `teste-${randomUUID().slice(0, 8)}`
const SENHA = `Senha-${randomUUID()}`

export async function criarUsuario(admin: SupabaseClient, nome: string, perfil: 'rh' | 'visualizador') {
  const email = `${prefixo}-${nome}@exemplo.test`
  const { data, error } = await admin.auth.admin.createUser({ email, password: SENHA, email_confirm: true })
  if (error) throw error
  const usuarioId = data.user.id
  const { error: e2 } = await admin.from('usuarios').insert({ usuario_id: usuarioId, nome: `${prefixo} ${nome}`, email, perfil })
  if (e2) throw e2
  return { usuarioId, email, nome: `${prefixo} ${nome}` }
}

export async function entrarComo(email: string): Promise<SupabaseClient> {
  const cliente = createClient(url(), anon(), { auth: { persistSession: false } })
  const { error } = await cliente.auth.signInWithPassword({ email, password: SENHA })
  if (error) throw error
  return cliente
}

// Usa a onda que já existir com esse número; só cria (e depois apaga) se não houver.
const ondasCriadas: string[] = []
export async function garantirOnda(admin: SupabaseClient, numero: number, inicio = '2026-10-22', fim = '2026-12-31'): Promise<string> {
  const { data: existente } = await admin.from('ondas').select('id').eq('numero', numero).maybeSingle()
  if (existente) return existente.id
  const { data, error } = await admin.from('ondas').insert({ numero, inicio, fim }).select('id').single()
  if (error) throw error
  ondasCriadas.push(data.id)
  return data.id
}

export async function apagarDoTeste(admin: SupabaseClient) {
  await admin.from('vagas').delete().like('funcao', `${prefixo}%`)
  await admin.from('historico').delete().is('vaga_id', null).like('nome_usuario', `${prefixo}%`)
  if (ondasCriadas.length) await admin.from('ondas').delete().in('id', ondasCriadas.splice(0))
  await admin.from('usuarios').delete().like('email', `${prefixo}%`)
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const u of data.users.filter((u) => u.email?.startsWith(prefixo))) await admin.auth.admin.deleteUser(u.id)
}
