'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Botao } from '@/components/ui/Botao'
import { classeControle } from '@/components/ui/Campo'
import { RESULTADOS, type Resultado } from '@/dominio/selecao'
import { dataBR } from '@/lib/formato/datas'
import { incluirDoBanco } from '../projetos/[id]/selecao/acoesSelecao'

export type LinhaCandidato = { id: string; nome: string; cidade: string | null; uf: string | null; ultima_em: string; funcoes: string[]; melhor_nota: number | null; resultados: Resultado[]; indicacoes: string[] }
type SelecaoAberta = { id: string; projetoId: string; rotulo: string }

export function TabelaCandidatos({ candidatos, selecoes }: { candidatos: LinhaCandidato[]; selecoes: SelecaoAberta[] }) {
  const router = useRouter()
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [destino, setDestino] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, iniciar] = useTransition()
  const alternar = (id: string) => setMarcados((m) => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n })

  function incluir() {
    const sel = selecoes.find((s) => s.id === destino)
    if (!sel) return
    setErro(null)
    iniciar(async () => {
      const r = await incluirDoBanco(sel.id, [...marcados])
      if (!r.ok) return setErro(r.erro)
      router.push(`/projetos/${sel.projetoId}/selecao/${sel.id}`)
    })
  }

  if (candidatos.length === 0) return <p className="rounded-xl border border-borda bg-superficie p-4 text-texto-suave">Nenhum candidato encontrado.</p>

  return (
    <div className="flex flex-col gap-3">
      {selecoes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="destino" className="text-sm font-medium text-texto-suave">Incluir marcados na seleção</label>
          <select id="destino" value={destino} onChange={(e) => setDestino(e.target.value)} className={`${classeControle} w-auto`}>
            <option value="">Escolha...</option>
            {selecoes.map((s) => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
          </select>
          <Botao disabled={!destino || marcados.size === 0 || enviando} onClick={incluir}>Incluir ({marcados.size})</Botao>
          {erro && <p role="alert" className="text-sm text-[var(--st-reprovada-texto)]">{erro}</p>}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-borda bg-superficie">
        <table className="w-full text-sm">
          <thead className="text-left text-texto-suave">
            <tr>
              <th className="p-2"><span className="sr-only">Marcar</span></th>
              <th className="p-2">Nome</th><th className="p-2">Cidade/UF</th><th className="p-2">Funções</th>
              <th className="p-2">Melhor nota</th><th className="p-2">Resultados</th><th className="p-2">Indicado por</th><th className="p-2">Última participação</th>
            </tr>
          </thead>
          <tbody>
            {candidatos.map((c) => (
              <tr key={c.id} className="border-t border-borda">
                <td className="p-2"><input type="checkbox" aria-label={`Marcar ${c.nome}`} checked={marcados.has(c.id)} onChange={() => alternar(c.id)} className="size-4" /></td>
                <td className="p-2"><Link href={`/candidatos/${c.id}`} className="font-semibold text-primaria hover:underline">{c.nome}</Link></td>
                <td className="p-2">{[c.cidade, c.uf].filter(Boolean).join('/') || '—'}</td>
                <td className="p-2">{c.funcoes.join(', ') || '—'}</td>
                <td className="p-2">{c.melhor_nota ?? '—'}</td>
                <td className="p-2">{c.resultados.map((r) => RESULTADOS[r]).join(', ') || '—'}</td>
                <td className="p-2">{c.indicacoes.join(', ') || '—'}</td>
                <td className="p-2">{dataBR(c.ultima_em.slice(0, 10))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {candidatos.length === 200 && <p className="text-sm text-texto-suave">Mostrando os 200 mais recentes. Use os filtros para refinar.</p>}
    </div>
  )
}
