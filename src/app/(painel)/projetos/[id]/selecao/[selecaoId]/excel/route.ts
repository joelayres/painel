import { hojeSP } from '@/dominio/tempo'
import { PARECERES, RESULTADOS, TIPOS_ENTREVISTA, rotuloClassificacao, separarAbas } from '@/dominio/selecao'
import { ehEquipe, obterSessao } from '@/lib/auth/perfil'
import { gerarExcelSelecao } from '@/lib/curriculos/excel'
import { nomeArquivo } from '@/lib/formato/arquivo'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { ehUuid } from '@/lib/validacao/vaga'
import { carregarSelecao } from '../dados'

const naoEncontrado = () => new Response('Não encontrado.', { status: 404 })

// A seleção em Excel, só para a equipe; o RLS decide quem vê a seleção.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; selecaoId: string }> }) {
  const { id, selecaoId } = await params
  if (!ehUuid(id) || !ehUuid(selecaoId)) return naoEncontrado()
  const sessao = await obterSessao()
  if (!sessao || !ehEquipe(sessao.perfil)) return naoEncontrado()
  const sb = await criarClienteServidor()
  const dados = await carregarSelecao(sb, selecaoId)
  if (!dados || dados.selecao.projeto_id !== id) return naoEncontrado()
  const { data: projeto } = await sb.from('projetos').select('nome').eq('id', id).maybeSingle()

  const linhas = dados.participacoes.map((p) => ({
    id: p.id, nome: p.candidato?.nome ?? p.curriculo.nome_arquivo, nota: p.analises[0]?.nota ?? null,
    classificacao: p.classificacao, situacao: p.situacao, resultado: p.resultado, resumo: p.analises[0]?.resposta.resumo ?? null, p,
  }))
  const abas = separarAbas(linhas)
  const ordem = [...abas.aderentes, ...abas.aConfirmar, ...abas.naoAderentes]
  const hoje = hojeSP()
  const arquivo = await gerarExcelSelecao({
    projeto: projeto?.nome ?? '',
    funcao: dados.selecao.funcao,
    hoje,
    linhas: ordem.map((l) => ({
      nome: l.nome,
      email: l.p.candidato?.email ?? null,
      telefone: l.p.candidato?.telefone ?? null,
      nota: l.nota,
      classificacao: l.classificacao ? rotuloClassificacao(l.classificacao) : '',
      resumo: l.resumo ?? '',
      entrevistas: l.p.entrevistas.map((e) => `${TIPOS_ENTREVISTA[e.tipo]}: ${PARECERES[e.parecer]}`).join('; '),
      resultado: RESULTADOS[l.resultado],
    })),
  })
  return new Response(new Uint8Array(arquivo), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="selecao-${nomeArquivo(dados.selecao.funcao)}-${hoje}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
