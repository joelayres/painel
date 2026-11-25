// Fila de análise conduzida pela tela: no máximo `simultaneas` ao mesmo tempo. Uma falha (ou exceção)
// conta como não ok e não interrompe as outras.
export async function processarFila(
  ids: string[],
  analisar: (id: string) => Promise<{ ok: boolean }>,
  opcoes: { simultaneas: number; aoTerminar: (id: string, r: { ok: boolean }) => void },
): Promise<void> {
  const restantes = [...ids]
  async function trabalhador() {
    for (let id = restantes.shift(); id !== undefined; id = restantes.shift()) {
      let r: { ok: boolean }
      try {
        r = await analisar(id)
      } catch {
        r = { ok: false }
      }
      opcoes.aoTerminar(id, r)
    }
  }
  await Promise.all(Array.from({ length: Math.min(opcoes.simultaneas, ids.length) }, trabalhador))
}
