// @vitest-environment node
import ExcelJS from 'exceljs'
import { expect, test } from 'vitest'
import { gerarExcelSelecao } from '../excel'

test('título, cabeçalho e uma linha por candidato', async () => {
  const arquivo = await gerarExcelSelecao({
    projeto: 'Parada 2027',
    funcao: 'Caldeireiro',
    hoje: '2026-11-25',
    linhas: [
      { nome: 'Ana', email: 'ana@x.com', telefone: null, nota: 92, classificacao: 'Aderente', resumo: 'NR-13', entrevistas: 'Entrevista Timenow: Recomendado', resultado: 'Em andamento' },
      { nome: 'Rui', email: null, telefone: '71999990000', nota: 70, classificacao: 'Parcialmente aderente', resumo: 'falta curso', entrevistas: '', resultado: 'Reprovado' },
    ],
  })
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(new Uint8Array(arquivo).buffer)
  const ws = wb.worksheets[0]
  expect(ws.getCell('A1').value).toBe('Parada 2027 · Seleção Caldeireiro')
  expect((ws.getRow(3).values as unknown[]).slice(1)).toEqual(['Nome', 'E-mail', 'Telefone', 'Nota', 'Classificação', 'Resumo', 'Entrevistas', 'Resultado'])
  expect(ws.getCell('A4').value).toBe('Ana')
  expect(ws.getCell('D4').value).toBe(92)
  expect(ws.getCell('A5').value).toBe('Rui')
})
