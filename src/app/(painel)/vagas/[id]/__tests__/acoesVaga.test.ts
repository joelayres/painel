import { beforeEach, expect, test, vi } from 'vitest'

const rpc = vi.fn()
const update = vi.fn()
const insert = vi.fn()
vi.mock('@/lib/supabase/servidor', () => ({
  criarClienteServidor: async () => ({ rpc, from: () => ({ update: (d: unknown) => ({ eq: () => update(d) }), insert: (d: unknown) => insert(d) }) }),
}))
vi.mock('@/lib/auth/perfil', () => ({ exigirRh: async () => ({ usuarioId: 'u', perfil: 'rh', nome: 'RH' }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
const { cancelarVaga, candidatoDesistiu, concluirEtapa, salvarVaga } = await import('../acoesVaga')

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

test('salvar vaga grava pela função que registra o histórico', async () => {
  rpc.mockResolvedValue({ data: 'v9', error: null })
  const onda = '11111111-1111-4111-8111-111111111111'
  const r = await salvarVaga(null, { funcao: 'Técnico', disciplina: 'NR-13', area: 'Caldeiraria', ondaId: onda, gestorId: '', candidato: '', dataInicio: '2026-10-22' })
  expect(r).toEqual({ ok: true, id: 'v9' })
  expect(rpc).toHaveBeenCalledWith('salvar_vaga', { p_id: null, p: { funcao: 'Técnico', disciplina: 'NR-13', area: 'Caldeiraria', onda_id: onda, gestor_id: null, candidato: null, data_inicio: '2026-10-22' } })
  expect(insert).not.toHaveBeenCalled()
})

test('cancelar vaga usa a função que registra o histórico', async () => {
  rpc.mockResolvedValue({ error: null })
  expect(await cancelarVaga('v1')).toEqual({ ok: true })
  expect(rpc).toHaveBeenCalledWith('cancelar_vaga', { p_id: 'v1' })
})

test('novos limites de data e desistência após admissão viram mensagens claras', async () => {
  rpc.mockResolvedValue({ error: { message: 'data antes do início da vaga' } })
  expect(await concluirEtapa('v1', 1, '2026-10-01')).toEqual({ ok: false, erro: 'A data não pode ser antes do início do processo da vaga.' })
  rpc.mockResolvedValue({ error: { message: 'data antes da retomada' } })
  expect(await concluirEtapa('v1', 2, '2026-10-01')).toEqual({ ok: false, erro: 'A data não pode ser antes da desistência do candidato anterior.' })
  rpc.mockResolvedValue({ error: { message: 'vaga já admitida' } })
  expect(await candidatoDesistiu('v1')).toEqual({ ok: false, erro: 'A vaga já passou da admissão; não volta para a captura.' })
})
