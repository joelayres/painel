import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { ETAPAS_PADRAO } from '@/dominio/etapas'
import { vagaExemplo } from '@/test/vagas'
import { Quadro } from '../Quadro'

vi.mock('@/app/(painel)/vagas/[id]/acoesVaga', () => ({ concluirEtapas: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

function simularPonteiro(fino: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: fino && q.includes('fine'), media: q, addEventListener: () => {}, removeEventListener: () => {} }))
}

beforeEach(() => simularPonteiro(true))

test('mostra as 13 etapas com contagem e a coluna de mobilizadas', () => {
  const vagas = [
    vagaExemplo('a', { cor: 'verde', etapaAtual: 2, candidato: 'Lucas Santos' }),
    vagaExemplo('b', { cor: 'vermelho', etapaAtual: 2 }),
    vagaExemplo('c', { cor: null, etapaAtual: null }),
  ]
  render(<Quadro vagas={vagas} etapas={ETAPAS_PADRAO} />)
  const colunas = screen.getAllByRole('region')
  expect(colunas).toHaveLength(14)
  expect(screen.getByRole('region', { name: 'Captura de Mercado (2)' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Treinamento (0)' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Mobilizadas (1)' })).toBeInTheDocument()
  const captura = screen.getByRole('region', { name: 'Captura de Mercado (2)' })
  const cartao = within(captura).getByRole('link', { name: /Lucas Santos/ })
  expect(cartao).toHaveAttribute('href', '/vagas/a')
  expect(cartao).toHaveTextContent('Ana Souza')
  expect(cartao).toHaveTextContent('Admissão prevista 19/11')
})

const vagasArraste = () => [vagaExemplo('a', { cor: 'verde', etapaAtual: 4, candidato: 'Lucas Santos' })]

test('sem podeArrastar, nenhum cartão é arrastável', () => {
  render(<Quadro vagas={vagasArraste()} etapas={ETAPAS_PADRAO} podeArrastar={false} />)
  for (const l of screen.getAllByRole('link')) expect(l).not.toHaveAttribute('draggable', 'true')
})

test('sem ponteiro fino, nada é arrastável', () => {
  simularPonteiro(false)
  render(<Quadro vagas={vagasArraste()} etapas={ETAPAS_PADRAO} podeArrastar />)
  expect(screen.getByRole('link', { name: /Lucas Santos/ })).not.toHaveAttribute('draggable', 'true')
})

test('soltar na coluna 6 abre a confirmação com as duas etapas', () => {
  render(<Quadro vagas={vagasArraste()} etapas={ETAPAS_PADRAO} podeArrastar />)
  const cartao = screen.getByRole('link', { name: /Lucas Santos/ })
  expect(cartao).toHaveAttribute('draggable', 'true')
  fireEvent.dragStart(cartao)
  fireEvent.dragOver(screen.getByRole('region', { name: 'Envio para contratação (0)' }))
  fireEvent.drop(screen.getByRole('region', { name: 'Envio para contratação (0)' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('Concluir 2 etapas: Entrevista - Timenow e Entrevista - TNGO/Braskem')
})

test('soltar na própria coluna ou numa anterior não abre nada', () => {
  render(<Quadro vagas={vagasArraste()} etapas={ETAPAS_PADRAO} podeArrastar />)
  const cartao = screen.getByRole('link', { name: /Lucas Santos/ })
  fireEvent.dragStart(cartao)
  fireEvent.drop(screen.getByRole('region', { name: 'Entrevista - Timenow (1)' }))
  fireEvent.drop(screen.getByRole('region', { name: 'Treinamento (0)' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('soltar em Mobilizadas conclui tudo o que falta', () => {
  render(<Quadro vagas={vagasArraste()} etapas={ETAPAS_PADRAO} podeArrastar />)
  fireEvent.dragStart(screen.getByRole('link', { name: /Lucas Santos/ }))
  fireEvent.drop(screen.getByRole('region', { name: 'Mobilizadas (0)' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('Concluir 10 etapas')
})
