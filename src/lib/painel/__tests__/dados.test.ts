import { describe, expect, it } from 'vitest'
import { montarPainel, type LinhasPainel } from '../dados'

const linhas: LinhasPainel = {
  ondas: [{ id: 'o1', numero: 1, inicio: '2026-10-22', fim: '2026-11-18' }],
  gestores: [{ id: 'g1', nome: 'Ana' }],
  etapas: [
    { ordem: 1, nome: 'Abertura de vaga', duracao: 1 }, { ordem: 2, nome: 'Captura de Mercado', duracao: 4 },
    { ordem: 3, nome: 'Triagem de Candidatos', duracao: 1 }, { ordem: 4, nome: 'Entrevista - Timenow', duracao: 1 },
    { ordem: 5, nome: 'Entrevista - TNGO/Braskem', duracao: 1 }, { ordem: 6, nome: 'Envio para contratação', duracao: 0 },
    { ordem: 7, nome: 'Agendamento exames', duracao: 2 }, { ordem: 8, nome: 'Realização de Exames', duracao: 1 },
    { ordem: 9, nome: 'Liberação dos exames', duracao: 7 }, { ordem: 10, nome: 'Ambientação/TBS', duracao: 1 },
    { ordem: 11, nome: 'Admissão Timenow', duracao: 0 }, { ordem: 12, nome: 'Atualização da CTPS', duracao: 3 },
    { ordem: 13, nome: 'Treinamento', duracao: 5 },
  ],
  feriados: [{ data: '2026-11-02' }, { data: '2026-11-15' }, { data: '2026-11-20' }],
  vagas: [
    { id: 'v1', funcao: 'Técnico de Campo', disciplina: 'NR-13', area: 'Caldeiraria', onda_id: 'o1', gestor_id: 'g1', candidato: 'Lucas', data_inicio: '2026-10-22', retomada_em: null, cancelada_em: null },
    { id: 'v2', funcao: 'Assistente Técnico', disciplina: 'Apoio', area: 'Planejamento', onda_id: 'o1', gestor_id: null, candidato: null, data_inicio: '2026-10-22', retomada_em: null, cancelada_em: null },
    { id: 'v3', funcao: 'Cancelada', disciplina: 'x', area: 'x', onda_id: 'o1', gestor_id: null, candidato: null, data_inicio: '2026-10-22', retomada_em: null, cancelada_em: '2026-10-25T10:00:00Z' },
  ],
  conclusoes: [{ vaga_id: 'v1', ordem: 1, concluida_em: '2026-10-22' }],
}

describe('montarPainel', () => {
  it('monta as vagas ativas com previsão e cor, sem as canceladas', () => {
    const vagas = montarPainel(linhas, '2026-10-27')
    expect(vagas.map((v) => v.id)).toEqual(['v1', 'v2'])
    const v1 = vagas[0]
    expect(v1).toMatchObject({ funcao: 'Técnico de Campo', candidato: 'Lucas', gestor: { id: 'g1', nome: 'Ana' }, onda: { numero: 1, fim: '2026-11-18' } })
    expect(v1.previsao.etapaAtual).toBe(2)
    expect(v1.previsao.admissaoEstimada).toBe('2026-11-19')
    // Admissão 19/11 depois do fim da onda (18/11) e etapa no prazo: amarelo.
    expect(v1.situacao.cor).toBe('amarelo')
    // Etapa 1 da v2 venceu em 22/10.
    expect(vagas[1].situacao.cor).toBe('vermelho')
    expect(vagas[1].gestor).toBeNull()
  })

  it('usa a data de retomada depois de uma desistência', () => {
    const comRetomada = { ...linhas, vagas: [{ ...linhas.vagas[0], retomada_em: '2026-11-04' }] }
    const [v] = montarPainel(comRetomada, '2026-11-04')
    expect(v.previsao.inicioEtapaAtual).toBe('2026-11-04')
  })
})
