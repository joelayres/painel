'use client'

import { useRouter } from 'next/navigation'
import { useEnvio } from '@/components/rh/useEnvio'
import { Botao } from '@/components/ui/Botao'
import { alterarDuracaoCliente } from '../../acoesCadastros'

export type EtapaCliente = { ordem: number; nome: string; duracao: number }

function Linha({ clienteId, etapa }: { clienteId: string; etapa: EtapaCliente }) {
  const router = useRouter()
  const { erros, pendente, enviar } = useEnvio((d) => alterarDuracaoCliente(clienteId, etapa.ordem, { duracao: String(d.duracao ?? '') }), () => router.refresh())
  return (
    <form onSubmit={enviar} className="flex flex-wrap items-center gap-3 border-b border-borda px-4 py-3 last:border-0">
      <span className="min-w-64 flex-1 font-medium">{etapa.ordem}. {etapa.nome}</span>
      <label className="flex items-center gap-2 text-sm text-texto-suave">
        <input name="duracao" type="number" min={0} max={60} defaultValue={etapa.duracao} aria-label={`Duração de ${etapa.nome}`} className="min-h-11 w-20 rounded-lg border border-borda bg-superficie px-3 text-texto" />
        dias úteis
      </label>
      <Botao type="submit" variante="secundario" disabled={pendente}>Salvar{' '}<span className="sr-only">{etapa.nome}</span></Botao>
      {erros.duracao && <span role="alert" className="w-full text-sm text-[var(--st-reprovada-texto)]">{erros.duracao}</span>}
      {erros._ && <span role="alert" className="w-full text-sm text-[var(--st-reprovada-texto)]">{erros._}</span>}
    </form>
  )
}

// Duração padrão das etapas do cliente; cada projeto pode ajustar a sua.
export function Duracoes({ clienteId, etapas }: { clienteId: string; etapas: EtapaCliente[] }) {
  return (
    <div className="rounded-xl border border-borda bg-superficie">
      <p className="border-b border-borda px-4 py-3 text-sm text-texto-suave">Vale para os projetos deste cliente que não ajustaram a etapa.</p>
      {etapas.map((e) => <Linha key={e.ordem} clienteId={clienteId} etapa={e} />)}
    </div>
  )
}
