import { beforeEach, expect, test, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase/servidor', () => ({ criarClienteServidor: async () => ({ rpc }) }))
vi.mock('@/lib/auth/perfil', () => ({ exigirEquipe: async () => ({ usuarioId: 'u', perfil: 'rh', nome: 'RH' }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
const { incluirEtapa, mostrarEtapaNoRelatorio, renomearEtapa } = await import('../acoesConfigurar')

const PROJETO = '22222222-2222-4222-8222-222222222222'
const ETAPA = '33333333-3333-4333-8333-333333333333'
const RESERVADO = { ok: false, erros: { nome: 'Este nome é usado por uma coluna fixa da planilha. Escolha outro.' } }

beforeEach(() => vi.clearAllMocks())

test.each(['Função', 'funcao', ' ÁREA ', 'Início  do processo', 'candidato', 'Gestor', 'Disciplina', 'onda', 'Meta'])(
  'incluir recusa o nome %s, que é de coluna fixa',
  async (nome) => {
    expect(await incluirEtapa(PROJETO, { nome, duracao: '1', depoisDe: '' })).toEqual(RESERVADO)
    expect(rpc).not.toHaveBeenCalled()
  },
)

test('renomear recusa nome de coluna fixa', async () => {
  expect(await renomearEtapa(PROJETO, ETAPA, { nome: 'Candidato' })).toEqual(RESERVADO)
  expect(rpc).not.toHaveBeenCalled()
})

test('nome comum segue para o banco', async () => {
  rpc.mockResolvedValue({ error: null })
  expect(await incluirEtapa(PROJETO, { nome: 'Cadastro no eSocial', duracao: '2', depoisDe: '' })).toEqual({ ok: true })
  expect(await renomearEtapa(PROJETO, ETAPA, { nome: 'Exames médicos' })).toEqual({ ok: true })
  expect(rpc).toHaveBeenCalledTimes(2)
})

test('mostrar no relatório chama a função do banco', async () => {
  rpc.mockResolvedValue({ error: null })
  expect(await mostrarEtapaNoRelatorio(PROJETO, ETAPA, false)).toEqual({ ok: true })
  expect(rpc).toHaveBeenCalledWith('mostrar_etapa_no_relatorio', { p_etapa: ETAPA, p_mostrar: false })
})

test('mostrar no relatório: id inválido não chega ao banco; projeto encerrado vira mensagem', async () => {
  expect((await mostrarEtapaNoRelatorio('x', ETAPA, true)).ok).toBe(false)
  expect(rpc).not.toHaveBeenCalled()
  rpc.mockResolvedValue({ error: { message: 'projeto encerrado' } })
  const r = await mostrarEtapaNoRelatorio(PROJETO, ETAPA, true)
  expect(r.ok).toBe(false)
})
