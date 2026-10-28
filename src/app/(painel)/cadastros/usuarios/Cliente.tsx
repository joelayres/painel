'use client'

import { useRouter } from 'next/navigation'
import { ErroGeral } from '@/components/rh/ErroGeral'
import { Interruptor } from '@/components/rh/Interruptor'
import { TabelaCadastro } from '@/components/rh/TabelaCadastro'
import { useEnvio } from '@/components/rh/useEnvio'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Selecao } from '@/components/ui/Selecao'
import { salvarUsuario } from '../acoesCadastros'

type Usuario = { id: string; nome: string; email: string; perfil: 'rh' | 'visualizador'; ativo: boolean }
const PERFIS = [{ valor: 'visualizador', rotulo: 'Visualizador (cliente e gestores: só vê)' }, { valor: 'rh', rotulo: 'RH (vê e altera)' }]

function Form({ usuario, fechar }: { usuario: Usuario | null; fechar: () => void }) {
  const router = useRouter()
  const { erros, pendente, enviar } = useEnvio((d) => salvarUsuario(usuario?.id ?? null, d), () => { fechar(); router.refresh() })
  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <Campo rotulo="Nome" name="nome" defaultValue={usuario?.nome} erro={erros.nome} required />
      {usuario ? <p className="text-sm text-texto-suave">E-mail: {usuario.email}</p> : <Campo rotulo="E-mail" name="email" type="email" erro={erros.email} dica="A pessoa entra com um código enviado para este e-mail." required />}
      <Selecao rotulo="Perfil" name="perfil" defaultValue={usuario?.perfil ?? 'visualizador'} opcoes={PERFIS} erro={erros.perfil} />
      {usuario && <Interruptor nome="ativo" rotulo="Pode entrar no painel" padrao={usuario.ativo} />}
      <ErroGeral mensagem={erros._} />
      <Botao type="submit" disabled={pendente}>Salvar</Botao>
    </form>
  )
}

export function CadastroUsuarios({ usuarios }: { usuarios: Usuario[] }) {
  return (
    <TabelaCadastro
      linhas={usuarios}
      colunas={[
        { titulo: 'Nome', valor: (u) => u.nome },
        { titulo: 'E-mail', valor: (u) => u.email },
        { titulo: 'Perfil', valor: (u) => (u.perfil === 'rh' ? 'RH' : 'Visualizador') },
        { titulo: 'Situação', valor: (u) => (u.ativo ? 'Ativo' : <span className="text-texto-suave">Sem acesso</span>) },
      ]}
      textoBusca={(u) => `${u.nome} ${u.email}`}
      rotuloNovo="Novo usuário"
      tituloPainel={(u) => (u ? u.nome : 'Novo usuário')}
      formulario={(u, fechar) => <Form usuario={u} fechar={fechar} />}
      vazio="Nenhum usuário cadastrado."
    />
  )
}
