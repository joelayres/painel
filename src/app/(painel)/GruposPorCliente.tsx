import type { CartaoProjeto as Projeto } from '@/lib/painel/dados'
import { CartaoProjeto } from './CartaoProjeto'

// Projetos já ordenados por cliente: um grupo (título + grade de cartões) por cliente.
export function GruposPorCliente({ projetos }: { projetos: Projeto[] }) {
  const grupos = new Map<string, { nome: string; projetos: Projeto[] }>()
  for (const p of projetos) {
    const g = grupos.get(p.cliente.id) ?? { nome: p.cliente.nome, projetos: [] }
    g.projetos.push(p)
    grupos.set(p.cliente.id, g)
  }
  return (
    <div className="flex flex-col gap-8">
      {[...grupos.entries()].map(([id, g]) => (
        <section key={id} aria-labelledby={`cliente-${id}`} className="flex flex-col gap-3">
          <h2 id={`cliente-${id}`} className="font-titulo text-xl font-semibold">{g.nome}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {g.projetos.map((p) => <CartaoProjeto key={p.id} projeto={p} />)}
          </div>
        </section>
      ))}
    </div>
  )
}
