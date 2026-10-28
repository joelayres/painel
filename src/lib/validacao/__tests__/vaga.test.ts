import { expect, test } from 'vitest'
import { esquemaVaga, validar } from '../vaga'

test('data impossível é recusada', () => {
  const r = validar(esquemaVaga, { funcao: 'F', disciplina: 'D', area: 'A', ondaId: '11111111-1111-4111-8111-111111111111', dataInicio: '2026-02-31' })
  expect(r).toEqual({ ok: false, erros: { dataInicio: 'Informe a data de início.' } })
})
