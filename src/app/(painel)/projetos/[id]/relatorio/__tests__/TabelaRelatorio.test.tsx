import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { LinhaRelatorio, Relatorio } from '@/dominio/relatorio'
import { TabelaRelatorio } from '../TabelaRelatorio'

const linha = (o: Partial<LinhaRelatorio>): LinhaRelatorio => ({
  id: 'v1', nome: 'Vinicius Vieira', vagaAberta: false, tipo: 'MOD', funcao: 'Assistente Técnico', disciplina: 'APOIOS', area: 'Q3',
  onda: 'Onda 1', meta: '2027-01-15', cobrada: true, taxa: 24108.83, etapas: ['2026-10-22', null], mobilizada: false, ...o,
})
const relatorio = (o: Partial<Relatorio> = {}): Relatorio => ({
  etapas: [{ ordem: 1, nome: 'Captura' }, { ordem: 2, nome: 'Entrevistas' }],
  linhas: [
    linha({}),
    linha({ id: 'v2', nome: 'Técnico de Campo', vagaAberta: true, tipo: 'MOI', cobrada: false, taxa: null }),
    linha({ id: 'v3', nome: 'Silvio Rocha', tipo: null, taxa: null }),
  ],
  percentuais: [0.75, 0],
  totalTaxas: 36918.34, totalTaxasMobilizadas: 24108.83, semTarifa: 1, tarifasIndisponiveis: false, ...o,
})
const nbsp = (t: string | null) => (t ?? '').replace(/ /g, ' ')

test('cabeçalho na ordem da planilha', () => {
  const { rerender } = render(<TabelaRelatorio relatorio={relatorio()} porOndas />)
  const cab = () => screen.getAllByRole('columnheader').map((c) => c.textContent)
  expect(cab()).toEqual(['Nome', 'Tipo', 'Função', 'Disciplina', 'Área', 'Onda', 'Taxa', 'Captura', 'Entrevistas'])
  rerender(<TabelaRelatorio relatorio={relatorio()} porOndas={false} />)
  expect(cab()).toContain('Meta')
})

test('OK nas etapas concluídas, com a data no title', () => {
  render(<TabelaRelatorio relatorio={relatorio()} porOndas />)
  const primeira = screen.getAllByRole('row')[1]
  const ok = within(primeira).getByText('OK')
  expect(ok.closest('td')).toHaveAttribute('title', 'Concluída em 22/10/2026')
  expect(within(primeira).getAllByText('OK')).toHaveLength(1)
})

test('taxa em reais, Não cobrada e — sem tarifa', () => {
  render(<TabelaRelatorio relatorio={relatorio()} porOndas />)
  const [, l1, l2, l3] = screen.getAllByRole('row')
  expect(nbsp(l1.textContent)).toContain('R$ 24.108,83')
  expect(l2).toHaveTextContent('Não cobrada')
  expect(l3).toHaveTextContent('—')
})

test('vaga aberta mostra a função em texto suave', () => {
  render(<TabelaRelatorio relatorio={relatorio()} porOndas />)
  expect(within(screen.getAllByRole('row')[2]).getAllByText('Técnico de Campo')[0]).toHaveClass('text-texto-suave')
})

test('rodapé com % por etapa e totais', () => {
  render(<TabelaRelatorio relatorio={relatorio()} porOndas />)
  expect(screen.getByText('75%')).toBeInTheDocument()
  const texto = nbsp(document.body.textContent)
  expect(texto).toContain('Total das taxas: R$ 36.918,34')
  expect(texto).toContain('Mobilizadas: R$ 24.108,83')
  expect(texto).toContain('1 vaga sem tarifa')
})

test('aviso quando o Financeiro está fora', () => {
  render(<TabelaRelatorio relatorio={relatorio({ tarifasIndisponiveis: true })} porOndas />)
  expect(screen.getByText(/Não foi possível ler as tarifas do Financeiro agora/)).toBeInTheDocument()
})

test('sem vagas', () => {
  render(<TabelaRelatorio relatorio={relatorio({ linhas: [], percentuais: [0, 0], totalTaxas: 0, totalTaxasMobilizadas: 0, semTarifa: 0 })} porOndas />)
  expect(screen.getByText('Nenhuma vaga')).toBeInTheDocument()
})
