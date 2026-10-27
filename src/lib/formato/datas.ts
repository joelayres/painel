// "2026-11-19" → "19/11"
export function ddmm(data: string): string {
  const [, mes, dia] = data.split('-')
  return `${dia}/${mes}`
}

// "2026-11-19" → "19/11/2026"
export function dataBR(data: string): string {
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}
