// Segredo compartilhado com o Efetivo (Portal). Sem ele, a rota não existe (404).
export { autorizado } from '@/lib/financeiro/segredo'
export const segredoEfetivo = (): string | null => process.env.EFETIVO_SEGREDO || null
