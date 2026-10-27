'use client'

import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

// Painel que abre pela direita (tela cheia no celular). Fecha com Esc ou clicando fora.
export function PainelLateral({ titulo, aberto, aoFechar, children }: { titulo: string; aberto: boolean; aoFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberto, aoFechar])

  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={titulo}>
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/40" onClick={aoFechar} />
      <div className="relative flex h-full w-full max-w-md flex-col bg-superficie shadow-2xl">
        <div className="flex items-center justify-between border-b border-borda px-5 py-4">
          <h2 className="font-titulo text-2xl font-semibold">{titulo}</h2>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="rounded-full p-2 hover:bg-primaria-suave">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}
