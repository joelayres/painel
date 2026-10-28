export function ErroGeral({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null
  return (
    <p role="alert" className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--st-reprovada-fundo)', color: 'var(--st-reprovada-texto)' }}>
      {mensagem}
    </p>
  )
}
