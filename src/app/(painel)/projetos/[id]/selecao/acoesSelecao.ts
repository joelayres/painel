'use server'

import { revalidatePath } from 'next/cache'
import { exigirEquipe } from '@/lib/auth/perfil'
import { analisarCurriculo, ErroAnalise } from '@/lib/curriculos/ia'
import { VERSAO_PROMPT } from '@/lib/curriculos/pedido'
import { rpcLivre, semTipos } from '@/lib/curriculos/rpc'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { traduzirErro } from '@/lib/validacao/mensagens'

type Resposta = { ok: true } | { ok: false; erro: string }
type Erro = { ok: false; erro: string }

const PADRAO = 'Não foi possível salvar. Tente de novo.'
const falha = (error: { message: string }, padrao = PADRAO): Erro => ({ ok: false, erro: traduzirErro(error.message, padrao) })

function resposta(error: { message: string } | null): Resposta {
  if (error) return falha(error)
  revalidatePath('/', 'layout')
  return { ok: true }
}

async function chamar(nome: string, args: Record<string, unknown>): Promise<Resposta> {
  await exigirEquipe()
  const { error } = await rpcLivre(await criarClienteServidor(), nome, args)
  return resposta(error)
}

export async function salvarSelecao(id: string | null, entrada: { projetoId: string; funcao: string; descritivo: string }): Promise<{ ok: true; id: string } | Erro> {
  await exigirEquipe()
  const { data, error } = await rpcLivre<string>(await criarClienteServidor(), 'salvar_selecao', {
    p_id: id,
    p: { projeto_id: entrada.projetoId, funcao: entrada.funcao, descritivo: entrada.descritivo },
  })
  if (error || !data) return falha(error ?? { message: '' })
  revalidatePath('/', 'layout')
  return { ok: true, id: data }
}

export async function encerrarSelecao(id: string, encerrar: boolean): Promise<Resposta> {
  return chamar('encerrar_selecao', { p_id: id, p_encerrar: encerrar })
}

// O PDF já foi enviado pelo navegador ao Storage, na pasta da seleção.
export async function registrarCurriculo(selecaoId: string, caminho: string, nomeArquivo: string): Promise<{ ok: true; participacaoId: string } | Erro> {
  await exigirEquipe()
  const { data, error } = await rpcLivre<string>(await criarClienteServidor(), 'registrar_curriculo', { p_selecao: selecaoId, p_caminho: caminho, p_nome_arquivo: nomeArquivo })
  if (error || !data) return falha(error ?? { message: '' }, 'Não foi possível registrar o currículo.')
  return { ok: true, participacaoId: data }
}

// Uma análise por chamada (a tela conduz a fila). A permissão é conferida com a sessão; o resultado
// da IA é gravado pelo servidor, que é o único que pode gravá-lo.
export async function analisarParticipacao(participacaoId: string): Promise<{ ok: true; situacao: 'analisada' | 'repetida' } | Erro> {
  const sessao = await exigirEquipe()
  const sb = await criarClienteServidor()
  const inicio = await rpcLivre<{ caminho: string; nome_arquivo: string; descritivo: string }[]>(sb, 'iniciar_analise', { p_participacao: participacaoId })
  if (inicio.error || !inicio.data?.[0]) return falha(inicio.error ?? { message: '' }, 'Não foi possível iniciar a análise.')
  const { caminho, descritivo } = inicio.data[0]
  const admin = criarClienteAdmin()

  try {
    const arquivo = await sb.storage.from('curriculos').download(caminho)
    if (arquivo.error || !arquivo.data) throw new ErroAnalise('Não foi possível ler o arquivo enviado.')
    const r = await analisarCurriculo(Buffer.from(await arquivo.data.arrayBuffer()), descritivo)
    const { data, error } = await rpcLivre<'analisada' | 'repetida'>(admin, 'registrar_analise', {
      p_participacao: participacaoId,
      p: {
        modelo: r.modelo,
        versao_prompt: VERSAO_PROMPT,
        nota: r.analise.nota,
        classificacao: r.analise.classificacao,
        resposta: r.analise,
        tokens_entrada: r.tokensEntrada,
        tokens_saida: r.tokensSaida,
        nome_usuario: sessao.nome,
        candidato: r.analise.candidato,
      },
    })
    if (error || !data) throw new ErroAnalise('Não foi possível gravar a análise.')
    return { ok: true, situacao: data }
  } catch (e) {
    const erro = e instanceof ErroAnalise ? e.message : 'Falha inesperada na análise.'
    await rpcLivre(admin, 'falhar_analise', { p_participacao: participacaoId, p_erro: erro })
    return { ok: false, erro }
  }
}

