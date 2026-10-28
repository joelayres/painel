import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/tipos'
import { carregarPainel, montarPainel, montarProjetos, type LinhasPainel } from '../dados'

const base = [
  { ordem: 1, nome: 'Abertura de vaga', duracao: 1 }, { ordem: 2, nome: 'Captura de Mercado', duracao: 4 },
  { ordem: 3, nome: 'Triagem de Candidatos', duracao: 1 }, { ordem: 4, nome: 'Entrevista - Timenow', duracao: 1 },
  { ordem: 5, nome: 'Entrevista - TNGO/Braskem', duracao: 1 }, { ordem: 6, nome: 'Envio para contratação', duracao: 0 },
  { ordem: 7, nome: 'Agendamento exames', duracao: 2 }, { ordem: 8, nome: 'Realização de Exames', duracao: 1 },
  { ordem: 9, nome: 'Liberação dos exames', duracao: 7 }, { ordem: 10, nome: 'Ambientação/TBS', duracao: 1 },
  { ordem: 11, nome: 'Admissão Timenow', duracao: 0 }, { ordem: 12, nome: 'Atualização da CTPS', duracao: 3 },
  { ordem: 13, nome: 'Treinamento', duracao: 5 },
]
const vaga = (id: string, projeto_id: string, extra: Partial<LinhasPainel['vagas'][number]> = {}): LinhasPainel['vagas'][number] => ({
  id, projeto_id, meta: null, funcao: 'Técnico de Campo', disciplina: 'NR-13', area: 'Caldeiraria', onda_id: 'o1', gestor_id: null,
  candidato: null, data_inicio: '2026-10-22', retomada_em: null, cancelada_em: null, ...extra,
})

const linhas: LinhasPainel = {
  clientes: [{ id: 'c1', nome: 'Braskem' }],
  projetos: [
    { id: 'pA', cliente_id: 'c1', nome: 'Parada A', area: null, organizacao: 'ondas', encerrado_em: null },
    { id: 'pB', cliente_id: 'c1', nome: 'Parada B', area: 'Cloro', organizacao: 'ondas', encerrado_em: null },
    { id: 'pM', cliente_id: 'c1', nome: 'Contratação', area: null, organizacao: 'meta', encerrado_em: '2026-10-01T00:00:00Z' },
  ],
  clienteDuracoes: [],
  projetoDuracoes: [{ projeto_id: 'pB', ordem: 2, duracao: 1 }],
  ondas: [
    { id: 'o1', nome: 'Onda 1', inicio: '2026-10-22', fim: '2026-11-18', projeto_id: 'pA' },
    { id: 'o2', nome: 'Onda 1', inicio: '2026-10-22', fim: '2026-11-18', projeto_id: 'pB' },
    { id: 'o3', nome: 'Onda 2', inicio: '2026-11-01', fim: '2026-12-18', projeto_id: 'pB' },
  ],
  gestores: [{ id: 'g1', nome: 'Ana' }],
  etapas: base,
  feriados: [{ data: '2026-11-02' }, { data: '2026-11-15' }, { data: '2026-11-20' }],
  vagas: [
    vaga('vA', 'pA', { gestor_id: 'g1', candidato: 'Lucas' }),
    vaga('vB', 'pB', { onda_id: 'o2' }),
    vaga('vM', 'pM', { onda_id: null, meta: '2026-11-18' }),
    vaga('vX', 'pA', { cancelada_em: '2026-10-25T10:00:00Z' }),
  ],
  conclusoes: [{ vaga_id: 'vA', ordem: 1, concluida_em: '2026-10-22' }, { vaga_id: 'vM', ordem: 1, concluida_em: '2026-10-22' }],
}

describe('montarPainel', () => {
  it('monta as vagas ativas com previsão e cor, sem as canceladas', () => {
    const vagas = montarPainel(linhas, '2026-10-27')
    expect(vagas.map((v) => v.id)).toEqual(['vA', 'vB', 'vM'])
    const a = vagas[0]
    expect(a).toMatchObject({ projetoId: 'pA', meta: '2026-11-18', gestor: { id: 'g1', nome: 'Ana' }, onda: { nome: 'Onda 1' } })
    expect(a.previsao.admissaoEstimada).toBe('2026-11-19')
    expect(a.situacao.cor).toBe('amarelo')
  })

  it('usa as durações do projeto: a etapa 2 do projeto B termina antes da do A', () => {
    const [a, b] = montarPainel(linhas, '2026-10-27')
    const fim2 = (v: typeof a) => v.previsao.etapas.find((e) => e.ordem === 2)!.fim
    expect(fim2(b) < fim2(a)).toBe(true)
  })

  it('projeto por meta usa a meta da vaga e não tem onda', () => {
    const m = montarPainel(linhas, '2026-10-27')[2]
    expect(m.onda).toBeNull()
    expect(m.meta).toBe('2026-11-18')
    expect(m.situacao.cor).toBe('amarelo')
  })

  it('usa a data de retomada depois de uma desistência', () => {
    const [v] = montarPainel({ ...linhas, vagas: [vaga('vA', 'pA', { retomada_em: '2026-11-04' })] }, '2026-11-04')
    expect(v.previsao.inicioEtapaAtual).toBe('2026-11-04')
  })
})

describe('montarProjetos', () => {
  it('devolve um cartão por projeto, ordenado por cliente e nome', () => {
    const c = montarProjetos(linhas, '2026-10-27')
    expect(c.map((p) => p.id)).toEqual(['pM', 'pA', 'pB'])
    const a = c.find((p) => p.id === 'pA')!
    expect(a).toMatchObject({ ondas: 1, encerrado: false, cliente: { id: 'c1', nome: 'Braskem' } })
    expect(a.resumo.total).toBe(1)
    expect(c.find((p) => p.id === 'pB')).toMatchObject({ ondas: 2, area: 'Cloro' })
    expect(c.find((p) => p.id === 'pM')).toMatchObject({ encerrado: true, organizacao: 'meta', ondas: 0 })
  })
})

describe('carregarPainel', () => {
  it('devolve null quando o projeto não é visível', async () => {
    const consulta: Record<string, unknown> = {}
    const q: any = new Proxy(consulta, {
      get: (_, k) => (k === 'then' ? (f: (r: unknown) => unknown) => Promise.resolve(f({ data: [], error: null })) : () => q),
    })
    const sb = { from: () => q } as unknown as SupabaseClient<Database>
    expect(await carregarPainel(sb, '2026-10-27', 'pZ')).toBeNull()
  })
})
