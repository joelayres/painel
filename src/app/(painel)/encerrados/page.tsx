import Link from 'next/link'
import { hojeSP } from '@/dominio/tempo'
import { exigirRh } from '@/lib/auth/perfil'
import { carregarProjetos } from '@/lib/painel/dados'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { GruposPorCliente } from '../GruposPorCliente'

export const metadata = { title: 'Encerrados · Painel de Mobilização' }

export default async function Encerrados() {
  await exigirRh()
  const projetos = (await carregarProjetos(await criarClienteServidor(), hojeSP())).filter((p) => p.encerrado)
  return (
    <div className="flex flex-col gap-5">
      <Link href="/" className="text-sm font-medium text-primaria underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-foco">Voltar aos projetos</Link>
      {projetos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-borda p-8 text-center text-texto-suave">Nenhum projeto encerrado.</p>
      ) : (
        <GruposPorCliente projetos={projetos} />
      )}
    </div>
  )
}
