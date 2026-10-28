import Link from 'next/link'
import type { Perfil } from '@/lib/auth/perfil'
import type { CartaoProjeto as Projeto } from '@/lib/painel/dados'
import { FormProjeto } from './FormProjeto'
import { GruposPorCliente } from './GruposPorCliente'

const botao = (ativo: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-foco ${ativo ? 'border-primaria bg-primaria text-white' : 'border-borda bg-superficie hover:border-primaria'}`

// encerrados: só para quem não é RH e não tem projeto ativo; o RH tem a página Encerrados.
// clienteAtivo: id do cliente escolhido no filtro (?cliente=), que só aparece com projetos de 2 ou mais clientes.
export function ListaProjetos({
  projetos,
  encerrados = [],
  perfil,
  clientes,
  clienteAtivo,
}: {
  projetos: Projeto[]
  encerrados?: Projeto[]
  perfil: Perfil
  clientes: { id: string; nome: string }[]
  clienteAtivo?: string
}) {
  const rh = perfil === 'rh'
  const daLista = [...new Map(projetos.map((p) => [p.cliente.id, p.cliente])).values()]
  const ativo = daLista.some((c) => c.id === clienteAtivo) ? clienteAtivo : undefined
  const visiveis = ativo ? projetos.filter((p) => p.cliente.id === ativo) : projetos
  return (
    <div className="flex flex-col gap-5">
      {rh && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FormProjeto clientes={clientes} />
          <Link href="/encerrados" className="text-sm font-medium text-primaria underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-foco">Encerrados</Link>
        </div>
      )}
      {daLista.length > 1 && (
        <nav aria-label="Clientes" className="flex flex-wrap gap-2">
          <Link href="/" aria-current={!ativo ? 'true' : undefined} className={botao(!ativo)}>Todos</Link>
          {daLista.map((c) => (
            <Link key={c.id} href={`/?cliente=${encodeURIComponent(c.id)}`} aria-current={ativo === c.id ? 'true' : undefined} className={botao(ativo === c.id)}>{c.nome}</Link>
          ))}
        </nav>
      )}
      {projetos.length > 0 ? (
        <GruposPorCliente projetos={visiveis} />
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