export async function reanalisar(ids: string[]): Promise<Resposta> {
  return chamar('reanalisar', { p_participacoes: ids })
}

export async function incluirDoBanco(selecaoId: string, candidatoIds: string[]): Promise<{ ok: true; incluidos: number } | Erro> {
  await exigirEquipe()
  const { data, error } = await rpcLivre<number>(await criarClienteServidor(), 'incluir_do_banco', { p_selecao: selecaoId, p_candidatos: candidatoIds })
  if (error) return falha(error)
  revalidatePath('/', 'layout')
  return { ok: true, incluidos: data ?? 0 }
}

export async function confirmarClassificacao(ids: string[]): Promise<Resposta> {
  return chamar('confirmar_classificacao', { p_participacoes: ids })
}

export async function mudarClassificacao(id: string, classificacao: string, justificativa: string): Promise<Resposta> {
  return chamar('mudar_classificacao', { p_participacao: id, p_classificacao: classificacao, p_justificativa: justificativa })
}

export type EntradaEntrevista = { tipo: string; data: string; entrevistador: string; parecer: string; impressoes: string }

export async function salvarEntrevista(id: string | null, participacaoId: string, entrada: EntradaEntrevista): Promise<Resposta> {
  return chamar('salvar_entrevista', { p_id: id, p_participacao: participacaoId, p: entrada })
}

// Texto vazio tira a indicação.
export async function definirIndicacao(id: string, indicadoPor: string): Promise<Resposta> {
  return chamar('definir_indicacao', { p_participacao: id, p_indicado_por: indicadoPor })
}

export async function definirResultado(id: string, resultado: string): Promise<Resposta> {
  return chamar('definir_resultado', { p_participacao: id, p_resultado: resultado })
}

// Link de 60 segundos para abrir o PDF; o RLS decide se a pessoa pode ler o currículo.
export async function linkCurriculo(curriculoId: string): Promise<{ ok: true; url: string } | Erro> {
  await exigirEquipe()
  const sb = await criarClienteServidor()
  const { data } = await semTipos(sb).from('curriculos').select('caminho').eq('id', curriculoId).maybeSingle<{ caminho: string }>()
  if (!data) return { ok: false, erro: 'Currículo não encontrado.' }
  const link = await sb.storage.from('curriculos').createSignedUrl(data.caminho, 60)
  if (link.error || !link.data) return { ok: false, erro: 'Não foi possível abrir o currículo.' }
  return { ok: true, url: link.data.signedUrl }
}

// Escolhido: leva o nome para o campo Candidato de uma vaga da mesma função, pela função de sempre.
export async function levarParaVaga(vagaId: string, nome: string): Promise<Resposta> {
  await exigirEquipe()
  const sb = await criarClienteServidor()
  const { data: v } = await sb.from('vagas').select('funcao, disciplina, area, onda_id, meta, gestor_id, data_inicio').eq('id', vagaId).maybeSingle()
  if (!v) return { ok: false, erro: 'Vaga não encontrada.' }
  const { error } = await sb.rpc('salvar_vaga', { p_id: vagaId, p: { ...v, candidato: nome } })
  return resposta(error)
}
