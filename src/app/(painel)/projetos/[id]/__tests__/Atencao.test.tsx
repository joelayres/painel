import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { vagaExemplo } from '@/test/vagas'
import { Atencao } from '../Atencao'

test('lista a vermelha antes da amarela com a etapa parada', () => {
  render(<Atencao vagas={[vagaExemplo('a', { cor: 'amarelo', etapaAtual: 5 }), vagaExemplo('v', { cor: 'vermelho', etapaAtual: 3, dias: 2 })]} />)
  const itens = screen.getAllByRole('listitem')
  expect(itens[0]).toHaveTextContent('parada em Triagem de Candidatos há 2 dias')
  expect(itens[0]).toHaveTextContent('Atrasada')
  expect(itens[1]).toHaveTextContent('Em risco')
})

test('sem nada em atenção mostra que está tudo no prazo', () => {
  render(<Atencao vagas={[vagaExemplo('a', { cor: 'verde', etapaAtual: 5 })]} />)
  expect(screen.getByText('Nenhuma vaga atrasada ou em risco.')).toBeInTheDocument()
})

test('mostra a meta da vaga junto da admissão prevista', () => {
  render(<Atencao vagas={[{ ...vagaExemplo('v', { cor: 'vermelho', etapaAtual: 3 }), meta: '2026-11-18' }]} />)
  expect(screen.getByRole('listitem')).toHaveTextContent('(meta 18/11)')
})
