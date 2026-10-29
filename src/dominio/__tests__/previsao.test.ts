import { describe, expect, it } from 'vitest'
import { ETAPAS_PADRAO, type EtapaDef } from '../etapas'
import { preverVaga, type Conclusao } from '../previsao'

const F = new Set(['2026-11-02', '2026-11-15', '2026-11-20'])
const prever = (dataInicio: string, conclusoes: Conclusao[] = [], retomadaEm: string | null = null) =>
  preverVaga({ dataInicio, retomadaEm, etapas: ETAPAS_PADRAO, conclusoes, feriados: F })

describe('previsão das etapas', () => {
  it('previsão sem conclusões a partir de 22/10', () => {
    const p = prever('2026-10-22')
    expect(p.etapas.map((e) => e.fim)).toEqual([
      '2026-10-22', '2026-10-28', '2026-10-29', '2026-10-30', '2026-11-03', '2026-11-04', '2026-11-05',
      '2026-11-06', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-24', '2026-12-01',
    ])
    expect(p.etapas[6].inicio).toBe('2026-11-04')
    expect(p.admissaoEstimada).toBe('2026-11-19')
    expect(p.conclusaoEstimada).toBe('2026-12-01')
    expect(p.etapaAtual).toBe(1)
    expect(p.inicioEtapaAtual).toBe('2026-10-22')
  })

  it('conclusão atrasada desloca as seguintes', () => {
    const p = prever('2026-10-22', [{ ordem: 1, concluidaEm: '2026-10-22' }, { ordem: 2, concluidaEm: '2026-10-30' }])
    expect(p.etapaAtual).toBe(3)
    expect(p.inicioEtapaAtual).toBe('2026-11-03')
    expect(p.etapas[2].fim).toBe('2026-11-03')
    expect(p.etapas[1]).toMatchObject({ fim: '2026-10-30', concluidaEm: '2026-10-30' })
  })

  it('início num sábado começa no próximo dia útil', () => {
    const p = prever('2026-10-24')
    expect(p.etapas[0]).toMatchObject({ inicio: '2026-10-26', fim: '2026-10-26' })
  })

  it('marco de duração 0 depois de sexta termina no próximo dia útil', () => {
    const p = prever('2026-10-22', [
      { ordem: 1, concluidaEm: '2026-10-22' },
      { ordem: 2, concluidaEm: '2026-10-28' },
      { ordem: 3, concluidaEm: '2026-10-29' },
      { ordem: 4, concluidaEm: '2026-10-30' },
      { ordem: 5, concluidaEm: '2026-11-06' },
    ])
    expect(p.etapas[5]).toMatchObject({ inicio: '2026-11-09', fim: '2026-11-09' })
  })

  it('todas concluídas deixa a vaga mobilizada', () => {
    const datas = ['2026-10-22', '2026-10-28', '2026-10-29', '2026-10-30', '2026-11-03', '2026-11-04', '2026-11-05',
      '2026-11-06', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-24', '2026-12-01']
    const p = prever('2026-10-22', datas.map((concluidaEm, i) => ({ ordem: i + 1, concluidaEm })))
    expect(p.etapaAtual).toBeNull()
    expect(p.inicioEtapaAtual).toBeNull()
    expect(p.admissaoEstimada).toBe('2026-11-19')
  })

  it('retomada depois de desistência recomeça a captura na data da retomada', () => {
    const p = prever('2026-10-22', [{ ordem: 1, concluidaEm: '2026-10-22' }], '2026-11-04')
    expect(p.etapas[1]).toMatchObject({ inicio: '2026-11-04', fim: '2026-11-09' })
    expect(p.inicioEtapaAtual).toBe('2026-11-04')
  })

  it('previsão com etapa incluída antes da admissão', () => {
    const nova: EtapaDef = { id: 'n', ordem: 11, nome: 'Cadastro em sistema', duracao: 1, fixa: null }
    const etapas = [...ETAPAS_PADRAO.slice(0, 10), nova, ...ETAPAS_PADRAO.slice(10).map((e) => ({ ...e, ordem: e.ordem + 1 }))]
    const p = preverVaga({ dataInicio: '2026-10-22', etapas, conclusoes: [], feriados: F })
    expect(p.etapas[9].fim).toBe('2026-11-18')
    expect(p.etapas[10]).toMatchObject({ inicio: '2026-11-19', fim: '2026-11-19' })
    expect(p.admissaoEstimada).toBe('2026-11-23')
  })

  // Etapa incluída com a vaga já depois do ponto: a conclusão automática não mexe na previsão.
  const incluir = (depoisDe: number, duracao: number): EtapaDef[] => [
    ...ETAPAS_PADRAO.slice(0, depoisDe),
    { id: 'n', ordem: depoisDe + 1, nome: 'Cadastro no eSocial', duracao, fixa: null },
    ...ETAPAS_PADRAO.slice(depoisDe).map((e) => ({ ...e, ordem: e.ordem + 1 })),
  ]

  it('conclusão automática depois de um marco não muda o início da etapa atual', () => {
    const datas = ['2026-10-22', '2026-10-28', '2026-10-29', '2026-10-30', '2026-11-03', '2026-11-04']
    const sem = prever('2026-10-22', datas.map((d, i) => ({ ordem: i + 1, concluidaEm: d })))
    const conclusoes: Conclusao[] = [
      ...datas.map((d, i) => ({ ordem: i + 1, concluidaEm: d })),
      { ordem: 7, concluidaEm: '2026-11-04', automatica: true },
    ]
    const com = preverVaga({ dataInicio: '2026-10-22', etapas: incluir(6, 2), conclusoes, feriados: F })
    expect(com.etapas[6]).toMatchObject({ inicio: '2026-11-04', fim: '2026-11-04', concluidaEm: '2026-11-04' })
    expect(com.etapaAtual).toBe(8)
    expect(com.inicioEtapaAtual).toBe(sem.inicioEtapaAtual)
    expect(com.etapas[7]).toMatchObject({ inicio: sem.etapas[6].inicio, fim: sem.etapas[6].fim })
    expect(com.admissaoEstimada).toBe(sem.admissaoEstimada)
    expect(com.conclusaoEstimada).toBe(sem.conclusaoEstimada)
  })

  it('conclusão automática na primeira posição não muda a Abertura', () => {
    const sem = prever('2026-10-22')
    const com = preverVaga({
      dataInicio: '2026-10-22',
      etapas: incluir(0, 1),
      conclusoes: [{ ordem: 1, concluidaEm: '2026-10-22', automatica: true }],
      feriados: F,
    })
    expect(com.etapaAtual).toBe(2)
    expect(com.etapas[1]).toMatchObject({ nome: 'Abertura de vaga', inicio: sem.etapas[0].inicio, fim: sem.etapas[0].fim })
    expect(com.conclusaoEstimada).toBe(sem.conclusaoEstimada)
  })

  it('lista sem Treinamento termina na CTPS', () => {
    const p = preverVaga({ dataInicio: '2026-10-22', etapas: ETAPAS_PADRAO.slice(0, 12), conclusoes: [], feriados: F })
    expect(p.conclusaoEstimada).toBe('2026-11-24')
  })
})
