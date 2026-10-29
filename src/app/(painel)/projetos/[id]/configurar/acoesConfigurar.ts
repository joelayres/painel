'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { avisoMeta } from '@/dominio/situacao'
import { hojeSP } from '@/dominio/tempo'
import { exigirEquipe } from '@/lib/auth/perfil'
import { liberarAcesso, removerAcesso } from '@/lib/cadastros/acessos'
import { nomeReservado } from '@/lib/importacao/modelo'
import { carregarPainel } from '@/lib/painel/dados'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { traduzirErro } from '@/lib/validacao/mensagens'
import { campoData, dataValida, ehUuid, validar } from '@/lib/validacao/vaga'

export type RespostaAcao = { ok: true } | { ok: false; erros: Record<string, string> }

const FALHA = { ok: false as const, erros: { _: 'Não foi possível salvar. Tente de novo.' } }
const ENCERRADO = { ok: false as const, erros: { _: 'Este projeto está encerrado. Reabra para alterar.' } }
const PROJETO_INVALIDO = { ok: false as const, erros: { _: 'Projeto inválido.' } }

function pronto(): RespostaAcao {
  revalidatePath('/', 'layout')
  return { ok: true }
}

const esquemaOnda = z
  .object({
    nome: z.string({ error: 'Informe o nome.' }).trim().min(1, 'Informe o nome.'),
    inicio: campoData('Informe o início.'),
    fim: campoData('Informe o fim.'),
  })
  .refine((o) => o.fim >= o.inicio, { path: ['fim'], message: 'O fim precisa ser no mesmo dia ou depois do início.' })

export async function salvarOndaProjeto(projetoId: string, id: string | null, entrada: unknown): Promise<RespostaAcao> {
  await exigirEquipe()
  if (!ehUuid(projetoId)) return PROJETO_INVALIDO
  const r = validar(esquemaOnda, entrada)
  if (!r.ok) return r
  const sb = await criarClienteServidor()
  const { error } = await sb.rpc('salvar_onda_projeto', { p_id: id as string, p_projeto: projetoId, p_nome: r.dados.nome, p_inicio: r.dados.inicio, p_fim: r.dados.fim })
  if (error?.code === '23505') return { ok: false, erros: { nome: 'Já existe uma onda com este nome.' } }
  if (error?.message.includes('projeto encerrado')) return ENCERRADO
  return error ? FALHA : pronto()
}

// Vazio volta ao padrão do cliente (o banco recebe null).
const esquemaDuracao = z.object({
  duracao: z
    .string({ error: 'Informe os dias.' })
    .trim()
    .transform((v, ctx) => {
      if (v === '') return null
      const n = Number(v)
      if (!Number.isInteger(n)) {
        ctx.addIssue({ code: 'custom', message: 'Só dias inteiros.' })
        return z.NEVER
      }
      if (n < 0) {
        ctx.addIssue({ code: 'custom', message: 'Não pode ser negativo.' })
        return z.NEVER
      }
      if (n > 60) {
        ctx.addIssue({ code: 'custom', message: 'Máximo de 60 dias.' })
        return z.NEVER
      }
      return n
    }),
})

// Traduz as mensagens do banco para o campo certo da tela.
function erroDeEtapa(mensagem: string): RespostaAcao {
  if (mensagem.includes('projeto encerrado')) return ENCERRADO
  const texto = (m: string, campo = '_'): RespostaAcao => ({ ok: false, erros: { [campo]: m } })
  if (mensagem.includes('etapa obrigatória')) return texto('Esta etapa é obrigatória e não pode ser excluída nem renomeada.')
  if (mensagem.includes('etapa repetida')) return texto('Já existe uma etapa com este nome no projeto.', 'nome')
  if (mensagem.includes('projeto tem vagas')) return texto('A ordem das etapas só muda antes de o projeto ter vagas.')
  if (mensagem.includes('ordem das obrigatórias')) return texto('A Captura de Mercado precisa vir antes da Admissão Timenow.')
  if (mensagem.includes('duração obrigatória')) return texto('Informe a duração desta etapa.', 'duracao')
  return FALHA
}

const RESERVADO: RespostaAcao = { ok: false, erros: { nome: 'Este nome é usado por uma coluna fixa da planilha. Escolha outro.' } }

