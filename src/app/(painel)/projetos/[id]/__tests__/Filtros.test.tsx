import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

const push = vi.fn()
let params = new URLSearchParams('funcao=T%C3%A9cnico+de+Campo')
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useSearchParams: () => params, usePathname: () => '/' }))
const { Filtros } = await import('../Filtros')

const opcoes = { ondas: [{ id: 'o1', nome: '1ª Onda' }, { id: 'o2', nome: '2ª Onda' }], funcoes: ['Técnico de Campo', 'Assistente Técnico'], areas: ['Caldeiraria'], gestores: [{ id: 'g1', nome: 'Ana Souza' }] }

beforeEach(() => {
  push.mockClear()
  params = new URLSearchParams('funcao=T%C3%A9cnico+de+Campo')
})

test('escolher um gestor mantém os outros filtros no endereço', async () => {
  render(<Filtros opcoes={opcoes} />)
  await userEvent.selectOptions(screen.getByLabelText('Gestor'), 'g1')
  expect(push).toHaveBeenCalledWith('/?funcao=T%C3%A9cnico+de+Campo&gestor=g1')
})

test('voltar para "Todos" tira o filtro do endereço', async () => {
  render(<Filtros opcoes={opcoes} />)
  await userEvent.selectOptions(screen.getByLabelText('Função'), '')
  expect(push).toHaveBeenCalledWith('/')
})

test('sem ondas (projeto por meta), não mostra o filtro de onda', () => {
  render(<Filtros opcoes={{ ...opcoes, ondas: [] }} />)
  expect(screen.queryByLabelText('Onda')).not.toBeInTheDocument()
})
