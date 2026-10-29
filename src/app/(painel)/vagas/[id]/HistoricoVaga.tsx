import { dataBR } from '@/lib/formato/datas'

export type EntradaHistorico = { id: string; nome_usuario: string; acao: string; em: string; detalhe: unknown }

// A data de conclusão vem no detalhe: `concluida_em` (exclusão e "Desfez") ou `data` (conclusões, automáticas incluídas).
function dataConclusao(detalhe: unknown): string | null {
  if (typeof detalhe !== 'object' || detalhe === null) return null
  const d = detalhe as Record<string, unknown>
  const v = d.concluida_em ?? d.data
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

export function HistoricoVaga({ historico }: { historico: EntradaHistorico[] }) {
  return (
    <section className="rounded-xl border border-borda bg-superficie p-4">
      <h3 className="font-titulo text-xl font-semibold">Histórico</h3>
      {historico.length ? (
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {historico.map((h) => {
            const concluida = dataConclusao(h.detalhe)
            return (
              <li key={h.id}>
                <span className="text-texto-suave">{new Date(h.em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}</span> · {h.acao}
                {concluida && ` · concluída em ${dataBR(concluida)}`} · {h.nome_usuario}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-texto-suave">Nada registrado ainda.</p>
      )}
    </section>
  )
}
