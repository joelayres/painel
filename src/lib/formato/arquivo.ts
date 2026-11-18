// "Mobilização Braskem 2027" → "mobilizacao-braskem-2027" (nome de arquivo sem acento nem espaço).
export const nomeArquivo = (nome: string): string =>
  nome.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projeto'
