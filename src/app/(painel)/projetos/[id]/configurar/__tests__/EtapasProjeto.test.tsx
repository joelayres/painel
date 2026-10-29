import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

const acoes = {
  incluirEtapa: vi.fn(),
  excluirEtapa: vi.fn(),
  renomearEtapa: vi.fn(),
  moverEtapa: vi.fn(),
  alterarDuracaoEtapa: vi.fn(),
}
vi.mock('../acoesConfigurar', () => acoes)
const acoesCliente = vi.hoisted(() => ({
  incluirEtapaCliente: vi.fn(),
  excluirEtapaCliente: vi.fn(),
  renomearEtapaCliente: vi.fn(),
  moverEtapaCliente: vi.fn(),
  alterarDuracaoEtapaCliente: vi.fn(),
}))
vi.mock('@/app/(painel)/cadastros/clientes/[id]/acoesEtapasCliente', () => acoesCliente)
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const { EtapasProjeto } = await import('../EtapasProjeto')

const etapas = [
  { id: 'e1', ordem: 1, nome: 'Abertura de vaga', fixa: null, padraoCliente: 1, duracao: null, concluidasPor: 0, chegaramAoPonto: 0 },
  { id: 'e2', ordem: 2, nome: 'Captura de Mercado', fixa: 'captura' as const, padraoCliente: 4, duracao: null, concluidasPor: 0, chegaramAoPonto: 0 },
  { id: 'e3', ordem: 3, nome: 'Triagem de Candidatos', fixa: null, padraoCliente: 1, duracao: null, concluidasPor: 0, chegaramAoPonto: 0 },
  { id: 'e4', ordem: 4, nome: 'Ambientação/TBS', fixa: null, padraoCliente: 1, duracao: null, concluidasPor: 0, chegaramAoPonto: 2 },
  { id: 'e5', ordem: 5, nome: 'Exames', fixa: null, padraoCliente: 3, duracao: 5, concluidasPor: 0, chegaramAoPonto: 0 },
  { id: 'e6', ordem: 6, nome: 'Treinamento', fixa: null, padraoCliente: 5, duracao: null, concluidasPor: 3, chegaramAoPonto: 3 },
  { id: 'e7', ordem: 7, nome: 'Cadastro extra', fixa: null, padraoCliente: null, duracao: 2, concluidasPor: 0, chegaramAoPonto: 0 },
]
const props = { alvo: { tipo: 'projeto' as const, id: 'p1' }, cliente: 'Acme', etapas, temVagas: false, totalVagas: 0, somenteLeitura: false }

beforeEach(() => Object.values(acoes).forEach((f) => f.mockReset().mockResolvedValue({ ok: true })))

test('as fixas mostram "obrigatória" e não têm Excluir nem Renomear', () => {
  render(<EtapasProjeto {...props} />)
  expect(screen.getByRole('heading', { name: 'Etapas' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Padrão Acme' })).toBeInTheDocument()
  const linha = screen.getByText('2. Captura de Mercado').closest('tr')!
  expect(within(linha).getByText('obrigatória')).toBeInTheDocument()
  expect(within(linha).queryByRole('button', { name: /Excluir|Renomear/ })).not.toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /^Excluir / })).toHaveLength(6)
})

test('excluir pede confirmação na linha e chama a ação', async () => {
  render(<EtapasProjeto {...props} />)
  await userEvent.click(screen.getByRole('button', { name: 'Excluir Treinamento' }))
  expect(screen.getByText(/3 vagas já concluíram esta etapa/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Excluir etapa' }))
  expect(acoes.excluirEtapa).toHaveBeenCalledWith('p1', 'e6')
})

test('cancelar a exclusão fecha a confirmação', async () => {
  render(<EtapasProjeto {...props} />)
  await userEvent.click(screen.getByRole('button', { name: 'Excluir Treinamento' }))
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(screen.queryByRole('button', { name: 'Excluir etapa' })).not.toBeInTheDocument()
  expect(acoes.excluirEtapa).not.toHaveBeenCalled()
})

test('com vagas não há Subir nem Descer; sem vagas, Descer move uma posição', async () => {
  const { unmount } = render(<EtapasProjeto {...props} temVagas />)
  expect(screen.queryByRole('button', { name: /Subir|Descer/ })).not.toBeInTheDocument()
  unmount()
  render(<EtapasProjeto {...props} />)
  await userEvent.click(screen.getByRole('button', { name: 'Descer Triagem de Candidatos' }))
  expect(acoes.moverEtapa).toHaveBeenCalledWith('p1', 'e3', 4)
  await userEvent.click(screen.getByRole('button', { name: 'Subir Triagem de Candidatos' }))
  expect(acoes.moverEtapa).toHaveBeenCalledWith('p1', 'e3', 2)
})

test('incluir depois de uma etapa avisa as vagas que já passaram e envia', async () => {
  render(<EtapasProjeto {...props} temVagas />)
  await userEvent.click(screen.getByRole('button', { name: '+ Incluir etapa' }))
  await userEvent.type(screen.getByLabelText('Nome'), 'Cadastro no eSocial')
  await userEvent.type(screen.getByLabelText('Duração (dias úteis)'), '2')
  await userEvent.selectOptions(screen.getByLabelText('Depois de'), 'e4')
  expect(screen.getByText('2 vagas já passaram deste ponto e vão ficar com a etapa concluída automaticamente.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Incluir' }))
  expect(acoes.incluirEtapa).toHaveBeenCalledWith('p1', { nome: 'Cadastro no eSocial', duracao: '2', depoisDe: 'e4' })
})

test('voltar ao padrão só aparece na etapa padrão ajustada', async () => {
  render(<EtapasProjeto {...props} />)
  expect(screen.getAllByRole('button', { name: /Voltar ao padrão/ })).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: 'Voltar ao padrão Exames' }))
  expect(acoes.alterarDuracaoEtapa).toHaveBeenCalledWith('p1', 'e5', { duracao: '' })
})

