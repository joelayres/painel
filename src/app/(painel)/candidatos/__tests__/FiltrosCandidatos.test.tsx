import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams() }))

import { FiltrosCandidatos } from '../FiltrosCandidatos'

test('os filtros vão para o endereço', async () => {
  render(<FiltrosCandidatos />)
  await userEvent.type(screen.getByLabelText('Função'), 'Caldeireiro')
  await userEvent.selectOptions(screen.getByLabelText('Resultado'), 'aprovado_nao_escolhido')
  await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))
  expect(push).toHaveBeenCalledWith('/candidatos?funcao=Caldeireiro&resultado=aprovado_nao_escolhido')
})
