// Vagas prontas para a tela: filtros, resumos por onda e por etapa, lista de atenção e colunas do quadro.
import type { EtapaDef } from './etapas'
import type { PrevisaoVaga } from './previsao'
import type { Situacao } from './situacao'

export type OndaVaga = { id: string; nome: string; inicio: string; fim: string }
export type VagaPainel = {
  id: string
  projetoId: string
  funcao: string
  disciplina: string
  area: string
  meta: string
  onda: OndaVaga | null
  gestor: { id: string; nome: string } | null
  candidato: string | null
  previsao: PrevisaoVaga
  situacao: Situacao
}
export type Filtro = { onda?: string; funcao?: string; area?: string; gestorId?: string; candidato?: string }
export type ResumoGrupo = {
  id: string
  nome: string
  inicio: string | null
  fim: string | null
  total: number
  admitidas: number
  mobilizadas: number
  verde: number
  amarelo: number
  vermelho: number
  proximaMeta: string | null
}
export type LinhaResumo = { funcao: string; total: number; vermelho: number; amarelo: number }
export type CartaoEtapa = { ordem: number | null; nome: string; total: number; funcoes: LinhaResumo[] }

const semAcento = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

// Chave para comparar funções: sem acento, minúsculas e espaços normalizados.
export const chaveFuncao = (t: string) => semAcento(t).replace(/\s+/g, ' ')

export function filtrarVagas(vagas: VagaPainel[], f: Filtro): VagaPainel[] {
  const busca = f.candidato ? semAcento(f.candidato) : ''
  const funcao = f.funcao ? chaveFuncao(f.funcao) : ''
  return vagas.filter(
    (v) =>
      (!f.onda || v.onda?.id === f.onda) &&
      (!funcao || chaveFuncao(v.funcao) === funcao) &&
      (!f.area || v.area === f.area) &&
      (!f.gestorId || v.gestor?.id === f.gestorId) &&
      (!busca || (v.candidato !== null && semAcento(v.candidato).includes(busca))),
  )
}

const resumir = (id: string, nome: string, inicio: string | null, fim: string | null, vagas: VagaPainel[]): ResumoGrupo => {
  const r: ResumoGrupo = { id, nome, inicio, fim, total: 0, admitidas: 0, mobilizadas: 0, verde: 0, amarelo: 0, vermelho: 0, proximaMeta: null }
  for (const v of vagas) {
    r.total++
    if (v.situacao.admitida) r.admitidas++
    else if (r.proximaMeta === null || v.meta < r.proximaMeta) r.proximaMeta = v.meta
    if (v.situacao.mobilizada) r.mobilizadas++
    else if (v.situacao.cor) r[v.situacao.cor]++
  }
  return r
}

// `cadastradas`: todas as ondas aparecem, mesmo sem vagas no filtro.
export function resumirOndas(vagas: VagaPainel[], cadastradas: OndaVaga[]): ResumoGrupo[] {
  return [...cadastradas]
    .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((o) => resumir(o.id, o.nome, o.inicio, o.fim, vagas.filter((v) => v.onda?.id === o.id)))
}

export const resumirProjeto = (vagas: VagaPainel[]): ResumoGrupo => resumir('projeto', '', null, null, vagas)

// Um cartão por etapa (e o das mobilizadas), com as funções agrupadas por `chaveFuncao`.
export function resumoPorEtapa(vagas: VagaPainel[], etapas: EtapaDef[]): CartaoEtapa[] {
  const cartao = (ordem: number | null, nome: string, doGrupo: VagaPainel[]): CartaoEtapa => {
    const linhas = new Map<string, LinhaResumo>()
    for (const v of doGrupo) {
      const k = chaveFuncao(v.funcao)
      const l = linhas.get(k) ?? { funcao: v.funcao.trim().replace(/\s+/g, ' '), total: 0, vermelho: 0, amarelo: 0 }
      l.total++
      if (ordem !== null && v.situacao.cor === 'vermelho') l.vermelho++
      if (ordem !== null && v.situacao.cor === 'amarelo') l.amarelo++
      linhas.set(k, l)
    }
    const funcoes = [...linhas.values()].sort((a, b) => b.total - a.total || a.funcao.localeCompare(b.funcao, 'pt-BR'))
    return { ordem, nome, total: doGrupo.length, funcoes }
  }
  return [
    ...etapas.map((e) => cartao(e.ordem, e.nome, vagas.filter((v) => v.previsao.etapaAtual === e.ordem))),
    cartao(null, 'Mobilizadas', vagas.filter((v) => v.previsao.etapaAtual === null)),
  ]
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
