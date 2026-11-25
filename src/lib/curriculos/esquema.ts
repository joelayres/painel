// O formato da resposta do Claude na análise de um currículo, e a normalização dos dados que
// identificam o candidato (o banco procura repetidos pelo CPF e pelo e-mail já normalizados).
import { z } from 'zod'

const textoOuNulo = z.string().nullable()

export const esquemaAnalise = z.object({
  candidato: z.object({
    nome: textoOuNulo,
    email: textoOuNulo,
    telefone: textoOuNulo,
    cpf: textoOuNulo,
    cidade: textoOuNulo,
    uf: textoOuNulo,
  }),
  nota: z.number().int().min(0).max(100),
  classificacao: z.enum(['aderente', 'parcial', 'nao_aderente']),
  resumo: z.string(),
  requisitos: z.array(z.object({ requisito: z.string(), atende: z.enum(['sim', 'parcial', 'nao']), evidencia: z.string() })),
  pontosFortes: z.array(z.string()),
  lacunas: z.array(z.string()),
})

export type Analise = z.infer<typeof esquemaAnalise>

export function normalizarCpf(s: string | null): string | null {
  const digitos = (s ?? '').replace(/\D/g, '')
  return digitos.length === 11 ? digitos : null
}

export function normalizarEmail(s: string | null): string | null {
  const e = (s ?? '').trim().toLowerCase()
  return e.includes('@') ? e : null
}
