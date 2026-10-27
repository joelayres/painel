import { describe, expect, it } from 'vitest'
import { hojeSP } from '@/dominio/tempo'

describe('base do projeto', () => {
  it('calcula o dia de hoje em São Paulo', () => {
    expect(hojeSP(new Date('2026-10-28T02:00:00Z'))).toBe('2026-10-27')
  })
})
