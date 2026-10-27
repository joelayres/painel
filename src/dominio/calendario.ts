// Dias úteis: segunda a sexta, fora dos feriados cadastrados. Datas são strings AAAA-MM-DD,
// e a aritmética roda em UTC para não depender do fuso do servidor.
import { formatarData, partesData } from './tempo'

export type Feriados = ReadonlySet<string>

function somarDias(data: string, n: number): string {
  const { ano, mes, dia } = partesData(data)
  const d = new Date(Date.UTC(ano, mes - 1, dia + n))
  return formatarData(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

export function ehDiaUtil(data: string, f: Feriados): boolean {
  const { ano, mes, dia } = partesData(data)
  const semana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()
  return semana !== 0 && semana !== 6 && !f.has(data)
}

export function proximoDiaUtil(data: string, f: Feriados): string {
  let d = data
  while (!ehDiaUtil(d, f)) d = somarDias(d, 1)
  return d
}

export function diaUtilSeguinte(data: string, f: Feriados): string {
  return proximoDiaUtil(somarDias(data, 1), f)
}

// Etapa de N dias termina no N-ésimo dia útil contando o início; de 0 dias, no próprio início.
export function fimDaEtapa(inicio: string, duracao: number, f: Feriados): string {
  let fim = inicio
  for (let i = 1; i < duracao; i++) fim = diaUtilSeguinte(fim, f)
  return fim
}

// Dias úteis em (de, ate].
export function diasUteisEntre(de: string, ate: string, f: Feriados): number {
  let n = 0
  for (let d = somarDias(de, 1); d <= ate; d = somarDias(d, 1)) if (ehDiaUtil(d, f)) n++
  return n
}
