import 'server-only'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { criarClienteServidor } from '@/lib/supabase/servidor'

export type Perfil = 'rh' | 'visualizador'
export type Sessao = { usuarioId: string; perfil: Perfil; nome: string }

// cache: layout e página do mesmo request compartilham a mesma consulta.
export const obterSessao = cache(async (): Promise<Sessao | null> => {
  const supabase = await criarClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('usuarios').select('nome, perfil, ativo').eq('usuario_id', user.id).maybeSingle()
  if (!data?.ativo) return null
  return { usuarioId: user.id, perfil: data.perfil as Perfil, nome: data.nome }
})

export async function exigirSessao(): Promise<Sessao> {
  const sessao = await obterSessao()
  if (!sessao) redirect('/entrar')
  return sessao
}

export async function exigirRh(): Promise<Sessao> {
  const sessao = await exigirSessao()
  if (sessao.perfil !== 'rh') redirect('/')
  return sessao
}
