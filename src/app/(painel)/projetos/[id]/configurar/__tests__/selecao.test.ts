import { expect, test } from 'vitest'
import { etapaComum, puladasNoInicio, selecionaveis, type VagaSelecionavel } from '../selecao'

const vaga = (id: string, p: Partial<VagaSelecionavel> = {}): VagaSelecionavel => ({
  id, funcao: 'Técnico de Campo', ondaId: 'o1', etapaAtual: 2, concluiuAlguma: true, cancelada: false, ...p,
})

test('selecionáveis tira canceladas e mobilizadas e aplica o filtro de função', () => {
  const vagas = [
    vaga('a'),
    vaga('b', { funcao: 'técnico de campo ' }),
    vaga('c', { cancelada: true }),
    vaga('d', { etapaAtual: null }),
    vaga('e', { funcao: 'Eletricista' }),
  ]
  expect(selecionaveis(vagas, { funcao: 'Técnico de Campo' }).map((v) => v.id)).toEqual(['a', 'b'])
})

test('selecionáveis filtra por onda e por etapa atual', () => {
  const vagas = [vaga('a'), vaga('b', { ondaId: 'o2' }), vaga('c', { etapaAtual: 3 })]
  expect(selecionaveis(vagas, { onda: 'o1' }).map((v) => v.id)).toEqual(['a', 'c'])
  expect(selecionaveis(vagas, { etapa: 3 }).map((v) => v.id)).toEqual(['c'])
  expect(selecionaveis(vagas, {}).map((v) => v.id)).toEqual(['a', 'b', 'c'])
})

test('etapa comum só quando todas estão na mesma etapa', () => {
  expect(etapaComum([vaga('a', { etapaAtual: 3 }), vaga('b', { etapaAtual: 3 })])).toBe(3)
  expect(etapaComum([vaga('a', { etapaAtual: 3 }), vaga('b', { etapaAtual: 4 })])).toBeNull()
  expect(etapaComum([])).toBeNull()
})

test('puladas no início são as que já concluíram alguma etapa', () => {
  expect(puladasNoInicio([vaga('a'), vaga('b', { concluiuAlguma: false }), vaga('c')])).toBe(2)
})
