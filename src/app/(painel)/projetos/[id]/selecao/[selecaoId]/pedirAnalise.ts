export type RespostaAnalise = { ok: true; situacao: 'analisada' | 'repetida' } | { ok: false; erro: string }

// Pede a análise de um currículo à rota do servidor. Falha de rede ou tempo esgotado vira erro na
// tela; o currículo continua pendente e pode ser analisado de novo.
export async function pedirAnalise(participacaoId: string): Promise<RespostaAnalise> {
  try {
    const r = await fetch('/api/selecao/analisar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participacaoId }),
    })
    const corpo = (await r.json().catch(() => null)) as RespostaAnalise | null
    if (corpo && typeof corpo.ok === 'boolean') return corpo
    return { ok: false, erro: 'A análise não respondeu. Tente de novo.' }
  } catch {
    return { ok: false, erro: 'Sem conexão com o servidor. Tente de novo.' }
  }
}
