// As 13 etapas da mobilização, com a duração padrão em dias úteis (o RH pode mudar a duração no cadastro).
// Duas etapas são fixas: a captura (para onde a vaga volta na desistência) e a admissão (o prazo da onda).
export type EtapaFixa = 'captura' | 'admissao'
export type EtapaDef = { id: string; ordem: number; nome: string; duracao: number; fixa: EtapaFixa | null }

export const ETAPAS_PADRAO: EtapaDef[] = [
  { id: 'padrao-1', ordem: 1, nome: 'Abertura de vaga', duracao: 1, fixa: null },
  { id: 'padrao-2', ordem: 2, nome: 'Captura de Mercado', duracao: 4, fixa: 'captura' },
  { id: 'padrao-3', ordem: 3, nome: 'Triagem de Candidatos', duracao: 1, fixa: null },
  { id: 'padrao-4', ordem: 4, nome: 'Entrevista - Timenow', duracao: 1, fixa: null },
  { id: 'padrao-5', ordem: 5, nome: 'Entrevista - TNGO/Braskem', duracao: 1, fixa: null },
  { id: 'padrao-6', ordem: 6, nome: 'Envio para contratação', duracao: 0, fixa: null },
  { id: 'padrao-7', ordem: 7, nome: 'Agendamento exames', duracao: 2, fixa: null },
  { id: 'padrao-8', ordem: 8, nome: 'Realização de Exames', duracao: 1, fixa: null },
  { id: 'padrao-9', ordem: 9, nome: 'Liberação dos exames', duracao: 7, fixa: null },
  { id: 'padrao-10', ordem: 10, nome: 'Ambientação/TBS', duracao: 1, fixa: null },
  { id: 'padrao-11', ordem: 11, nome: 'Admissão Timenow', duracao: 0, fixa: 'admissao' },
  { id: 'padrao-12', ordem: 12, nome: 'Atualização da CTPS', duracao: 3, fixa: null },
  { id: 'padrao-13', ordem: 13, nome: 'Treinamento', duracao: 5, fixa: null },
]

// Uma linha da lista de etapas do projeto, como está no banco. `padrao` aponta a etapa padrão de origem (1..13).
export type LinhaEtapaProjeto = { id: string; posicao: number; nome: string; duracao: number | null; padrao: number | null; fixa: EtapaFixa | null }

// Etapas efetivas do projeto: a duração da linha vale mais que a do cliente, que vale mais que a padrão.
export function etapasDoProjeto(linhas: LinhaEtapaProjeto[], doCliente: ReadonlyMap<number, number>): EtapaDef[] {
  const lista = [...linhas].sort((a, b) => a.posicao - b.posicao)
  if (lista.some((l, i) => l.posicao !== i + 1)) throw new Error('As posições das etapas do projeto precisam ser 1..N, sem buracos.')
  const posicaoDe = (fixa: EtapaFixa) => lista.find((l) => l.fixa === fixa)?.posicao
  const captura = posicaoDe('captura')
  const admissao = posicaoDe('admissao')
  if (captura === undefined || admissao === undefined) throw new Error('O projeto precisa das etapas fixas de captura e de admissão.')
  if (captura > admissao) throw new Error('A captura precisa vir antes da admissão.')
  return lista.map((l) => ({
    id: l.id,
    ordem: l.posicao,
    nome: l.nome,
    duracao: l.duracao ?? (l.padrao !== null ? (doCliente.get(l.padrao) ?? ETAPAS_PADRAO[l.padrao - 1].duracao) : 0),
    fixa: l.fixa,
  }))
}
