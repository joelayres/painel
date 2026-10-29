import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { HistoricoVaga, type EntradaHistorico } from '../HistoricoVaga'

const entrada = (id: string, acao: string, detalhe: EntradaHistorico['detalhe']): EntradaHistorico => ({
  id, acao, detalhe, nome_usuario: 'Ana', em: '2026-10-28T15:00:00Z',
})

test('mostra a data de conclusão das etapas excluídas, das automáticas e das desfeitas', () => {
  render(
    <HistoricoVaga
      historico={[
        entrada('1', 'Etapa Cadastro excluída', { concluida_em: '2026-10-05' }),
        entrada('2', 'Etapa Cadastro incluída e marcada como concluída', { data: '2026-10-06' }),
        entrada('3', 'Concluiu Triagem', { ordem: 3, data: '2026-10-07' }),
        entrada('4', 'Desfez Triagem', { ordem: 3, concluida_em: '2026-10-08' }),
      ]}
    />,
  )
  const itens = screen.getAllByRole('listitem').map((l) => l.textContent)
  expect(itens[0]).toContain('Etapa Cadastro excluída · concluída em 05/10/2026 · Ana')
  expect(itens[1]).toContain('marcada como concluída · concluída em 06/10/2026')
  expect(itens[2]).toContain('Concluiu Triagem · concluída em 07/10/2026')
  expect(itens[3]).toContain('Desfez Triagem · concluída em 08/10/2026')
})

test('sem data no detalhe, só ação e nome; sem registros, avisa', () => {
  const { rerender } = render(<HistoricoVaga historico={[entrada('1', 'Cancelou a vaga', null)]} />)
  expect(screen.getByRole('listitem').textContent).not.toContain('concluída em')
  rerender(<HistoricoVaga historico={[]} />)
  expect(screen.getByText('Nada registrado ainda.')).toBeInTheDocument()
})
