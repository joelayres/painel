import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Participacao } from '../dados'

const acoes = vi.hoisted(() => ({
  confirmarClassificacao: vi.fn(async () => ({ ok: true })),
  mudarClassificacao: vi.fn(async () => ({ ok: true })),
  reanalisar: vi.fn(async () => ({ ok: true })),
  definirResultado: vi.fn(async () => ({ ok: true })),
  salvarEntrevista: vi.fn(async () => ({ ok: true })),
  linkCurriculo: vi.fn(async () => ({ ok: true, url: 'x' })),
  levarParaVaga: vi.fn(async () => ({ ok: true })),
  definirIndicacao: vi.fn(async () => ({ ok: true })),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../../acoesSelecao', () => acoes)

import { ListaParticipacoes } from '../ListaParticipacoes'

function part(id: string, nome: string, nota: number, classificacao: Participacao['classificacao']): Participacao {
  return {
    id, situacao: 'analisada', analisando_desde: null, erro: null, classificacao, classificacao_por: null, resultado: 'em_andamento', do_banco: false, indicado_por: null, curriculo_id: `cv-${id}`,
    candidato: { id: `c-${id}`, nome, email: null, telefone: null, cidade: null, uf: null },
    curriculo: { nome_arquivo: 'cv.pdf' },
    analises: [{ id: `a-${id}`, nota, classificacao: 'parcial', modelo: 'claude-sonnet-5-5', criado_em: '2026-11-25T10:00:00Z', descritivo: 'NR-13', resposta: { resumo: `Resumo ${nome}`, requisitos: [], pontosFortes: [], lacunas: [] } }],
    entrevistas: [],
  }
}

const lista = [part('1', 'Maria', 78, 'a_confirmar'), part('2', 'João', 60, 'a_confirmar'), part('3', 'Ana', 90, 'aderente'), part('4', 'Rui', 20, 'nao_aderente')]

beforeEach(() => Object.values(acoes).forEach((f) => f.mockClear()))

test('mostra as contagens nas abas', () => {
  render(<ListaParticipacoes participacoes={lista} vagas={[]} indicadores={['Ivan Braskem']} />)
  expect(screen.getByRole('tab', { name: 'A confirmar (2)' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Aderentes e parciais (1)' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Não aderentes (1)' })).toBeInTheDocument()
})

test('confirma a sugestão da IA das marcadas', async () => {
  render(<ListaParticipacoes participacoes={lista} vagas={[]} indicadores={['Ivan Braskem']} />)
  await userEvent.click(screen.getByRole('checkbox', { name: 'Marcar Maria' }))
  await userEvent.click(screen.getByRole('checkbox', { name: 'Marcar João' }))
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar sugestão da IA' }))
  expect(acoes.confirmarClassificacao).toHaveBeenCalledWith(['1', '2'])
})

test('mudar classificação exige o motivo', async () => {
  render(<ListaParticipacoes participacoes={lista} vagas={[]} indicadores={['Ivan Braskem']} />)
  await userEvent.click(screen.getByRole('button', { name: /Maria/ }))
  const painel = screen.getByRole('dialog')
  await userEvent.selectOptions(within(painel).getByLabelText('Nova classificação'), 'nao_aderente')
  await userEvent.click(within(painel).getByRole('button', { name: 'Mudar classificação' }))
  expect(await within(painel).findByText('Escreva o motivo da mudança.')).toBeInTheDocument()
  expect(acoes.mudarClassificacao).not.toHaveBeenCalled()
})

test('registra quem indicou o candidato', async () => {
  render(<ListaParticipacoes participacoes={lista} vagas={[]} indicadores={['Ivan Braskem']} />)
  await userEvent.click(screen.getByRole('button', { name: /Maria/ }))
  const painel = screen.getByRole('dialog')
  await userEvent.type(within(painel).getByLabelText('Indicado por'), 'Ivan Braskem')
  await userEvent.click(within(painel).getByRole('button', { name: 'Salvar indicação' }))
  expect(acoes.definirIndicacao).toHaveBeenCalledWith('1', 'Ivan Braskem')
})

test('a linha mostra a indicação', () => {
  const indicado = { ...lista[0], indicado_por: 'Ivan Braskem' }
  render(<ListaParticipacoes participacoes={[indicado]} vagas={[]} indicadores={[]} />)
  expect(screen.getByText(/Indicado por Ivan Braskem/)).toBeInTheDocument()
})

test('seleção encerrada não oferece reanalisar', () => {
  render(<ListaParticipacoes participacoes={lista} vagas={[]} indicadores={[]} encerrada />)
  expect(screen.queryByRole('button', { name: 'Reanalisar selecionados' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Confirmar sugestão da IA' })).toBeInTheDocument()
})
