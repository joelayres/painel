import { redirect } from 'next/navigation'
import { hojeSP } from '@/dominio/tempo'
import { exigirSessao } from '@/lib/auth/perfil'
import { carregarProjetos } from '@/lib/painel/dados'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { ListaProjetos } from './ListaProjetos'

export const metadata = { title: 'Projetos · Painel de Mobilização' }

export default async function Projetos() {
  const sessao = await exigirSessao()
  const sb = await criarClienteServidor()
  const todos = await carregarProjetos(sb, hojeSP())
  const projetos = todos.filter((p) => !p.encerrado)
  const rh = sessao.perfil === 'rh'
  if (!rh && projetos.length === 1) redirect(`/projetos/${projetos[0].id}`)
  // Quem não é RH não tem a página Encerrados: sem projeto ativo, vê aqui os encerrados liberados.
  const encerrados = !rh && projetos.length === 0 ? todos.filter((p) => p.encerrado) : []
  const clientes = rh ? ((await sb.from('clientes').select('id, nome').order('nome')).data ?? []) : []
  return <ListaProjetos projetos={projetos} encerrados={encerrados} perfil={sessao.perfil} clientes={clientes} />
}
