'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { concluirEtapas } from '@/app/(painel)/vagas/[id]/acoesVaga'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import type { EtapaDef } from '@/dominio/etapas'
import type { VagaPainel } from '@/dominio/painel'
import { hojeSP } from '@/dominio/tempo'

// Confirmação ao soltar o cartão: conclui as etapas de `de` até `ate`, todas na mesma data.
export function ConfirmarAvanco({ vaga, de, ate, etapas, aoFechar }: { vaga: VagaPainel; de: number; ate: number; etapas: EtapaDef[]; aoFechar: () => void }) {
  const router = useRouter()
  const [data, setData] = useState(hojeSP())
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const painel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    painel.current?.querySelector('input')?.focus()
    return () => anterior?.focus?.()
  }, [])

  const nomes = etapas.filter((e) => e.ordem >= de && e.ordem <= ate).map((e) => e.nome)
  const lista = nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}` : nomes[0]
  const texto = nomes.length > 1 ? `Concluir ${nomes.length} etapas: ${lista}` : `Concluir ${lista}`

  const concluir = () =>
    iniciar(async () => {
      const r = await concluirEtapas(vaga.id, de, ate, data)
      if (!r.ok) return setErro(r.erro)
      router.refresh()
      aoFechar()
    })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmar-avanco-titulo"
        onKeyDown={(e) => {
          if (e.key === 'Escape') aoFechar()
          // Mantém o foco dentro do painel.
          if (e.key === 'Tab') {
            const itens = [...e.currentTarget.querySelectorAll<HTMLElement>('input, button:not(:disabled)')]
            const primeiro = itens[0]
            const ultimo = itens[itens.length - 1]
            if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus() }
            else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus() }
          }
        }}
        className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-superficie p-5 shadow-xl"
      >
        <h2 id="confirmar-avanco-titulo" className="font-titulo text-lg font-semibold">{vaga.funcao}</h2>
        <p>{texto}</p>
        <Campo rotulo="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        {erro && <p role="alert" className="rounded-lg px-3 py-2 font-medium" style={{ background: 'var(--st-reprovada-fundo)', color: 'var(--st-reprovada-texto)' }}>{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="button" onClick={concluir} disabled={pendente || !data}>{pendente ? 'Concluindo...' : 'Concluir'}</Botao>
        </div>
      </div>
    </div>
  )
}
