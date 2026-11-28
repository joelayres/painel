import { describe, expect, it, vi } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import { analisarCurriculo, ErroAnalise, SEM_CREDITOS } from '../ia'

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

  it('sem créditos na API avisa que os créditos acabaram, e não culpa o arquivo', async () => {
    const corpo = { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }
    const create = vi.fn().mockRejectedValue(new Anthropic.BadRequestError(400, corpo, undefined, new Headers()))
    const cliente = { beta: { messages: { create } } } as unknown as Anthropic
    await expect(analisarCurriculo(Buffer.from('%PDF'), 'NR-13', cliente)).rejects.toThrow(new ErroAnalise(SEM_CREDITOS))
  })

  it('outro erro 400 continua dizendo que não leu o arquivo', async () => {
    const corpo = { type: 'error', error: { type: 'invalid_request_error', message: 'The PDF specified was not valid.' } }
    const create = vi.fn().mockRejectedValue(new Anthropic.BadRequestError(400, corpo, undefined, new Headers()))
    const cliente = { beta: { messages: { create } } } as unknown as Anthropic
    await expect(analisarCurriculo(Buffer.from('%PDF'), 'NR-13', cliente)).rejects.toThrow('A IA não conseguiu ler este arquivo.')
  })
})
