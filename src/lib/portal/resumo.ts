// Formato do resumo que cada sistema entrega ao Portal da Gestão.
// Arquivo idêntico no HE, no Painel e no portal: mude nos três ao mesmo tempo.
// nota: linha curta embaixo do número (ex.: "R$ 1.234,56", "+1 em risco"), já formatada por quem envia.
export type Indicador = { rotulo: string; valor: number; unidade: 'minutos' | 'reais' | 'quantidade'; estimado?: boolean; cor?: 'vermelho' | 'amarelo'; nota?: string }
export type SecaoResumo = { titulo: string; indicadores: Indicador[] }
export type ResumoSistema = {
  versao: 1
  periodo?: { valor: string; rotulo: string; opcoes: { valor: string; rotulo: string }[] }
  // Até dois números para a faixa de destaques no topo do portal; secoes fica no "ver detalhes".
  destaques?: Indicador[]
  secoes: SecaoResumo[]
  alertas: string[]
}
