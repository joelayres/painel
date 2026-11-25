'use client'

import { useState } from 'react'
import { Botao } from '@/components/ui/Botao'
import { PainelLateral } from '@/components/ui/PainelLateral'
import { FormSelecao } from './FormSelecao'

export function NovaSelecao({ projetoId, funcoes }: { projetoId: string; funcoes: string[] }) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <Botao onClick={() => setAberto(true)}>+ Nova seleção</Botao>
      <PainelLateral titulo="Nova seleção" aberto={aberto} aoFechar={() => setAberto(false)}>
        <FormSelecao projetoId={projetoId} funcoes={funcoes} />
      </PainelLateral>
    </>
  )
}
