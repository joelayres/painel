import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

const salvarVaga = vi.fn()
const refresh = vi.fn()
vi.mock('@/app/(painel)/vagas/[id]/acoesVaga', () => ({ salvarVaga: (...a: unknown[]) => salvarVaga(...a) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
const { FormVaga } = await import('../FormVaga')

const opcoes = { ondas: [{ id: 'o1', nome: '1ª Onda' }], gestores: [{ id: 'g1', nome: 'Ana Souza' }] }

beforeEach(() => vi.clearAllMocks())

test('projeto por meta pede a meta e não a onda', async () => {
  render(<FormVaga vaga={null} opcoes={opcoes} rotuloBotao="Nova vaga" organizacao="meta" projetoId="p1" />)
  await userEvent.click(screen.getByRole('button', { name: 'Nova vaga' }))
  expect(screen.getByLabelText('Meta (data pedida pelo cliente)')).toBeInTheDocument()
  expect(screen.queryByLabelText('Onda')).not.toBeInTheDocument()
})

test('projeto por ondas pede a onda e não a meta', async () => {
  render(<FormVaga vaga={null} opcoes={opcoes} rotuloBotao="Nova vaga" organizacao="ondas" projetoId="p1" />)
  await userEvent.click(screen.getByRole('button', { name: 'Nova vaga' }))
  expect(screen.getByLabelText('Onda')).toBeInTheDocument()
  expect(screen.queryByLabelText(/Meta/)).not.toBeInTheDocument()
})

test('com aviso depois de salvar, o painel continua aberto até "Entendi"', async () => {
  salvarVaga.mockResolvedValue({ ok: true, id: 'v1', aviso: 'Pelas etapas, a admissão sai em 25/11 e a meta é 18/11.' })
  render(<FormVaga vaga={null} opcoes={opcoes} rotuloBotao="Nova vaga" organizacao="meta" projetoId="p1" />)
  await userEvent.click(screen.getByRole('button', { name: 'Nova vaga' }))
  await userEvent.type(screen.getByLabelText('Função'), 'Técnico')
  await userEvent.type(screen.getByLabelText('Meta (data pedida pelo cliente)'), '2026-11-18')
  await userEvent.type(screen.getByLabelText('Início do processo'), '2026-10-22')
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
  expect(await screen.findByRole('status')).toHaveTextContent('a meta é 18/11')
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(salvarVaga).toHaveBeenCalledWith(null, expect.objectContaining({ projetoId: 'p1', meta: '2026-11-18' }))
  await userEvent.click(screen.getByRole('button', { name: 'Entendi' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('sem aviso, o painel fecha ao salvar', async () => {
  salvarVaga.mockResolvedValue({ ok: true, id: 'v1', aviso: null })
  render(<FormVaga vaga={null} opcoes={opcoes} rotuloBotao="Nova vaga" organizacao="meta" projetoId="p1" />)
  await userEvent.click(screen.getByRole('button', { name: 'Nova vaga' }))
  await userEvent.type(screen.getByLabelText('Função'), 'Técnico')
  await userEvent.type(screen.getByLabelText('Meta (data pedida pelo cliente)'), '2026-11-18')
  await userEvent.type(screen.getByLabelText('Início do processo'), '2026-10-22')
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
  await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
