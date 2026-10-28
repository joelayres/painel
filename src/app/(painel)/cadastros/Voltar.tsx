import Link from 'next/link'

export function Voltar({ titulo }: { titulo: string }) {
  return (
    <div className="mb-4">
      <Link href="/cadastros" className="text-sm font-medium text-primaria hover:underline">← Cadastros</Link>
      <h2 className="mt-1 font-titulo text-2xl font-semibold">{titulo}</h2>
    </div>
  )
}
