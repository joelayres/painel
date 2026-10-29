import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

const cancelarVaga = vi.fn()
vi.mock('@/app/(painel)/vagas/[id]/acoesVaga', () => ({ cancelarVaga, salvarVaga: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const avancarEmGrupo = vi.fn()
vi.mock('../acoesConfigurar', () => ({ avancarEmGrupo, alterarEmGrupo: vi.fn() }))
const { VagasProjeto } = await import('../VagasProjeto')

const vaga = { id: 'v1', funcao: 'Técnico', disciplina: 'NR-13', area: 'Caldeiraria', ondaNome: '1ª Onda', ondaId: 'o1', meta: null, gestor: null, gestorId: null, candidato: null, dataInicio: '2026-10-22', canceladaEm: null, etapaAtual: 2, etapaNome: 'Captura de Mercado', concluiuAlguma: true }
const opcoes = { ondas: [{ id: 'o1', nome: '1ª Onda' }], gestores: [{ id: 'g1', nome: 'Ana' }] }
const etapas = [{ ordem: 1, nome: 'Abertura de vaga' }, { ordem: 2, nome: 'Captura de Mercado' }, { ordem: 3, nome: 'Triagem de Candidatos' }]
const base = { projetoId: 'p1', organizacao: 'ondas' as const, opcoes, somenteLeitura: false, etapas }

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

const grupo = [
  { ...vaga, id: 'v1', funcao: 'Técnico de Campo', disciplina: 'Fornos' },
  { ...vaga, id: 'v2', funcao: 'Técnico de Campo', disciplina: 'NR-13' },
  { ...vaga, id: 'v3', funcao: 'Eletricista', disciplina: 'Elétrica', etapaAtual: 3, etapaNome: 'Triagem de Candidatos' },
  { ...vaga, id: 'v4', funcao: 'Técnico de Campo', disciplina: 'GE-902', etapaAtual: null, etapaNome: null },
]

test('selecionar todas do filtro marca só as vagas do filtro, fora as mobilizadas', async () => {
  render(<VagasProjeto {...base} vagas={grupo} />)
  await userEvent.selectOptions(screen.getByLabelText('Filtrar por função'), 'Técnico de Campo')
  await userEvent.click(screen.getByRole('button', { name: 'Selecionar todas (2)' }))
  expect(screen.getByText('2 vagas selecionadas')).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Selecionar Técnico de Campo · Fornos' })).toBeChecked()
  expect(screen.queryByRole('checkbox', { name: 'Selecionar Técnico de Campo · GE-902' })).toBeNull()
})

test('vagas em etapas diferentes não avançam juntas', async () => {
  render(<VagasProjeto {...base} vagas={grupo} />)
  await userEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Técnico de Campo · Fornos' }))
  await userEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Eletricista · Elétrica' }))
  expect(screen.getByRole('button', { name: 'Avançar etapa' })).toBeDisabled()
  expect(screen.getByText('Para avançar juntas, as vagas precisam estar na mesma etapa.')).toBeInTheDocument()
})

test('com o projeto encerrado não há seleção', () => {
  render(<VagasProjeto {...base} somenteLeitura vagas={grupo} />)
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
})
