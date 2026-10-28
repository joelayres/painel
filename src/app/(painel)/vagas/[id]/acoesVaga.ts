'use server'

import { revalidatePath } from 'next/cache'
import { avisoMeta } from '@/dominio/situacao'
import { hojeSP } from '@/dominio/tempo'
import { exigirRh } from '@/lib/auth/perfil'
import { carregarVaga } from '@/lib/painel/dados'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { esquemaVaga, validar } from '@/lib/validacao/vaga'

type Resposta = { ok: true } | { ok: false; erro: string }

// Mensagens das funções do banco (supabase/migrations/20261028000002_acoes_rh.sql) para a tela.
const MENSAGENS: [string, string][] = [
  ['etapa mudou', 'Esta vaga mudou enquanto você olhava. Atualize a página.'],
  ['data antes da etapa anterior', 'A data não pode ser antes da conclusão da etapa anterior.'],
  ['data no futuro', 'A data não pode ser no futuro.'],
  ['vaga cancelada', 'Esta vaga foi cancelada.'],
  ['data antes do início da vaga', 'A data não pode ser antes do início do processo da vaga.'],
  ['data antes da retomada', 'A data não pode ser antes da desistência do candidato anterior.'],
  ['vaga já admitida', 'A vaga já passou da admissão; não volta para a captura.'],
  ['projeto encerrado', 'Este projeto está encerrado. Reabra para alterar.'],
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

type RespostaSalvar = { ok: true; id: string; aviso: string | null } | { ok: false; erros: Record<string, string> }

export async function salvarVaga(id: string | null, entrada: unknown): Promise<RespostaSalvar> {
  await exigirRh()
  const r = validar(esquemaVaga, entrada)
  if (!r.ok) return r
  const d = r.dados
  const sb = await criarClienteServidor()
  // A função do banco grava e registra o histórico (quem mudou, antes e depois).
  const { data, error } = await sb.rpc('salvar_vaga', {
    p_id: id as string,
    p: { funcao: d.funcao, disciplina: d.disciplina, area: d.area, onda_id: d.ondaId, gestor_id: d.gestorId, candidato: d.candidato, data_inicio: d.dataInicio, meta: d.meta, projeto_id: d.projetoId },
  })
  if (error?.message.includes('onda obrigatória')) return { ok: false, erros: { ondaId: 'Escolha a onda.' } }
  if (error?.message.includes('meta obrigatória')) return { ok: false, erros: { meta: 'Informe a meta.' } }
  if (error?.message.includes('projeto encerrado')) return { ok: false, erros: { _: 'Este projeto está encerrado. Reabra para alterar.' } }
  if (error || !data) return { ok: false, erros: { _: 'Não foi possível salvar a vaga. Tente de novo.' } }
  revalidatePath('/', 'layout')
  const vagaId = data as string
  // A vaga já foi salva; se não der para calcular o aviso, ela segue sem ele.
  let aviso: string | null = null
  try {
    const recarregada = await carregarVaga(sb, hojeSP(), vagaId)
    if (recarregada) aviso = avisoMeta(recarregada.vaga.previsao, recarregada.vaga.meta)
  } catch {
    aviso = null
  }
  return { ok: true, id: vagaId, aviso }
}

export async function cancelarVaga(id: string): Promise<Resposta> {
  await exigirRh()
  const sb = await criarClienteServidor()
  const { error } = await sb.rpc('cancelar_vaga', { p_id: id })
  return resposta(error)
}
