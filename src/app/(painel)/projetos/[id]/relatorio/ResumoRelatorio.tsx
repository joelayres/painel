import type { Relatorio } from '@/dominio/relatorio'
import { reais } from '@/lib/formato/moeda'

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

// O topo do relatório: os números do recorte e o funil da mobilização, etapa por etapa.
export function ResumoRelatorio({ relatorio: r }: { relatorio: Relatorio }) {
  const total = r.linhas.length
  const mobilizadas = r.linhas.filter((l) => l.mobilizada).length
  const concluidas = r.etapas.map((_, i) => r.linhas.filter((l) => l.etapas[i] !== null).length)
  const taxa = (valor: number) => (r.tarifasIndisponiveis ? '—' : reais(valor))

  return (
    <section aria-label="Resumo do relatório" className="overflow-hidden rounded-2xl border border-borda bg-superficie">
      <div className="flex flex-wrap items-end gap-x-10 gap-y-4 border-b border-borda px-5 py-4">
        <p className="flex items-baseline gap-2">
          <span className="font-titulo text-4xl leading-none font-semibold tabular-nums">{total}</span>
          <span className="text-texto-suave">{total === 1 ? 'vaga' : 'vagas'}</span>
          <span className="ml-1 rounded-full px-2 py-0.5 text-sm font-semibold" style={{ background: 'var(--st-finalizada-fundo)', color: 'var(--st-finalizada-texto)' }}>
            {plural(mobilizadas, 'mobilizada', 'mobilizadas')}
          </span>
        </p>
        <p className="flex flex-col">
          <span className="text-sm text-texto-suave">Taxa total</span>
          <span className="font-titulo text-2xl leading-tight font-semibold tabular-nums">{taxa(r.totalTaxas)}</span>
        </p>
        <p className="flex flex-col">
          <span className="text-sm text-texto-suave">Taxa das mobilizadas</span>
          <span className="font-titulo text-2xl leading-tight font-semibold tabular-nums text-primaria">{taxa(r.totalTaxasMobilizadas)}</span>
        </p>
        {!r.tarifasIndisponiveis && r.semTarifa > 0 && (
          <p className="text-sm text-texto-suave sm:ml-auto">{plural(r.semTarifa, 'vaga sem tarifa', 'vagas sem tarifa')} no Financeiro</p>
        )}
      </div>

      {r.tarifasIndisponiveis && (
        <p role="status" className="border-b border-borda px-5 py-2.5 text-sm font-medium" style={{ background: 'var(--st-pendente-fundo)', color: 'var(--st-pendente-texto)' }}>
          Não foi possível ler as tarifas do Financeiro agora. As etapas estão atualizadas; o Tipo e a Taxa voltam quando ele responder.
        </p>
      )}

      {/* O funil: as etapas em sequência, cada uma com quanto do recorte já passou por ela. */}
      <ol aria-label="Andamento por etapa" className="flex overflow-x-auto">
        {r.etapas.map((e, i) => {
          const pct = Math.round(r.percentuais[i] * 100)
          return (
            <li key={e.ordem} className="relative flex min-w-36 flex-1 flex-col gap-2 border-r border-borda px-4 py-4 last:border-r-0">
              <h3 className="text-sm leading-snug font-medium text-texto-suave">{e.nome}</h3>
              <span className="font-titulo text-3xl leading-none font-semibold tabular-nums">{pct}%</span>
              <div role="progressbar" aria-label={`${e.nome}: ${pct}%`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-superficie-2">
                <div className="h-full rounded-full bg-primaria" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-texto-suave tabular-nums">{concluidas[i]} de {plural(total, 'vaga', 'vagas')}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
