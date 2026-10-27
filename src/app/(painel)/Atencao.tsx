import Link from 'next/link'
import { vagasEmAtencao, type VagaPainel } from '@/dominio/painel'
import { ddmm } from '@/lib/formato/datas'
import { COR_PRAZO, ROTULO_PRAZO } from './cores'

const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`

export function Atencao({ vagas }: { vagas: VagaPainel[] }) {
  const lista = vagasEmAtencao(vagas)
  return (
    <section aria-labelledby="titulo-atencao" className="rounded-xl border border-borda bg-superficie p-4">
      <h2 id="titulo-atencao" className="font-titulo text-xl font-semibold">Precisa de atenção ({lista.length})</h2>
      {lista.length === 0 ? (
        <p className="mt-2 text-texto-suave">Nenhuma vaga atrasada ou em risco.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {lista.map((v) => {
            const cor = v.situacao.cor!
            const etapa = v.previsao.etapas.find((e) => e.ordem === v.previsao.etapaAtual)
            return (
              <li key={v.id}>
                <Link href={`/vagas/${v.id}`} className="block rounded-lg border-l-[6px] bg-superficie-2 px-3 py-2 hover:bg-primaria-suave focus-visible:outline-2 focus-visible:outline-foco" style={{ borderColor: COR_PRAZO[cor] }}>
                  <span className="mr-2 text-sm font-semibold" style={{ color: COR_PRAZO[cor] }}>{ROTULO_PRAZO[cor]}</span>
                  <span className="font-medium">{v.funcao} · {v.disciplina}</span>
                  <span className="text-texto-suave"> · {v.gestor?.nome ?? 'Sem gestor'}{v.candidato ? ` · ${v.candidato}` : ''}</span>
                  <span className="block text-sm text-texto-suave">
                    parada em {etapa?.nome} há {dias(v.situacao.diasNaEtapa)} · admissão prevista {ddmm(v.previsao.admissaoEstimada)} (onda até {ddmm(v.onda.fim)})
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
