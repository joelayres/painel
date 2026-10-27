import { beforeEach, expect, test, vi } from 'vitest'

const rpc = vi.fn()
const update = vi.fn()
const insert = vi.fn()
vi.mock('@/lib/supabase/servidor', () => ({
  criarClienteServidor: async () => ({ rpc, from: () => ({ update: (d: unknown) => ({ eq: () => update(d) }), insert: (d: unknown) => insert(d) }) }),
}))
vi.mock('@/lib/auth/perfil', () => ({ exigirRh: async () => ({ usuarioId: 'u', perfil: 'rh', nome: 'RH' }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
const { concluirEtapa, salvarVaga } = await import('../acoesVaga')

beforeEach(() => vi.clearAllMocks())

test('etapa mudou vira mensagem para atualizar a página', async () => {
  rpc.mockResolvedValue({ error: { message: 'etapa mudou' } })
  expect(await concluirEtapa('v1', 3, '2026-10-27')).toEqual({ ok: false, erro: 'Esta vaga mudou enquanto você olhava. Atualize a página.' })
})

test('data antes da etapa anterior e data no futuro viram mensagens claras', async () => {
  rpc.mockResolvedValue({ error: { message: 'data antes da etapa anterior' } })
  expect(await concluirEtapa('v1', 3, '2026-10-01')).toEqual({ ok: false, erro: 'A data não pode ser antes da conclusão da etapa anterior.' })
  rpc.mockResolvedValue({ error: { message: 'data no futuro' } })
  expect(await concluirEtapa('v1', 3, '2999-01-01')).toEqual({ ok: false, erro: 'A data não pode ser no futuro.' })
})

test('concluir chama a função do banco com a etapa esperada', async () => {
  rpc.mockResolvedValue({ error: null })
  expect(await concluirEtapa('v1', 3, '2026-10-27')).toEqual({ ok: true })
  expect(rpc).toHaveBeenCalledWith('concluir_etapa', { p_vaga: 'v1', p_ordem_esperada: 3, p_data: '2026-10-27' })
})

test('salvar vaga valida os campos obrigatórios', async () => {
  const r = await salvarVaga(null, { funcao: '', disciplina: 'NR-13', area: 'Caldeiraria', ondaId: 'x', dataInicio: '2026-10-22' })
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.erros).toMatchObject({ funcao: 'Informe a função.', ondaId: 'Escolha a onda.' })
  expect(insert).not.toHaveBeenCalled()
})
