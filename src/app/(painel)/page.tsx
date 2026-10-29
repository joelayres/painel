import { redirect } from 'next/navigation'
import { hojeSP } from '@/dominio/tempo'
import { ehEquipe, exigirSessao } from '@/lib/auth/perfil'
import { carregarProjetos } from '@/lib/painel/dados'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { ListaProjetos } from './ListaProjetos'

export const metadata = { title: 'Projetos · Painel de Mobilização' }

export default async function Projetos({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { cliente } = await searchParams
  const sessao = await exigirSessao()
  const sb = await criarClienteServidor()
  const todos = await carregarProjetos(sb, hojeSP())
  const projetos = todos.filter((p) => !p.encerrado)
  const equipe = ehEquipe(sessao.perfil)
  if (!equipe && projetos.length === 1) redirect(`/projetos/${projetos[0].id}/resumo`)
  // O Administrador tem a página Encerrados. O Analista vê os encerrados dele no fim da lista;
  // gestor e cliente, só quando não têm projeto ativo.
  const encerrados = sessao.perfil === 'analista' ? todos.filter((p) => p.encerrado) : !equipe && projetos.length === 0 ? todos.filter((p) => p.encerrado) : []
  const clientes = equipe ? ((await sb.from('clientes').select('id, nome').order('nome')).data ?? []) : []
  return <ListaProjetos projetos={projetos} encerrados={encerrados} perfil={sessao.perfil} clientes={clientes} clienteAtivo={cliente} />
}
