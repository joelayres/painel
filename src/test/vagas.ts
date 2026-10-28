// Vagas de exemplo para os testes de tela.
import { ETAPAS_PADRAO } from '@/dominio/etapas'
import type { VagaPainel } from '@/dominio/painel'
import type { Cor } from '@/dominio/situacao'

export const ONDA1 = { id: 'o1', nome: 'Onda 1', inicio: '2026-10-22', fim: '2026-11-26' }

export function vagaExemplo(id: string, c: { cor: Cor | null; etapaAtual: number | null; fimAtual?: string; candidato?: string; dias?: number; admitida?: boolean; funcao?: string }): VagaPainel {
  const mobilizada = c.cor === null
  return {
    id,
    projetoId: 'p1',
    meta: '2026-11-26',
    funcao: c.funcao ?? 'Técnico de Campo',
    disciplina: 'NR-13',
    area: 'Caldeiraria',
    onda: ONDA1,
    gestor: { id: 'g1', nome: 'Ana Souza' },
    candidato: c.candidato ?? null,
    previsao: {
      etapas: ETAPAS_PADRAO.map((e) => ({
        ordem: e.ordem,
        nome: e.nome,
        fixa: e.fixa,
        inicio: '2026-10-22',
        fim: e.ordem === c.etapaAtual ? (c.fimAtual ?? '2026-11-01') : '2026-10-22',
        concluidaEm: c.etapaAtual === null || e.ordem < c.etapaAtual ? '2026-10-22' : null,
      })),
      etapaAtual: c.etapaAtual,
      inicioEtapaAtual: c.etapaAtual ? '2026-10-22' : null,
      admissaoEstimada: '2026-11-19',
      conclusaoEstimada: '2026-12-01',
    },
    situacao: { cor: c.cor, admitida: c.admitida ?? mobilizada, mobilizada, diasNaEtapa: c.dias ?? 1 },
  }
}
