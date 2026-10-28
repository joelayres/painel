import { exigirRh } from '@/lib/auth/perfil'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { Voltar } from '../Voltar'
import { CadastroUsuarios } from './Cliente'

export default async function Usuarios() {
  await exigirRh()
  const { data } = await (await criarClienteServidor()).from('usuarios').select('id, nome, email, perfil, ativo').order('nome')
  return (<><Voltar titulo="Usuários" /><CadastroUsuarios usuarios={(data ?? []).map((u) => ({ ...u, perfil: u.perfil as 'rh' | 'visualizador' }))} /></>)
}
