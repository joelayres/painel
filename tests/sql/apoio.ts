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

// `antes` roda na transação antes das migrações pendentes: serve para guardar o estado de antes da migração.
export async function emTransacao(fn: (c: Client) => Promise<void>, antes?: (c: Client) => Promise<void>): Promise<void> {
  const c = conexao()
  await c.connect()
  try {
    await c.query('begin')
    if (antes) await antes(c)
    await aplicarPendentes(c)
    await fn(c)
  } finally {
    await c.query('rollback')
    await c.end()
  }
}

// Cria (dentro da transação) um usuário com o perfil e passa a agir como ele, como o PostgREST faz.
// Devolve o id do auth (authId) e o id do registro em usuarios (usuarioId).
export async function comoUsuario(
  c: Client,
  perfil: 'rh' | 'gestor' | 'cliente',
  clienteId?: string,
): Promise<{ authId: string; usuarioId: string }> {
  const id = randomUUID()
  const email = `teste-sql-${id}@exemplo.test`
  await c.query('insert into auth.users (id, email) values ($1, $2)', [id, email])
  // Sem cliente, a coluna cliente_id nem aparece: o teste dos dois cliques roda no banco sem a 005.
  const { rows } = clienteId
    ? await c.query('insert into usuarios (usuario_id, nome, email, perfil, cliente_id) values ($1, $2, $3, $4, $5) returning id', [id, `teste-sql ${perfil}`, email, perfil, clienteId])
    : await c.query('insert into usuarios (usuario_id, nome, email, perfil) values ($1, $2, $3, $4) returning id', [id, `teste-sql ${perfil}`, email, perfil])
  await c.query("select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)", [id])
  await c.query('set local role authenticated')
  return { authId: id, usuarioId: rows[0].id }
}

// Os ajudantes abaixo agem com o papel do banco: chame-os antes de comoUsuario.

// Cliente de teste com as durações copiadas das etapas, como salvar_cliente faz.
export async function novoCliente(c: Client, nome = `teste-sql Cliente ${randomUUID()}`): Promise<string> {
  const { rows } = await c.query('insert into clientes (nome) values ($1) returning id', [nome])
  await c.query('insert into cliente_duracoes (cliente_id, ordem, duracao) select $1, ordem, duracao from etapas', [rows[0].id])
  return rows[0].id
}

// Projeto de teste. Por ondas, já vem com uma onda de 22/10 a 31/12/2026.
export async function novoProjeto(
  c: Client,
  p: { clienteId: string; organizacao: 'ondas' | 'meta'; nome?: string },
): Promise<{ projetoId: string; ondaId: string | null }> {
  const { rows } = await c.query('insert into projetos (cliente_id, nome, organizacao) values ($1, $2, $3) returning id', [
    p.clienteId,
    p.nome ?? `teste-sql Projeto ${randomUUID()}`,
    p.organizacao,
  ])
  const projetoId = rows[0].id
  if (p.organizacao === 'meta') return { projetoId, ondaId: null }
  const onda = await c.query("insert into ondas (projeto_id, nome, inicio, fim) values ($1, '1ª Onda', '2026-10-22', '2026-12-31') returning id", [projetoId])
  return { projetoId, ondaId: onda.rows[0].id }
}

// Vaga de teste num projeto (com a onda ou a meta que o projeto pede).
export async function novaVaga(
  c: Client,
  p: { projetoId: string; ondaId?: string | null; meta?: string | null; dataInicio?: string },
): Promise<string> {
  const { rows } = await c.query(
    "insert into vagas (funcao, disciplina, area, projeto_id, onda_id, meta, data_inicio) values ('teste-sql Vaga', 'x', 'x', $1, $2, $3, $4) returning id",
    [p.projetoId, p.ondaId ?? null, p.meta ?? null, p.dataInicio ?? '2026-10-22'],
  )
  return rows[0].id
}

// A lista de etapas do projeto, na ordem.
export async function etapasDoProjeto(
  c: Client,
  projetoId: string,
): Promise<{ id: string; posicao: number; nome: string; fixa: string | null }[]> {
  const { rows } = await c.query('select id, posicao, nome, fixa from projeto_etapas where projeto_id = $1 order by posicao', [projetoId])
  return rows
}

// Conclui direto (como o banco, sem as regras das funções) as etapas da posição 1 até `posicao`
// da lista do projeto da vaga, todas na mesma data. As já concluídas ficam como estão.
export async function concluirAte(c: Client, vagaId: string, posicao: number, data: string): Promise<void> {
  await c.query(
    `insert into vaga_conclusoes (vaga_id, etapa_id, ordem, concluida_em)
     select v.id, e.id, e.padrao, $3 from vagas v join projeto_etapas e on e.projeto_id = v.projeto_id
     where v.id = $1 and e.posicao <= $2 on conflict do nothing`,
    [vagaId, posicao, data],
  )
}
