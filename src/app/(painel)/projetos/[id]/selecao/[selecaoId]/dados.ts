import 'server-only'
import { semTipos } from '@/lib/curriculos/rpc'
import type { criarClienteServidor } from '@/lib/supabase/servidor'

export type AnaliseIA = {
  id: string
  nota: number
  classificacao: 'aderente' | 'parcial' | 'nao_aderente'
  modelo: string
  criado_em: string
  descritivo: string
  resposta: {
    resumo: string
    requisitos: { requisito: string; atende: 'sim' | 'parcial' | 'nao'; evidencia: string }[]
    pontosFortes: string[]
    lacunas: string[]
  }
}

export type Entrevista = { id: string; tipo: 'timenow' | 'cliente'; data: string; entrevistador: string; parecer: 'recomendado' | 'ressalvas' | 'nao_recomendado'; impressoes: string; registrado_por: string }

export type Participacao = {
  id: string
  situacao: 'pendente' | 'analisando' | 'analisada' | 'erro' | 'repetida'
  analisando_desde: string | null
  erro: string | null
  classificacao: 'a_confirmar' | 'aderente' | 'parcial' | 'nao_aderente' | null
  classificacao_por: string | null
  resultado: 'em_andamento' | 'escolhido' | 'aprovado_nao_escolhido' | 'reprovado' | 'desistiu'
  do_banco: boolean
  indicado_por: string | null
  curriculo_id: string
  candidato: { id: string; nome: string; email: string | null; telefone: string | null; cidade: string | null; uf: string | null } | null
  curriculo: { nome_arquivo: string }
  analises: AnaliseIA[]
  entrevistas: Entrevista[]
}

export type Selecao = { id: string; projeto_id: string; funcao: string; descritivo: string; encerrada_em: string | null }

// A seleção com as participações, a análise mais recente primeiro e as entrevistas por data.
export async function carregarSelecao(sb: Awaited<ReturnType<typeof criarClienteServidor>>, selecaoId: string) {
  const db = semTipos(sb)
  const [{ data: selecao }, { data: participacoes, error }] = await Promise.all([
    db.from('selecoes').select('id, projeto_id, funcao, descritivo, encerrada_em').eq('id', selecaoId).maybeSingle<Selecao>(),
    db
      .from('participacoes')
      .select('id, situacao, analisando_desde, erro, classificacao, classificacao_por, resultado, do_banco, indicado_por, curriculo_id, candidato:candidatos(id, nome, email, telefone, cidade, uf), curriculo:curriculos(nome_arquivo), analises:analises_ia(id, nota, classificacao, modelo, criado_em, descritivo, resposta), entrevistas(id, tipo, data, entrevistador, parecer, impressoes, registrado_por)')
      .eq('selecao_id', selecaoId)
      .order('criado_em')
      .returns<Participacao[]>(),
  ])
  if (error) throw new Error(`Não foi possível ler a seleção: ${error.message}`)
  if (!selecao) return null
  const lista = (participacoes ?? []).map((p) => ({
    ...p,
    analises: [...p.analises].sort((a, b) => b.criado_em.localeCompare(a.criado_em)),
    entrevistas: [...p.entrevistas].sort((a, b) => a.data.localeCompare(b.data)),
  }))
  return { selecao, participacoes: lista }
}

export type Pendente = { id: string; arquivo: string; erro: string | null }

// Pendentes para "continuar análise": nunca analisadas, com erro, ou paradas há mais de 5 minutos.
export function pendentesDaSelecao(ps: Pick<Participacao, 'id' | 'situacao' | 'analisando_desde' | 'erro' | 'curriculo'>[], agora = Date.now()): Pendente[] {
  return ps
    .filter((p) => p.situacao === 'pendente' || p.situacao === 'erro' || (p.situacao === 'analisando' && p.analisando_desde !== null && agora - Date.parse(p.analisando_desde) > 5 * 60 * 1000))
    .map((p) => ({ id: p.id, arquivo: p.curriculo.nome_arquivo, erro: p.situacao === 'erro' ? p.erro : null }))
}

// Quantas estão sendo analisadas agora (há menos de 5 minutos), por outra aba ou outra pessoa.
export function emAndamentoDaSelecao(ps: Pick<Participacao, 'situacao' | 'analisando_desde'>[], agora = Date.now()): number {
  return ps.filter((p) => p.situacao === 'analisando' && p.analisando_desde !== null && agora - Date.parse(p.analisando_desde) <= 5 * 60 * 1000).length
}
