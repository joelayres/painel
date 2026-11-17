// Cor da vaga no painel: responde se a meta (o compromisso é a admissão) vai ser cumprida.
// Vermelho: a admissão estimada passa da meta. Amarelo: a etapa atual venceu, mas ainda cabe na meta,
// ou a folga até a meta é de FOLGA_MINIMA dias úteis ou menos. Mobilizada não tem cor.
// A previsão deve vir de preverVaga com `hoje`, para o atraso da etapa empurrar a admissão.
import { ddmm } from '@/lib/formato/datas'
import { diasUteisEntre, type Feriados } from './calendario'
import type { PrevisaoVaga } from './previsao'

export type Cor = 'verde' | 'amarelo' | 'vermelho'
export const FOLGA_MINIMA = 3
// comecaEm: a etapa atual ainda não começou (adiada); até lá, não há dias parados nela.
// folga: dias úteis da admissão estimada até a meta (negativa = além da meta); nula depois da admissão.
// etapaAtrasada: dias úteis que a etapa atual já passou do prazo dela (0 = no prazo).
export type Situacao = {
  cor: Cor | null
  admitida: boolean
  mobilizada: boolean
  diasNaEtapa: number
  comecaEm: string | null
  folga: number | null
  etapaAtrasada: number
}

export function situacaoVaga(prev: PrevisaoVaga, meta: string, hoje: string, f: Feriados): Situacao {
  const admitida = prev.etapas.some((e) => e.fixa === 'admissao' && e.concluidaEm !== null)
  if (prev.etapaAtual === null) return { cor: null, admitida: true, mobilizada: true, diasNaEtapa: 0, comecaEm: null, folga: null, etapaAtrasada: 0 }
  const atual = prev.etapas.find((e) => e.ordem === prev.etapaAtual)!
  const diasNaEtapa = prev.inicioEtapaAtual ? diasUteisEntre(prev.inicioEtapaAtual, hoje, f) : 0
  const etapaAtrasada = hoje > atual.fim ? diasUteisEntre(atual.fim, hoje, f) : 0
  const a = prev.admissaoEstimada
  const folga = admitida ? null : a <= meta ? diasUteisEntre(a, meta, f) : -diasUteisEntre(meta, a, f)
  const cor: Cor = folga !== null && folga < 0 ? 'vermelho' : hoje > atual.fim || (folga !== null && folga <= FOLGA_MINIMA) ? 'amarelo' : 'verde'
  const comecaEm = prev.inicioEtapaAtual && prev.inicioEtapaAtual > hoje ? prev.inicioEtapaAtual : null
  return { cor, admitida, mobilizada: false, diasNaEtapa, comecaEm, folga, etapaAtrasada }
}

export function avisoMeta(prev: PrevisaoVaga, meta: string): string | null {
  const admitida = prev.etapas.some((e) => e.fixa === 'admissao' && e.concluidaEm !== null)
  if (admitida || prev.admissaoEstimada <= meta) return null
  return `Pelas etapas, a admissão sai em ${ddmm(prev.admissaoEstimada)} e a meta é ${ddmm(meta)}.`
}

const du = (n: number) => `${n} ${n === 1 ? 'dia útil' : 'dias úteis'}`

// "5 dias úteis de folga", "sem folga" ou "2 dias úteis além da meta"; nulo depois da admissão.
export function textoFolga(folga: number | null): string | null {
  if (folga === null) return null
  if (folga === 0) return 'sem folga'
  return folga > 0 ? `${du(folga)} de folga` : `${du(-folga)} além da meta`
}

export const textoEtapaAtrasada = (n: number) => `etapa ${du(n)} além do prazo`
