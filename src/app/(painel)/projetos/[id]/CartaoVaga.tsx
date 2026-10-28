import Link from 'next/link'
import type { VagaPainel } from '@/dominio/painel'
import { ddmm } from '@/lib/formato/datas'
import { COR_PRAZO, ROTULO_PRAZO } from '../../cores'

export function CartaoVaga({ vaga }: { vaga: VagaPainel }) {
  const cor = vaga.situacao.cor ?? 'verde'
  const d = vaga.situacao.diasNaEtapa
  return (
    <Link
      href={`/vagas/${vaga.id}`}
      className="block rounded-lg border-l-[6px] bg-superficie p-2.5 text-sm shadow-sm hover:bg-primaria-suave focus-visible:outline-2 focus-visible:outline-foco"
      style={{ borderColor: COR_PRAZO[cor] }}
      title={ROTULO_PRAZO[cor]}
    >
      <span className="block font-semibold leading-tight">{vaga.funcao}</span>
      <span className="block text-texto-suave">{vaga.disciplina}</span>
      {vaga.candidato && <span className="mt-1 block font-medium">{vaga.candidato}</span>}
      <span className="mt-1 block text-xs text-texto-suave">{vaga.gestor?.nome ?? 'Sem gestor'}</span>
      <span className="mt-1 block text-xs">
        {d} {d === 1 ? 'dia' : 'dias'} nesta etapa · Admissão prevista {ddmm(vaga.previsao.admissaoEstimada)}
      </span>
    </Link>
  )
}
