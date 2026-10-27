// Provisório até chegar o arquivo oficial da marca: símbolo de seis pétalas + "timenow".
const PETALAS = [0, 60, 120, 180, 240, 300]

export function SimboloTimenow({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      {PETALAS.map((angulo) => (
        <path key={angulo} d="M20 18 L16.5 6 L20 2 L23.5 6 Z" fill="currentColor" transform={`rotate(${angulo + 15} 20 20)`} />
      ))}
    </svg>
  )
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <SimboloTimenow className="size-7" />
      <span className="font-titulo text-[22px] leading-none font-medium tracking-tight">timenow</span>
    </span>
  )
}
