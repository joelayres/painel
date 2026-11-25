import type { Client } from 'pg'
import { describe, expect, it } from 'vitest'
import { comoUsuario, conexao, emTransacao, liberar, novoCliente, novoProjeto } from './apoio'

// Erro esperado dentro da transação do teste: o savepoint deixa a transação seguir depois dele.
async function erroSalvo(c: Client, p: () => Promise<unknown>): Promise<string | null> {
  await c.query('savepoint s')
  try {
    await p()
    return null
  } catch (e) {
    return (e as Error).message
  } finally {
    await c.query('rollback to savepoint s')
  }
}

const TABELAS = ['candidatos', 'curriculos', 'selecoes', 'participacoes', 'analises_ia', 'entrevistas', 'historico_selecao']

async function contar(c: Client, tabela: string): Promise<number> {
  const { rows } = await c.query(`select count(*)::int as n from ${tabela}`)
  return rows[0].n
}

// Com o papel do banco (antes de comoUsuario): uma seleção com um candidato analisado e uma entrevista.
async function semente(c: Client) {
  const cli = await novoCliente(c)
  const { projetoId } = await novoProjeto(c, { clienteId: cli, organizacao: 'meta' })
  const sel = (await c.query("insert into selecoes (projeto_id, funcao, descritivo) values ($1, 'Caldeireiro', 'NR-13') returning id", [projetoId])).rows[0].id
  const cand = (await c.query("insert into candidatos (nome) values ('teste-sql Candidato') returning id")).rows[0].id
  const cv = (await c.query("insert into curriculos (candidato_id, caminho, nome_arquivo, enviado_por) values ($1, $2, 'cv.pdf', 'teste') returning id", [cand, `${sel}/x.pdf`])).rows[0].id
  const part = (await c.query("insert into participacoes (selecao_id, candidato_id, curriculo_id, situacao) values ($1, $2, $3, 'analisada') returning id", [sel, cand, cv])).rows[0].id
  await c.query("insert into analises_ia (participacao_id, modelo, versao_prompt, descritivo, nota, classificacao, resposta) values ($1, 'm', 'v', 'NR-13', 80, 'aderente', '{}')", [part])
  await c.query("insert into entrevistas (participacao_id, tipo, data, entrevistador, parecer, registrado_por) values ($1, 'timenow', '2026-11-25', 'Ana', 'recomendado', 'teste')", [part])
  await c.query("insert into historico_selecao (selecao_id, participacao_id, nome_usuario, acao) values ($1, $2, 'teste', 'x')", [sel, part])
  return { cli, projetoId, sel, cand, part }
}

describe('seleção: acesso', () => {
  it('gestor e cliente não leem nada', () =>
    emTransacao(async (c) => {
      const { cli, projetoId } = await semente(c)
      for (const perfil of ['gestor', 'cliente'] as const) {
        await c.query('reset role')
        const { usuarioId } = await comoUsuario(c, perfil, perfil === 'cliente' ? cli : undefined)
        await liberar(c, projetoId, usuarioId)
        for (const t of TABELAS) expect([perfil, t, await contar(c, t)]).toEqual([perfil, t, 0])
        const { rows } = await c.query("select count(*)::int as n from storage.objects where bucket_id = 'curriculos'")
        expect(rows[0].n).toBe(0)
      }
    }))

  it('analista lê o banco inteiro mas só seleções dos projetos dele', () =>
    emTransacao(async (c) => {
      const { projetoId } = await semente(c)
      const { usuarioId } = await comoUsuario(c, 'analista')
      expect(await contar(c, 'candidatos')).toBe(1)
      expect(await contar(c, 'curriculos')).toBe(1)
      for (const t of ['selecoes', 'participacoes', 'analises_ia', 'entrevistas', 'historico_selecao']) expect(await contar(c, t)).toBe(0)
      await liberar(c, projetoId, usuarioId)
      for (const t of ['selecoes', 'participacoes', 'analises_ia', 'entrevistas', 'historico_selecao']) expect(await contar(c, t)).toBe(1)
    }))

  it('rh lê tudo', () =>
    emTransacao(async (c) => {
      await semente(c)
      await comoUsuario(c, 'rh')
      for (const t of TABELAS) expect(await contar(c, t)).toBe(1)
    }))

  it('ninguém grava direto nas tabelas', () =>
    emTransacao(async (c) => {
      const { sel } = await semente(c)
      await comoUsuario(c, 'rh')
      expect(await erroSalvo(c, () => c.query("insert into candidatos (nome) values ('x')"))).toContain('row-level security')
      expect(await erroSalvo(c, () => c.query("insert into selecoes (projeto_id, funcao, descritivo) select projeto_id, 'f', 'd' from selecoes where id = $1", [sel]))).toContain('row-level security')
      // A análise da IA nunca muda: nem o RH tem o privilégio de alterar ou apagar.
      expect(await erroSalvo(c, () => c.query('update analises_ia set nota = 1'))).toContain('permission denied')
      expect(await erroSalvo(c, () => c.query('delete from analises_ia'))).toContain('permission denied')
    }))

  it('bucket existe e é privado', () =>
    emTransacao(async (c) => {
      const { rows } = await c.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'curriculos'")
      expect(rows[0]).toEqual({ public: false, file_size_limit: '10485760', allowed_mime_types: ['application/pdf'] })
    }))
})

