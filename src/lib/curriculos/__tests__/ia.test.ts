import { describe, expect, it, vi } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { analisarCurriculo, ErroAnalise } from '../ia'

vi.mock('server-only', () => ({}))

const respostaValida = {
  candidato: { nome: 'Maria', email: ' Maria@X.com ', telefone: null, cpf: '123.456.789-01', cidade: 'Camaçari', uf: 'BA' },
  nota: 82,
  classificacao: 'aderente',
  resumo: 'Atende NR-13.',
  requisitos: [{ requisito: 'NR-13', atende: 'sim', evidencia: 'Curso 2024' }],
  pontosFortes: ['Experiência'],
  lacunas: [],
}

function clienteFalso(resposta: Partial<Anthropic.Beta.BetaMessage>) {
  const create = vi.fn().mockResolvedValue({
    model: 'claude-sonnet-5-5',
    stop_reason: 'end_turn',
    usage: { input_tokens: 5000, output_tokens: 700 },
    content: [{ type: 'text', text: JSON.stringify(respostaValida) }],
    ...resposta,
  })
  return { cliente: { beta: { messages: { create } } } as unknown as Anthropic, create }
}

describe('analisarCurriculo', () => {
  it('devolve a análise com CPF e e-mail normalizados e os tokens usados', async () => {
    const { cliente, create } = clienteFalso({})
    const r = await analisarCurriculo(Buffer.from('%PDF'), 'NR-13', cliente)
    expect(r.analise.candidato.cpf).toBe('12345678901')
    expect(r.analise.candidato.email).toBe('maria@x.com')
    expect(r).toMatchObject({ modelo: 'claude-sonnet-5-5', tokensEntrada: 5000, tokensSaida: 700 })
    expect(create).toHaveBeenCalledOnce()
  })

  it('recusa da IA vira ErroAnalise', async () => {
    const { cliente } = clienteFalso({ stop_reason: 'refusal', content: [] })
    await expect(analisarCurriculo(Buffer.from('%PDF'), 'NR-13', cliente)).rejects.toThrow(new ErroAnalise('A IA recusou analisar este arquivo.'))
  })

  it('resposta fora do formato vira ErroAnalise', async () => {
    const { cliente } = clienteFalso({ content: [{ type: 'text', text: 'oi', citations: null }] })
    await expect(analisarCurriculo(Buffer.from('%PDF'), 'NR-13', cliente)).rejects.toThrow('Resposta da IA fora do formato.')
  })

  it('no Haiku, parcial com nota alta é gravado como aderente', async () => {
    const { cliente } = clienteFalso({ model: 'claude-haiku-5-5', content: [{ type: 'text', text: JSON.stringify({ ...respostaValida, nota: 66, classificacao: 'parcial' }), citations: null }] })
    const r = await analisarCurriculo(Buffer.from('%PDF'), 'NR-13', cliente)
    expect(r.analise.classificacao).toBe('aderente')
    expect(r.modelo).toBe('claude-haiku-5-5')
  })
})
