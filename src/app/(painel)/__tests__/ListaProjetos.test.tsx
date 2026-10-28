import { render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { CartaoProjeto as Projeto } from '@/lib/painel/dados'

vi.mock('../FormProjeto', () => ({ FormProjeto: () => <button type="button">+ Novo projeto</button> }))
vi.mock('../acoesProjeto', () => ({}))

const { ListaProjetos } = await import('../ListaProjetos')

const proj = (id: string, nome: string, cliente: string): Projeto => ({
  id, nome, area: null, organizacao: 'ondas', ondas: 2, encerrado: false,
  cliente: { id: cliente, nome: cliente },
  resumo: { id, nome, inicio: null, fim: null, total: 5, admitidas: 1, mobilizadas: 1, verde: 3, amarelo: 1, vermelho: 1, proximaMeta: null },
})
const lista = [proj('1', 'Parada A', 'Braskem'), proj('2', 'Parada B', 'Braskem'), proj('3', 'Obra C', 'Timenow')]

test('agrupa os projetos por cliente', () => {
  render(<ListaProjetos projetos={lista} perfil="rh" clientes={[]} />)
  const braskem = screen.getByRole('region', { name: 'Braskem' })
  expect(within(braskem).getAllByRole('link')).toHaveLength(2)
  const timenow = screen.getByRole('region', { name: 'Timenow' })
  expect(within(timenow).getAllByRole('link')).toHaveLength(1)
})

test('o RH vê Novo projeto e Encerrados', () => {
  render(<ListaProjetos projetos={lista} perfil="rh" clientes={[]} />)
  expect(screen.getByText('+ Novo projeto')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Encerrados' })).toHaveAttribute('href', '/encerrados')
})

test('gestor não vê Novo projeto', () => {
  render(<ListaProjetos projetos={lista} perfil="gestor" clientes={[]} />)
  expect(screen.queryByText('+ Novo projeto')).toBeNull()
})

test('gestor sem projetos vê a mensagem', () => {
  render(<ListaProjetos projetos={[]} perfil="gestor" clientes={[]} />)
  expect(screen.getByText('Ainda não há projetos liberados para você. Fale com o RH.')).toBeTruthy()
})
