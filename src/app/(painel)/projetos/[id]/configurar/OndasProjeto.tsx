'use client'

import { useRouter } from 'next/navigation'
import { ErroGeral } from '@/components/rh/ErroGeral'
import { TabelaCadastro } from '@/components/rh/TabelaCadastro'
import { useEnvio } from '@/components/rh/useEnvio'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { dataBR } from '@/lib/formato/datas'
import { salvarOndaProjeto } from './acoesConfigurar'

export type OndaProjeto = { id: string; nome: string; inicio: string; fim: string }

function Form({ projetoId, onda, fechar }: { projetoId: string; onda: OndaProjeto | null; fechar: () => void }) {
  const router = useRouter()
  const { erros, pendente, enviar } = useEnvio((d) => salvarOndaProjeto(projetoId, onda?.id ?? null, d), () => { fechar(); router.refresh() })
  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <Campo rotulo="Nome" name="nome" defaultValue={onda?.nome} erro={erros.nome} required />
      <Campo rotulo="Início" name="inicio" type="date" defaultValue={onda?.inicio} erro={erros.inicio} required />
      <Campo rotulo="Fim (prazo de admissão)" name="fim" type="date" defaultValue={onda?.fim} erro={erros.fim} required />
      <ErroGeral mensagem={erros._} />
      <Botao type="submit" disabled={pendente}>Salvar</Botao>
    </form>
  )
}

export function OndasProjeto({ projetoId, ondas, somenteLeitura }: { projetoId: string; ondas: OndaProjeto[]; somenteLeitura: boolean }) {
  if (somenteLeitura) {
    return (
      <div className="overflow-x-auto rounded-xl border border-borda bg-superficie">
        <table className="w-full text-left text-[15px]">
          <thead>
            <tr className="border-b border-borda bg-superficie-2 text-sm text-texto-suave">
              {['Nome', 'Início', 'Fim'].map((c) => <th key={c} className="px-4 py-2.5 font-medium">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {ondas.map((o) => (
              <tr key={o.id} className="border-b border-borda last:border-0">
                <td className="px-4 py-2.5 font-medium">{o.nome}</td>
                <td className="px-4 py-2.5">{dataBR(o.inicio)}</td>
                <td className="px-4 py-2.5">{dataBR(o.fim)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ondas.length === 0 && <p className="p-6 text-center text-texto-suave">Nenhuma onda cadastrada.</p>}
      </div>
    )
  }
  return (
    <TabelaCadastro
      linhas={ondas}
      colunas={[
        { titulo: 'Nome', valor: (o) => o.nome },
        { titulo: 'Início', valor: (o) => dataBR(o.inicio) },
        { titulo: 'Fim', valor: (o) => dataBR(o.fim) },
      ]}
      textoBusca={(o) => o.nome}
      rotuloNovo="Nova onda"
      tituloPainel={(o) => o?.nome ?? 'Nova onda'}
      formulario={(o, fechar) => <Form projetoId={projetoId} onda={o} fechar={fechar} />}
      vazio="Nenhuma onda cadastrada."
    />
  )
}
