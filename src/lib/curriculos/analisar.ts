import 'server-only'
import { analisarCurriculo, ErroAnalise } from '@/lib/curriculos/ia'
import { VERSAO_PROMPT } from '@/lib/curriculos/pedido'
import { rpcLivre } from '@/lib/curriculos/rpc'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { traduzirErro } from '@/lib/validacao/mensagens'

export type ResultadoAnaliseParticipacao = { ok: true; situacao: 'analisada' | 'repetida' } | { ok: false; erro: string }

// Uma análise por chamada (a tela conduz a fila). A permissão é conferida com a sessão; o resultado
// da IA é gravado pelo servidor, que é o único que pode gravá-lo.
export async function analisarParticipacao(nomeUsuario: string, participacaoId: string): Promise<ResultadoAnaliseParticipacao> {
  const sb = await criarClienteServidor()
  const inicio = await rpcLivre<{ caminho: string; nome_arquivo: string; descritivo: string }[]>(sb, 'iniciar_analise', { p_participacao: participacaoId })
  if (inicio.error || !inicio.data?.[0]) return { ok: false, erro: traduzirErro(inicio.error?.message ?? '', 'Não foi possível iniciar a análise.') }
  const { caminho, descritivo } = inicio.data[0]
  const admin = criarClienteAdmin()

  try {
    const arquivo = await sb.storage.from('curriculos').download(caminho)
    if (arquivo.error || !arquivo.data) throw new ErroAnalise('Não foi possível ler o arquivo enviado.')
    const r = await analisarCurriculo(Buffer.from(await arquivo.data.arrayBuffer()), descritivo)
    const { data, error } = await rpcLivre<'analisada' | 'repetida'>(admin, 'registrar_analise', {
      p_participacao: participacaoId,
      p: {
        modelo: r.modelo,
        versao_prompt: VERSAO_PROMPT,
        nota: r.analise.nota,
        classificacao: r.analise.classificacao,
        resposta: r.analise,
        tokens_entrada: r.tokensEntrada,
        tokens_saida: r.tokensSaida,
        nome_usuario: nomeUsuario,
        candidato: r.analise.candidato,
      },
    })
    if (error || !data) throw new ErroAnalise('Não foi possível gravar a análise.')
    return { ok: true, situacao: data }
  } catch (e) {
    const erro = e instanceof ErroAnalise ? e.message : 'Falha inesperada na análise.'
    await rpcLivre(admin, 'falhar_analise', { p_participacao: participacaoId, p_erro: erro })
    return { ok: false, erro }
  }
}
