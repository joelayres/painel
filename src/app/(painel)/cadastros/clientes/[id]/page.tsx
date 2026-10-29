import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/auth/perfil'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { ehUuid } from '@/lib/validacao/vaga'
import { Voltar } from '../../Voltar'
import { EtapasProjeto } from '@/app/(painel)/projetos/[id]/configurar/EtapasProjeto'
import { Gestores } from './Gestores'

export default async function ClientePagina({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin()
  const { id } = await params
  if (!ehUuid(id)) notFound()
  const sb = await criarClienteServidor()
  const [{ data: cliente }, { data: etapas }, { data: duracoes }, { data: gestores }] = await Promise.all([
    sb.from('clientes').select('id, nome').eq('id', id).maybeSingle(),
    sb.from('cliente_etapas').select('id, posicao, nome, duracao, padrao, fixa').eq('cliente_id', id).order('posicao'),
    sb.from('cliente_duracoes').select('ordem, duracao').eq('cliente_id', id),
    sb.from('gestores').select('id, nome, email').eq('cliente_id', id).order('nome'),
  ])
  if (!cliente) notFound()
  const dias = new Map((duracoes ?? []).map((d) => [d.ordem, d.duracao]))
  // Etapa padrão: a duração é a do cliente; incluída: a da própria linha.
  const lista = (etapas ?? []).map((e) => ({
    id: e.id, ordem: e.posicao, nome: e.nome, fixa: (e.fixa as 'captura' | 'admissao' | null) ?? null,
    padraoCliente: null, duracao: e.padrao !== null ? (dias.get(e.padrao) ?? 0) : e.duracao,
    concluidasPor: 0, chegaramAoPonto: 0,
  }))
  return (
    <div className="flex flex-col gap-6">
      <Voltar titulo={cliente.nome} />
      <p className="max-w-prose text-texto-suave">As etapas abaixo são o ponto de partida dos projetos novos deste cliente. Os projetos que já existem não mudam.</p>
      <EtapasProjeto alvo={{ tipo: 'cliente', id }} cliente={cliente.nome} etapas={lista} temVagas={false} totalVagas={0} somenteLeitura={false} />
      <section className="flex flex-col gap-3">
        <h3 className="font-titulo text-xl font-semibold">Gestores</h3>
        <Gestores clienteId={id} gestores={gestores ?? []} />
      </section>
    </div>
  )
}
