'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { exigirEquipe } from '@/lib/auth/perfil'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { validar } from '@/lib/validacao/vaga'

const SEM_ACESSO = 'Você não tem acesso a este projeto.'

type Resposta = { ok: true } | { ok: false; erro: string }

const esquemaProjeto = z.object({
  nome: z.string({ error: 'Informe o nome.' }).trim().min(1, 'Informe o nome.'),
  clienteId: z.uuid('Escolha o cliente.'),
  area: z.string().nullish().transform((v) => (v?.trim() ? v.trim() : null)),
  organizacao: z.enum(['ondas', 'meta'], { error: 'Escolha a organização.' }),
})

export async function salvarProjeto(id: string | null, entrada: unknown): Promise<{ ok: true; id: string } | { ok: false; erros: Record<string, string> }> {
  await exigirEquipe()
  const r = validar(esquemaProjeto, entrada)
  if (!r.ok) return r
  const d = r.dados
  const sb = await criarClienteServidor()
  const { data, error } = await sb.rpc('salvar_projeto', {
    p_id: id as string,
    p: { cliente_id: d.clienteId, nome: d.nome, area: d.area, organizacao: d.organizacao },
  })
  if (error || !data) {
    if (error?.message.includes('sem permissão')) return { ok: false, erros: { _: SEM_ACESSO } }
    if (error?.message.includes('cliente não muda')) return { ok: false, erros: { _: 'O cliente de um projeto não muda.' } }
    if (error?.message.includes('projeto tem vagas')) return { ok: false, erros: { organizacao: 'Este projeto já tem vagas. Para mudar a organização, crie outro projeto.' } }
    if (error?.code === '23505') return { ok: false, erros: { nome: 'Já existe um projeto com este nome neste cliente.' } }
    return { ok: false, erros: { _: 'Não foi possível salvar o projeto. Tente de novo.' } }
  }
  revalidatePath('/', 'layout')
  return { ok: true, id: data as string }
}

async function mudarSituacao(funcao: 'encerrar_projeto' | 'reabrir_projeto', id: string): Promise<Resposta> {
  await exigirEquipe()
  const sb = await criarClienteServidor()
  const { error } = await sb.rpc(funcao, { p_id: id })
  if (error) return { ok: false, erro: error.message.includes('sem permissão') ? SEM_ACESSO : 'Não foi possível salvar. Tente de novo.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export const encerrarProjeto = async (id: string) => mudarSituacao('encerrar_projeto', id)
export const reabrirProjeto = async (id: string) => mudarSituacao('reabrir_projeto', id)
