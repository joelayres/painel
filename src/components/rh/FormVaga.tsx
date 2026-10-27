'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { salvarVaga } from '@/app/(painel)/vagas/[id]/acoesVaga'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { PainelLateral } from '@/components/ui/PainelLateral'
import { Selecao } from '@/components/ui/Selecao'

export type VagaEditavel = { id: string; funcao: string; disciplina: string; area: string; ondaId: string; gestorId: string | null; candidato: string | null; dataInicio: string }
type Opcoes = { ondas: { id: string; numero: number }[]; gestores: { id: string; nome: string }[] }

// Criar (vaga = null) ou editar uma vaga, num painel lateral.
export function FormVaga({ vaga, opcoes, rotuloBotao }: { vaga: VagaEditavel | null; opcoes: Opcoes; rotuloBotao: string }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [pendente, iniciar] = useTransition()

  const enviar = (form: FormData) =>
    iniciar(async () => {
      const r = await salvarVaga(vaga?.id ?? null, Object.fromEntries(form))
      if (!r.ok) return setErros(r.erros)
      setErros({})
      setAberto(false)
      router.refresh()
    })

  return (
    <>
      <Botao variante={vaga ? 'secundario' : 'primario'} onClick={() => setAberto(true)}>{rotuloBotao}</Botao>
      <PainelLateral titulo={vaga ? 'Editar vaga' : 'Nova vaga'} aberto={aberto} aoFechar={() => setAberto(false)}>
        <form action={enviar} className="flex flex-col gap-4">
          <Campo rotulo="Função" name="funcao" defaultValue={vaga?.funcao} erro={erros.funcao} required />
          <Campo rotulo="Disciplina" name="disciplina" defaultValue={vaga?.disciplina} erro={erros.disciplina} required />
          <Campo rotulo="Área" name="area" defaultValue={vaga?.area} erro={erros.area} required />
          <Selecao rotulo="Onda" name="ondaId" defaultValue={vaga?.ondaId ?? ''} erro={erros.ondaId}
            opcoes={[{ valor: '', rotulo: 'Escolha a onda' }, ...opcoes.ondas.map((o) => ({ valor: o.id, rotulo: `${o.numero}ª Onda` }))]} />
          <Selecao rotulo="Gestor" name="gestorId" defaultValue={vaga?.gestorId ?? ''} erro={erros.gestorId}
            opcoes={[{ valor: '', rotulo: 'Sem gestor' }, ...opcoes.gestores.map((g) => ({ valor: g.id, rotulo: g.nome }))]} />
          <Campo rotulo="Candidato" name="candidato" defaultValue={vaga?.candidato ?? ''} dica="Deixe vazio enquanto não houver." />
          <Campo rotulo="Início do processo" name="dataInicio" type="date" defaultValue={vaga?.dataInicio} erro={erros.dataInicio} required />
          {erros._ && <p role="alert" className="text-[var(--st-reprovada-texto)]">{erros._}</p>}
          <Botao type="submit" disabled={pendente}>{pendente ? 'Salvando…' : 'Salvar'}</Botao>
        </form>
      </PainelLateral>
    </>
  )
}
