import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { esquemaAnalise, normalizarCpf, normalizarEmail, type Analise } from './esquema'
import { modeloAnalise, montarPedido } from './pedido'

// Erro com mensagem pronta para a tela (vai para a linha do currículo na seleção).
export class ErroAnalise extends Error {}

export const SEM_CREDITOS = 'Créditos da IA esgotados. Recarregue no Console da Anthropic e clique em Continuar análise.'

// Sem saldo, a API devolve um erro 400 igual ao de pedido inválido; só o texto diferencia.
function semCreditos(e: InstanceType<typeof Anthropic.APIError>): boolean {
  const texto = `${e.message} ${JSON.stringify(e.error ?? '')}`.toLowerCase()
  return texto.includes('credit balance') || texto.includes('billing')
}

export type ResultadoAnalise = { analise: Analise; modelo: string; tokensEntrada: number; tokensSaida: number }

export async function analisarCurriculo(pdf: Buffer, descritivo: string, cliente: Anthropic = new Anthropic()): Promise<ResultadoAnalise> {
  let resposta: Anthropic.Beta.BetaMessage
  try {
    resposta = await cliente.beta.messages.create(montarPedido({ descritivo, pdfBase64: pdf.toString('base64'), modelo: modeloAnalise() }))
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new ErroAnalise('IA ocupada, tente de novo em instantes.')
    if (e instanceof Anthropic.APIError && semCreditos(e)) throw new ErroAnalise(SEM_CREDITOS)
    if (e instanceof Anthropic.BadRequestError) throw new ErroAnalise('A IA não conseguiu ler este arquivo.')
    if (e instanceof Anthropic.APIError) throw new ErroAnalise('Falha ao falar com a IA. Tente de novo.')
    throw e
  }
  if (resposta.stop_reason === 'refusal') throw new ErroAnalise('A IA recusou analisar este arquivo.')
  if (resposta.stop_reason === 'max_tokens') throw new ErroAnalise('Resposta incompleta da IA.')

  const texto = resposta.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  let json: unknown
  try {
    json = JSON.parse(texto)
  } catch {
    throw new ErroAnalise('Resposta da IA fora do formato.')
  }
  const r = esquemaAnalise.safeParse(json)
  if (!r.success) throw new ErroAnalise('Resposta da IA fora do formato.')

  const analise = { ...r.data, candidato: { ...r.data.candidato, cpf: normalizarCpf(r.data.candidato.cpf), email: normalizarEmail(r.data.candidato.email) } }
  return { analise, modelo: resposta.model, tokensEntrada: resposta.usage.input_tokens, tokensSaida: resposta.usage.output_tokens }
}
