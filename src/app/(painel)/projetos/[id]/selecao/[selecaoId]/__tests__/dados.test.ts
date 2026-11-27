// @vitest-environment node
import { expect, test, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { emAndamentoDaSelecao, pendentesDaSelecao } from '../dados'

const agora = Date.parse('2026-11-27T21:20:00Z')
const ps = [
  { id: '1', situacao: 'analisando' as const, analisando_desde: '2026-11-27T21:19:30Z', erro: null, curriculo: { nome_arquivo: 'a.pdf' } },
  { id: '2', situacao: 'analisando' as const, analisando_desde: '2026-11-27T21:10:00Z', erro: null, curriculo: { nome_arquivo: 'b.pdf' } },
  { id: '3', situacao: 'pendente' as const, analisando_desde: null, erro: null, curriculo: { nome_arquivo: 'c.pdf' } },
  { id: '4', situacao: 'analisada' as const, analisando_desde: '2026-11-27T21:19:50Z', erro: null, curriculo: { nome_arquivo: 'd.pdf' } },
]

test('em andamento conta só quem começou a ser analisado há menos de 5 minutos', () => {
  expect(emAndamentoDaSelecao(ps, agora)).toBe(1)
})

test('parada há mais de 5 minutos volta a ser pendente', () => {
  expect(pendentesDaSelecao(ps, agora).map((p) => p.id)).toEqual(['2', '3'])
})
