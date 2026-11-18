// Relatório de mobilização do projeto: uma linha por vaga, uma coluna por etapa, com o tipo e a taxa vindos do Financeiro.
// A tela e o Excel usam a mesma montagem.
import type { EtapaDef } from './etapas'
import type { VagaPainel } from './painel'

// O que o relatório usa da tarifa do Financeiro (o TarifaVaga do contrato encaixa aqui).
export type TarifaDaVaga = { tipo: 'MOD' | 'MOI'; cobrada: boolean; valor: number | null }

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
  etapas: { ordem: number; nome: string }[]
  linhas: LinhaRelatorio[]
  percentuais: number[] // 0..1 por etapa: vagas que concluíram ÷ vagas do relatório
  totalTaxas: number
  totalTaxasMobilizadas: number
  semTarifa: number // vagas cobradas sem valor
  tarifasIndisponiveis: boolean // o Financeiro não respondeu
}

const centavos = (x: number) => Math.round(x * 100) / 100

export function montarRelatorio(vagas: VagaPainel[], etapas: EtapaDef[], tarifas: Map<string, TarifaDaVaga> | null): Relatorio {
  const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem).map(({ ordem, nome }) => ({ ordem, nome }))
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
    etapas: ordenadas,
    linhas,
    percentuais: ordenadas.map((_, i) => (linhas.length ? linhas.filter((l) => l.etapas[i] !== null).length / linhas.length : 0)),
    totalTaxas: soma(linhas),
    totalTaxasMobilizadas: soma(linhas.filter((l) => l.mobilizada)),
    semTarifa: linhas.filter((l) => l.cobrada && l.taxa === null).length,
    tarifasIndisponiveis: tarifas === null,
  }
}
