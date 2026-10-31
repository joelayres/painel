// Formato das rotas de leitura que o Financeiro chama. Mude nos três repositórios ao mesmo tempo.
export type ColaboradorHe = {
  matricula: string; nome: string; cargo: string | null; planta: string
  dataAdmissao: string | null; dataDesligamento: string | null // YYYY-MM-DD
  linha: string | null // linha da tarifa da medição vigente hoje (tarifas_medicao), ou null
}
export type RespostaColaboradores = { versao: 1; colaboradores: ColaboradorHe[] }

export type ProjetoPainel = { id: string; nome: string; cliente: string; encerrado: boolean }
export type VagaPainelFinanceiro = {
  id: string; projetoId: string; funcao: string; disciplina: string; area: string
  onda: string | null; candidato: string | null
  dataMobilizacao: string // previsao.conclusaoEstimada: prevista, ou real quando já mobilizada
  admitida: boolean; mobilizada: boolean
}
export type RespostaVagas = { versao: 1; projetos: ProjetoPainel[]; vagas: VagaPainelFinanceiro[] }
