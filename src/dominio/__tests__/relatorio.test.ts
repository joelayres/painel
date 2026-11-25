import { expect, test } from 'vitest'
import { ETAPAS_PADRAO } from '@/dominio/etapas'
import { vagaExemplo } from '@/test/vagas'
import { lerVisao, montarRelatorio, type TarifaDaVaga, type VisaoRelatorio } from '../relatorio'

const emAndamento = (id: string, etapaAtual: number, candidato?: string) => vagaExemplo(id, { cor: 'verde', etapaAtual, candidato })
const mobilizada = (id: string) => vagaExemplo(id, { cor: null, etapaAtual: null, candidato: 'Ana' })
const tarifa = (_id: string, o: Partial<TarifaDaVaga>): TarifaDaVaga => ({ tipo: 'MOD', cobrada: true, valor: null, ...o })

test('uma coluna por etapa, na ordem, com a data de conclusão', () => {
  const r = montarRelatorio([emAndamento('v1', 3)], [...ETAPAS_PADRAO].reverse(), new Map())
  expect(r.etapas.map((e) => e.nome)).toEqual(ETAPAS_PADRAO.map((e) => e.nome))
  expect(r.linhas[0].etapas.slice(0, 3)).toEqual(['2026-10-22', '2026-10-22', null])
  expect(r.linhas[0].etapas).toHaveLength(ETAPAS_PADRAO.length)
})

test('percentual por etapa', () => {
  const r = montarRelatorio([emAndamento('v1', 1), emAndamento('v2', 2), emAndamento('v3', 3), mobilizada('v4')], ETAPAS_PADRAO, new Map())
  expect(r.percentuais[0]).toBe(0.75)
  expect(r.percentuais[1]).toBe(0.5)
  expect(r.percentuais[12]).toBe(0.25)
})

test('sem vagas: percentuais zero e totais zero', () => {
  const r = montarRelatorio([], ETAPAS_PADRAO, new Map())
  expect(r.linhas).toEqual([])
  expect(r.percentuais).toEqual(ETAPAS_PADRAO.map(() => 0))
  expect(r).toMatchObject({ totalTaxas: 0, totalTaxasMobilizadas: 0, semTarifa: 0, tarifasIndisponiveis: false })
})

test('nome é o candidato, ou a função com vagaAberta', () => {
  const r = montarRelatorio([emAndamento('v1', 2, 'Vinicius Vieira'), emAndamento('v2', 2)], ETAPAS_PADRAO, new Map())
  expect(r.linhas[0]).toMatchObject({ nome: 'Vinicius Vieira', vagaAberta: false, funcao: 'Técnico de Campo', disciplina: 'NR-13', area: 'Caldeiraria', gestor: 'Ana Souza', onda: 'Onda 1', meta: '2026-11-26' })
  expect(r.linhas[1]).toMatchObject({ nome: 'Técnico de Campo', vagaAberta: true })
})

test('tipo e taxa do Financeiro; totais e sem tarifa', () => {
  const tarifas = new Map([
    ['v1', tarifa('v1', { valor: 24108.83 })],
    ['v2', tarifa('v2', { valor: 12809.51 })],
    ['v3', tarifa('v3', { tipo: 'MOI', cobrada: false })],
  ])
  const r = montarRelatorio([mobilizada('v1'), emAndamento('v2', 2), emAndamento('v3', 2), emAndamento('v4', 2)], ETAPAS_PADRAO, tarifas)
  expect(r).toMatchObject({ totalTaxas: 36918.34, totalTaxasMobilizadas: 24108.83, semTarifa: 1, tarifasIndisponiveis: false })
  expect(r.linhas[0]).toMatchObject({ tipo: 'MOD', cobrada: true, taxa: 24108.83, mobilizada: true })
  expect(r.linhas[2]).toMatchObject({ tipo: 'MOI', cobrada: false, taxa: null })
  expect(r.linhas[3]).toMatchObject({ tipo: null, cobrada: true, taxa: null })
})

test('Financeiro indisponível', () => {
  const r = montarRelatorio([emAndamento('v1', 2), mobilizada('v2')], ETAPAS_PADRAO, null)
  expect(r).toMatchObject({ tarifasIndisponiveis: true, semTarifa: 2, totalTaxas: 0 })
  expect(r.linhas[0]).toMatchObject({ tipo: null, taxa: null })
})

test('etapas fora do relatório não viram coluna nem percentual', () => {
  const ocultas = new Set(ETAPAS_PADRAO.filter((e) => e.ordem !== 2 && e.ordem !== 4).map((e) => e.id))
  const r = montarRelatorio([emAndamento('v1', 3), mobilizada('v2')], ETAPAS_PADRAO, new Map(), { ocultas })
  expect(r.etapas.map((e) => e.nome)).toEqual(['Captura de Mercado', 'Entrevista - Timenow'])
  expect(r.linhas[0].etapas).toEqual(['2026-10-22', null])
  expect(r.percentuais).toEqual([1, 0.5])
})

