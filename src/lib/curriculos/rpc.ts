import type { SupabaseClient } from '@supabase/supabase-js'

// As tabelas e funções da Seleção de Currículos usadas sem depender dos tipos gerados (tipos.ts),
// que só passam a conhecê-las depois do `npm run db:tipos` com a migração publicada.
type Livre = { rpc: (nome: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> }

export function rpcLivre<T = unknown>(sb: object, nome: string, args: Record<string, unknown>) {
  return (sb as unknown as Livre).rpc(nome, args) as PromiseLike<{ data: T | null; error: { message: string } | null }>
}

// O mesmo cliente, sem os tipos do banco: para ler as tabelas novas.
export function semTipos(sb: object): SupabaseClient {
  return sb as unknown as SupabaseClient
}
