'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { exigirRh } from '@/lib/auth/perfil'
import { alterarUsuario, cadastrarUsuario } from '@/lib/cadastros/usuarios'
import { gravarCarga } from '@/lib/carga/gravar'
import { lerPlanilhaMobilizacao, type VagaCarga } from '@/lib/carga/ler'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { campoData, validar } from '@/lib/validacao/vaga'

export type RespostaAcao = { ok: true } | { ok: false; erros: Record<string, string> }
type Dados = Record<string, unknown>

const data = campoData
const FALHA = { ok: false as const, erros: { _: 'Não foi possível salvar. Tente de novo.' } }

function pronto(): RespostaAcao {
  revalidatePath('/', 'layout')
  return { ok: true }
}

const esquemaOnda = z
  .object({ numero: z.coerce.number().int().min(1, 'Onda de 1 a 4.').max(4, 'Onda de 1 a 4.'), inicio: data('Informe o início.'), fim: data('Informe o fim.') })
  .refine((o) => o.fim >= o.inicio, { path: ['fim'], message: 'O fim precisa ser no mesmo dia ou depois do início.' })

export async function salvarOnda(id: string | null, entrada: Dados): Promise<RespostaAcao> {
  await exigirRh()
  const r = validar(esquemaOnda, entrada)
  if (!r.ok) return r
  const sb = await criarClienteServidor()
  const { error } = await sb.rpc('salvar_onda', { p_id: id as string, p_numero: r.dados.numero, p_inicio: r.dados.inicio, p_fim: r.dados.fim })
  if (error?.code === '23505') return { ok: false, erros: { numero: 'Esta onda já está cadastrada.' } }
  return error ? FALHA : pronto()
}

const esquemaGestor = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.'),
  email: z.string().trim().toLowerCase().transform((v) => v || null).pipe(z.email('E-mail inválido.').nullable()),
})

export async function salvarGestor(id: string | null, entrada: Dados): Promise<RespostaAcao> {
  await exigirRh()
  const r = validar(esquemaGestor, entrada)
  if (!r.ok) return r
  const sb = await criarClienteServidor()
  const { error } = id ? await sb.from('gestores').update(r.dados).eq('id', id) : await sb.from('gestores').insert(r.dados)
  return error ? FALHA : pronto()
}

export async function alterarDuracao(ordem: number, entrada: Dados): Promise<RespostaAcao> {
  await exigirRh()
  const r = validar(z.object({ duracao: z.coerce.number({ error: 'Informe os dias.' }).int('Só dias inteiros.').min(0, 'Não pode ser negativo.').max(60, 'Máximo de 60 dias.') }), entrada)
  if (!r.ok) return r
  const sb = await criarClienteServidor()
  const { error } = await sb.rpc('alterar_duracao', { p_ordem: ordem, p_dias: r.dados.duracao })
  return error ? FALHA : pronto()
}

export async function salvarFeriado(entrada: Dados): Promise<RespostaAcao> {
  await exigirRh()
  const r = validar(z.object({ data: data('Informe a data.'), nome: z.string().trim().min(1, 'Informe o nome.') }), entrada)
  if (!r.ok) return r
  const sb = await criarClienteServidor()
  const { error } = await sb.from('feriados').upsert(r.dados)
  return error ? FALHA : pronto()
}

export async function removerFeriado(dia: string): Promise<RespostaAcao> {
  await exigirRh()
  const sb = await criarClienteServidor()
  const { error } = await sb.from('feriados').delete().eq('data', dia)
  return error ? FALHA : pronto()
}

export async function salvarUsuario(id: string | null, entrada: Dados): Promise<RespostaAcao> {
  const rh = await exigirRh()
  const admin = criarClienteAdmin()
  if (!id) {
    const r = await cadastrarUsuario(admin, entrada)
    return r.ok ? pronto() : r
  }
  const v = validar(z.object({ nome: z.string().trim().min(1, 'Informe o nome.'), perfil: z.enum(['rh', 'visualizador']), ativo: z.string().optional() }), entrada)
  if (!v.ok) return v
  const ativo = v.dados.ativo === 'on'
  const { data: alvo } = await admin.from('usuarios').select('usuario_id').eq('id', id).single()
  // Ninguém tira o próprio acesso de RH por engano.
  if (alvo?.usuario_id === rh.usuarioId && (!ativo || v.dados.perfil !== 'rh')) return { ok: false, erros: { _: 'Você não pode tirar o seu próprio acesso de RH.' } }
  const r = await alterarUsuario(admin, id, { nome: v.dados.nome, perfil: v.dados.perfil, ativo })
  return r.ok ? pronto() : r
}

export async function previaCarga(form: FormData): Promise<{ ok: true; vagas: VagaCarga[] } | { ok: false; erros: { linha: number; mensagem: string }[] }> {
  await exigirRh()
  const arquivo = form.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erros: [{ linha: 0, mensagem: 'Escolha a planilha.' }] }
  const r = await lerPlanilhaMobilizacao(await arquivo.arrayBuffer())
  return r.ok ? { ok: true, vagas: r.vagas } : r
}

export async function importarCarga(form: FormData): Promise<{ ok: true; vagas: number } | { ok: false; erro: string }> {
  const rh = await exigirRh()
  const previa = await previaCarga(form)
  if (!previa.ok) return { ok: false, erro: 'A planilha tem erros. Corrija e envie de novo.' }
  const r = await gravarCarga(criarClienteAdmin(), previa.vagas, rh.nome)
  if (r.ok) revalidatePath('/', 'layout')
  return r
}
