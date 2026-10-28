'use client'

import { useRouter } from 'next/navigation'
import { ErroGeral } from '@/components/rh/ErroGeral'
import { TabelaCadastro } from '@/components/rh/TabelaCadastro'
import { useEnvio } from '@/components/rh/useEnvio'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { dataBR } from '@/lib/formato/datas'
import { salvarOnda } from '../acoesCadastros'

type Onda = { id: string; numero: number; inicio: string; fim: string }

function Form({ onda, fechar }: { onda: Onda | null; fechar: () => void }) {
  const router = useRouter()
  const { erros, pendente, enviar } = useEnvio((d) => salvarOnda(onda?.id ?? null, d), () => { fechar(); router.refresh() })
  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <Campo rotulo="Número da onda" name="numero" type="number" min={1} max={4} defaultValue={onda?.numero} erro={erros.numero} required />
      <Campo rotulo="Início" name="inicio" type="date" defaultValue={onda?.inicio} erro={erros.inicio} required />
      <Campo rotulo="Fim (prazo de admissão)" name="fim" type="date" defaultValue={onda?.fim} erro={erros.fim} required />
      <ErroGeral mensagem={erros._} />
      <Botao type="submit" disabled={pendente}>Salvar</Botao>
    </form>
  )
}

export function CadastroOndas({ ondas }: { ondas: Onda[] }) {
  return (
    <TabelaCadastro
      linhas={ondas}
      colunas={[
        { titulo: 'Onda', valor: (o) => `${o.numero}ª Onda` },
        { titulo: 'Início', valor: (o) => dataBR(o.inicio) },
        { titulo: 'Fim', valor: (o) => dataBR(o.fim) },
      ]}
      textoBusca={(o) => String(o.numero)}
      rotuloNovo="Nova onda"
      tituloPainel={(o) => (o ? `${o.numero}ª Onda` : 'Nova onda')}
      formulario={(o, fechar) => <Form onda={o} fechar={fechar} />}
      vazio="Nenhuma onda cadastrada."
    />
  )
}
