// Cor da vaga no painel. Vermelho: a etapa atual venceu. Amarelo: no prazo, mas a admissão
// estimada passa do fim da onda (o compromisso da onda é a admissão). Mobilizada não tem cor.
import { diasUteisEntre, type Feriados } from './calendario'
import { ETAPA_ADMISSAO } from './etapas'
import type { PrevisaoVaga } from './previsao'

export type Cor = 'verde' | 'amarelo' | 'vermelho'
export type Situacao = { cor: Cor | null; admitida: boolean; mobilizada: boolean; diasNaEtapa: number }

export function situacaoVaga(prev: PrevisaoVaga, fimOnda: string, hoje: string, f: Feriados): Situacao {
  const admitida = prev.etapas.some((e) => e.ordem === ETAPA_ADMISSAO && e.concluidaEm !== null)
  if (prev.etapaAtual === null) return { cor: null, admitida: true, mobilizada: true, diasNaEtapa: 0 }
  const atual = prev.etapas.find((e) => e.ordem === prev.etapaAtual)!
  const diasNaEtapa = prev.inicioEtapaAtual ? diasUteisEntre(prev.inicioEtapaAtual, hoje, f) : 0
  const cor: Cor = hoje > atual.fim ? 'vermelho' : !admitida && prev.admissaoEstimada > fimOnda ? 'amarelo' : 'verde'
  return { cor, admitida, mobilizada: false, diasNaEtapa }
}
