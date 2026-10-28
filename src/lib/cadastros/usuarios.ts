// Cadastro de quem entra no painel: cria o login (sem senha; entra por código no e-mail) e o perfil.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { validar } from '@/lib/validacao/vaga'

export const esquemaUsuario = z.object({
  nome: z.string({ error: 'Informe o nome.' }).trim().min(1, 'Informe o nome.'),
  email: z.string({ error: 'Informe o e-mail.' }).trim().toLowerCase().pipe(z.email('E-mail inválido.')),
  perfil: z.enum(['rh', 'visualizador'], { error: 'Escolha o perfil.' }),
})

// Bloqueio longo: o Supabase não tem "para sempre" (mesmo valor do HE Timenow).
const BLOQUEIO = '876000h'

export async function cadastrarUsuario(admin: SupabaseClient, entrada: unknown): Promise<{ ok: true } | { ok: false; erros: Record<string, string> }> {
  const r = validar(esquemaUsuario, entrada)
  if (!r.ok) return r
  const d = r.dados
  const { data: existente } = await admin.from('usuarios').select('id').eq('email', d.email).maybeSingle()
  if (existente) return { ok: false, erros: { email: 'E-mail já cadastrado.' } }
  const { data: criado, error } = await admin.auth.admin.createUser({ email: d.email, email_confirm: true })
  if (error || !criado.user) return { ok: false, erros: { email: 'Não foi possível criar o acesso deste e-mail.' } }
  const { error: e2 } = await admin.from('usuarios').insert({ usuario_id: criado.user.id, nome: d.nome, email: d.email, perfil: d.perfil })
  if (e2) {
    await admin.auth.admin.deleteUser(criado.user.id)
    return { ok: false, erros: { _: 'Não foi possível salvar. Tente de novo.' } }
  }
  return { ok: true }
}

export async function alterarUsuario(admin: SupabaseClient, id: string, entrada: { nome: string; perfil: 'rh' | 'visualizador'; ativo: boolean }): Promise<{ ok: true } | { ok: false; erros: Record<string, string> }> {
  const { data: atual } = await admin.from('usuarios').select('usuario_id').eq('id', id).single()
  const { error } = await admin.from('usuarios').update({ nome: entrada.nome.trim(), perfil: entrada.perfil, ativo: entrada.ativo }).eq('id', id)
  if (error) return { ok: false, erros: { _: 'Não foi possível salvar. Tente de novo.' } }
  if (atual?.usuario_id) await admin.auth.admin.updateUserById(atual.usuario_id, { ban_duration: entrada.ativo ? 'none' : BLOQUEIO })
  return { ok: true }
}
