import Link from 'next/link'
import { notFound } from 'next/navigation'
import { filtrarVagas } from '@/dominio/painel'
import { montarRelatorio } from '@/dominio/relatorio'
import { hojeSP } from '@/dominio/tempo'
import { buscarTarifasFinanceiro } from '@/lib/financeiro/tarifas'
import { carregarPainel } from '@/lib/painel/dados'
import { ehUuid } from '@/lib/validacao/vaga'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { TabelaRelatorio } from './TabelaRelatorio'

export const metadata = { title: 'Relatório · Painel de Mobilização' }

export default async function PaginaRelatorio({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onda?: string }> }) {
  const { id } = await params
  if (!ehUuid(id)) notFound()
  const busca = await searchParams
  // As tarifas vêm do Financeiro a cada abertura; fora do ar, o relatório abre sem elas.
  const [painel, tarifas] = await Promise.all([carregarPainel(await criarClienteServidor(), hojeSP(), id), buscarTarifasFinanceiro()])
  if (!painel) notFound()
  const { projeto, vagas, etapas, ondas } = painel
  const porOndas = projeto.organizacao === 'ondas'
  const onda = porOndas && busca.onda && ondas.some((o) => o.id === busca.onda) ? busca.onda : undefined
  const relatorio = montarRelatorio(filtrarVagas(vagas, { onda }), etapas, tarifas)

  const base = `/projetos/${id}/relatorio`
  const botao = (ativo: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-foco ${ativo ? 'border-primaria bg-primaria text-white' : 'border-borda bg-superficie hover:border-primaria'}`

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {porOndas ? (
          <nav aria-label="Ondas" className="flex flex-wrap gap-2">
            <Link href={base} aria-current={!onda ? 'true' : undefined} className={botao(!onda)}>Todas</Link>
            {ondas.map((o) => (
              <Link key={o.id} href={`${base}?onda=${o.id}`} aria-current={onda === o.id ? 'true' : undefined} className={botao(onda === o.id)}>{o.nome}</Link>
            ))}
          </nav>
        ) : <span />}
        {/* Rota que devolve um arquivo: <a> comum, sem a navegação do Next. */}
        <a href={`${base}/excel${onda ? `?onda=${onda}` : ''}`} className="rounded-lg border border-primaria px-3 py-1.5 text-sm font-medium text-primaria hover:bg-primaria hover:text-white focus-visible:outline-2 focus-visible:outline-foco">
          Baixar Excel
        </a>
      </div>
      <TabelaRelatorio relatorio={relatorio} porOndas={porOndas} />
    </div>
  )
}
