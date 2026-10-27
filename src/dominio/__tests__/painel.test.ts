import { describe, expect, it } from 'vitest'
import { filtrarVagas, porEtapa, resumirOndas, vagasEmAtencao, type VagaPainel } from '../painel'
import type { Cor } from '../situacao'

const ONDA1 = { id: 'o1', numero: 1, inicio: '2026-10-22', fim: '2026-11-26' }
const ONDA2 = { id: 'o2', numero: 2, inicio: '2026-11-01', fim: '2026-12-18' }

function vaga(id: string, c: { cor: Cor | null; etapaAtual: number | null; fimAtual?: string; admissao?: string; admitida?: boolean; candidato?: string; onda?: typeof ONDA1 }): VagaPainel {
  const mobilizada = c.cor === null
  return {
    id,
    funcao: 'Técnico de Campo',
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
    expect(resumirOndas(vagas)).toEqual([
      { numero: 1, inicio: '2026-10-22', fim: '2026-11-26', total: 3, admitidas: 1, mobilizadas: 1, verde: 1, amarelo: 0, vermelho: 1 },
    ])
  })

  it('ordena os resumos pelo número da onda', () => {
    const vagas = [vaga('a', { cor: 'verde', etapaAtual: 1, onda: ONDA2 }), vaga('b', { cor: 'verde', etapaAtual: 1 })]
    expect(resumirOndas(vagas).map((r) => r.numero)).toEqual([1, 2])
  })

  it('filtra por candidato sem diferenciar maiúsculas nem acentos', () => {
    const vagas = [vaga('a', { cor: 'verde', etapaAtual: 5, candidato: 'João Silva' }), vaga('b', { cor: 'verde', etapaAtual: 1 })]
    expect(filtrarVagas(vagas, { candidato: 'joao' }).map((v) => v.id)).toEqual(['a'])
  })

  it('filtra por onda, função, área e gestor', () => {
    const vagas = [vaga('a', { cor: 'verde', etapaAtual: 1 }), vaga('b', { cor: 'verde', etapaAtual: 1, onda: ONDA2 })]
    expect(filtrarVagas(vagas, { onda: 2 }).map((v) => v.id)).toEqual(['b'])
    expect(filtrarVagas(vagas, { funcao: 'Técnico de Campo', area: 'Caldeiraria', gestorId: 'g1' })).toHaveLength(2)
    expect(filtrarVagas(vagas, { gestorId: 'outro' })).toHaveLength(0)
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
