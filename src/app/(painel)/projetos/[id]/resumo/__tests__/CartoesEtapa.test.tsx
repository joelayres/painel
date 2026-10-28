import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { CartaoEtapa } from '@/dominio/painel'
import { CartoesEtapa } from '../CartoesEtapa'

const cartoes: CartaoEtapa[] = [
  {
    ordem: 1,
    nome: 'Abertura de vaga',
    total: 6,
    funcoes: [
      { funcao: 'Técnico de Planejamento', total: 5, vermelho: 2, amarelo: 1 },
      { funcao: 'Engenheiro de Campo', total: 1, vermelho: 0, amarelo: 0 },
    ],
  },
  { ordem: 2, nome: 'Aprovação', total: 0, funcoes: [] },
  { ordem: null, nome: 'Mobilizadas', total: 0, funcoes: [] },
]

const href = (f: string) => `/projetos/p1?${new URLSearchParams({ funcao: f })}`

test('mostra as funções da etapa com o total', () => {
  render(<CartoesEtapa cartoes={cartoes} hrefFuncao={href} />)
  const cartao = screen.getByRole('heading', { name: /1\. Abertura de vaga/ }).closest('section')!
  expect(within(cartao).getByRole('link', { name: /Técnico de Planejamento/ })).toHaveTextContent('5')
  expect(within(cartao).getByRole('link', { name: /Engenheiro de Campo/ })).toHaveTextContent('1')
})

test('o link da função leva ao painel filtrado', () => {
  render(<CartoesEtapa cartoes={cartoes} hrefFuncao={href} />)
  expect(screen.getByRole('link', { name: /Técnico de Planejamento/ })).toHaveAttribute('href', '/projetos/p1?funcao=T%C3%A9cnico+de+Planejamento')
})

test('etapa sem vagas fica apagada com aviso', () => {
  render(<CartoesEtapa cartoes={cartoes} hrefFuncao={href} />)
  const cartao = screen.getByRole('heading', { name: /2\. Aprovação/ }).closest('section')!
  expect(cartao).toHaveTextContent('nenhuma vaga')
  expect(cartao).toHaveClass('opacity-60')
})

test('mostra atrasadas e em risco quando houver', () => {
  render(<CartoesEtapa cartoes={cartoes} hrefFuncao={href} />)
  expect(screen.getByText('2 atrasadas')).toBeInTheDocument()
  expect(screen.getByText('1 em risco')).toBeInTheDocument()
  expect(screen.queryByText('0 atrasadas')).not.toBeInTheDocument()
})

test('o cartão Mobilizadas vem por último, sem número', () => {
  render(<CartoesEtapa cartoes={cartoes} hrefFuncao={href} />)
  const titulos = screen.getAllByRole('heading').map((h) => h.textContent)
  expect(titulos.at(-1)).toBe('Mobilizadas')
})
