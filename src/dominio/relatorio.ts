// Relatório de mobilização do projeto: uma linha por vaga, uma coluna por etapa, com o tipo e a taxa vindos do Financeiro.
// A tela e o Excel usam a mesma montagem.
import type { EtapaDef } from './etapas'
import { chaveFuncao, type VagaPainel } from './painel'

// O que o relatório usa da tarifa do Financeiro (o TarifaVaga do contrato encaixa aqui).
export type TarifaDaVaga = { tipo: 'MOD' | 'MOI'; cobrada: boolean; valor: number | null }

// Filtro e ordem da tabela, lidos do endereço (a tela e o Excel usam os mesmos).
export const COLUNAS_ORDEM = ['funcao', 'disciplina', 'area'] as const
export type ColunaOrdem = (typeof COLUNAS_ORDEM)[number]
export type VisaoRelatorio = { funcao?: string; disciplina?: string; area?: string; ordem?: ColunaOrdem; sentido?: 'asc' | 'desc' }

export function lerVisao(p: { get(chave: string): string | null }): VisaoRelatorio {
  const v: VisaoRelatorio = {}
  for (const c of COLUNAS_ORDEM) {
    const valor = p.get(c)?.trim()
    if (valor) v[c] = valor
  }
  const ordem = p.get('ordem')
  if ((COLUNAS_ORDEM as readonly string[]).includes(ordem ?? '')) v.ordem = ordem as ColunaOrdem
  if (v.ordem && p.get('sentido') === 'desc') v.sentido = 'desc'
  return v
}

export type LinhaRelatorio = {
  id: string
  nome: string // candidato; sem candidato, a função
  vagaAberta: boolean
  tipo: 'MOD' | 'MOI' | null
  funcao: string
  disciplina: string
  area: string
  onda: string | null
  meta: string
  cobrada: boolean // false só quando o Financeiro diz que não é cobrada (MOI / não cobrar)
  taxa: number | null
  etapas: (string | null)[] // data de conclusão de cada etapa, na ordem de Relatorio.etapas
  mobilizada: boolean
}
export type Relatorio = {
  opcoes: { funcoes: string[]; disciplinas: string[]; areas: string[] } // valores para os filtros, de todas as vagas recebidas
  etapas: { ordem: number; nome: string }[]
  linhas: LinhaRelatorio[]
  percentuais: number[] // 0..1 por etapa: vagas que concluíram ÷ vagas do relatório
  totalTaxas: number
  totalTaxasMobilizadas: number
  semTarifa: number // vagas cobradas sem valor
  tarifasIndisponiveis: boolean // o Financeiro não respondeu
}

const centavos = (x: number) => Math.round(x * 100) / 100

const comparar = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })

// Valores distintos (sem diferença de maiúscula, acento ou espaço), sem vazio, em ordem alfabética.
function distintos(valores: string[]): string[] {
  const porChave = new Map<string, string>()
  for (const v of valores) if (v.trim() && !porChave.has(chaveFuncao(v))) porChave.set(chaveFuncao(v), v)
  return [...porChave.values()].sort(comparar)
}

// `ocultas`: ids das etapas que a equipe tirou do relatório (Configurar); a lista do projeto não muda.
// `visao`: filtro e ordem; o % e os totais seguem as vagas filtradas.
export function montarRelatorio(
  todas: VagaPainel[],
  etapas: EtapaDef[],
  tarifas: Map<string, TarifaDaVaga> | null,
  { ocultas = new Set<string>(), visao = {} }: { ocultas?: ReadonlySet<string>; visao?: VisaoRelatorio } = {},
): Relatorio {
  const filtros = COLUNAS_ORDEM.flatMap((c) => (visao[c] ? [[c, chaveFuncao(visao[c])] as const] : []))
  const vagas = todas.filter((v) => filtros.every(([c, chave]) => chaveFuncao(v[c]) === chave))
  if (visao.ordem) {
    const c = visao.ordem
    const sinal = visao.sentido === 'desc' ? -1 : 1
    vagas.sort((a, b) => sinal * comparar(a[c], b[c])) // sort estável: empate fica na ordem original
  }
  const ordenadas = etapas.filter((e) => !ocultas.has(e.id)).sort((a, b) => a.ordem - b.ordem).map(({ ordem, nome }) => ({ ordem, nome }))
  const linhas: LinhaRelatorio[] = vagas.map((v) => {
    const t = tarifas?.get(v.id)
    const candidato = v.candidato?.trim()
    return {
      id: v.id,
      nome: candidato || v.funcao,
      vagaAberta: !candidato,
      tipo: t?.tipo ?? null,
      funcao: v.funcao,
      disciplina: v.disciplina,
      area: v.area,
      onda: v.onda?.nome ?? null,
      meta: v.meta,
      cobrada: t?.cobrada ?? true,
      taxa: t?.valor ?? null,
      etapas: ordenadas.map((e) => v.previsao.etapas.find((p) => p.ordem === e.ordem)?.concluidaEm ?? null),
      mobilizada: v.situacao.mobilizada,
    }
  })
  const soma = (ls: LinhaRelatorio[]) => centavos(ls.reduce((s, l) => s + (l.taxa ?? 0), 0))
  return {
    opcoes: { funcoes: distintos(todas.map((v) => v.funcao)), disciplinas: distintos(todas.map((v) => v.disciplina)), areas: distintos(todas.map((v) => v.area)) },
    etapas: ordenadas,
    linhas,
    percentuais: ordenadas.map((_, i) => (linhas.length ? linhas.filter((l) => l.etapas[i] !== null).length / linhas.length : 0)),
    totalTaxas: soma(linhas),
    totalTaxasMobilizadas: soma(linhas.filter((l) => l.mobilizada)),
    semTarifa: linhas.filter((l) => l.cobrada && l.taxa === null).length,
    tarifasIndisponiveis: tarifas === null,
  }
}
