// Cor da vaga no painel. Vermelho: a etapa atual venceu. Amarelo: no prazo, mas a admissão
// estimada passa da meta da vaga (o compromisso é a admissão). Mobilizada não tem cor.
import { ddmm } from '@/lib/formato/datas'
import { diasUteisEntre, type Feriados } from './calendario'
import type { PrevisaoVaga } from './previsao'

export type Cor = 'verde' | 'amarelo' | 'vermelho'
export type Situacao = { cor: Cor | null; admitida: boolean; mobilizada: boolean; diasNaEtapa: number }

export function situacaoVaga(prev: PrevisaoVaga, meta: string, hoje: string, f: Feriados): Situacao {
  const admitida = prev.etapas.some((e) => e.fixa === 'admissao' && e.concluidaEm !== null)
  if (prev.etapaAtual === null) return { cor: null, admitida: true, mobilizada: true, diasNaEtapa: 0 }
  const atual = prev.etapas.find((e) => e.ordem === prev.etapaAtual)!
  const diasNaEtapa = prev.inicioEtapaAtual ? diasUteisEntre(prev.inicioEtapaAtual, hoje, f) : 0
  const cor: Cor = hoje > atual.fim ? 'vermelho' : !admitida && prev.admissaoEstimada > meta ? 'amarelo' : 'verde'
  return { cor, admitida, mobilizada: false, diasNaEtapa }
}

export function avisoMeta(prev: PrevisaoVaga, meta: string): string | null {
  const admitida = prev.etapas.some((e) => e.fixa === 'admissao' && e.concluidaEm !== null)
  if (admitida || prev.admissaoEstimada <= meta) return null
  return `Pelas etapas, a admissão sai em ${ddmm(prev.admissaoEstimada)} e a meta é ${ddmm(meta)}.`
}
