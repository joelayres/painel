// As 13 etapas da mobilização, com a duração padrão em dias úteis (o RH pode mudar a duração no cadastro).
export type EtapaDef = { ordem: number; nome: string; duracao: number }

export const ETAPAS_PADRAO: EtapaDef[] = [
  { ordem: 1, nome: 'Abertura de vaga', duracao: 1 },
  { ordem: 2, nome: 'Captura de Mercado', duracao: 4 },
  { ordem: 3, nome: 'Triagem de Candidatos', duracao: 1 },
  { ordem: 4, nome: 'Entrevista - Timenow', duracao: 1 },
  { ordem: 5, nome: 'Entrevista - TNGO/Braskem', duracao: 1 },
  { ordem: 6, nome: 'Envio para contratação', duracao: 0 },
  { ordem: 7, nome: 'Agendamento exames', duracao: 2 },
  { ordem: 8, nome: 'Realização de Exames', duracao: 1 },
  { ordem: 9, nome: 'Liberação dos exames', duracao: 7 },
  { ordem: 10, nome: 'Ambientação/TBS', duracao: 1 },
  { ordem: 11, nome: 'Admissão Timenow', duracao: 0 },
  { ordem: 12, nome: 'Atualização da CTPS', duracao: 3 },
  { ordem: 13, nome: 'Treinamento', duracao: 5 },
]

// O prazo da onda é a admissão; a captura é para onde a vaga volta quando o candidato desiste.
export const ETAPA_ADMISSAO = 11
export const ETAPA_CAPTURA = 2

// Durações efetivas de um projeto: a do projeto vale mais que a do cliente, que vale mais que a padrão.
export function etapasDoProjeto(base: EtapaDef[], doCliente: ReadonlyMap<number, number>, doProjeto: ReadonlyMap<number, number>): EtapaDef[] {
  return base.map((e) => ({ ...e, duracao: doProjeto.get(e.ordem) ?? doCliente.get(e.ordem) ?? e.duracao }))
}
