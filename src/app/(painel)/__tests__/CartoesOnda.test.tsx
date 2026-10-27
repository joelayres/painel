import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { CartoesOnda } from '../CartoesOnda'

const resumo = { numero: 1, inicio: '2026-10-22', fim: '2026-11-26', total: 3, admitidas: 1, mobilizadas: 1, verde: 1, amarelo: 0, vermelho: 1 }

test('mostra a onda com período, admitidos e contagem por cor', () => {
  render(<CartoesOnda resumos={[resumo]} hrefDe={(n) => `/?onda=${n}`} />)
  const cartao = screen.getByRole('link', { name: /Onda 1/ })
  expect(cartao).toHaveAttribute('href', '/?onda=1')
  expect(cartao).toHaveTextContent('1ª Onda')
  expect(cartao).toHaveTextContent('22/10 a 26/11')
  expect(cartao).toHaveTextContent('1 admitidos de 3')
  expect(cartao).toHaveTextContent('1 mobilizados')
  expect(cartao).toHaveTextContent('1 no prazo · 0 em risco · 1 atrasadas')
})

test('destaca a onda filtrada', () => {
  render(<CartoesOnda resumos={[resumo]} hrefDe={(n) => `/?onda=${n}`} ativa={1} />)
  expect(screen.getByRole('link', { name: /Onda 1/ })).toHaveAttribute('aria-current', 'true')
})
