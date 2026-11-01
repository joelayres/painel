import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

const salvarMotivoAtraso = vi.fn()
vi.mock('../acoesVaga', () => ({ salvarMotivoAtraso }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const { MotivoAtraso } = await import('../MotivoAtraso')

const etapa = { ordem: 3, nome: 'Triagem de Candidatos' }
const motivo = { texto: 'Gestor em viagem.', nomeUsuario: 'Bia Lima', em: '2026-10-30T17:20:00Z' }

beforeEach(() => {
  vi.clearAllMocks()
  salvarMotivoAtraso.mockResolvedValue({ ok: true })
})

test('cliente e gestor leem o motivo, sem botão de editar', () => {
  render(<MotivoAtraso vagaId="v1" etapa={etapa} motivo={motivo} podeEditar={false} />)
  expect(screen.getByRole('heading')).toHaveTextContent('Motivo do atraso · etapa Triagem de Candidatos')
  expect(screen.getByText('Gestor em viagem.')).toBeInTheDocument()
  expect(screen.getByText(/Atualizado por Bia Lima em 30\/10\/2026/)).toBeInTheDocument()
  expect(screen.queryByRole('button')).toBeNull()
})

test('sem motivo e sem permissão, não mostra nada', () => {
  const { container } = render(<MotivoAtraso vagaId="v1" etapa={etapa} motivo={null} podeEditar={false} />)
  expect(container).toBeEmptyDOMElement()
})

test('a equipe escreve o motivo da etapa atual', async () => {
  render(<MotivoAtraso vagaId="v1" etapa={etapa} motivo={null} podeEditar />)
  await userEvent.click(screen.getByRole('button', { name: 'Escrever motivo do atraso' }))
  await userEvent.type(screen.getByLabelText('Motivo do atraso'), 'Poucos currículos.')
  await userEvent.click(screen.getByRole('button', { name: 'Salvar motivo' }))
  expect(salvarMotivoAtraso).toHaveBeenCalledWith('v1', 3, 'Poucos currículos.')
})

test('mostra o erro do banco', async () => {
  salvarMotivoAtraso.mockResolvedValue({ ok: false, erro: 'Esta vaga mudou enquanto você olhava. Atualize a página.' })
  render(<MotivoAtraso vagaId="v1" etapa={etapa} motivo={motivo} podeEditar />)
  await userEvent.click(screen.getByRole('button', { name: 'Editar motivo' }))
  await userEvent.click(screen.getByRole('button', { name: 'Salvar motivo' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Esta vaga mudou')
})
