// Segredo compartilhado com o Portal da Gestão. Sem ele, as rotas do portal não existem (404).
import { timingSafeEqual } from 'node:crypto'

export function segredoPortal(): string | null {
  return process.env.PORTAL_SEGREDO || null
}

export function autorizadoPortal(cabecalho: string | null, segredo: string): boolean {
  if (!cabecalho) return false
  const esperado = Buffer.from(`Bearer ${segredo}`)
  const recebido = Buffer.from(cabecalho)
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido)
}
