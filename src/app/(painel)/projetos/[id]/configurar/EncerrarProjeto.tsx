'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { encerrarProjeto, reabrirProjeto } from '@/app/(painel)/acoesProjeto'
import { Botao } from '@/components/ui/Botao'

// Encerrar (pede confirmação) ou reabrir o projeto.
export function EncerrarProjeto({ projetoId, encerrado }: { projetoId: string; encerrado: boolean }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const executar = (acao: (id: string) => Promise<{ ok: true } | { ok: false; erro: string }>) =>
    iniciar(async () => {
      const r = await acao(projetoId)
      setConfirmando(false)
      if (!r.ok) return setErro(r.erro)
      setErro(null)
      router.refresh()
    })

  return (
    <div className="flex flex-wrap items-center gap-3">
      {encerrado ? (
        <Botao variante="secundario" disabled={pendente} onClick={() => executar(reabrirProjeto)}>Reabrir projeto</Botao>
      ) : confirmando ? (
        <>
          <span className="font-medium">Encerrar este projeto? As vagas ficam só para leitura.</span>
          <Botao variante="perigo" disabled={pendente} onClick={() => executar(encerrarProjeto)}>Confirmar</Botao>
          <Botao variante="fantasma" onClick={() => setConfirmando(false)}>Voltar</Botao>
        </>
      ) : (
        <Botao variante="perigo" onClick={() => setConfirmando(true)}>Encerrar projeto</Botao>
      )}
      {erro && <p role="alert" className="text-[var(--st-reprovada-texto)]">{erro}</p>}
    </div>
  )
}
