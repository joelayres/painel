'use client'

import { useState } from 'react'
import { linkCurriculo } from '../../projetos/[id]/selecao/acoesSelecao'

export function VerCurriculo({ curriculoId }: { curriculoId: string }) {
  const [erro, setErro] = useState<string | null>(null)
  async function abrir() {
    const r = await linkCurriculo(curriculoId)
    if (r.ok) window.open(r.url, '_blank', 'noopener')
    else setErro(r.erro)
  }
  return (
    <>
      <button type="button" onClick={abrir} className="font-medium text-primaria hover:underline">Ver</button>
      {erro && <span role="alert" className="text-[var(--st-reprovada-texto)]">{erro}</span>}
    </>
  )
}
