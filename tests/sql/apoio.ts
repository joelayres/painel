// Testes de SQL no banco real, sempre dentro de uma transação desfeita no fim (rollback).
// O banco do .env.local é o de produção: nada destes testes pode ficar gravado.
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

export function conexao(): Client {
  const senha = encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)
  return new Client({
    connectionString: `postgresql://postgres.${process.env.SUPABASE_PROJECT_REF}:${senha}@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  })
}

// Migrações ainda não aplicadas no banco rodam dentro da transação do teste: dá para testar uma
// mudança de função antes de publicá-la, e o rollback desfaz tudo.
export async function aplicarPendentes(c: Client): Promise<void> {
  const { rows } = await c.query('select version from supabase_migrations.schema_migrations')
  const aplicadas = new Set(rows.map((r) => r.version as string))
  const pasta = join(process.cwd(), 'supabase/migrations')
  for (const arquivo of readdirSync(pasta).filter((a) => a.endsWith('.sql')).sort()) {
    if (!aplicadas.has(arquivo.split('_')[0])) await c.query(readFileSync(join(pasta, arquivo), 'utf8'))
  }
}

export async function emTransacao(fn: (c: Client) => Promise<void>): Promise<void> {
  const c = conexao()
  await c.connect()
  try {
    await c.query('begin')
    await aplicarPendentes(c)
    await fn(c)
  } finally {
    await c.query('rollback')
    await c.end()
  }
}

// Cria (dentro da transação) um usuário com o perfil e passa a agir como ele, como o PostgREST faz.
export async function comoUsuario(c: Client, perfil: 'rh' | 'visualizador'): Promise<string> {
  const id = randomUUID()
  await c.query('insert into auth.users (id, email) values ($1, $2)', [id, `teste-sql-${id}@exemplo.test`])
  await c.query("insert into usuarios (usuario_id, nome, email, perfil) values ($1, 'teste-sql RH', $2, $3)", [id, `teste-sql-${id}@exemplo.test`, perfil])
  await c.query("select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)", [id])
  await c.query('set local role authenticated')
  return id
}

// Vaga de teste numa onda já cadastrada (criada com o papel do banco, antes de virar o usuário).
export async function novaVaga(c: Client, dataInicio = '2026-10-22'): Promise<string> {
  const { rows } = await c.query(
    "insert into vagas (funcao, disciplina, area, onda_id, data_inicio) select 'teste-sql Vaga', 'x', 'x', id, $1 from ondas order by numero limit 1 returning id",
    [dataInicio],
  )
  return rows[0].id
}
