import type { ButtonHTMLAttributes } from 'react'

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma'

const estilos: Record<Variante, string> = {
  primario: 'bg-primaria text-primaria-texto hover:bg-primaria-forte',
  secundario: 'border border-primaria text-primaria bg-superficie hover:bg-primaria-suave',
  perigo: 'border border-[var(--st-reprovada-texto)] text-[var(--st-reprovada-texto)] bg-superficie hover:bg-[var(--st-reprovada-fundo)]',
  fantasma: 'text-primaria hover:bg-primaria-suave',
}

export function Botao({
  variante = 'primario',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco disabled:cursor-not-allowed disabled:opacity-50 ${estilos[variante]} ${className}`}
    />
  )
}
