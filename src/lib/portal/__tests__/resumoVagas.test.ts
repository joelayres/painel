import { expect, test, vi } from 'vitest'
import type { CartaoProjeto } from '@/lib/painel/dados'
import { projetosVisiveis, resumirVagas } from '../resumoVagas'

const cartao = (id: string, cliente: string, nome: string, resumo: Partial<CartaoProjeto['resumo']>, encerrado = false): CartaoProjeto => ({
  id, nome, area: null, organizacao: 'ondas', encerrado, cliente: { id: cliente, nome: cliente }, ondas: 0,
  resumo: { id: 'projeto', nome: '', inicio: null, fim: null, total: 0, admitidas: 0, mobilizadas: 0, verde: 0, amarelo: 0, vermelho: 0, proximaMeta: null, ...resumo },
})
const braskem = cartao('p1', 'Braskem', '2027', { total: 50, admitidas: 20, mobilizadas: 12, vermelho: 3, amarelo: 5 })
const outro = cartao('p2', 'Outro', 'Parada', { total: 10, admitidas: 1, mobilizadas: 0, vermelho: 1, amarelo: 0 })
const encerrado = cartao('p3', 'Braskem', 'Antigo', { total: 99, admitidas: 99, mobilizadas: 99 }, true)
const valores = (r: ReturnType<typeof resumirVagas>, i = 0) => Object.fromEntries(r.secoes[i].indicadores.map((x) => [x.rotulo, x.valor]))

test('gestor com só o projeto Braskem não soma o de outro cliente', () => {
  const r = resumirVagas([braskem, outro], new Set(['p1']))
  expect(r.secoes).toHaveLength(1)
  expect(r.secoes[0].titulo).toBe('Total')
  expect(valores(r)).toEqual({ Vagas: 50, Admitidas: 20, Mobilizadas: 12, Vermelhas: 3, Amarelas: 5 })
  expect(r.secoes[0].indicadores.find((i) => i.rotulo === 'Vermelhas')?.cor).toBe('vermelho')
  expect(r.secoes[0].indicadores.find((i) => i.rotulo === 'Amarelas')?.cor).toBe('amarelo')
  expect(r).toMatchObject({ versao: 1, alertas: [] })
  expect(r.periodo).toBeUndefined()
})

test('rh soma todos, com uma seção por projeto, e encerrado não entra', () => {
  const r = resumirVagas([braskem, outro, encerrado], 'todos')
  expect(r.secoes.map((s) => s.titulo)).toEqual(['Total', 'Braskem · 2027', 'Outro · Parada'])
  expect(valores(r)).toEqual({ Vagas: 60, Admitidas: 21, Mobilizadas: 12, Vermelhas: 4, Amarelas: 5 })
  expect(valores(r, 2).Vagas).toBe(10)
})

test('sem projeto visível mostra total zerado', () => {
  expect(valores(resumirVagas([braskem], new Set()))).toEqual({ Vagas: 0, Admitidas: 0, Mobilizadas: 0, Vermelhas: 0, Amarelas: 0 })
})

test('projetosVisiveis: rh vê todos; os outros, os liberados em projeto_acessos', async () => {
  const eq = vi.fn(async () => ({ data: [{ projeto_id: 'p1' }, { projeto_id: 'p9' }], error: null }))
  const admin = { from: vi.fn(() => ({ select: () => ({ eq }) })) } as never
  expect(await projetosVisiveis(admin, { id: 'r1', perfil: 'rh', usuarioId: 'u1' })).toBe('todos')
  expect(await projetosVisiveis(admin, { id: 'r1', perfil: 'gestor', usuarioId: 'u1' })).toEqual(new Set(['p1', 'p9']))
  expect(eq).toHaveBeenCalledWith('usuario_id', 'r1')
})
