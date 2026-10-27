import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hojeSP } from '@/dominio/tempo'
import { apagarDoTeste, clienteAdmin, criarUsuario, entrarComo, garantirOnda, prefixo } from './apoio'

const admin = clienteAdmin()
let rh: SupabaseClient
let visualizador: SupabaseClient
let nomeRh: string
let ondaId: string

async function novaVaga(candidato: string | null = null): Promise<string> {
  const { data, error } = await admin
    .from('vagas')
    .insert({ funcao: `${prefixo} Técnico`, disciplina: 'NR-13', area: 'Caldeiraria', onda_id: ondaId, data_inicio: '2026-10-22', candidato })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

const conclusoes = async (vagaId: string) =>
  ((await admin.from('vaga_conclusoes').select('ordem, concluida_em').eq('vaga_id', vagaId).order('ordem')).data ?? []).map((c) => c.ordem)

beforeAll(async () => {
  const u1 = await criarUsuario(admin, 'rh', 'rh')
  const u2 = await criarUsuario(admin, 'cliente', 'visualizador')
  nomeRh = u1.nome
  rh = await entrarComo(u1.email)
  visualizador = await entrarComo(u2.email)
  ondaId = await garantirOnda(admin, 1)
})

afterAll(async () => {
  await apagarDoTeste(admin)
})

describe('segurança', () => {
  it('visualizador lê as vagas e não altera nada', async () => {
    const id = await novaVaga()
    const { data } = await visualizador.from('vagas').select('id').eq('id', id)
    expect(data).toHaveLength(1)
    const { error: erroInsert } = await visualizador.from('vagas').insert({ funcao: `${prefixo} x`, disciplina: 'd', area: 'a', onda_id: ondaId, data_inicio: '2026-10-22' })
    expect(erroInsert).not.toBeNull()
    await visualizador.from('vagas').update({ candidato: 'hack' }).eq('id', id)
    const { data: depois } = await admin.from('vagas').select('candidato').eq('id', id).single()
    expect(depois!.candidato).toBeNull()
  })

  it('visualizador não consegue concluir etapa', async () => {
    const id = await novaVaga()
    const { error } = await visualizador.rpc('concluir_etapa', { p_vaga: id, p_ordem_esperada: 1, p_data: hojeSP() })
    expect(error).not.toBeNull()
    expect(await conclusoes(id)).toEqual([])
  })

  it('as etapas vêm com as 13 durações padrão', async () => {
    const { data } = await visualizador.from('etapas').select('ordem, nome, duracao').order('ordem')
    expect(data).toHaveLength(13)
    expect(data![10]).toEqual({ ordem: 11, nome: 'Admissão Timenow', duracao: 0 })
    expect(data![12]).toEqual({ ordem: 13, nome: 'Treinamento', duracao: 5 })
  })
})

describe('ações do RH', () => {
  it('conclui a etapa e registra o nome no histórico', async () => {
    const id = await novaVaga()
    const { error } = await rh.rpc('concluir_etapa', { p_vaga: id, p_ordem_esperada: 1, p_data: hojeSP() })
    expect(error).toBeNull()
    expect(await conclusoes(id)).toEqual([1])
    const { data: hist } = await admin.from('historico').select('nome_usuario, acao').eq('vaga_id', id)
    expect(hist).toEqual([{ nome_usuario: nomeRh, acao: 'Concluiu Abertura de vaga' }])
  })

  it('concluir com etapa esperada errada é recusado', async () => {
    const id = await novaVaga()
    await rh.rpc('concluir_etapa', { p_vaga: id, p_ordem_esperada: 1, p_data: hojeSP() })
    const { error } = await rh.rpc('concluir_etapa', { p_vaga: id, p_ordem_esperada: 1, p_data: hojeSP() })
    expect(error?.message).toContain('etapa mudou')
    expect(await conclusoes(id)).toEqual([1])
  })

  it('data anterior à etapa anterior é recusada', async () => {
    const id = await novaVaga()
    await rh.rpc('concluir_etapa', { p_vaga: id, p_ordem_esperada: 1, p_data: '2026-10-23' })
    const { error } = await rh.rpc('concluir_etapa', { p_vaga: id, p_ordem_esperada: 2, p_data: '2026-10-22' })
    expect(error?.message).toContain('data antes da etapa anterior')
  })

  it('data no futuro é recusada', async () => {
    const id = await novaVaga()
    const { error } = await rh.rpc('concluir_etapa', { p_vaga: id, p_ordem_esperada: 1, p_data: '2999-01-01' })
    expect(error?.message).toContain('data no futuro')
  })

  it('desfazer apaga só a última conclusão', async () => {
    const id = await novaVaga()
    await rh.rpc('concluir_etapa', { p_vaga: id, p_ordem_esperada: 1, p_data: '2026-10-22' })
    await rh.rpc('concluir_etapa', { p_vaga: id, p_ordem_esperada: 2, p_data: '2026-10-23' })
    const { error } = await rh.rpc('desfazer_etapa', { p_vaga: id, p_ordem_esperada: 2 })
    expect(error).toBeNull()
    expect(await conclusoes(id)).toEqual([1])
  })

  it('candidato desistiu volta para a captura e registra a retomada', async () => {
    const id = await novaVaga('Maria')
    for (const [ordem, data] of [[1, '2026-10-22'], [2, '2026-10-23'], [3, '2026-10-26']] as const) {
      await rh.rpc('concluir_etapa', { p_vaga: id, p_ordem_esperada: ordem, p_data: data })
    }
    const { error } = await rh.rpc('candidato_desistiu', { p_vaga: id })
    expect(error).toBeNull()
    expect(await conclusoes(id)).toEqual([1])
    const { data } = await admin.from('vagas').select('candidato, retomada_em').eq('id', id).single()
    expect(data).toEqual({ candidato: null, retomada_em: hojeSP() })
  })

  it('vaga cancelada não avança', async () => {
    const id = await novaVaga()
    await admin.from('vagas').update({ cancelada_em: new Date().toISOString() }).eq('id', id)
    const { error } = await rh.rpc('concluir_etapa', { p_vaga: id, p_ordem_esperada: 1, p_data: hojeSP() })
    expect(error?.message).toContain('vaga cancelada')
  })
})
