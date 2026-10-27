import { LogOut } from 'lucide-react'
import Link from 'next/link'
import { sair } from '@/app/entrar/acoes'
import { AlternadorTema } from '../tema/AlternadorTema'
import { Logo } from './Logo'

export function CascaApp({
  titulo,
  navegacao,
  usuario,
  rotaAtiva,
  children,
}: {
  titulo: string
  navegacao: { href: string; rotulo: string }[]
  usuario: { nome: string }
  rotaAtiva?: string
  children: React.ReactNode
}) {
  const iniciais = usuario.nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
  return (
    <div className="min-h-dvh">
      <header className="bg-faixa text-faixa-texto">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-4 px-4">
          <Logo />
          <span className="hidden h-6 w-px bg-current opacity-30 sm:block" aria-hidden />
          <span className="hidden font-titulo text-lg font-medium sm:block">Mobilização Braskem 2027</span>
          <div className="flex-1" />
          <AlternadorTema />
          <span className="flex size-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold" title={usuario.nome}>
            {iniciais}
          </span>
          <form action={sair}>
            <button
              type="submit"
              aria-label="Sair"
              title="Sair"
              className="inline-flex size-10 items-center justify-center rounded-full transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
            >
              <LogOut className="size-5" aria-hidden />
            </button>
          </form>
        </div>
        {navegacao.length > 0 && (
          <nav className="mx-auto flex max-w-screen-2xl gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none]" aria-label="Navegação principal">
            {navegacao.map((item) => {
              const ativo = rotaAtiva === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={ativo ? 'page' : undefined}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-foco ${ativo ? 'bg-white/20' : 'opacity-80 hover:bg-white/10 hover:opacity-100'}`}
                >
                  {item.rotulo}
                </Link>
              )
            })}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-screen-2xl px-4 py-6">
        <h1 className="mb-5 font-titulo text-3xl font-semibold tracking-tight">{titulo}</h1>
        {children}
      </main>
    </div>
  )
}
