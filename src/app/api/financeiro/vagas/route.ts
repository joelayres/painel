import { NextResponse } from 'next/server'
import { hojeSP } from '@/dominio/tempo'
import { autorizado, segredoFinanceiro } from '@/lib/financeiro/segredo'
import { carregarVagasFinanceiro } from '@/lib/financeiro/vagas'
import { criarClienteAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Chamada só pelo servidor do Financeiro, com o segredo compartilhado.
export async function GET(req: Request) {
  const segredo = segredoFinanceiro()
  if (!segredo) return new NextResponse(null, { status: 404 })
  if (!autorizado(req.headers.get('authorization'), segredo)) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 })
  const projetos = new URL(req.url).searchParams.getAll('projeto')
  if (projetos.some((p) => !UUID.test(p))) return NextResponse.json({ erro: 'consulta inválida' }, { status: 400 })
  try {
    return NextResponse.json(await carregarVagasFinanceiro(criarClienteAdmin(), projetos, hojeSP()), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('Leitura para o Financeiro falhou:', e instanceof Error ? e.message : e)
    return NextResponse.json({ erro: 'falha ao ler' }, { status: 500 })
  }
}
