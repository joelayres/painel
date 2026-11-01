'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Botao } from '@/components/ui/Botao'
import { hojeSP } from '@/dominio/tempo'
import type { Perfil } from '@/lib/auth/perfil'
import { adiarEtapa, candidatoDesistiu, concluirEtapa, desfazerEtapa } from './acoesVaga'

type Props = {
  vagaId: string
  perfil: Perfil
  etapaAtual: { ordem: number; nome: string } | null
  ultimaConcluida: number | null
  admitida?: boolean
  hoje: string
  // Data sugerida para adiar a etapa atual: o início da onda da vaga.
  inicioDaOnda?: string | null
}

export function Acoes({ vagaId, perfil, etapaAtual, ultimaConcluida, admitida = false, hoje, inicioDaOnda = null }: Props) {
  const router = useRouter()
  const [data, setData] = useState(hoje)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [pendente, iniciar] = useTransition()
  const [alterouData, setAlterouData] = useState(false)
  const [adiando, setAdiando] = useState(false)
  const [adiarPara, setAdiarPara] = useState('')

  // Aba aberta de um dia para o outro: enquanto a pessoa não escolheu outra data, o padrão segue o dia de hoje.
  useEffect(() => {
    const aoVoltar = () => { if (!alterouData) setData(hojeSP()) }
    window.addEventListener('focus', aoVoltar)
    return () => window.removeEventListener('focus', aoVoltar)
  }, [alterouData])

  if (perfil !== 'rh' && perfil !== 'analista') return null

  const executar = (acao: () => Promise<{ ok: true } | { ok: false; erro: string }>) =>
    iniciar(async () => {
      setErro(null)
      const r = await acao()
      if (!r.ok) setErro(r.erro)
      else {
        setConfirmando(false)
        setAdiando(false)
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
      {etapaAtual &&
        (adiando ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-sm text-texto-suave">
              {etapaAtual.nome} começa em
              <input type="date" value={adiarPara} onChange={(e) => setAdiarPara(e.target.value)} className="min-h-11 rounded-lg border border-borda bg-superficie px-3 text-texto" />
            </label>
            <Botao disabled={pendente || !adiarPara} onClick={() => executar(() => adiarEtapa(vagaId, adiarPara))}>Adiar</Botao>
            <Botao variante="fantasma" onClick={() => setAdiando(false)}>Voltar</Botao>
            <p className="w-full text-sm text-texto-suave">O prazo de {etapaAtual.nome} passa a contar desta data. Uma data de hoje ou do passado tira o adiamento.</p>
          </div>
        ) : (
          <div>
            <Botao variante="fantasma" onClick={() => { setAdiarPara(inicioDaOnda ?? ''); setAdiando(true) }}>Adiar próxima etapa</Botao>
          </div>
        ))}
      {confirmando && <p className="text-sm text-texto-suave">A vaga volta para Captura de Mercado, o candidato é apagado e a previsão recomeça hoje.</p>}
      {erro && <p role="alert" className="rounded-lg px-3 py-2 font-medium" style={{ background: 'var(--st-reprovada-fundo)', color: 'var(--st-reprovada-texto)' }}>{erro}</p>}
    </div>
  )
}
