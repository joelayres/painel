import { describe, expect, it } from 'vitest'
import { diasUteisEntre, diaUtilSeguinte, ehDiaUtil, fimDaEtapa, proximoDiaUtil } from '../calendario'

const F = new Set(['2026-11-02', '2026-11-15', '2026-11-20'])

describe('calendário de dias úteis', () => {
  it('fim de semana e feriado não são dias úteis', () => {
    expect(ehDiaUtil('2026-10-30', F)).toBe(true)
    expect(ehDiaUtil('2026-10-31', F)).toBe(false)
    expect(ehDiaUtil('2026-11-02', F)).toBe(false)
  })

  it('próximo dia útil é a própria data quando já é útil', () => {
    expect(proximoDiaUtil('2026-10-30', F)).toBe('2026-10-30')
    expect(proximoDiaUtil('2026-10-31', F)).toBe('2026-11-03')
  })

  it('dia útil seguinte pula o fim de semana e Finados', () => {
    expect(diaUtilSeguinte('2026-10-30', F)).toBe('2026-11-03')
  })

  it('etapa de N dias termina no N-ésimo dia útil contando o início', () => {
    expect(fimDaEtapa('2026-10-23', 4, F)).toBe('2026-10-28')
    expect(fimDaEtapa('2026-10-30', 1, F)).toBe('2026-10-30')
    expect(fimDaEtapa('2026-11-19', 3, F)).toBe('2026-11-24')
  })

  it('etapa de duração 0 termina no próprio início', () => {
    expect(fimDaEtapa('2026-11-04', 0, F)).toBe('2026-11-04')
  })

  it('conta os dias úteis depois de uma data até outra', () => {
    expect(diasUteisEntre('2026-10-30', '2026-11-04', F)).toBe(2)
    expect(diasUteisEntre('2026-11-04', '2026-11-04', F)).toBe(0)
    expect(diasUteisEntre('2026-11-05', '2026-11-04', F)).toBe(0)
  })
})
