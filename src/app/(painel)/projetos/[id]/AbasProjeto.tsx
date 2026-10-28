'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// As abas do projeto; a ativa vem do endereço. O Resumo vem primeiro: é por onde se entra no projeto.
export function AbasProjeto({ projetoId, rh }: { projetoId: string; rh: boolean }) {
  const caminho = usePathname()
  const base = `/projetos/${projetoId}`
  const abas = [
    { href: `${base}/resumo`, rotulo: 'Resumo' },
    { href: base, rotulo: 'Painel' },
    ...(rh ? [{ href: `${base}/configurar`, rotulo: 'Configurar' }] : []),
  ]
  return (
    <nav aria-label="Abas do projeto" className="flex gap-1 border-b border-borda">
      {abas.map((a) => {
        const ativa = a.href === base ? caminho === base : caminho.startsWith(a.href)
        return (
          <Link
            key={a.href}
            href={a.href}
            aria-current={ativa ? 'page' : undefined}
            className={`-mb-px border-b-2 px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-foco ${ativa ? 'border-primaria text-primaria' : 'border-transparent text-texto-suave hover:text-texto'}`}
          >
            {a.rotulo}
          </Link>
        )
      })}
    </nav>
  )
}
