// Sem projeto Supabase de testes: os testes de integração só rodam enquanto o banco não tem vagas reais.
// Depois da carga inicial, esta trava impede qualquer execução (ver Task 0 do plano).
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'

export default async function trava() {
  const env = loadEnv('test', process.cwd(), '')
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { count, error } = await admin.from('vagas').select('id', { count: 'exact', head: true }).not('funcao', 'like', 'teste-%')
  if (error && error.code !== '42P01' && !/vagas/.test(error.message)) throw new Error(`Trava dos testes: não foi possível consultar o banco (${error.message}).`)
  if (count) throw new Error(`Trava dos testes: o banco tem ${count} vagas reais. Os testes de integração não rodam no banco de produção.`)
}
