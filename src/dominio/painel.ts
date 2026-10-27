// Vagas prontas para a tela: filtros, resumo por onda, lista de atenção e colunas do quadro.
import type { PrevisaoVaga } from './previsao'
import type { Situacao } from './situacao'

export type OndaVaga = { id: string; numero: number; inicio: string; fim: string }
export type VagaPainel = {
  id: string
  funcao: string
  disciplina: string
  area: string
  onda: OndaVaga
  gestor: { id: string; nome: string } | null
  candidato: string | null
  previsao: PrevisaoVaga
  situacao: Situacao
}
export type Filtro = { onda?: number; funcao?: string; area?: string; gestorId?: string; candidato?: string }
export type ResumoOnda = {
  numero: number
  inicio: string
  fim: string
  total: number
  admitidas: number
  mobilizadas: number
  verde: number
  amarelo: number
  vermelho: number
}

const semAcento = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

export function filtrarVagas(vagas: VagaPainel[], f: Filtro): VagaPainel[] {
  const busca = f.candidato ? semAcento(f.candidato) : ''
  return vagas.filter(
    (v) =>
      (f.onda === undefined || v.onda.numero === f.onda) &&
      (!f.funcao || v.funcao === f.funcao) &&
      (!f.area || v.area === f.area) &&
      (!f.gestorId || v.gestor?.id === f.gestorId) &&
      (!busca || (v.candidato !== null && semAcento(v.candidato).includes(busca))),
  )
}

export function resumirOndas(vagas: VagaPainel[]): ResumoOnda[] {
  const ondas = new Map<number, ResumoOnda>()
  for (const v of vagas) {
    const r = ondas.get(v.onda.numero) ?? { numero: v.onda.numero, inicio: v.onda.inicio, fim: v.onda.fim, total: 0, admitidas: 0, mobilizadas: 0, verde: 0, amarelo: 0, vermelho: 0 }
    r.total++
    if (v.situacao.admitida) r.admitidas++
    if (v.situacao.mobilizada) r.mobilizadas++
    else if (v.situacao.cor) r[v.situacao.cor]++
    ondas.set(v.onda.numero, r)
  }
  return [...ondas.values()].sort((a, b) => a.numero - b.numero)
}

const fimAtual = (v: VagaPainel) => v.previsao.etapas.find((e) => e.ordem === v.previsao.etapaAtual)?.fim ?? ''

// Vermelhas primeiro, as que venceram há mais tempo no topo; depois amarelas, a admissão mais tardia no topo.
export function vagasEmAtencao(vagas: VagaPainel[]): VagaPainel[] {
  const vermelhas = vagas.filter((v) => v.situacao.cor === 'vermelho').sort((a, b) => fimAtual(a).localeCompare(fimAtual(b)))
  const amarelas = vagas
    .filter((v) => v.situacao.cor === 'amarelo')
    .sort((a, b) => b.previsao.admissaoEstimada.localeCompare(a.previsao.admissaoEstimada))
  return [...vermelhas, ...amarelas]
}

export function porEtapa(vagas: VagaPainel[]): Map<number, VagaPainel[]> {
  const grupos = new Map<number, VagaPainel[]>()
  for (const v of vagas) {
    if (v.previsao.etapaAtual === null) continue
    grupos.set(v.previsao.etapaAtual, [...(grupos.get(v.previsao.etapaAtual) ?? []), v])
  }
  return grupos
}
