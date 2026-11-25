'use client'

import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import { Botao } from '@/components/ui/Botao'
import { criarClienteNavegador } from '@/lib/supabase/cliente'
import { analisarParticipacao, registrarCurriculo } from '../acoesSelecao'
import { processarFila } from './fila'

const LIMITE = 10 * 1024 * 1024
const SIMULTANEAS = 3

type Linha = { chave: string; nome: string; estado: 'recusado' | 'enviando' | 'analisando' | 'ok' | 'repetido' | 'erro'; texto?: string; participacaoId?: string }

// Importa PDFs: o navegador envia cada arquivo ao Storage, registra o currículo e conduz a fila de
// análise (3 por vez). Se a aba fechar, os que faltaram aparecem como pendentes para continuar.
export function ImportarCurriculos({ selecaoId, pendentes }: { selecaoId: string; pendentes: string[] }) {
  const router = useRouter()
  const idArquivo = useId()
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null)

  const atualizar = (chave: string, mudanca: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...mudanca } : l)))

  async function analisar(ids: { id: string; chave?: string }[]) {
    let feitos = 0
    setProgresso({ feitos: 0, total: ids.length })
    const chaveDe = new Map(ids.map((i) => [i.id, i.chave]))
    await processarFila(
      ids.map((i) => i.id),
      async (id) => {
        const r = await analisarParticipacao(id)
        const chave = chaveDe.get(id)
        if (chave) {
          if (r.ok) atualizar(chave, { estado: r.situacao === 'repetida' ? 'repetido' : 'ok', texto: r.situacao === 'repetida' ? 'já está nesta seleção' : undefined })
          else atualizar(chave, { estado: 'erro', texto: r.erro })
        }
        return r
      },
      { simultaneas: SIMULTANEAS, aoTerminar: () => setProgresso({ feitos: ++feitos, total: ids.length }) },
    )
  }

  async function aoEscolher(arquivos: FileList | null) {
    if (!arquivos?.length) return
    const novas: Linha[] = [...arquivos].map((f, i) => {
      const chave = `${Date.now()}-${i}-${f.name}`
      if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) return { chave, nome: f.name, estado: 'recusado', texto: 'só arquivos PDF' }
      if (f.size > LIMITE) return { chave, nome: f.name, estado: 'recusado', texto: 'o arquivo passa de 10 MB' }
      return { chave, nome: f.name, estado: 'enviando' }
    })
    setLinhas((ls) => [...novas, ...ls])
    const validos = [...arquivos].map((f, i) => ({ f, linha: novas[i] })).filter((x) => x.linha.estado === 'enviando')
    if (!validos.length) return

    setOcupado(true)
    const sb = criarClienteNavegador()
    const registrados: { id: string; chave: string }[] = []
    for (const { f, linha } of validos) {
      const caminho = `${selecaoId}/${crypto.randomUUID()}.pdf`
      const envio = await sb.storage.from('curriculos').upload(caminho, f, { contentType: 'application/pdf' })
      if (envio.error) {
        atualizar(linha.chave, { estado: 'erro', texto: 'não foi possível enviar o arquivo' })
        continue
      }
      const r = await registrarCurriculo(selecaoId, caminho, f.name)
      if (!r.ok) {
        atualizar(linha.chave, { estado: 'erro', texto: r.erro })
        continue
      }
      atualizar(linha.chave, { estado: 'analisando', participacaoId: r.participacaoId })
      registrados.push({ id: r.participacaoId, chave: linha.chave })
    }
    await analisar(registrados)
    setOcupado(false)
    router.refresh()
  }

  async function tentarDeNovo(l: Linha) {
    if (!l.participacaoId) return
    setOcupado(true)
    atualizar(l.chave, { estado: 'analisando', texto: undefined })
    await analisar([{ id: l.participacaoId, chave: l.chave }])
    setOcupado(false)
    router.refresh()
  }

  async function continuar() {
    setOcupado(true)
    await analisar(pendentes.map((id) => ({ id })))
    setOcupado(false)
    router.refresh()
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-borda bg-superficie p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={idArquivo} className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-primaria px-4 font-semibold text-primaria-texto hover:bg-primaria-forte ${ocupado ? 'pointer-events-none opacity-50' : ''}`}>
          Importar currículos (PDF)
        </label>
        <input id={idArquivo} type="file" accept="application/pdf" multiple className="sr-only" disabled={ocupado} onChange={(e) => { void aoEscolher(e.target.files); e.target.value = '' }} />
        {pendentes.length > 0 && !ocupado && (
          <Botao variante="secundario" onClick={continuar}>Continuar análise ({pendentes.length})</Botao>
        )}
        {progresso && ocupado && (
          <p aria-live="polite" className="text-sm text-texto-suave">Analisando {progresso.feitos} de {progresso.total}</p>
        )}
      </div>
      {progresso && ocupado && (
        <div className="h-2 overflow-hidden rounded-full bg-primaria-suave" aria-hidden>
          <div className="h-full bg-primaria transition-all" style={{ width: `${(progresso.feitos / Math.max(progresso.total, 1)) * 100}%` }} />
        </div>
      )}
      {linhas.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {linhas.map((l) => (
            <li key={l.chave} className="flex flex-wrap items-center gap-2">
              <span className={l.estado === 'recusado' || l.estado === 'erro' ? 'text-[var(--st-reprovada-texto)]' : 'text-texto-suave'}>
                {l.nome}: {l.texto ?? { recusado: '', enviando: 'enviando...', analisando: 'analisando...', ok: 'analisado', repetido: '', erro: '' }[l.estado]}
              </span>
              {l.estado === 'erro' && l.participacaoId && !ocupado && (
                <Botao variante="fantasma" className="min-h-8 px-2 text-sm" onClick={() => tentarDeNovo(l)}>Tentar de novo</Botao>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
