'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { Botao } from '@/components/ui/Botao'
import { dataBR } from '@/lib/formato/datas'
import type { ErroImportacao, VagaImportada } from '@/lib/importacao/ler'
import { importarVagas, previaImportacao } from './acoes'

type Nomes = { ondas: { id: string; nome: string }[]; gestores: { id: string; nome: string }[] }

const estiloErro = { background: 'var(--st-reprovada-fundo)', color: 'var(--st-reprovada-texto)' }
const estiloAviso = { background: 'var(--st-pendente-fundo)', color: 'var(--st-pendente-texto)' }

export function ImportarVagas({ projetoId, organizacao, nomes }: { projetoId: string; organizacao: 'ondas' | 'meta'; nomes: Nomes }) {
  const router = useRouter()
  const form = useRef<HTMLFormElement>(null)
  const [vagas, setVagas] = useState<VagaImportada[] | null>(null)
  const [erros, setErros] = useState<ErroImportacao[]>([])
  const [falha, setFalha] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const nomeOnda = new Map(nomes.ondas.map((o) => [o.id, o.nome]))
  const nomeGestor = new Map(nomes.gestores.map((g) => [g.id, g.nome]))
  const porOndas = organizacao === 'ondas'

  const ver = () =>
    iniciar(async () => {
      setFalha(null)
      const r = await previaImportacao(projetoId, new FormData(form.current!))
      if (r.ok) { setVagas(r.vagas); setErros([]) } else { setVagas(null); setErros(r.erros) }
    })
  const importar = () =>
    iniciar(async () => {
      const r = await importarVagas(projetoId, new FormData(form.current!))
      if (r.ok) router.push(`/projetos/${projetoId}/configurar?importadas=${r.vagas}`)
      else setFalha(r.erro)
    })

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-prose text-texto-suave">
        Preencha o <a href={`/projetos/${projetoId}/modelo`} download className="font-medium text-primaria hover:underline">modelo Excel do projeto</a> e envie aqui. As vagas são acrescentadas às que o projeto já tem.
      </p>
      <form ref={form} className="flex flex-wrap items-center gap-3 rounded-xl border border-borda bg-superficie p-4">
        <input name="arquivo" type="file" accept=".xlsx" aria-label="Planilha de vagas" onChange={() => { setVagas(null); setErros([]); setFalha(null) }} />
        <Botao type="button" variante="secundario" disabled={pendente} onClick={ver}>Ver prévia</Botao>
      </form>
      {erros.length > 0 && (
        <ul role="alert" className="rounded-xl p-4 text-sm" style={estiloErro}>
          {erros.map((e) => <li key={`${e.linha}-${e.mensagem}`}>{e.linha ? `Linha ${e.linha}: ` : ''}{e.mensagem}</li>)}
        </ul>
      )}
      {falha && <p role="alert" className="rounded-lg px-3 py-2 font-medium" style={estiloErro}>{falha}</p>}
      {vagas && (
        <div className="flex flex-col gap-3">
          <p className="font-medium">{vagas.length} vagas lidas</p>
          {vagas.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-xl border border-borda bg-superficie">
                <table className="w-full text-left text-[15px]">
                  <thead>
                    <tr className="border-b border-borda bg-superficie-2 text-sm text-texto-suave">
                      {['Linha', 'Função', 'Disciplina', 'Área', porOndas ? 'Onda' : 'Meta', 'Gestor', 'Candidato', 'Início', 'Etapas concluídas', 'Avisos'].map((c) => <th key={c} className="px-4 py-2.5 font-medium">{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {vagas.map((v) => (
                      <tr key={v.linha} className="border-b border-borda align-top last:border-0">
                        <td className="px-4 py-2.5">{v.linha}</td>
                        <td className="px-4 py-2.5 font-medium">{v.funcao}</td>
                        <td className="px-4 py-2.5">{v.disciplina}</td>
                        <td className="px-4 py-2.5">{v.area}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{porOndas ? (v.ondaId ? nomeOnda.get(v.ondaId) : '') : (v.meta ? dataBR(v.meta) : '')}</td>
                        <td className="px-4 py-2.5">{v.gestorId ? nomeGestor.get(v.gestorId) : '—'}</td>
                        <td className="px-4 py-2.5">{v.candidato ?? '—'}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{dataBR(v.dataInicio)}</td>
                        <td className="px-4 py-2.5">{v.concluidas.length}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-col gap-1 text-sm">
                            {v.aviso && <span className="rounded px-2 py-0.5" style={estiloAviso}>{v.aviso}</span>}
                            {v.repetida && <span className="rounded px-2 py-0.5" style={estiloAviso}>Já existe uma vaga igual (mesma função, candidato e meta).</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <Botao disabled={pendente} onClick={importar}>Importar {vagas.length} vagas</Botao>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
