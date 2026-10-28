import { filtrarVagas, resumirOndas, type Filtro } from '@/dominio/painel'
import { hojeSP } from '@/dominio/tempo'
import { dataBR } from '@/lib/formato/datas'
import { carregarPainel } from '@/lib/painel/dados'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { Atencao } from './Atencao'
import { CartoesOnda } from './CartoesOnda'
import { Filtros } from './Filtros'
import { Quadro } from './Quadro'

export const metadata = { title: 'Painel · Mobilização Braskem 2027' }

type Busca = { onda?: string; funcao?: string; area?: string; gestor?: string; candidato?: string }

export default async function Painel({ searchParams }: { searchParams: Promise<Busca> }) {
  const busca = await searchParams
  const hoje = hojeSP()
  const { vagas, etapas, ondas, gestores } = await carregarPainel(await criarClienteServidor(), hoje)
  const onda = busca.onda && /^[1-4]$/.test(busca.onda) ? Number(busca.onda) : undefined
  const filtro: Filtro = { funcao: busca.funcao, area: busca.area, gestorId: busca.gestor, candidato: busca.candidato }
  // Os cartões de onda mostram todas as ondas (com os outros filtros); o resto respeita também a onda.
  const semOnda = filtrarVagas(vagas, filtro)
  const filtradas = filtrarVagas(semOnda, { onda })
  const hrefDe = (n: number) => {
    const p = new URLSearchParams(Object.entries(busca).filter(([, v]) => v) as [string, string][])
    if (onda === n) p.delete('onda')
    else p.set('onda', String(n))
    const q = p.toString()
    return q ? `/?${q}` : '/'
  }
  const unicos = (lista: string[]) => [...new Set(lista)].sort((a, b) => a.localeCompare(b, 'pt-BR'))

  if (vagas.length === 0) {
    return <p className="rounded-xl border border-dashed border-borda p-8 text-center text-texto-suave">Nenhuma vaga cadastrada ainda.</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Filtros opcoes={{ ondas: ondas.map((o) => o.numero), funcoes: unicos(vagas.map((v) => v.funcao)), areas: unicos(vagas.map((v) => v.area)), gestores }} />
        <span className="text-sm text-texto-suave">Atualizado em {dataBR(hoje)}</span>
      </div>
      <CartoesOnda resumos={resumirOndas(semOnda, ondas)} hrefDe={hrefDe} ativa={onda} />
      <Atencao vagas={filtradas} />
      <Quadro vagas={filtradas} etapas={etapas} />
    </div>
  )
}
