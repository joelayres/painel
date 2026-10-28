import { describe, expect, it } from 'vitest'
import { ETAPAS_PADRAO, etapasDoProjeto } from '../etapas'

const dur = (e: ReturnType<typeof etapasDoProjeto>, ordem: number) => e.find((x) => x.ordem === ordem)!.duracao

describe('etapasDoProjeto', () => {
  it('a duração do projeto vale mais que a do cliente e a padrão', () => {
    const e = etapasDoProjeto(ETAPAS_PADRAO, new Map([[9, 5]]), new Map([[9, 3], [8, 2]]))
    expect([dur(e, 9), dur(e, 8), dur(e, 2)]).toEqual([3, 2, 4])
  })

  it('sem override do projeto vale a do cliente', () => {
    expect(dur(etapasDoProjeto(ETAPAS_PADRAO, new Map([[9, 5]]), new Map()), 9)).toBe(5)
  })

  it('mantém ordem e nome das etapas', () => {
    const e = etapasDoProjeto(ETAPAS_PADRAO, new Map(), new Map([[2, 1]]))
    expect(e.map((x) => [x.ordem, x.nome])).toEqual(ETAPAS_PADRAO.map((x) => [x.ordem, x.nome]))
  })
})
