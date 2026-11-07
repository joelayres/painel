import { expect, test } from 'vitest'
import { paraEfetivo } from '../vagas'

const vaga = (id: string, extra = {}) => ({ id, projetoId: 'p1', funcao: 'Técnico', disciplina: 'Elétrica', area: 'A', onda: null, candidato: 'Ana Souza',
  dataMobilizacao: '2026-11-20', admitida: true, mobilizada: false, ...extra })

test('só vagas admitidas com candidato, com nome, função e projeto', () => {
  const r = paraEfetivo({
    versao: 1, projetos: [{ id: 'p1', nome: 'Braskem 2027', cliente: 'Braskem', encerrado: false }],
    vagas: [vaga('v1'), vaga('v2', { admitida: false }), vaga('v3', { candidato: null }), vaga('v4', { candidato: '  ' }), vaga('v5', { candidato: ' Bruno ' })],
  })
  expect(r).toEqual({
    versao: 1, projetos: [{ id: 'p1', nome: 'Braskem 2027', encerrado: false }],
    vagas: [{ id: 'v1', projetoId: 'p1', candidato: 'Ana Souza', funcao: 'Técnico' }, { id: 'v5', projetoId: 'p1', candidato: 'Bruno', funcao: 'Técnico' }],
  })
})
