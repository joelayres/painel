'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ErroGeral } from '@/components/rh/ErroGeral'
import { Interruptor } from '@/components/rh/Interruptor'
import { TabelaCadastro } from '@/components/rh/TabelaCadastro'
import { useEnvio } from '@/components/rh/useEnvio'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Selecao } from '@/components/ui/Selecao'
import { PERFIS_USUARIO, ROTULO_PERFIL, type PerfilUsuario } from '@/lib/cadastros/usuarios'
import { liberarAcessoUsuario, removerAcessoUsuario, salvarUsuario } from '../acoesCadastros'

type Usuario = { id: string; nome: string; email: string; perfil: PerfilUsuario; clienteId: string | null; ativo: boolean; acessos: string[] }
type Cliente = { id: string; nome: string }
type Projeto = { id: string; nome: string; clienteId: string }

const PERFIS = PERFIS_USUARIO.map((valor) => ({ valor, rotulo: ROTULO_PERFIL[valor] }))

// Projetos que a pessoa pode receber: todos para o Analista e o gestor, os do cliente dela para o cliente.
function projetosElegiveis(u: Usuario, projetos: Projeto[]): Projeto[] {
  if (u.perfil === 'gestor' || u.perfil === 'analista') return projetos
  if (u.perfil === 'cliente') return projetos.filter((p) => p.clienteId === u.clienteId)
  return []
}

function Acessos({ usuario, projetos }: { usuario: Usuario; projetos: Projeto[] }) {
  const router = useRouter()
  const [marcados, setMarcados] = useState(() => new Set(usuario.acessos))
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const elegiveis = projetosElegiveis(usuario, projetos)

  if (usuario.perfil === 'rh') return <p className="text-sm text-texto-suave">O Administrador vê todos os projetos.</p>
  if (elegiveis.length === 0) return <p className="text-sm text-texto-suave">Nenhum projeto disponível para esta pessoa.</p>

  const alternar = (projetoId: string, marcar: boolean) =>
    iniciar(async () => {
      const r = marcar ? await liberarAcessoUsuario(projetoId, usuario.id) : await removerAcessoUsuario(projetoId, usuario.id)
      if (!r.ok) return setErro(r.erro)
      setErro(null)
      setMarcados((atual) => {
        const novo = new Set(atual)
        if (marcar) novo.add(projetoId)
        else novo.delete(projetoId)
        return novo
      })
      router.refresh()
    })

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-texto-suave">Projetos que vê</legend>
      {elegiveis.map((p) => (
        <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-borda px-3">
          <input type="checkbox" className="size-5 accent-[var(--primaria)]" checked={marcados.has(p.id)} disabled={pendente} onChange={(e) => alternar(p.id, e.target.checked)} />
          <span>{p.nome}</span>
        </label>
      ))}
      {erro && <p role="alert" className="text-sm text-[var(--st-reprovada-texto)]">{erro}</p>}
    </fieldset>
  )
}

function Form({ usuario, clientes, projetos, fechar }: { usuario: Usuario | null; clientes: Cliente[]; projetos: Projeto[]; fechar: () => void }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState<PerfilUsuario>(usuario?.perfil ?? 'gestor')
  const { erros, pendente, enviar } = useEnvio((d) => salvarUsuario(usuario?.id ?? null, d), () => { fechar(); router.refresh() })
  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <Campo rotulo="Nome" name="nome" defaultValue={usuario?.nome} erro={erros.nome} required />
        {usuario ? <p className="text-sm text-texto-suave">E-mail: {usuario.email}</p> : <Campo rotulo="E-mail" name="email" type="email" erro={erros.email} dica="A pessoa entra com um código enviado para este e-mail." required />}
        <Selecao rotulo="Perfil" name="perfil" value={perfil} onChange={(e) => setPerfil(e.target.value as PerfilUsuario)} opcoes={PERFIS} erro={erros.perfil} />
        {perfil === 'cliente' && (
          <Selecao rotulo="Cliente" name="clienteId" defaultValue={usuario?.clienteId ?? ''} opcoes={[{ valor: '', rotulo: 'Escolha o cliente' }, ...clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))]} erro={erros.clienteId} />
        )}
        {usuario && <Interruptor nome="ativo" rotulo="Pode entrar no painel" padrao={usuario.ativo} />}
        <ErroGeral mensagem={erros._} />
        <Botao type="submit" disabled={pendente}>Salvar</Botao>
      </form>
      {usuario && <Acessos usuario={usuario} projetos={projetos} />}
    </div>
  )
}

export function CadastroUsuarios({ usuarios, clientes, projetos }: { usuarios: Usuario[]; clientes: Cliente[]; projetos: Projeto[] }) {
  const nomeCliente = new Map(clientes.map((c) => [c.id, c.nome]))
  const nomeProjeto = new Map(projetos.map((p) => [p.id, p.nome]))
  const ve = (u: Usuario) => {
    if (u.perfil === 'rh') return 'todos'
    const nomes = u.acessos.map((id) => nomeProjeto.get(id)).filter(Boolean)
    return nomes.length ? nomes.join(', ') : 'nenhum projeto'
  }
  return (
    <TabelaCadastro
      linhas={usuarios}
      colunas={[
        { titulo: 'Nome', valor: (u) => u.nome },
        { titulo: 'E-mail', valor: (u) => u.email },
        { titulo: 'Perfil', valor: (u) => ROTULO_PERFIL[u.perfil] },
        { titulo: 'Cliente', valor: (u) => (u.clienteId ? nomeCliente.get(u.clienteId) ?? '—' : '—') },
        { titulo: 'Acesso', valor: (u) => `Vê: ${ve(u)}` },
        { titulo: 'Situação', valor: (u) => (u.ativo ? 'Ativo' : <span className="text-texto-suave">Sem acesso</span>) },
      ]}
      textoBusca={(u) => `${u.nome} ${u.email}`}
      rotuloNovo="Novo usuário"
      tituloPainel={(u) => (u ? u.nome : 'Novo usuário')}
      formulario={(u, fechar) => <Form usuario={u} clientes={clientes} projetos={projetos} fechar={fechar} />}
      vazio="Nenhum usuário cadastrado."
    />
  )
}
