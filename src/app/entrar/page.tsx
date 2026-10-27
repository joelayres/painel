import { Logo } from '@/components/layout/Logo'
import { FundoRede } from '@/components/marca/FundoRede'
import { AlternadorTema } from '@/components/tema/AlternadorTema'
import { FormularioEntrada } from './FormularioEntrada'

export const metadata = { title: 'Entrar · Painel de Mobilização' }

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#072b33] p-10 text-white lg:flex">
        <FundoRede />
        <Logo className="relative" />
        <div className="relative max-w-md [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]">
          <p className="font-titulo text-5xl leading-[1.05] font-semibold tracking-tight">Mobilização Braskem 2027</p>
          <p className="mt-4 text-lg opacity-80">Acompanhamento das contratações.</p>
        </div>
      </aside>

      {/* Celular: a rede cobre a tela toda e fica parada atrás; só o conteúdo rola (teclado aberto). */}
      <div aria-hidden className="fixed inset-0 overflow-hidden bg-[#072b33] lg:hidden">
        <FundoRede />
      </div>

      <main className="relative flex min-h-dvh flex-col text-white lg:min-h-0 lg:text-texto">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo className="lg:invisible" />
          <AlternadorTema className="lg:hover:bg-primaria-suave" />
        </div>
        <div data-testid="capa-celular" className="flex flex-1 flex-col justify-center px-5 pt-6 pb-10 [text-shadow:0_1px_12px_rgba(0,0,0,0.45)] lg:hidden">
          <p className="font-titulo text-[30px] leading-[1.1] font-semibold tracking-tight">Mobilização Braskem 2027</p>
          <p className="mt-3 text-base opacity-80">Acompanhamento das contratações.</p>
        </div>
        <div
          data-testid="cartao-entrada"
          className="rounded-t-[22px] bg-fundo p-5 text-texto lg:flex lg:flex-1 lg:items-center lg:justify-center lg:rounded-none lg:bg-transparent lg:px-4 lg:py-10"
        >
          <div className="mx-auto w-full max-w-sm">
            <h1 className="font-titulo text-4xl font-semibold tracking-tight">Entrar</h1>
            <p className="mt-2 mb-8 text-texto-suave">Você recebe um código no seu e-mail. Não precisa de senha.</p>
            <FormularioEntrada semAcesso={erro === 'sem-acesso'} />
          </div>
        </div>
      </main>
    </div>
  )
}
