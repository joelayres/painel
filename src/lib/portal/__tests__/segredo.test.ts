import { afterEach, expect, test } from 'vitest'
import { autorizadoPortal, segredoPortal } from '../segredo'

afterEach(() => {
  delete process.env.PORTAL_SEGREDO
})

test('confere o cabeçalho Bearer', () => {
  expect(autorizadoPortal('Bearer s', 's')).toBe(true)
  expect(autorizadoPortal(null, 's')).toBe(false)
  expect(autorizadoPortal('Bearer x', 's')).toBe(false)
  expect(autorizadoPortal('s', 's')).toBe(false)
})

test('segredo vazio é o mesmo que não configurado', () => {
  expect(segredoPortal()).toBeNull()
  process.env.PORTAL_SEGREDO = ''
  expect(segredoPortal()).toBeNull()
  process.env.PORTAL_SEGREDO = 'abc'
  expect(segredoPortal()).toBe('abc')
})
