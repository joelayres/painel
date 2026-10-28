// Leitura de células do Excel (ExcelJS): valor de fórmula, texto rico e datas.
import type ExcelJS from 'exceljs'
import { dataValida } from '@/lib/validacao/vaga'

export function valor(celula: ExcelJS.CellValue): ExcelJS.CellValue {
  if (celula && typeof celula === 'object' && 'result' in celula) return celula.result as ExcelJS.CellValue
  if (celula && typeof celula === 'object' && 'richText' in celula) return celula.richText.map((t) => t.text).join('')
  return celula
}

export const texto = (c: ExcelJS.CellValue) => {
  const v = valor(c)
  return v === null || v === undefined ? '' : String(v)
}

// "Qui 22/10/26", "22/10/2026" ou data do Excel → "2026-10-22".
export function lerData(c: ExcelJS.CellValue): string | null {
  const v = valor(c)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  // O ano de 4 dígitos vem primeiro na alternativa; senão "22/10/2026" casaria "20" e viraria 2020.
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)/.exec(texto(v))
  if (!m) return null
  const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  const iso = `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return dataValida(iso) ? iso : null
}
