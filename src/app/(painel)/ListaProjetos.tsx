import Link from 'next/link'
import type { Perfil } from '@/lib/auth/perfil'
import type { CartaoProjeto as Projeto } from '@/lib/painel/dados'
import { FormProjeto } from './FormProjeto'
import { GruposPorCliente } from './GruposPorCliente'

export function ListaProjetos({ projetos, perfil, clientes }: { projetos: Projeto[]; perfil: Perfil; clientes: { id: string; nome: string }[] }) {
  const rh = perfil === 'rh'
  return (
    <div className="flex flex-col gap-5">
      {rh && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FormProjeto clientes={clientes} />
          <Link href="/encerrados" className="text-sm font-medium text-primaria underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-foco">Encerrados</Link>
        </div>
      )}
      {projetos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-borda p-8 text-center text-texto-suave">
          {rh ? 'Nenhum projeto ainda. Crie o primeiro.' : 'Ainda não há projetos liberados para você. Fale com o RH.'}
        </p>
      ) : (
        <GruposPorCliente projetos={projetos} />
      )}
    </div>
  )
}
