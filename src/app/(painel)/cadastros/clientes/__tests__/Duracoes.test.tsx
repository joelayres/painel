import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

const alterarDuracaoCliente = vi.fn()
vi.mock('../../acoesCadastros', () => ({ alterarDuracaoCliente }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const { Duracoes } = await import('../[id]/Duracoes')

const etapas = [
  { ordem: 8, nome: 'Exames', duracao: 3 },
  { ordem: 9, nome: 'Admissão', duracao: 7 },
]

test('salvar envia a duração digitada da etapa', async () => {
  alterarDuracaoCliente.mockResolvedValue({ ok: true })
  render(<Duracoes clienteId="c1" etapas={etapas} />)
  expect(screen.getByText('Vale para os projetos deste cliente que não ajustaram a etapa.')).toBeInTheDocument()
  const campo = screen.getByLabelText('Duração de Admissão')
  await userEvent.clear(campo)
  await userEvent.type(campo, '5')
  await userEvent.click(screen.getByRole('button', { name: 'Salvar Admissão' }))
  expect(alterarDuracaoCliente).toHaveBeenCalledWith('c1', 9, { duracao: '5' })
})
