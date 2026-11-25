'use client'

import { useState, useTransition } from 'react'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { excluirCandidato } from '../acoesCandidatos'

// Exclusão definitiva (pedido do titular, LGPD). Só libera o botão com o nome digitado.
export function ExcluirCandidato({ id, nome }: { id: string; nome: string }) {
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, iniciar] = useTransition()
  const confere = confirmacao.trim().toLocaleLowerCase('pt-BR') === nome.trim().toLocaleLowerCase('pt-BR')

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-[var(--st-reprovada-texto)] p-4">
      <h3 className="font-titulo text-lg font-semibold">Excluir candidato</h3>
      <p className="text-sm text-texto-suave">Apaga de vez o candidato, os currículos, as análises e as entrevistas, em todas as seleções. Use só a pedido do titular dos dados.</p>
      <Campo rotulo={`Digite "${nome}" para confirmar`} value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
      {erro && <p role="alert" className="text-sm text-[var(--st-reprovada-texto)]">{erro}</p>}
      <Botao variante="perigo" className="self-start" disabled={!confere || enviando} onClick={() => iniciar(async () => { const r = await excluirCandidato(id); if (r && !r.ok) setErro(r.erro) })}>
        Excluir de vez
      </Botao>
    </section>
  )
}
