import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

const cancelarVaga = vi.fn()
vi.mock('@/app/(painel)/vagas/[id]/acoesVaga', () => ({ cancelarVaga, salvarVaga: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const { CadastroVagas } = await import('../Cliente')

const vaga = { id: 'v1', funcao: 'Técnico', disciplina: 'NR-13', area: 'Caldeiraria', onda: 1, ondaId: 'o1', gestor: null, gestorId: null, candidato: null, dataInicio: '2026-10-22', canceladaEm: null }

test('falha ao cancelar a vaga aparece na tela', async () => {
  cancelarVaga.mockResolvedValue({ ok: false, erro: 'Não foi possível salvar. Tente de novo.' })
  render(<CadastroVagas vagas={[vaga]} opcoes={{ ondas: [], gestores: [] }} />)
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar vaga' }))
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar. Tente de novo.')
})

test('cada vaga tem um botão Editar que abre o formulário preenchido', async () => {
  render(<CadastroVagas vagas={[{ ...vaga, candidato: 'Lucas Santos' }]} opcoes={{ ondas: [{ id: 'o1', numero: 1 }], gestores: [{ id: 'g1', nome: 'Ana' }] }} />)
  await userEvent.click(screen.getByRole('button', { name: 'Editar Técnico' }))
  const painel = screen.getByRole('dialog', { name: 'Editar vaga' })
  expect(painel).toBeInTheDocument()
  expect(screen.getByLabelText('Candidato')).toHaveValue('Lucas Santos')
  expect(screen.getByLabelText('Gestor')).toHaveValue('')
})
