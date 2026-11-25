'use client'

import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { Botao } from '@/components/ui/Botao'
import { classeControle } from '@/components/ui/Campo'
import { PainelLateral } from '@/components/ui/PainelLateral'
import { ATENDE, CLASSIFICACOES, PARECERES, RESULTADOS, TIPOS_ENTREVISTA, rotuloClassificacao, type Resultado } from '@/dominio/selecao'
import { dataBR } from '@/lib/formato/datas'
import { definirIndicacao, definirResultado, levarParaVaga, linkCurriculo, mudarClassificacao } from '../acoesSelecao'
import type { Participacao } from './dados'
import { FormEntrevista } from './FormEntrevista'

export type VagaLivre = { id: string; rotulo: string }

// Tudo de um candidato na seleção: a análise da IA, a classificação, as entrevistas e o resultado.
export function PainelParticipacao({ participacao: p, vagas, indicadores, aoFechar }: { participacao: Participacao | null; vagas: VagaLivre[]; indicadores: string[]; aoFechar: () => void }) {
  return (
    <PainelLateral titulo={p?.candidato?.nome ?? p?.curriculo.nome_arquivo ?? ''} aberto={p !== null} aoFechar={aoFechar}>
      {p && <Conteudo key={p.id} p={p} vagas={vagas} indicadores={indicadores} />}
    </PainelLateral>
  )
}

