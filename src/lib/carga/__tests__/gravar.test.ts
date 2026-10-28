import type { SupabaseClient } from '@supabase/supabase-js'
import { expect, test, vi } from 'vitest'
import { gravarCarga } from '../gravar'

const comErro = (message: string) => ({ rpc: async () => ({ data: null, error: { message } }) }) as unknown as SupabaseClient

test('erro desconhecido mostra o motivo para o RH saber o que corrigir', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const r = await gravarCarga(comErro('Invalid API key'), [], 'RH')
  expect(r).toEqual({ ok: false, erro: 'Não foi possível gravar a carga (Invalid API key). Nada foi importado.' })
})

test('onda faltando e painel com vagas continuam com as mensagens claras', async () => {
  expect(await gravarCarga(comErro('falta onda 3'), [], 'RH')).toEqual({ ok: false, erro: 'Cadastre a 3ª Onda antes de fazer a carga.' })
  expect(await gravarCarga(comErro('painel não está vazio'), [], 'RH')).toEqual({ ok: false, erro: 'A carga só pode ser feita com o painel vazio. Já existem vagas cadastradas.' })
})
