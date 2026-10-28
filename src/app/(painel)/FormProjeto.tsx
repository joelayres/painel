'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { PainelLateral } from '@/components/ui/PainelLateral'
import { Selecao } from '@/components/ui/Selecao'
import { salvarProjeto } from './acoesProjeto'

// Novo projeto num painel lateral; ao salvar, vai para a configuração do projeto.
export function FormProjeto({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [pendente, iniciar] = useTransition()

  const enviar = (form: FormData) =>
    iniciar(async () => {
      const r = await salvarProjeto(null, Object.fromEntries(form))
      if (!r.ok) return setErros(r.erros)
      setErros({})
      setAberto(false)
      router.push(`/projetos/${r.id}/configurar`)
    })

  return (
    <>
      <Botao onClick={() => setAberto(true)}>+ Novo projeto</Botao>
      <PainelLateral titulo="Novo projeto" aberto={aberto} aoFechar={() => setAberto(false)}>
        <form action={enviar} className="flex flex-col gap-4">
          <Selecao rotulo="Cliente" name="clienteId" defaultValue="" erro={erros.clienteId}
            opcoes={[{ valor: '', rotulo: 'Escolha o cliente' }, ...clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))]} />
          <Campo rotulo="Nome" name="nome" erro={erros.nome} required />
          <Campo rotulo="Área" name="area" dica="Opcional." />
          <Selecao rotulo="Organização" name="organizacao" defaultValue="ondas" erro={erros.organizacao}
            opcoes={[{ valor: 'ondas', rotulo: 'Por ondas' }, { valor: 'meta', rotulo: 'Por meta' }]} />
          {erros._ && <p role="alert" className="text-[var(--st-reprovada-texto)]">{erros._}</p>}
          <Botao type="submit" disabled={pendente}>{pendente ? 'Salvando…' : 'Salvar'}</Botao>
        </form>
      </PainelLateral>
    </>
  )
}
