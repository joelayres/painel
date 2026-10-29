'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type FormEvent } from 'react'
import { ErroGeral } from '@/components/rh/ErroGeral'
import { useEnvio } from '@/components/rh/useEnvio'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { PainelLateral } from '@/components/ui/PainelLateral'
import { Selecao } from '@/components/ui/Selecao'
import * as doCliente from '@/app/(painel)/cadastros/clientes/[id]/acoesEtapasCliente'
import * as doProjeto from './acoesConfigurar'
import type { RespostaAcao } from './acoesConfigurar'

// A mesma lista serve ao projeto (Configurar) e ao padrão do cliente (Cadastros).
export type AlvoEtapas = { tipo: 'projeto' | 'cliente'; id: string }
type Acoes = {
  incluir: (id: string, d: { nome: string; duracao: string; depoisDe: string }) => Promise<RespostaAcao>
  excluir: (id: string, etapa: string) => Promise<RespostaAcao>
  renomear: (id: string, etapa: string, d: { nome: string }) => Promise<RespostaAcao>
  mover: (id: string, etapa: string, para: number) => Promise<RespostaAcao>
  alterarDuracao: (id: string, etapa: string, d: { duracao: string }) => Promise<RespostaAcao>
}
const acoesDe = (alvo: AlvoEtapas): Acoes =>
  alvo.tipo === 'cliente'
    ? { incluir: doCliente.incluirEtapaCliente, excluir: doCliente.excluirEtapaCliente, renomear: doCliente.renomearEtapaCliente, mover: doCliente.moverEtapaCliente, alterarDuracao: doCliente.alterarDuracaoEtapaCliente }
    : { incluir: doProjeto.incluirEtapa, excluir: doProjeto.excluirEtapa, renomear: doProjeto.renomearEtapa, mover: doProjeto.moverEtapa, alterarDuracao: doProjeto.alterarDuracaoEtapa }

export type EtapaConfig = {
  id: string
  ordem: number
  nome: string
  fixa: 'captura' | 'admissao' | null
  padraoCliente: number | null
  duracao: number | null
  concluidasPor: number
  chegaramAoPonto: number
}

type Modo = 'normal' | 'renomear' | 'excluir'

