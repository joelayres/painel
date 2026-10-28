// Grava a carga inicial da planilha pela função importar_carga: uma transação, com a tabela de vagas
// travada, e só com o painel vazio (para não duplicar vagas).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VagaCarga } from './ler'

export async function gravarCarga(admin: SupabaseClient, vagas: VagaCarga[], nomeUsuario: string): Promise<{ ok: true; vagas: number } | { ok: false; erro: string }> {
  const { data, error } = await admin.rpc('importar_carga', { p_vagas: vagas, p_nome: nomeUsuario })
  if (!error) return { ok: true, vagas: data as number }
  const onda = /falta onda (\d)/.exec(error.message)
  if (onda) return { ok: false, erro: `Cadastre a ${onda[1]}ª Onda antes de fazer a carga.` }
  if (error.message.includes('painel não está vazio')) return { ok: false, erro: 'A carga só pode ser feita com o painel vazio. Já existem vagas cadastradas.' }
  // A tela é só do RH: mostrar o motivo ajuda a corrigir (chave errada, banco fora do ar…).
  console.error('importar_carga falhou', error)
  return { ok: false, erro: `Não foi possível gravar a carga (${error.message}). Nada foi importado.` }
}
