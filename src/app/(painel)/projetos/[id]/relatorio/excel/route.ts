import { filtrarVagas } from '@/dominio/painel'
import { montarRelatorio } from '@/dominio/relatorio'
import { hojeSP } from '@/dominio/tempo'
import { obterSessao } from '@/lib/auth/perfil'
import { buscarTarifasFinanceiro } from '@/lib/financeiro/tarifas'
import { nomeArquivo } from '@/lib/formato/arquivo'
import { carregarPainel } from '@/lib/painel/dados'
import { gerarExcelRelatorio } from '@/lib/relatorio/excel'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { ehUuid } from '@/lib/validacao/vaga'

const naoEncontrado = () => new Response('Não encontrado.', { status: 404 })

// O mesmo relatório da aba, em Excel. Qualquer perfil que vê o projeto baixa; o RLS decide quem vê.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!ehUuid(id)) return naoEncontrado()
  if (!(await obterSessao())) return naoEncontrado()
  const hoje = hojeSP()
  const [painel, tarifas] = await Promise.all([carregarPainel(await criarClienteServidor(), hoje, id), buscarTarifasFinanceiro()])
  if (!painel) return naoEncontrado()

  const porOndas = painel.projeto.organizacao === 'ondas'
  const pedida = new URL(req.url).searchParams.get('onda')
  const onda = porOndas ? painel.ondas.find((o) => o.id === pedida) : undefined
  const arquivo = await gerarExcelRelatorio({
    relatorio: montarRelatorio(filtrarVagas(painel.vagas, { onda: onda?.id }), painel.etapas, tarifas),
    projeto: painel.projeto.nome,
    onda: onda?.nome ?? null,
    porOndas,
    hoje,
  })
  return new Response(new Uint8Array(arquivo), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="relatorio-${nomeArquivo(painel.projeto.nome)}-${hoje}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
