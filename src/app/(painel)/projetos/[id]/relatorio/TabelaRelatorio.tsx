import Link from 'next/link'
import type { ColunaOrdem, LinhaRelatorio, Relatorio, VisaoRelatorio } from '@/dominio/relatorio'
import { dataBR } from '@/lib/formato/datas'
import { reais } from '@/lib/formato/moeda'

// Função, Disciplina e Área ordenam pelo título: o primeiro clique ordena de A a Z, o seguinte inverte.
const ORDENAVEIS: Record<string, ColunaOrdem> = { Função: 'funcao', Disciplina: 'disciplina', Área: 'area' }

// O cabeçalho é a faixa da marca e fica fixo no topo da caixa; a coluna Nome fica fixa ao rolar para o lado.
const th = 'sticky top-0 z-10 bg-faixa px-3 py-3 text-left align-bottom text-sm font-semibold whitespace-nowrap text-faixa-texto'
const thNome = 'left-0 z-20'
const td = 'border-b border-borda px-3 py-2 align-middle'

const etiqueta = (texto: string, fundo: string, cor: string) => (
  <span className="inline-block rounded-md px-1.5 py-0.5 text-xs font-semibold" style={{ background: `var(${fundo})`, color: `var(${cor})` }}>{texto}</span>
)

function Tipo({ tipo }: { tipo: LinhaRelatorio['tipo'] }) {
  if (tipo === 'MOI') return etiqueta('MOI', '--st-reaprovacao-fundo', '--st-reaprovacao-texto')
  if (tipo === 'MOD') return etiqueta('MOD', '--st-conferencia-fundo', '--st-conferencia-texto')
  return <span className="text-texto-suave">—</span>
}

// OK de etapa no verde claro; o da coluna Mobilizado no verde cheio, que é o resultado que o cliente acompanha.
function Ok({ forte = false }: { forte?: boolean }) {
  return (
    <span
      className="inline-flex min-w-9 justify-center rounded-full px-2 py-0.5 text-xs font-bold"
      style={forte ? { background: 'var(--prazo-verde)', color: '#fff' } : { background: 'var(--st-finalizada-fundo)', color: 'var(--st-finalizada-texto)' }}
    >
      OK
    </span>
  )
}
const Pendente = () => <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-borda" />

export function TabelaRelatorio({ relatorio: r, porOndas, visao, hrefOrdem }: {
  relatorio: Relatorio
  porOndas: boolean
  visao: VisaoRelatorio
  hrefOrdem: (coluna: ColunaOrdem, sentido: 'asc' | 'desc') => string
}) {
  const fixas = ['Nome', 'Tipo', 'Função', 'Disciplina', 'Área', 'Gestor', ...(porOndas ? ['Onda'] : []), 'Data final', 'Taxa']
  const cabecalho = (titulo: string) => {
    const classe = `${th} ${titulo === 'Nome' ? thNome : ''} ${titulo === 'Taxa' ? 'text-right' : ''}`
    const coluna = ORDENAVEIS[titulo]
    if (!coluna) return <th key={titulo} scope="col" className={classe}>{titulo}</th>
    const ativa = visao.ordem === coluna
    const desc = ativa && visao.sentido === 'desc'
    return (
      <th key={titulo} scope="col" className={classe} aria-sort={ativa ? (desc ? 'descending' : 'ascending') : undefined}>
        <Link href={hrefOrdem(coluna, ativa && !desc ? 'desc' : 'asc')} className="inline-flex items-center gap-1 rounded underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-foco">
          {titulo}
          {ativa && <span aria-hidden="true" className="text-xs">{desc ? '▼' : '▲'}</span>}
        </Link>
      </th>
    )
  }
  const celula = `${td} group-hover:bg-superficie-2`

  return (
    <div className="max-h-[70vh] overflow-auto rounded-2xl border border-borda bg-superficie">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {fixas.map(cabecalho)}
            {[...r.etapas.map((e) => ({ chave: String(e.ordem), nome: e.nome })), ...(r.colunaMobilizado ? [{ chave: 'mobilizado', nome: 'Mobilizado' }] : [])].map((e) => (
              <th key={e.chave} scope="col" className={`${th} w-20 min-w-20 px-2 text-center whitespace-normal`}>
                <span className="font-titulo text-[15px] leading-tight font-semibold">{e.nome}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.linhas.length === 0 ? (
            <tr>
              <td colSpan={fixas.length + r.etapas.length + (r.colunaMobilizado ? 1 : 0)} className="px-3 py-10 text-center text-texto-suave">
                <p className="font-medium text-texto">Nenhuma vaga</p>
                <p className="mt-1">Mude ou limpe os filtros para ver as vagas do projeto.</p>
              </td>
            </tr>
          ) : r.linhas.map((l) => (
            <tr key={l.id} data-mobilizada={l.mobilizada ? 'true' : undefined} className="group">
              {/* A barra verde à esquerda marca a vaga mobilizada. */}
              <td
                className={`${celula} sticky left-0 z-[1] min-w-48 bg-superficie`}
                style={{ boxShadow: l.mobilizada ? 'inset 4px 0 0 var(--prazo-verde)' : undefined }}
              >
                <span className={`block ${l.vagaAberta ? 'text-texto-suave' : 'font-semibold'}`}>{l.nome}</span>
                {l.vagaAberta && <span className="mt-0.5 block">{etiqueta('vaga aberta', '--st-pendente-fundo', '--st-pendente-texto')}</span>}
              </td>
              <td className={celula}><Tipo tipo={l.tipo} /></td>
              <td className={`${celula} min-w-36 max-w-52`}>{l.funcao}</td>
              <td className={`${celula} min-w-36 max-w-56 text-[13px] leading-snug`}>{l.disciplina}</td>
              <td className={celula}>{l.area}</td>
              <td className={`${celula} whitespace-nowrap`}>{l.gestor ?? <span className="text-texto-suave">—</span>}</td>
              {porOndas && <td className={`${celula} whitespace-nowrap text-texto-suave`}>{l.onda ?? '—'}</td>}
              <td className={`${celula} whitespace-nowrap tabular-nums`}>{dataBR(l.meta)}</td>
              <td className={`${celula} text-right whitespace-nowrap tabular-nums`}>
                {!l.cobrada ? <span className="text-xs text-texto-suave">Não cobrada</span> : l.taxa === null ? <span className="text-texto-suave">—</span> : <span className="font-medium">{reais(l.taxa)}</span>}
              </td>
              {l.etapas.map((data, i) => (
                <td key={r.etapas[i].ordem} className={`${celula} px-2 text-center`} title={data ? `Concluída em ${dataBR(data)}` : undefined}>
                  {data ? <Ok /> : <Pendente />}
                </td>
              ))}
              {r.colunaMobilizado && (
                <td className={`${celula} px-2 text-center`} title={l.mobilizada && l.mobilizadaEm ? `Mobilizada em ${dataBR(l.mobilizadaEm)}` : undefined}>
                  {l.mobilizada ? <Ok forte /> : <Pendente />}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
