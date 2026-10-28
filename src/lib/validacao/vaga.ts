import { z } from 'zod'

const texto = (msg: string) => z.string({ error: msg }).trim().min(1, msg)
// AAAA-MM-DD que existe no calendário (recusa 2026-02-31).
export function dataValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false
  const [a, m, d] = texto.split('-').map(Number)
  const dia = new Date(Date.UTC(a, m - 1, d))
  return dia.getUTCFullYear() === a && dia.getUTCMonth() === m - 1 && dia.getUTCDate() === d
}

export const campoData = (msg: string) => z.string({ error: msg }).refine(dataValida, msg)
const data = campoData
const opcional = z.string().nullish().transform((v) => (v?.trim() ? v.trim() : null))

// Disciplina e área são opcionais; vazias viram ''. A regra "onda ou meta" fica no banco.
const opcionalVazio = z.string().nullish().transform((v) => v?.trim() ?? '')

export const esquemaVaga = z.object({
  funcao: texto('Informe a função.'),
  disciplina: opcionalVazio,
  area: opcionalVazio,
  ondaId: z.string().nullish().transform((v) => (v ? v : null)).pipe(z.uuid('Escolha a onda.').nullable()),
  meta: z.string().nullish().transform((v) => (v ? v : null)).pipe(campoData('Informe a meta.').nullable()),
  projetoId: z.uuid('Projeto inválido.'),
  gestorId: z.string().nullish().transform((v) => (v ? v : null)).pipe(z.uuid('Gestor inválido.').nullable()),
  candidato: opcional,
  dataInicio: data('Informe a data de início.'),
})

export type DadosVaga = z.infer<typeof esquemaVaga>

// Primeiro erro de cada campo, no formato que os formulários mostram.
export function validar<T>(esquema: z.ZodType<T>, entrada: unknown): { ok: true; dados: T } | { ok: false; erros: Record<string, string> } {
  const r = esquema.safeParse(entrada)
  if (r.success) return { ok: true, dados: r.data }
  const erros: Record<string, string> = {}
  for (const i of r.error.issues) erros[String(i.path[0] ?? '_')] ??= i.message
  return { ok: false, erros }
}

// Endereços com id inválido viram "não encontrado" antes de chegar numa coluna uuid do banco.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const ehUuid = (texto: string): boolean => UUID.test(texto)
