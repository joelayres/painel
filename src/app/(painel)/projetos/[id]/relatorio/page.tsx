import Link from 'next/link'
import { notFound } from 'next/navigation'
import { filtrarVagas } from '@/dominio/painel'
import { lerVisao, montarRelatorio, type ColunaOrdem } from '@/dominio/relatorio'
import { hojeSP } from '@/dominio/tempo'
import { buscarTarifasFinanceiro } from '@/lib/financeiro/tarifas'
import { carregarPainel } from '@/lib/painel/dados'
import { ehUuid } from '@/lib/validacao/vaga'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { FiltrosRelatorio } from './FiltrosRelatorio'
import { TabelaRelatorio } from './TabelaRelatorio'

export const metadata = { title: 'Relatório · Painel de Mobilização' }

export default async function PaginaRelatorio({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params
  if (!ehUuid(id)) notFound()
  // Só os parâmetros simples (texto único) contam; o resto do endereço é ignorado.
  const busca = new URLSearchParams(Object.entries(await searchParams).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])))
  // As tarifas vêm do Financeiro a cada abertura; fora do ar, o relatório abre sem elas.
  const [painel, tarifas] = await Promise.all([carregarPainel(await criarClienteServidor(), hojeSP(), id), buscarTarifasFinanceiro()])
  if (!painel) notFound()
  const { projeto, vagas, etapas, ondas, foraDoRelatorio } = painel
  const porOndas = projeto.organizacao === 'ondas'
  const pedida = busca.get('onda')
  const onda = porOndas && pedida && ondas.some((o) => o.id === pedida) ? pedida : undefined
  const visao = lerVisao(busca)
  const relatorio = montarRelatorio(filtrarVagas(vagas, { onda }), etapas, tarifas, { ocultas: new Set(foraDoRelatorio), visao })

  const base = `/projetos/${id}/relatorio`
  // Mantém o resto do endereço (onda, filtros, ordem) e troca só o que mudou.
  const com = (caminho: string, mudar: Record<string, string | null>) => {
    const p = new URLSearchParams(busca)
    if (onda) p.set('onda', onda)
    else p.delete('onda')
    for (const [k, v] of Object.entries(mudar)) {
      if (v === null) p.delete(k)
      else p.set(k, v)
    }
    const q = p.toString()
    return q ? `${caminho}?${q}` : caminho
  }
  const hrefOrdem = (coluna: ColunaOrdem, sentido: 'asc' | 'desc') => com(base, { ordem: coluna, sentido })
  const botao = (ativo: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-foco ${ativo ? 'border-primaria bg-primaria text-white' : 'border-borda bg-superficie hover:border-primaria'}`

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {porOndas ? (
          <nav aria-label="Ondas" className="flex flex-wrap gap-2">
            <Link href={com(base, { onda: null })} aria-current={!onda ? 'true' : undefined} className={botao(!onda)}>Todas</Link>
            {ondas.map((o) => (
              <Link key={o.id} href={com(base, { onda: o.id })} aria-current={onda === o.id ? 'true' : undefined} className={botao(onda === o.id)}>{o.nome}</Link>
            ))}
          </nav>
        ) : <span />}
        {/* Rota que devolve um arquivo: <a> comum, sem a navegação do Next. */}
        <a href={com(`${base}/excel`, {})} className="rounded-lg border border-primaria px-3 py-1.5 text-sm font-medium text-primaria hover:bg-primaria hover:text-white focus-visible:outline-2 focus-visible:outline-foco">
          Baixar Excel
        </a>
      </div>
      <FiltrosRelatorio opcoes={relatorio.opcoes} />
      <TabelaRelatorio relatorio={relatorio} porOndas={porOndas} visao={visao} hrefOrdem={hrefOrdem} />
    </div>
  )
}
