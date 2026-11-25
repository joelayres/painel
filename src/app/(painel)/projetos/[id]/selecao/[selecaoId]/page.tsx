import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirEquipe } from '@/lib/auth/perfil'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { ehUuid } from '@/lib/validacao/vaga'
import { CabecalhoSelecao } from './CabecalhoSelecao'
import { carregarSelecao, idsPendentes } from './dados'
import { ImportarCurriculos } from './ImportarCurriculos'

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
  const { data: vagas } = await sb.from('vagas').select('funcao').eq('projeto_id', id)
  const funcoes = [...new Set((vagas ?? []).map((v) => v.funcao))]

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/projetos/${id}/selecao`} className="text-sm font-medium text-primaria hover:underline">← Seleções</Link>
      <CabecalhoSelecao selecao={selecao} funcoes={funcoes} />
      {!selecao.encerrada_em && <ImportarCurriculos selecaoId={selecao.id} pendentes={idsPendentes(participacoes)} />}
    </div>
  )
}
