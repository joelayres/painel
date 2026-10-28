// Acesso por projeto: quem (gestor ou cliente) enxerga cada projeto. O RH vê todos.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Perfil } from '@/lib/auth/perfil'

type Resultado = { ok: true } | { ok: false; erro: string }

const GENERICO = 'Não foi possível salvar. Tente de novo.'

function traduzir(mensagem: string): string {
  if (mensagem.includes('cliente diferente')) return 'Esta pessoa é de outro cliente e não pode ver este projeto.'
  if (mensagem.includes('perfil sem acesso por projeto')) return 'O RH já vê todos os projetos.'
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

// Quem pode receber acesso ao projeto: gestores ativos e clientes ativos daquele cliente.
export function usuariosLiberaveis<T extends { id: string; perfil: Perfil; clienteId: string | null; ativo: boolean }>(usuarios: T[], clienteDoProjeto: string): T[] {
  return usuarios.filter((u) => u.ativo && (u.perfil === 'gestor' || (u.perfil === 'cliente' && u.clienteId === clienteDoProjeto)))
}
