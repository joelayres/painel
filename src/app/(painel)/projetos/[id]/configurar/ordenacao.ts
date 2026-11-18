// Ordenação da tabela de vagas do Configurar (clique no cabeçalho da coluna).

export type ColunaOrdenavel = 'funcao' | 'disciplina' | 'area' | 'onda' | 'etapa' | 'gestor' | 'candidato' | 'inicio'
export type Ordenacao = { coluna: ColunaOrdenavel; direcao: 'asc' | 'desc' } | null
export type VagaOrdenavel = {
  id: string; funcao: string; disciplina: string; area: string; ondaId: string | null; meta: string | null
  etapaAtual: number | null; gestor: string | null; candidato: string | null; dataInicio: string
}

const texto = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

// null = sem valor: vai sempre para o fim, seja qual for a direção.
function valor(v: VagaOrdenavel, coluna: ColunaOrdenavel, inicioOnda: Map<string, string>): string | number | null {
  switch (coluna) {
    case 'onda': return v.ondaId ? (inicioOnda.get(v.ondaId) ?? null) : v.meta
    // Mobilizada (etapaAtual null) vem depois da última etapa.
    case 'etapa': return v.etapaAtual ?? Number.MAX_SAFE_INTEGER
    case 'inicio': return v.dataInicio
    default: return v[coluna] || null
  }
}

export function ordenarVagas<T extends VagaOrdenavel>(vagas: T[], ordem: Ordenacao, ondas: { id: string; inicio: string }[]): T[] {
  if (!ordem) return vagas
  const inicioOnda = new Map(ondas.map((o) => [o.id, o.inicio]))
  const sinal = ordem.direcao === 'asc' ? 1 : -1
  // sort é estável: empates mantêm a ordem original.
  return [...vagas].sort((a, b) => {
    const x = valor(a, ordem.coluna, inicioOnda)
    const y = valor(b, ordem.coluna, inicioOnda)
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : texto.compare(String(x), String(y))
    return c * sinal
  })
}

// Clique no cabeçalho: crescente → decrescente → sem ordenação.
export function proximaOrdenacao(atual: Ordenacao, coluna: ColunaOrdenavel): Ordenacao {
  if (atual?.coluna !== coluna) return { coluna, direcao: 'asc' }
  return atual.direcao === 'asc' ? { coluna, direcao: 'desc' } : null
}
