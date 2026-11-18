import { hojeSP } from '@/dominio/tempo'
import { ehEquipe, obterSessao } from '@/lib/auth/perfil'
import { nomeArquivo } from '@/lib/formato/arquivo'
import { gerarModelo } from '@/lib/importacao/modelo'
import { carregarPainel } from '@/lib/painel/dados'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { ehUuid } from '@/lib/validacao/vaga'

const naoEncontrado = () => new Response('Não encontrado.', { status: 404 })

// Só a equipe (Administrador e Analista de RH) baixa o modelo; para os outros, a rota não existe.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!ehUuid(id)) return naoEncontrado()
  const sessao = await obterSessao()
  if (!sessao || !ehEquipe(sessao.perfil)) return naoEncontrado()
  const painel = await carregarPainel(await criarClienteServidor(), hojeSP(), id)
  if (!painel) return naoEncontrado()

  const arquivo = await gerarModelo({
    organizacao: painel.projeto.organizacao,
    ondas: painel.ondas.map((o) => o.nome),
    gestores: painel.gestores.map((g) => g.nome),
    etapas: painel.etapas,
  })
  return new Response(new Uint8Array(arquivo), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="modelo-${nomeArquivo(painel.projeto.nome)}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
