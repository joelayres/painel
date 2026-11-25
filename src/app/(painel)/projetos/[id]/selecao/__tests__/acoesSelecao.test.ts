// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest'

const chamadas: { cliente: 'sessao' | 'admin'; nome: string; args: Record<string, unknown> }[] = []
let erroIniciar: { message: string } | null = null
let falhaIA: Error | null = null

function cliente(tipo: 'sessao' | 'admin') {
  return {
    rpc: async (nome: string, args: Record<string, unknown>) => {
      chamadas.push({ cliente: tipo, nome, args })
      if (nome === 'iniciar_analise') return erroIniciar ? { data: null, error: erroIniciar } : { data: [{ caminho: 's/1.pdf', nome_arquivo: 'cv.pdf', descritivo: 'NR-13' }], error: null }
      if (nome === 'registrar_analise') return { data: 'analisada', error: null }
      return { data: null, error: null }
    },
    storage: { from: () => ({ download: async () => ({ data: new Blob(['%PDF']), error: null }) }) },
  }
}

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/perfil', () => ({ exigirEquipe: async () => ({ nome: 'Ana RH', perfil: 'analista' }) }))
vi.mock('@/lib/supabase/servidor', () => ({ criarClienteServidor: async () => cliente('sessao') }))
vi.mock('@/lib/supabase/admin', () => ({ criarClienteAdmin: () => cliente('admin') }))
vi.mock('@/lib/curriculos/ia', () => {
  class ErroAnalise extends Error {}
  return {
    ErroAnalise,
    analisarCurriculo: async () => {
      if (falhaIA) throw falhaIA
      return {
        analise: { candidato: { nome: 'Maria', email: null, telefone: null, cpf: null, cidade: null, uf: null }, nota: 80, classificacao: 'aderente', resumo: 'ok', requisitos: [], pontosFortes: [], lacunas: [] },
        modelo: 'claude-sonnet-5-5',
        tokensEntrada: 10,
        tokensSaida: 5,
      }
    },
  }
})

import { ErroAnalise } from '@/lib/curriculos/ia'
import { analisarParticipacao } from '../acoesSelecao'

beforeEach(() => {
  chamadas.length = 0
  erroIniciar = null
  falhaIA = null
})

test('analisa e grava pelo servidor, com o nome de quem pediu', async () => {
  expect(await analisarParticipacao('p1')).toEqual({ ok: true, situacao: 'analisada' })
  expect(chamadas.map((c) => `${c.cliente}:${c.nome}`)).toEqual(['sessao:iniciar_analise', 'admin:registrar_analise'])
  const p = chamadas[1].args.p as Record<string, unknown>
  expect(p).toMatchObject({ nome_usuario: 'Ana RH', versao_prompt: 'selecao-v1', nota: 80, classificacao: 'aderente', modelo: 'claude-sonnet-5-5' })
})

test('análise em andamento não chama a IA nem grava', async () => {
  erroIniciar = { message: 'análise em andamento' }
  const r = await analisarParticipacao('p1')
  expect(r).toEqual({ ok: false, erro: 'Este currículo já está sendo analisado.' })
  expect(chamadas.map((c) => c.nome)).toEqual(['iniciar_analise'])
})

test('erro da IA marca a falha pelo servidor e devolve a mensagem', async () => {
  falhaIA = new ErroAnalise('IA ocupada, tente de novo em instantes.')
  expect(await analisarParticipacao('p1')).toEqual({ ok: false, erro: 'IA ocupada, tente de novo em instantes.' })
  expect(chamadas.map((c) => `${c.cliente}:${c.nome}`)).toEqual(['sessao:iniciar_analise', 'admin:falhar_analise'])
})
