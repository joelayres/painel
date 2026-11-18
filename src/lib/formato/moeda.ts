const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// 24108.83 → "R$ 24.108,83"
export const reais = (valor: number): string => BRL.format(valor)
