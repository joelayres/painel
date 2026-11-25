import { expect, test } from 'vitest'
import { rotuloClassificacao, rotuloParecer, rotuloResultado, rotuloTipoEntrevista, separarAbas, type LinhaParticipacao } from '../selecao'

const linha = (id: string, nota: number | null, classificacao: LinhaParticipacao['classificacao'], situacao = 'analisada', nome = id): LinhaParticipacao =>
  ({ id, nome, nota, classificacao, situacao, resultado: 'em_andamento', resumo: null })

test('separa as abas pela classificação e ordena pela nota', () => {
  const abas = separarAbas([
    linha('a', 78, 'parcial'),
    linha('b', 92, 'aderente'),
    linha('c', 40, 'nao_aderente'),
    linha('d', 60, 'a_confirmar'),
    linha('e', null, null, 'pendente'),
    linha('f', 90, 'aderente', 'repetida'),
  ])
  expect(abas.aConfirmar.map((l) => l.id)).toEqual(['d'])
  expect(abas.aderentes.map((l) => l.id)).toEqual(['b', 'a'])
  expect(abas.naoAderentes.map((l) => l.id)).toEqual(['c'])
})

test('mesma nota: ordem pelo nome', () => {
  const abas = separarAbas([linha('1', 80, 'aderente', 'analisada', 'Zeca'), linha('2', 80, 'aderente', 'analisada', 'Ana')])
  expect(abas.aderentes.map((l) => l.nome)).toEqual(['Ana', 'Zeca'])
})

test('rótulos', () => {
  expect(rotuloClassificacao('parcial')).toBe('Parcialmente aderente')
  expect(rotuloClassificacao('a_confirmar')).toBe('A confirmar')
  expect(rotuloResultado('aprovado_nao_escolhido')).toBe('Aprovado mas não escolhido')
  expect(rotuloParecer('ressalvas')).toBe('Recomendado com ressalvas')
  expect(rotuloTipoEntrevista('cliente')).toBe('Entrevista TNGO/Braskem')
})
