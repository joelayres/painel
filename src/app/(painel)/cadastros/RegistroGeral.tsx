import { dataBR } from '@/lib/formato/datas'

export type ItemRegistro = { id: string; acao: string; nome: string; em: string; detalhe: unknown }
type Periodo = { inicio: string; fim: string }

// Complemento legível do detalhe gravado pelas funções do banco (durações e ondas).
function complemento(d: unknown): string {
  if (!d || typeof d !== 'object') return ''
  const { antes, depois, cliente, projeto } = d as { antes?: unknown; depois?: unknown; cliente?: unknown; projeto?: unknown }
  if (typeof antes === 'number' && typeof depois === 'number') {
    // A duração é do cliente ou de um projeto: o nome vai junto.
    const dono = typeof cliente === 'string' ? ` (cliente ${cliente})` : typeof projeto === 'string' ? ` (projeto ${projeto})` : ''
    return `${dono}: de ${antes} para ${depois} dias`
  }
  if (antes && depois && typeof antes === 'object' && typeof depois === 'object') {
    const a = antes as Periodo
    const b = depois as Periodo
    const partes = [
      a.inicio !== b.inicio && `início de ${dataBR(a.inicio)} para ${dataBR(b.inicio)}`,
      a.fim !== b.fim && `fim de ${dataBR(a.fim)} para ${dataBR(b.fim)}`,
    ].filter(Boolean)
    return partes.length ? `: ${partes.join(', ')}` : ''
  }
  return ''
}

export function RegistroGeral({ itens }: { itens: ItemRegistro[] }) {
  return (
    <section className="rounded-xl border border-borda bg-superficie p-4">
      <h3 className="font-titulo text-xl font-semibold">Registro geral</h3>
      {itens.length === 0 ? (
        <p className="mt-2 text-sm text-texto-suave">Nenhuma mudança registrada ainda.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {itens.map((i) => (
            <li key={i.id}>
              <span className="text-texto-suave">{new Date(i.em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}</span>
              {' · '}{i.acao}{complemento(i.detalhe)}{' · '}{i.nome}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
