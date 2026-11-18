import { expect, test } from 'vitest'
import { ordenarVagas, type VagaOrdenavel } from '../ordenacao'

const vaga = (id: string, p: Partial<VagaOrdenavel> = {}): VagaOrdenavel => ({
  id, funcao: 'Técnico', disciplina: 'NR-13', area: 'Caldeiraria', ondaId: 'o1', meta: null, etapaAtual: 2, gestor: 'Ana', candidato: null, dataInicio: '2026-10-22', ...p,
})
const ondas = [{ id: 'o1', inicio: '2026-11-01' }, { id: 'o2', inicio: '2026-10-01' }]
const ids = (v: VagaOrdenavel[]) => v.map((x) => x.id)

test('sem ordenação mantém a ordem original', () => {
  const vagas = [vaga('a', { disciplina: 'Z' }), vaga('b', { disciplina: 'A' })]
  expect(ids(ordenarVagas(vagas, null, ondas))).toEqual(['a', 'b'])
})

test('ordena por disciplina e por área, crescente e decrescente, sem ligar para acento e caixa', () => {
  const vagas = [vaga('a', { disciplina: 'Elétrica' }), vaga('b', { disciplina: 'caldeiraria' }), vaga('c', { disciplina: 'Ácido' })]
  expect(ids(ordenarVagas(vagas, { coluna: 'disciplina', direcao: 'asc' }, ondas))).toEqual(['c', 'b', 'a'])
  expect(ids(ordenarVagas(vagas, { coluna: 'disciplina', direcao: 'desc' }, ondas))).toEqual(['a', 'b', 'c'])
  const porArea = [vaga('a', { area: 'Montagem' }), vaga('b', { area: 'Elétrica' })]
  expect(ids(ordenarVagas(porArea, { coluna: 'area', direcao: 'asc' }, ondas))).toEqual(['b', 'a'])
})

test('onda segue a data de início da onda, não o nome', () => {
  const vagas = [vaga('a', { ondaId: 'o1' }), vaga('b', { ondaId: 'o2' })]
  expect(ids(ordenarVagas(vagas, { coluna: 'onda', direcao: 'asc' }, ondas))).toEqual(['b', 'a'])
})

test('no projeto por meta, a coluna onda ordena pela data da meta', () => {
  const vagas = [vaga('a', { ondaId: null, meta: '2026-12-01' }), vaga('b', { ondaId: null, meta: '2026-11-01' })]
  expect(ids(ordenarVagas(vagas, { coluna: 'onda', direcao: 'asc' }, ondas))).toEqual(['b', 'a'])
})

test('sem gestor fica sempre no fim, nos dois sentidos', () => {
  const vagas = [vaga('a', { gestor: null }), vaga('b', { gestor: 'Carlos' }), vaga('c', { gestor: 'Ana' })]
  expect(ids(ordenarVagas(vagas, { coluna: 'gestor', direcao: 'asc' }, ondas))).toEqual(['c', 'b', 'a'])
  expect(ids(ordenarVagas(vagas, { coluna: 'gestor', direcao: 'desc' }, ondas))).toEqual(['b', 'c', 'a'])
})

test('empate mantém a ordem original', () => {
  const vagas = [vaga('a'), vaga('b'), vaga('c')]
  expect(ids(ordenarVagas(vagas, { coluna: 'gestor', direcao: 'desc' }, ondas))).toEqual(['a', 'b', 'c'])
})
