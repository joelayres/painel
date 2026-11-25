'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Botao } from '@/components/ui/Botao'
import { Campo, classeControle } from '@/components/ui/Campo'
import { CLASSIFICACOES, RESULTADOS } from '@/dominio/selecao'

// A ordem dos filtros no endereço é fixa: o link da busca pode ser compartilhado.
export const CHAVES = ['nome', 'funcao', 'resultado', 'classificacao', 'nota', 'uf', 'desde', 'indicacao'] as const

export function FiltrosCandidatos({ indicadores }: { indicadores: string[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const [f, setF] = useState<Record<(typeof CHAVES)[number], string>>(() => Object.fromEntries(CHAVES.map((k) => [k, params.get(k) ?? ''])) as Record<(typeof CHAVES)[number], string>)
  const mudar = (k: (typeof CHAVES)[number]) => (e: { target: { value: string } }) => setF((a) => ({ ...a, [k]: e.target.value }))

  function buscar(e: React.FormEvent) {
    e.preventDefault()
    const novos = new URLSearchParams()
    for (const k of CHAVES) if (f[k].trim()) novos.set(k, f[k].trim())
    const busca = novos.toString()
    router.push(busca ? `/candidatos?${busca}` : '/candidatos')
  }

  return (
    <form onSubmit={buscar} className="grid gap-3 rounded-xl border border-borda bg-superficie p-4 sm:grid-cols-4">
      <Campo rotulo="Nome" value={f.nome} onChange={mudar('nome')} />
      <Campo rotulo="Função" value={f.funcao} onChange={mudar('funcao')} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="filtro-resultado" className="text-sm font-medium text-texto-suave">Resultado</label>
        <select id="filtro-resultado" value={f.resultado} onChange={mudar('resultado')} className={classeControle}>
          <option value="">Todos</option>
          {Object.entries(RESULTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="filtro-classificacao" className="text-sm font-medium text-texto-suave">Classificação</label>
        <select id="filtro-classificacao" value={f.classificacao} onChange={mudar('classificacao')} className={classeControle}>
          <option value="">Todas</option>
          {Object.entries(CLASSIFICACOES).filter(([k]) => k !== 'a_confirmar').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Campo rotulo="Nota mínima" type="number" min={0} max={100} value={f.nota} onChange={mudar('nota')} />
      <Campo rotulo="UF" maxLength={2} value={f.uf} onChange={mudar('uf')} />
      <Campo rotulo="Participou desde" type="date" value={f.desde} onChange={mudar('desde')} />
      <Campo rotulo="Indicado por" value={f.indicacao} onChange={mudar('indicacao')} list="filtro-indicadores" />
      <datalist id="filtro-indicadores">{indicadores.map((i) => <option key={i} value={i} />)}</datalist>
      <div className="flex items-end"><Botao type="submit">Buscar</Botao></div>
    </form>
  )
}
