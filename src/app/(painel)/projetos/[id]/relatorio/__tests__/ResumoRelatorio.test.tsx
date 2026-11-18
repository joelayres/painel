import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { LinhaRelatorio, Relatorio } from '@/dominio/relatorio'
import { ResumoRelatorio } from '../ResumoRelatorio'

const linha = (o: Partial<LinhaRelatorio>): LinhaRelatorio => ({
  id: 'v1', nome: 'Vinicius Vieira', vagaAberta: false, tipo: 'MOD', funcao: 'Assistente Técnico', disciplina: 'APOIOS', area: 'Q3',
  onda: 'Onda 1', meta: '2027-01-15', cobrada: true, taxa: 24108.83, etapas: ['2026-10-22', null], mobilizada: false, ...o,
})
const relatorio = (o: Partial<Relatorio> = {}): Relatorio => ({
  opcoes: { funcoes: [], disciplinas: [], areas: [] },
  etapas: [{ ordem: 1, nome: 'Captura' }, { ordem: 2, nome: 'Entrevistas' }],
  linhas: [linha({}), linha({ id: 'v2', etapas: ['2026-10-22', '2026-10-23'], mobilizada: true }), linha({ id: 'v3', etapas: ['2026-10-22', null] }), linha({ id: 'v4', etapas: [null, null] })],
  percentuais: [0.75, 0.25], totalTaxas: 36918.34, totalTaxasMobilizadas: 24108.83, semTarifa: 1, tarifasIndisponiveis: false, ...o,
})
const texto = () => (document.body.textContent ?? '').replace(/ /g, ' ')

test('números do projeto: vagas, mobilizadas e taxas', () => {
  render(<ResumoRelatorio relatorio={relatorio()} />)
  expect(texto()).toContain('4 vagas')
  expect(texto()).toContain('1 mobilizada')
  expect(texto()).toContain('Taxa total')
  expect(texto()).toContain('R$ 36.918,34')
  expect(texto()).toContain('Taxa das mobilizadas')
  expect(texto()).toContain('R$ 24.108,83')
  expect(texto()).toContain('1 vaga sem tarifa no Financeiro')
})

test('funil: uma etapa por item, na ordem, com % e quantas vagas concluíram', () => {
  render(<ResumoRelatorio relatorio={relatorio()} />)
  const itens = within(screen.getByRole('list', { name: 'Andamento por etapa' })).getAllByRole('listitem')
  expect(itens.map((i) => i.querySelector('h3')?.textContent)).toEqual(['Captura', 'Entrevistas'])
  expect(itens[0]).toHaveTextContent('75%')
  expect(itens[0]).toHaveTextContent('3 de 4 vagas')
  expect(itens[1]).toHaveTextContent('25%')
  expect(within(itens[0]).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75')
})

test('Financeiro fora: aviso e taxas como —', () => {
  render(<ResumoRelatorio relatorio={relatorio({ tarifasIndisponiveis: true, totalTaxas: 0, totalTaxasMobilizadas: 0 })} />)
  expect(screen.getByRole('status')).toHaveTextContent('Não foi possível ler as tarifas do Financeiro agora')
  expect(texto()).not.toContain('sem tarifa')
})

test('sem vagas: funil zerado sem erro', () => {
  render(<ResumoRelatorio relatorio={relatorio({ linhas: [], percentuais: [0, 0], totalTaxas: 0, totalTaxasMobilizadas: 0, semTarifa: 0 })} />)
  expect(texto()).toContain('0 vagas')
  expect(texto()).toContain('0 de 0 vagas')
})
