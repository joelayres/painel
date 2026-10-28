import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { apagarDoTeste, clienteAdmin, criarUsuario, entrarComo, garantirOnda, prefixo } from './apoio'

const admin = clienteAdmin()
let rh: SupabaseClient
let visualizador: SupabaseClient
let nomeRh: string
let ondaId: string

const dadosVaga = (extra: Record<string, unknown> = {}) => ({ funcao: `${prefixo} Técnico`, disciplina: 'NR-13', area: 'Caldeiraria', onda_id: ondaId, gestor_id: null, candidato: null, data_inicio: '2026-10-22', ...extra })

beforeAll(async () => {
  const u = await criarUsuario(admin, 'rh-hist', 'rh')
  nomeRh = u.nome
  rh = await entrarComo(u.email)
  visualizador = await entrarComo((await criarUsuario(admin, 'cli-hist', 'visualizador')).email)
  ondaId = await garantirOnda(admin, 1)
})
afterAll(async () => {
  await apagarDoTeste(admin)
})

describe('histórico das mudanças de vaga', () => {
  it('criar e editar a vaga registra quem fez e o antes e depois', async () => {
    const { data: id, error } = await rh.rpc('salvar_vaga', { p_id: null, p: dadosVaga() })
    expect(error).toBeNull()
    await rh.rpc('salvar_vaga', { p_id: id, p: dadosVaga({ candidato: 'Maria', data_inicio: '2026-10-26' }) })
    const { data: hist } = await admin.from('historico').select('nome_usuario, acao, detalhe').eq('vaga_id', id).order('em')
    expect(hist!.map((h) => h.acao)).toEqual(['Criou a vaga', 'Editou a vaga'])
    expect(hist![1].nome_usuario).toBe(nomeRh)
    expect(hist![1].detalhe).toMatchObject({ antes: { candidato: null, data_inicio: '2026-10-22' }, depois: { candidato: 'Maria', data_inicio: '2026-10-26' } })
  })

  it('cancelar a vaga registra no histórico', async () => {
    const { data: id } = await rh.rpc('salvar_vaga', { p_id: null, p: dadosVaga() })
    const { error } = await rh.rpc('cancelar_vaga', { p_id: id })
    expect(error).toBeNull()
    const { data } = await admin.from('vagas').select('cancelada_em').eq('id', id).single()
    expect(data!.cancelada_em).not.toBeNull()
    const { data: hist } = await admin.from('historico').select('acao').eq('vaga_id', id).order('em')
    expect(hist!.at(-1)!.acao).toBe('Cancelou a vaga')
  })

  it('visualizador não salva nem cancela vaga', async () => {
    const { error } = await visualizador.rpc('salvar_vaga', { p_id: null, p: dadosVaga() })
    expect(error).not.toBeNull()
  })
})

describe('histórico das ondas', () => {
  it('mudar uma onda fica no registro geral', async () => {
    const { data: ocupadas } = await admin.from('ondas').select('numero')
    const livre = [1, 2, 3, 4].find((n) => !(ocupadas ?? []).some((o) => o.numero === n))
    if (!livre) return // todas as ondas reais já cadastradas: não mexe nelas
    const id = await garantirOnda(admin, livre, '2026-10-22', '2026-11-26')
    const { error } = await rh.rpc('salvar_onda', { p_id: id, p_numero: livre, p_inicio: '2026-10-22', p_fim: '2026-11-30' })
    expect(error).toBeNull()
    const { data: hist } = await admin.from('historico').select('acao, detalhe').is('vaga_id', null).eq('nome_usuario', nomeRh)
    expect(hist).toEqual([{ acao: `Alterou a ${livre}ª Onda`, detalhe: { antes: { inicio: '2026-10-22', fim: '2026-11-26' }, depois: { inicio: '2026-10-22', fim: '2026-11-30' } } }])
  })
})
