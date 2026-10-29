'use server'

// Lista padrão de etapas do cliente (só o Administrador). Mesma forma das ações da lista do projeto,
// para o componente de etapas servir aos dois.
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { exigirAdmin } from '@/lib/auth/perfil'
import { nomeReservado } from '@/lib/importacao/modelo'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { ehUuid, validar } from '@/lib/validacao/vaga'

type RespostaAcao = { ok: true } | { ok: false; erros: Record<string, string> }

const FALHA = { ok: false as const, erros: { _: 'Não foi possível salvar. Tente de novo.' } }
const INVALIDO = { ok: false as const, erros: { _: 'Cliente ou etapa inválidos.' } }
const RESERVADO = { ok: false as const, erros: { nome: 'Este nome é usado por uma coluna fixa da planilha. Escolha outro.' } }

const dias = z.coerce.number({ error: 'Informe os dias.' }).int('Só dias inteiros.').min(0, 'Não pode ser negativo.').max(60, 'Máximo de 60 dias.')
const esquemaNome = z.object({ nome: z.string({ error: 'Informe o nome.' }).trim().min(1, 'Informe o nome.') })
const esquemaInclusao = esquemaNome.extend({ duracao: dias, depoisDe: z.string() })
// Aqui vazio não é "voltar ao padrão" (o cliente é o padrão): a duração é obrigatória.
const esquemaDuracao = z.object({ duracao: z.string().trim().min(1, 'Informe os dias.').transform(Number).pipe(z.number().int('Só dias inteiros.').min(0, 'Não pode ser negativo.').max(60, 'Máximo de 60 dias.')) })

function pronto(): RespostaAcao {
  revalidatePath('/', 'layout')
  return { ok: true }
}

function erroDeEtapa(mensagem: string): RespostaAcao {
  const texto = (m: string, campo = '_'): RespostaAcao => ({ ok: false, erros: { [campo]: m } })
  if (mensagem.includes('etapa obrigatória')) return texto('Esta etapa é obrigatória e não pode ser excluída nem renomeada.')
  if (mensagem.includes('etapa repetida')) return texto('Já existe uma etapa com este nome neste cliente.', 'nome')
  if (mensagem.includes('ordem das obrigatórias')) return texto('A Captura de Mercado precisa vir antes da Admissão Timenow.')
  if (mensagem.includes('duração obrigatória')) return texto('Informe a duração desta etapa.', 'duracao')
  return FALHA
}

async function resposta(r: PromiseLike<{ error: { message: string } | null }>): Promise<RespostaAcao> {
  const { error } = await r
  return error ? erroDeEtapa(error.message) : pronto()
}

export async function incluirEtapaCliente(clienteId: string, entrada: { nome: string; duracao: string; depoisDe: string }): Promise<RespostaAcao> {
  await exigirAdmin()
  if (!ehUuid(clienteId)) return INVALIDO
  const r = validar(esquemaInclusao, entrada)
  if (!r.ok) return r
  if (nomeReservado(r.dados.nome)) return RESERVADO
  if (r.dados.depoisDe !== '' && !ehUuid(r.dados.depoisDe)) return { ok: false, erros: { depoisDe: 'Escolha uma etapa válida.' } }
  const sb = await criarClienteServidor()
  return resposta(sb.rpc('incluir_etapa_cliente', { p_cliente: clienteId, p_nome: r.dados.nome, p_duracao: r.dados.duracao, p_depois_de: (r.dados.depoisDe || null) as string }))
}

export async function excluirEtapaCliente(clienteId: string, etapaId: string): Promise<RespostaAcao> {
  await exigirAdmin()
  if (!ehUuid(clienteId) || !ehUuid(etapaId)) return INVALIDO
  return resposta((await criarClienteServidor()).rpc('excluir_etapa_cliente', { p_etapa: etapaId }))
}

export async function renomearEtapaCliente(clienteId: string, etapaId: string, entrada: { nome: string }): Promise<RespostaAcao> {
  await exigirAdmin()
  if (!ehUuid(clienteId) || !ehUuid(etapaId)) return INVALIDO
  const r = validar(esquemaNome, entrada)
  if (!r.ok) return r
  if (nomeReservado(r.dados.nome)) return RESERVADO
  return resposta((await criarClienteServidor()).rpc('renomear_etapa_cliente', { p_etapa: etapaId, p_nome: r.dados.nome }))
}

export async function moverEtapaCliente(clienteId: string, etapaId: string, para: number): Promise<RespostaAcao> {
  await exigirAdmin()
  if (!ehUuid(clienteId) || !ehUuid(etapaId) || !Number.isInteger(para)) return INVALIDO
  return resposta((await criarClienteServidor()).rpc('mover_etapa_cliente', { p_etapa: etapaId, p_para: para }))
}

export async function alterarDuracaoEtapaCliente(clienteId: string, etapaId: string, entrada: { duracao: string }): Promise<RespostaAcao> {
  await exigirAdmin()
  if (!ehUuid(clienteId) || !ehUuid(etapaId)) return INVALIDO
  const r = validar(esquemaDuracao, entrada)
  if (!r.ok) return r
  return resposta((await criarClienteServidor()).rpc('alterar_duracao_etapa_cliente', { p_etapa: etapaId, p_dias: r.dados.duracao }))
}
