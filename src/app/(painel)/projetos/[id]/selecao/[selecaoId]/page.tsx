import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirEquipe } from '@/lib/auth/perfil'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { ehUuid } from '@/lib/validacao/vaga'
import { CabecalhoSelecao } from './CabecalhoSelecao'
import { carregarSelecao, idsPendentes } from './dados'
import { ImportarCurriculos } from './ImportarCurriculos'
import { ListaParticipacoes } from './ListaParticipacoes'
import { dataBR } from '@/lib/formato/datas'
import { rpcLivre } from '@/lib/curriculos/rpc'

export const metadata = { title: 'Seleção · Painel de Mobilização' }
// Cada análise de currículo (server action desta página) leva de 10 a 60 segundos.
export const maxDuration = 60

export default async function TelaSelecao({ params }: { params: Promise<{ id: string; selecaoId: string }> }) {
  const { id, selecaoId } = await params
  if (!ehUuid(id) || !ehUuid(selecaoId)) notFound()
  await exigirEquipe()
  const sb = await criarClienteServidor()
  const dados = await carregarSelecao(sb, selecaoId)
  if (!dados || dados.selecao.projeto_id !== id) notFound()
  const { selecao, participacoes } = dados
  const { data: vagas } = await sb.from('vagas').select('id, funcao, disciplina, area, candidato, data_inicio, cancelada_em').eq('projeto_id', id).order('data_inicio')
  const funcoes = [...new Set((vagas ?? []).map((v) => v.funcao))]
  const { data: indicadores } = await rpcLivre<string[]>(sb, 'indicadores', {})
  // Vagas da mesma função ainda sem candidato: para onde levar o nome de quem for escolhido.
  const mesmaFuncao = (a: string) => a.trim().toLocaleLowerCase('pt-BR')
  const vagasLivres = (vagas ?? [])
    .filter((v) => !v.cancelada_em && !v.candidato && mesmaFuncao(v.funcao) === mesmaFuncao(selecao.funcao))
    .map((v) => ({ id: v.id, rotulo: `${v.funcao} · ${v.disciplina} · ${v.area} · início ${dataBR(v.data_inicio)}` }))

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/projetos/${id}/selecao`} className="text-sm font-medium text-primaria hover:underline">← Seleções</Link>
      <CabecalhoSelecao selecao={selecao} funcoes={funcoes} />
      {!selecao.encerrada_em && <ImportarCurriculos selecaoId={selecao.id} pendentes={idsPendentes(participacoes)} />}
      <ListaParticipacoes participacoes={participacoes} vagas={vagasLivres} indicadores={indicadores ?? []} />
    </div>
  )
}
