import type { Client } from 'pg'
import { describe, expect, it } from 'vitest'
import { comoUsuario, emTransacao, etapasDoProjeto, novoCliente, novoProjeto } from './apoio'

const erro = async (p: Promise<unknown>) => {
  try {
    await p
    return null
  } catch (e) {
    return (e as Error).message
  }
}

async function erroSalvo(c: Client, p: () => Promise<unknown>): Promise<string | null> {
  await c.query('savepoint s')
  const msg = await erro(p())
  await c.query('rollback to savepoint s')
  return msg
}

const etapasDoCliente = async (c: Client, clienteId: string) =>
  (await c.query('select id, posicao, nome, fixa, padrao, duracao from cliente_etapas where cliente_id = $1 order by posicao', [clienteId])).rows

// Cliente criado pela função do banco (como a tela faz), já agindo como Administrador.
async function clienteNovo(c: Client): Promise<string> {
  const { rows } = await c.query("select salvar_cliente(null, 'teste-sql Cliente novo') as id")
  return rows[0].id
}

describe('etapas padrão do cliente', () => {
  it('os clientes existentes ganham as 13 etapas padrão', () =>
    emTransacao(async (c) => {
      const { rows } = await c.query(
        `select count(*) filter (where n <> 13) as fora from (select c.id, count(e.id) n from clientes c left join cliente_etapas e on e.cliente_id = c.id group by c.id) x`,
      )
      expect(Number(rows[0].fora)).toBe(0)
    }))

  it('cliente novo nasce com as 13 e as obrigatórias marcadas', () =>
    emTransacao(async (c) => {
      await comoUsuario(c, 'rh')
      const id = await clienteNovo(c)
      const etapas = await etapasDoCliente(c, id)
      expect(etapas).toHaveLength(13)
      expect(etapas.find((e) => e.posicao === 2)?.fixa).toBe('captura')
      expect(etapas.find((e) => e.posicao === 11)?.fixa).toBe('admissao')
    }))

  it('projeto novo copia a lista do cliente e os existentes não mudam', () =>
    emTransacao(async (c) => {
      const clienteId = await novoCliente(c)
      await c.query(
        `insert into cliente_etapas (cliente_id, posicao, nome, duracao, padrao, fixa)
         select $1, ordem, nome, null, ordem, case ordem when 2 then 'captura' when 11 then 'admissao' end from etapas`,
        [clienteId],
      )
      const antigo = await novoProjeto(c, { clienteId, organizacao: 'meta' })
      await comoUsuario(c, 'rh')
      const lista = await etapasDoCliente(c, clienteId)
      const treinamento = lista.find((e) => e.nome === 'Treinamento')!
      const ambientacao = lista.find((e) => e.nome === 'Ambientação/TBS')!
      await c.query('select excluir_etapa_cliente($1)', [treinamento.id])
      await c.query('select incluir_etapa_cliente($1, $2, 2::smallint, $3)', [clienteId, 'Cadastro no eSocial', ambientacao.id])
      const { rows } = await c.query("select salvar_projeto(null, jsonb_build_object('cliente_id', $1::text, 'nome', 'teste-sql Novo', 'organizacao', 'meta')) as id", [clienteId])
      const novo = await etapasDoProjeto(c, rows[0].id)
      expect(novo.map((e) => e.nome)).not.toContain('Treinamento')
      expect(novo.find((e) => e.posicao === 11)?.nome).toBe('Cadastro no eSocial')
      expect(novo).toHaveLength(13)
      const { rows: d } = await c.query("select duracao from projeto_etapas where projeto_id = $1 and nome = 'Cadastro no eSocial'", [rows[0].id])
      expect(d[0].duracao).toBe(2)
      const velho = await etapasDoProjeto(c, antigo.projetoId)
      expect(velho.map((e) => e.nome)).toContain('Treinamento')
    }))

  it('obrigatórias não saem nem mudam de nome e a ordem é respeitada', () =>
    emTransacao(async (c) => {
      await comoUsuario(c, 'rh')
      const id = await clienteNovo(c)
      const lista = await etapasDoCliente(c, id)
      const captura = lista.find((e) => e.fixa === 'captura')!
      expect(await erroSalvo(c, () => c.query('select excluir_etapa_cliente($1)', [captura.id]))).toContain('etapa obrigatória')
      expect(await erroSalvo(c, () => c.query("select renomear_etapa_cliente($1, 'Outra')", [captura.id]))).toContain('etapa obrigatória')
      expect(await erroSalvo(c, () => c.query('select mover_etapa_cliente($1, 12::smallint)', [captura.id]))).toContain('ordem das obrigatórias')
      expect(await erroSalvo(c, () => c.query("select incluir_etapa_cliente($1, 'triagem de candidatos', 1::smallint, null)", [id]))).toContain('etapa repetida')
      const triagem = lista.find((e) => e.posicao === 3)!
      await c.query('select mover_etapa_cliente($1, 1::smallint)', [triagem.id])
      expect((await etapasDoCliente(c, id))[0].nome).toBe('Triagem de Candidatos')
    }))

  it('duração de etapa padrão vai para as durações do cliente; a da incluída fica na linha', () =>
    emTransacao(async (c) => {
      await comoUsuario(c, 'rh')
      const id = await clienteNovo(c)
      const lista = await etapasDoCliente(c, id)
      const exames = lista.find((e) => e.posicao === 9)!
      await c.query('select alterar_duracao_etapa_cliente($1, 4::smallint)', [exames.id])
      const { rows } = await c.query('select duracao from cliente_duracoes where cliente_id = $1 and ordem = 9', [id])
      expect(rows[0].duracao).toBe(4)
      const nova = (await c.query("select incluir_etapa_cliente($1, 'Cadastro em sistema', 1::smallint, null) as id", [id])).rows[0].id
      await c.query('select alterar_duracao_etapa_cliente($1, 3::smallint)', [nova])
      expect((await c.query('select duracao from cliente_etapas where id = $1', [nova])).rows[0].duracao).toBe(3)
      expect(await erroSalvo(c, () => c.query('select alterar_duracao_etapa_cliente($1, null)', [nova]))).toContain('duração obrigatória')
    }))

  it('analista não mexe nas etapas do cliente nem exclui cliente', () =>
    emTransacao(async (c) => {
      const clienteId = await novoCliente(c)
      await comoUsuario(c, 'analista')
      expect(await erroSalvo(c, () => c.query("select incluir_etapa_cliente($1, 'X', 1::smallint, null)", [clienteId]))).toContain('sem permissão')
      expect(await erroSalvo(c, () => c.query('select excluir_cliente($1)', [clienteId]))).toContain('sem permissão')
    }))
})

