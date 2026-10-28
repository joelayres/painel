import { describe, expect, it } from 'vitest'
import { ETAPAS_PADRAO, type EtapaDef } from '../etapas'
import { preverVaga, type Conclusao } from '../previsao'
import { avisoMeta, situacaoVaga } from '../situacao'

const F = new Set(['2026-11-02', '2026-11-15', '2026-11-20'])
const prever = (conclusoes: Conclusao[]) => preverVaga({ dataInicio: '2026-10-22', etapas: ETAPAS_PADRAO, conclusoes, feriados: F })
const ate = (n: number, datas: string[]) => datas.slice(0, n).map((concluidaEm, i) => ({ ordem: i + 1, concluidaEm }))
const DATAS = ['2026-10-22', '2026-10-28', '2026-10-29', '2026-10-30', '2026-11-03', '2026-11-04', '2026-11-05',
  '2026-11-06', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-24', '2026-12-01']

describe('situação da vaga', () => {
  it('fica vermelha quando a etapa atual passou da data prevista', () => {
    expect(situacaoVaga(prever(ate(1, DATAS)), '2026-12-31', '2026-10-29', F).cor).toBe('vermelho')
  })

  it('fica amarela quando a admissão estimada passa da meta', () => {
    expect(situacaoVaga(prever(ate(1, DATAS)), '2026-11-18', '2026-10-27', F).cor).toBe('amarelo')
  })

  it('a meta é inclusiva', () => {
    expect(situacaoVaga(prever(ate(1, DATAS)), '2026-11-19', '2026-10-27', F).cor).toBe('verde')
  })

  it('depois da admissão nunca fica amarela, mesmo com a meta vencida', () => {
    const s = situacaoVaga(prever(ate(11, DATAS)), '2026-11-10', '2026-11-20', F)
    expect(s).toMatchObject({ cor: 'verde', admitida: true, mobilizada: false })
  })

  it('vaga mobilizada não tem cor', () => {
    expect(situacaoVaga(prever(ate(13, DATAS)), '2026-11-10', '2026-12-10', F)).toMatchObject({ cor: null, admitida: true, mobilizada: true })
  })

  it('conta os dias úteis na etapa atual', () => {
    const p = prever([{ ordem: 1, concluidaEm: '2026-10-22' }, { ordem: 2, concluidaEm: '2026-10-30' }])
    expect(situacaoVaga(p, '2026-12-31', '2026-11-05', F).diasNaEtapa).toBe(2)
  })
})

describe('aviso de meta', () => {
  it('avisa quando a admissão estimada passa da meta', () => {
    expect(avisoMeta(prever(ate(1, DATAS)), '2026-11-18')).toBe('Pelas etapas, a admissão sai em 19/11 e a meta é 18/11.')
  })

  it('não avisa quando a admissão cabe na meta', () => {
    expect(avisoMeta(prever(ate(1, DATAS)), '2026-11-19')).toBeNull()
  })

  it('não avisa depois da admissão', () => {
    expect(avisoMeta(prever(ate(11, DATAS)), '2026-11-10')).toBeNull()
  })
})

describe('admissão em outra posição', () => {
  const nova: EtapaDef = { id: 'n', ordem: 11, nome: 'Cadastro em sistema', duracao: 1, fixa: null }
  const etapas = [...ETAPAS_PADRAO.slice(0, 10), nova, ...ETAPAS_PADRAO.slice(10).map((e) => ({ ...e, ordem: e.ordem + 1 }))]
  const prev = (n: number) => preverVaga({ dataInicio: '2026-10-22', etapas, conclusoes: DATAS.slice(0, n).map((concluidaEm, i) => ({ ordem: i + 1, concluidaEm })), feriados: F })

  it('só é admitida quando a posição 12 foi concluída', () => {
    expect(situacaoVaga(prev(11), '2026-11-10', '2026-11-20', F).admitida).toBe(false)
    expect(situacaoVaga(prev(12), '2026-11-10', '2026-11-20', F).admitida).toBe(true)
    expect(avisoMeta(prev(12), '2026-11-10')).toBeNull()
  })
})
