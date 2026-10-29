import { exigirAdmin } from '@/lib/auth/perfil'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { Voltar } from '../Voltar'
import { CadastroFeriados } from './Cliente'

export default async function Feriados() {
  await exigirAdmin()
  const { data } = await (await criarClienteServidor()).from('feriados').select('data, nome').order('data')
  return (<><Voltar titulo="Feriados" /><CadastroFeriados feriados={data ?? []} /></>)
}
