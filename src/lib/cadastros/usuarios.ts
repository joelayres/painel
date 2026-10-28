// Cadastro de quem entra no painel: cria o login (sem senha; entra por código no e-mail) e o perfil.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { validar } from '@/lib/validacao/vaga'

export const esquemaUsuario = z.object({
  nome: z.string({ error: 'Informe o nome.' }).trim().min(1, 'Informe o nome.'),
  email: z.string({ error: 'Informe o e-mail.' }).trim().toLowerCase().pipe(z.email('E-mail inválido.')),
  perfil: z.enum(['rh', 'gestor', 'cliente'], { error: 'Escolha o perfil.' }),
  clienteId: z.string().nullish().transform((v) => v || null),
}).superRefine((d, ctx) => {
  if (d.perfil === 'cliente' && !d.clienteId) ctx.addIssue({ code: 'custom', path: ['clienteId'], message: 'Escolha o cliente.' })
}).transform((d) => ({ ...d, clienteId: d.perfil === 'cliente' ? d.clienteId : null }))

export type PerfilUsuario = 'rh' | 'gestor' | 'cliente'
export const ROTULO_PERFIL: Record<PerfilUsuario, string> = { rh: 'RH', gestor: 'Gestor Timenow', cliente: 'Cliente' }

// Bloqueio longo: o Supabase não tem "para sempre" (mesmo valor do HE Timenow).
const BLOQUEIO = '876000h'

export async function cadastrarUsuario(admin: SupabaseClient, entrada: unknown): Promise<{ ok: true } | { ok: false; erros: Record<string, string> }> {
  const r = validar(esquemaUsuario, entrada)
  if (!r.ok) return r
  const d = r.dados
  const { data: existente } = await admin.from('usuarios').select('id').eq('email', d.email).maybeSingle()
  if (existente) return { ok: false, erros: { email: 'E-mail já cadastrado.' } }
  const { data: criado, error } = await admin.auth.admin.createUser({ email: d.email, email_confirm: true })
  // Pessoa removida antes continua no login: reaproveita o acesso e tira o bloqueio.
  const reaproveitado = error?.code === 'email_exists' ? await usuarioDoLogin(admin, d.email) : null
  const usuarioId = criado.user?.id ?? reaproveitado
  if (!usuarioId) return { ok: false, erros: { email: 'Não foi possível criar o acesso deste e-mail.' } }
  const { error: e2 } = await admin.from('usuarios').insert({ usuario_id: usuarioId, nome: d.nome, email: d.email, perfil: d.perfil, cliente_id: d.clienteId })
  if (e2) {
    if (!reaproveitado) await admin.auth.admin.deleteUser(usuarioId)
    return { ok: false, erros: { _: 'Não foi possível salvar. Tente de novo.' } }
  }
  if (reaproveitado) await admin.auth.admin.updateUserById(reaproveitado, { ban_duration: 'none' })
  return { ok: true }
}

async function usuarioDoLogin(admin: SupabaseClient, email: string): Promise<string | null> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  return data?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null
}

export async function alterarUsuario(admin: SupabaseClient, id: string, entrada: { nome: string; perfil: PerfilUsuario; clienteId: string | null; ativo: boolean }): Promise<{ ok: true } | { ok: false; erros: Record<string, string> }> {
  const { data: atual } = await admin.from('usuarios').select('usuario_id').eq('id', id).single()
  const { error } = await admin.from('usuarios').update({ nome: entrada.nome.trim(), perfil: entrada.perfil, cliente_id: entrada.perfil === 'cliente' ? entrada.clienteId : null, ativo: entrada.ativo }).eq('id', id)
  if (error) return { ok: false, erros: { _: 'Não foi possível salvar. Tente de novo.' } }
  if (atual?.usuario_id) {
    const { error: e2 } = await admin.auth.admin.updateUserById(atual.usuario_id, { ban_duration: entrada.ativo ? 'none' : BLOQUEIO })
    if (e2) return { ok: false, erros: { _: 'A situação foi gravada, mas o bloqueio do acesso falhou. Tente de novo.' } }
  }
  return { ok: true }
}
