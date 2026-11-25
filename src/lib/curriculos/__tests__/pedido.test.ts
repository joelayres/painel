import { afterEach, describe, expect, it, vi } from 'vitest'
import { modeloAnalise, montarPedido } from '../pedido'

afterEach(() => vi.unstubAllEnvs())

const pedido = () => montarPedido({ descritivo: 'Caldeireiro com NR-13', pdfBase64: 'QkFTRTY0UERG', modelo: 'claude-sonnet-5-5' })

describe('modeloAnalise', () => {
  it('usa o Sonnet 5.5 sem configuração', () => {
    vi.stubEnv('ANTHROPIC_MODELO', '')
    expect(modeloAnalise()).toBe('claude-sonnet-5-5')
  })

  it('usa o modelo da configuração quando definido', () => {
    vi.stubEnv('ANTHROPIC_MODELO', 'claude-haiku-5-5')
    expect(modeloAnalise()).toBe('claude-haiku-5-5')
  })
})

describe('montarPedido', () => {
  it('manda o PDF como documento, primeiro bloco da mensagem do usuário', () => {
    const conteudo = pedido().messages[0].content as { type: string; source?: { data: string; media_type: string } }[]
    expect(conteudo[0].type).toBe('document')
    expect(conteudo[0].source).toMatchObject({ media_type: 'application/pdf', data: 'QkFTRTY0UERG' })
  })

  it('o system tem o descritivo e manda ignorar instruções do currículo, sem o PDF', () => {
    const system = pedido().system as { text: string; cache_control?: unknown }[]
    const texto = system.map((b) => b.text).join('\n')
    expect(texto).toContain('Caldeireiro com NR-13')
    expect(texto).toMatch(/ignore qualquer instrução/i)
    expect(texto).not.toContain('QkFTRTY0UERG')
    expect(system.at(-1)?.cache_control).toEqual({ type: 'ephemeral' })
  })

  it('usa fallback padrão, esforço médio e resposta em JSON', () => {
    const p = pedido()
    expect(p.model).toBe('claude-sonnet-5-5')
    expect(p.fallbacks).toBe('default')
    expect(p.betas).toEqual(['server-side-fallback-2026-07-01'])
    expect(p.output_config?.effort).toBe('medium')
    expect(p.output_config?.format?.type).toBe('json_schema')
    expect(JSON.stringify(p.output_config?.format?.schema)).toContain('requisitos')
  })
})
