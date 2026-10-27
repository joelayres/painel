import { render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

vi.mock('../FormularioEntrada', () => ({ FormularioEntrada: () => <form /> }))
vi.mock('@/components/marca/FundoRede', () => ({ FundoRede: () => <canvas /> }))
vi.mock('@/components/tema/AlternadorTema', () => ({ AlternadorTema: () => <button type="button">tema</button> }))

const { default: Entrar } = await import('../page')
const TITULO = 'Mobilização Braskem 2027'

test('capa do celular mostra o título e o formulário fica num cartão arredondado em cima', async () => {
  render(await Entrar({ searchParams: Promise.resolve({}) }))
  expect(screen.getAllByText(TITULO).length).toBeGreaterThanOrEqual(1)
  expect(within(screen.getByTestId('capa-celular')).getByText(TITULO)).toBeTruthy()
  expect(screen.getByTestId('cartao-entrada').className).toContain('rounded-t-[22px]')
})
