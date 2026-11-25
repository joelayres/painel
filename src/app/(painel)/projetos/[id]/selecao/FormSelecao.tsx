'use client'

import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { Botao } from '@/components/ui/Botao'
import { Campo, classeControle } from '@/components/ui/Campo'
import { salvarSelecao } from './acoesSelecao'

// Cria ou edita a seleção: a função (com as funções das vagas do projeto como sugestão) e o descritivo.
export function FormSelecao({
  projetoId,
  selecao,
  funcoes,
  aoSalvar,
}: {
  projetoId: string
  selecao?: { id: string; funcao: string; descritivo: string }
  funcoes: string[]
  aoSalvar?: (id: string) => void
}) {
  const router = useRouter()
  const idLista = useId()
  const idDesc = useId()
  const [funcao, setFuncao] = useState(selecao?.funcao ?? '')
  const [descritivo, setDescritivo] = useState(selecao?.descritivo ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, iniciar] = useTransition()

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    iniciar(async () => {
      const r = await salvarSelecao(selecao?.id ?? null, { projetoId, funcao, descritivo })
      if (!r.ok) return setErro(r.erro)
      if (aoSalvar) aoSalvar(r.id)
      else router.push(`/projetos/${projetoId}/selecao/${r.id}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <Campo rotulo="Função" value={funcao} onChange={(e) => setFuncao(e.target.value)} list={idLista} maxLength={120} required />
      <datalist id={idLista}>{funcoes.map((f) => <option key={f} value={f} />)}</datalist>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={idDesc} className="text-sm font-medium text-texto-suave">Descritivo da vaga</label>
        <textarea
          id={idDesc}
          value={descritivo}
          onChange={(e) => setDescritivo(e.target.value)}
          rows={10}
          maxLength={20000}
          required
          placeholder="Atividades, qualificações obrigatórias e desejáveis, cursos e NRs, experiência mínima..."
          className={`${classeControle} py-2`}
        />
      </div>
      {erro && <p role="alert" className="text-sm text-[var(--st-reprovada-texto)]">{erro}</p>}
      <div><Botao type="submit" disabled={enviando}>{enviando ? 'Salvando...' : selecao ? 'Salvar descritivo' : 'Criar seleção'}</Botao></div>
    </form>
  )
}