describe('excluir cliente', () => {
  it('recusa cliente com projeto', () =>
    emTransacao(async (c) => {
      const clienteId = await novoCliente(c)
      await novoProjeto(c, { clienteId, organizacao: 'meta' })
      await comoUsuario(c, 'rh')
      expect(await erroSalvo(c, () => c.query('select excluir_cliente($1)', [clienteId]))).toContain('cliente tem projetos')
    }))

  it('recusa cliente com usuário ligado', () =>
    emTransacao(async (c) => {
      const clienteId = await novoCliente(c)
      await comoUsuario(c, 'cliente', clienteId)
      await c.query('reset role')
      await comoUsuario(c, 'rh')
      expect(await erroSalvo(c, () => c.query('select excluir_cliente($1)', [clienteId]))).toContain('cliente tem usuários')
    }))

  it('exclui cliente sem projeto, com gestores e etapas', () =>
    emTransacao(async (c) => {
      await comoUsuario(c, 'rh')
      const id = await clienteNovo(c)
      await c.query("insert into gestores (nome, cliente_id) values ('teste-sql Gestor', $1)", [id])
      await c.query('select excluir_cliente($1)', [id])
      for (const t of ['clientes where id', 'gestores where cliente_id', 'cliente_etapas where cliente_id', 'cliente_duracoes where cliente_id']) {
        expect(Number((await c.query(`select count(*) n from ${t} = $1`, [id])).rows[0].n)).toBe(0)
      }
      expect(Number((await c.query("select count(*) n from historico where vaga_id is null and acao = 'Excluiu o cliente teste-sql Cliente novo'")).rows[0].n)).toBe(1)
    }))
})
