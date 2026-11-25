'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Botao } from '@/components/ui/Botao'
import { PainelLateral } from '@/components/ui/PainelLateral'
import { encerrarSelecao } from '../acoesSelecao'
import { FormSelecao } from '../FormSelecao'
import type { Selecao } from './dados'

export function CabecalhoSelecao({ selecao, funcoes }: { selecao: Selecao; funcoes: string[] }) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [verDescritivo, setVerDescritivo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, iniciar] = useTransition()
  const encerrada = selecao.encerrada_em !== null

  function alternar() {
    iniciar(async () => {
      const r = await encerrarSelecao(selecao.id, !encerrada)
      if (!r.ok) setErro(r.erro)
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-titulo text-xl font-semibold">Seleção · {selecao.funcao}{encerrada && <span className="ml-2 text-base font-normal text-texto-suave">(encerrada)</span>}</h3>
        <div className="flex flex-wrap gap-2">
          <a href={`/projetos/${selecao.projeto_id}/selecao/${selecao.id}/excel`} className="inline-flex min-h-11 items-center rounded-lg border border-primaria px-4 font-semibold text-primaria hover:bg-primaria-suave">Baixar Excel</a>
          {!encerrada && <Botao variante="secundario" onClick={() => setEditando(true)}>Editar descritivo</Botao>}
          <Botao variante="fantasma" disabled={enviando} onClick={alternar}>{encerrada ? 'Reabrir seleção' : 'Encerrar seleção'}</Botao>
        </div>
      </div>
      <button type="button" onClick={() => setVerDescritivo((v) => !v)} className="self-start text-sm font-medium text-primaria hover:underline" aria-expanded={verDescritivo}>
        {verDescritivo ? 'Esconder descritivo' : 'Ver descritivo'}
      </button>
      {verDescritivo && <p className="whitespace-pre-wrap rounded-xl border border-borda bg-superficie p-4 text-sm">{selecao.descritivo}</p>}
      {erro && <p role="alert" className="text-sm text-[var(--st-reprovada-texto)]">{erro}</p>}
      <PainelLateral titulo="Editar descritivo" aberto={editando} aoFechar={() => setEditando(false)}>
        <p className="mb-3 text-sm text-texto-suave">Análises já feitas guardam o descritivo da época. Para reavaliar com o novo, use “Reanalisar selecionados”.</p>
        <FormSelecao projetoId={selecao.projeto_id} selecao={selecao} funcoes={funcoes} aoSalvar={() => { setEditando(false); router.refresh() }} />
      </PainelLateral>
    </div>
  )
}
