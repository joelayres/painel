import { beforeEach, expect, test, vi } from 'vitest'
import { vagaExemplo } from '@/test/vagas'
import { ETAPAS_PADRAO } from '@/dominio/etapas'

const obterSessao = vi.fn()
vi.mock('@/lib/auth/perfil', () => ({ obterSessao }))
vi.mock('@/lib/supabase/servidor', () => ({ criarClienteServidor: async () => ({}) }))
const carregarPainel = vi.fn()
vi.mock('@/lib/painel/dados', () => ({ carregarPainel }))
const buscarTarifasFinanceiro = vi.fn()
vi.mock('@/lib/financeiro/tarifas', () => ({ buscarTarifasFinanceiro }))
const gerarExcelRelatorio = vi.fn(async () => Buffer.from('xlsx'))
vi.mock('@/lib/relatorio/excel', () => ({ gerarExcelRelatorio }))

const { GET } = await import('../route')
const ID = '11111111-1111-4111-8111-111111111111'
const chamar = (id = ID, consulta = '') => GET(new Request(`http://x/projetos/${id}/relatorio/excel${consulta}`), { params: Promise.resolve({ id }) })
const ONDA2 = { id: 'o2', nome: 'Onda 2', inicio: '2026-12-01', fim: '2026-12-31' }

beforeEach(() => {
  vi.clearAllMocks()
  obterSessao.mockResolvedValue({ perfil: 'cliente' })
  buscarTarifasFinanceiro.mockResolvedValue(new Map())
  carregarPainel.mockResolvedValue({
    projeto: { id: ID, nome: 'Mobilização 2027', organizacao: 'ondas' },
    vagas: [vagaExemplo('v1', { cor: 'verde', etapaAtual: 2 }), { ...vagaExemplo('v2', { cor: 'verde', etapaAtual: 2 }), onda: ONDA2 }],
    etapas: ETAPAS_PADRAO,
    ondas: [{ id: 'o1', nome: 'Onda 1', inicio: '2026-10-22', fim: '2026-11-26' }, ONDA2],
    gestores: [],
    foraDoRelatorio: ['padrao-1'],
  })
})

test('sem sessão: 404', async () => {
  obterSessao.mockResolvedValue(null)
  expect((await chamar()).status).toBe(404)
  expect(carregarPainel).not.toHaveBeenCalled()
})

test('projeto que o usuário não vê (carregarPainel null): 404', async () => {
  carregarPainel.mockResolvedValue(null)
  expect((await chamar()).status).toBe(404)
  expect(gerarExcelRelatorio).not.toHaveBeenCalled()
})

test('id inválido: 404', async () => {
  expect((await chamar('abc')).status).toBe(404)
})

test('cliente baixa: 200, xlsx, nome relatorio-<projeto>-<data>.xlsx', async () => {
  const r = await chamar()
  expect(r.status).toBe(200)
  expect(r.headers.get('content-type')).toContain('spreadsheetml')
  expect(r.headers.get('content-disposition')).toMatch(/^attachment; filename="relatorio-mobilizacao-2027-\d{4}-\d{2}-\d{2}\.xlsx"$/)
  expect(r.headers.get('cache-control')).toBe('no-store')
})

test('filtra pela onda do endereço', async () => {
  await chamar(ID, '?onda=o2')
  const arg = (gerarExcelRelatorio.mock.calls[0] as unknown as [{ relatorio: { linhas: unknown[] }; onda: string | null }])[0]
  expect(arg.relatorio.linhas).toHaveLength(1)
  expect(arg.onda).toBe('Onda 2')
})

test('onda de outro projeto é ignorada', async () => {
  await chamar(ID, '?onda=xyz')
  const arg = (gerarExcelRelatorio.mock.calls[0] as unknown as [{ relatorio: { linhas: unknown[] }; onda: string | null }])[0]
  expect(arg.relatorio.linhas).toHaveLength(2)
  expect(arg.onda).toBeNull()
})

test('Financeiro fora: ainda gera o arquivo', async () => {
  buscarTarifasFinanceiro.mockResolvedValue(null)
  expect((await chamar()).status).toBe(200)
  const arg = (gerarExcelRelatorio.mock.calls[0] as unknown as [{ relatorio: { tarifasIndisponiveis: boolean } }])[0]
  expect(arg.relatorio.tarifasIndisponiveis).toBe(true)
})

test('etapas fora do relatório não vão para o Excel', async () => {
  await chamar()
  const arg = (gerarExcelRelatorio.mock.calls[0] as unknown as [{ relatorio: { etapas: { nome: string }[] } }])[0]
  expect(arg.relatorio.etapas.map((e) => e.nome)).not.toContain('Abertura de vaga')
  expect(arg.relatorio.etapas).toHaveLength(12)
})

test('o Excel sai com o filtro e a ordem da tela', async () => {
  carregarPainel.mockResolvedValue({
    ...(await carregarPainel()),
    vagas: [
      { ...vagaExemplo('v1', { cor: 'verde', etapaAtual: 2 }), area: 'Q3' },
      { ...vagaExemplo('v2', { cor: 'verde', etapaAtual: 2 }), area: 'Q1', funcao: 'Assistente' },
      { ...vagaExemplo('v3', { cor: 'verde', etapaAtual: 2 }), area: 'Q1', funcao: 'Engenheiro' },
    ],
  })
  await chamar(ID, '?area=Q1&ordem=funcao&sentido=desc')
  const arg = (gerarExcelRelatorio.mock.calls[0] as unknown as [{ relatorio: { linhas: { id: string }[] } }])[0]
  expect(arg.relatorio.linhas.map((l) => l.id)).toEqual(['v3', 'v2'])
})
