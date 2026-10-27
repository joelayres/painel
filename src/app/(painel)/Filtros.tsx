'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type Opcoes = { ondas: number[]; funcoes: string[]; areas: string[]; gestores: { id: string; nome: string }[] }

const classe = 'min-h-11 rounded-lg border border-borda bg-superficie px-3'

// Os filtros vivem no endereço: um link filtrado pode ser compartilhado.
export function Filtros({ opcoes }: { opcoes: Opcoes }) {
  const router = useRouter()
  const caminho = usePathname()
  const params = useSearchParams()
  const [candidato, setCandidato] = useState(params.get('candidato') ?? '')

  const aplicar = (chave: string, valor: string) => {
    const novos = new URLSearchParams(params.toString())
    if (valor) novos.set(chave, valor)
    else novos.delete(chave)
    const busca = novos.toString()
    router.push(busca ? `${caminho}?${busca}` : caminho)
  }

  // A busca por candidato espera a pessoa parar de digitar.
  useEffect(() => {
    if (candidato === (params.get('candidato') ?? '')) return
    const t = setTimeout(() => aplicar('candidato', candidato.trim()), 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidato])

  const selecao = (rotulo: string, chave: string, itens: { valor: string; rotulo: string }[]) => (
    <select aria-label={rotulo} value={params.get(chave) ?? ''} onChange={(e) => aplicar(chave, e.target.value)} className={classe}>
      <option value="">{rotulo}: todos</option>
      {itens.map((i) => <option key={i.valor} value={i.valor}>{i.rotulo}</option>)}
    </select>
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selecao('Onda', 'onda', opcoes.ondas.map((n) => ({ valor: String(n), rotulo: `${n}ª Onda` })))}
      {selecao('Função', 'funcao', opcoes.funcoes.map((f) => ({ valor: f, rotulo: f })))}
      {selecao('Área', 'area', opcoes.areas.map((a) => ({ valor: a, rotulo: a })))}
      {selecao('Gestor', 'gestor', opcoes.gestores.map((g) => ({ valor: g.id, rotulo: g.nome })))}
      <input aria-label="Candidato" type="search" placeholder="Buscar candidato" value={candidato} onChange={(e) => setCandidato(e.target.value)} className={`${classe} w-48`} />
    </div>
  )
}
