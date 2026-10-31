'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Botao } from '@/components/ui/Botao'
import type { MotivoAtraso as Motivo } from '@/dominio/painel'
import { salvarMotivoAtraso } from './acoesVaga'

const LIMITE_MOTIVO = 500

type Props = { vagaId: string; etapa: { ordem: number; nome: string }; motivo: Motivo | null; podeEditar: boolean }

const quando = (em: string) => new Date(em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })

// Só aparece na vaga atrasada: quem lê vê o motivo da etapa atual; a equipe escreve, troca ou apaga (texto vazio).
export function MotivoAtraso({ vagaId, etapa, motivo, podeEditar }: Props) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(motivo?.texto ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  if (!motivo && !podeEditar) return null

  const salvar = () =>
    iniciar(async () => {
      setErro(null)
      const r = await salvarMotivoAtraso(vagaId, etapa.ordem, texto)
      if (!r.ok) return setErro(r.erro)
      setEditando(false)
      router.refresh()
    })

  if (!editando && !motivo)
    return (
      <div>
        <Botao variante="secundario" onClick={() => setEditando(true)}>Escrever motivo do atraso</Botao>
      </div>
    )

  return (
    <section aria-labelledby="titulo-motivo" className="rounded-xl border p-4" style={{ background: 'var(--st-reprovada-fundo)', color: 'var(--st-reprovada-texto)', borderColor: 'var(--st-reprovada-texto)' }}>
      <h3 id="titulo-motivo" className="font-semibold">Motivo do atraso · etapa {etapa.nome}</h3>
      {editando ? (
        <div className="mt-2 flex flex-col gap-2">
          <label className="sr-only" htmlFor="texto-motivo">Motivo do atraso</label>
          <textarea
            id="texto-motivo"
            value={texto}
            maxLength={LIMITE_MOTIVO}
            rows={3}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Por que esta vaga está atrasada nesta etapa?"
            className="rounded-lg border border-borda bg-superficie px-3 py-2 text-texto"
          />
          <p className="text-xs">{texto.length}/{LIMITE_MOTIVO} · Deixe em branco e salve para apagar o motivo.</p>
          <div className="flex flex-wrap gap-2">
            <Botao disabled={pendente} onClick={salvar}>Salvar motivo</Botao>
            <Botao variante="fantasma" disabled={pendente} onClick={() => { setEditando(false); setTexto(motivo?.texto ?? ''); setErro(null) }}>Cancelar</Botao>
          </div>
        </div>
      ) : (
        motivo && (
          <>
            <p className="mt-1 whitespace-pre-line">{motivo.texto}</p>
            <p className="mt-2 text-xs opacity-80">Atualizado por {motivo.nomeUsuario} em {quando(motivo.em)}</p>
            {podeEditar && <Botao variante="secundario" className="mt-2" onClick={() => setEditando(true)}>Editar motivo</Botao>}
          </>
        )
      )}
      {erro && <p role="alert" className="mt-2 font-medium">{erro}</p>}
    </section>
  )
}
