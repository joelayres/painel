'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type FormEvent } from 'react'
import { Botao } from '@/components/ui/Botao'
import { alterarDuracaoProjeto } from './acoesConfigurar'

export type EtapaDuracao = { ordem: number; nome: string; padrao: number; ajuste: number | null }

function Linha({ projetoId, etapa, somenteLeitura }: { projetoId: string; etapa: EtapaDuracao; somenteLeitura: boolean }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const enviar = (duracao: string) =>
    iniciar(async () => {
      const r = await alterarDuracaoProjeto(projetoId, etapa.ordem, { duracao })
      if (!r.ok) return setErro(r.erros.duracao ?? r.erros._ ?? null)
      setErro(null)
      router.refresh()
    })

  const salvar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    enviar(String(new FormData(e.currentTarget).get('duracao') ?? ''))
  }

  const ajustado = etapa.ajuste !== null
  return (
    <tr className="border-b border-borda last:border-0 align-top">
      <td className="px-4 py-3 font-medium">{etapa.ordem}. {etapa.nome}</td>
      <td className="px-4 py-3">{etapa.padrao} dias úteis</td>
      <td className="px-4 py-3">
        {somenteLeitura ? (
          <span>{ajustado ? `${etapa.ajuste} dias úteis (ajustado)` : '—'}</span>
        ) : (
          <form onSubmit={salvar} className="flex flex-wrap items-center gap-2">
            <input
              name="duracao" type="number" min={0} max={60} defaultValue={etapa.ajuste ?? ''} placeholder={String(etapa.padrao)}
              aria-label={`Duração de ${etapa.nome} neste projeto`}
              className="min-h-11 w-20 rounded-lg border border-borda bg-superficie px-3 text-texto"
            />
            <Botao type="submit" variante="secundario" disabled={pendente}>Salvar</Botao>
            {ajustado && (
              <>
                <span className="text-sm font-medium text-texto-suave">ajustado</span>
                <Botao type="button" variante="fantasma" disabled={pendente} onClick={() => enviar('')}>Voltar ao padrão</Botao>
              </>
            )}
            {erro && <span role="alert" className="w-full text-sm text-[var(--st-reprovada-texto)]">{erro}</span>}
          </form>
        )}
      </td>
    </tr>
  )
}

// Duração das etapas neste projeto; o campo vazio usa o padrão do cliente.
export function DuracoesProjeto({ projetoId, cliente, etapas, somenteLeitura }: { projetoId: string; cliente: string; etapas: EtapaDuracao[]; somenteLeitura: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-borda bg-superficie">
      <table className="w-full text-left text-[15px]">
        <thead>
          <tr className="border-b border-borda bg-superficie-2 text-sm text-texto-suave">
            <th className="px-4 py-2.5 font-medium">Etapa</th>
            <th className="px-4 py-2.5 font-medium">Padrão {cliente}</th>
            <th className="px-4 py-2.5 font-medium">Neste projeto</th>
          </tr>
        </thead>
        <tbody>
          {etapas.map((e) => <Linha key={e.ordem} projetoId={projetoId} etapa={e} somenteLeitura={somenteLeitura} />)}
        </tbody>
      </table>
    </div>
  )
}
