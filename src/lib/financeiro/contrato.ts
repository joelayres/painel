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

// Formato da rota /api/painel/tarifas do Financeiro, que o relatório do projeto lê. Mude nos dois repositórios ao mesmo tempo.
export type TarifaVaga = {
  painelVagaId: string
  tipo: 'MOD' | 'MOI'
  cobrada: boolean // false para MOI e "não cobrar"
  linha: string | null // null = vaga sem linha cadastrada
  descricao: string | null // descrição da linha na tabela de tarifas
  valor: number | null // tarifa vigente no mês; null se não cobrada, sem linha ou sem vigência
}
export type RespostaTarifasVagas = { versao: 1; vagas: TarifaVaga[] }
