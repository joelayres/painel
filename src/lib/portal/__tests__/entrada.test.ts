import { beforeEach, expect, test, vi } from 'vitest'
import { registrarUso, usuarioDoPortal } from '../entrada'

// Banco falso: cada tabela devolve o que o teste preparou e registra os filtros usados.
type Resposta = { data: unknown; error: { message: string; code?: string } | null }
let respostas: Record<string, Resposta>
let filtros: string[]
let inserido: Resposta

function consulta(tabela: string) {
  const q = {
    select: () => q,
    ilike: (c: string, v: string) => (filtros.push(`${tabela}.${c} ilike ${v}`), q),
    lt: (c: string, v: string) => (filtros.push(`${tabela}.${c} < ${v}`), Promise.resolve({ error: null })),
    delete: () => (filtros.push(`${tabela} delete`), q),
    insert: (linha: unknown) => (filtros.push(`${tabela} insert ${JSON.stringify(linha)}`), Promise.resolve(inserido)),
    maybeSingle: async () => respostas[tabela] ?? { data: null, error: null },
  }
  return q
}
const admin = { from: vi.fn(consulta) } as never
const usuario = (sobre: Record<string, unknown> = {}) => ({ data: { id: 'r1', perfil: 'gestor', ativo: true, usuario_id: 'u1', ...sobre }, error: null })

beforeEach(() => {
  filtros = []
  inserido = { data: null, error: null }
  respostas = { usuarios: usuario() }
})

test('rh, analista e gestor ativos entram', async () => {
  for (const perfil of ['rh', 'analista', 'gestor']) {
    respostas.usuarios = usuario({ perfil })
    expect(await usuarioDoPortal(admin, 'ana@x.com')).toEqual({ id: 'r1', perfil, usuarioId: 'u1' })
  }
})

test('e-mail com maiúsculas e espaços é comparado normalizado', async () => {
  await usuarioDoPortal(admin, ' Ana_B@X.com ')
  expect(filtros).toContain('usuarios.email ilike ana\\_b@x.com')
})

test('cliente não entra pelo portal, mesmo ativo', async () => {
  respostas.usuarios = usuario({ perfil: 'cliente' })
  expect(await usuarioDoPortal(admin, 'cliente@x.com')).toBeNull()
})

test('inativo, sem acesso criado ou sem cadastro não entra', async () => {
  respostas.usuarios = usuario({ ativo: false })
  expect(await usuarioDoPortal(admin, 'ana@x.com')).toBeNull()
  respostas.usuarios = usuario({ usuario_id: null })
  expect(await usuarioDoPortal(admin, 'ana@x.com')).toBeNull()
  respostas.usuarios = { data: null, error: null }
  expect(await usuarioDoPortal(admin, 'ana@x.com')).toBeNull()
})

test('erro de leitura não deixa entrar em silêncio', async () => {
  respostas.usuarios = { data: null, error: { message: 'caiu' } }
  await expect(usuarioDoPortal(admin, 'ana@x.com')).rejects.toThrow('caiu')
})

test('registrarUso: primeiro uso vale, repetido não, e limpa os antigos antes', async () => {
  expect(await registrarUso(admin, 'j1')).toBe(true)
  expect(filtros[0]).toBe('entradas_portal delete')
  expect(filtros[1]).toMatch(/^entradas_portal\.usado_em < /)
  expect(filtros[2]).toBe('entradas_portal insert {"jti":"j1"}')
  inserido = { data: null, error: { message: 'duplicate key', code: '23505' } }
  expect(await registrarUso(admin, 'j1')).toBe(false)
  inserido = { data: null, error: { message: 'caiu' } }
  await expect(registrarUso(admin, 'j2')).rejects.toThrow('caiu')
})
