import Link from 'next/link'
import { notFound } from 'next/navigation'
import { hojeSP } from '@/dominio/tempo'
import { exigirRh } from '@/lib/auth/perfil'
import { carregarPainel } from '@/lib/painel/dados'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { ehUuid } from '@/lib/validacao/vaga'
import { ImportarVagas } from './Cliente'

export const metadata = { title: 'Importar vagas · Painel de Mobilização' }

export default async function Importar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!ehUuid(id)) notFound()
  await exigirRh()
  const painel = await carregarPainel(await criarClienteServidor(), hojeSP(), id)
  if (!painel) notFound()
  const { projeto, ondas, gestores } = painel

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/projetos/${id}/configurar`} className="text-sm font-medium text-primaria hover:underline">← Configurar</Link>
        <h3 className="mt-1 font-titulo text-xl font-semibold">Importar vagas</h3>
      </div>
      {projeto.encerrado ? (
        <p role="status" className="rounded-lg px-3 py-2 font-medium" style={{ background: 'var(--st-reprovada-fundo)', color: 'var(--st-reprovada-texto)' }}>Projeto encerrado. Reabra para alterar.</p>
      ) : (
        <ImportarVagas projetoId={id} organizacao={projeto.organizacao} nomes={{ ondas: ondas.map((o) => ({ id: o.id, nome: o.nome })), gestores }} />
      )}
    </div>
  )
}
