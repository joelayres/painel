import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Cartao } from '@/components/ui/Cartao'
import { exigirEquipe } from '@/lib/auth/perfil'
import { semTipos } from '@/lib/curriculos/rpc'
import { dataBR } from '@/lib/formato/datas'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { ehUuid } from '@/lib/validacao/vaga'
import { NovaSelecao } from './NovaSelecao'

export const metadata = { title: 'Seleção · Painel de Mobilização' }

type Linha = { id: string; funcao: string; criado_em: string; encerrada_em: string | null; participacoes: { situacao: string }[] }

// As seleções de currículos do projeto. Só a equipe que pode alterar o projeto chega aqui (RLS).
export default async function Selecoes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!ehUuid(id)) notFound()
  await exigirEquipe()
  const sb = await criarClienteServidor()
  const { data: podeAlterar } = await sb.rpc('pode_alterar_projeto', { p: id })
  if (!podeAlterar) notFound()
  const [{ data: selecoes, error }, { data: vagas }] = await Promise.all([
    semTipos(sb).from('selecoes').select('id, funcao, criado_em, encerrada_em, participacoes(situacao)').eq('projeto_id', id).order('criado_em', { ascending: false }).returns<Linha[]>(),
    sb.from('vagas').select('funcao').eq('projeto_id', id),
  ])
  if (error) throw new Error(`Não foi possível ler as seleções: ${error.message}`)
  const funcoes = [...new Set((vagas ?? []).map((v) => v.funcao))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-texto-suave">Seleção de currículos por função. Só a equipe de RH vê esta área.</p>
        <NovaSelecao projetoId={id} funcoes={funcoes} />
      </div>
      {(selecoes ?? []).length === 0 && <Cartao>Nenhuma seleção ainda. Crie a primeira com o descritivo da vaga.</Cartao>}
      <ul className="flex flex-col gap-2">
        {(selecoes ?? []).map((s) => {
          const validas = s.participacoes.filter((p) => p.situacao !== 'repetida')
          const analisadas = validas.filter((p) => p.situacao === 'analisada').length
          return (
            <li key={s.id}>
              <Link href={`/projetos/${id}/selecao/${s.id}`} className="block rounded-xl border border-borda bg-superficie p-4 hover:border-primaria focus-visible:outline-2 focus-visible:outline-foco">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-titulo text-lg font-semibold">{s.funcao}</span>
                  <span className="text-sm text-texto-suave">{s.encerrada_em ? 'Encerrada' : 'Aberta'} · criada em {dataBR(s.criado_em.slice(0, 10))}</span>
                </div>
                <p className="text-sm text-texto-suave">{validas.length} currículo(s) · {analisadas} analisado(s)</p>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
