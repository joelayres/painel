'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Botao } from '@/components/ui/Botao'
import { Selecao } from '@/components/ui/Selecao'
import type { Perfil } from '@/lib/auth/perfil'
import { ROTULO_PERFIL } from '@/lib/cadastros/usuarios'
import { liberar, remover } from './acoesConfigurar'

export type PessoaAcesso = { id: string; nome: string; perfil: Perfil }

// Quem vê o projeto: lista de pessoas liberadas e seletor para liberar mais uma.
// O Analista não mexe no acesso de outros Analistas nem de Administradores (o banco também barra).
export function AcessosProjeto({ perfil, projetoId, cliente, pessoas, liberaveis }: { perfil: Perfil; projetoId: string; cliente: string; pessoas: PessoaAcesso[]; liberaveis: PessoaAcesso[] }) {
  const router = useRouter()
  const [escolhida, setEscolhida] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const executar = (acao: () => Promise<{ ok: true } | { ok: false; erro: string }>) =>
    iniciar(async () => {
      const r = await acao()
      if (!r.ok) return setErro(r.erro)
      setErro(null)
      setEscolhida('')
      router.refresh()
    })

  return (
    <div className="flex flex-col gap-4">
      {erro && <p role="alert" className="rounded-lg px-3 py-2 font-medium" style={{ background: 'var(--st-reprovada-fundo)', color: 'var(--st-reprovada-texto)' }}>{erro}</p>}
      <div className="overflow-x-auto rounded-xl border border-borda bg-superficie">
        <table className="w-full text-left text-[15px]">
          <thead>
            <tr className="border-b border-borda bg-superficie-2 text-sm text-texto-suave">
              <th className="px-4 py-2.5 font-medium">Pessoa</th>
              <th className="px-4 py-2.5 font-medium">Perfil</th>
              <th className="px-4 py-2.5"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {pessoas.map((p) => (
              <tr key={p.id} className="border-b border-borda last:border-0">
                <td className="px-4 py-2.5 font-medium">{p.nome}</td>
                <td className="px-4 py-2.5">{ROTULO_PERFIL[p.perfil]}</td>
                <td className="px-4 py-2.5 text-right">
                  {(perfil === 'rh' || (p.perfil !== 'analista' && p.perfil !== 'rh')) && (
                    <Botao variante="fantasma" disabled={pendente} onClick={() => executar(() => remover(projetoId, p.id))}>remover{' '}<span className="sr-only">{p.nome}</span></Botao>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pessoas.length === 0 && <p className="p-6 text-center text-texto-suave">Ninguém liberado ainda. O Administrador vê todos os projetos.</p>}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Selecao
          rotulo="Pessoa" className="min-w-64 flex-1" value={escolhida} onChange={(e) => setEscolhida(e.target.value)}
          opcoes={[{ valor: '', rotulo: 'Escolha a pessoa' }, ...liberaveis.map((u) => ({ valor: u.id, rotulo: `${u.nome} (${ROTULO_PERFIL[u.perfil]})` }))]}
        />
        <Botao disabled={pendente || !escolhida} onClick={() => executar(() => liberar(projetoId, escolhida))}>Liberar</Botao>
      </div>
      <p className="text-sm text-texto-suave">Só aparecem os Gestores Timenow e as pessoas do cliente {cliente}{perfil === 'rh' ? ' e os Analistas de RH' : ''}.</p>
    </div>
  )
}
