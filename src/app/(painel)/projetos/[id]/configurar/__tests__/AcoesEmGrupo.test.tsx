import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

const avancarEmGrupo = vi.fn()
const alterarEmGrupo = vi.fn()
const adiarEmGrupo = vi.fn()
vi.mock('../acoesConfigurar', () => ({ avancarEmGrupo, alterarEmGrupo, adiarEmGrupo }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/dominio/tempo', () => ({ hojeSP: () => '2026-10-29' }))
const { AcoesEmGrupo } = await import('../AcoesEmGrupo')

const sel = (id: string, etapaAtual = 2, concluiuAlguma = false) => ({ id, funcao: 'Técnico de Campo', ondaId: 'o1', etapaAtual, concluiuAlguma, cancelada: false })
const base = {
  projetoId: 'p1', organizacao: 'meta' as const, ondas: [{ id: 'o1', nome: '1ª Onda', inicio: '2026-10-22' }, { id: 'o2', nome: '2ª Onda', inicio: '2026-11-16' }],
  etapas: [{ ordem: 2, nome: 'Captura de Mercado' }], rotuloDe: (id: string) => `Técnico de Campo ${id}`, aoTerminar: vi.fn(),
}

beforeEach(() => vi.clearAllMocks())

test('avançar conclui a etapa comum na data escolhida', async () => {
  avancarEmGrupo.mockResolvedValue({ ok: true, alteradas: 2, puladas: 0, foraDaMeta: 0 })
  render(<AcoesEmGrupo {...base} selecionadas={[sel('v1'), sel('v2')]} />)
  await userEvent.click(screen.getByRole('button', { name: 'Avançar etapa' }))
  expect(screen.getByText('Concluir Captura de Mercado em 2 vagas')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Concluir' }))
  expect(avancarEmGrupo).toHaveBeenCalledWith('p1', ['v1', 'v2'], 2, '2026-10-29')
  expect(await screen.findByRole('status')).toHaveTextContent('2 vagas alteradas.')
})

test('em projeto por ondas a ação é trocar onda', () => {
  render(<AcoesEmGrupo {...base} organizacao="ondas" selecionadas={[sel('v1')]} />)
  expect(screen.getByRole('button', { name: 'Trocar onda' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Trocar meta' })).toBeNull()
  expect(screen.getByText('1 vaga selecionada')).toBeInTheDocument()
})

test('trocar início avisa quem fica de fora e mostra o resultado', async () => {
  alterarEmGrupo.mockResolvedValue({ ok: true, alteradas: 1, puladas: 1, foraDaMeta: 1 })
  render(<AcoesEmGrupo {...base} selecionadas={[sel('v1', 2, true), sel('v2', 1, false)]} />)
  await userEvent.click(screen.getByRole('button', { name: 'Trocar início' }))
  expect(screen.getByText('1 das vagas selecionadas já passou da primeira etapa e fica de fora.')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Novo início'), '2026-11-03')
  await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
  expect(alterarEmGrupo).toHaveBeenCalledWith('p1', ['v1', 'v2'], 'data_inicio', '2026-11-03')
  expect(await screen.findByRole('status')).toHaveTextContent('1 vaga alterada. 1 ficou de fora. 1 ficou com a admissão prevista depois da meta.')
})

test('erro de uma vaga mostra qual vaga travou', async () => {
  avancarEmGrupo.mockResolvedValue({ ok: false, vagaId: 'v2', erro: 'A data não pode ser no futuro.' })
  render(<AcoesEmGrupo {...base} selecionadas={[sel('v1'), sel('v2')]} />)
  await userEvent.click(screen.getByRole('button', { name: 'Avançar etapa' }))
  await userEvent.click(screen.getByRole('button', { name: 'Concluir' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Técnico de Campo v2: A data não pode ser no futuro.')
})

test('adiar já vem com o início da onda das vagas e adia na data escolhida', async () => {
  adiarEmGrupo.mockResolvedValue({ ok: true, alteradas: 2, puladas: 0, foraDaMeta: 0 })
  const daOnda2 = (id: string) => ({ ...sel(id), ondaId: 'o2' })
  render(<AcoesEmGrupo {...base} organizacao="ondas" selecionadas={[daOnda2('v1'), daOnda2('v2')]} />)
  await userEvent.click(screen.getByRole('button', { name: 'Adiar próxima etapa' }))
  const campo = screen.getByLabelText('Começa em')
  expect(campo).toHaveValue('2026-11-16')
  await userEvent.clear(campo)
  await userEvent.type(campo, '2026-11-23')
  await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
  expect(adiarEmGrupo).toHaveBeenCalledWith('p1', ['v1', 'v2'], '2026-11-23')
  expect(await screen.findByRole('status')).toHaveTextContent('2 vagas alteradas.')
})

test('adiar vagas de ondas diferentes deixa a data em branco', async () => {
  render(<AcoesEmGrupo {...base} organizacao="ondas" selecionadas={[sel('v1'), { ...sel('v2'), ondaId: 'o2' }]} />)
  await userEvent.click(screen.getByRole('button', { name: 'Adiar próxima etapa' }))
  expect(screen.getByLabelText('Começa em')).toHaveValue('')
})
