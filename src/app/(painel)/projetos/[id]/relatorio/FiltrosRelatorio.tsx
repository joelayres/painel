'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { Relatorio } from '@/dominio/relatorio'

const classe = 'min-h-11 rounded-lg border border-borda bg-superficie px-3'
const FILTROS = [
  { chave: 'funcao', rotulo: 'Função', opcoes: 'funcoes', todas: 'todas' },
  { chave: 'disciplina', rotulo: 'Disciplina', opcoes: 'disciplinas', todas: 'todas' },
  { chave: 'area', rotulo: 'Área', opcoes: 'areas', todas: 'todas' },
  { chave: 'gestor', rotulo: 'Gestor', opcoes: 'gestores', todas: 'todos' },
] as const

// Os filtros vivem no endereço, como no Painel: o link filtrado pode ser compartilhado e o Excel sai igual.
export function FiltrosRelatorio({ opcoes }: { opcoes: Relatorio['opcoes'] }) {
  const router = useRouter()
  const caminho = usePathname()
  const params = useSearchParams()

  const ir = (mudar: (p: URLSearchParams) => void) => {
    const novos = new URLSearchParams(params.toString())
    mudar(novos)
    const busca = novos.toString()
    router.push(busca ? `${caminho}?${busca}` : caminho)
  }
  const ativo = FILTROS.some((f) => params.get(f.chave))

  return (
    <div className="flex flex-wrap items-center gap-2">
      {FILTROS.map((f) => (
        <select
          key={f.chave} aria-label={f.rotulo} value={params.get(f.chave) ?? ''} className={classe}
          onChange={(e) => { const valor = e.target.value; ir((p) => (valor ? p.set(f.chave, valor) : p.delete(f.chave))) }}
        >
          <option value="">{f.rotulo}: {f.todas}</option>
          {opcoes[f.opcoes].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      ))}
      {ativo && (
        <button type="button" onClick={() => ir((p) => FILTROS.forEach((f) => p.delete(f.chave)))} className="min-h-11 px-2 text-sm font-medium text-primaria hover:underline focus-visible:outline-2 focus-visible:outline-foco">
          Limpar filtros
        </button>
      )}
    </div>
  )
}
