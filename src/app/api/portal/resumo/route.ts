import { NextResponse } from 'next/server'
import { usuarioDoPortal } from '@/lib/portal/entrada'
import { carregarResumoVagas } from '@/lib/portal/resumoVagas'
import { autorizadoPortal, segredoPortal } from '@/lib/portal/segredo'
import { criarClienteAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Chamada só pelo servidor do Portal da Gestão, com o segredo compartilhado.
export async function GET(req: Request) {
  const segredo = segredoPortal()
  if (!segredo) return new NextResponse(null, { status: 404 })
  if (!autorizadoPortal(req.headers.get('authorization'), segredo)) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 })
  const email = new URL(req.url).searchParams.get('email')?.trim().toLowerCase()
  if (!email) return NextResponse.json({ erro: 'consulta inválida' }, { status: 400 })
  try {
    const admin = criarClienteAdmin()
    const usuario = await usuarioDoPortal(admin, email)
    if (!usuario) return NextResponse.json({ erro: 'sem acesso' }, { status: 403 })
    return NextResponse.json(await carregarResumoVagas(admin, usuario), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('Resumo do portal falhou:', e instanceof Error ? e.message : e)
    return NextResponse.json({ erro: 'falha ao calcular' }, { status: 500 })
  }
}
