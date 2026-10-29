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

test('o Analista vê Novo projeto, o filtro e os encerrados no fim, sem o link Encerrados', () => {
  const encerrado = { ...proj('9', 'Parada Z', 'Braskem'), encerrado: true }
  render(<ListaProjetos projetos={lista} encerrados={[encerrado]} perfil="analista" clientes={[]} />)
  expect(screen.getByText('+ Novo projeto')).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Encerrados' })).toBeNull()
  expect(screen.getByRole('navigation', { name: 'Clientes' })).toBeTruthy()
  const secao = screen.getByRole('region', { name: 'Encerrados' })
  expect(within(secao).getByRole('link', { name: 'Projeto Parada Z' })).toBeTruthy()
  expect(screen.getAllByRole('region', { name: 'Braskem' })).toHaveLength(2)
})

test('gestor não vê Novo projeto', () => {
  render(<ListaProjetos projetos={lista} perfil="gestor" clientes={[]} />)
  expect(screen.queryByText('+ Novo projeto')).toBeNull()
})

test('gestor sem projetos vê a mensagem', () => {
  render(<ListaProjetos projetos={[]} perfil="gestor" clientes={[]} />)
  expect(screen.getByText('Ainda não há projetos liberados para você. Fale com o Administrador.')).toBeTruthy()
})

test('gestor só com projeto encerrado vê o projeto em Encerrados', () => {
  const encerrado = { ...proj('9', 'Parada Z', 'Braskem'), encerrado: true }
  render(<ListaProjetos projetos={[]} encerrados={[encerrado]} perfil="gestor" clientes={[]} />)
  expect(screen.queryByText('Ainda não há projetos liberados para você. Fale com o Administrador.')).toBeNull()
  const secao = screen.getByRole('region', { name: 'Encerrados' })
  expect(within(secao).getByRole('link', { name: 'Projeto Parada Z' })).toHaveAttribute('href', '/projetos/9/resumo')
  expect(secao).toHaveTextContent('Encerrado')
})

test('com projetos de 2 clientes, mostra o filtro de cliente', () => {
  render(<ListaProjetos projetos={lista} perfil="gestor" clientes={[]} />)
  const filtro = screen.getByRole('navigation', { name: 'Clientes' })
  const botoes = within(filtro).getAllByRole('link')
  expect(botoes.map((b) => b.textContent)).toEqual(['Todos', 'Braskem', 'Timenow'])
  expect(botoes[0]).toHaveAttribute('href', '/')
  expect(botoes[0]).toHaveAttribute('aria-current', 'true')
  expect(botoes[1]).toHaveAttribute('href', '/?cliente=Braskem')
})

test('com um cliente escolhido, mostra só os projetos dele', () => {
  render(<ListaProjetos projetos={lista} perfil="rh" clientes={[]} clienteAtivo="Timenow" />)
  expect(screen.queryByRole('region', { name: 'Braskem' })).toBeNull()
  expect(within(screen.getByRole('region', { name: 'Timenow' })).getAllByRole('link')).toHaveLength(1)
  expect(within(screen.getByRole('navigation', { name: 'Clientes' })).getByRole('link', { name: 'Timenow' })).toHaveAttribute('aria-current', 'true')
})

test('cliente desconhecido no endereço mostra todos', () => {
  render(<ListaProjetos projetos={lista} perfil="rh" clientes={[]} clienteAtivo="outro" />)
  expect(screen.getByRole('region', { name: 'Braskem' })).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Timenow' })).toBeTruthy()
})

test('com projetos de um cliente só, não mostra o filtro', () => {
  render(<ListaProjetos projetos={lista.slice(0, 2)} perfil="rh" clientes={[]} />)
  expect(screen.queryByRole('navigation', { name: 'Clientes' })).toBeNull()
})
