// Regras de tela da Seleção de Currículos: abas da lista e rótulos.

export type Classificacao = 'a_confirmar' | 'aderente' | 'parcial' | 'nao_aderente'
export type Resultado = 'em_andamento' | 'escolhido' | 'aprovado_nao_escolhido' | 'reprovado' | 'desistiu'

export type LinhaParticipacao = {
  id: string
  nome: string
  nota: number | null
  classificacao: Classificacao | null
  situacao: string
  resultado: Resultado
  resumo: string | null
}

const porNota = (a: LinhaParticipacao, b: LinhaParticipacao) => (b.nota ?? -1) - (a.nota ?? -1) || a.nome.localeCompare(b.nome, 'pt-BR')

// Só as analisadas entram nas abas; pendentes, com erro e repetidas ficam de fora.
export function separarAbas<T extends LinhaParticipacao>(linhas: T[]): { aConfirmar: T[]; aderentes: T[]; naoAderentes: T[] } {
  const analisadas = linhas.filter((l) => l.situacao === 'analisada')
  return {
    aConfirmar: analisadas.filter((l) => l.classificacao === 'a_confirmar').sort(porNota),
    aderentes: analisadas.filter((l) => l.classificacao === 'aderente' || l.classificacao === 'parcial').sort(porNota),
    naoAderentes: analisadas.filter((l) => l.classificacao === 'nao_aderente').sort(porNota),
  }
}

export const CLASSIFICACOES: Record<Classificacao, string> = {
  a_confirmar: 'A confirmar',
  aderente: 'Aderente',
  parcial: 'Parcialmente aderente',
  nao_aderente: 'Não aderente',
}
export const RESULTADOS: Record<Resultado, string> = {
  em_andamento: 'Em andamento',
  escolhido: 'Escolhido',
  aprovado_nao_escolhido: 'Aprovado mas não escolhido',
  reprovado: 'Reprovado',
  desistiu: 'Desistiu',
}
export const PARECERES = { recomendado: 'Recomendado', ressalvas: 'Recomendado com ressalvas', nao_recomendado: 'Não recomendado' } as const
export const TIPOS_ENTREVISTA = { timenow: 'Entrevista Timenow', cliente: 'Entrevista TNGO/Braskem' } as const
export const ATENDE = { sim: 'Atende', parcial: 'Atende em parte', nao: 'Não atende' } as const

export const rotuloClassificacao = (c: Classificacao) => CLASSIFICACOES[c]
export const rotuloResultado = (r: Resultado) => RESULTADOS[r]
export const rotuloParecer = (p: keyof typeof PARECERES) => PARECERES[p]
export const rotuloTipoEntrevista = (t: keyof typeof TIPOS_ENTREVISTA) => TIPOS_ENTREVISTA[t]
