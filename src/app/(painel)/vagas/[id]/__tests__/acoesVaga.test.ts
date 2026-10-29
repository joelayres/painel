import { beforeEach, expect, test, vi } from 'vitest'

const rpc = vi.fn()
const update = vi.fn()
const insert = vi.fn()
vi.mock('@/lib/supabase/servidor', () => ({
  criarClienteServidor: async () => ({ rpc, from: () => ({ update: (d: unknown) => ({ eq: () => update(d) }), insert: (d: unknown) => insert(d) }) }),
}))
vi.mock('@/lib/auth/perfil', () => ({ exigirEquipe: async () => ({ usuarioId: 'u', perfil: 'rh', nome: 'RH' }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
const vagaRecarregada = vi.fn()
vi.mock('@/lib/painel/dados', () => ({ carregarVaga: (...a: unknown[]) => vagaRecarregada(...a) }))
vi.mock('@/dominio/tempo', () => ({ hojeSP: () => '2026-10-28' }))
const { cancelarVaga, candidatoDesistiu, concluirEtapa, concluirEtapas, salvarVaga } = await import('../acoesVaga')

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
  expect(rpc).toHaveBeenCalledWith('concluir_etapas', { p_vaga: 'v1', p_ordem_esperada: 3, p_ate: 3, p_data: '2026-10-27' })
})

test('concluir várias etapas chama a função do banco com o intervalo', async () => {
  rpc.mockResolvedValue({ error: null })
  expect(await concluirEtapas('v', 3, 5, '2026-10-28')).toEqual({ ok: true })
  expect(rpc).toHaveBeenCalledWith('concluir_etapas', { p_vaga: 'v', p_ordem_esperada: 3, p_ate: 5, p_data: '2026-10-28' })
})

test('etapa obrigatória vira mensagem clara', async () => {
  rpc.mockResolvedValue({ error: { message: 'etapa obrigatória' } })
  expect(await concluirEtapas('v', 3, 5, '2026-10-28')).toEqual({ ok: false, erro: 'Esta etapa é obrigatória e não pode ser excluída nem renomeada.' })
})

const ONDA = '11111111-1111-4111-8111-111111111111'
const PROJETO = '22222222-2222-4222-8222-222222222222'
const base = { funcao: 'Técnico', disciplina: 'NR-13', area: 'Caldeiraria', gestorId: '', candidato: '', dataInicio: '2026-10-22', projetoId: PROJETO }

test('salvar vaga valida os campos obrigatórios', async () => {
  const r = await salvarVaga(null, { ...base, funcao: '', ondaId: 'x' })
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.erros).toMatchObject({ funcao: 'Informe a função.', ondaId: 'Escolha a onda.' })
  expect(insert).not.toHaveBeenCalled()
})

test('salvar vaga grava pela função que registra o histórico e devolve o aviso da meta', async () => {
  rpc.mockResolvedValue({ data: 'v9', error: null })
  vagaRecarregada.mockResolvedValue(null)
  const r = await salvarVaga(null, { ...base, ondaId: ONDA, meta: '' })
  expect(r).toEqual({ ok: true, id: 'v9', aviso: null })
  expect(rpc).toHaveBeenCalledWith('salvar_vaga', { p_id: null, p: { funcao: 'Técnico', disciplina: 'NR-13', area: 'Caldeiraria', onda_id: ONDA, gestor_id: null, candidato: null, data_inicio: '2026-10-22', meta: null, projeto_id: PROJETO } })
  expect(insert).not.toHaveBeenCalled()
})

test('disciplina e área são opcionais', async () => {
  rpc.mockResolvedValue({ data: 'v9', error: null })
  const r = await salvarVaga(null, { ...base, disciplina: '', area: undefined, ondaId: null, meta: '2026-11-18' })
  expect(r.ok).toBe(true)
  expect(rpc).toHaveBeenCalledWith('salvar_vaga', { p_id: null, p: expect.objectContaining({ disciplina: '', area: '', onda_id: null, meta: '2026-11-18' }) })
})

test('o aviso vem da vaga recarregada', async () => {
  rpc.mockResolvedValue({ data: 'v9', error: null })
  vagaRecarregada.mockResolvedValue({ vaga: { meta: '2026-11-18', previsao: { etapas: [], admissaoEstimada: '2026-11-25' } } })
  const r = await salvarVaga(null, { ...base, ondaId: null, meta: '2026-11-18' })
  expect(r).toEqual({ ok: true, id: 'v9', aviso: 'Pelas etapas, a admissão sai em 25/11 e a meta é 18/11.' })
})

test('onda e meta obrigatórias viram erro no campo', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'onda obrigatória' } })
  expect(await salvarVaga(null, { ...base, ondaId: null, meta: null })).toEqual({ ok: false, erros: { ondaId: 'Escolha a onda.' } })
  rpc.mockResolvedValue({ data: null, error: { message: 'meta obrigatória' } })
  expect(await salvarVaga(null, { ...base, ondaId: null, meta: null })).toEqual({ ok: false, erros: { meta: 'Informe a meta.' } })
})

test('projeto encerrado vira mensagem clara', async () => {
  rpc.mockResolvedValue({ error: { message: 'projeto encerrado' } })
  expect(await concluirEtapa('v1', 3, '2026-10-27')).toEqual({ ok: false, erro: 'Este projeto está encerrado. Reabra para alterar.' })
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
