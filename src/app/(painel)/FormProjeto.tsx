'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { PainelLateral } from '@/components/ui/PainelLateral'
import { Selecao } from '@/components/ui/Selecao'
import { salvarProjeto } from './acoesProjeto'

export type ProjetoEditavel = { id: string; clienteId: string; clienteNome: string; nome: string; area: string | null; organizacao: 'ondas' | 'meta' }

// Novo projeto num painel lateral; ao salvar, vai para a configuração do projeto.
// Com `projeto`, edita esse projeto (o cliente aparece só para leitura) e fica na página.
export function FormProjeto({ clientes = [], projeto = null }: { clientes?: { id: string; nome: string }[]; projeto?: ProjetoEditavel | null }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [pendente, iniciar] = useTransition()

  const enviar = (form: FormData) =>
    iniciar(async () => {
      const r = await salvarProjeto(projeto?.id ?? null, projeto ? { ...Object.fromEntries(form), clienteId: projeto.clienteId } : Object.fromEntries(form))
      if (!r.ok) return setErros(r.erros)
      setErros({})
      setAberto(false)
      if (projeto) return router.refresh()
      router.push(`/projetos/${r.id}/configurar`)
    })

  return (
    <>
      <Botao variante={projeto ? 'secundario' : 'primario'} onClick={() => setAberto(true)}>{projeto ? 'Editar dados' : '+ Novo projeto'}</Botao>
      <PainelLateral titulo={projeto ? 'Dados do projeto' : 'Novo projeto'} aberto={aberto} aoFechar={() => setAberto(false)}>
        <form action={enviar} className="flex flex-col gap-4">
          {projeto ? (
            <Campo rotulo="Cliente" value={projeto.clienteNome} readOnly dica="O cliente de um projeto não muda." />
          ) : (
            <Selecao rotulo="Cliente" name="clienteId" defaultValue="" erro={erros.clienteId}
              opcoes={[{ valor: '', rotulo: 'Escolha o cliente' }, ...clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))]} />
          )}
          <Campo rotulo="Nome" name="nome" defaultValue={projeto?.nome} erro={erros.nome} required />
          <Campo rotulo="Área" name="area" defaultValue={projeto?.area ?? ''} dica="Opcional." />
          <Selecao rotulo="Organização" name="organizacao" defaultValue={projeto?.organizacao ?? 'ondas'} erro={erros.organizacao}
            opcoes={[{ valor: 'ondas', rotulo: 'Por ondas' }, { valor: 'meta', rotulo: 'Por meta' }]} />
          {erros._ && <p role="alert" className="text-[var(--st-reprovada-texto)]">{erros._}</p>}
          <Botao type="submit" disabled={pendente}>{pendente ? 'Salvando…' : 'Salvar'}</Botao>
        </form>
      </PainelLateral>
    </>
  )
}