function Linha({ alvo, etapa, total, temVagas }: { alvo: AlvoEtapas; etapa: EtapaConfig; total: number; temVagas: boolean }) {
  const acoes = acoesDe(alvo)
  const projetoId = alvo.id
  const doProjetoMesmo = alvo.tipo === 'projeto'
  const router = useRouter()
  const [modo, setModo] = useState<Modo>('normal')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const rodar = (acao: () => Promise<RespostaAcao>, aoConcluir?: () => void) =>
    iniciar(async () => {
      const r = await acao()
      if (!r.ok) return setErro(r.erros.duracao ?? r.erros.nome ?? r.erros._ ?? null)
      setErro(null)
      aoConcluir?.()
      router.refresh()
    })

  const salvar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const duracao = String(new FormData(e.currentTarget).get('duracao') ?? '')
    rodar(() => acoes.alterarDuracao(projetoId, etapa.id, { duracao }))
  }
  const salvarNome = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const nome = String(new FormData(e.currentTarget).get('nome') ?? '')
    rodar(() => acoes.renomear(projetoId, etapa.id, { nome }), () => setModo('normal'))
  }

  const ajustada = etapa.padraoCliente !== null && etapa.duracao !== null
  const nome = <span className="sr-only">{etapa.nome}</span>
  return (
    <tr className="border-b border-borda last:border-0 align-top">
      <td className="px-4 py-3 font-medium">
        {modo === 'renomear' ? (
          <form onSubmit={salvarNome} className="flex flex-wrap items-center gap-2">
            <input name="nome" defaultValue={etapa.nome} aria-label={`Novo nome de ${etapa.nome}`} className="min-h-11 w-56 rounded-lg border border-borda bg-superficie px-3 text-texto" />
            <Botao type="submit" variante="secundario" disabled={pendente}>Salvar nome{' '}<span className="sr-only">de {etapa.nome}</span></Botao>
            <Botao type="button" variante="fantasma" disabled={pendente} onClick={() => { setModo('normal'); setErro(null) }}>Cancelar{' '}<span className="sr-only">renomear {etapa.nome}</span></Botao>
          </form>
        ) : (
          <>
            {etapa.ordem}. {etapa.nome}
            {etapa.fixa && <span className="ml-2 rounded-full bg-superficie-2 px-2 py-0.5 text-xs font-medium text-texto-suave">obrigatória</span>}
          </>
        )}
      </td>
      {doProjetoMesmo && <td className="px-4 py-3">{etapa.padraoCliente !== null ? `${etapa.padraoCliente} dias úteis` : ''}</td>}
      <td className="px-4 py-3">
        <form onSubmit={salvar} className="flex flex-wrap items-center gap-2">
          <input
            key={String(etapa.duracao ?? '')}
            name="duracao" type="number" min={0} max={60} defaultValue={etapa.duracao ?? ''} placeholder={etapa.padraoCliente !== null ? String(etapa.padraoCliente) : ''}
            aria-label={doProjetoMesmo ? `Duração de ${etapa.nome} neste projeto` : `Duração de ${etapa.nome}`}
            className="min-h-11 w-20 rounded-lg border border-borda bg-superficie px-3 text-texto"
          />
          <Botao type="submit" variante="secundario" disabled={pendente}>Salvar{' '}{nome}</Botao>
          {ajustada && (
            <>
              <span className="text-sm font-medium text-texto-suave">ajustado</span>
              <Botao type="button" variante="fantasma" disabled={pendente} onClick={() => rodar(() => acoes.alterarDuracao(projetoId, etapa.id, { duracao: '' }))}>Voltar ao padrão{' '}{nome}</Botao>
            </>
          )}
        </form>
        {modo === 'excluir' && (
          <div role="group" aria-label={`Confirmar exclusão de ${etapa.nome}`} className="mt-3 flex flex-col gap-2 rounded-lg border border-borda bg-superficie-2 p-3 text-sm">
            <p>
              Excluir {etapa.nome}?{' '}
              {!doProjetoMesmo ? 'Os projetos que já existem não mudam.' : etapa.concluidasPor === 1
                ? '1 vaga já concluiu esta etapa; essa data fica no histórico da vaga.'
                : `${etapa.concluidasPor} vagas já concluíram esta etapa; essas datas ficam no histórico de cada vaga.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Botao type="button" disabled={pendente} onClick={() => rodar(() => acoes.excluir(projetoId, etapa.id), () => setModo('normal'))}>Excluir etapa</Botao>
              <Botao type="button" variante="fantasma" disabled={pendente} onClick={() => { setModo('normal'); setErro(null) }}>Cancelar</Botao>
            </div>
          </div>
        )}
        {erro && <p role="alert" className="mt-2 text-sm text-[var(--st-reprovada-texto)]">{erro}</p>}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {!temVagas && etapa.ordem > 1 && <Botao type="button" variante="fantasma" disabled={pendente} onClick={() => rodar(() => acoes.mover(projetoId, etapa.id, etapa.ordem - 1))}>Subir{' '}{nome}</Botao>}
          {!temVagas && etapa.ordem < total && <Botao type="button" variante="fantasma" disabled={pendente} onClick={() => rodar(() => acoes.mover(projetoId, etapa.id, etapa.ordem + 1))}>Descer{' '}{nome}</Botao>}
          {!etapa.fixa && <Botao type="button" variante="fantasma" disabled={pendente} onClick={() => { setModo('renomear'); setErro(null) }}>Renomear{' '}{nome}</Botao>}
          {!etapa.fixa && <Botao type="button" variante="fantasma" disabled={pendente} onClick={() => { setModo('excluir'); setErro(null) }}>Excluir{' '}{nome}</Botao>}
        </div>
      </td>
    </tr>
  )
}

function FormInclusao({ alvo, etapas, temVagas, totalVagas, fechar }: { alvo: AlvoEtapas; etapas: EtapaConfig[]; temVagas: boolean; totalVagas: number; fechar: () => void }) {
  const router = useRouter()
  const [depoisDe, setDepoisDe] = useState('')
  const { erros, pendente, enviar } = useEnvio(
    (d) => acoesDe(alvo).incluir(alvo.id, d as { nome: string; duracao: string; depoisDe: string }),
    () => { fechar(); router.refresh() },
  )
  // No início, toda vaga já passou do ponto; depois de uma etapa, só quem a concluiu.
  const passaram = depoisDe === '' ? totalVagas : (etapas.find((e) => e.id === depoisDe)?.chegaramAoPonto ?? 0)
  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <Campo rotulo="Nome" name="nome" erro={erros.nome} required />
      <Campo rotulo="Duração (dias úteis)" name="duracao" type="number" min={0} max={60} erro={erros.duracao} required />
      <Selecao
        rotulo="Depois de" name="depoisDe" value={depoisDe} onChange={(e) => setDepoisDe(e.target.value)} erro={erros.depoisDe}
        opcoes={[{ valor: '', rotulo: 'No início' }, ...etapas.map((e) => ({ valor: e.id, rotulo: e.nome }))]}
      />
      {temVagas && passaram > 0 && (
        <p role="status" className="rounded-lg bg-superficie-2 px-3 py-2 text-sm">
          {passaram === 1
            ? '1 vaga já passou deste ponto e vai ficar com a etapa concluída automaticamente.'
            : `${passaram} vagas já passaram deste ponto e vão ficar com a etapa concluída automaticamente.`}
        </p>
      )}
      <ErroGeral mensagem={erros._} />
      <Botao type="submit" disabled={pendente}>Incluir</Botao>
    </form>
  )
}

// A lista de etapas: duração, nome, ordem (no projeto, antes de haver vagas) e inclusão.
// No cliente (alvo cliente), a duração é uma coluna só e a ordem muda sempre (cliente não tem vagas).
export function EtapasProjeto({ alvo, cliente, etapas, temVagas, totalVagas, somenteLeitura }: { alvo: AlvoEtapas; cliente: string; etapas: EtapaConfig[]; temVagas: boolean; totalVagas: number; somenteLeitura: boolean }) {
  const doProjetoMesmo = alvo.tipo === 'projeto'
  const [aberto, setAberto] = useState(false)
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-titulo text-xl font-semibold">Etapas</h3>
      <div className="overflow-x-auto rounded-xl border border-borda bg-superficie">
        <table className="w-full text-left text-[15px]">
          <thead>
            <tr className="border-b border-borda bg-superficie-2 text-sm text-texto-suave">
              <th className="px-4 py-2.5 font-medium">Etapa</th>
              {doProjetoMesmo && <th className="px-4 py-2.5 font-medium">Padrão {cliente}</th>}
              <th className="px-4 py-2.5 font-medium">{doProjetoMesmo ? 'Neste projeto' : 'Duração'}</th>
              {!somenteLeitura && <th className="px-4 py-2.5 font-medium">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {etapas.map((e) =>
              somenteLeitura ? (
                <tr key={e.id} className="border-b border-borda last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {e.ordem}. {e.nome}
                    {e.fixa && <span className="ml-2 rounded-full bg-superficie-2 px-2 py-0.5 text-xs font-medium text-texto-suave">obrigatória</span>}
                  </td>
                  {doProjetoMesmo && <td className="px-4 py-3">{e.padraoCliente !== null ? `${e.padraoCliente} dias úteis` : ''}</td>}
                  <td className="px-4 py-3">{e.duracao !== null ? `${e.duracao} dias úteis${e.padraoCliente !== null ? ' (ajustado)' : ''}` : '—'}</td>
                </tr>
              ) : (
                <Linha key={e.id} alvo={alvo} etapa={e} total={etapas.length} temVagas={temVagas} />
              ),
            )}
          </tbody>
        </table>
      </div>
      {!somenteLeitura && (
        <>
          <div><Botao type="button" variante="secundario" onClick={() => setAberto(true)}>+ Incluir etapa</Botao></div>
          <PainelLateral titulo="Incluir etapa" aberto={aberto} aoFechar={() => setAberto(false)}>
            <FormInclusao alvo={alvo} etapas={etapas} temVagas={temVagas} totalVagas={totalVagas} fechar={() => setAberto(false)} />
          </PainelLateral>
        </>
      )}
    </section>
  )
}
