'use server'

import { revalidatePath } from 'next/cache'
import { exigirRh } from '@/lib/auth/perfil'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { esquemaVaga, validar } from '@/lib/validacao/vaga'

type Resposta = { ok: true } | { ok: false; erro: string }

// Mensagens das funções do banco (supabase/migrations/20261028000002_acoes_rh.sql) para a tela.
const MENSAGENS: [string, string][] = [
  ['etapa mudou', 'Esta vaga mudou enquanto você olhava. Atualize a página.'],
  ['data antes da etapa anterior', 'A data não pode ser antes da conclusão da etapa anterior.'],
  ['data no futuro', 'A data não pode ser no futuro.'],
  ['vaga cancelada', 'Esta vaga foi cancelada.'],
]

function resposta(error: { message: string } | null): Resposta {
  if (!error) {
    revalidatePath('/', 'layout')
    return { ok: true }
  }
  const conhecida = MENSAGENS.find(([chave]) => error.message.includes(chave))
  return { ok: false, erro: conhecida?.[1] ?? 'Não foi possível salvar. Tente de novo.' }
}

export async function concluirEtapa(vagaId: string, ordemEsperada: number, data: string): Promise<Resposta> {
  await exigirRh()
  const sb = await criarClienteServidor()
  const { error } = await sb.rpc('concluir_etapa', { p_vaga: vagaId, p_ordem_esperada: ordemEsperada, p_data: data })
  return resposta(error)
}

export async function desfazerEtapa(vagaId: string, ordemEsperada: number): Promise<Resposta> {
  await exigirRh()
  const sb = await criarClienteServidor()
  const { error } = await sb.rpc('desfazer_etapa', { p_vaga: vagaId, p_ordem_esperada: ordemEsperada })
  return resposta(error)
}

export async function candidatoDesistiu(vagaId: string): Promise<Resposta> {
  await exigirRh()
  const sb = await criarClienteServidor()
  const { error } = await sb.rpc('candidato_desistiu', { p_vaga: vagaId })
  return resposta(error)
}

export async function salvarVaga(id: string | null, entrada: unknown): Promise<{ ok: true; id: string } | { ok: false; erros: Record<string, string> }> {
  await exigirRh()
  const r = validar(esquemaVaga, entrada)
  if (!r.ok) return r
  const d = r.dados
  const linha = { funcao: d.funcao, disciplina: d.disciplina, area: d.area, onda_id: d.ondaId, gestor_id: d.gestorId, candidato: d.candidato, data_inicio: d.dataInicio }
  const sb = await criarClienteServidor()
  const { data, error } = id
    ? await sb.from('vagas').update(linha).eq('id', id).select('id').single()
    : await sb.from('vagas').insert(linha).select('id').single()
  if (error || !data) return { ok: false, erros: { _: 'Não foi possível salvar a vaga. Tente de novo.' } }
  revalidatePath('/', 'layout')
  return { ok: true, id: data.id }
}

export async function cancelarVaga(id: string): Promise<Resposta> {
  await exigirRh()
  const sb = await criarClienteServidor()
  const { error } = await sb.from('vagas').update({ cancelada_em: new Date().toISOString() }).eq('id', id)
  return resposta(error)
}
