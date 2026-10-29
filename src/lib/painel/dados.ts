// Lê os fatos do banco e monta as vagas do painel (previsão e cor calculadas aqui, a cada leitura).
import type { SupabaseClient } from '@supabase/supabase-js'
import { etapasDoProjeto, type EtapaDef, type LinhaEtapaProjeto } from '@/dominio/etapas'
import { resumirProjeto, type OndaVaga, type ResumoGrupo, type VagaPainel } from '@/dominio/painel'
import { preverVaga } from '@/dominio/previsao'
import { situacaoVaga } from '@/dominio/situacao'
import type { Database } from '@/lib/supabase/tipos'

type LinhaVaga = {
  id: string
  projeto_id: string | null
  meta: string | null
  funcao: string
  disciplina: string
  area: string
  onda_id: string | null
  gestor_id: string | null
  candidato: string | null
  data_inicio: string
  retomada_em: string | null
  cancelada_em: string | null
}
type Organizacao = 'ondas' | 'meta'
type LinhaProjeto = { id: string; nome: string; area: string | null; organizacao: Organizacao; encerrado_em: string | null; cliente_id: string }
export type LinhasPainel = {
  vagas: LinhaVaga[]
  conclusoes: { vaga_id: string; etapa_id: string; automatica: boolean; concluida_em: string }[]
  projetoEtapas: (LinhaEtapaProjeto & { projeto_id: string })[]
  feriados: { data: string }[]
  ondas: (OndaVaga & { projeto_id: string })[]
  gestores: { id: string; nome: string }[]
  projetos: LinhaProjeto[]
  clientes: { id: string; nome: string }[]
  clienteDuracoes: { cliente_id: string; ordem: number; duracao: number }[]
}

export type ProjetoInfo = { id: string; nome: string; area: string | null; organizacao: Organizacao; encerrado: boolean; cliente: { id: string; nome: string } }
export type CartaoProjeto = ProjetoInfo & { ondas: number; resumo: ResumoGrupo }

function duracoesDoCliente(linhas: LinhasPainel['clienteDuracoes'], clienteId: string): Map<number, number> {
  return new Map(linhas.filter((l) => l.cliente_id === clienteId).map((l) => [l.ordem, l.duracao]))
}

// A lista efetiva de um projeto: suas linhas de etapa com as durações do cliente onde a linha não define a sua.
function etapasEfetivas(l: Pick<LinhasPainel, 'projetoEtapas' | 'clienteDuracoes'>, p: LinhaProjeto): EtapaDef[] {
  return etapasDoProjeto(l.projetoEtapas.filter((e) => e.projeto_id === p.id), duracoesDoCliente(l.clienteDuracoes, p.cliente_id))
}

export function montarPainel(l: LinhasPainel, hoje: string): VagaPainel[] {
  const feriados = new Set(l.feriados.map((f) => f.data))
  const ondas = new Map(l.ondas.map((o) => [o.id, { id: o.id, nome: o.nome, inicio: o.inicio, fim: o.fim }]))
  const projetos = new Map(l.projetos.map((p) => [p.id, p]))
  const gestores = new Map(l.gestores.map((g) => [g.id, g]))
  const etapasPorProjeto = new Map<string, EtapaDef[]>()
  const etapasDe = (p: LinhaProjeto) => {
    let e = etapasPorProjeto.get(p.id)
    if (!e) {
      e = etapasEfetivas(l, p)
      etapasPorProjeto.set(p.id, e)
    }
    return e
  }
  // O banco guarda a etapa concluída pelo id; a previsão trabalha com a posição dela na lista do projeto.
  const posicaoDaEtapa = new Map(l.projetoEtapas.map((e) => [e.id, e.posicao]))
  const conclusoes = new Map<string, { ordem: number; concluidaEm: string; automatica: boolean }[]>()
  for (const c of l.conclusoes) {
    const ordem = posicaoDaEtapa.get(c.etapa_id)
    if (ordem === undefined) throw new Error('Uma etapa concluída aponta para uma etapa que não existe no projeto.')
    conclusoes.set(c.vaga_id, [...(conclusoes.get(c.vaga_id) ?? []), { ordem, concluidaEm: c.concluida_em, automatica: c.automatica }])
  }

  return l.vagas
    .filter((v) => v.cancelada_em === null)
    .map((v) => {
      const projeto = v.projeto_id ? projetos.get(v.projeto_id) : undefined
      if (!projeto) throw new Error(`A vaga ${v.funcao} aponta para um projeto que não existe.`)
      let onda: OndaVaga | null = null
      let meta: string
      if (projeto.organizacao === 'ondas') {
        onda = (v.onda_id ? ondas.get(v.onda_id) : undefined) ?? null
        if (!onda) throw new Error(`A vaga ${v.funcao} aponta para uma onda que não existe.`)
        meta = onda.fim
      } else {
        if (!v.meta) throw new Error(`A vaga ${v.funcao} não tem meta.`)
        meta = v.meta
      }
      const previsao = preverVaga({ dataInicio: v.data_inicio, retomadaEm: v.retomada_em, etapas: etapasDe(projeto), conclusoes: conclusoes.get(v.id) ?? [], feriados })
      const g = v.gestor_id ? gestores.get(v.gestor_id) : undefined
      return {
        id: v.id,
        projetoId: projeto.id,
        funcao: v.funcao,
        disciplina: v.disciplina,
        area: v.area,
        meta,
        onda,
        gestor: g ? { id: g.id, nome: g.nome } : null,
        candidato: v.candidato,
        previsao,
        situacao: situacaoVaga(previsao, meta, hoje, feriados),
      }
    })
}

