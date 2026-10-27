import { useId, type SelectHTMLAttributes } from 'react'
import { classeControle } from './Campo'

export function Selecao({
  rotulo,
  erro,
  opcoes,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  rotulo: string
  erro?: string
  opcoes: { valor: string; rotulo: string }[]
}) {
  const id = useId()
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-texto-suave">{rotulo}</label>
      <select id={id} aria-invalid={erro ? true : undefined} {...props} className={classeControle}>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>{o.rotulo}</option>
        ))}
      </select>
      {erro && <p className="text-sm text-[var(--st-reprovada-texto)]">{erro}</p>}
    </div>
  )
}
