'use client'

import { useRouter } from 'next/navigation'
import { useEnvio } from '@/components/rh/useEnvio'
import { Botao } from '@/components/ui/Botao'
import { alterarDuracao } from '../acoesCadastros'

type Etapa = { ordem: number; nome: string; duracao: number }

function Linha({ etapa }: { etapa: Etapa }) {
  const router = useRouter()
  const { erros, pendente, enviar } = useEnvio((d) => alterarDuracao(etapa.ordem, d), () => router.refresh())
  return (
    <form onSubmit={enviar} className="flex flex-wrap items-center gap-3 border-b border-borda px-4 py-3 last:border-0">
      <span className="min-w-64 flex-1 font-medium">{etapa.ordem}. {etapa.nome}</span>
      <label className="flex items-center gap-2 text-sm text-texto-suave">
        <input name="duracao" type="number" min={0} max={60} defaultValue={etapa.duracao} aria-label={`Duração de ${etapa.nome}`} className="min-h-11 w-20 rounded-lg border border-borda bg-superficie px-3 text-texto" />
        dias úteis
      </label>
      <Botao type="submit" variante="secundario" disabled={pendente}>Salvar</Botao>
      {erros.duracao && <span className="w-full text-sm text-[var(--st-reprovada-texto)]">{erros.duracao}</span>}
    </form>
  )
}

export function CadastroEtapas({ etapas }: { etapas: Etapa[] }) {
  return (
    <div className="rounded-xl border border-borda bg-superficie">
      <p className="border-b border-borda px-4 py-3 text-sm text-texto-suave">Mudar uma duração recalcula na hora as previsões de todas as vagas. As datas já concluídas não mudam.</p>
      {etapas.map((e) => <Linha key={e.ordem} etapa={e} />)}
    </div>
  )
}
