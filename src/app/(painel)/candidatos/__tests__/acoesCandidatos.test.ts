// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest'

const removidos: string[][] = []
const rpc = vi.fn(async () => ({ data: ['s1/a.pdf', 's2/b.pdf'], error: null }))
let perfil = 'rh'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`) }) }))
vi.mock('@/lib/auth/perfil', () => ({
  exigirAdmin: async () => {
    if (perfil !== 'rh') throw new Error('redirect:/')
    return { perfil }
  },
}))
vi.mock('@/lib/supabase/servidor', () => ({ criarClienteServidor: async () => ({ rpc }) }))
vi.mock('@/lib/supabase/admin', () => ({
  criarClienteAdmin: () => ({ storage: { from: () => ({ remove: async (c: string[]) => (removidos.push(c), { error: null }) }) } }),
}))

import { excluirCandidato } from '../acoesCandidatos'

beforeEach(() => {
  removidos.length = 0
  rpc.mockClear()
  perfil = 'rh'
})

test('apaga do Storage exatamente os arquivos devolvidos pelo banco', async () => {
  await expect(excluirCandidato('c1')).rejects.toThrow('redirect:/candidatos')
  expect(rpc).toHaveBeenCalledWith('excluir_candidato', { p_candidato: 'c1' })
  expect(removidos).toEqual([['s1/a.pdf', 's2/b.pdf']])
})

test('analista não exclui', async () => {
  perfil = 'analista'
  await expect(excluirCandidato('c1')).rejects.toThrow('redirect:/')
  expect(rpc).not.toHaveBeenCalled()
  expect(removidos).toEqual([])
})
