import { useId, type InputHTMLAttributes } from 'react'

export const classeControle =
  'w-full min-h-11 rounded-lg border border-borda bg-superficie px-3 text-texto placeholder:text-texto-suave/70 focus:border-primaria focus:outline-2 focus:outline-offset-0 focus:outline-primaria/30 aria-[invalid=true]:border-[var(--st-reprovada-texto)]'

export function Campo({
  rotulo,
  dica,
  erro,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { rotulo: string; dica?: string; erro?: string }) {
  const id = useId()
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-texto-suave">{rotulo}</label>
      <input id={id} aria-invalid={erro ? true : undefined} aria-describedby={erro || dica ? `${id}-msg` : undefined} {...props} className={classeControle} />
      {(erro || dica) && (
        <p id={`${id}-msg`} className={`text-sm ${erro ? 'text-[var(--st-reprovada-texto)]' : 'text-texto-suave'}`}>{erro ?? dica}</p>
      )}
    </div>
  )
}
