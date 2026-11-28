import { NextResponse } from 'next/server'
import { ehEquipe, obterSessao } from '@/lib/auth/perfil'
import { analisarParticipacao } from '@/lib/curriculos/analisar'

export const dynamic = 'force-dynamic'
// Cada análise leva de 10 a 60 segundos.
export const maxDuration = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Rota (e não server action) porque o Next manda as server actions de uma aba uma de cada vez:
// por aqui as 3 análises simultâneas da fila rodam de fato ao mesmo tempo.
export async function POST(req: Request) {
  const sessao = await obterSessao()
  if (!sessao || !ehEquipe(sessao.perfil)) return NextResponse.json({ ok: false, erro: 'Sem permissão.' }, { status: 403 })
  const corpo = (await req.json().catch(() => null)) as { participacaoId?: unknown } | null
  const id = corpo?.participacaoId
  if (typeof id !== 'string' || !UUID.test(id)) return NextResponse.json({ ok: false, erro: 'Pedido inválido.' }, { status: 400 })
  return NextResponse.json(await analisarParticipacao(sessao.nome, id), { headers: { 'Cache-Control': 'no-store' } })
}
