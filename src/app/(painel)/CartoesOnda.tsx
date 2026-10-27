import Link from 'next/link'
import type { ResumoOnda } from '@/dominio/painel'
import { ddmm } from '@/lib/formato/datas'
import { COR_PRAZO } from './cores'

export function CartoesOnda({ resumos, hrefDe, ativa }: { resumos: ResumoOnda[]; hrefDe: (numero: number) => string; ativa?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {resumos.map((r) => {
        const pct = r.total ? Math.round((r.admitidas / r.total) * 100) : 0
        const selecionada = ativa === r.numero
        return (
          <Link
            key={r.numero}
            href={hrefDe(r.numero)}
            aria-label={`Onda ${r.numero}`}
            aria-current={selecionada ? 'true' : undefined}
            className={`block rounded-xl border bg-superficie p-4 transition-colors hover:border-primaria focus-visible:outline-2 focus-visible:outline-foco ${selecionada ? 'border-primaria ring-2 ring-primaria' : 'border-borda'}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-titulo text-2xl font-semibold">{r.numero}ª Onda</span>
              <span className="text-sm text-texto-suave">{ddmm(r.inicio)} a {ddmm(r.fim)}</span>
            </div>
            <p className="mt-3 font-titulo text-[32px] leading-none font-semibold">
              {r.admitidas} <span className="text-lg font-medium text-texto-suave">admitidos de {r.total}</span>
            </p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-superficie-2" aria-hidden>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--prazo-verde)' }} />
            </div>
            <p className="mt-3 text-sm">
              <span style={{ color: COR_PRAZO.verde }} className="font-semibold">{r.verde} no prazo</span>
              {' · '}
              <span style={{ color: COR_PRAZO.amarelo }} className="font-semibold">{r.amarelo} em risco</span>
              {' · '}
              <span style={{ color: COR_PRAZO.vermelho }} className="font-semibold">{r.vermelho} atrasadas</span>
            </p>
            <p className="mt-1 text-sm text-texto-suave">{r.mobilizadas} mobilizados</p>
          </Link>
        )
      })}
    </div>
  )
}
