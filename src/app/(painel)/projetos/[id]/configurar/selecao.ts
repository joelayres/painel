// Seleção de vagas para as ações em grupo do Configurar.
import { chaveFuncao } from '@/dominio/painel'

// etapaAtual null = mobilizada. concluiuAlguma: já passou da primeira etapa (o início não pesa mais).
export type VagaSelecionavel = { id: string; funcao: string; ondaId: string | null; etapaAtual: number | null; concluiuAlguma: boolean; cancelada: boolean }
export type FiltroSelecao = { funcao?: string; onda?: string; etapa?: number }

// Canceladas e mobilizadas não entram em ação em grupo.
export function selecionaveis<T extends VagaSelecionavel>(vagas: T[], f: FiltroSelecao): T[] {
  const funcao = f.funcao ? chaveFuncao(f.funcao) : null
  return vagas.filter(
    (v) =>
      !v.cancelada &&
      v.etapaAtual !== null &&
      (!funcao || chaveFuncao(v.funcao) === funcao) &&
      (!f.onda || v.ondaId === f.onda) &&
      (f.etapa === undefined || v.etapaAtual === f.etapa),
  )
}

export function etapaComum(selecionadas: VagaSelecionavel[]): number | null {
  const etapas = new Set(selecionadas.map((v) => v.etapaAtual))
  return etapas.size === 1 ? [...etapas][0] : null
}

// Data sugerida para adiar a etapa: o início da onda, quando todas as selecionadas são da mesma onda.
export function inicioDaOndaComum(selecionadas: VagaSelecionavel[], ondas: { id: string; inicio: string }[]): string {
  const ids = new Set(selecionadas.map((v) => v.ondaId))
  const [id] = [...ids]
  return ids.size === 1 && id ? (ondas.find((o) => o.id === id)?.inicio ?? '') : ''
}

export function puladasNoInicio(selecionadas: VagaSelecionavel[]): number {
  return selecionadas.filter((v) => v.concluiuAlguma).length
}
