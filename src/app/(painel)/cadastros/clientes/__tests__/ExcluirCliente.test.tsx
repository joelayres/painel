import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

const excluirCliente = vi.fn()
vi.mock('../../acoesCadastros', () => ({ salvarCliente: vi.fn(), excluirCliente }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const { ExcluirCliente } = await import('../Cliente')

test('excluir pede confirmação e mostra o motivo da recusa', async () => {
  excluirCliente.mockResolvedValue({ ok: false, erros: { _: 'Este cliente tem projetos e não pode ser excluído.' } })
  render(<ExcluirCliente cliente={{ id: 'c1', nome: 'Teste', projetos: 1 }} aoExcluir={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Excluir cliente Teste' }))
  expect(screen.getByText('Excluir Teste? Os gestores e as etapas do cliente também serão apagados.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))
  expect(excluirCliente).toHaveBeenCalledWith('c1')
  expect(await screen.findByRole('alert')).toHaveTextContent('Este cliente tem projetos e não pode ser excluído.')
})
