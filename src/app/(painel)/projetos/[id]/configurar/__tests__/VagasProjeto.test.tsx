import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

const cancelarVaga = vi.fn()
vi.mock('@/app/(painel)/vagas/[id]/acoesVaga', () => ({ cancelarVaga, salvarVaga: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const { VagasProjeto } = await import('../VagasProjeto')

const vaga = { id: 'v1', funcao: 'Técnico', disciplina: 'NR-13', area: 'Caldeiraria', ondaNome: '1ª Onda', ondaId: 'o1', meta: null, gestor: null, gestorId: null, candidato: null, dataInicio: '2026-10-22', canceladaEm: null }
const opcoes = { ondas: [{ id: 'o1', nome: '1ª Onda' }], gestores: [{ id: 'g1', nome: 'Ana' }] }
const base = { projetoId: 'p1', organizacao: 'ondas' as const, opcoes, somenteLeitura: false }

test('mostra modelo, importação e vaga avulsa ligados ao projeto', () => {
  render(<VagasProjeto {...base} vagas={[]} />)
  expect(screen.getByRole('link', { name: 'Baixar modelo Excel' })).toHaveAttribute('href', '/projetos/p1/modelo')
  expect(screen.getByRole('link', { name: 'Importar planilha' })).toHaveAttribute('href', '/projetos/p1/importar')
  expect(screen.getByRole('button', { name: '+ Vaga avulsa' })).toBeInTheDocument()
})

test('falha ao cancelar a vaga aparece na tela', async () => {
  cancelarVaga.mockResolvedValue({ ok: false, erro: 'Não foi possível salvar. Tente de novo.' })
  render(<VagasProjeto {...base} vagas={[vaga]} />)
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar vaga' }))
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar. Tente de novo.')
})

test('cada vaga tem um botão Editar que abre o formulário preenchido', async () => {
  render(<VagasProjeto {...base} vagas={[{ ...vaga, candidato: 'Lucas Santos' }]} />)
  await userEvent.click(screen.getByRole('button', { name: 'Editar Técnico' }))
  expect(screen.getByRole('dialog', { name: 'Editar vaga' })).toBeInTheDocument()
  expect(screen.getByLabelText('Candidato')).toHaveValue('Lucas Santos')
})

test('as canceladas ficam numa lista à parte', () => {
  render(<VagasProjeto {...base} vagas={[{ ...vaga, canceladaEm: '2026-10-25' }]} />)
  expect(screen.getByText('Vagas canceladas (1)')).toBeInTheDocument()
})

test('somente leitura esconde ações e importação', () => {
  render(<VagasProjeto {...base} somenteLeitura vagas={[vaga]} />)
  expect(screen.queryByRole('button', { name: '+ Vaga avulsa' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Editar Técnico' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Importar planilha' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Baixar modelo Excel' })).toBeInTheDocument()
})
