import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { CartoesOnda } from '../CartoesOnda'

const resumo = { id: 'o1', nome: '1ª Onda', inicio: '2026-10-22', fim: '2026-11-26', total: 3, admitidas: 1, mobilizadas: 1, verde: 1, amarelo: 0, vermelho: 1, proximaMeta: '2026-11-26' }

test('mostra a onda com período, admitidos e contagem por cor', () => {
  render(<CartoesOnda resumos={[resumo]} hrefDe={(id) => `/projetos/p1?onda=${id}`} />)
  const cartao = screen.getByRole('link', { name: /1ª Onda/ })
  expect(cartao).toHaveAttribute('href', '/projetos/p1?onda=o1')
  expect(cartao).toHaveTextContent('1ª Onda')
  expect(cartao).toHaveTextContent('22/10 a 26/11')
  expect(cartao).toHaveTextContent('1 admitidos de 3')
  expect(cartao).toHaveTextContent('1 mobilizados')
  expect(cartao).toHaveTextContent('1 no prazo · 0 em risco · 1 atrasadas')
})

test('destaca a onda filtrada', () => {
  render(<CartoesOnda resumos={[resumo]} hrefDe={(id) => `/?onda=${id}`} ativa="o1" />)
  expect(screen.getByRole('link', { name: /1ª Onda/ })).toHaveAttribute('aria-current', 'true')
})

test('sem link nem período, vira um cartão único do projeto', () => {
  render(<CartoesOnda resumos={[{ ...resumo, id: 'projeto', nome: 'Todas as vagas', inicio: null, fim: null }]} />)
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(screen.getByText('Todas as vagas')).toBeInTheDocument()
  expect(screen.queryByText(/ a /)).not.toBeInTheDocument()
})
