import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

vi.mock('@/app/(painel)/acoesProjeto', () => ({ salvarProjeto: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const { DadosProjeto } = await import('../DadosProjeto')

const projeto = { id: 'p1', clienteId: 'c1', clienteNome: 'Acme', nome: 'Parada 2027', area: null, organizacao: 'meta' as const, folgaMinima: 5 }

test('projeto aberto pode ter os dados editados', () => {
  render(<DadosProjeto projeto={projeto} somenteLeitura={false} />)
  expect(screen.getByRole('button', { name: 'Editar dados' })).toBeInTheDocument()
})

test('projeto encerrado mostra os dados sem o botão de editar', () => {
  render(<DadosProjeto projeto={projeto} somenteLeitura />)
  expect(screen.getByText('Parada 2027')).toBeInTheDocument()
  expect(screen.getByText('5 dias úteis')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Editar dados' })).not.toBeInTheDocument()
})
