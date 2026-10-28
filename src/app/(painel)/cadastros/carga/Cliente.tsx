'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { Botao } from '@/components/ui/Botao'
import type { VagaCarga } from '@/lib/carga/ler'
import { importarCarga, previaCarga } from '../acoesCadastros'

export function CargaInicial({ podeImportar }: { podeImportar: boolean }) {
  const router = useRouter()
  const form = useRef<HTMLFormElement>(null)
  const [vagas, setVagas] = useState<VagaCarga[] | null>(null)
  const [erros, setErros] = useState<{ linha: number; mensagem: string }[]>([])
  const [aviso, setAviso] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const ver = () =>
    iniciar(async () => {
      setAviso(null)
      const r = await previaCarga(new FormData(form.current!))
      if (r.ok) { setVagas(r.vagas); setErros([]) } else { setVagas(null); setErros(r.erros) }
    })
  const importar = () =>
    iniciar(async () => {
      const r = await importarCarga(new FormData(form.current!))
      if (r.ok) { setAviso(`${r.vagas} vagas importadas.`); setVagas(null); router.refresh() } else setAviso(r.erro)
    })

  if (!podeImportar) return <p className="rounded-xl border border-dashed border-borda p-6 text-texto-suave">O painel já tem vagas. A carga inicial só pode ser feita com o painel vazio.</p>

  return (
    <div className="flex flex-col gap-4">
      <form ref={form} className="flex flex-wrap items-center gap-3 rounded-xl border border-borda bg-superficie p-4">
        <input name="arquivo" type="file" accept=".xlsx" aria-label="Planilha de acompanhamento" onChange={() => { setVagas(null); setErros([]) }} />
        <Botao type="button" variante="secundario" disabled={pendente} onClick={ver}>Ver prévia</Botao>
      </form>
      {erros.length > 0 && (
        <ul role="alert" className="rounded-xl p-4 text-sm" style={{ background: 'var(--st-reprovada-fundo)', color: 'var(--st-reprovada-texto)' }}>
          {erros.map((e) => <li key={`${e.linha}-${e.mensagem}`}>{e.linha ? `Linha ${e.linha}: ` : ''}{e.mensagem}</li>)}
        </ul>
      )}
      {vagas && (
        <div className="rounded-xl border border-borda bg-superficie p-4">
          <p className="font-medium">{vagas.length} vagas · {[1, 2, 3, 4].map((o) => `${o}ª Onda: ${vagas.filter((v) => v.onda === o).length}`).join(' · ')}</p>
          <p className="text-sm text-texto-suave">{vagas.reduce((s, v) => s + v.concluidas.length, 0)} etapas já concluídas · {vagas.filter((v) => v.candidato).length} com candidato</p>
          <Botao className="mt-3" disabled={pendente} onClick={importar}>Importar {vagas.length} vagas</Botao>
        </div>
      )}
      {aviso && <p role="status" className="font-medium">{aviso}</p>}
    </div>
  )
}
