import { exigirRh } from '@/lib/auth/perfil'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { Voltar } from '../Voltar'
import { CadastroGestores } from './Cliente'

export default async function Gestores() {
  await exigirRh()
  const sb = await criarClienteServidor()
  const [{ data: gestores }, { data: vagas }] = await Promise.all([
    sb.from('gestores').select('id, nome, email').order('nome'),
    sb.from('vagas').select('gestor_id').is('cancelada_em', null),
  ])
  const contagem = new Map<string, number>()
  for (const v of vagas ?? []) if (v.gestor_id) contagem.set(v.gestor_id, (contagem.get(v.gestor_id) ?? 0) + 1)
  return (<><Voltar titulo="Gestores" /><CadastroGestores gestores={(gestores ?? []).map((g) => ({ ...g, vagas: contagem.get(g.id) ?? 0 }))} /></>)
}
