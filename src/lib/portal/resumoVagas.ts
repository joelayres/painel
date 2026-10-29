// Resumo de vagas para o Portal da Gestão: só os projetos abertos que a pessoa vê no Painel,
// com os mesmos totais dos cartões da lista de projetos.
import type { SupabaseClient } from '@supabase/supabase-js'
import { hojeSP } from '@/dominio/tempo'
import { carregarProjetos, type CartaoProjeto } from '@/lib/painel/dados'
import type { Database } from '@/lib/supabase/tipos'
import type { UsuarioPortal } from './entrada'
import type { ResumoSistema, SecaoResumo } from './resumo'

type Admin = SupabaseClient<Database>
type Visiveis = Set<string> | 'todos'

// A regra de pode_ver_projeto, para quem não está logado aqui: o RH vê tudo; os outros, o que foi liberado.
export async function projetosVisiveis(admin: Admin, usuario: UsuarioPortal): Promise<Visiveis> {
  if (usuario.perfil === 'rh') return 'todos'
  const { data, error } = await admin.from('projeto_acessos').select('projeto_id').eq('usuario_id', usuario.id)
  if (error) throw new Error(`Não foi possível ler os projetos liberados: ${error.message}`)
  return new Set((data ?? []).map((a) => a.projeto_id))
}

function secao(titulo: string, resumos: CartaoProjeto['resumo'][]): SecaoResumo {
  const soma = (campo: 'total' | 'admitidas' | 'mobilizadas' | 'vermelho' | 'amarelo') => resumos.reduce((s, r) => s + r[campo], 0)
  return {
    titulo,
    indicadores: [
      { rotulo: 'Vagas', valor: soma('total'), unidade: 'quantidade' },
      { rotulo: 'Admitidas', valor: soma('admitidas'), unidade: 'quantidade' },
      { rotulo: 'Mobilizadas', valor: soma('mobilizadas'), unidade: 'quantidade' },
      { rotulo: 'Vermelhas', valor: soma('vermelho'), unidade: 'quantidade', cor: 'vermelho' },
      { rotulo: 'Amarelas', valor: soma('amarelo'), unidade: 'quantidade', cor: 'amarelo' },
    ],
  }
}

const vagas = (n: number, texto: string) => `${n} ${n === 1 ? 'vaga' : 'vagas'} ${texto}`

export function resumirVagas(cartoes: CartaoProjeto[], visiveis: Visiveis): ResumoSistema {
  const meus = cartoes.filter((c) => !c.encerrado && (visiveis === 'todos' || visiveis.has(c.id)))
  const porProjeto = meus.length > 1 ? meus.map((c) => secao(`${c.cliente.nome} · ${c.nome}`, [c.resumo])) : []
  const total = (campo: 'total' | 'admitidas' | 'vermelho' | 'amarelo') => meus.reduce((s, c) => s + c.resumo[campo], 0)
  const admitidas = total('admitidas')
  return {
    versao: 1,
    destaques: [
      { rotulo: 'Vagas abertas', valor: total('total'), unidade: 'quantidade', nota: `${admitidas} ${admitidas === 1 ? 'admitida' : 'admitidas'}` },
      { rotulo: 'Vagas em atraso', valor: total('vermelho'), unidade: 'quantidade', cor: 'vermelho', nota: `+${total('amarelo')} em risco` },
    ],
    secoes: [secao('Total', meus.map((c) => c.resumo)), ...porProjeto],
    alertas: [
      ...(total('vermelho') ? [vagas(total('vermelho'), 'em atraso')] : []),
      ...(total('amarelo') ? [vagas(total('amarelo'), 'em risco')] : []),
    ],
  }
}

// Cliente admin lê todos os projetos; o filtro de visibilidade é aplicado aqui.
export async function carregarResumoVagas(admin: Admin, usuario: UsuarioPortal): Promise<ResumoSistema> {
  const [visiveis, cartoes] = await Promise.all([projetosVisiveis(admin, usuario), carregarProjetos(admin, hojeSP())])
  return resumirVagas(cartoes, visiveis)
}
