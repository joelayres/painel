import { describe, expect, it } from 'vitest'
import { ETAPAS_PADRAO } from '../etapas'
import { filtrarVagas, porEtapa, resumirOndas, resumirProjeto, resumoPorEtapa, vagasEmAtencao, type VagaPainel } from '../painel'
import type { Cor } from '../situacao'

const ONDA1 = { id: 'o1', nome: 'Onda 1', inicio: '2026-10-22', fim: '2026-11-26' }
const ONDA2 = { id: 'o2', nome: 'Onda 2', inicio: '2026-11-01', fim: '2026-12-18' }

function vaga(id: string, c: { cor: Cor | null; etapaAtual: number | null; fimAtual?: string; admissao?: string; admitida?: boolean; candidato?: string; onda?: typeof ONDA1; funcao?: string; meta?: string }): VagaPainel {
  const mobilizada = c.cor === null
  return {
    id,
    projetoId: 'p1',
    meta: c.meta ?? '2026-11-26',
    funcao: c.funcao ?? 'Técnico de Campo',
    disciplina: 'NR-13',
    area: 'Caldeiraria',
    onda: c.onda ?? ONDA1,
    gestor: { id: 'g1', nome: 'Ana' },
    candidato: c.candidato ?? null,
    previsao: {
      etapas: c.etapaAtual ? [{ ordem: c.etapaAtual, nome: 'x', inicio: '2026-10-22', fim: c.fimAtual ?? '2026-11-01', concluidaEm: null }] : [],
      etapaAtual: c.etapaAtual,
      inicioEtapaAtual: c.etapaAtual ? '2026-10-22' : null,
      admissaoEstimada: c.admissao ?? '2026-11-19',
      conclusaoEstimada: '2026-12-01',
    },
    situacao: { cor: c.cor, admitida: c.admitida ?? mobilizada, mobilizada, diasNaEtapa: 1 },
  }
}

