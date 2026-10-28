'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { cancelarVaga } from '@/app/(painel)/vagas/[id]/acoesVaga'
import { FormVaga } from '@/components/rh/FormVaga'
import { Botao } from '@/components/ui/Botao'
import { dataBR } from '@/lib/formato/datas'

export type VagaProjeto = { id: string; funcao: string; disciplina: string; area: string; ondaNome: string | null; ondaId: string | null; meta: string | null; gestor: string | null; gestorId: string | null; candidato: string | null; dataInicio: string; canceladaEm: string | null }
type Opcoes = { ondas: { id: string; nome: string }[]; gestores: { id: string; nome: string }[] }

const estiloLink = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-primaria bg-superficie px-4 font-semibold text-primaria transition-colors hover:bg-primaria-suave focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco'

export function VagasProjeto({ projetoId, organizacao, vagas, opcoes, somenteLeitura }: { projetoId: string; organizacao: 'ondas' | 'meta'; vagas: VagaProjeto[]; opcoes: Opcoes; somenteLeitura: boolean }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const ativas = vagas.filter((v) => !v.canceladaEm)
  const canceladas = vagas.filter((v) => v.canceladaEm)
  const porOndas = organizacao === 'ondas'

  const cancelar = (id: string) =>
    iniciar(async () => {
      const r = await cancelarVaga(id)
      setConfirmando(null)
      if (!r.ok) return setErro(r.erro)
      setErro(null)
      router.refresh()
    })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {/* <a> e não <Link>: é um arquivo, não uma página (o Link tentaria pré-carregar). */}
        <a href={`/projetos/${projetoId}/modelo`} download className={estiloLink}>Baixar modelo Excel</a>
        {!somenteLeitura && (
          <>
            <Link href={`/projetos/${projetoId}/importar`} className={estiloLink}>Importar planilha</Link>
            <FormVaga vaga={null} opcoes={opcoes} rotuloBotao="+ Vaga avulsa" organizacao={organizacao} projetoId={projetoId} />
          </>
        )}
      </div>
      {erro && <p role="alert" className="rounded-lg px-3 py-2 font-medium" style={{ background: 'var(--st-reprovada-fundo)', color: 'var(--st-reprovada-texto)' }}>{erro}</p>}
      <div className="overflow-x-auto rounded-xl border border-borda bg-superficie">
        <table className="w-full text-left text-[15px]">
          <thead>
            <tr className="border-b border-borda bg-superficie-2 text-sm text-texto-suave">
              {['Função', 'Disciplina', 'Área', porOndas ? 'Onda' : 'Meta', 'Gestor', 'Candidato', 'Início', ''].map((c, i) => <th key={i} className="px-4 py-2.5 font-medium">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {ativas.map((v) => (
              <tr key={v.id} className="border-b border-borda last:border-0">
                <td className="px-4 py-2.5"><Link href={`/vagas/${v.id}`} className="font-medium text-primaria hover:underline">{v.funcao}</Link></td>
                <td className="px-4 py-2.5">{v.disciplina}</td>
                <td className="px-4 py-2.5">{v.area}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{porOndas ? (v.ondaNome ?? '—') : (v.meta ? dataBR(v.meta) : '—')}</td>
                <td className="px-4 py-2.5">{v.gestor ?? '—'}</td>
                <td className="px-4 py-2.5">{v.candidato ?? '—'}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{dataBR(v.dataInicio)}</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  {!somenteLeitura && (
                    <>
                      <FormVaga
                        rotuloBotao="Editar"
                        rotuloAcessivel={`Editar ${v.funcao}`}
                        vaga={{ id: v.id, funcao: v.funcao, disciplina: v.disciplina, area: v.area, ondaId: v.ondaId, meta: v.meta, gestorId: v.gestorId, candidato: v.candidato, dataInicio: v.dataInicio }}
                        opcoes={opcoes}
                        organizacao={organizacao}
                        projetoId={projetoId}
                      />{' '}
                      {confirmando === v.id ? (
                        <>
                          <Botao variante="perigo" disabled={pendente} onClick={() => cancelar(v.id)}>Confirmar</Botao>{' '}
                          <Botao variante="fantasma" onClick={() => setConfirmando(null)}>Voltar</Botao>
                        </>
                      ) : (
                        <Botao variante="fantasma" onClick={() => setConfirmando(v.id)}>Cancelar vaga</Botao>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ativas.length === 0 && <p className="p-6 text-center text-texto-suave">Nenhuma vaga ativa.</p>}
      </div>
      {canceladas.length > 0 && (
        <details className="rounded-xl border border-borda bg-superficie p-4">
          <summary className="cursor-pointer font-medium">Vagas canceladas ({canceladas.length})</summary>
          <ul className="mt-2 text-sm text-texto-suave">{canceladas.map((v) => <li key={v.id}>{v.funcao} · {v.disciplina} · {porOndas ? (v.ondaNome ?? '—') : (v.meta ? dataBR(v.meta) : '—')}</li>)}</ul>
        </details>
      )}
    </div>
  )
}
