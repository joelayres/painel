'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { exigirRh } from '@/lib/auth/perfil'
import { liberarAcesso, removerAcesso } from '@/lib/cadastros/acessos'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { campoData, ehUuid, validar } from '@/lib/validacao/vaga'

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
  await exigirRh()
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

export async function alterarDuracaoProjeto(projetoId: string, ordem: number, entrada: { duracao: string }): Promise<RespostaAcao> {
  await exigirRh()
  if (!ehUuid(projetoId)) return PROJETO_INVALIDO
  const r = validar(esquemaDuracao, entrada)
  if (!r.ok) return r
  const sb = await criarClienteServidor()
  const { error } = await sb.rpc('alterar_duracao_projeto', { p_projeto: projetoId, p_ordem: ordem, p_dias: r.dados.duracao as number })
  if (error?.message.includes('projeto encerrado')) return ENCERRADO
  return error ? FALHA : pronto()
}

type Resultado = { ok: true } | { ok: false; erro: string }

export async function liberar(projetoId: string, usuarioId: string): Promise<Resultado> {
  await exigirRh()
  if (!ehUuid(projetoId) || !ehUuid(usuarioId)) return { ok: false, erro: 'Não foi possível salvar. Tente de novo.' }
  const r = await liberarAcesso(await criarClienteServidor(), projetoId, usuarioId)
  if (r.ok) revalidatePath('/', 'layout')
  return r
}

export async function remover(projetoId: string, usuarioId: string): Promise<Resultado> {
  await exigirRh()
  if (!ehUuid(projetoId) || !ehUuid(usuarioId)) return { ok: false, erro: 'Não foi possível salvar. Tente de novo.' }
  const r = await removerAcesso(await criarClienteServidor(), projetoId, usuarioId)
  if (r.ok) revalidatePath('/', 'layout')
  return r
}
