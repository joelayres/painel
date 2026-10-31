// Vagas para o Financeiro: o que ele precisa para projetar a margem, com a previsão calculada aqui.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VagaPainel } from '@/dominio/painel'
import { carregarPainel, carregarProjetos } from '@/lib/painel/dados'
import type { Database } from '@/lib/supabase/tipos'
import type { RespostaVagas, VagaPainelFinanceiro } from './contrato'

export function paraFinanceiro(v: VagaPainel): VagaPainelFinanceiro {
  return {
    id: v.id, projetoId: v.projetoId, funcao: v.funcao, disciplina: v.disciplina, area: v.area,
    onda: v.onda?.nome ?? null, candidato: v.candidato,
    // Última etapa: prevista enquanto aberta, a data real quando a vaga já foi mobilizada.
    dataMobilizacao: v.previsao.conclusaoEstimada,
    // Mesmo critério dos cartões e do resumo do portal.
    admitida: v.situacao.admitida,
    mobilizada: v.situacao.mobilizada,
  }
}

// Projetos que não existem são ignorados; as vagas canceladas já ficam de fora em montarPainel.
export async function carregarVagasFinanceiro(admin: SupabaseClient<Database>, projetos: string[], hoje: string): Promise<RespostaVagas> {
  const cartoes = await carregarProjetos(admin, hoje)
  const existentes = new Set(cartoes.map((c) => c.id))
  const paineis = await Promise.all(projetos.filter((id) => existentes.has(id)).map((id) => carregarPainel(admin, hoje, id)))
  return {
    versao: 1,
    projetos: cartoes.map((c) => ({ id: c.id, nome: c.nome, cliente: c.cliente.nome, encerrado: c.encerrado })),
    vagas: paineis.flatMap((p) => (p ? p.vagas.map(paraFinanceiro) : [])),
  }
}
