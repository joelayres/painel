// Lê os fatos do banco e monta as vagas do painel (previsão e cor calculadas aqui, a cada leitura).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { EtapaDef } from '@/dominio/etapas'
import type { OndaVaga, VagaPainel } from '@/dominio/painel'
import { preverVaga } from '@/dominio/previsao'
import { situacaoVaga } from '@/dominio/situacao'
import type { Database } from '@/lib/supabase/tipos'

type LinhaVaga = {
  id: string
  funcao: string
  disciplina: string
  area: string
  onda_id: string
  gestor_id: string | null
  candidato: string | null
  data_inicio: string
  retomada_em: string | null
  cancelada_em: string | null
}
export type LinhasPainel = {
  vagas: LinhaVaga[]
  conclusoes: { vaga_id: string; ordem: number; concluida_em: string }[]
  etapas: EtapaDef[]
  feriados: { data: string }[]
  ondas: OndaVaga[]
  gestores: { id: string; nome: string }[]
}

export function montarPainel(l: LinhasPainel, hoje: string): VagaPainel[] {
  const feriados = new Set(l.feriados.map((f) => f.data))
  const ondas = new Map(l.ondas.map((o) => [o.id, o]))
  const gestores = new Map(l.gestores.map((g) => [g.id, g]))
  const conclusoes = new Map<string, { ordem: number; concluidaEm: string }[]>()
  for (const c of l.conclusoes) conclusoes.set(c.vaga_id, [...(conclusoes.get(c.vaga_id) ?? []), { ordem: c.ordem, concluidaEm: c.concluida_em }])

  return l.vagas
    .filter((v) => v.cancelada_em === null)
    .map((v) => {
      const onda = ondas.get(v.onda_id)
      if (!onda) throw new Error(`A vaga ${v.funcao} aponta para uma onda que não existe.`)
      const previsao = preverVaga({ dataInicio: v.data_inicio, retomadaEm: v.retomada_em, etapas: l.etapas, conclusoes: conclusoes.get(v.id) ?? [], feriados })
      const g = v.gestor_id ? gestores.get(v.gestor_id) : undefined
      return {
        id: v.id,
        funcao: v.funcao,
        disciplina: v.disciplina,
        area: v.area,
        onda,
        gestor: g ? { id: g.id, nome: g.nome } : null,
        candidato: v.candidato,
        previsao,
        situacao: situacaoVaga(previsao, onda.fim, hoje, feriados),
      }
    })
}

function exigir<T>(r: { data: T | null; error: { message: string } | null }, oQue: string): T {
  if (r.error || r.data === null) throw new Error(`Não foi possível ler ${oQue}: ${r.error?.message ?? 'sem dados'}`)
  return r.data
}

export async function carregarPainel(sb: SupabaseClient<Database>, hoje: string) {
  const [vagas, conclusoes, etapas, feriados, ondas, gestores] = await Promise.all([
    sb.from('vagas').select('id, funcao, disciplina, area, onda_id, gestor_id, candidato, data_inicio, retomada_em, cancelada_em').order('criado_em').then((r) => exigir(r, 'as vagas')),
    sb.from('vaga_conclusoes').select('vaga_id, ordem, concluida_em').then((r) => exigir(r, 'as etapas concluídas')),
    sb.from('etapas').select('ordem, nome, duracao').order('ordem').then((r) => exigir(r, 'as etapas')),
    sb.from('feriados').select('data').then((r) => exigir(r, 'os feriados')),
    sb.from('ondas').select('id, numero, inicio, fim').order('numero').then((r) => exigir(r, 'as ondas')),
    sb.from('gestores').select('id, nome').order('nome').then((r) => exigir(r, 'os gestores')),
  ])
  const linhas: LinhasPainel = { vagas, conclusoes, etapas, feriados, ondas, gestores }
  return { vagas: montarPainel(linhas, hoje), etapas, ondas, gestores }
}