// --- Funções -------------------------------------------------------------------------------------

// Age como o servidor (service_role) e volta para o usuário de antes.
async function comoServidor<T>(c: Client, fn: () => Promise<T>): Promise<T> {
  const { rows } = await c.query("select current_setting('request.jwt.claims', true) as claims")
  await c.query('reset role')
  await c.query("select set_config('request.jwt.claims', '', true)")
  await c.query('set local role service_role')
  try {
    return await fn()
  } finally {
    await c.query('reset role')
    await c.query("select set_config('request.jwt.claims', $1, true)", [rows[0].claims ?? ''])
    await c.query('set local role authenticated')
  }
}

type DadosCand = { nome?: string | null; email?: string | null; telefone?: string | null; cpf?: string | null }

function analise(cand: DadosCand, nota = 80, classificacao = 'parcial') {
  return {
    modelo: 'claude-sonnet-5-5',
    versao_prompt: 'selecao-v1',
    nota,
    classificacao,
    resposta: { nota, classificacao, resumo: 'ok' },
    tokens_entrada: 1000,
    tokens_saida: 200,
    nome_usuario: 'teste-sql servidor',
    candidato: { nome: 'Fulano', email: null, telefone: null, cpf: null, cidade: null, uf: null, ...cand },
  }
}

const registrarAnalise = (c: Client, part: string, cand: DadosCand, nota?: number, cls?: string) =>
  comoServidor(c, async () => (await c.query('select registrar_analise($1, $2) as r', [part, JSON.stringify(analise(cand, nota, cls))])).rows[0].r as string)

let seq = 0
async function novoCurriculo(c: Client, sel: string, arquivo = 'cv.pdf'): Promise<string> {
  seq += 1
  return (await c.query('select registrar_curriculo($1, $2, $3) as id', [sel, `${sel}/${seq}-${Date.now()}.pdf`, arquivo])).rows[0].id
}

// Projeto com um analista que tem acesso; já age como esse analista e com uma seleção criada.
async function cenario(c: Client) {
  const cli = await novoCliente(c)
  const { projetoId } = await novoProjeto(c, { clienteId: cli, organizacao: 'meta' })
  const { usuarioId } = await comoUsuario(c, 'analista')
  await liberar(c, projetoId, usuarioId)
  const sel = (await c.query("select salvar_selecao(null, $1) as id", [JSON.stringify({ projeto_id: projetoId, funcao: 'Caldeireiro', descritivo: 'NR-13 e 5 anos' })])).rows[0].id as string
  return { cli, projetoId, sel }
}

const situacao = async (c: Client, part: string) =>
  (await c.query('select situacao, classificacao, candidato_id, resultado from participacoes where id = $1', [part])).rows[0]

