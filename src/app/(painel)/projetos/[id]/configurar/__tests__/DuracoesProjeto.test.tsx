import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

const alterarDuracaoProjeto = vi.fn()
vi.mock('../acoesConfigurar', () => ({ alterarDuracaoProjeto }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const { DuracoesProjeto } = await import('../DuracoesProjeto')

const etapas = [
  { ordem: 8, nome: 'Exames', padrao: 3, ajuste: null },
  { ordem: 9, nome: 'Admissão', padrao: 7, ajuste: 5 },
]

test('a etapa ajustada mostra "ajustado" e volta ao padrão do cliente', async () => {
  alterarDuracaoProjeto.mockResolvedValue({ ok: true })
  render(<DuracoesProjeto projetoId="p1" cliente="Acme" etapas={etapas} somenteLeitura={false} />)
  expect(screen.getByRole('columnheader', { name: 'Padrão Acme' })).toBeInTheDocument()
  const linhas = screen.getAllByRole('row')
  expect(within(linhas[1]).queryByText('ajustado')).not.toBeInTheDocument()
  expect(within(linhas[1]).queryByRole('button', { name: /Voltar ao padrão/ })).not.toBeInTheDocument()
  expect(within(linhas[2]).getByText('ajustado')).toBeInTheDocument()
  expect(screen.getByLabelText('Duração de Exames neste projeto')).toHaveValue(null)
  expect(screen.getByLabelText('Duração de Admissão neste projeto')).toHaveValue(5)
  await userEvent.click(within(linhas[2]).getByRole('button', { name: /Voltar ao padrão/ }))
  expect(alterarDuracaoProjeto).toHaveBeenCalledWith('p1', 9, { duracao: '' })
})

test('salvar um ajuste envia os dias digitados', async () => {
  alterarDuracaoProjeto.mockResolvedValue({ ok: true })
  render(<DuracoesProjeto projetoId="p1" cliente="Acme" etapas={etapas} somenteLeitura={false} />)
  await userEvent.type(screen.getByLabelText('Duração de Exames neste projeto'), '4')
  await userEvent.click(screen.getAllByRole('button', { name: 'Salvar' })[0])
  expect(alterarDuracaoProjeto).toHaveBeenCalledWith('p1', 8, { duracao: '4' })
})

test('somente leitura não mostra campos nem botões', () => {
  render(<DuracoesProjeto projetoId="p1" cliente="Acme" etapas={etapas} somenteLeitura />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
})
