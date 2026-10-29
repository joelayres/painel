import { ArrowLeft } from 'lucide-react'
import { cookies } from 'next/headers'
import { COOKIE_PORTAL, ENDERECO_PORTAL } from '@/lib/portal/voltar'

export async function VoltarAoPortal() {
  if (!(await cookies()).get(COOKIE_PORTAL)) return null
  return (
    <a
      href={ENDERECO_PORTAL}
      className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
    >
      <ArrowLeft className="size-4" aria-hidden />
      <span className="hidden sm:inline">Portal da Gestão</span>
      <span className="sr-only sm:hidden">Portal da Gestão</span>
    </a>
  )
}
