// Segredo compartilhado com o Financeiro. Sem ele, as rotas de leitura não existem (404).
import { timingSafeEqual } from 'node:crypto'

export function segredoFinanceiro(): string | null {
  return process.env.FINANCEIRO_SEGREDO || null
}

export function autorizado(cabecalho: string | null, segredo: string): boolean {
  if (!cabecalho) return false
  const esperado = Buffer.from(`Bearer ${segredo}`)
  const recebido = Buffer.from(cabecalho)
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido)
}
