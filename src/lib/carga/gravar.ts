// Grava a carga inicial da planilha. Só com o painel vazio, para não duplicar vagas.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VagaCarga } from './ler'

export async function gravarCarga(admin: SupabaseClient, vagas: VagaCarga[], nomeUsuario: string): Promise<{ ok: true; vagas: number } | { ok: false; erro: string }> {
  const { data: ondas, error: erroOndas } = await admin.from('ondas').select('id, numero')
  if (erroOndas) return { ok: false, erro: 'Não foi possível ler as ondas. Tente de novo.' }
  const ondaPorNumero = new Map((ondas ?? []).map((o) => [o.numero as number, o.id as string]))
  const faltando = [...new Set(vagas.map((v) => v.onda))].sort().find((n) => !ondaPorNumero.has(n))
  if (faltando) return { ok: false, erro: `Cadastre a ${faltando}ª Onda antes de fazer a carga.` }

  const { count } = await admin.from('vagas').select('id', { count: 'exact', head: true })
  if (count) return { ok: false, erro: 'A carga só pode ser feita com o painel vazio. Já existem vagas cadastradas.' }

  const { data: criadas, error } = await admin
    .from('vagas')
    .insert(vagas.map((v) => ({ funcao: v.funcao, disciplina: v.disciplina, area: v.area, onda_id: ondaPorNumero.get(v.onda), candidato: v.candidato, data_inicio: v.dataInicio })))
    .select('id')
  if (error || !criadas) return { ok: false, erro: 'Não foi possível gravar as vagas. Tente de novo.' }

  // O insert devolve as linhas na mesma ordem enviada.
  const conclusoes = vagas.flatMap((v, i) => v.concluidas.map((c) => ({ vaga_id: criadas[i].id, ordem: c.ordem, concluida_em: c.concluidaEm })))
  if (conclusoes.length) {
    const { error: e2 } = await admin.from('vaga_conclusoes').insert(conclusoes)
    if (e2) {
      await admin.from('vagas').delete().in('id', criadas.map((c) => c.id))
      return { ok: false, erro: 'Não foi possível gravar as etapas concluídas. Nada foi importado; tente de novo.' }
    }
  }
  await admin.from('historico').insert({ vaga_id: null, nome_usuario: nomeUsuario, acao: `Carga inicial da planilha: ${vagas.length} vagas` })
  return { ok: true, vagas: vagas.length }
}
