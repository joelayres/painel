// Token de entrada vindo do Portal da Gestão: quem é, para qual sistema, vale 60 segundos e uma vez só.
// Arquivo idêntico no HE, no Painel e no portal: mude nos três ao mesmo tempo.
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export type EntradaPortal = { email: string; sistema: string; jti: string; exp: number } // exp em segundos (epoch)
type Motivo = 'formato' | 'assinatura' | 'expirado' | 'sistema'

const VALIDADE_S = 60

const assinar = (dados: string, segredo: string) => createHmac('sha256', segredo).update(dados).digest('base64url')

export function assinarEntrada(d: { email: string; sistema: string }, segredo: string, agora: Date = new Date()): string {
  const entrada: EntradaPortal = {
    email: d.email.trim().toLowerCase(),
    sistema: d.sistema,
    jti: randomUUID(),
    exp: Math.floor(agora.getTime() / 1000) + VALIDADE_S,
  }
  const dados = Buffer.from(JSON.stringify(entrada)).toString('base64url')
  return `${dados}.${assinar(dados, segredo)}`
}

export function conferirEntrada(
  token: string,
  segredo: string,
  sistema: string,
  agora: Date = new Date(),
): { ok: true; entrada: EntradaPortal } | { ok: false; motivo: Motivo } {
  const partes = token.split('.')
  if (partes.length !== 2 || !partes[0] || !partes[1]) return { ok: false, motivo: 'formato' }
  const [dados, assinatura] = partes
  // A assinatura vem antes de ler o conteúdo: nada de um token forjado chega ao JSON.parse.
  const esperada = Buffer.from(assinar(dados, segredo))
  const recebida = Buffer.from(assinatura)
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return { ok: false, motivo: 'assinatura' }
  let entrada: EntradaPortal
  try {
    entrada = JSON.parse(Buffer.from(dados, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, motivo: 'formato' }
  }
  if (typeof entrada?.email !== 'string' || typeof entrada.jti !== 'string' || typeof entrada.exp !== 'number') return { ok: false, motivo: 'formato' }
  if (entrada.sistema !== sistema) return { ok: false, motivo: 'sistema' }
  if (agora.getTime() / 1000 > entrada.exp) return { ok: false, motivo: 'expirado' }
  return { ok: true, entrada }
}
