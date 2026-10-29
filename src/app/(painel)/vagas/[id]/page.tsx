import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FormVaga } from '@/components/rh/FormVaga'
import { hojeSP } from '@/dominio/tempo'
import { ehEquipe, exigirSessao } from '@/lib/auth/perfil'
import { dataBR, ddmm } from '@/lib/formato/datas'
import { carregarVaga } from '@/lib/painel/dados'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { COR_PRAZO, ROTULO_PRAZO } from '../../cores'
import { ehUuid } from '@/lib/validacao/vaga'
import { Acoes } from './Acoes'
import { HistoricoVaga } from './HistoricoVaga'

export default async function DetalheVaga({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!ehUuid(id)) notFound()
  const sessao = await exigirSessao()
  const sb = await criarClienteServidor()
  const hoje = hojeSP()
  const carregada = await carregarVaga(sb, hoje, id)
  if (!carregada) notFound()
  const { painel: { projeto, ondas, gestores }, vaga } = carregada
  const podeEditar = ehEquipe(sessao.perfil) && !projeto.encerrado
  const [{ data: bruta }, { data: historico }] = await Promise.all([
    sb.from('vagas').select('onda_id, meta, gestor_id, data_inicio').eq('id', id).single(),
    sb.from('historico').select('id, nome_usuario, acao, em, detalhe').eq('vaga_id', id).order('em', { ascending: false }),
  ])
  const p = vaga.previsao
  const atual = p.etapas.find((e) => e.ordem === p.etapaAtual) ?? null
  const ultima = [...p.etapas].reverse().find((e) => e.concluidaEm !== null)?.ordem ?? null
  const cor = vaga.situacao.cor

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/projetos/${vaga.projetoId}`} className="text-sm font-medium text-primaria hover:underline">← Voltar ao painel</Link>
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-borda bg-superficie p-4">
        <div>
          <h2 className="font-titulo text-3xl font-semibold">{vaga.funcao}</h2>
          <p className="text-texto-suave">{[vaga.disciplina, vaga.area].filter(Boolean).join(' · ')}{vaga.disciplina || vaga.area ? ' · ' : ''}{vaga.onda ? `${vaga.onda.nome} (meta ${ddmm(vaga.meta)})` : `Meta ${ddmm(vaga.meta)}`}</p>
          <p className="mt-1">Gestor: {vaga.gestor?.nome ?? 'Sem gestor'} · Candidato: {vaga.candidato ?? 'ainda não definido'}</p>
          <p className="mt-2 text-sm">
            {cor && <span className="mr-2 font-semibold" style={{ color: COR_PRAZO[cor] }}>{ROTULO_PRAZO[cor]}</span>}
            Admissão prevista {dataBR(p.admissaoEstimada)} · Conclusão prevista {dataBR(p.conclusaoEstimada)}
          </p>
        </div>
        {podeEditar && bruta && (
          <FormVaga
            rotuloBotao="Editar vaga"
            vaga={{ id, funcao: vaga.funcao, disciplina: vaga.disciplina, area: vaga.area, ondaId: bruta.onda_id, meta: bruta.meta, gestorId: bruta.gestor_id, candidato: vaga.candidato, dataInicio: bruta.data_inicio }}
            opcoes={{ ondas, gestores }}
            organizacao={projeto.organizacao}
            projetoId={projeto.id}
          />
        )}
      </div>

      {podeEditar && <Acoes vagaId={id} perfil="rh" etapaAtual={atual ? { ordem: atual.ordem, nome: atual.nome } : null} ultimaConcluida={ultima} admitida={vaga.situacao.admitida} hoje={hoje} />}

      <div className="overflow-x-auto rounded-xl border border-borda bg-superficie">
        <table className="w-full text-left text-[15px]">
          <thead>
            <tr className="border-b border-borda bg-superficie-2 text-sm text-texto-suave">
              <th className="px-4 py-2.5 font-medium">Etapa</th>
              <th className="px-4 py-2.5 font-medium">Previsto</th>
              <th className="px-4 py-2.5 font-medium">Concluída em</th>
            </tr>
          </thead>
          <tbody>
            {p.etapas.map((e) => (
              <tr key={e.ordem} className={`border-b border-borda last:border-0 ${e.ordem === p.etapaAtual ? 'bg-primaria-suave font-semibold' : ''}`}>
                <td className="px-4 py-2.5">{e.ordem}. {e.nome}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{e.inicio === e.fim ? ddmm(e.inicio) : `${ddmm(e.inicio)} a ${ddmm(e.fim)}`}</td>
                <td className="px-4 py-2.5">{e.concluidaEm ? dataBR(e.concluidaEm) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <HistoricoVaga historico={historico ?? []} />
    </div>
  )
}
