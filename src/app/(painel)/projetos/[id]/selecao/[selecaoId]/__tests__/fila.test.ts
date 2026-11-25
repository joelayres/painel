import { expect, test } from 'vitest'
import { processarFila } from '../fila'

test('nunca passa de 3 ao mesmo tempo e termina todos', async () => {
  let emAndamento = 0
  let maximo = 0
  const terminados: string[] = []
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  await processarFila(
    ids,
    async () => {
      emAndamento += 1
      maximo = Math.max(maximo, emAndamento)
      await new Promise((r) => setTimeout(r, 5))
      emAndamento -= 1
      return { ok: true }
    },
    { simultaneas: 3, aoTerminar: (id) => terminados.push(id) },
  )
  expect(maximo).toBe(3)
  expect(terminados.sort()).toEqual(ids)
})

test('uma falha não interrompe as outras', async () => {
  const resultados: [string, boolean][] = []
  await processarFila(
    ['a', 'b', 'c', 'd'],
    async (id) => {
      if (id === 'b') throw new Error('rede')
      if (id === 'c') return { ok: false }
      return { ok: true }
    },
    { simultaneas: 2, aoTerminar: (id, r) => resultados.push([id, r.ok]) },
  )
  expect(resultados.sort()).toEqual([['a', true], ['b', false], ['c', false], ['d', true]])
})
