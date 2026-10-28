import Link from 'next/link'
import { notFound } from 'next/navigation'
import { filtrarVagas, resumoPorEtapa } from '@/dominio/painel'
import { hojeSP } from '@/dominio/tempo'
import { carregarPainel } from '@/lib/painel/dados'
import { ehUuid } from '@/lib/validacao/vaga'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CartoesEtapa } from './CartoesEtapa'

export const metadata = { title: 'Resumo · Painel de Mobilização' }

export default async function Resumo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onda?: string }> }) {
  const { id } = await params
  if (!ehUuid(id)) notFound()
  const busca = await searchParams
  const painel = await carregarPainel(await criarClienteServidor(), hojeSP(), id)
  if (!painel) notFound()
  const { projeto, vagas, etapas, ondas } = painel
  const porOndas = projeto.organizacao === 'ondas'
  const onda = porOndas && busca.onda && ondas.some((o) => o.id === busca.onda) ? busca.onda : undefined
  const filtradas = filtrarVagas(vagas, { onda })
  const cartoes = resumoPorEtapa(filtradas, etapas)
  const mobilizadas = cartoes.find((c) => c.ordem === null)?.total ?? 0
  const emAndamento = filtradas.length - mobilizadas

  const hrefFuncao = (funcao: string) => {
    const p = new URLSearchParams({ funcao })
    if (onda) p.set('onda', onda)
    return `/projetos/${id}?${p}`
  }
  const botao = (ativo: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-foco ${ativo ? 'border-primaria bg-primaria text-white' : 'border-borda bg-superficie hover:border-primaria'}`

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {porOndas ? (
          <nav aria-label="Ondas" className="flex flex-wrap gap-2">
            <Link href={`/projetos/${id}/resumo`} aria-current={!onda ? 'true' : undefined} className={botao(!onda)}>Todas</Link>
            {ondas.map((o) => (
              <Link key={o.id} href={`/projetos/${id}/resumo?onda=${o.id}`} aria-current={onda === o.id ? 'true' : undefined} className={botao(onda === o.id)}>{o.nome}</Link>
            ))}
          </nav>
        ) : <span />}
        <span className="text-sm text-texto-suave">{emAndamento} em andamento · {mobilizadas} mobilizadas</span>
      </div>
      <CartoesEtapa cartoes={cartoes} hrefFuncao={hrefFuncao} />
    </div>
  )
}
