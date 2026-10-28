'use server'

import { revalidatePath } from 'next/cache'
import { hojeSP } from '@/dominio/tempo'
import { exigirRh } from '@/lib/auth/perfil'
import { lerModeloVagas, type ErroImportacao, type VagaImportada } from '@/lib/importacao/ler'
import { carregarPainel } from '@/lib/painel/dados'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { ehUuid } from '@/lib/validacao/vaga'

export type RespostaPrevia = { ok: true; vagas: VagaImportada[] } | { ok: false; erros: ErroImportacao[] }
export type RespostaImportacao = { ok: true; vagas: number } | { ok: false; erro: string }

const ENCERRADO = 'Este projeto está encerrado. Reabra para alterar.'
const MENSAGENS: [string, string][] = [
  ['projeto encerrado', ENCERRADO],
  ['onda obrigatória', 'A planilha tem uma vaga sem onda. Corrija e envie de novo.'],
  ['onda de outro projeto', 'A planilha tem uma onda de outro projeto. Corrija e envie de novo.'],
  ['meta obrigatória', 'A planilha tem uma vaga sem meta. Corrija e envie de novo.'],
  ['projeto sem ondas', 'Este projeto não tem ondas cadastradas.'],
]

// Relê o arquivo no servidor com os dados atuais do projeto (ondas, gestores, durações e vagas).
export async function previaImportacao(projetoId: string, form: FormData): Promise<RespostaPrevia> {
  await exigirRh()
  if (!ehUuid(projetoId)) return { ok: false, erros: [{ linha: 0, mensagem: 'Projeto inválido.' }] }
  const arquivo = form.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erros: [{ linha: 0, mensagem: 'Escolha a planilha.' }] }

  const sb = await criarClienteServidor()
  const hoje = hojeSP()
  const [painel, feriados] = await Promise.all([carregarPainel(sb, hoje, projetoId), sb.from('feriados').select('data')])
  if (!painel) return { ok: false, erros: [{ linha: 0, mensagem: 'Projeto não encontrado.' }] }
  if (painel.projeto.encerrado) return { ok: false, erros: [{ linha: 0, mensagem: ENCERRADO }] }
  if (feriados.error) throw new Error(`Não foi possível ler os feriados: ${feriados.error.message}`)

  return lerModeloVagas(await arquivo.arrayBuffer(), {
    organizacao: painel.projeto.organizacao,
    ondas: painel.ondas.map(({ id, nome, fim }) => ({ id, nome, fim })),
    gestores: painel.gestores,
    etapas: painel.etapas,
    feriados: new Set(feriados.data.map((f) => f.data)),
    hoje,
    existentes: painel.vagas.map((v) => ({ funcao: v.funcao, candidato: v.candidato, meta: v.meta })),
  })
}

export async function importarVagas(projetoId: string, form: FormData): Promise<RespostaImportacao> {
  await exigirRh()
  const previa = await previaImportacao(projetoId, form)
  if (!previa.ok) return { ok: false, erro: 'A planilha tem erros. Corrija e envie de novo.' }
  if (previa.vagas.length === 0) return { ok: false, erro: 'A planilha não tem vagas.' }

  const sb = await criarClienteServidor()
  const { data, error } = await sb.rpc('importar_vagas', {
    p_projeto: projetoId,
    p_vagas: previa.vagas.map((v) => ({
      funcao: v.funcao,
      disciplina: v.disciplina,
      area: v.area,
      gestor_id: v.gestorId,
      onda_id: v.ondaId,
      // Por ondas, a meta é o fim da onda (lida da onda a cada vez); só o projeto meta grava a data.
      meta: v.ondaId ? null : v.meta,
      candidato: v.candidato,
      data_inicio: v.dataInicio,
      concluidas: v.concluidas.map((c) => ({ ordem: c.ordem, concluida_em: c.concluidaEm })),
    })),
  })
  if (error) {
    const conhecida = MENSAGENS.find(([chave]) => error.message.includes(chave))
    return { ok: false, erro: conhecida?.[1] ?? 'Não foi possível importar. Tente de novo.' }
  }
  revalidatePath('/', 'layout')
  return { ok: true, vagas: data }
}
