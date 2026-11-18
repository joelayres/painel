import { expect, test } from 'vitest'
import { ETAPAS_PADRAO } from '@/dominio/etapas'
import { vagaExemplo } from '@/test/vagas'
import { montarRelatorio, type TarifaDaVaga } from '../relatorio'

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
  expect(r.linhas[0]).toMatchObject({ nome: 'Vinicius Vieira', vagaAberta: false, funcao: 'Técnico de Campo', disciplina: 'NR-13', area: 'Caldeiraria', onda: 'Onda 1', meta: '2026-11-26' })
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
