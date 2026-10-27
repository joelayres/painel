'use server'

import { redirect } from 'next/navigation'
import { rotaInicial } from '@/lib/auth/rotas'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import type { Perfil } from '@/lib/auth/perfil'

const normalizar = (email: string) => email.trim().toLowerCase()

// Responde ok mesmo quando o e-mail não existe: a tela não pode revelar se está cadastrado.
// Só o limite de envios vira aviso (vale para qualquer e-mail, não revela nada).
export async function enviarCodigo(email: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const supabase = await criarClienteServidor()
  const { error } = await supabase.auth.signInWithOtp({ email: normalizar(email), options: { shouldCreateUser: false } })
  if (error?.status === 429) return { ok: false, erro: 'Muitos pedidos de código. Aguarde um minuto e tente de novo.' }
  return { ok: true }
}

export async function verificarCodigo(
  email: string,
  codigo: string,
): Promise<{ ok: true; destino: string } | { ok: false; erro: string }> {
  const supabase = await criarClienteServidor()
  const { error } = await supabase.auth.verifyOtp({ email: normalizar(email), token: codigo.trim(), type: 'email' })
  if (error) return { ok: false, erro: 'Código inválido ou expirado.' }
  const { data: perfil, error: erroPerfil } = await supabase.rpc('meu_perfil')
  if (erroPerfil) {
    await supabase.auth.signOut()
    return { ok: false, erro: 'Não foi possível entrar agora. Tente de novo em instantes.' }
  }
  if (!perfil) await supabase.auth.signOut()
  return { ok: true, destino: rotaInicial((perfil as Perfil | null) ?? null) }
}

export async function sair(): Promise<void> {
  const supabase = await criarClienteServidor()
  await supabase.auth.signOut()
  redirect('/entrar')
}
