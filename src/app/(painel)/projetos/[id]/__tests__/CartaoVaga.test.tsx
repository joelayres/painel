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
