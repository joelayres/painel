'use client'

import { useRouter } from 'next/navigation'
import { ErroGeral } from '@/components/rh/ErroGeral'
import { TabelaCadastro } from '@/components/rh/TabelaCadastro'
import { useEnvio } from '@/components/rh/useEnvio'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { salvarGestor } from '../acoesCadastros'

type Gestor = { id: string; nome: string; email: string | null; vagas: number }

function Form({ gestor, fechar }: { gestor: Gestor | null; fechar: () => void }) {
  const router = useRouter()
  const { erros, pendente, enviar } = useEnvio((d) => salvarGestor(gestor?.id ?? null, d), () => { fechar(); router.refresh() })
  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <Campo rotulo="Nome" name="nome" defaultValue={gestor?.nome} erro={erros.nome} required />
      <Campo rotulo="E-mail" name="email" type="email" defaultValue={gestor?.email ?? ''} erro={erros.email} dica="Opcional. Para entrar no painel, cadastre também em Usuários." />
      <ErroGeral mensagem={erros._} />
      <Botao type="submit" disabled={pendente}>Salvar</Botao>
    </form>
  )
}

export function CadastroGestores({ gestores }: { gestores: Gestor[] }) {
  return (
    <TabelaCadastro
      linhas={gestores}
      colunas={[
        { titulo: 'Nome', valor: (g) => g.nome },
        { titulo: 'E-mail', valor: (g) => g.email ?? '—' },
        { titulo: 'Vagas', valor: (g) => g.vagas },
      ]}
      textoBusca={(g) => `${g.nome} ${g.email ?? ''}`}
      rotuloNovo="Novo gestor"
      tituloPainel={(g) => (g ? g.nome : 'Novo gestor')}
      formulario={(g, fechar) => <Form gestor={g} fechar={fechar} />}
      vazio="Nenhum gestor cadastrado."
    />
  )
}
