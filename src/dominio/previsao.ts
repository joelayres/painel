// Previsão das etapas de uma vaga: parte da última data real e soma as durações em dias úteis.
// O banco guarda só as datas reais; tudo aqui é recalculado a cada leitura.
import { diaUtilSeguinte, fimDaEtapa, proximoDiaUtil, type Feriados } from './calendario'
import type { EtapaDef, EtapaFixa } from './etapas'

export type Conclusao = { ordem: number; concluidaEm: string }
export type EtapaPrevista = { ordem: number; nome: string; fixa: EtapaFixa | null; inicio: string; fim: string; concluidaEm: string | null }
export type PrevisaoVaga = {
  etapas: EtapaPrevista[]
  etapaAtual: number | null // null = mobilizada
  inicioEtapaAtual: string | null
  admissaoEstimada: string
  conclusaoEstimada: string
}

export function preverVaga(p: {
  dataInicio: string
  retomadaEm?: string | null
  etapas: EtapaDef[]
  conclusoes: Conclusao[]
  feriados: Feriados
}): PrevisaoVaga {
  const f = p.feriados
  const concluidas = new Map(p.conclusoes.map((c) => [c.ordem, c.concluidaEm]))
  const etapas: EtapaPrevista[] = []
  let inicio = proximoDiaUtil(p.dataInicio, f)
  for (const e of [...p.etapas].sort((a, b) => a.ordem - b.ordem)) {
    // Desistência do candidato: a captura recomeça na data da retomada (só pesa enquanto ela está aberta).
    if (e.fixa === 'captura' && p.retomadaEm && !concluidas.has(e.ordem)) {
      const retomada = proximoDiaUtil(p.retomadaEm, f)
      if (retomada > inicio) inicio = retomada
    }
    const concluidaEm = concluidas.get(e.ordem) ?? null
    const fim = concluidaEm ?? fimDaEtapa(inicio, e.duracao, f)
    etapas.push({ ordem: e.ordem, nome: e.nome, fixa: e.fixa, inicio, fim, concluidaEm })
    // Depois de um marco (0 dias) a próxima começa no mesmo dia útil; depois das outras, no dia útil seguinte.
    inicio = e.duracao === 0 ? proximoDiaUtil(fim, f) : diaUtilSeguinte(fim, f)
  }
  const atual = etapas.find((e) => e.concluidaEm === null) ?? null
  const fimDe = (fixa: EtapaFixa) => etapas.find((e) => e.fixa === fixa)?.fim ?? etapas.at(-1)!.fim
  return {
    etapas,
    etapaAtual: atual?.ordem ?? null,
    inicioEtapaAtual: atual?.inicio ?? null,
    admissaoEstimada: fimDe('admissao'),
    conclusaoEstimada: etapas.at(-1)!.fim,
  }
}
