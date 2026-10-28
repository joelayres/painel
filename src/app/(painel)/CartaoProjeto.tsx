import Link from 'next/link'
import { ddmm } from '@/lib/formato/datas'
import type { CartaoProjeto as Projeto } from '@/lib/painel/dados'
import { COR_PRAZO } from './cores'

export function CartaoProjeto({ projeto }: { projeto: Projeto }) {
  const { resumo: r } = projeto
  const pct = r.total ? Math.round((r.admitidas / r.total) * 100) : 0
  const ondas = projeto.ondas === 0 ? 'sem ondas' : projeto.ondas === 1 ? '1 onda' : `${projeto.ondas} ondas`
  const vagas = r.total === 1 ? '1 vaga' : `${r.total} vagas`
  const linha = [projeto.area, ondas, vagas].filter(Boolean).join(' · ')
  return (
    <Link
      href={`/projetos/${projeto.id}/resumo`}
      aria-label={`Projeto ${projeto.nome}`}
      className="block rounded-xl border border-borda bg-superficie p-4 transition-colors hover:border-primaria focus-visible:outline-2 focus-visible:outline-foco"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-titulo text-2xl font-semibold">{projeto.nome}</span>
        {projeto.encerrado && <span className="rounded-full bg-superficie-2 px-2 py-0.5 text-xs font-medium text-texto-suave">Encerrado</span>}
      </div>
      <p className="mt-1 text-sm text-texto-suave">{linha}</p>
      <p className="mt-3 font-titulo text-[32px] leading-none font-semibold">
        {r.admitidas} <span className="text-lg font-medium text-texto-suave">admitidos de {r.total}</span>
      </p>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-superficie-2" aria-hidden>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--prazo-verde)' }} />
      </div>
      {projeto.organizacao === 'meta' && r.proximaMeta && <p className="mt-2 text-sm text-texto-suave">próxima meta {ddmm(r.proximaMeta)}</p>}
      <p className="mt-3 text-sm">
        <span style={{ color: COR_PRAZO.verde }} className="font-semibold">{r.verde} no prazo</span>
        {' · '}
        <span style={{ color: COR_PRAZO.amarelo }} className="font-semibold">{r.amarelo} em risco</span>
        {' · '}
        <span style={{ color: COR_PRAZO.vermelho }} className="font-semibold">{r.vermelho} atrasadas</span>
      </p>
    </Link>
  )
}
