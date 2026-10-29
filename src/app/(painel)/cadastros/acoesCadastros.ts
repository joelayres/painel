'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { exigirAdmin } from '@/lib/auth/perfil'
import { liberarAcesso, removerAcesso } from '@/lib/cadastros/acessos'
import { alterarUsuario, cadastrarUsuario, PERFIS_USUARIO } from '@/lib/cadastros/usuarios'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { campoData, ehUuid, validar } from '@/lib/validacao/vaga'

export type RespostaAcao = { ok: true } | { ok: false; erros: Record<string, string> }
type Dados = Record<string, unknown>

const data = campoData
const FALHA = { ok: false as const, erros: { _: 'Não foi possível salvar. Tente de novo.' } }

function pronto(): RespostaAcao {
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function salvarCliente(id: string | null, entrada: unknown): Promise<RespostaAcao> {
  await exigirAdmin()
  if (id !== null && !ehUuid(id)) return FALHA
  const r = validar(z.object({ nome: z.string({ error: 'Informe o nome.' }).trim().min(1, 'Informe o nome.') }), entrada)
  if (!r.ok) return r
  const sb = await criarClienteServidor()
  const { error } = await sb.rpc('salvar_cliente', { p_id: id as string, p_nome: r.dados.nome })
  if (error?.code === '23505') return { ok: false, erros: { nome: 'Já existe um cliente com este nome.' } }
  return error ? FALHA : pronto()
}

const esquemaGestor = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.'),
  email: z.string().trim().toLowerCase().transform((v) => v || null).pipe(z.email('E-mail inválido.').nullable()),
})

export async function salvarGestor(clienteId: string, id: string | null, entrada: Dados): Promise<RespostaAcao> {
  await exigirAdmin()
  if (!ehUuid(clienteId)) return FALHA
  const r = validar(esquemaGestor, entrada)
  if (!r.ok) return r
  const sb = await criarClienteServidor()
  const { error } = id ? await sb.from('gestores').update(r.dados).eq('id', id).eq('cliente_id', clienteId) : await sb.from('gestores').insert({ ...r.dados, cliente_id: clienteId })
  return error ? FALHA : pronto()
}

export async function salvarFeriado(entrada: Dados): Promise<RespostaAcao> {
  await exigirAdmin()
  const r = validar(z.object({ data: data('Informe a data.'), nome: z.string().trim().min(1, 'Informe o nome.') }), entrada)
  if (!r.ok) return r
  const sb = await criarClienteServidor()
  const { error } = await sb.from('feriados').upsert(r.dados)
  return error ? FALHA : pronto()
}

export async function removerFeriado(dia: string): Promise<RespostaAcao> {
  await exigirAdmin()
  const sb = await criarClienteServidor()
  const { error } = await sb.from('feriados').delete().eq('data', dia)
  return error ? FALHA : pronto()
}

export async function salvarUsuario(id: string | null, entrada: Dados): Promise<RespostaAcao> {
  const rh = await exigirAdmin()
  const admin = criarClienteAdmin()
  if (!id) {
    const r = await cadastrarUsuario(admin, entrada)
    return r.ok ? pronto() : r
  }
  const v = validar(z.object({ nome: z.string().trim().min(1, 'Informe o nome.'), perfil: z.enum(PERFIS_USUARIO), clienteId: z.string().optional(), ativo: z.string().optional() }), entrada)
  if (!v.ok) return v
  if (v.dados.perfil === 'cliente' && !v.dados.clienteId) return { ok: false, erros: { clienteId: 'Escolha o cliente.' } }
  const ativo = v.dados.ativo === 'on'
  const { data: alvo } = await admin.from('usuarios').select('usuario_id').eq('id', id).single()
  // Ninguém tira o próprio acesso de Administrador por engano.
  if (alvo?.usuario_id === rh.usuarioId && (!ativo || v.dados.perfil !== 'rh')) return { ok: false, erros: { _: 'Você não pode tirar o seu próprio acesso de Administrador.' } }
  const r = await alterarUsuario(admin, id, { nome: v.dados.nome, perfil: v.dados.perfil, clienteId: v.dados.perfil === 'cliente' ? v.dados.clienteId || null : null, ativo })
  return r.ok ? pronto() : r
}

type Resultado = { ok: true } | { ok: false; erro: string }
const FALHA_ACESSO = { ok: false as const, erro: 'Não foi possível salvar. Tente de novo.' }

export async function liberarAcessoUsuario(projetoId: string, usuarioId: string): Promise<Resultado> {
  await exigirAdmin()
  if (!ehUuid(projetoId) || !ehUuid(usuarioId)) return FALHA_ACESSO
  const r = await liberarAcesso(await criarClienteServidor(), projetoId, usuarioId)
  if (r.ok) revalidatePath('/', 'layout')
  return r
}

export async function removerAcessoUsuario(projetoId: string, usuarioId: string): Promise<Resultado> {
  await exigirAdmin()
  if (!ehUuid(projetoId) || !ehUuid(usuarioId)) return FALHA_ACESSO
  const r = await removerAcesso(await criarClienteServidor(), projetoId, usuarioId)
  if (r.ok) revalidatePath('/', 'layout')
  return r
}

export async function excluirCliente(id: string): Promise<RespostaAcao> {
  await exigirAdmin()
  if (!ehUuid(id)) return FALHA
  const sb = await criarClienteServidor()
  const { error } = await sb.rpc('excluir_cliente', { p_id: id })
  if (error?.message.includes('cliente tem projetos')) return { ok: false, erros: { _: 'Este cliente tem projetos e não pode ser excluído.' } }
  if (error?.message.includes('cliente tem usuários')) return { ok: false, erros: { _: 'Há usuários ligados a este cliente. Mude o perfil ou o cliente deles antes.' } }
  return error ? FALHA : pronto()
}
