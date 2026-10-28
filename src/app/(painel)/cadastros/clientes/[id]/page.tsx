import { notFound } from 'next/navigation'
import { exigirRh } from '@/lib/auth/perfil'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { ehUuid } from '@/lib/validacao/vaga'
import { Voltar } from '../../Voltar'
import { Duracoes } from './Duracoes'
import { Gestores } from './Gestores'

export default async function ClientePagina({ params }: { params: Promise<{ id: string }> }) {
  await exigirRh()
  const { id } = await params
  if (!ehUuid(id)) notFound()
  const sb = await criarClienteServidor()
  const [{ data: cliente }, { data: etapas }, { data: duracoes }, { data: gestores }] = await Promise.all([
    sb.from('clientes').select('id, nome').eq('id', id).maybeSingle(),
    sb.from('etapas').select('ordem, nome').order('ordem'),
    sb.from('cliente_duracoes').select('ordem, duracao').eq('cliente_id', id),
    sb.from('gestores').select('id, nome, email').eq('cliente_id', id).order('nome'),
  ])
  if (!cliente) notFound()
  const dias = new Map((duracoes ?? []).map((d) => [d.ordem, d.duracao]))
  return (
    <div className="flex flex-col gap-6">
      <Voltar titulo={cliente.nome} />
      <section className="flex flex-col gap-3">
        <h3 className="font-titulo text-xl font-semibold">Duração das etapas</h3>
        <Duracoes clienteId={id} etapas={(etapas ?? []).map((e) => ({ ordem: e.ordem, nome: e.nome, duracao: dias.get(e.ordem) ?? 0 }))} />
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="font-titulo text-xl font-semibold">Gestores</h3>
        <Gestores clienteId={id} gestores={gestores ?? []} />
      </section>
    </div>
  )
}
