import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { buscarTarifasFinanceiro } from '../tarifas'

const VAGA = { painelVagaId: 'v1', tipo: 'MOD', cobrada: true, linha: '12/2026', descricao: 'Técnico', valor: 24108.83 }
const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status })

beforeEach(() => {
  process.env.FINANCEIRO_ENDERECO = 'https://fin'
  process.env.FINANCEIRO_SEGREDO = 's'
})
afterEach(() => {
  delete process.env.FINANCEIRO_ENDERECO
  delete process.env.FINANCEIRO_SEGREDO
  vi.useRealTimers()
})

test('chama a rota com o segredo e devolve um mapa por vaga', async () => {
  const f = vi.fn(async () => resposta({ versao: 1, vagas: [VAGA] }))
  const mapa = await buscarTarifasFinanceiro(f as unknown as typeof fetch)
  expect(f).toHaveBeenCalledWith('https://fin/api/painel/tarifas', expect.objectContaining({ headers: { Authorization: 'Bearer s' }, cache: 'no-store' }))
  expect(mapa?.get('v1')?.valor).toBe(24108.83)
})

test('sem endereço ou sem segredo: null sem chamar', async () => {
  const f = vi.fn()
  delete process.env.FINANCEIRO_ENDERECO
  expect(await buscarTarifasFinanceiro(f as unknown as typeof fetch)).toBeNull()
  process.env.FINANCEIRO_ENDERECO = 'https://fin'
  delete process.env.FINANCEIRO_SEGREDO
  expect(await buscarTarifasFinanceiro(f as unknown as typeof fetch)).toBeNull()
  expect(f).not.toHaveBeenCalled()
})

test('versão diferente de 1: null', async () => {
  expect(await buscarTarifasFinanceiro((async () => resposta({ versao: 2, vagas: [] })) as unknown as typeof fetch)).toBeNull()
})

test('HTTP 500: null', async () => {
  expect(await buscarTarifasFinanceiro((async () => resposta({ erro: 'x' }, 500)) as unknown as typeof fetch)).toBeNull()
})

test('fetch que rejeita (rede ou tempo esgotado): null', async () => {
  expect(await buscarTarifasFinanceiro((async () => { throw new Error('rede') }) as unknown as typeof fetch)).toBeNull()
})

test('aborta depois de 4 s', async () => {
  vi.useFakeTimers()
  const f = (_url: string, init: RequestInit) => new Promise<Response>((_ok, falha) => init.signal?.addEventListener('abort', () => falha(new Error('abortado'))))
  const promessa = buscarTarifasFinanceiro(f as unknown as typeof fetch)
  await vi.advanceTimersByTimeAsync(4000)
  expect(await promessa).toBeNull()
})
