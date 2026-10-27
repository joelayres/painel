const FORMATO_HHMM = /^(\d{1,3}):([0-5]\d)$/

export function paraMinutos(hhmm: string): number {
  const partes = FORMATO_HHMM.exec(hhmm.trim())
  if (!partes) throw new Error(`Horário inválido: ${hhmm}`)
  return Number(partes[1]) * 60 + Number(partes[2])
}

export function formatarHHMM(min: number): string {
  const horas = Math.floor(min / 60)
  const minutos = min % 60
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
}

// Datas civis no formato YYYY-MM-DD, sem fuso horário.
export function partesData(data: string): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = data.split('-').map(Number)
  return { ano, mes, dia }
}

export function formatarData(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

// Data de hoje no fuso de São Paulo, independente do fuso do servidor.
export function hojeSP(agora: Date = new Date()): string {
  return agora.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}
