'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ErroGeral } from '@/components/rh/ErroGeral'
import { TabelaCadastro } from '@/components/rh/TabelaCadastro'
import { useEnvio } from '@/components/rh/useEnvio'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { salvarCliente } from '../acoesCadastros'

type Cliente = { id: string; nome: string; projetos: number }

function Form({ cliente, fechar }: { cliente: Cliente | null; fechar: () => void }) {
  const router = useRouter()
  const { erros, pendente, enviar } = useEnvio((d) => salvarCliente(cliente?.id ?? null, d), () => { fechar(); router.refresh() })
  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <Campo rotulo="Nome" name="nome" defaultValue={cliente?.nome} erro={erros.nome} required />
      {!cliente && <p className="text-sm text-texto-suave">As durações das etapas começam com o padrão e podem ser ajustadas depois.</p>}
      <ErroGeral mensagem={erros._} />
      <Botao type="submit" disabled={pendente}>Salvar</Botao>
      {cliente && <Link href={`/cadastros/clientes/${cliente.id}`} className="text-center font-medium text-primaria hover:underline">Durações e gestores</Link>}
    </form>
  )
}

export function CadastroClientes({ clientes }: { clientes: Cliente[] }) {
  return (
    <TabelaCadastro
      linhas={clientes}
      colunas={[
        { titulo: 'Nome', valor: (c) => c.nome },
        { titulo: 'Projetos', valor: (c) => c.projetos },
      ]}
      textoBusca={(c) => c.nome}
      rotuloNovo="Novo cliente"
      tituloPainel={(c) => (c ? c.nome : 'Novo cliente')}
      formulario={(c, fechar) => <Form cliente={c} fechar={fechar} />}
      vazio="Nenhum cliente cadastrado."
    />
  )
}
