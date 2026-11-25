'use client'

import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { Botao } from '@/components/ui/Botao'
import { Campo, classeControle } from '@/components/ui/Campo'
import { hojeSP } from '@/dominio/tempo'
import { PARECERES, TIPOS_ENTREVISTA } from '@/dominio/selecao'
import { salvarEntrevista } from '../acoesSelecao'
import type { Entrevista } from './dados'

export function FormEntrevista({ participacaoId, entrevista, aoTerminar }: { participacaoId: string; entrevista?: Entrevista; aoTerminar: () => void }) {
  const router = useRouter()
  const idTipo = useId()
  const idParecer = useId()
  const idImp = useId()
  const [dados, setDados] = useState({
    tipo: entrevista?.tipo ?? 'timenow',
    data: entrevista?.data ?? hojeSP(),
    entrevistador: entrevista?.entrevistador ?? '',
    parecer: entrevista?.parecer ?? 'recomendado',
    impressoes: entrevista?.impressoes ?? '',
  })
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, iniciar] = useTransition()
  const mudar = (k: keyof typeof dados) => (e: { target: { value: string } }) => setDados((d) => ({ ...d, [k]: e.target.value }))

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    iniciar(async () => {
      const r = await salvarEntrevista(entrevista?.id ?? null, participacaoId, dados)
      if (!r.ok) return setErro(r.erro)
      aoTerminar()
      router.refresh()
    })
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-2">
      <label htmlFor={idTipo} className="font-medium text-texto-suave">Entrevista</label>
      <select id={idTipo} value={dados.tipo} onChange={mudar('tipo')} className={classeControle}>
        {Object.entries(TIPOS_ENTREVISTA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <Campo rotulo="Data" type="date" value={dados.data} onChange={mudar('data')} required />
      <Campo rotulo="Entrevistador" value={dados.entrevistador} onChange={mudar('entrevistador')} maxLength={120} required />
      <label htmlFor={idParecer} className="font-medium text-texto-suave">Parecer</label>
      <select id={idParecer} value={dados.parecer} onChange={mudar('parecer')} className={classeControle}>
        {Object.entries(PARECERES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <label htmlFor={idImp} className="font-medium text-texto-suave">Impressões</label>
      <textarea id={idImp} value={dados.impressoes} onChange={mudar('impressoes')} rows={4} maxLength={5000} className={`${classeControle} py-2`} />
      {erro && <p role="alert" className="text-[var(--st-reprovada-texto)]">{erro}</p>}
      <div className="flex gap-2">
        <Botao type="submit" disabled={enviando}>Salvar entrevista</Botao>
        <Botao type="button" variante="fantasma" onClick={aoTerminar}>Cancelar</Botao>
      </div>
    </form>
  )
}
