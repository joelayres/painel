import { expect, test } from 'vitest'
import { assinarEntrada, conferirEntrada } from '../token'

const T0 = new Date('2026-10-30T12:00:00Z')
const depois = (ms: number) => new Date(T0.getTime() + ms)

test('ida e volta', () => {
  const r = conferirEntrada(assinarEntrada({ email: ' Ana@X.com ', sistema: 'he' }, 's', T0), 's', 'he', T0)
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.entrada.email).toBe('ana@x.com')
  expect(r.entrada.sistema).toBe('he')
  expect(r.entrada.exp).toBe(T0.getTime() / 1000 + 60)
})

test('vence em 60 segundos', () => {
  const t = assinarEntrada({ email: 'a@x.com', sistema: 'he' }, 's', T0)
  expect(conferirEntrada(t, 's', 'he', depois(60_000)).ok).toBe(true)
  expect(conferirEntrada(t, 's', 'he', depois(61_000))).toEqual({ ok: false, motivo: 'expirado' })
})

test('segredo errado', () => {
  const t = assinarEntrada({ email: 'a@x.com', sistema: 'he' }, 's', T0)
  expect(conferirEntrada(t, 'outro', 'he', T0)).toEqual({ ok: false, motivo: 'assinatura' })
})

test('outro sistema', () => {
  const t = assinarEntrada({ email: 'a@x.com', sistema: 'mobilizacao' }, 's', T0)
  expect(conferirEntrada(t, 's', 'he', T0)).toEqual({ ok: false, motivo: 'sistema' })
})

test('token adulterado', () => {
  const t = assinarEntrada({ email: 'a@x.com', sistema: 'he' }, 's', T0)
  const [dados, assinatura] = t.split('.')
  const trocado = (dados[3] === 'A' ? 'B' : 'A')
  const adulterado = `${dados.slice(0, 3)}${trocado}${dados.slice(4)}.${assinatura}`
  expect(conferirEntrada(adulterado, 's', 'he', T0)).toEqual({ ok: false, motivo: 'assinatura' })
  expect(conferirEntrada('abc', 's', 'he', T0)).toEqual({ ok: false, motivo: 'formato' })
})

test('jti único', () => {
  const a = conferirEntrada(assinarEntrada({ email: 'a@x.com', sistema: 'he' }, 's', T0), 's', 'he', T0)
  const b = conferirEntrada(assinarEntrada({ email: 'a@x.com', sistema: 'he' }, 's', T0), 's', 'he', T0)
  expect(a.ok && b.ok && a.entrada.jti !== b.entrada.jti).toBe(true)
})
