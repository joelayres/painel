'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Selecao } from '@/components/ui/Selecao'
import { hojeSP } from '@/dominio/tempo'
import { alterarEmGrupo, avancarEmGrupo, type RespostaGrupo } from './acoesConfigurar'
import { etapaComum, puladasNoInicio, type VagaSelecionavel } from './selecao'

type Acao = 'avancar' | 'meta' | 'onda' | 'inicio'

const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`)

function textoResultado(r: Extract<RespostaGrupo, { ok: true }>): string {
  const partes = [`${plural(r.alteradas, 'vaga alterada', 'vagas alteradas')}.`]
  if (r.puladas > 0) partes.push(`${plural(r.puladas, 'ficou de fora', 'ficaram de fora')}.`)
  if (r.foraDaMeta > 0) partes.push(`${plural(r.foraDaMeta, 'ficou', 'ficaram')} com a admissão prevista depois da meta.`)
  return partes.join(' ')
}

// Barra das ações em grupo do Configurar → Vagas: tudo ou nada, o banco diz qual vaga travou.
export function AcoesEmGrupo({
  projetoId,
  organizacao,
  selecionadas,
  ondas,
  etapas,
  rotuloDe,
  aoTerminar,
}: {
  projetoId: string
  organizacao: 'ondas' | 'meta'
  selecionadas: VagaSelecionavel[]
  ondas: { id: string; nome: string }[]
  etapas: { ordem: number; nome: string }[]
  rotuloDe: (vagaId: string) => string
  aoTerminar: () => void
}) {
  const router = useRouter()
  const [acao, setAcao] = useState<Acao | null>(null)
  const [valor, setValor] = useState('')
  const [resultado, setResultado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const ids = selecionadas.map((v) => v.id)
  const comum = etapaComum(selecionadas)
  const nomeEtapa = etapas.find((e) => e.ordem === comum)?.nome ?? null
  const puladas = puladasNoInicio(selecionadas)

  const abrir = (a: Acao) => {
    setAcao(a)
    setValor(a === 'avancar' ? hojeSP() : '')
    setErro(null)
    setResultado(null)
  }

  const aplicar = () => {
    setErro(null)
    iniciar(async () => {
      const r =
        acao === 'avancar' && comum !== null
          ? await avancarEmGrupo(projetoId, ids, comum, valor)
          : await alterarEmGrupo(projetoId, ids, acao === 'onda' ? 'onda_id' : acao === 'meta' ? 'meta' : 'data_inicio', valor)
      if (!r.ok) return setErro(r.vagaId ? `${rotuloDe(r.vagaId)}: ${r.erro}` : r.erro)
      setResultado(textoResultado(r))
      setAcao(null)
      aoTerminar()
      router.refresh()
    })
  }

  // Fica montada sem seleção só para manter a mensagem do resultado depois de limpar a seleção.
  if (selecionadas.length === 0) return resultado ? <p role="status" className="font-medium">{resultado}</p> : null

  return (
    <section aria-label="Ações em grupo" className="flex flex-col gap-3 rounded-xl border border-primaria bg-primaria-suave p-4">
      <div className="flex flex-wrap items-center gap-2">
        <strong>{plural(selecionadas.length, 'vaga selecionada', 'vagas selecionadas')}</strong>
        <Botao variante="secundario" disabled={pendente || comum === null} onClick={() => abrir('avancar')}>Avançar etapa</Botao>
        {organizacao === 'meta' ? (
          <Botao variante="secundario" disabled={pendente} onClick={() => abrir('meta')}>Trocar meta</Botao>
        ) : (
          <Botao variante="secundario" disabled={pendente} onClick={() => abrir('onda')}>Trocar onda</Botao>
        )}
        <Botao variante="secundario" disabled={pendente} onClick={() => abrir('inicio')}>Trocar início</Botao>
      </div>
      {comum === null && <p className="text-sm text-texto-suave">Para avançar juntas, as vagas precisam estar na mesma etapa.</p>}

      {acao && (
        <div className="flex flex-wrap items-end gap-3">
          {acao === 'avancar' && <p className="w-full font-medium">Concluir {nomeEtapa} em {plural(selecionadas.length, 'vaga', 'vagas')}</p>}
          {acao === 'inicio' && puladas > 0 && (
            <p className="w-full text-sm">
              {puladas === 1 ? '1 das vagas selecionadas já passou da primeira etapa e fica de fora.' : `${puladas} das vagas selecionadas já passaram da primeira etapa e ficam de fora.`}
            </p>
          )}
          {acao === 'onda' ? (
            <Selecao rotulo="Nova onda" value={valor} onChange={(e) => setValor(e.target.value)} opcoes={[{ valor: '', rotulo: 'Escolha a onda' }, ...ondas.map((o) => ({ valor: o.id, rotulo: o.nome }))]} />
          ) : (
            <Campo
              rotulo={acao === 'avancar' ? 'Data de conclusão' : acao === 'meta' ? 'Nova meta' : 'Novo início'}
              type="date"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          )}
          <Botao disabled={pendente || !valor} onClick={aplicar}>{acao === 'avancar' ? 'Concluir' : 'Aplicar'}</Botao>
          <Botao variante="fantasma" disabled={pendente} onClick={() => setAcao(null)}>Cancelar</Botao>
        </div>
      )}
      {erro && <p role="alert" className="rounded-lg px-3 py-2 font-medium" style={{ background: 'var(--st-reprovada-fundo)', color: 'var(--st-reprovada-texto)' }}>{erro}</p>}
      {resultado && <p role="status" className="font-medium">{resultado}</p>}
    </section>
  )
}
