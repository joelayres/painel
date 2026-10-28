import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { CartaoProjeto as Projeto } from '@/lib/painel/dados'
import { CartaoProjeto } from '../CartaoProjeto'

const base: Projeto = {
  id: 'p1', nome: 'Parada 2027', area: 'Manutenção', organizacao: 'ondas', ondas: 4, encerrado: false,
  cliente: { id: 'c1', nome: 'Braskem' },
  resumo: { id: 'p1', nome: 'Parada 2027', inicio: null, fim: null, total: 50, admitidas: 12, mobilizadas: 20, verde: 30, amarelo: 5, vermelho: 3, proximaMeta: '2026-12-10' },
}

test('projeto com ondas mostra link, área, ondas, vagas, admitidos e cores', () => {
  render(<CartaoProjeto projeto={base} />)
  const c = screen.getByRole('link', { name: 'Projeto Parada 2027' })
  expect(c).toHaveAttribute('href', '/projetos/p1')
  expect(c).toHaveTextContent('Manutenção · 4 ondas · 50 vagas')
  expect(c).toHaveTextContent('12 admitidos de 50')
  expect(c).toHaveTextContent('30 no prazo · 5 em risco · 3 atrasadas')
  expect(c).not.toHaveTextContent('próxima meta')
})

test('projeto por meta mostra sem ondas e a próxima meta', () => {
  render(<CartaoProjeto projeto={{ ...base, organizacao: 'meta', ondas: 0 }} />)
  const c = screen.getByRole('link', { name: 'Projeto Parada 2027' })
  expect(c).toHaveTextContent('sem ondas · 50 vagas')
  expect(c).toHaveTextContent('próxima meta 10/12')
})

test('sem área, não mostra a área; encerrado mostra o texto', () => {
  render(<CartaoProjeto projeto={{ ...base, area: null, encerrado: true }} />)
  const c = screen.getByRole('link', { name: 'Projeto Parada 2027' })
  expect(c).toHaveTextContent('4 ondas · 50 vagas')
  expect(c.textContent).not.toContain('·  ·')
  expect(c).toHaveTextContent('Encerrado')
})
