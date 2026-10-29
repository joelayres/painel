// Mensagens das funções do banco para a tela (as ações de uma vaga e as de vagas em grupo usam as mesmas).
export const MENSAGENS: [string, string][] = [
  ['etapa mudou', 'Esta vaga mudou enquanto você olhava. Atualize a página.'],
  ['data antes da etapa anterior', 'A data não pode ser antes da conclusão da etapa anterior.'],
  ['data no futuro', 'A data não pode ser no futuro.'],
  ['vaga cancelada', 'Esta vaga foi cancelada.'],
  ['data antes do início da vaga', 'A data não pode ser antes do início do processo da vaga.'],
  ['data antes da retomada', 'A data não pode ser antes da desistência do candidato anterior.'],
  ['vaga já admitida', 'A vaga já passou da admissão; não volta para a captura.'],
  ['sem permissão', 'Você não tem acesso a este projeto.'],
  ['projeto encerrado', 'Este projeto está encerrado. Reabra para alterar.'],
  ['etapa obrigatória', 'Esta etapa é obrigatória e não pode ser excluída nem renomeada.'],
  ['onda de outro projeto', 'Esta onda não é deste projeto.'],
  ['meta obrigatória', 'Informe a meta.'],
  ['onda obrigatória', 'Escolha a onda.'],
]

export function traduzirErro(mensagem: string, padrao: string): string {
  return MENSAGENS.find(([chave]) => mensagem.includes(chave))?.[1] ?? padrao
}
