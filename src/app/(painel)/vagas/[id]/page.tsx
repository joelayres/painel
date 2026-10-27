import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FormVaga } from '@/components/rh/FormVaga'
import { hojeSP } from '@/dominio/tempo'
import { exigirSessao } from '@/lib/auth/perfil'
import { dataBR, ddmm } from '@/lib/formato/datas'
import { carregarPainel } from '@/lib/painel/dados'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { COR_PRAZO, ROTULO_PRAZO } from '../../cores'
import { Acoes } from './Acoes'

export default async function DetalheVaga({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessao = await exigirSessao()
  const sb = await criarClienteServidor()
  const hoje = hojeSP()
  const { vagas, ondas, gestores } = await carregarPainel(sb, hoje)
  const vaga = vagas.find((v) => v.id === id)
  if (!vaga) notFound()
  const [{ data: bruta }, { data: historico }] = await Promise.all([
    sb.from('vagas').select('onda_id, gestor_id, data_inicio').eq('id', id).single(),
    sb.from('historico').select('id, nome_usuario, acao, em').eq('vaga_id', id).order('em', { ascending: false }),
  ])
  const p = vaga.previsao
  const atual = p.etapas.find((e) => e.ordem === p.etapaAtual) ?? null
  const ultima = [...p.etapas].reverse().find((e) => e.concluidaEm !== null)?.ordem ?? null
  const cor = vaga.situacao.cor

  return (
    <div className="flex flex-col gap-5">
      <Link href="/" className="text-sm font-medium text-primaria hover:underline">← Voltar ao painel</Link>
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-borda bg-superficie p-4">
        <div>
          <h2 className="font-titulo text-3xl font-semibold">{vaga.funcao}</h2>
          <p className="text-texto-suave">{vaga.disciplina} · {vaga.area} · {vaga.onda.numero}ª Onda (até {ddmm(vaga.onda.fim)})</p>
          <p className="mt-1">Gestor: {vaga.gestor?.nome ?? 'Sem gestor'} · Candidato: {vaga.candidato ?? 'ainda não definido'}</p>
          <p className="mt-2 text-sm">
            {cor && <span className="mr-2 font-semibold" style={{ color: COR_PRAZO[cor] }}>{ROTULO_PRAZO[cor]}</span>}
            Admissão prevista {dataBR(p.admissaoEstimada)} · Conclusão prevista {dataBR(p.conclusaoEstimada)}
          </p>
        </div>
        {sessao.perfil === 'rh' && bruta && (
          <FormVaga
            rotuloBotao="Editar vaga"
            vaga={{ id, funcao: vaga.funcao, disciplina: vaga.disciplina, area: vaga.area, ondaId: bruta.onda_id, gestorId: bruta.gestor_id, candidato: vaga.candidato, dataInicio: bruta.data_inicio }}
            opcoes={{ ondas, gestores }}
          />
        )}
      </div>

      <Acoes vagaId={id} perfil={sessao.perfil} etapaAtual={atual ? { ordem: atual.ordem, nome: atual.nome } : null} ultimaConcluida={ultima} hoje={hoje} />

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

      <section className="rounded-xl border border-borda bg-superficie p-4">
        <h3 className="font-titulo text-xl font-semibold">Histórico</h3>
        {historico?.length ? (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {historico.map((h) => (
              <li key={h.id}>
                <span className="text-texto-suave">{new Date(h.em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}</span> · {h.acao} · {h.nome_usuario}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-texto-suave">Nada registrado ainda.</p>
        )}
      </section>
    </div>
  )
}
