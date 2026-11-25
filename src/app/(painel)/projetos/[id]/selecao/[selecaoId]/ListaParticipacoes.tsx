'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Botao } from '@/components/ui/Botao'
import { rotuloClassificacao, rotuloResultado, separarAbas, type LinhaParticipacao } from '@/dominio/selecao'
import { confirmarClassificacao, reanalisar } from '../acoesSelecao'
import type { Participacao } from './dados'
import { PainelParticipacao, type VagaLivre } from './PainelParticipacao'

type Aba = 'aConfirmar' | 'aderentes' | 'naoAderentes'
type Linha = LinhaParticipacao & { p: Participacao }

const ABAS: [Aba, string][] = [['aConfirmar', 'A confirmar'], ['aderentes', 'Aderentes e parciais'], ['naoAderentes', 'Não aderentes']]

export function ListaParticipacoes({ participacoes, vagas, indicadores, encerrada = false }: { participacoes: Participacao[]; vagas: VagaLivre[]; indicadores: string[]; encerrada?: boolean }) {
  const router = useRouter()
  const [aba, setAba] = useState<Aba>('aConfirmar')
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [aberta, setAberta] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, iniciar] = useTransition()

  const linhas: Linha[] = participacoes.map((p) => ({
    id: p.id,
    nome: p.candidato?.nome ?? p.curriculo.nome_arquivo,
    nota: p.analises[0]?.nota ?? null,
    classificacao: p.classificacao,
    situacao: p.situacao,
    resultado: p.resultado,
    resumo: p.analises[0]?.resposta.resumo ?? null,
    p,
  }))
  const abas = separarAbas(linhas)
  const visiveis = abas[aba]
  const repetidas = participacoes.filter((p) => p.situacao === 'repetida').length
  const selecionada = participacoes.find((p) => p.id === aberta) ?? null

  const alternar = (id: string) => setMarcadas((m) => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n })

  function executar(acao: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro(null)
    iniciar(async () => {
      const r = await acao()
      if (!r.ok) return setErro(r.erro ?? 'Não foi possível salvar.')
      setMarcadas(new Set())
      router.refresh()
    })
  }

  const ids = [...marcadas].filter((id) => visiveis.some((l) => l.id === id))

  return (
    <section className="flex flex-col gap-3">
      <div role="tablist" aria-label="Candidatos da seleção" className="flex flex-wrap gap-1 border-b border-borda">
        {ABAS.map(([chave, rotulo]) => (
          <button
            key={chave}
            role="tab"
            type="button"
            aria-selected={aba === chave}
            onClick={() => { setAba(chave); setMarcadas(new Set()) }}
            className={`-mb-px border-b-2 px-4 py-2 font-medium ${aba === chave ? 'border-primaria text-primaria' : 'border-transparent text-texto-suave hover:text-texto'}`}
          >
            {rotulo} ({abas[chave].length})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {aba === 'aConfirmar' && (
          <Botao disabled={!ids.length || enviando} onClick={() => executar(() => confirmarClassificacao(ids))}>Confirmar sugestão da IA</Botao>
        )}
        {!encerrada && <Botao variante="secundario" disabled={!ids.length || enviando} onClick={() => executar(() => reanalisar(ids))}>Reanalisar selecionados</Botao>}
      </div>
      {erro && <p role="alert" className="text-sm text-[var(--st-reprovada-texto)]">{erro}</p>}

      {visiveis.length === 0 ? (
        <p className="rounded-xl border border-borda bg-superficie p-4 text-texto-suave">Nenhum candidato nesta aba.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visiveis.map((l) => (
            <li key={l.id} className="flex items-start gap-3 rounded-xl border border-borda bg-superficie p-3">
              <input type="checkbox" aria-label={`Marcar ${l.nome}`} checked={marcadas.has(l.id)} onChange={() => alternar(l.id)} className="mt-1.5 size-4" />
              <span className="w-12 shrink-0 text-center font-titulo text-2xl font-semibold text-primaria">{l.nota ?? '—'}</span>
              <button type="button" onClick={() => setAberta(l.id)} className="flex min-w-0 flex-1 flex-col items-start text-left hover:underline">
                <span className="font-semibold">{l.nome}</span>
                <span className="text-sm text-texto-suave">
                  {l.classificacao ? rotuloClassificacao(l.classificacao) : ''}
                  {l.classificacao === 'a_confirmar' && l.p.analises[0] ? ` · IA sugere ${rotuloClassificacao(l.p.analises[0].classificacao).toLowerCase()}` : ''}
                  {` · ${rotuloResultado(l.resultado)}`}
                  {l.p.entrevistas.length ? ` · ${l.p.entrevistas.length} entrevista(s)` : ''}
                  {l.p.indicado_por ? ` · Indicado por ${l.p.indicado_por}` : ''}
                </span>
                {l.resumo && <span className="line-clamp-2 text-sm">{l.resumo}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {repetidas > 0 && <p className="text-sm text-texto-suave">{repetidas} currículo(s) já estavam nesta seleção e não foram analisados de novo.</p>}

      <PainelParticipacao participacao={selecionada} vagas={vagas} indicadores={indicadores} aoFechar={() => setAberta(null)} />
    </section>
  )
}
