import { describe, expect, it } from 'vitest'
import { lerTodas } from '../paginar'

// Cliente de mentira: devolve as linhas pedidas por .range(de, ate), como o PostgREST.
const fonte = (total: number) => {
  const chamadas: [number, number][] = []
  const linhas = Array.from({ length: total }, (_, i) => ({ n: i }))
  const pagina = async (de: number, ate: number) => {
    chamadas.push([de, ate])
    return { data: linhas.slice(de, ate + 1), error: null }
  }
  return { pagina, chamadas }
}

describe('lerTodas', () => {
  it('junta as páginas até vir uma incompleta', async () => {
    const f = fonte(2500)
    const r = await lerTodas(f.pagina, 1000)
    expect(r.data).toHaveLength(2500)
    expect(r.data?.[2499]).toEqual({ n: 2499 })
    expect(f.chamadas).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('com um múltiplo exato do tamanho, pede mais uma página vazia', async () => {
    const f = fonte(2000)
    const r = await lerTodas(f.pagina, 1000)
    expect(r.data).toHaveLength(2000)
    expect(f.chamadas).toHaveLength(3)
  })

  it('não pede mais de uma página quando cabe numa só', async () => {
    const f = fonte(3)
    expect((await lerTodas(f.pagina, 1000)).data).toHaveLength(3)
    expect(f.chamadas).toEqual([[0, 999]])
  })

  it('para no primeiro erro e o devolve', async () => {
    let n = 0
    const r = await lerTodas(async () => (n++ === 0 ? { data: [{ n: 1 }, { n: 2 }], error: null } : { data: null, error: { message: 'caiu' } }), 2)
    expect(r).toEqual({ data: null, error: { message: 'caiu' } })
  })
})
