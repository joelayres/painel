import ExcelJS from 'exceljs'
import { expect, test } from 'vitest'
import type { LinhaRelatorio, Relatorio } from '@/dominio/relatorio'
import { gerarExcelRelatorio } from '../excel'

const linha = (o: Partial<LinhaRelatorio>): LinhaRelatorio => ({
  id: 'v1', nome: 'Vinicius Vieira', vagaAberta: false, tipo: 'MOD', funcao: 'Assistente Técnico', disciplina: 'APOIOS', area: 'Q3',
  onda: 'Onda 1', meta: '2027-01-15', cobrada: true, taxa: 24108.83, etapas: ['2026-10-22', null], mobilizada: false, ...o,
})
const relatorio = (o: Partial<Relatorio> = {}): Relatorio => ({
  opcoes: { funcoes: [], disciplinas: [], areas: [] },
  etapas: [{ ordem: 1, nome: 'Captura' }, { ordem: 2, nome: 'Entrevistas' }],
  linhas: [linha({}), linha({ id: 'v2', tipo: 'MOI', cobrada: false, taxa: null }), linha({ id: 'v3', tipo: null, taxa: null })],
  percentuais: [0.75, 0], totalTaxas: 36918.34, totalTaxasMobilizadas: 24108.83, semTarifa: 1, tarifasIndisponiveis: false, ...o,
})
async function abrir(r: Relatorio, onda: string | null = null) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await gerarExcelRelatorio({ relatorio: r, projeto: 'Mobilização 2027', onda, porOndas: true, hoje: '2026-11-17' }) as never)
  return wb.getWorksheet('Relatório')!
}
const rotulos = (ws: ExcelJS.Worksheet) => {
  const m = new Map<string, number>()
  ws.eachRow((row, n) => { const v = row.getCell(1).value; if (typeof v === 'string') m.set(v, n) })
  return m
}

test('aba Relatório com título, data e cabeçalho na linha 4', async () => {
  const ws = await abrir(relatorio(), 'Onda 1')
  expect(ws.getCell('A1').value).toBe('Mobilização 2027 · Relatório de mobilização')
  expect(ws.getCell('A2').value).toBe('Gerado em 17/11/2026 · Onda 1')
  expect((ws.getRow(4).values as unknown[]).slice(1)).toEqual(['Nome', 'Tipo', 'Função', 'Disciplina', 'Área', 'Onda', 'Taxa', 'Captura', 'Entrevistas'])
  expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 4 })
})

test('OK nas etapas concluídas e taxa como número em moeda', async () => {
  const ws = await abrir(relatorio())
  expect(ws.getCell('H5').value).toBe('OK')
  expect(ws.getCell('I5').value).toBeNull()
  expect(ws.getCell('G5').value).toBe(24108.83)
  expect(ws.getCell('G5').numFmt).toContain('R$')
  expect(ws.getCell('G6').value).toBe('Não cobrada')
  expect(ws.getCell('G7').value).toBeNull()
  expect(ws.getCell('B7').value).toBe('—')
})

test('rodapé com % por etapa e totais', async () => {
  const ws = await abrir(relatorio())
  const r = rotulos(ws)
  const pct = ws.getRow(r.get('% concluído')!)
  expect(pct.getCell(8).value).toBe(0.75)
  expect(pct.getCell(8).numFmt).toBe('0%')
  expect(ws.getRow(r.get('Total das taxas')!).getCell(7).value).toBe(36918.34)
  expect(ws.getRow(r.get('Total das taxas (mobilizadas)')!).getCell(7).value).toBe(24108.83)
  expect(ws.getRow(r.get('Vagas sem tarifa')!).getCell(7).value).toBe(1)
})

test('Financeiro indisponível: linha de aviso', async () => {
  const ws = await abrir(relatorio({ tarifasIndisponiveis: true }))
  expect(String(ws.getCell('A3').value)).toContain('Tarifas indisponíveis')
})
