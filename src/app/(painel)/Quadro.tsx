import type { EtapaDef } from '@/dominio/etapas'
import { porEtapa, type VagaPainel } from '@/dominio/painel'
import { CartaoVaga } from './CartaoVaga'

// Uma coluna por etapa; no celular as colunas rolam na horizontal.
export function Quadro({ vagas, etapas }: { vagas: VagaPainel[]; etapas: EtapaDef[] }) {
  const grupos = porEtapa(vagas)
  const mobilizadas = vagas.filter((v) => v.situacao.mobilizada).length
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <div className="flex gap-3">
        {etapas.map((e) => {
          const lista = grupos.get(e.ordem) ?? []
          const titulo = `${e.nome} (${lista.length})`
          return (
            <section key={e.ordem} aria-label={titulo} className="w-56 shrink-0 rounded-xl bg-superficie-2 p-2">
              <h3 className="mb-2 px-1 text-sm font-semibold text-texto-suave">
                <span className="mr-1 text-texto">{e.ordem}.</span>
                {e.nome} <span className="text-texto">({lista.length})</span>
              </h3>
              <div className="flex flex-col gap-2">{lista.map((v) => <CartaoVaga key={v.id} vaga={v} />)}</div>
            </section>
          )
        })}
        <section aria-label={`Mobilizadas (${mobilizadas})`} className="w-40 shrink-0 rounded-xl bg-superficie-2 p-3">
          <h3 className="text-sm font-semibold text-texto-suave">Mobilizadas</h3>
          <p className="mt-2 font-titulo text-4xl font-semibold">{mobilizadas}</p>
        </section>
      </div>
    </div>
  )
}