describe('seleção: funções', () => {
  it('analista do projeto cria seleção, registra currículo e inicia análise', () =>
    emTransacao(async (c) => {
      const { sel } = await cenario(c)
      const part = await novoCurriculo(c, sel)
      expect((await situacao(c, part)).situacao).toBe('pendente')
      const { rows } = await c.query('select * from iniciar_analise($1)', [part])
      expect(rows[0].descritivo).toBe('NR-13 e 5 anos')
      expect(rows[0].nome_arquivo).toBe('cv.pdf')
      expect((await situacao(c, part)).situacao).toBe('analisando')
      const h = await c.query('select acao from historico_selecao where selecao_id = $1', [sel])
      expect(h.rows.length).toBeGreaterThanOrEqual(2)
    }))

  it('recusa caminho fora da pasta da seleção e campos vazios', () =>
    emTransacao(async (c) => {
      const { sel, projetoId } = await cenario(c)
      expect(await erroSalvo(c, () => c.query("select registrar_curriculo($1, 'outra/x.pdf', 'x.pdf')", [sel]))).toContain('caminho inválido')
      expect(await erroSalvo(c, () => c.query('select salvar_selecao(null, $1)', [JSON.stringify({ projeto_id: projetoId, funcao: ' ', descritivo: 'x' })]))).toContain('função obrigatória')
      expect(await erroSalvo(c, () => c.query('select salvar_selecao(null, $1)', [JSON.stringify({ projeto_id: projetoId, funcao: 'x', descritivo: '' })]))).toContain('descritivo obrigatório')
    }))

  it('analista sem o projeto recebe sem permissão', () =>
    emTransacao(async (c) => {
      const { sel, projetoId } = await cenario(c)
      const part = await novoCurriculo(c, sel)
      await c.query('reset role')
      await comoUsuario(c, 'analista')
      expect(await erroSalvo(c, () => c.query('select salvar_selecao(null, $1)', [JSON.stringify({ projeto_id: projetoId, funcao: 'x', descritivo: 'y' })]))).toContain('sem permissão')
      expect(await erroSalvo(c, () => c.query("select registrar_curriculo($1, $2, 'x.pdf')", [sel, `${sel}/z.pdf`]))).toContain('sem permissão')
      expect(await erroSalvo(c, () => c.query('select * from iniciar_analise($1)', [part]))).toContain('sem permissão')
      expect(await erroSalvo(c, () => c.query('select definir_resultado($1, $2)', [part, 'reprovado']))).toContain('sem permissão')
    }))

  it('iniciar_analise recusa análise em andamento e retoma depois de 5 minutos', () =>
    emTransacao(async (c) => {
      const { sel } = await cenario(c)
      const part = await novoCurriculo(c, sel)
      await c.query('select * from iniciar_analise($1)', [part])
      expect(await erroSalvo(c, () => c.query('select * from iniciar_analise($1)', [part]))).toContain('análise em andamento')
      await comoServidor(c, () => c.query("update participacoes set analisando_desde = now() - interval '6 minutes' where id = $1", [part]))
      const { rows } = await c.query('select * from iniciar_analise($1)', [part])
      expect(rows).toHaveLength(1)
    }))

  it('authenticated não chama registrar_analise nem falhar_analise', () =>
    emTransacao(async (c) => {
      const { sel } = await cenario(c)
      const part = await novoCurriculo(c, sel)
      expect(await erroSalvo(c, () => c.query('select registrar_analise($1, $2)', [part, JSON.stringify(analise({}))]))).toContain('permission denied')
      expect(await erroSalvo(c, () => c.query("select falhar_analise($1, 'x')", [part]))).toContain('permission denied')
    }))

  it('registrar_analise cria candidato e análise a confirmar', () =>
    emTransacao(async (c) => {
      const { sel } = await cenario(c)
      const part = await novoCurriculo(c, sel)
      expect(await registrarAnalise(c, part, { nome: 'Maria', cpf: '12345678901' }, 78, 'parcial')).toBe('analisada')
      const s = await situacao(c, part)
      expect([s.situacao, s.classificacao]).toEqual(['analisada', 'a_confirmar'])
      const cand = (await c.query('select nome, cpf from candidatos where id = $1', [s.candidato_id])).rows[0]
      expect(cand).toEqual({ nome: 'Maria', cpf: '12345678901' })
      const a = (await c.query('select descritivo, nota, classificacao, modelo from analises_ia where participacao_id = $1', [part])).rows
      expect(a).toEqual([{ descritivo: 'NR-13 e 5 anos', nota: 78, classificacao: 'parcial', modelo: 'claude-sonnet-5-5' }])
      const cv = (await c.query('select candidato_id from curriculos where id = (select curriculo_id from participacoes where id = $1)', [part])).rows[0]
      expect(cv.candidato_id).toBe(s.candidato_id)
    }))

  it('registrar_analise reconhece por CPF e só preenche vazios', () =>
    emTransacao(async (c) => {
      const { sel } = await cenario(c)
      const sel2 = (await c.query('select salvar_selecao(null, $1) as id', [JSON.stringify({ projeto_id: (await c.query('select projeto_id from selecoes where id = $1', [sel])).rows[0].projeto_id, funcao: 'Soldador', descritivo: 'x' })])).rows[0].id
      const p1 = await novoCurriculo(c, sel)
      await registrarAnalise(c, p1, { nome: 'Maria', cpf: '12345678901', email: 'a@x.com' })
      const p2 = await novoCurriculo(c, sel2)
      await registrarAnalise(c, p2, { nome: 'Maria S.', cpf: '12345678901', email: 'b@x.com', telefone: '71999990000' })
      const { rows } = await c.query("select nome, email, telefone from candidatos where cpf = '12345678901'")
      expect(rows).toEqual([{ nome: 'Maria', email: 'a@x.com', telefone: '71999990000' }])
    }))

  it('registrar_analise reconhece por e-mail quando não há CPF', () =>
    emTransacao(async (c) => {
      const { sel, projetoId } = await cenario(c)
      const sel2 = (await c.query('select salvar_selecao(null, $1) as id', [JSON.stringify({ projeto_id: projetoId, funcao: 'Soldador', descritivo: 'x' })])).rows[0].id
      await registrarAnalise(c, await novoCurriculo(c, sel), { email: 'joao@x.com' })
      await registrarAnalise(c, await novoCurriculo(c, sel2), { email: 'joao@x.com' })
      const { rows } = await c.query("select count(*)::int as n from candidatos where email = 'joao@x.com'")
      expect(rows[0].n).toBe(1)
    }))

  it('mesmo candidato duas vezes na mesma seleção vira repetida', () =>
    emTransacao(async (c) => {
      const { sel } = await cenario(c)
      const p1 = await novoCurriculo(c, sel)
      const p2 = await novoCurriculo(c, sel)
      await registrarAnalise(c, p1, { cpf: '11122233344' })
      expect(await registrarAnalise(c, p2, { cpf: '11122233344' })).toBe('repetida')
      expect((await situacao(c, p2)).situacao).toBe('repetida')
      const n = await c.query("select count(*)::int as n from participacoes p join candidatos k on k.id = p.candidato_id where k.cpf = '11122233344' and p.situacao <> 'repetida'")
      expect(n.rows[0].n).toBe(1)
      const a = await c.query('select count(*)::int as n from analises_ia where participacao_id = $1', [p2])
      expect(a.rows[0].n).toBe(0)
    }))

  it('registrar_analise sem nome usa o nome do arquivo', () =>
    emTransacao(async (c) => {
      const { sel } = await cenario(c)
      const part = await novoCurriculo(c, sel, 'digitalizado.pdf')
      await registrarAnalise(c, part, { nome: null })
      const { rows } = await c.query('select nome from candidatos where id = (select candidato_id from participacoes where id = $1)', [part])
      expect(rows[0].nome).toBe('Sem nome (digitalizado.pdf)')
    }))

  it('falhar_analise marca erro e permite tentar de novo', () =>
    emTransacao(async (c) => {
      const { sel } = await cenario(c)
      const part = await novoCurriculo(c, sel)
      await c.query('select * from iniciar_analise($1)', [part])
      await comoServidor(c, () => c.query("select falhar_analise($1, 'IA ocupada')", [part]))
      expect((await c.query('select situacao, erro from participacoes where id = $1', [part])).rows[0]).toEqual({ situacao: 'erro', erro: 'IA ocupada' })
      expect((await c.query('select * from iniciar_analise($1)', [part])).rows).toHaveLength(1)
    }))

  it('confirmar e mudar classificação', () =>
    emTransacao(async (c) => {
      const { sel } = await cenario(c)
      const part = await novoCurriculo(c, sel)
      await registrarAnalise(c, part, {}, 70, 'parcial')
      expect((await c.query('select confirmar_classificacao($1) as n', [[part]])).rows[0].n).toBe(1)
      expect((await situacao(c, part)).classificacao).toBe('parcial')
      expect(await erroSalvo(c, () => c.query("select mudar_classificacao($1, 'nao_aderente', '  ')", [part]))).toContain('justificativa obrigatória')
      expect(await erroSalvo(c, () => c.query('select mudar_classificacao($1, $2, $3)', [part, 'nao_aderente', 'x'.repeat(501)]))).toContain('justificativa longa demais')
      await c.query("select mudar_classificacao($1, 'nao_aderente', 'Sem NR-13 válida')", [part])
      expect((await situacao(c, part)).classificacao).toBe('nao_aderente')
      const { rows } = await c.query("select detalhe from historico_selecao where participacao_id = $1 and acao like 'Mudou%'", [part])
      expect(rows[0].detalhe).toEqual({ de: 'parcial', para: 'nao_aderente', justificativa: 'Sem NR-13 válida' })
    }))

  it('reanalisar volta a pendente e a nova análise volta a a_confirmar, mantendo a anterior', () =>
    emTransacao(async (c) => {
      const { sel } = await cenario(c)
      const part = await novoCurriculo(c, sel)
      await registrarAnalise(c, part, { cpf: '99988877766' }, 70, 'parcial')
      await c.query('select confirmar_classificacao($1)', [[part]])
      await c.query('select reanalisar($1)', [[part]])
      expect((await situacao(c, part)).situacao).toBe('pendente')
      await c.query('select * from iniciar_analise($1)', [part])
      expect(await registrarAnalise(c, part, { cpf: '99988877766' }, 90, 'aderente')).toBe('analisada')
      expect((await situacao(c, part)).classificacao).toBe('a_confirmar')
      const n = await c.query('select count(*)::int as n from analises_ia where participacao_id = $1', [part])
      expect(n.rows[0].n).toBe(2)
    }))

  it('incluir_do_banco usa o currículo mais recente e ignora quem já está', () =>
    emTransacao(async (c) => {
      const { sel, projetoId } = await cenario(c)
      const sel2 = (await c.query('select salvar_selecao(null, $1) as id', [JSON.stringify({ projeto_id: projetoId, funcao: 'Soldador', descritivo: 'x' })])).rows[0].id
      const p1 = await novoCurriculo(c, sel, 'antigo.pdf')
      await registrarAnalise(c, p1, { cpf: '55566677788' })
      const cand = (await situacao(c, p1)).candidato_id
      const p2 = await novoCurriculo(c, sel2, 'novo.pdf')
      await comoServidor(c, () => c.query("update curriculos set enviado_em = now() + interval '1 day' where id = (select curriculo_id from participacoes where id = $1)", [p2]))
      await registrarAnalise(c, p2, { cpf: '55566677788' })
      const sel3 = (await c.query('select salvar_selecao(null, $1) as id', [JSON.stringify({ projeto_id: projetoId, funcao: 'Montador', descritivo: 'x' })])).rows[0].id
      expect((await c.query('select incluir_do_banco($1, $2) as n', [sel3, [cand]])).rows[0].n).toBe(1)
      expect((await c.query('select incluir_do_banco($1, $2) as n', [sel3, [cand]])).rows[0].n).toBe(0)
      const { rows } = await c.query('select p.situacao, p.do_banco, p.candidato_id, k.nome_arquivo from participacoes p join curriculos k on k.id = p.curriculo_id where p.selecao_id = $1', [sel3])
      expect(rows).toEqual([{ situacao: 'pendente', do_banco: true, candidato_id: cand, nome_arquivo: 'novo.pdf' }])
    }))

  it('entrevista: editar guarda a versão anterior no histórico', () =>
    emTransacao(async (c) => {
      const { sel } = await cenario(c)
      const part = await novoCurriculo(c, sel)
      await registrarAnalise(c, part, {})
      const dados = { tipo: 'timenow', data: '2026-11-25', entrevistador: 'Ana', parecer: 'recomendado', impressoes: 'Boa comunicação' }
      const id = (await c.query('select salvar_entrevista(null, $1, $2) as id', [part, JSON.stringify(dados)])).rows[0].id
      await c.query('select salvar_entrevista($1, $2, $3)', [id, part, JSON.stringify({ ...dados, parecer: 'ressalvas' })])
      expect((await c.query('select parecer, alterado_em is not null as alterada from entrevistas where id = $1', [id])).rows[0]).toEqual({ parecer: 'ressalvas', alterada: true })
      const { rows } = await c.query("select detalhe from historico_selecao where participacao_id = $1 and acao like 'Corrigiu%'", [part])
      expect(rows[0].detalhe.antes.parecer).toBe('recomendado')
    }))

  it('definir_resultado grava e registra', () =>
    emTransacao(async (c) => {
      const { sel } = await cenario(c)
      const part = await novoCurriculo(c, sel)
      await registrarAnalise(c, part, {})
      await c.query("select definir_resultado($1, 'aprovado_nao_escolhido')", [part])
      expect((await situacao(c, part)).resultado).toBe('aprovado_nao_escolhido')
    }))

  it('buscar_candidatos: analista vê candidato de projeto alheio, filtra por resultado, e só o resumo', () =>
    emTransacao(async (c) => {
      const { sel } = await cenario(c)
      const part = await novoCurriculo(c, sel)
      await registrarAnalise(c, part, { nome: 'Carlos Busca', cpf: '22233344455' }, 88, 'aderente')
      await c.query("select definir_resultado($1, 'aprovado_nao_escolhido')", [part])
      const cand = (await situacao(c, part)).candidato_id
      await c.query('reset role')
      await comoUsuario(c, 'analista')
      const achou = await c.query('select * from buscar_candidatos($1)', [JSON.stringify({ resultado: 'aprovado_nao_escolhido', nome: 'carlos busca' })])
      expect(achou.rows.map((r) => r.id)).toEqual([cand])
      expect(achou.rows[0].funcoes).toEqual(['Caldeireiro'])
      expect(achou.rows[0].melhor_nota).toBe(88)
      const nada = await c.query('select * from buscar_candidatos($1)', [JSON.stringify({ resultado: 'reprovado', nome: 'carlos busca' })])
      expect(nada.rows).toEqual([])
      const parts = await c.query('select funcao, nota, resultado, detalhe_visivel from participacoes_do_candidato($1)', [cand])
      expect(parts.rows).toEqual([{ funcao: 'Caldeireiro', nota: 88, resultado: 'aprovado_nao_escolhido', detalhe_visivel: false }])
    }))

  it('gestor não usa a busca do banco', () =>
    emTransacao(async (c) => {
      await comoUsuario(c, 'gestor')
      expect(await erroSalvo(c, () => c.query("select * from buscar_candidatos('{}')"))).toContain('sem permissão')
    }))

  it('excluir_candidato: analista recebe sem permissão; rh apaga tudo e grava o registro geral sem o nome', () =>
    emTransacao(async (c) => {
      const { sel } = await cenario(c)
      const part = await novoCurriculo(c, sel)
      await registrarAnalise(c, part, { nome: 'Nome Secreto' })
      const cand = (await situacao(c, part)).candidato_id
      const caminho = (await c.query('select caminho from curriculos where candidato_id = $1', [cand])).rows[0].caminho
      expect(await erroSalvo(c, () => c.query('select excluir_candidato($1)', [cand]))).toContain('sem permissão')
      await c.query('reset role')
      await comoUsuario(c, 'rh')
      const { rows } = await c.query('select excluir_candidato($1) as caminhos', [cand])
      expect(rows[0].caminhos).toEqual([caminho])
      expect((await c.query('select count(*)::int as n from candidatos where id = $1', [cand])).rows[0].n).toBe(0)
      expect((await c.query('select count(*)::int as n from participacoes where id = $1', [part])).rows[0].n).toBe(0)
      const h = await c.query("select acao from historico where vaga_id is null and acao like 'Excluiu um candidato%' order by em desc limit 1")
      expect(h.rows[0].acao).not.toContain('Nome Secreto')
    }))
})

describe('seleção: análises ao mesmo tempo', () => {
  // A fila analisa 3 currículos por vez: o mesmo candidato em duas análises simultâneas não pode
  // virar dois cadastros. registrar_analise segura uma trava pelo CPF (ou e-mail) até o fim da transação.
  it('registrar_analise trava o CPF do candidato até o fim da transação', () =>
    emTransacao(async (c) => {
      const { sel } = await cenario(c)
      const part = await novoCurriculo(c, sel)
      await registrarAnalise(c, part, { cpf: '77788899900' })
      const outra = conexao()
      await outra.connect()
      try {
        const { rows } = await outra.query("select pg_try_advisory_xact_lock(hashtext('candidato:77788899900')) as livre")
        expect(rows[0].livre).toBe(false)
      } finally {
        await outra.end()
      }
    }))
})
