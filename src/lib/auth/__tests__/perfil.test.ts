// @vitest-environment node
import { expect, test, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/servidor', () => ({ criarClienteServidor: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { ehEquipe } from '../perfil'

test('ehEquipe: Administrador e Analista são da equipe', () => {
  expect(ehEquipe('rh')).toBe(true)
  expect(ehEquipe('analista')).toBe(true)
  expect(ehEquipe('gestor')).toBe(false)
  expect(ehEquipe('cliente')).toBe(false)
})