test('salvar envia os dias digitados', async () => {
  render(<EtapasProjeto {...props} />)
  await userEvent.type(screen.getByLabelText('Duração de Abertura de vaga neste projeto'), '4')
  await userEvent.click(screen.getByRole('button', { name: 'Salvar Abertura de vaga' }))
  expect(acoes.alterarDuracaoEtapa).toHaveBeenCalledWith('p1', 'e1', { duracao: '4' })
})

test('renomear envia o novo nome', async () => {
  render(<EtapasProjeto {...props} />)
  await userEvent.click(screen.getByRole('button', { name: 'Renomear Exames' }))
  const campo = screen.getByLabelText('Novo nome de Exames')
  await userEvent.clear(campo)
  await userEvent.type(campo, 'Exames médicos')
  await userEvent.click(screen.getByRole('button', { name: 'Salvar nome de Exames' }))
  expect(acoes.renomearEtapa).toHaveBeenCalledWith('p1', 'e5', { nome: 'Exames médicos' })
})

test('somente leitura mostra só a tabela', () => {
  render(<EtapasProjeto {...props} somenteLeitura />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  expect(screen.getByText('1. Abertura de vaga')).toBeInTheDocument()
})

test('incluir no início avisa com o total de vagas, no singular quando é uma', async () => {
  const { unmount } = render(<EtapasProjeto {...props} temVagas totalVagas={3} />)
  await userEvent.click(screen.getByRole('button', { name: '+ Incluir etapa' }))
  expect(screen.getByText('3 vagas já passaram deste ponto e vão ficar com a etapa concluída automaticamente.')).toBeInTheDocument()
  unmount()
  render(<EtapasProjeto {...props} temVagas totalVagas={1} />)
  await userEvent.click(screen.getByRole('button', { name: '+ Incluir etapa' }))
  expect(screen.getByText('1 vaga já passou deste ponto e vai ficar com a etapa concluída automaticamente.')).toBeInTheDocument()
})

test('a confirmação de exclusão usa o singular para uma vaga', async () => {
  render(<EtapasProjeto {...props} etapas={etapas.map((e) => (e.id === 'e6' ? { ...e, concluidasPor: 1 } : e))} />)
  await userEvent.click(screen.getByRole('button', { name: 'Excluir Treinamento' }))
  expect(screen.getByText(/1 vaga já concluiu esta etapa; essa data fica no histórico da vaga\./)).toBeInTheDocument()
})


test('no cliente não há coluna de padrão e as ações são as do cliente', async () => {
  acoesCliente.alterarDuracaoEtapaCliente.mockResolvedValue({ ok: true })
  acoesCliente.moverEtapaCliente.mockResolvedValue({ ok: true })
  const doCliente = etapas.map((e) => ({ ...e, padraoCliente: null, duracao: e.padraoCliente }))
  render(<EtapasProjeto alvo={{ tipo: 'cliente', id: 'c1' }} cliente="Braskem" etapas={doCliente} temVagas={false} totalVagas={0} somenteLeitura={false} />)
  expect(screen.queryByText('Padrão Braskem')).toBeNull()
  expect(screen.getByText('Duração')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Voltar ao padrão/ })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Descer Abertura de vaga' }))
  expect(acoesCliente.moverEtapaCliente).toHaveBeenCalledWith('c1', 'e1', 2)
  expect(acoes.moverEtapa).not.toHaveBeenCalled()
})
