// Formato do resumo que cada sistema entrega ao Portal da Gestão.
// Arquivo idêntico no HE, no Painel e no portal: mude nos três ao mesmo tempo.
export type Indicador = { rotulo: string; valor: number; unidade: 'minutos' | 'reais' | 'quantidade'; estimado?: boolean; cor?: 'vermelho' | 'amarelo' }
export type SecaoResumo = { titulo: string; indicadores: Indicador[] }
export type ResumoSistema = {
  versao: 1
  periodo?: { valor: string; rotulo: string; opcoes: { valor: string; rotulo: string }[] }
  secoes: SecaoResumo[]
  alertas: string[]
}
