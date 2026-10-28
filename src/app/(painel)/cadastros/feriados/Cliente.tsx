'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { ErroGeral } from '@/components/rh/ErroGeral'
import { useEnvio } from '@/components/rh/useEnvio'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { dataBR } from '@/lib/formato/datas'
import { removerFeriado, salvarFeriado } from '../acoesCadastros'

export function CadastroFeriados({ feriados }: { feriados: { data: string; nome: string }[] }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const { erros, pendente: salvando, enviar } = useEnvio((d) => salvarFeriado(d), () => router.refresh())
  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={enviar} className="flex flex-wrap items-end gap-3 rounded-xl border border-borda bg-superficie p-4">
        <Campo rotulo="Data" name="data" type="date" erro={erros.data} required />
        <Campo rotulo="Nome" name="nome" erro={erros.nome} required className="min-w-64 flex-1" />
        <Botao type="submit" disabled={salvando}>Adicionar feriado</Botao>
        <ErroGeral mensagem={erros._} />
      </form>
      <ul className="rounded-xl border border-borda bg-superficie">
        {feriados.map((f) => (
          <li key={f.data} className="flex items-center gap-3 border-b border-borda px-4 py-2.5 last:border-0">
            <span className="w-28 font-medium">{dataBR(f.data)}</span>
            <span className="flex-1">{f.nome}</span>
            <Botao variante="fantasma" disabled={pendente} onClick={() => iniciar(async () => { await removerFeriado(f.data); router.refresh() })}>Remover</Botao>
          </li>
        ))}
      </ul>
    </div>
  )
}
