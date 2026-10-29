'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ErroGeral } from '@/components/rh/ErroGeral'
import { TabelaCadastro } from '@/components/rh/TabelaCadastro'
import { useEnvio } from '@/components/rh/useEnvio'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { excluirCliente, salvarCliente } from '../acoesCadastros'

type Cliente = { id: string; nome: string; projetos: number }

// Só cliente sem projetos e sem usuários ligados pode sair; o banco confere e a tela mostra o motivo.
export function ExcluirCliente({ cliente, aoExcluir }: { cliente: Cliente; aoExcluir: () => void }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const excluir = () =>
    iniciar(async () => {
      const r = await excluirCliente(cliente.id)
      if (!r.ok) return setErro(r.erros._ ?? 'Não foi possível excluir. Tente de novo.')
      aoExcluir()
      router.refresh()
    })
  if (!confirmando) return <Botao type="button" variante="perigo" onClick={() => { setConfirmando(true); setErro(null) }}>Excluir cliente{' '}<span className="sr-only">{cliente.nome}</span></Botao>
  return (
    <div role="group" aria-label={`Confirmar exclusão de ${cliente.nome}`} className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie-2 p-3 text-sm">
      <p>Excluir {cliente.nome}? Os gestores e as etapas do cliente também serão apagados.</p>
      <div className="flex flex-wrap gap-2">
        <Botao type="button" variante="perigo" disabled={pendente} onClick={excluir}>Confirmar exclusão</Botao>
        <Botao type="button" variante="fantasma" disabled={pendente} onClick={() => setConfirmando(false)}>Cancelar</Botao>
      </div>
      {erro && <p role="alert" className="text-[var(--st-reprovada-texto)]">{erro}</p>}
    </div>
  )
}

function Form({ cliente, fechar }: { cliente: Cliente | null; fechar: () => void }) {
  const router = useRouter()
  const { erros, pendente, enviar } = useEnvio((d) => salvarCliente(cliente?.id ?? null, d), () => { fechar(); router.refresh() })
  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <Campo rotulo="Nome" name="nome" defaultValue={cliente?.nome} erro={erros.nome} required />
      {!cliente && <p className="text-sm text-texto-suave">As etapas começam com as 13 padrão e podem ser ajustadas depois.</p>}
      <ErroGeral mensagem={erros._} />
      <Botao type="submit" disabled={pendente}>Salvar</Botao>
      {cliente && <Link href={`/cadastros/clientes/${cliente.id}`} className="text-center font-medium text-primaria hover:underline">Etapas e gestores</Link>}
      {cliente && <ExcluirCliente cliente={cliente} aoExcluir={fechar} />}
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
