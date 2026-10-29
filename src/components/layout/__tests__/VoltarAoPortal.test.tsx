import { render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

let valor: string | undefined
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (nome: string) => (nome === 'veio_do_portal' && valor ? { value: valor } : undefined) }) }))
const { VoltarAoPortal } = await import('../VoltarAoPortal')

beforeEach(() => {
  valor = undefined
})

test('quem entrou pelo portal vê o link de volta', async () => {
  valor = '1'
  render(<>{await VoltarAoPortal()}</>)
  expect(screen.getByRole('link', { name: /Portal da Gestão/ }).getAttribute('href')).toBe('https://portal.sudeste-timenow.com.br')
})

test('quem entrou direto no sistema não vê o link', async () => {
  const { container } = render(<>{await VoltarAoPortal()}</>)
  expect(container.innerHTML).toBe('')
})
