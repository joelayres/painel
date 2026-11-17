import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { vagaExemplo } from '@/test/vagas'
import { CartaoVaga } from '../CartaoVaga'

test('o cartão mostra o motivo do atraso', () => {
  render(<CartaoVaga vaga={vagaExemplo('v', { cor: 'vermelho', etapaAtual: 3, motivo: 'Candidato remarcou a entrevista.' })} />)
  expect(screen.getByRole('link')).toHaveTextContent('Motivo do atraso: Candidato remarcou a entrevista.')
})

test('sem motivo, o cartão fica como antes', () => {
  render(<CartaoVaga vaga={vagaExemplo('v', { cor: 'vermelho', etapaAtual: 3 })} />)
  expect(screen.getByRole('link')).not.toHaveTextContent('Motivo')
})

test('etapa adiada mostra quando começa no lugar dos dias parados', () => {
  render(<CartaoVaga vaga={vagaExemplo('v', { cor: 'verde', etapaAtual: 2, comecaEm: '2026-11-16' })} />)
  expect(screen.getByRole('link')).toHaveTextContent('Etapa começa em 16/11')
  expect(screen.getByRole('link')).not.toHaveTextContent('nesta etapa')
})

test('mostra a folga até a meta e o atraso da etapa', () => {
  render(<CartaoVaga vaga={vagaExemplo('v', { cor: 'amarelo', etapaAtual: 3, folga: 6, etapaAtrasada: 2 })} />)
  expect(screen.getByRole('link')).toHaveTextContent('6 dias úteis de folga · etapa 2 dias úteis além do prazo')
})

test('além da meta e sem folga', () => {
  const { unmount } = render(<CartaoVaga vaga={vagaExemplo('v', { cor: 'vermelho', etapaAtual: 3, folga: -1 })} />)
  expect(screen.getByRole('link')).toHaveTextContent('1 dia útil além da meta')
  unmount()
  render(<CartaoVaga vaga={vagaExemplo('v', { cor: 'amarelo', etapaAtual: 3, folga: 0 })} />)
  expect(screen.getByRole('link')).toHaveTextContent('Sem folga')
})
