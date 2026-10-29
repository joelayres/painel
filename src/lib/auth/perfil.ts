import 'server-only'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { criarClienteServidor } from '@/lib/supabase/servidor'

export type Perfil = 'rh' | 'analista' | 'gestor' | 'cliente'
// usuarioId é o do login (auth); usuarioRegistroId é o usuarios.id (usado em projeto_acessos).
export type Sessao = { usuarioId: string; usuarioRegistroId: string; perfil: Perfil; nome: string; clienteId: string | null }

// cache: layout e página do mesmo request compartilham a mesma consulta.
export const obterSessao = cache(async (): Promise<Sessao | null> => {
  const supabase = await criarClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('usuarios').select('id, nome, perfil, ativo, cliente_id').eq('usuario_id', user.id).maybeSingle()
  if (!data?.ativo) return null
  return { usuarioId: user.id, usuarioRegistroId: data.id, perfil: data.perfil as Perfil, nome: data.nome, clienteId: data.cliente_id ?? null }
})

export async function exigirSessao(): Promise<Sessao> {
  const sessao = await obterSessao()
  if (!sessao) redirect('/entrar')
  return sessao
}

// Quem é da equipe (Administrador ou Analista de RH) opera projetos; a permissão por projeto fica com o banco.
export function ehEquipe(perfil: Perfil): boolean {
  return perfil === 'rh' || perfil === 'analista'
}

// Só o Administrador (perfil rh): cadastros gerais, usuários, feriados e encerrados.
export async function exigirAdmin(): Promise<Sessao> {
  const sessao = await exigirSessao()
  if (sessao.perfil !== 'rh') redirect('/')
  return sessao
}

export async function exigirEquipe(): Promise<Sessao> {
  const sessao = await exigirSessao()
  if (!ehEquipe(sessao.perfil)) redirect('/')
  return sessao
}

/** @deprecated Alias de exigirAdmin até a Task 3 trocar as páginas e actions de projeto por exigirEquipe. */
export const exigirRh = exigirAdmin
