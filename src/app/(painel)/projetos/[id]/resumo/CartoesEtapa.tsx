import Link from 'next/link'
import type { CartaoEtapa } from '@/dominio/painel'
import { COR_PRAZO } from '../../../cores'

export function CartoesEtapa({ cartoes, hrefFuncao }: { cartoes: CartaoEtapa[]; hrefFuncao: (funcao: string) => string }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cartoes.map((c) => (
        <section key={c.ordem ?? 'mobilizadas'} className={`rounded-xl border border-borda bg-superficie p-4 ${c.total === 0 ? 'opacity-60' : ''}`}>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">{c.ordem === null ? c.nome : `${c.ordem}. ${c.nome}`}</h3>
            <span className="font-titulo text-[32px] leading-none font-semibold">{c.total}</span>
          </div>
          {c.total === 0 ? (
            <p className="mt-3 text-sm text-texto-suave">nenhuma vaga</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1">
              {c.funcoes.map((f) => {
                const linha = (
                  <>
                    <span>{f.funcao}</span>
                    <span className="font-semibold">{f.total}</span>
                    {(f.vermelho > 0 || f.amarelo > 0) && (
                      <span className="basis-full text-xs">
                        {f.vermelho > 0 && <span style={{ color: COR_PRAZO.vermelho }} className="font-semibold">{f.vermelho} atrasadas</span>}
                        {f.vermelho > 0 && f.amarelo > 0 && ' · '}
                        {f.amarelo > 0 && <span style={{ color: COR_PRAZO.amarelo }} className="font-semibold">{f.amarelo} em risco</span>}
                      </span>
                    )}
                  </>
                )
                const classe = 'flex flex-wrap items-baseline justify-between gap-x-2 rounded-md px-1 py-1 text-sm'
                // O painel esconde as vagas mobilizadas: no cartão delas a função é só texto.
                return (
                  <li key={f.funcao}>
                    {c.ordem === null ? (
                      <div className={classe}>{linha}</div>
                    ) : (
                      <Link href={hrefFuncao(f.funcao)} className={`${classe} hover:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-foco`}>
                        {linha}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
