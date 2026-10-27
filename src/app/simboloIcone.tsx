// Símbolo de seis pétalas da Timenow em branco sobre o verde, para os ícones do app.
const PETALAS = [0, 60, 120, 180, 240, 300]

export function SimboloIcone({ tamanho }: { tamanho: number }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2b6157' }}>
      <svg width={tamanho * 0.62} height={tamanho * 0.62} viewBox="0 0 40 40">
        {PETALAS.map((a) => (
          <path key={a} d="M20 18 L16.5 6 L20 2 L23.5 6 Z" fill="#ffffff" transform={`rotate(${a + 15} 20 20)`} />
        ))}
      </svg>
    </div>
  )
}