const esquemaNome = z.object({ nome: z.string({ error: 'Informe o nome.' }).trim().min(1, 'Informe o nome.') })

const esquemaInclusao = z.object({
  nome: z.string({ error: 'Informe o nome.' }).trim().min(1, 'Informe o nome.'),
  duracao: z
    .string({ error: 'Informe a duração.' })
    .trim()
    .transform((v, ctx) => {
      const n = Number(v)
      if (v === '' || !Number.isInteger(n) || n < 0 || n > 60) {
        ctx.addIssue({ code: 'custom', message: v === '' ? 'Informe a duração.' : 'Use dias inteiros, de 0 a 60.' })
        return z.NEVER
      }
      return n
    }),
  depoisDe: z.string().trim(),
})

export async function incluirEtapa(projetoId: string, entrada: { nome: string; duracao: string; depoisDe: string }): Promise<RespostaAcao> {
  await exigirEquipe()
  if (!ehUuid(projetoId)) return PROJETO_INVALIDO
  const r = validar(esquemaInclusao, entrada)
  if (!r.ok) return r
  if (nomeReservado(r.dados.nome)) return RESERVADO
  if (r.dados.depoisDe !== '' && !ehUuid(r.dados.depoisDe)) return { ok: false, erros: { depoisDe: 'Escolha uma etapa válida.' } }
  const sb = await criarClienteServidor()
  const { error } = await sb.rpc('incluir_etapa', { p_projeto: projetoId, p_nome: r.dados.nome, p_duracao: r.dados.duracao, p_depois_de: (r.dados.depoisDe || null) as string })
  if (error) return erroDeEtapa(error.message)
  return pronto()
}

export async function excluirEtapa(projetoId: string, etapaId: string): Promise<RespostaAcao> {
  await exigirEquipe()
  if (!ehUuid(projetoId) || !ehUuid(etapaId)) return PROJETO_INVALIDO
  const sb = await criarClienteServidor()
  const { error } = await sb.rpc('excluir_etapa', { p_etapa: etapaId })
  if (error) return erroDeEtapa(error.message)
  return pronto()
}

export async function renomearEtapa(projetoId: string, etapaId: string, entrada: { nome: string }): Promise<RespostaAcao> {
  await exigirEquipe()
  if (!ehUuid(projetoId) || !ehUuid(etapaId)) return PROJETO_INVALIDO
  const r = validar(esquemaNome, entrada)
  if (!r.ok) return r
  if (nomeReservado(r.dados.nome)) return RESERVADO
  const sb = await criarClienteServidor()
  const { error } = await sb.rpc('renomear_etapa', { p_etapa: etapaId, p_nome: r.dados.nome })
  if (error) return erroDeEtapa(error.message)
  return pronto()
}

export async function moverEtapa(projetoId: string, etapaId: string, para: number): Promise<RespostaAcao> {
  await exigirEquipe()
  if (!ehUuid(projetoId) || !ehUuid(etapaId) || !Number.isInteger(para) || para < 1) return PROJETO_INVALIDO
  const sb = await criarClienteServidor()
  const { error } = await sb.rpc('mover_etapa', { p_etapa: etapaId, p_para: para })
  if (error) return erroDeEtapa(error.message)
  return pronto()
}

export async function alterarDuracaoEtapa(projetoId: string, etapaId: string, entrada: { duracao: string }): Promise<RespostaAcao> {
  await exigirEquipe()
  if (!ehUuid(projetoId) || !ehUuid(etapaId)) return PROJETO_INVALIDO
  const r = validar(esquemaDuracao, entrada)
  if (!r.ok) return r
  const sb = await criarClienteServidor()
  const { error } = await sb.rpc('alterar_duracao_etapa', { p_etapa: etapaId, p_dias: r.dados.duracao as number })
  if (error) return erroDeEtapa(error.message)
  return pronto()
}

type Resultado = { ok: true } | { ok: false; erro: string }

export async function liberar(projetoId: string, usuarioId: string): Promise<Resultado> {
  await exigirEquipe()
  if (!ehUuid(projetoId) || !ehUuid(usuarioId)) return { ok: false, erro: 'Não foi possível salvar. Tente de novo.' }
  const r = await liberarAcesso(await criarClienteServidor(), projetoId, usuarioId)
  if (r.ok) revalidatePath('/', 'layout')
  return r
}

