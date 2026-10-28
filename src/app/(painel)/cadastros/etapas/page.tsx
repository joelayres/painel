import { exigirRh } from '@/lib/auth/perfil'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { Voltar } from '../Voltar'
import { CadastroEtapas } from './Cliente'

export default async function Etapas() {
  await exigirRh()
  const { data } = await (await criarClienteServidor()).from('etapas').select('ordem, nome, duracao').order('ordem')
  return (<><Voltar titulo="Etapas" /><CadastroEtapas etapas={data ?? []} /></>)
}
