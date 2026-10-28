import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

const cancelarVaga = vi.fn()
vi.mock('@/app/(painel)/vagas/[id]/acoesVaga', () => ({ cancelarVaga, salvarVaga: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const { CadastroVagas } = await import('../Cliente')

const vaga = { id: 'v1', funcao: 'Técnico', disciplina: 'NR-13', area: 'Caldeiraria', onda: 1, gestor: null, candidato: null, dataInicio: '2026-10-22', canceladaEm: null }

test('falha ao cancelar a vaga aparece na tela', async () => {
  cancelarVaga.mockResolvedValue({ ok: false, erro: 'Não foi possível salvar. Tente de novo.' })
  render(<CadastroVagas vagas={[vaga]} opcoes={{ ondas: [], gestores: [] }} />)
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar vaga' }))
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar. Tente de novo.')
})
