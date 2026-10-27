import { describe, expect, test } from 'vitest'
import { formatarHHMM, hojeSP, paraMinutos } from '../tempo'

describe('paraMinutos', () => {
  test('converte HH:MM em minutos', () => {
    expect(paraMinutos('08:48')).toBe(528)
    expect(paraMinutos('00:00')).toBe(0)
  })
  test('aceita totais acima de 24h', () => {
    expect(paraMinutos('182:30')).toBe(10950)
  })
  test('rejeita formato inválido', () => {
    expect(() => paraMinutos('8h48')).toThrow()
    expect(() => paraMinutos('08:60')).toThrow()
  })
})

describe('formatarHHMM', () => {
  test('formata minutos com zero à esquerda', () => {
    expect(formatarHHMM(528)).toBe('08:48')
    expect(formatarHHMM(0)).toBe('00:00')
  })
  test('formata totais acima de 24h', () => {
    expect(formatarHHMM(10950)).toBe('182:30')
  })
})

describe('hojeSP', () => {
  test('usa a data de São Paulo, não a de UTC', () => {
    expect(hojeSP(new Date('2026-04-16T01:30:00Z'))).toBe('2026-04-15')
    expect(hojeSP(new Date('2026-04-16T03:30:00Z'))).toBe('2026-04-16')
  })
})
