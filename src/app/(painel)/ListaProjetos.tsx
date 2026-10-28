import Link from 'next/link'
import type { Perfil } from '@/lib/auth/perfil'
import type { CartaoProjeto as Projeto } from '@/lib/painel/dados'
import { FormProjeto } from './FormProjeto'
import { GruposPorCliente } from './GruposPorCliente'

// encerrados: só para quem não é RH e não tem projeto ativo; o RH tem a página Encerrados.
export function ListaProjetos({
  projetos,
  encerrados = [],
  perfil,
  clientes,
}: {
  projetos: Projeto[]
  encerrados?: Projeto[]
  perfil: Perfil
  clientes: { id: string; nome: string }[]
}) {
  const rh = perfil === 'rh'
  return (
    <div className="flex flex-col gap-5">
      {rh && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FormProjeto clientes={clientes} />
          <Link href="/encerrados" className="text-sm font-medium text-primaria underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-foco">Encerrados</Link>
        </div>
      )}
      {projetos.length > 0 ? (
        <GruposPorCliente projetos={projetos} />
      ) : encerrados.length > 0 ? (
        <section aria-labelledby="encerrados" className="flex flex-col gap-3">
          <h2 id="encerrados" className="font-titulo text-2xl font-semibold">Encerrados</h2>
          <GruposPorCliente projetos={encerrados} />
        </section>
      ) : (
        <p className="rounded-xl border border-dashed border-borda p-8 text-center text-texto-suave">
          {rh ? 'Nenhum projeto ainda. Crie o primeiro.' : 'Ainda não há projetos liberados para você. Fale com o RH.'}
        </p>
      )}
    </div>
  )
}
