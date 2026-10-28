import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ETAPAS_PADRAO } from '@/dominio/etapas'
import { vagaExemplo } from '@/test/vagas'
import { Quadro } from '../Quadro'

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