describe('painel', () => {
  it('resume a onda contando as cores só das vagas em andamento', () => {
    const vagas = [vaga('a', { cor: 'verde', etapaAtual: 3 }), vaga('b', { cor: 'vermelho', etapaAtual: 2 }), vaga('c', { cor: null, etapaAtual: null })]
    expect(resumirOndas(vagas, [ONDA1])).toEqual([
      { id: 'o1', nome: 'Onda 1', inicio: '2026-10-22', fim: '2026-11-26', total: 3, admitidas: 1, mobilizadas: 1, verde: 1, amarelo: 0, vermelho: 1, proximaMeta: '2026-11-26' },
    ])
  })

  it('mostra todas as ondas cadastradas, ordenadas por início, mesmo sem vagas', () => {
    const r = resumirOndas([vaga('a', { cor: 'verde', etapaAtual: 1 })], [ONDA2, ONDA1])
    expect(r.map((o) => [o.id, o.total])).toEqual([['o1', 1], ['o2', 0]])
    expect(r[1]).toMatchObject({ inicio: '2026-11-01', fim: '2026-12-18', verde: 0, admitidas: 0, proximaMeta: null })
  })

  it('resume o projeto com a próxima meta das vagas não admitidas', () => {
    const vagas = [
      vaga('a', { cor: 'verde', etapaAtual: 1, meta: '2026-12-10' }),
      vaga('b', { cor: null, etapaAtual: null, meta: '2026-12-05' }),
      vaga('c', { cor: 'verde', etapaAtual: 1, meta: '2026-12-20' }),
    ]
    expect(resumirProjeto(vagas)).toMatchObject({ id: 'projeto', nome: '', inicio: null, fim: null, total: 3, proximaMeta: '2026-12-10' })
  })

  it('resume por etapa e função, agrupando grafias parecidas', () => {
    const vagas = [
      vaga('a', { cor: 'verde', etapaAtual: 1, funcao: 'Eletricista' }),
      vaga('b', { cor: 'verde', etapaAtual: 1, funcao: 'eletricista ' }),
      vaga('c', { cor: 'verde', etapaAtual: 1, funcao: 'Técnico de Planejamento' }),
      vaga('d', { cor: 'verde', etapaAtual: 1, funcao: 'Técnico de Planejamento' }),
      vaga('e', { cor: null, etapaAtual: null, funcao: 'Eletricista' }),
    ]
    const r = resumoPorEtapa(vagas, ETAPAS_PADRAO)
    expect(r).toHaveLength(14)
    expect(r[0]).toMatchObject({ ordem: 1, total: 4 })
    expect(r[0].funcoes.map((f) => [f.funcao, f.total])).toEqual([['Eletricista', 2], ['Técnico de Planejamento', 2]])
    expect(r[13]).toMatchObject({ ordem: null, nome: 'Mobilizadas', total: 1 })
  })

  it('conta vermelhos e amarelos por função', () => {
    const r = resumoPorEtapa([vaga('a', { cor: 'vermelho', etapaAtual: 2 }), vaga('b', { cor: 'amarelo', etapaAtual: 2 })], ETAPAS_PADRAO)
    expect(r[1].funcoes).toEqual([{ funcao: 'Técnico de Campo', total: 2, vermelho: 1, amarelo: 1 }])
  })

  it('filtra por candidato sem diferenciar maiúsculas nem acentos', () => {
    const vagas = [vaga('a', { cor: 'verde', etapaAtual: 5, candidato: 'João Silva' }), vaga('b', { cor: 'verde', etapaAtual: 1 })]
    expect(filtrarVagas(vagas, { candidato: 'joao' }).map((v) => v.id)).toEqual(['a'])
  })

  it('filtra por onda (id), função, área e gestor', () => {
    const vagas = [vaga('a', { cor: 'verde', etapaAtual: 1 }), vaga('b', { cor: 'verde', etapaAtual: 1, onda: ONDA2 })]
    expect(filtrarVagas(vagas, { onda: 'o2' }).map((v) => v.id)).toEqual(['b'])
    expect(filtrarVagas(vagas, { funcao: 'Técnico de Campo', area: 'Caldeiraria', gestorId: 'g1' })).toHaveLength(2)
    expect(filtrarVagas(vagas, { gestorId: 'outro' })).toHaveLength(0)
  })

  it('filtra por função sem diferenciar acento, caixa nem espaços', () => {
    const vagas = [vaga('a', { cor: 'verde', etapaAtual: 1, funcao: 'Eletricista ' }), vaga('b', { cor: 'verde', etapaAtual: 1 })]
    expect(filtrarVagas(vagas, { funcao: 'eletricista' }).map((v) => v.id)).toEqual(['a'])
  })

  it('lista em atenção as vermelhas antes das amarelas, as mais atrasadas primeiro', () => {
    const vagas = [
      vaga('amarela', { cor: 'amarelo', etapaAtual: 2 }),
      vaga('vermelha-recente', { cor: 'vermelho', etapaAtual: 2, fimAtual: '2026-10-28' }),
      vaga('verde', { cor: 'verde', etapaAtual: 2 }),
      vaga('vermelha-antiga', { cor: 'vermelho', etapaAtual: 2, fimAtual: '2026-10-23' }),
    ]
    expect(vagasEmAtencao(vagas).map((v) => v.id)).toEqual(['vermelha-antiga', 'vermelha-recente', 'amarela'])
  })

  it('agrupa por etapa atual, sem as mobilizadas', () => {
    const grupos = porEtapa([vaga('a', { cor: 'verde', etapaAtual: 2 }), vaga('b', { cor: 'verde', etapaAtual: 2 }), vaga('c', { cor: null, etapaAtual: null })])
    expect(grupos.get(2)?.map((v) => v.id)).toEqual(['a', 'b'])
    expect([...grupos.keys()]).toEqual([2])
  })
})
