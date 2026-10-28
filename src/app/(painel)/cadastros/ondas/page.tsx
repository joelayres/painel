import { exigirRh } from '@/lib/auth/perfil'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { Voltar } from '../Voltar'
import { CadastroOndas } from './Cliente'

export default async function Ondas() {
  await exigirRh()
  const { data } = await (await criarClienteServidor()).from('ondas').select('id, numero, inicio, fim').order('numero')
  return (<><Voltar titulo="Ondas" /><CadastroOndas ondas={data ?? []} /></>)
}
