import { exigirRh } from '@/lib/auth/perfil'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { Voltar } from '../Voltar'
import { CadastroVagas } from './Cliente'

export default async function Vagas() {
  await exigirRh()
  const sb = await criarClienteServidor()
  const [{ data: vagas }, { data: ondas }, { data: gestores }] = await Promise.all([
    sb.from('vagas').select('id, funcao, disciplina, area, candidato, data_inicio, cancelada_em, ondas(numero), gestores(nome)').order('criado_em'),
    sb.from('ondas').select('id, numero').order('numero'),
    sb.from('gestores').select('id, nome').order('nome'),
  ])
  const linhas = (vagas ?? []).map((v) => ({
    id: v.id, funcao: v.funcao, disciplina: v.disciplina, area: v.area, onda: v.ondas?.numero ?? 0, gestor: v.gestores?.nome ?? null,
    candidato: v.candidato, dataInicio: v.data_inicio, canceladaEm: v.cancelada_em,
  }))
  return (<><Voltar titulo="Vagas" /><CadastroVagas vagas={linhas} opcoes={{ ondas: ondas ?? [], gestores: gestores ?? [] }} /></>)
}
