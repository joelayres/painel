'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { salvarVaga } from '@/app/(painel)/vagas/[id]/acoesVaga'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { PainelLateral } from '@/components/ui/PainelLateral'
import { Selecao } from '@/components/ui/Selecao'

export type VagaEditavel = { id: string; funcao: string; disciplina: string; area: string; ondaId: string | null; meta: string | null; gestorId: string | null; candidato: string | null; dataInicio: string }
type Opcoes = { ondas: { id: string; nome: string }[]; gestores: { id: string; nome: string }[] }

// Criar (vaga = null) ou editar uma vaga, num painel lateral.
// `rotuloAcessivel`: nome do botão para leitores de tela quando há vários na mesma página (ex.: "Editar Técnico").
export function FormVaga({ vaga, opcoes, rotuloBotao, rotuloAcessivel, organizacao, projetoId }: { vaga: VagaEditavel | null; opcoes: Opcoes; rotuloBotao: string; rotuloAcessivel?: string; organizacao: 'ondas' | 'meta'; projetoId: string }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const enviar = (form: FormData) =>
    iniciar(async () => {
      const r = await salvarVaga(vaga?.id ?? null, { ...Object.fromEntries(form), projetoId })
      if (!r.ok) return setErros(r.erros)
      setErros({})
      router.refresh()
      // Com aviso, o painel fica aberto até a pessoa ler e tocar em "Entendi".
      if (r.aviso) return setAviso(r.aviso)
      setAberto(false)
    })

  const fechar = () => {
    setAberto(false)
    setAviso(null)
  }

  return (
    <>
      <Botao variante={vaga ? 'secundario' : 'primario'} aria-label={rotuloAcessivel} onClick={() => setAberto(true)}>{rotuloBotao}</Botao>
      <PainelLateral titulo={vaga ? 'Editar vaga' : 'Nova vaga'} aberto={aberto} aoFechar={fechar}>
        {aviso ? (
          <div className="flex flex-col gap-4">
            <p role="status" className="rounded-lg px-3 py-2 font-medium" style={{ background: 'var(--st-reprovada-fundo)', color: 'var(--st-reprovada-texto)' }}>{aviso}</p>
            <Botao type="button" onClick={fechar}>Entendi</Botao>
          </div>
        ) : (
        <form action={enviar} className="flex flex-col gap-4">
          <Campo rotulo="Função" name="funcao" defaultValue={vaga?.funcao} erro={erros.funcao} required />
          <Campo rotulo="Disciplina" name="disciplina" defaultValue={vaga?.disciplina} erro={erros.disciplina} />
          <Campo rotulo="Área" name="area" defaultValue={vaga?.area} erro={erros.area} />
          {organizacao === 'ondas' ? (
            <Selecao rotulo="Onda" name="ondaId" defaultValue={vaga?.ondaId ?? ''} erro={erros.ondaId}
              opcoes={[{ valor: '', rotulo: 'Escolha a onda' }, ...opcoes.ondas.map((o) => ({ valor: o.id, rotulo: o.nome }))]} />
          ) : (
            <Campo rotulo="Meta (data pedida pelo cliente)" name="meta" type="date" defaultValue={vaga?.meta ?? ''} erro={erros.meta} required />
          )}
          <Selecao rotulo="Gestor" name="gestorId" defaultValue={vaga?.gestorId ?? ''} erro={erros.gestorId}
            opcoes={[{ valor: '', rotulo: 'Sem gestor' }, ...opcoes.gestores.map((g) => ({ valor: g.id, rotulo: g.nome }))]} />
          <Campo rotulo="Candidato" name="candidato" defaultValue={vaga?.candidato ?? ''} dica="Deixe vazio enquanto não houver." />
          <Campo rotulo="Início do processo" name="dataInicio" type="date" defaultValue={vaga?.dataInicio} erro={erros.dataInicio} required />
          {erros._ && <p role="alert" className="text-[var(--st-reprovada-texto)]">{erros._}</p>}
          <Botao type="submit" disabled={pendente}>{pendente ? 'Salvando…' : 'Salvar'}</Botao>
        </form>
        )}
      </PainelLateral>
    </>
  )
}
