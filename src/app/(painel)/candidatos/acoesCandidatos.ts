'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { exigirAdmin } from '@/lib/auth/perfil'
import { rpcLivre } from '@/lib/curriculos/rpc'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { criarClienteServidor } from '@/lib/supabase/servidor'

// LGPD: só o Administrador. O banco apaga o candidato e devolve os arquivos; o servidor apaga os PDFs.
export async function excluirCandidato(id: string): Promise<{ ok: false; erro: string }> {
  await exigirAdmin()
  const { data, error } = await rpcLivre<string[]>(await criarClienteServidor(), 'excluir_candidato', { p_candidato: id })
  if (error) return { ok: false, erro: 'Não foi possível excluir o candidato.' }
  if (data?.length) {
    const { error: erroArquivos } = await criarClienteAdmin().storage.from('curriculos').remove(data)
    if (erroArquivos) console.error('Exclusão de candidato: arquivos não apagados do Storage', data, erroArquivos.message)
  }
  revalidatePath('/candidatos')
  redirect('/candidatos')
}
