import { exigirAdmin } from '@/lib/auth/perfil'
import type { PerfilUsuario } from '@/lib/cadastros/usuarios'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { Voltar } from '../Voltar'
import { CadastroUsuarios } from './Cliente'

export default async function Usuarios() {
  await exigirAdmin()
  const sb = await criarClienteServidor()
  const [{ data: usuarios }, { data: clientes }, { data: projetos }, { data: acessos }] = await Promise.all([
    sb.from('usuarios').select('id, nome, email, perfil, cliente_id, ativo').order('nome'),
    sb.from('clientes').select('id, nome').order('nome'),
    sb.from('projetos').select('id, nome, cliente_id').is('encerrado_em', null).order('nome'),
    sb.from('projeto_acessos').select('projeto_id, usuario_id'),
  ])
  const porUsuario = new Map<string, string[]>()
  for (const a of acessos ?? []) porUsuario.set(a.usuario_id, [...(porUsuario.get(a.usuario_id) ?? []), a.projeto_id])
  return (
    <>
      <Voltar titulo="Usuários" />
      <CadastroUsuarios
        usuarios={(usuarios ?? []).map((u) => ({ id: u.id, nome: u.nome, email: u.email, perfil: u.perfil as PerfilUsuario, clienteId: u.cliente_id, ativo: u.ativo, acessos: porUsuario.get(u.id) ?? [] }))}
        clientes={clientes ?? []}
        projetos={(projetos ?? []).map((p) => ({ id: p.id, nome: p.nome, clienteId: p.cliente_id }))}
      />
    </>
  )
}
