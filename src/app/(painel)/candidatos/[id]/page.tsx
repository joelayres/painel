import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Cartao } from '@/components/ui/Cartao'
import { rotuloClassificacao, rotuloResultado, type Classificacao, type Resultado } from '@/dominio/selecao'
import { exigirEquipe } from '@/lib/auth/perfil'
import { rpcLivre, semTipos } from '@/lib/curriculos/rpc'
import { dataBR } from '@/lib/formato/datas'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { ehUuid } from '@/lib/validacao/vaga'
import { ExcluirCandidato } from './ExcluirCandidato'
import { VerCurriculo } from './VerCurriculo'

export const metadata = { title: 'Candidato · Painel de Mobilização' }

type Candidato = { id: string; nome: string; email: string | null; telefone: string | null; cpf: string | null; cidade: string | null; uf: string | null; criado_em: string }
type Participacao = { participacao_id: string; selecao_id: string; projeto_id: string; projeto: string; funcao: string; criado_em: string; nota: number | null; classificacao: Classificacao | null; resultado: Resultado; detalhe_visivel: boolean; indicado_por: string | null }

export default async function FichaCandidato({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!ehUuid(id)) notFound()
  const sessao = await exigirEquipe()
  const sb = await criarClienteServidor()
  const db = semTipos(sb)
  const [{ data: candidato }, { data: curriculos }, { data: participacoes }] = await Promise.all([
    db.from('candidatos').select('id, nome, email, telefone, cpf, cidade, uf, criado_em').eq('id', id).maybeSingle<Candidato>(),
    db.from('curriculos').select('id, nome_arquivo, enviado_em, enviado_por').eq('candidato_id', id).order('enviado_em', { ascending: false }).returns<{ id: string; nome_arquivo: string; enviado_em: string; enviado_por: string }[]>(),
    rpcLivre<Participacao[]>(sb, 'participacoes_do_candidato', { p_candidato: id }),
  ])
  if (!candidato) notFound()
  const cpf = candidato.cpf ? candidato.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : null

  return (
    <div className="flex flex-col gap-5">
      <Link href="/candidatos" className="text-sm font-medium text-primaria hover:underline">← Banco de candidatos</Link>
      <div>
        <h2 className="font-titulo text-2xl font-semibold">{candidato.nome}</h2>
        <p className="text-texto-suave">{[candidato.email, candidato.telefone, cpf && `CPF ${cpf}`, [candidato.cidade, candidato.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ') || 'Sem contato registrado'}</p>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="font-titulo text-xl font-semibold">Currículos</h3>
        <ul className="flex flex-col gap-1">
          {(curriculos ?? []).map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span>{c.nome_arquivo} · enviado em {dataBR(c.enviado_em.slice(0, 10))} por {c.enviado_por}</span>
              <VerCurriculo curriculoId={c.id} />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-titulo text-xl font-semibold">Seleções</h3>
        {(participacoes ?? []).length === 0 && <Cartao>Nenhuma seleção.</Cartao>}
        <ul className="flex flex-col gap-2">
          {(participacoes ?? []).map((p) => {
            const texto = (
              <>
                <span className="font-semibold">{p.funcao} · {p.projeto}</span>
                <span className="text-sm text-texto-suave">
                  {dataBR(p.criado_em.slice(0, 10))} · nota {p.nota ?? '—'} · {p.classificacao ? rotuloClassificacao(p.classificacao) : 'não analisado'} · {rotuloResultado(p.resultado)}{p.indicado_por ? ` · indicado por ${p.indicado_por}` : ''}
                </span>
              </>
            )
            return (
              <li key={p.participacao_id}>
                {p.detalhe_visivel ? (
                  <Link href={`/projetos/${p.projeto_id}/selecao/${p.selecao_id}`} className="flex flex-col rounded-xl border border-borda bg-superficie p-3 hover:border-primaria">{texto}</Link>
                ) : (
                  <div className="flex flex-col rounded-xl border border-borda bg-superficie p-3">{texto}<span className="text-xs text-texto-suave">Projeto de outra pessoa da equipe: só o resumo.</span></div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {sessao.perfil === 'rh' && <ExcluirCandidato id={candidato.id} nome={candidato.nome} />}
    </div>
  )
}
