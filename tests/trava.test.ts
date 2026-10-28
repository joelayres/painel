import { describe, expect, it } from 'vitest'
import { conferirTrava } from './integracao/regraTrava'

describe('trava dos testes de integração', () => {
  it('deixa rodar com o banco sem vagas reais', () => {
    expect(() => conferirTrava({ count: 0, error: null })).not.toThrow()
  })

  it('deixa rodar antes da tabela existir (primeira migração)', () => {
    expect(() => conferirTrava({ count: null, error: { code: 'PGRST205', message: "Could not find the table 'public.vagas'" } })).not.toThrow()
    expect(() => conferirTrava({ count: null, error: { code: '42P01', message: 'relation "vagas" does not exist' } })).not.toThrow()
  })

  it('bloqueia quando há vagas reais', () => {
    expect(() => conferirTrava({ count: 3, error: null })).toThrow('o banco tem 3 vagas reais')
  })

  it('bloqueia qualquer outro erro, mesmo citando a tabela', () => {
    expect(() => conferirTrava({ count: null, error: { code: '42501', message: 'permission denied for table vagas' } })).toThrow('não foi possível consultar o banco')
  })

  it('bloqueia quando a contagem não vem', () => {
    expect(() => conferirTrava({ count: null, error: null })).toThrow('não foi possível consultar o banco')
  })
})