export function montarProjetos(l: LinhasPainel, hoje: string): CartaoProjeto[] {
  const clientes = new Map(l.clientes.map((c) => [c.id, c]))
  const vagas = montarPainel(l, hoje)
  return l.projetos
    .map((p) => {
      const cliente = clientes.get(p.cliente_id)
      if (!cliente) throw new Error(`O projeto ${p.nome} aponta para um cliente que não existe.`)
      return {
        id: p.id,
        nome: p.nome,
        area: p.area,
        organizacao: p.organizacao,
        encerrado: p.encerrado_em !== null,
        cliente: { id: cliente.id, nome: cliente.nome },
        ondas: p.organizacao === 'ondas' ? l.ondas.filter((o) => o.projeto_id === p.id).length : 0,
        resumo: resumirProjeto(vagas.filter((v) => v.projetoId === p.id)),
      }
    })
    .sort((a, b) => a.cliente.nome.localeCompare(b.cliente.nome, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'))
}

function exigir<T>(r: { data: T | null; error: { message: string } | null }, oQue: string): T {
  if (r.error || r.data === null) throw new Error(`Não foi possível ler ${oQue}: ${r.error?.message ?? 'sem dados'}`)
  return r.data
}

// O banco guarda `nome` e `projeto_id` das ondas como opcionais e `organizacao` como texto; aqui viram o tipo estrito.
const lerOndas = (ondas: { id: string; nome: string | null; inicio: string; fim: string; projeto_id: string | null }[]) =>
  ondas.map((o) => ({ id: o.id, nome: o.nome ?? '', inicio: o.inicio, fim: o.fim, projeto_id: o.projeto_id ?? '' }))
const lerEtapas = (etapas: { id: string; projeto_id: string; posicao: number; nome: string; duracao: number | null; padrao: number | null; fixa: string | null }[]): LinhasPainel['projetoEtapas'] =>
  etapas.map((e) => ({ ...e, fixa: e.fixa === 'captura' || e.fixa === 'admissao' ? e.fixa : null }))
const lerProjetos = (projetos: { id: string; cliente_id: string; nome: string; area: string | null; organizacao: string; encerrado_em: string | null }[]): LinhaProjeto[] =>
  projetos.map((p) => ({ ...p, organizacao: p.organizacao === 'meta' ? 'meta' : 'ondas' }))

const COLUNAS_VAGA = 'id, projeto_id, meta, funcao, disciplina, area, onda_id, gestor_id, candidato, data_inicio, retomada_em, cancelada_em'
const COLUNAS_ETAPA = 'id, projeto_id, posicao, nome, duracao, padrao, fixa'
const COLUNAS_PROJETO = 'id, cliente_id, nome, area, organizacao, encerrado_em'

export async function carregarPainel(sb: SupabaseClient<Database>, hoje: string, projetoId: string) {
  // O RLS só devolve o projeto a quem pode vê-lo; sem linha, não há painel.
  const projetos = await sb.from('projetos').select(COLUNAS_PROJETO).eq('id', projetoId).then((r) => exigir(r, 'o projeto'))
  const projeto = projetos[0]
  if (!projeto) return null

  const [vagas, conclusoes, projetoEtapas, feriados, ondas, gestores, clientes, clienteDuracoes] = await Promise.all([
    sb.from('vagas').select(COLUNAS_VAGA).eq('projeto_id', projetoId).order('criado_em').then((r) => exigir(r, 'as vagas')),
    sb.from('vaga_conclusoes').select('vaga_id, etapa_id, automatica, concluida_em, vagas!inner(projeto_id)').eq('vagas.projeto_id', projetoId).then((r) => exigir(r, 'as etapas concluídas')),
    sb.from('projeto_etapas').select(COLUNAS_ETAPA).eq('projeto_id', projetoId).order('posicao').then((r) => exigir(r, 'as etapas')),
    sb.from('feriados').select('data').then((r) => exigir(r, 'os feriados')),
    sb.from('ondas').select('id, nome, inicio, fim, projeto_id').eq('projeto_id', projetoId).order('inicio').then((r) => exigir(r, 'as ondas')),
    sb.from('gestores').select('id, nome').eq('cliente_id', projeto.cliente_id).order('nome').then((r) => exigir(r, 'os gestores')),
    sb.from('clientes').select('id, nome').eq('id', projeto.cliente_id).then((r) => exigir(r, 'o cliente')),
    sb.from('cliente_duracoes').select('cliente_id, ordem, duracao').eq('cliente_id', projeto.cliente_id).then((r) => exigir(r, 'as durações do cliente')),
  ])
  const cliente = clientes[0]
  if (!cliente) return null
  const linhas: LinhasPainel = {
    vagas,
    conclusoes: conclusoes.map(({ vaga_id, etapa_id, automatica, concluida_em }) => ({ vaga_id, etapa_id, automatica, concluida_em })),
    projetoEtapas: lerEtapas(projetoEtapas),
    feriados,
    ondas: lerOndas(ondas),
    gestores,
    projetos: lerProjetos(projetos),
    clientes,
    clienteDuracoes,
  }
  const info: ProjetoInfo = {
    id: projeto.id,
    nome: projeto.nome,
    area: projeto.area,
    organizacao: projeto.organizacao === 'meta' ? 'meta' : 'ondas',
    encerrado: projeto.encerrado_em !== null,
    cliente: { id: cliente.id, nome: cliente.nome },
  }
  const etapas = etapasEfetivas(linhas, linhas.projetos[0])
  return {
    projeto: info,
    vagas: montarPainel(linhas, hoje),
    etapas,
    ondas: lerOndas(ondas).map(({ id, nome, inicio, fim }) => ({ id, nome, inicio, fim })),
    gestores,
  }
}

export type PainelProjeto = NonNullable<Awaited<ReturnType<typeof carregarPainel>>>

export async function carregarProjetos(sb: SupabaseClient<Database>, hoje: string): Promise<CartaoProjeto[]> {
  const [vagas, conclusoes, projetoEtapas, feriados, ondas, gestores, projetos, clientes, clienteDuracoes] = await Promise.all([
    sb.from('vagas').select(COLUNAS_VAGA).order('criado_em').then((r) => exigir(r, 'as vagas')),
    sb.from('vaga_conclusoes').select('vaga_id, etapa_id, automatica, concluida_em').then((r) => exigir(r, 'as etapas concluídas')),
    sb.from('projeto_etapas').select(COLUNAS_ETAPA).order('posicao').then((r) => exigir(r, 'as etapas')),
    sb.from('feriados').select('data').then((r) => exigir(r, 'os feriados')),
    sb.from('ondas').select('id, nome, inicio, fim, projeto_id').then((r) => exigir(r, 'as ondas')),
    sb.from('gestores').select('id, nome').then((r) => exigir(r, 'os gestores')),
    sb.from('projetos').select(COLUNAS_PROJETO).then((r) => exigir(r, 'os projetos')),
    sb.from('clientes').select('id, nome').then((r) => exigir(r, 'os clientes')),
    sb.from('cliente_duracoes').select('cliente_id, ordem, duracao').then((r) => exigir(r, 'as durações dos clientes')),
  ])
  return montarProjetos({ vagas, conclusoes, projetoEtapas: lerEtapas(projetoEtapas), feriados, ondas: lerOndas(ondas), gestores, projetos: lerProjetos(projetos), clientes, clienteDuracoes }, hoje)
}

export async function carregarVaga(sb: SupabaseClient<Database>, hoje: string, vagaId: string): Promise<{ painel: PainelProjeto; vaga: VagaPainel } | null> {
  const achadas = await sb.from('vagas').select('projeto_id').eq('id', vagaId).then((r) => exigir(r, 'a vaga'))
  const projetoId = achadas[0]?.projeto_id
  if (!projetoId) return null
  const painel = await carregarPainel(sb, hoje, projetoId)
  const vaga = painel?.vagas.find((v) => v.id === vagaId)
  return painel && vaga ? { painel, vaga } : null
}
