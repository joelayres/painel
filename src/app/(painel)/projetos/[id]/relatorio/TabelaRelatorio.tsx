import type { Relatorio } from '@/dominio/relatorio'
import { dataBR } from '@/lib/formato/datas'
import { reais } from '@/lib/formato/moeda'

const pct = (x: number) => `${Math.round(x * 100)}%`
const th = 'whitespace-nowrap border-b border-borda bg-superficie-2 px-3 py-2 text-left font-semibold'
const td = 'border-b border-borda px-3 py-2'

// A tabela da planilha do cliente: uma linha por vaga, OK nas etapas concluídas e o % no rodapé.
export function TabelaRelatorio({ relatorio: r, porOndas }: { relatorio: Relatorio; porOndas: boolean }) {
  const fixas = ['Nome', 'Tipo', 'Função', 'Disciplina', 'Área', porOndas ? 'Onda' : 'Meta', 'Taxa']
  return (
    <div className="flex flex-col gap-3">
      {r.tarifasIndisponiveis && (
        <p role="status" className="rounded-lg border border-borda bg-superficie-2 px-3 py-2 text-sm">
          Não foi possível ler as tarifas do Financeiro agora. As etapas estão atualizadas; o Tipo e a Taxa aparecem quando ele voltar.
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-borda bg-superficie">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0">
            <tr>
              {fixas.map((c) => <th key={c} scope="col" className={th}>{c}</th>)}
              {r.etapas.map((e) => <th key={e.ordem} scope="col" className={`${th} text-center`}>{e.nome}</th>)}
            </tr>
          </thead>
          <tbody>
            {r.linhas.length === 0 ? (
              <tr><td colSpan={fixas.length + r.etapas.length} className={`${td} text-center text-texto-suave`}>Nenhuma vaga</td></tr>
            ) : r.linhas.map((l) => (
              <tr key={l.id} className="hover:bg-superficie-2">
                <td className={`${td} whitespace-nowrap`}><span className={l.vagaAberta ? 'text-texto-suave' : 'font-medium'}>{l.nome}</span></td>
                <td className={td}>{l.tipo ?? '—'}</td>
                <td className={td}>{l.funcao}</td>
                <td className={td}>{l.disciplina}</td>
                <td className={td}>{l.area}</td>
                <td className={`${td} whitespace-nowrap`}>{porOndas ? (l.onda ?? '—') : dataBR(l.meta)}</td>
                <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                  {!l.cobrada ? <span className="text-texto-suave">Não cobrada</span> : l.taxa === null ? '—' : reais(l.taxa)}
                </td>
                {l.etapas.map((data, i) => (
                  <td key={r.etapas[i].ordem} className={`${td} text-center font-semibold`} title={data ? `Concluída em ${dataBR(data)}` : undefined}>
                    {data ? 'OK' : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-superficie-2 font-semibold">
              <th scope="row" colSpan={fixas.length} className="px-3 py-2 text-right">% concluído</th>
              {r.percentuais.map((p, i) => <td key={r.etapas[i].ordem} className="px-3 py-2 text-center tabular-nums">{pct(p)}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span><span className="text-texto-suave">Total das taxas:</span> <strong>{reais(r.totalTaxas)}</strong></span>
        <span><span className="text-texto-suave">Mobilizadas:</span> <strong>{reais(r.totalTaxasMobilizadas)}</strong></span>
        {!r.tarifasIndisponiveis && r.semTarifa > 0 && (
          <span className="text-texto-suave">{r.semTarifa} {r.semTarifa === 1 ? 'vaga sem tarifa' : 'vagas sem tarifa'} no Financeiro</span>
        )}
      </p>
    </div>
  )
}