function Conteudo({ p, vagas, indicadores }: { p: Participacao; vagas: VagaLivre[]; indicadores: string[] }) {
  const router = useRouter()
  const idCls = useId()
  const idJust = useId()
  const idRes = useId()
  const idVaga = useId()
  const idIndicacao = useId()
  const idIndicadores = useId()
  const [indicadoPor, setIndicadoPor] = useState(p.indicado_por ?? '')
  const [nova, setNova] = useState<string>('')
  const [justificativa, setJustificativa] = useState('')
  const [vaga, setVaga] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, iniciar] = useTransition()
  const [entrevista, setEntrevista] = useState<'nova' | string | null>(null)
  const [verAnteriores, setVerAnteriores] = useState(false)
  const [atual, ...anteriores] = p.analises

  function executar(acao: () => Promise<{ ok: boolean; erro?: string }>, ok?: string) {
    setErro(null)
    setAviso(null)
    iniciar(async () => {
      const r = await acao()
      if (!r.ok) return setErro(r.erro ?? 'Não foi possível salvar.')
      if (ok) setAviso(ok)
      router.refresh()
    })
  }

  function mudar() {
    if (!nova) return setErro('Escolha a nova classificação.')
    if (!justificativa.trim()) return setErro('Escreva o motivo da mudança.')
    executar(() => mudarClassificacao(p.id, nova, justificativa), 'Classificação alterada.')
  }

  async function abrirCurriculo() {
    const r = await linkCurriculo(p.curriculo_id)
    if (r.ok) window.open(r.url, '_blank', 'noopener')
    else setErro(r.erro)
  }

  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="flex flex-col gap-1">
        {p.candidato && (
          <p className="text-texto-suave">{[p.candidato.email, p.candidato.telefone, [p.candidato.cidade, p.candidato.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ') || 'Sem contato no currículo'}</p>
        )}
        <Botao variante="secundario" className="self-start" onClick={abrirCurriculo}>Ver currículo</Botao>
      </div>

      <section className="flex flex-col gap-2">
        <label htmlFor={idIndicacao} className="font-titulo text-lg font-semibold">Indicado por</label>
        <input id={idIndicacao} value={indicadoPor} onChange={(e) => setIndicadoPor(e.target.value)} list={idIndicadores} maxLength={120} placeholder="Ex.: Ivan Braskem (vazio se não houve indicação)" className={classeControle} />
        <datalist id={idIndicadores}>{indicadores.map((i) => <option key={i} value={i} />)}</datalist>
        <Botao variante="secundario" className="self-start" disabled={enviando || indicadoPor.trim() === (p.indicado_por ?? '')} onClick={() => executar(() => definirIndicacao(p.id, indicadoPor), 'Indicação salva.')}>Salvar indicação</Botao>
      </section>

      {p.situacao === 'erro' && <p className="text-[var(--st-reprovada-texto)]">Erro na análise: {p.erro}</p>}

      {atual && (
        <section className="flex flex-col gap-2">
          <h3 className="font-titulo text-lg font-semibold">Análise da IA · nota {atual.nota}</h3>
          <p>Sugestão: <strong>{rotuloClassificacao(atual.classificacao)}</strong></p>
          <p>{atual.resposta.resumo}</p>
          {atual.resposta.requisitos.length > 0 && (
            <ul className="flex flex-col gap-1">
              {atual.resposta.requisitos.map((r, i) => (
                <li key={i}><strong>{ATENDE[r.atende]}</strong> · {r.requisito}{r.evidencia ? <span className="text-texto-suave">: {r.evidencia}</span> : null}</li>
              ))}
            </ul>
          )}
          {atual.resposta.pontosFortes.length > 0 && <p><strong>Pontos fortes:</strong> {atual.resposta.pontosFortes.join('; ')}</p>}
          {atual.resposta.lacunas.length > 0 && <p><strong>Lacunas:</strong> {atual.resposta.lacunas.join('; ')}</p>}
          <p className="text-xs text-texto-suave">Análise de {dataBR(atual.criado_em.slice(0, 10))} · {atual.modelo}</p>
          {anteriores.length > 0 && (
            <>
              <button type="button" className="self-start text-primaria hover:underline" aria-expanded={verAnteriores} onClick={() => setVerAnteriores((v) => !v)}>
                {verAnteriores ? 'Esconder análises anteriores' : `Ver análises anteriores (${anteriores.length})`}
              </button>
              {verAnteriores && (
                <ul className="flex flex-col gap-1 text-texto-suave">
                  {anteriores.map((a) => <li key={a.id}>{dataBR(a.criado_em.slice(0, 10))}: nota {a.nota}, {rotuloClassificacao(a.classificacao).toLowerCase()} · {a.resposta.resumo}</li>)}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      {p.situacao === 'analisada' && (
        <section className="flex flex-col gap-2">
          <h3 className="font-titulo text-lg font-semibold">Classificação</h3>
          <p>Atual: <strong>{p.classificacao ? rotuloClassificacao(p.classificacao) : '—'}</strong>{p.classificacao_por ? ` (confirmada por ${p.classificacao_por})` : ''}</p>
          <label htmlFor={idCls} className="font-medium text-texto-suave">Nova classificação</label>
          <select id={idCls} value={nova} onChange={(e) => setNova(e.target.value)} className={classeControle}>
            <option value="">Escolha...</option>
            {(['aderente', 'parcial', 'nao_aderente'] as const).map((c) => <option key={c} value={c}>{CLASSIFICACOES[c]}</option>)}
          </select>
          <label htmlFor={idJust} className="font-medium text-texto-suave">Motivo</label>
          <textarea id={idJust} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} maxLength={500} rows={2} className={`${classeControle} py-2`} />
          <Botao variante="secundario" className="self-start" disabled={enviando} onClick={mudar}>Mudar classificação</Botao>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-titulo text-lg font-semibold">Entrevistas</h3>
          {entrevista === null && <Botao variante="fantasma" onClick={() => setEntrevista('nova')}>+ Registrar</Botao>}
        </div>
        {p.entrevistas.length === 0 && entrevista === null && <p className="text-texto-suave">Nenhuma entrevista registrada.</p>}
        <ul className="flex flex-col gap-2">
          {p.entrevistas.map((e) => (
            <li key={e.id} className="rounded-lg border border-borda p-2">
              {entrevista === e.id ? (
                <FormEntrevista participacaoId={p.id} entrevista={e} aoTerminar={() => setEntrevista(null)} />
              ) : (
                <>
                  <p><strong>{TIPOS_ENTREVISTA[e.tipo]}</strong> · {dataBR(e.data)} · {e.entrevistador} · {PARECERES[e.parecer]}</p>
                  {e.impressoes && <p className="whitespace-pre-wrap">{e.impressoes}</p>}
                  <p className="text-xs text-texto-suave">Registrada por {e.registrado_por} · <button type="button" className="text-primaria hover:underline" onClick={() => setEntrevista(e.id)}>corrigir</button></p>
                </>
              )}
            </li>
          ))}
        </ul>
        {entrevista === 'nova' && <FormEntrevista participacaoId={p.id} aoTerminar={() => setEntrevista(null)} />}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-titulo text-lg font-semibold">Resultado</h3>
        <label htmlFor={idRes} className="sr-only">Resultado</label>
        <select id={idRes} value={p.resultado} disabled={enviando} onChange={(e) => executar(() => definirResultado(p.id, e.target.value as Resultado))} className={classeControle}>
          {(Object.keys(RESULTADOS) as Resultado[]).map((r) => <option key={r} value={r}>{RESULTADOS[r]}</option>)}
        </select>
        {p.resultado === 'escolhido' && p.candidato && (
          vagas.length === 0 ? (
            <p className="text-texto-suave">Nenhuma vaga desta função sem candidato no projeto.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <label htmlFor={idVaga} className="font-medium text-texto-suave">Levar o nome para a vaga</label>
              <select id={idVaga} value={vaga} onChange={(e) => setVaga(e.target.value)} className={classeControle}>
                <option value="">Escolha a vaga...</option>
                {vagas.map((v) => <option key={v.id} value={v.id}>{v.rotulo}</option>)}
              </select>
              <Botao variante="secundario" className="self-start" disabled={!vaga || enviando} onClick={() => executar(() => levarParaVaga(vaga, p.candidato!.nome), 'Nome levado para a vaga.')}>Levar para a vaga</Botao>
            </div>
          )
        )}
      </section>

      {erro && <p role="alert" className="text-[var(--st-reprovada-texto)]">{erro}</p>}
      {aviso && <p role="status" className="text-primaria">{aviso}</p>}
    </div>
  )
}
