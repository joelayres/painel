// O relatório do projeto em Excel, no formato da planilha do cliente: "OK" nas etapas concluídas e o % no rodapé.
import ExcelJS from 'exceljs'
import type { Relatorio } from '@/dominio/relatorio'
import { dataBR } from '@/lib/formato/datas'

const MOEDA = '"R$" #,##0.00'
// As cores do painel: cabeçalho na faixa da marca e OK no verde de "finalizada".
const MARCA = 'FF2B6157'
const BRANCO = 'FFFFFFFF'
const OK_FUNDO = 'FFDCF1E4'
const OK_TEXTO = 'FF1C6239'
const BORDA = { style: 'thin' as const, color: { argb: 'FFD3DDD9' } }
const solido = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })

export async function gerarExcelRelatorio(p: { relatorio: Relatorio; projeto: string; onda: string | null; porOndas: boolean; hoje: string }): Promise<Buffer> {
  const r = p.relatorio
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Relatório', { views: [{ state: 'frozen', ySplit: 4 }] })
  const fixas = ['Nome', 'Tipo', 'Função', 'Disciplina', 'Área', 'Gestor', ...(p.porOndas ? ['Onda'] : []), 'Data final', 'Taxa']
  const COL_TAXA = fixas.length // a Taxa fecha as colunas fixas; as etapas vêm depois
  const cabecalho = [...fixas, ...r.etapas.map((e) => e.nome), ...(r.colunaMobilizado ? ['Mobilizado'] : [])]

  ws.getCell('A1').value = `${p.projeto} · Relatório de mobilização`
  ws.getCell('A1').font = { bold: true, size: 14 }
  ws.getCell('A2').value = `Gerado em ${dataBR(p.hoje)}${p.onda ? ` · ${p.onda}` : ''}`
  if (r.tarifasIndisponiveis) ws.getCell('A3').value = 'Tarifas indisponíveis: o Financeiro não respondeu na hora da geração.'

  const cab = ws.getRow(4)
  cab.values = cabecalho
  cab.height = 30
  cab.eachCell((c, i) => {
    c.fill = solido(MARCA)
    c.font = { bold: true, color: { argb: BRANCO } }
    c.alignment = { vertical: 'middle', horizontal: i > COL_TAXA ? 'center' : i === COL_TAXA ? 'right' : 'left', wrapText: true }
  })
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: cabecalho.length } }
  cabecalho.forEach((titulo, i) => { ws.getColumn(i + 1).width = i === 0 || i === 2 ? 32 : Math.max(12, titulo.length + 4) })
  ws.getColumn(COL_TAXA).numFmt = MOEDA

  for (const l of r.linhas) {
    const linha = ws.addRow([
      l.nome, l.tipo ?? '—', l.funcao, l.disciplina, l.area, l.gestor ?? '—', ...(p.porOndas ? [l.onda ?? ''] : []), dataBR(l.meta),
      !l.cobrada ? 'Não cobrada' : l.taxa,
      ...l.etapas.map((data) => (data ? 'OK' : null)),
      ...(r.colunaMobilizado ? [l.mobilizada ? 'OK' : null] : []),
    ])
    linha.eachCell({ includeEmpty: true }, (c, i) => {
      if (i > cabecalho.length) return
      c.border = { bottom: BORDA }
      c.alignment = { vertical: 'middle', horizontal: i > COL_TAXA ? 'center' : undefined }
    })
    if (l.vagaAberta) linha.getCell(1).font = { italic: true, color: { argb: 'FF52625D' } }
    else linha.getCell(1).font = { bold: true }
    const oks = [...l.etapas.map((d) => d !== null), ...(r.colunaMobilizado ? [l.mobilizada] : [])]
    oks.forEach((ok, i) => {
      if (!ok) return
      const c = linha.getCell(COL_TAXA + 1 + i)
      c.fill = solido(OK_FUNDO)
      c.font = { bold: true, color: { argb: OK_TEXTO } }
    })
  }

  ws.addRow([])
  const percentuais = [...r.percentuais, ...(r.colunaMobilizado ? [r.percentualMobilizado] : [])]
  const pct = ws.addRow(['% concluído', ...Array(COL_TAXA - 1).fill(null), ...percentuais])
  pct.font = { bold: true }
  pct.eachCell((c, i) => { if (i > COL_TAXA) c.alignment = { horizontal: 'center' } })
  percentuais.forEach((_, i) => { pct.getCell(COL_TAXA + 1 + i).numFmt = '0%' })
  const total = (rotulo: string, valor: number, formato: string) => {
    const linha = ws.addRow([rotulo])
    linha.getCell(COL_TAXA).value = valor
    linha.getCell(COL_TAXA).numFmt = formato
    linha.getCell(COL_TAXA).font = { bold: true }
  }
  total('Total das taxas', r.totalTaxas, MOEDA)
  total('Total das taxas (mobilizadas)', r.totalTaxasMobilizadas, MOEDA)
  total('Vagas sem tarifa', r.semTarifa, '0')

  return Buffer.from(await wb.xlsx.writeBuffer())
}
