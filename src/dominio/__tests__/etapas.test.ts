import { describe, expect, it } from 'vitest'
import { ETAPAS_PADRAO, etapasDoProjeto, type LinhaEtapaProjeto } from '../etapas'

const linhasPadrao = (): LinhaEtapaProjeto[] =>
  ETAPAS_PADRAO.map((e) => ({ id: `l${e.ordem}`, posicao: e.ordem, nome: e.nome, duracao: null, padrao: e.ordem, fixa: e.fixa }))
const dur = (e: ReturnType<typeof etapasDoProjeto>, ordem: number) => e.find((x) => x.ordem === ordem)!.duracao

describe('etapasDoProjeto', () => {
  it('a duração do cliente vale mais que a padrão', () => {
    const e = etapasDoProjeto(linhasPadrao(), new Map([[9, 5]]))
    expect([dur(e, 9), dur(e, 2)]).toEqual([5, 4])
  })

  it('a duração da própria linha vale mais que a do cliente', () => {
    const l = linhasPadrao()
    l[8].duracao = 3
    expect(dur(etapasDoProjeto(l, new Map([[9, 5]])), 9)).toBe(3)
  })

  it('etapa incluída empurra as seguintes', () => {
    const l = linhasPadrao()
    const novas = l.map((x) => (x.posicao >= 12 ? { ...x, posicao: x.posicao + 1 } : x))
    novas.push({ id: 'nova', posicao: 12, nome: 'Cadastro no eSocial', duracao: 2, padrao: null, fixa: null })
    const e = etapasDoProjeto(novas, new Map())
    expect(e).toHaveLength(14)
    expect(e[11]).toMatchObject({ id: 'nova', ordem: 12, duracao: 2 })
    expect([e[12].nome, e[12].ordem, e[13].nome, e[13].ordem]).toEqual(['Atualização da CTPS', 13, 'Treinamento', 14])
  })

  it('recusa a lista sem a admissão', () => {
    expect(() => etapasDoProjeto(linhasPadrao().filter((l) => l.fixa !== 'admissao').map((l, i) => ({ ...l, posicao: i + 1 })), new Map())).toThrow()
  })

  it('recusa a captura depois da admissão', () => {
    const l = linhasPadrao()
    l[1].posicao = 11
    l[10].posicao = 2
    expect(() => etapasDoProjeto(l, new Map())).toThrow()
  })

  it('recusa posições com buraco', () => {
    const l = linhasPadrao().slice(0, 3)
    l[2].posicao = 4
    expect(() => etapasDoProjeto(l, new Map())).toThrow()
  })
})
