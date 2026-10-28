import 'server-only'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { criarClienteServidor } from '@/lib/supabase/servidor'

export type Perfil = 'rh' | 'gestor' | 'cliente'
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

export async function exigirRh(): Promise<Sessao> {
  const sessao = await exigirSessao()
  if (sessao.perfil !== 'rh') redirect('/')
  return sessao
}
