// Tipo e tarifa de cada vaga, lidos do Financeiro a cada abertura do relatório (sem cópia aqui).
// Nunca lança: com o Financeiro fora do ar, devolve null e o relatório abre sem a Taxa.
import type { RespostaTarifasVagas, TarifaVaga } from './contrato'
import { segredoFinanceiro } from './segredo'

const LIMITE_MS = 4000

export async function buscarTarifasFinanceiro(f: typeof fetch = fetch): Promise<Map<string, TarifaVaga> | null> {
  const endereco = process.env.FINANCEIRO_ENDERECO
  const segredo = segredoFinanceiro()
  if (!endereco || !segredo) return null
  const controle = new AbortController()
  const prazo = setTimeout(() => controle.abort(), LIMITE_MS)
  try {
    const r = await f(`${endereco}/api/painel/tarifas`, { headers: { Authorization: `Bearer ${segredo}` }, cache: 'no-store', signal: controle.signal })
    if (!r.ok) return null
    const corpo = (await r.json()) as RespostaTarifasVagas
    if (corpo?.versao !== 1 || !Array.isArray(corpo.vagas)) return null
    return new Map(corpo.vagas.map((v) => [v.painelVagaId, v]))
  } catch {
    return null
  } finally {
    clearTimeout(prazo)
  }
}
