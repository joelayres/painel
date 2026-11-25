import { exigirEquipe } from '@/lib/auth/perfil'
import { rpcLivre, semTipos } from '@/lib/curriculos/rpc'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CHAVES, FiltrosCandidatos } from './FiltrosCandidatos'
import { TabelaCandidatos, type LinhaCandidato } from './TabelaCandidatos'

export const metadata = { title: 'Candidatos · Painel de Mobilização' }

// O banco de candidatos: todo o RH busca em todos os projetos (a função do banco devolve só o resumo).
export default async function Candidatos({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await exigirEquipe()
  const busca = await searchParams
  const nomeNoBanco: Record<string, string> = { nota: 'nota_min', indicacao: 'indicado_por' }
  const filtros = Object.fromEntries(CHAVES.map((k) => [nomeNoBanco[k] ?? k, busca[k] ?? '']))
  if (filtros.nota_min && !/^\d{1,3}$/.test(filtros.nota_min)) filtros.nota_min = ''
  if (filtros.desde && !/^\d{4}-\d{2}-\d{2}$/.test(filtros.desde)) filtros.desde = ''
  const sb = await criarClienteServidor()
  const [{ data, error }, { data: selecoes }, { data: indicadores }] = await Promise.all([
    rpcLivre<LinhaCandidato[]>(sb, 'buscar_candidatos', { p: filtros }),
    semTipos(sb).from('selecoes').select('id, funcao, projeto_id, projetos(nome)').is('encerrada_em', null).order('criado_em', { ascending: false })
      .returns<{ id: string; funcao: string; projeto_id: string; projetos: { nome: string } | null }[]>(),
    rpcLivre<string[]>(sb, 'indicadores', {}),
  ])
  if (error) throw new Error(`Não foi possível buscar candidatos: ${error.message}`)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-titulo text-2xl font-semibold">Banco de candidatos</h2>
        <p className="text-texto-suave">Todos os candidatos que passaram por seleções. Só a equipe de RH vê esta área.</p>
      </div>
      <FiltrosCandidatos indicadores={indicadores ?? []} />
      <TabelaCandidatos
        candidatos={data ?? []}
        selecoes={(selecoes ?? []).map((s) => ({ id: s.id, projetoId: s.projeto_id, rotulo: `${s.funcao} · ${s.projetos?.nome ?? ''}` }))}
      />
    </div>
  )
}
