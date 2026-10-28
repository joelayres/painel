'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Botao } from '@/components/ui/Botao'
import { hojeSP } from '@/dominio/tempo'
import { candidatoDesistiu, concluirEtapa, desfazerEtapa } from './acoesVaga'

type Props = {
  vagaId: string
  perfil: 'rh' | 'visualizador'
  etapaAtual: { ordem: number; nome: string } | null
  ultimaConcluida: number | null
  admitida?: boolean
  hoje: string
}

export function Acoes({ vagaId, perfil, etapaAtual, ultimaConcluida, admitida = false, hoje }: Props) {
  const router = useRouter()
  const [data, setData] = useState(hoje)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [pendente, iniciar] = useTransition()
  const [alterouData, setAlterouData] = useState(false)

  // Aba aberta de um dia para o outro: enquanto a pessoa não escolheu outra data, o padrão segue o dia de hoje.
  useEffect(() => {
    const aoVoltar = () => { if (!alterouData) setData(hojeSP()) }
    window.addEventListener('focus', aoVoltar)
    return () => window.removeEventListener('focus', aoVoltar)
  }, [alterouData])

  if (perfil !== 'rh') return null

  const executar = (acao: () => Promise<{ ok: true } | { ok: false; erro: string }>) =>
    iniciar(async () => {
      setErro(null)
      const r = await acao()
      if (!r.ok) setErro(r.erro)
      else {
        setConfirmando(false)
        router.refresh()
      }
    })

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-borda bg-superficie p-4">
      {etapaAtual && (
        <div className="flex flex-wrap items-end gap-2">
          <Botao disabled={pendente} onClick={() => executar(() => concluirEtapa(vagaId, etapaAtual.ordem, data))}>
            Concluir {etapaAtual.nome}
          </Botao>
          <label className="flex flex-col text-sm text-texto-suave">
            Concluída em
            <input type="date" value={data} max={hojeSP()} onChange={(e) => { setData(e.target.value); setAlterouData(true) }} className="min-h-11 rounded-lg border border-borda bg-superficie px-3 text-texto" />
          </label>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {ultimaConcluida !== null && (
          <Botao variante="secundario" disabled={pendente} onClick={() => executar(() => desfazerEtapa(vagaId, ultimaConcluida))}>
            Desfazer último avanço
          </Botao>
        )}
        {etapaAtual && !admitida &&
          (confirmando ? (
            <>
              <Botao variante="perigo" disabled={pendente} onClick={() => executar(() => candidatoDesistiu(vagaId))}>
                Confirmar desistência
              </Botao>
              <Botao variante="fantasma" onClick={() => setConfirmando(false)}>Voltar</Botao>
            </>
          ) : (
            <Botao variante="perigo" onClick={() => setConfirmando(true)}>Candidato desistiu</Botao>
          ))}
      </div>
      {confirmando && <p className="text-sm text-texto-suave">A vaga volta para Captura de Mercado, o candidato é apagado e a previsão recomeça hoje.</p>}
      {erro && <p role="alert" className="rounded-lg px-3 py-2 font-medium" style={{ background: 'var(--st-reprovada-fundo)', color: 'var(--st-reprovada-texto)' }}>{erro}</p>}
    </div>
  )
}
