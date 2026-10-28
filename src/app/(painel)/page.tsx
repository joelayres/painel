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
  const projetos = (await carregarProjetos(sb, hojeSP())).filter((p) => !p.encerrado)
  if (sessao.perfil !== 'rh' && projetos.length === 1) redirect(`/projetos/${projetos[0].id}`)
  const clientes =
    sessao.perfil === 'rh' ? ((await sb.from('clientes').select('id, nome').order('nome')).data ?? []) : []
  return <ListaProjetos projetos={projetos} perfil={sessao.perfil} clientes={clientes} />
}