const com = (id: string, funcao: string, disciplina: string, area: string, etapaAtual = 2) => ({ ...emAndamento(id, etapaAtual), funcao, disciplina, area })
const variadas = () => [
  com('v1', 'Técnico de Campo', 'NR13', 'Q3', 3),
  com('v2', 'Assistente  Técnico', 'APOIOS', 'Q1'),
  com('v3', 'técnico de campo', 'FORNOS', 'Q1'),
  com('v4', 'Engenheiro de Campo', 'APOIOS', ''),
]

test('opções de filtro: valores distintos, sem vazio, em ordem alfabética, sem repetir variação de maiúscula/espaço', () => {
  const r = montarRelatorio(variadas(), ETAPAS_PADRAO, new Map(), { visao: { area: 'Q1' } })
  expect(r.opcoes).toEqual({
    funcoes: ['Assistente  Técnico', 'Engenheiro de Campo', 'Técnico de Campo'],
    disciplinas: ['APOIOS', 'FORNOS', 'NR13'],
    areas: ['Q1', 'Q3'],
  })
})

test('filtra por função (ignorando maiúscula, acento e espaço duplo), disciplina e área; % e totais seguem o filtro', () => {
  const tarifas = new Map([['v1', { tipo: 'MOD' as const, cobrada: true, valor: 100 }], ['v3', { tipo: 'MOD' as const, cobrada: true, valor: 50 }]])
  const r = montarRelatorio(variadas(), ETAPAS_PADRAO, tarifas, { visao: { funcao: 'tecnico de  campo' } })
  expect(r.linhas.map((l) => l.id)).toEqual(['v1', 'v3'])
  expect(r.totalTaxas).toBe(150)
  expect(r.percentuais[1]).toBe(0.5)
  expect(montarRelatorio(variadas(), ETAPAS_PADRAO, null, { visao: { disciplina: 'APOIOS', area: 'Q1' } }).linhas.map((l) => l.id)).toEqual(['v2'])
  expect(montarRelatorio(variadas(), ETAPAS_PADRAO, null, { visao: { area: 'Nenhuma' } }).linhas).toEqual([])
})

test('ordena por função, disciplina ou área, crescente ou decrescente, mantendo a ordem original nos empates', () => {
  const ids = (visao: VisaoRelatorio) =>
    montarRelatorio(variadas(), ETAPAS_PADRAO, null, { visao }).linhas.map((l) => l.id)
  expect(ids({ ordem: 'funcao' })).toEqual(['v2', 'v4', 'v1', 'v3'])
  expect(ids({ ordem: 'funcao', sentido: 'desc' })).toEqual(['v1', 'v3', 'v4', 'v2'])
  expect(ids({ ordem: 'disciplina' })).toEqual(['v2', 'v4', 'v3', 'v1'])
  expect(ids({ ordem: 'area' })).toEqual(['v4', 'v2', 'v3', 'v1'])
  expect(ids({})).toEqual(['v1', 'v2', 'v3', 'v4'])
})

test('lerVisao lê o endereço e ignora valores inválidos', () => {
  expect(lerVisao(new URLSearchParams('funcao=T%C3%A9cnico&disciplina=NR13&area=Q3&ordem=area&sentido=desc&onda=o1'))).toEqual({
    funcao: 'Técnico', disciplina: 'NR13', area: 'Q3', ordem: 'area', sentido: 'desc',
  })
  expect(lerVisao(new URLSearchParams('ordem=nome&sentido=x&funcao=%20'))).toEqual({})
})

test('coluna Mobilizado: OK com a data quando a vaga concluiu todas as etapas, e o % do recorte', () => {
  const r = montarRelatorio([emAndamento('v1', 3), mobilizada('v2'), emAndamento('v3', 13)], ETAPAS_PADRAO, new Map())
  expect(r.colunaMobilizado).toBe(true)
  expect(r.linhas.map((l) => l.mobilizadaEm)).toEqual([null, '2026-10-22', null])
  expect(r.percentualMobilizado).toBeCloseTo(1 / 3)
  expect(montarRelatorio([], ETAPAS_PADRAO, new Map()).percentualMobilizado).toBe(0)
})

test('a coluna Mobilizado vale mesmo com a última etapa fora do relatório', () => {
  const ocultas = new Set([ETAPAS_PADRAO[12].id])
  const r = montarRelatorio([mobilizada('v1')], ETAPAS_PADRAO, new Map(), { ocultas })
  expect(r.colunaMobilizado).toBe(true)
  expect(r.linhas[0].mobilizadaEm).toBe('2026-10-22')
})

test('sem coluna automática quando o projeto já tem uma etapa Mobilizado visível', () => {
  const etapas = ETAPAS_PADRAO.map((e) => (e.ordem === 13 ? { ...e, nome: 'Mobilizado' } : e))
  expect(montarRelatorio([mobilizada('v1')], etapas, new Map()).colunaMobilizado).toBe(false)
  const oculta = montarRelatorio([mobilizada('v1')], etapas, new Map(), { ocultas: new Set([etapas[12].id]) })
  expect(oculta.colunaMobilizado).toBe(true)
})
