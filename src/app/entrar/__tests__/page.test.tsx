import { render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

vi.mock('../FormularioEntrada', () => ({ FormularioEntrada: vi.fn(() => <form />) }))
vi.mock('@/components/marca/FundoRede', () => ({ FundoRede: () => <canvas /> }))
vi.mock('@/components/tema/AlternadorTema', () => ({ AlternadorTema: () => <button type="button">tema</button> }))

const { default: Entrar } = await import('../page')
const TITULO = 'Painel de Mobilização'

test('capa do celular mostra o título e o formulário fica num cartão arredondado em cima', async () => {
  render(await Entrar({ searchParams: Promise.resolve({}) }))
  expect(screen.getAllByText(TITULO).length).toBeGreaterThanOrEqual(1)
  expect(within(screen.getByTestId('capa-celular')).getByText(TITULO)).toBeTruthy()
  expect(screen.getByTestId('cartao-entrada').className).toContain('rounded-t-[22px]')
})

test('passa o aviso da URL para o formulário', async () => {
  const { FormularioEntrada } = await import('../FormularioEntrada')
  const mock = vi.mocked(FormularioEntrada)
  render(await Entrar({ searchParams: Promise.resolve({ erro: 'portal' }) }))
  render(await Entrar({ searchParams: Promise.resolve({ erro: 'sem-acesso' }) }))
  render(await Entrar({ searchParams: Promise.resolve({ erro: 'outra-coisa' }) }))
  expect(mock.mock.calls.map(([p]) => p)).toContainEqual({ aviso: 'portal' })
  expect(mock.mock.calls.map(([p]) => p)).toContainEqual({ aviso: 'sem-acesso' })
  expect(mock.mock.calls.at(-1)![0]).toEqual({ aviso: null })
})
