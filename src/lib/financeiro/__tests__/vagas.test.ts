import { expect, test } from 'vitest'
import type { VagaPainel } from '@/dominio/painel'
import { paraFinanceiro } from '../vagas'

const etapa = (ordem: number, fixa: 'captura' | 'admissao' | null, fim: string, concluidaEm: string | null) =>
  ({ ordem, nome: `Etapa ${ordem}`, fixa, inicio: fim, fim, concluidaEm })

const vaga = (previsao: VagaPainel['previsao'], admitida: boolean, mobilizada: boolean): VagaPainel => ({
  id: 'v1', projetoId: 'p1', funcao: 'Técnico de campo', disciplina: 'Mecânica', area: 'Q3', meta: '2026-12-15',
  onda: { id: 'o1', nome: '1ª Onda', inicio: '2026-10-01', fim: '2026-12-15' }, gestor: null, candidato: 'Fulano',
  previsao, situacao: { cor: null, admitida, mobilizada, diasNaEtapa: 0 },
})

test('vaga mobilizada: data da última etapa concluída, admitida e mobilizada', () => {
  const v = vaga({
    etapas: [etapa(1, 'captura', '2026-10-05', '2026-10-05'), etapa(2, 'admissao', '2026-10-20', '2026-10-20'), etapa(3, null, '2026-10-27', '2026-10-27')],
    etapaAtual: null, inicioEtapaAtual: null, admissaoEstimada: '2026-10-20', conclusaoEstimada: '2026-10-27',
  }, true, true)
  expect(paraFinanceiro(v)).toEqual({
    id: 'v1', projetoId: 'p1', funcao: 'Técnico de campo', disciplina: 'Mecânica', area: 'Q3', onda: '1ª Onda', candidato: 'Fulano',
    dataMobilizacao: '2026-10-27', admitida: true, mobilizada: true,
  })
})

test('vaga em captura: previsão, sem admissão', () => {
  const v = vaga({
    etapas: [etapa(1, 'captura', '2026-11-05', null), etapa(2, 'admissao', '2026-11-20', null), etapa(3, null, '2026-11-27', null)],
    etapaAtual: 1, inicioEtapaAtual: '2026-11-01', admissaoEstimada: '2026-11-20', conclusaoEstimada: '2026-11-27',
  }, false, false)
  expect(paraFinanceiro(v)).toMatchObject({ dataMobilizacao: '2026-11-27', admitida: false, mobilizada: false })
})
