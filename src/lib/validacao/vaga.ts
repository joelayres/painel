import { z } from 'zod'

const texto = (msg: string) => z.string({ error: msg }).trim().min(1, msg)
const data = (msg: string) => z.string({ error: msg }).regex(/^\d{4}-\d{2}-\d{2}$/, msg)
const opcional = z.string().nullish().transform((v) => (v?.trim() ? v.trim() : null))

export const esquemaVaga = z.object({
  funcao: texto('Informe a função.'),
  disciplina: texto('Informe a disciplina.'),
  area: texto('Informe a área.'),
  ondaId: z.uuid('Escolha a onda.'),
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
