import type { Cor } from '@/dominio/situacao'

// Faixas e etiquetas do prazo, com as cores fortes do tema (--prazo-*).
export const COR_PRAZO: Record<Cor, string> = { verde: 'var(--prazo-verde)', amarelo: 'var(--prazo-amarelo)', vermelho: 'var(--prazo-vermelho)' }
export const ROTULO_PRAZO: Record<Cor, string> = { verde: 'No prazo', amarelo: 'Em risco', vermelho: 'Atrasada' }
