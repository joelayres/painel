'use client'

import { Plus, Search, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Botao } from '../ui/Botao'

export type Coluna<T> = { titulo: string; valor: (linha: T) => ReactNode; classe?: string }

// Lista com busca e edição em painel lateral, reutilizada por todos os cadastros do RH.
export function TabelaCadastro<T extends { id: string }>({
  linhas,
  colunas,
  textoBusca,
  rotuloNovo,
  tituloPainel,
  formulario,
  vazio,
  filtros,
}: {
  linhas: T[]
  colunas: Coluna<T>[]
  textoBusca: (linha: T) => string
  rotuloNovo: string
  tituloPainel: (linha: T | null) => string
  formulario: (linha: T | null, fechar: () => void) => ReactNode
  vazio: string
  filtros?: ReactNode
}) {
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<T | null | undefined>(undefined)
  const fechar = () => setEditando(undefined)

  useEffect(() => {
    if (editando === undefined) return
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && fechar()
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [editando])

  const termo = busca.trim().toLowerCase()
  const visiveis = termo ? linhas.filter((l) => textoBusca(l).toLowerCase().includes(termo)) : linhas

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-60 flex-1">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-suave" aria-hidden />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar"
            className="min-h-11 w-full rounded-lg border border-borda bg-superficie pr-3 pl-9 focus:border-primaria focus:outline-2 focus:outline-primaria/30"
          />
        </label>
        {filtros}
        <Botao onClick={() => setEditando(null)}>
          <Plus className="size-4" aria-hidden />
          {rotuloNovo}
        </Botao>
      </div>

      {visiveis.length === 0 ? (
        <div className="rounded-xl border border-dashed border-borda p-8 text-center text-texto-suave">
          {termo ? 'Nada encontrado com essa busca.' : vazio}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-borda bg-superficie">
          <table className="w-full text-left text-[15px]">
            <thead>
              <tr className="border-b border-borda bg-superficie-2 text-sm text-texto-suave">
                {colunas.map((c) => (
                  <th key={c.titulo} className={`px-4 py-2.5 font-medium ${c.classe ?? ''}`}>{c.titulo}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((linha) => (
                <tr
                  key={linha.id}
                  onClick={() => setEditando(linha)}
                  className="cursor-pointer border-b border-borda last:border-0 hover:bg-primaria-suave/50"
                >
                  {colunas.map((c, i) => (
                    <td key={c.titulo} className={`px-4 py-3 ${c.classe ?? ''}`}>
                      {i === 0 ? (
                        <button type="button" className="text-left font-medium focus-visible:outline-2 focus-visible:outline-foco" onClick={() => setEditando(linha)}>
                          {c.valor(linha)}
                        </button>
                      ) : (
                        c.valor(linha)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando !== undefined && (
        <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="titulo-painel">
          <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/40" onClick={fechar} />
          <div className="relative flex h-full w-full max-w-md flex-col bg-superficie shadow-2xl">
            <div className="flex items-center justify-between border-b border-borda px-5 py-4">
              <h2 id="titulo-painel" className="font-titulo text-2xl font-semibold">{tituloPainel(editando)}</h2>
              <button type="button" onClick={fechar} aria-label="Fechar" className="rounded-full p-2 hover:bg-primaria-suave">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{formulario(editando, fechar)}</div>
          </div>
        </div>
      )}
    </div>
  )
}
