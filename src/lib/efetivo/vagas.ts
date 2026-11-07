// Vagas admitidas para o Efetivo (Portal): cada uma vira uma ficha "a completar" lá.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RespostaVagas } from '@/lib/financeiro/contrato'
import { carregarVagasFinanceiro } from '@/lib/financeiro/vagas'
import type { Database } from '@/lib/supabase/tipos'
import type { RespostaVagasEfetivo } from './contrato'

export function paraEfetivo(r: RespostaVagas): RespostaVagasEfetivo {
  return {
    versao: 1,
    projetos: r.projetos.map(({ id, nome, encerrado }) => ({ id, nome, encerrado })),
    vagas: r.vagas.flatMap((v) => {
      const candidato = v.candidato?.trim()
      return v.admitida && candidato ? [{ id: v.id, projetoId: v.projetoId, candidato, funcao: v.funcao }] : []
    }),
  }
}

export async function carregarVagasEfetivo(admin: SupabaseClient<Database>, projetos: string[], hoje: string): Promise<RespostaVagasEfetivo> {
  return paraEfetivo(await carregarVagasFinanceiro(admin, projetos, hoje))
}
