import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { RegistroGeral } from '../RegistroGeral'

test('mostra quem mudou a duração, quando e de quanto para quanto', () => {
  render(<RegistroGeral itens={[{ id: 'h1', acao: 'Alterou a duração de Treinamento', nome: 'Rafaela', em: '2026-10-27T18:30:00Z', detalhe: { antes: 5, depois: 6 } }]} />)
  const item = screen.getByRole('listitem')
  expect(item).toHaveTextContent('Alterou a duração de Treinamento: de 5 para 6 dias')
  expect(item).toHaveTextContent('Rafaela')
  expect(item).toHaveTextContent('27/10/2026')
})

test('mostra a mudança de prazo de uma onda', () => {
  render(<RegistroGeral itens={[{ id: 'h2', acao: 'Alterou a 1ª Onda', nome: 'Joel', em: '2026-10-27T18:30:00Z', detalhe: { antes: { inicio: '2026-10-22', fim: '2026-11-26' }, depois: { inicio: '2026-10-22', fim: '2026-11-30' } } }]} />)
  expect(screen.getByRole('listitem')).toHaveTextContent('Alterou a 1ª Onda: fim de 26/11/2026 para 30/11/2026')
})

test('sem registros mostra aviso', () => {
  render(<RegistroGeral itens={[]} />)
  expect(screen.getByText('Nenhuma mudança registrada ainda.')).toBeInTheDocument()
})