export async function remover(projetoId: string, usuarioId: string): Promise<Resultado> {
  await exigirEquipe()
  if (!ehUuid(projetoId) || !ehUuid(usuarioId)) return { ok: false, erro: 'Não foi possível salvar. Tente de novo.' }
  const r = await removerAcesso(await criarClienteServidor(), projetoId, usuarioId)
  if (r.ok) revalidatePath('/', 'layout')
  return r
}

// Ações em grupo nas vagas: tudo ou nada. O banco diz qual vaga travou ('vaga <id>: <motivo>').
export type RespostaGrupo = { ok: true; alteradas: number; puladas: number; foraDaMeta: number } | { ok: false; erro: string; vagaId: string | null }

const ERRO_GRUPO = 'Não foi possível aplicar. Tente de novo.'
const CAMPOS_GRUPO = ['onda_id', 'meta', 'data_inicio'] as const

function erroDoGrupo(mensagem: string): RespostaGrupo {
  const m = /^vaga ([0-9a-f-]{36}): ([\s\S]*)$/i.exec(mensagem)
  return m ? { ok: false, vagaId: m[1], erro: traduzirErro(m[2], ERRO_GRUPO) } : { ok: false, vagaId: null, erro: traduzirErro(mensagem, ERRO_GRUPO) }
}

function grupoInvalido(projetoId: string, vagaIds: string[]): RespostaGrupo | null {
  if (!ehUuid(projetoId)) return { ok: false, vagaId: null, erro: 'Projeto inválido.' }
  if (vagaIds.length === 0) return { ok: false, vagaId: null, erro: 'Selecione pelo menos uma vaga.' }
  if (!vagaIds.every(ehUuid)) return { ok: false, vagaId: null, erro: 'Vaga inválida.' }
  return null
}

// Quantas vagas do grupo ficaram com a admissão prevista depois da meta (o aviso de meta curta, em grupo).
async function contarForaDaMeta(sb: Awaited<ReturnType<typeof criarClienteServidor>>, projetoId: string, vagaIds: string[]): Promise<number> {
  const painel = await carregarPainel(sb, hojeSP(), projetoId)
  const grupo = new Set(vagaIds)
  return (painel?.vagas ?? []).filter((v) => grupo.has(v.id) && avisoMeta(v.previsao, v.meta) !== null).length
}

export async function avancarEmGrupo(projetoId: string, vagaIds: string[], ordem: number, data: string): Promise<RespostaGrupo> {
  await exigirEquipe()
  const invalido = grupoInvalido(projetoId, vagaIds)
  if (invalido) return invalido
  if (!dataValida(data)) return { ok: false, vagaId: null, erro: 'Informe uma data válida.' }
  const sb = await criarClienteServidor()
  const { data: n, error } = await sb.rpc('concluir_etapa_em_grupo', { p_vagas: vagaIds, p_ordem_esperada: ordem, p_data: data })
  if (error) return erroDoGrupo(error.message)
  revalidatePath('/', 'layout')
  return { ok: true, alteradas: Number(n), puladas: 0, foraDaMeta: 0 }
}

export async function alterarEmGrupo(projetoId: string, vagaIds: string[], campo: (typeof CAMPOS_GRUPO)[number], valor: string): Promise<RespostaGrupo> {
  await exigirEquipe()
  const invalido = grupoInvalido(projetoId, vagaIds)
  if (invalido) return invalido
  if (!CAMPOS_GRUPO.includes(campo)) return { ok: false, vagaId: null, erro: ERRO_GRUPO }
  if (campo === 'onda_id' ? !ehUuid(valor) : !dataValida(valor)) return { ok: false, vagaId: null, erro: campo === 'onda_id' ? 'Escolha a onda.' : 'Informe uma data válida.' }
  const sb = await criarClienteServidor()
  const { data: r, error } = await sb.rpc('alterar_vagas_em_grupo', { p_vagas: vagaIds, p_campo: campo, p_valor: valor })
  if (error) return erroDoGrupo(error.message)
  revalidatePath('/', 'layout')
  const { alteradas, puladas } = r as { alteradas: number; puladas: number }
  return { ok: true, alteradas, puladas, foraDaMeta: await contarForaDaMeta(sb, projetoId, vagaIds) }
}
