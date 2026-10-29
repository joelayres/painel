import { beforeEach, expect, test, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase/servidor', () => ({ criarClienteServidor: async () => ({ rpc }) }))
vi.mock('@/lib/auth/perfil', () => ({ exigirEquipe: async () => ({ usuarioId: 'u', perfil: 'rh', nome: 'RH' }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
const carregarPainel = vi.fn()
vi.mock('@/lib/painel/dados', () => ({ carregarPainel: (...a: unknown[]) => carregarPainel(...a) }))
const { alterarEmGrupo, avancarEmGrupo } = await import('../acoesConfigurar')

const PROJETO = '22222222-2222-4222-8222-222222222222'
const V1 = '11111111-1111-4111-8111-111111111111'
const V2 = '44444444-4444-4444-8444-444444444444'

beforeEach(() => {
  vi.clearAllMocks()
  carregarPainel.mockResolvedValue({ vagas: [] })
})

test('avançar em grupo chama o banco com a lista e a etapa', async () => {
  rpc.mockResolvedValue({ data: 2, error: null })
  expect(await avancarEmGrupo(PROJETO, [V1, V2], 3, '2026-10-28')).toEqual({ ok: true, alteradas: 2, puladas: 0, foraDaMeta: 0 })
  expect(rpc).toHaveBeenCalledWith('concluir_etapa_em_grupo', { p_vagas: [V1, V2], p_ordem_esperada: 3, p_data: '2026-10-28' })
})

test('erro de uma vaga diz qual vaga e por quê', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: `vaga ${V2}: data antes da etapa anterior` } })
  expect(await avancarEmGrupo(PROJETO, [V1, V2], 3, '2026-10-28')).toEqual({
    ok: false, vagaId: V2, erro: 'A data não pode ser antes da conclusão da etapa anterior.',
  })
})

test('sem permissão vira a mensagem de acesso', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'sem permissão' } })
  expect(await avancarEmGrupo(PROJETO, [V1], 1, '2026-10-28')).toEqual({ ok: false, vagaId: null, erro: 'Você não tem acesso a este projeto.' })
})

test('alterar em grupo repassa o campo e devolve alteradas e puladas', async () => {
  rpc.mockResolvedValue({ data: { alteradas: 1, puladas: 1 }, error: null })
  expect(await alterarEmGrupo(PROJETO, [V1, V2], 'data_inicio', '2026-11-03')).toEqual({ ok: true, alteradas: 1, puladas: 1, foraDaMeta: 0 })
  expect(rpc).toHaveBeenCalledWith('alterar_vagas_em_grupo', { p_vagas: [V1, V2], p_campo: 'data_inicio', p_valor: '2026-11-03' })
})

test('conta as vagas do grupo que ficaram com a admissão depois da meta', async () => {
  rpc.mockResolvedValue({ data: { alteradas: 2, puladas: 0 }, error: null })
  const prev = (admissao: string) => ({ etapas: [{ ordem: 1, fixa: 'admissao', concluidaEm: null }], admissaoEstimada: admissao })
  carregarPainel.mockResolvedValue({ vagas: [
    { id: V1, meta: '2026-11-30', previsao: prev('2026-12-10') },
    { id: V2, meta: '2026-11-30', previsao: prev('2026-11-20') },
    { id: 'outra', meta: '2026-11-01', previsao: prev('2026-12-10') },
  ] })
  expect(await alterarEmGrupo(PROJETO, [V1, V2], 'meta', '2026-11-30')).toEqual({ ok: true, alteradas: 2, puladas: 0, foraDaMeta: 1 })
})

test('lista vazia, data inválida ou campo inválido não chamam o banco', async () => {
  expect((await avancarEmGrupo(PROJETO, [], 1, '2026-10-28')).ok).toBe(false)
  expect((await avancarEmGrupo(PROJETO, [V1], 1, '2026-02-31')).ok).toBe(false)
  expect((await alterarEmGrupo(PROJETO, [V1], 'funcao' as 'meta', 'x')).ok).toBe(false)
  expect((await alterarEmGrupo(PROJETO, ['nao-uuid'], 'meta', '2026-11-30')).ok).toBe(false)
  expect(rpc).not.toHaveBeenCalled()
})
