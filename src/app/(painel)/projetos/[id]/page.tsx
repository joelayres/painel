import { notFound } from 'next/navigation'
import { filtrarVagas, resumirOndas, resumirProjeto, type Filtro } from '@/dominio/painel'
import { hojeSP } from '@/dominio/tempo'
import { dataBR } from '@/lib/formato/datas'
import { exigirSessao } from '@/lib/auth/perfil'
import { carregarPainel } from '@/lib/painel/dados'
import { ehUuid } from '@/lib/validacao/vaga'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { Atencao } from './Atencao'
import { CartoesOnda } from './CartoesOnda'
import { Filtros } from './Filtros'
import { Quadro } from './Quadro'

export const metadata = { title: 'Painel · Painel de Mobilização' }

type Busca = { onda?: string; funcao?: string; area?: string; gestor?: string; candidato?: string }


export default async function Painel({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Busca> }) {
  const { id } = await params
  if (!ehUuid(id)) notFound()
  const busca = await searchParams
  const sessao = await exigirSessao()
  const hoje = hojeSP()
  const painel = await carregarPainel(await criarClienteServidor(), hoje, id)
  if (!painel) notFound()
  const { projeto, vagas, etapas, ondas, gestores } = painel
  const porOndas = projeto.organizacao === 'ondas'
  const onda = porOndas && busca.onda && ondas.some((o) => o.id === busca.onda) ? busca.onda : undefined
  const filtro: Filtro = { funcao: busca.funcao, area: busca.area, gestorId: busca.gestor, candidato: busca.candidato }
  // Os cartões de onda mostram todas as ondas (com os outros filtros); o resto respeita também a onda.
  const semOnda = filtrarVagas(vagas, filtro)
  const filtradas = filtrarVagas(semOnda, { onda })
  const hrefDe = (ondaId: string) => {
    const p = new URLSearchParams(Object.entries(busca).filter(([, v]) => v) as [string, string][])
    if (onda === ondaId) p.delete('onda')
    else p.set('onda', ondaId)
    const q = p.toString()
    return q ? `/projetos/${id}?${q}` : `/projetos/${id}`
  }
  const unicos = (lista: string[]) => [...new Set(lista.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

  if (vagas.length === 0) {
    return <p className="rounded-xl border border-dashed border-borda p-8 text-center text-texto-suave">Nenhuma vaga cadastrada ainda.</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Filtros opcoes={{ ondas: porOndas ? ondas.map((o) => ({ id: o.id, nome: o.nome })) : [], funcoes: unicos(vagas.map((v) => v.funcao)), areas: unicos(vagas.map((v) => v.area)), gestores }} />
        <span className="text-sm text-texto-suave">Atualizado em {dataBR(hoje)}</span>
      </div>
      {porOndas ? (
        <CartoesOnda resumos={resumirOndas(semOnda, ondas)} hrefDe={hrefDe} ativa={onda} />
      ) : (
        <CartoesOnda resumos={[{ ...resumirProjeto(semOnda), nome: 'Todas as vagas' }]} />
      )}
      <Atencao vagas={filtradas} />
      <Quadro vagas={filtradas} etapas={etapas} podeArrastar={sessao.perfil === 'rh' && !projeto.encerrado} />
    </div>
  )
}
