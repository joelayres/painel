import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { AbasProjeto } from '../AbasProjeto'

vi.mock('next/navigation', () => ({ usePathname: () => '/projetos/p1/resumo' }))

test('o Resumo vem primeiro e o Configurar só para o RH', () => {
  render(<AbasProjeto projetoId="p1" equipe />)
  const abas = screen.getAllByRole('link')
  expect(abas.map((a) => a.textContent)).toEqual(['Resumo', 'Painel', 'Configurar'])
  expect(abas[0]).toHaveAttribute('href', '/projetos/p1/resumo')
  expect(abas[0]).toHaveAttribute('aria-current', 'page')
  expect(abas[1]).toHaveAttribute('href', '/projetos/p1')
  expect(abas[1]).not.toHaveAttribute('aria-current')
})

test('gestor e cliente não veem o Configurar', () => {
  render(<AbasProjeto projetoId="p1" equipe={false} />)
  expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['Resumo', 'Painel'])
})
