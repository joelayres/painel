// Formato da rota de leitura que o Efetivo (Portal) chama. Mude nos dois repositórios ao mesmo tempo.
export type VagaAdmitida = { id: string; projetoId: string; candidato: string; funcao: string }
export type ProjetoEfetivo = { id: string; nome: string; encerrado: boolean }
export type RespostaVagasEfetivo = { versao: 1; projetos: ProjetoEfetivo[]; vagas: VagaAdmitida[] }
