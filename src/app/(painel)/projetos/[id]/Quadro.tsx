'use client'

import { useEffect, useState } from 'react'
import type { EtapaDef } from '@/dominio/etapas'
import { porEtapa, type VagaPainel } from '@/dominio/painel'
import { CartaoVaga } from './CartaoVaga'
import { ConfirmarAvanco } from './ConfirmarAvanco'

type Avanco = { vaga: VagaPainel; de: number; ate: number }

// Uma coluna por etapa; no celular as colunas rolam na horizontal.
// O RH (projeto aberto, ponteiro fino) arrasta o cartão para uma coluna à frente e confirma.
export function Quadro({ vagas, etapas, podeArrastar = false }: { vagas: VagaPainel[]; etapas: EtapaDef[]; podeArrastar?: boolean }) {
  const grupos = porEtapa(vagas)
  const mobilizadas = vagas.filter((v) => v.situacao.mobilizada).length
  const [ponteiroFino, setPonteiroFino] = useState(false)
  const [arrastando, setArrastando] = useState<VagaPainel | null>(null)
  const [avanco, setAvanco] = useState<Avanco | null>(null)
  useEffect(() => setPonteiroFino(window.matchMedia('(pointer: fine)').matches), [])
  const arrasta = podeArrastar && ponteiroFino
  const ultima = etapas.length ? Math.max(...etapas.map((e) => e.ordem)) : 0

  // `ate` é a última etapa a concluir; soltar na coluna B conclui até B - 1.
  const soltar = (ate: number) => {
    const atual = arrastando?.previsao.etapaAtual
    setArrastando(null)
    if (!arrasta || !arrastando || atual == null || ate < atual) return
    setAvanco({ vaga: arrastando, de: atual, ate })
  }
  const alvo = (aoSoltar: () => void) =>
    arrasta ? { onDragOver: (e: React.DragEvent) => { if (arrastando) e.preventDefault() }, onDrop: (e: React.DragEvent) => { e.preventDefault(); aoSoltar() } } : {}

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <div className="flex gap-3">
        {etapas.map((e) => {
          const lista = grupos.get(e.ordem) ?? []
          const titulo = `${e.nome} (${lista.length})`
          return (
            <section key={e.ordem} aria-label={titulo} className="w-56 shrink-0 rounded-xl bg-superficie-2 p-2" {...alvo(() => soltar(e.ordem - 1))}>
              <h3 className="mb-2 px-1 text-sm font-semibold text-texto-suave">
                <span className="mr-1 text-texto">{e.ordem}.</span>
                {e.nome} <span className="text-texto">({lista.length})</span>
              </h3>
              <div className="flex flex-col gap-2">
                {lista.map((v) => <CartaoVaga key={v.id} vaga={v} arrastavel={arrasta} aoArrastar={() => setArrastando(v)} aoSoltar={() => setArrastando(null)} />)}
              </div>
            </section>
          )
        })}
        <section aria-label={`Mobilizadas (${mobilizadas})`} className="w-40 shrink-0 rounded-xl bg-superficie-2 p-3" {...alvo(() => soltar(ultima))}>
          <h3 className="text-sm font-semibold text-texto-suave">Mobilizadas</h3>
          <p className="mt-2 font-titulo text-4xl font-semibold">{mobilizadas}</p>
        </section>
      </div>
      {avanco && <ConfirmarAvanco {...avanco} etapas={etapas} aoFechar={() => setAvanco(null)} />}
    </div>
  )
}
