// A seleção em Excel: uma linha por candidato analisado, na ordem da nota. Cores como o Relatório.
import ExcelJS from 'exceljs'
import { dataBR } from '@/lib/formato/datas'

const MARCA = 'FF2B6157'
const BRANCO = 'FFFFFFFF'
const BORDA = { style: 'thin' as const, color: { argb: 'FFD3DDD9' } }

export type LinhaExcelSelecao = { nome: string; email: string | null; telefone: string | null; nota: number | null; classificacao: string; resumo: string; entrevistas: string; resultado: string }

export async function gerarExcelSelecao(p: { projeto: string; funcao: string; hoje: string; linhas: LinhaExcelSelecao[] }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Seleção', { views: [{ state: 'frozen', ySplit: 3 }] })
  ws.getCell('A1').value = `${p.projeto} · Seleção ${p.funcao}`
  ws.getCell('A1').font = { bold: true, size: 14 }
  ws.getCell('A2').value = `Gerado em ${dataBR(p.hoje)}`

  const cabecalho = ws.getRow(3)
  cabecalho.values = ['Nome', 'E-mail', 'Telefone', 'Nota', 'Classificação', 'Resumo', 'Entrevistas', 'Resultado']
  cabecalho.eachCell((c) => {
    c.font = { bold: true, color: { argb: BRANCO } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MARCA } }
    c.border = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA }
  })
  for (const l of p.linhas) {
    const linha = ws.addRow([l.nome, l.email ?? '', l.telefone ?? '', l.nota ?? '', l.classificacao, l.resumo, l.entrevistas, l.resultado])
    linha.alignment = { vertical: 'top', wrapText: true }
    linha.eachCell((c) => { c.border = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA } })
  }
  ws.columns.forEach((c, i) => { c.width = [28, 28, 16, 8, 22, 60, 40, 24][i] })
  return Buffer.from(await wb.xlsx.writeBuffer())
}
