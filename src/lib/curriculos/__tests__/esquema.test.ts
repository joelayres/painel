import { describe, expect, it } from 'vitest'
import { esquemaAnalise, normalizarCpf, normalizarEmail } from '../esquema'

const valida = {
  candidato: { nome: 'Maria', email: null, telefone: null, cpf: null, cidade: null, uf: null },
  nota: 80,
  classificacao: 'aderente',
  resumo: 'ok',
  requisitos: [{ requisito: 'NR-13', atende: 'sim', evidencia: 'Curso em 2024' }],
  pontosFortes: [],
  lacunas: [],
}

describe('normalização', () => {
  it('CPF fica só com os 11 dígitos, ou nulo', () => {
    expect(normalizarCpf('123.456.789-01')).toBe('12345678901')
    expect(normalizarCpf('123')).toBeNull()
    expect(normalizarCpf(null)).toBeNull()
  })

  it('e-mail fica minúsculo e sem espaços, ou nulo', () => {
    expect(normalizarEmail(' A@X.com ')).toBe('a@x.com')
    expect(normalizarEmail('sem-arroba')).toBeNull()
    expect(normalizarEmail('')).toBeNull()
  })
})

describe('esquemaAnalise', () => {
  it('aceita a resposta no formato', () => {
    expect(esquemaAnalise.safeParse(valida).success).toBe(true)
  })

  it('recusa nota fora de 0 a 100 e classificação desconhecida', () => {
    expect(esquemaAnalise.safeParse({ ...valida, nota: 101 }).success).toBe(false)
    expect(esquemaAnalise.safeParse({ ...valida, classificacao: 'otimo' }).success).toBe(false)
  })
})
