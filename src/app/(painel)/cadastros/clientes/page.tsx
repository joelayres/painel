import { exigirAdmin } from '@/lib/auth/perfil'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { Voltar } from '../Voltar'
import { CadastroClientes } from './Cliente'

export default async function Clientes() {
  await exigirAdmin()
  const sb = await criarClienteServidor()
  const [{ data: clientes }, { data: projetos }] = await Promise.all([
    sb.from('clientes').select('id, nome').order('nome'),
    sb.from('projetos').select('cliente_id'),
  ])
  const contagem = new Map<string, number>()
  for (const p of projetos ?? []) contagem.set(p.cliente_id, (contagem.get(p.cliente_id) ?? 0) + 1)
  return (<><Voltar titulo="Clientes" /><CadastroClientes clientes={(clientes ?? []).map((c) => ({ ...c, projetos: contagem.get(c.id) ?? 0 }))} /></>)
}
