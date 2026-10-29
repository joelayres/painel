// Acesso por projeto: quem (gestor ou cliente) enxerga cada projeto. O Administrador vê todos.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Perfil } from '@/lib/auth/perfil'

type Resultado = { ok: true } | { ok: false; erro: string }

const GENERICO = 'Não foi possível salvar. Tente de novo.'

function traduzir(mensagem: string): string {
  if (mensagem.includes('cliente diferente')) return 'Esta pessoa é de outro cliente e não pode ver este projeto.'
  if (mensagem.includes('perfil sem acesso por projeto')) return 'O Administrador já vê todos os projetos.'
  if (mensagem.includes('analista não libera este perfil')) return 'Você não pode liberar nem remover o acesso de um Analista de RH ou de um Administrador.'
  return GENERICO
}

export async function liberarAcesso(sb: SupabaseClient, projetoId: string, usuarioId: string): Promise<Resultado> {
  const { error } = await sb.from('projeto_acessos').insert({ projeto_id: projetoId, usuario_id: usuarioId })
  return error ? { ok: false, erro: traduzir(error.message) } : { ok: true }
}

export async function removerAcesso(sb: SupabaseClient, projetoId: string, usuarioId: string): Promise<Resultado> {
  const { error } = await sb.from('projeto_acessos').delete().eq('projeto_id', projetoId).eq('usuario_id', usuarioId)
  return error ? { ok: false, erro: GENERICO } : { ok: true }
}

export type PessoaProjeto = { id: string; nome: string; perfil: Perfil }
export type PessoaLiberavel = PessoaProjeto & { clienteId: string | null }

// Quem já tem acesso e quem ainda pode receber (as funções do banco decidem o que cada perfil enxerga).
export async function carregarPessoasDoProjeto(sb: SupabaseClient, projetoId: string): Promise<{ liberadas: PessoaProjeto[]; liberaveis: PessoaLiberavel[] }> {
  const [doProjeto, liberaveis] = await Promise.all([
    sb.rpc('pessoas_do_projeto', { p_projeto: projetoId }),
    sb.rpc('pessoas_liberaveis', { p_projeto: projetoId }),
  ])
  const liberadas = ((doProjeto.data ?? []) as { id: string; nome: string; perfil: string }[]).map((p) => ({ id: p.id, nome: p.nome, perfil: p.perfil as Perfil }))
  const comAcesso = new Set(liberadas.map((p) => p.id))
  return {
    liberadas,
    liberaveis: ((liberaveis.data ?? []) as { id: string; nome: string; perfil: string; cliente_id: string | null }[])
      .filter((p) => !comAcesso.has(p.id))
      .map((p) => ({ id: p.id, nome: p.nome, perfil: p.perfil as Perfil, clienteId: p.cliente_id })),
  }
}
