import { randomUUID } from 'node:crypto'
import type { Client } from 'pg'
import { describe, expect, it } from 'vitest'
import { comoUsuario, emTransacao, novaVaga, novoCliente, novoProjeto } from './apoio'

const erro = async (p: Promise<unknown>) => {
  try {
    await p
    return null
  } catch (e) {
    return (e as Error).message
  }
}

// Erro esperado dentro da transação do teste: o savepoint deixa a transação seguir depois dele.
async function erroSalvo(c: Client, p: () => Promise<unknown>): Promise<string | null> {
  await c.query('savepoint s')
  const msg = await erro(p())
  await c.query('rollback to savepoint s')
  return msg
}

// Libera o projeto para o usuário com o papel do banco e volta a agir como o usuário de antes.
async function liberar(c: Client, projetoId: string, usuarioId: string): Promise<void> {
  await c.query('reset role')
  await c.query('insert into projeto_acessos (projeto_id, usuario_id) values ($1, $2)', [projetoId, usuarioId])
  await c.query('set local role authenticated')
}

async function braskem(c: Client): Promise<string> {
  const { rows } = await c.query("select id from clientes where nome = 'Braskem'")
  return rows[0].id
}

const contar = async (c: Client, sql: string, params: unknown[] = []) => Number((await c.query(sql, params)).rows[0].n)

describe('migração da Braskem 2027', () => {
  it('a migração põe as vagas reais na Braskem 2027 sem perder nada', async () => {
    let antes: { vagas: number; conclusoes: number; historico: number; lista: unknown[] } | undefined
    await emTransacao(
      async (c) => {
        const { rows: projeto } = await c.query(
          "select p.id, c.nome as cliente, p.organizacao from projetos p join clientes c on c.id = p.cliente_id where p.nome = 'Mobilização Braskem 2027'",
        )
        expect(projeto).toEqual([{ id: expect.any(String), cliente: 'Braskem', organizacao: 'ondas' }])
        expect(await contar(c, 'select count(*) as n from vagas where projeto_id is distinct from $1', [projeto[0].id])).toBe(0)
        const { rows: ondas } = await c.query('select nome, projeto_id from ondas order by nome')
        expect(ondas.map((o) => o.nome)).toEqual(['1ª Onda', '2ª Onda', '3ª Onda', '4ª Onda'])
        for (const o of ondas) expect(o.projeto_id).toBe(projeto[0].id)
        expect(await contar(c, 'select count(*) as n from vagas')).toBe(antes!.vagas)
        expect(await contar(c, 'select count(*) as n from vaga_conclusoes')).toBe(antes!.conclusoes)
        expect(await contar(c, 'select count(*) as n from historico')).toBe(antes!.historico)
        const { rows: lista } = await c.query('select vaga_id, ordem, concluida_em from vaga_conclusoes order by vaga_id, ordem')
        expect(lista).toEqual(antes!.lista)
        // As durações da Braskem são as de hoje.
        expect(
          await contar(
            c,
            'select count(*) as n from etapas e join cliente_duracoes d on d.ordem = e.ordem and d.duracao = e.duracao where d.cliente_id = $1',
            [await braskem(c)],
          ),
        ).toBe(13)
        expect(await contar(c, 'select count(*) as n from gestores where cliente_id is distinct from $1', [await braskem(c)])).toBe(0)
      },
      async (c) => {
        antes = {
          vagas: await contar(c, 'select count(*) as n from vagas'),
          conclusoes: await contar(c, 'select count(*) as n from vaga_conclusoes'),
          historico: await contar(c, 'select count(*) as n from historico'),
          lista: (await c.query('select vaga_id, ordem, concluida_em from vaga_conclusoes order by vaga_id, ordem')).rows,
        }
      },
    )
  })

  it('depois da limpeza não existe vaga sem projeto', () =>
    emTransacao(async (c) => {
      expect(await erroSalvo(c, () => c.query("insert into vagas (funcao, disciplina, area, data_inicio) values ('teste-sql Vaga', 'x', 'x', '2026-10-22')"))).toMatch(/null value|not-null/)
      // Nem a onda preenche o projeto: o código novo informa o projeto.
      expect(
        await erroSalvo(c, () =>
          c.query("insert into vagas (funcao, disciplina, area, onda_id, data_inicio) select 'teste-sql Vaga', 'x', 'x', id, '2026-10-22' from ondas limit 1"),
        ),
      ).toMatch(/null value|not-null/)
      const { rows } = await c.query("select is_nullable from information_schema.columns where table_name = 'ondas' and column_name in ('projeto_id', 'nome')")
      expect(rows.map((r) => r.is_nullable)).toEqual(['NO', 'NO'])
      expect(await contar(c, "select count(*) as n from information_schema.columns where table_name = 'ondas' and column_name = 'numero'")).toBe(0)
    }))

  it('perfil visualizador não existe mais', () =>
    emTransacao(async (c) => {
      const id = randomUUID()
      await c.query('insert into auth.users (id, email) values ($1, $2)', [id, `teste-sql-${id}@exemplo.test`])
      expect(
        await erroSalvo(c, () =>
          c.query("insert into usuarios (usuario_id, nome, email, perfil) values ($1, 'teste-sql v', $2, 'visualizador')", [id, `teste-sql-${id}@exemplo.test`]),
        ),
      ).toMatch(/usuarios_perfil_check/)
    }))

  it('as funções do modelo antigo saíram', () =>
    emTransacao(async (c) => {
      expect(
        await contar(c, "select count(*) as n from pg_proc where pronamespace = 'public'::regnamespace and proname in ('salvar_onda', 'alterar_duracao', 'importar_carga')"),
      ).toBe(0)
    }))
})

describe('leitura por projeto', () => {
  it('cliente só vê os projetos liberados', () =>
    emTransacao(async (c) => {
      const cli = await braskem(c)
      const p1 = await novoProjeto(c, { clienteId: cli, organizacao: 'ondas' })
      const p2 = await novoProjeto(c, { clienteId: cli, organizacao: 'meta' })
      const v1 = await novaVaga(c, { projetoId: p1.projetoId, ondaId: p1.ondaId })
      const v2 = await novaVaga(c, { projetoId: p2.projetoId, meta: '2026-12-01' })
      await c.query("insert into vaga_conclusoes (vaga_id, ordem, concluida_em) values ($1, 1, '2026-10-22'), ($2, 1, '2026-10-22')", [v1, v2])
      await c.query("insert into historico (vaga_id, nome_usuario, acao) values (null, 'teste-sql', 'geral'), ($1, 'teste-sql', 'da vaga 2')", [v2])
      const { usuarioId } = await comoUsuario(c, 'cliente', cli)
      await liberar(c, p1.projetoId, usuarioId)

      expect((await c.query('select id from projetos')).rows).toEqual([{ id: p1.projetoId }])
      expect((await c.query('select id from vagas')).rows).toEqual([{ id: v1 }])
      expect((await c.query('select distinct projeto_id from ondas')).rows).toEqual([{ projeto_id: p1.projetoId }])
      expect((await c.query('select vaga_id from vaga_conclusoes')).rows).toEqual([{ vaga_id: v1 }])
      expect(await contar(c, 'select count(*) as n from historico where vaga_id is null')).toBe(0)
      expect(await contar(c, 'select count(*) as n from historico where vaga_id = $1', [v2])).toBe(0)
      expect((await c.query('select id from clientes')).rows).toEqual([{ id: cli }])
      expect((await c.query('select id from usuarios')).rows).toEqual([{ id: usuarioId }])
      expect((await c.query('select projeto_id from projeto_acessos')).rows).toEqual([{ projeto_id: p1.projetoId }])
    }))

  it('sem acesso, o gestor não vê nada dos projetos nem a lista de clientes', () =>
    emTransacao(async (c) => {
      const { projetoId, ondaId } = await novoProjeto(c, { clienteId: await novoCliente(c), organizacao: 'ondas' })
      await novaVaga(c, { projetoId, ondaId })
      await comoUsuario(c, 'gestor')
      for (const t of ['projetos', 'vagas', 'ondas', 'vaga_conclusoes', 'historico', 'clientes', 'cliente_duracoes', 'gestores', 'projeto_duracoes', 'projeto_acessos']) {
        expect(await contar(c, `select count(*) as n from ${t}`), t).toBe(0)
      }
      expect(await contar(c, 'select count(*) as n from etapas')).toBe(13)
    }))

  it('gestor vê projetos de clientes diferentes', () =>
    emTransacao(async (c) => {
      const a = await novoProjeto(c, { clienteId: await novoCliente(c), organizacao: 'ondas' })
      const b = await novoProjeto(c, { clienteId: await novoCliente(c), organizacao: 'meta' })
      const { usuarioId } = await comoUsuario(c, 'gestor')
      await liberar(c, a.projetoId, usuarioId)
      await liberar(c, b.projetoId, usuarioId)
      const { rows } = await c.query('select id from projetos order by id')
      expect(rows.map((r) => r.id).sort()).toEqual([a.projetoId, b.projetoId].sort())
      expect(await contar(c, 'select count(*) as n from clientes')).toBe(2)
    }))

  for (const perfil of ['gestor', 'cliente'] as const) {
    it(`gestor e cliente não escrevem (${perfil})`, () =>
      emTransacao(async (c) => {
        const cli = await novoCliente(c)
        const { projetoId, ondaId } = await novoProjeto(c, { clienteId: cli, organizacao: 'ondas' })
        const vaga = await novaVaga(c, { projetoId, ondaId })
        const { usuarioId } = await comoUsuario(c, perfil, perfil === 'cliente' ? cli : undefined)
        await liberar(c, projetoId, usuarioId)
        expect(
          await erroSalvo(c, () =>
            c.query("insert into vagas (funcao, disciplina, area, projeto_id, onda_id, data_inicio) values ('x', 'x', 'x', $1, $2, '2026-10-22')", [projetoId, ondaId]),
          ),
        ).toMatch(/row-level security/)
        expect(await erroSalvo(c, () => c.query("select concluir_etapa($1, 1::smallint, '2026-10-22'::date)", [vaga]))).toContain('sem permissão')
        expect(await erroSalvo(c, () => c.query('select salvar_projeto(null, $1)', [{ cliente_id: cli, nome: 'x', organizacao: 'meta' }]))).toContain('sem permissão')
      }))
  }
})

describe('acessos', () => {
  it('acesso de cliente a projeto de outro cliente é recusado', () =>
    emTransacao(async (c) => {
      const a = await novoCliente(c)
      const { projetoId } = await novoProjeto(c, { clienteId: await novoCliente(c), organizacao: 'meta' })
      const cliente = await comoUsuario(c, 'cliente', a)
      await c.query('reset role')
      const rh = await comoUsuario(c, 'rh')
      expect(await erroSalvo(c, () => c.query('insert into projeto_acessos (projeto_id, usuario_id) values ($1, $2)', [projetoId, cliente.usuarioId]))).toContain(
        'cliente diferente',
      )
      expect(await erroSalvo(c, () => c.query('insert into projeto_acessos (projeto_id, usuario_id) values ($1, $2)', [projetoId, rh.usuarioId]))).toContain(
        'perfil sem acesso por projeto',
      )
    }))

  it('usuário cliente precisa de cliente, e os outros perfis não têm', () =>
    emTransacao(async (c) => {
      expect(await erroSalvo(c, () => comoUsuario(c, 'cliente'))).toMatch(/check/)
      expect(await erroSalvo(c, async () => comoUsuario(c, 'gestor', await novoCliente(c)))).toMatch(/check/)
    }))

  it('trocar o cliente do usuário remove os acessos que deixam de valer', () =>
    emTransacao(async (c) => {
      const a = await novoCliente(c)
      const b = await novoCliente(c)
      const pa = await novoProjeto(c, { clienteId: a, organizacao: 'meta' })
      const pb = await novoProjeto(c, { clienteId: b, organizacao: 'meta' })
      const cliente = await comoUsuario(c, 'cliente', a)
      await liberar(c, pa.projetoId, cliente.usuarioId)
      await c.query('reset role')
      const gestor = await comoUsuario(c, 'gestor')
      await liberar(c, pa.projetoId, gestor.usuarioId)
      await liberar(c, pb.projetoId, gestor.usuarioId)
      await c.query('reset role')
      await comoUsuario(c, 'rh')
      const acessos = async (u: string) => (await c.query('select projeto_id from projeto_acessos where usuario_id = $1', [u])).rows.map((r) => r.projeto_id)

      await c.query('update usuarios set cliente_id = $2 where id = $1', [cliente.usuarioId, b])
      expect(await acessos(cliente.usuarioId)).toEqual([])

      await c.query("update usuarios set perfil = 'cliente', cliente_id = $2 where id = $1", [gestor.usuarioId, a])
      expect(await acessos(gestor.usuarioId)).toEqual([pa.projetoId])

      await c.query("update usuarios set perfil = 'rh', cliente_id = null where id = $1", [gestor.usuarioId])
      expect(await acessos(gestor.usuarioId)).toEqual([])
    }))
})

describe('durações', () => {
  it('duração do cliente não muda projeto que ajustou a etapa', () =>
    emTransacao(async (c) => {
      const cli = await novoCliente(c)
      const { projetoId: p1 } = await novoProjeto(c, { clienteId: cli, organizacao: 'meta' })
      await comoUsuario(c, 'rh')
      await c.query('select alterar_duracao_projeto($1, 9::smallint, 3::smallint)', [p1])
      await c.query('select alterar_duracao_cliente($1, 9::smallint, 5::smallint)', [cli])
      expect((await c.query('select duracao from projeto_duracoes where projeto_id = $1 and ordem = 9', [p1])).rows).toEqual([{ duracao: 3 }])
      expect((await c.query('select duracao from cliente_duracoes where cliente_id = $1 and ordem = 9', [cli])).rows).toEqual([{ duracao: 5 }])
      await c.query('select alterar_duracao_projeto($1, 9::smallint, null)', [p1])
      expect(await contar(c, 'select count(*) as n from projeto_duracoes where projeto_id = $1', [p1])).toBe(0)
      const { rows } = await c.query("select detalhe from historico where vaga_id is null and nome_usuario = 'teste-sql rh' order by em, detalhe->>'depois'")
      expect(rows).toHaveLength(3)
    }))

  it('salvar_cliente copia as durações das etapas', () =>
    emTransacao(async (c) => {
      await comoUsuario(c, 'rh')
      const { rows } = await c.query("select salvar_cliente(null, 'teste-sql Cliente') as id")
      expect(
        await contar(c, 'select count(*) as n from etapas e join cliente_duracoes d on d.ordem = e.ordem and d.duracao = e.duracao where d.cliente_id = $1', [rows[0].id]),
      ).toBe(13)
    }))
})

describe('projeto encerrado', () => {
  it('projeto encerrado recusa escrita', () =>
    emTransacao(async (c) => {
      const { projetoId, ondaId } = await novoProjeto(c, { clienteId: await novoCliente(c), organizacao: 'ondas' })
      const vaga = await novaVaga(c, { projetoId, ondaId })
      await comoUsuario(c, 'rh')
      await c.query('select encerrar_projeto($1)', [projetoId])
      expect(await erroSalvo(c, () => c.query("select concluir_etapa($1, 1::smallint, '2026-10-22'::date)", [vaga]))).toContain('projeto encerrado')
      expect(await erroSalvo(c, () => c.query('select alterar_duracao_projeto($1, 9::smallint, 3::smallint)', [projetoId]))).toContain('projeto encerrado')
      expect(await erroSalvo(c, () => c.query("select salvar_onda_projeto($1, $2, '1ª Onda', '2026-10-22', '2027-01-31')", [ondaId, projetoId]))).toContain(
        'projeto encerrado',
      )
      expect(await erroSalvo(c, () => c.query('select cancelar_vaga($1)', [vaga]))).toContain('projeto encerrado')
      await c.query('select reabrir_projeto($1)', [projetoId])
      await c.query("select concluir_etapa($1, 1::smallint, '2026-10-22'::date)", [vaga])
      expect(await contar(c, 'select count(*) as n from vaga_conclusoes where vaga_id = $1', [vaga])).toBe(1)
    }))
})

describe('vagas e organização do projeto', () => {
  it('vaga de projeto por ondas exige onda do mesmo projeto', () =>
    emTransacao(async (c) => {
      const cli = await novoCliente(c)
      const p = await novoProjeto(c, { clienteId: cli, organizacao: 'ondas' })
      const outro = await novoProjeto(c, { clienteId: cli, organizacao: 'ondas' })
      expect(await erroSalvo(c, () => novaVaga(c, { projetoId: p.projetoId, ondaId: null }))).toContain('onda obrigatória')
      expect(await erroSalvo(c, () => novaVaga(c, { projetoId: p.projetoId, ondaId: outro.ondaId }))).toContain('onda de outro projeto')
      await novaVaga(c, { projetoId: p.projetoId, ondaId: p.ondaId })
    }))

  it('vaga de projeto meta exige meta e recusa onda', () =>
    emTransacao(async (c) => {
      const cli = await novoCliente(c)
      const p = await novoProjeto(c, { clienteId: cli, organizacao: 'meta' })
      const comOndas = await novoProjeto(c, { clienteId: cli, organizacao: 'ondas' })
      expect(await erroSalvo(c, () => novaVaga(c, { projetoId: p.projetoId }))).toContain('meta obrigatória')
      expect(await erroSalvo(c, () => novaVaga(c, { projetoId: p.projetoId, meta: '2026-12-01', ondaId: comOndas.ondaId }))).toContain('projeto sem ondas')
      await comoUsuario(c, 'rh')
      expect(await erroSalvo(c, () => c.query("select salvar_onda_projeto(null, $1, '1ª Onda', '2026-10-22', '2026-12-31')", [p.projetoId]))).toContain(
        'projeto sem ondas',
      )
      // Pela função, com disciplina e área vazias.
      const { rows } = await c.query('select salvar_vaga(null, $1) as id', [
        { projeto_id: p.projetoId, funcao: 'Eletricista', meta: '2026-12-01', data_inicio: '2026-10-22' },
      ])
      const { rows: vaga } = await c.query('select disciplina, area, meta::text, onda_id from vagas where id = $1', [rows[0].id])
      expect(vaga).toEqual([{ disciplina: '', area: '', meta: '2026-12-01', onda_id: null }])
      await c.query('select salvar_vaga($1, $2)', [rows[0].id, { funcao: 'Eletricista', meta: '2026-12-15', data_inicio: '2026-10-22' }])
      const { rows: hist } = await c.query("select detalhe from historico where vaga_id = $1 and acao = 'Editou a vaga'", [rows[0].id])
      expect(hist[0].detalhe.antes.meta).toBe('2026-12-01')
      expect(hist[0].detalhe.depois.meta).toBe('2026-12-15')
    }))

  it('trocar a organização com vagas é recusado', () =>
    emTransacao(async (c) => {
      const cli = await novoCliente(c)
      const { projetoId, ondaId } = await novoProjeto(c, { clienteId: cli, organizacao: 'ondas', nome: 'teste-sql P' })
      await novaVaga(c, { projetoId, ondaId })
      await comoUsuario(c, 'rh')
      expect(await erroSalvo(c, () => c.query('select salvar_projeto($1, $2)', [projetoId, { cliente_id: cli, nome: 'teste-sql P', organizacao: 'meta' }]))).toContain(
        'projeto tem vagas',
      )
      await c.query('select salvar_projeto($1, $2)', [projetoId, { cliente_id: cli, nome: 'teste-sql P2', area: 'Manutenção', organizacao: 'ondas' }])
      expect((await c.query('select nome, area from projetos where id = $1', [projetoId])).rows).toEqual([{ nome: 'teste-sql P2', area: 'Manutenção' }])
    }))

  it('cliente do projeto não muda', () =>
    emTransacao(async (c) => {
      const { projetoId } = await novoProjeto(c, { clienteId: await novoCliente(c), organizacao: 'meta', nome: 'teste-sql P' })
      const outro = await novoCliente(c)
      await comoUsuario(c, 'rh')
      expect(await erroSalvo(c, () => c.query('select salvar_projeto($1, $2)', [projetoId, { cliente_id: outro, nome: 'teste-sql P', organizacao: 'meta' }]))).toContain(
        'cliente não muda',
      )
    }))

  it('update direto na tabela também não troca o cliente nem a organização com vagas', () =>
    emTransacao(async (c) => {
      const cli = await novoCliente(c)
      const outro = await novoCliente(c)
      const { projetoId, ondaId } = await novoProjeto(c, { clienteId: cli, organizacao: 'ondas' })
      const vaga = await novaVaga(c, { projetoId, ondaId })
      const { projetoId: vazio } = await novoProjeto(c, { clienteId: cli, organizacao: 'ondas' })
      await comoUsuario(c, 'rh')
      expect(await erroSalvo(c, () => c.query('update projetos set cliente_id = $2 where id = $1', [projetoId, outro]))).toContain('cliente não muda')
      expect(await erroSalvo(c, () => c.query("update projetos set organizacao = 'meta' where id = $1", [projetoId]))).toContain('projeto tem vagas')
      // Sem vagas (ou só com vagas canceladas), a organização pode mudar.
      await c.query("update projetos set organizacao = 'meta' where id = $1", [vazio])
      await c.query('select cancelar_vaga($1)', [vaga])
      await c.query("update projetos set organizacao = 'meta' where id = $1", [projetoId])
      expect((await c.query('select organizacao from projetos where id in ($1, $2)', [projetoId, vazio])).rows).toEqual([
        { organizacao: 'meta' },
        { organizacao: 'meta' },
      ])
    }))

  it('importar_vagas acrescenta vagas com as conclusões', () =>
    emTransacao(async (c) => {
      const { projetoId, ondaId } = await novoProjeto(c, { clienteId: await novoCliente(c), organizacao: 'ondas' })
      await novaVaga(c, { projetoId, ondaId })
      await comoUsuario(c, 'rh')
      const gerais = () => contar(c, 'select count(*) as n from historico where vaga_id is null')
      const antes = await gerais()
      const { rows } = await c.query('select importar_vagas($1, $2) as n', [
        projetoId,
        JSON.stringify([
          {
            funcao: 'Eletricista',
            disciplina: 'Elétrica',
            area: '',
            gestor_id: null,
            onda_id: ondaId,
            meta: null,
            candidato: 'Fulano',
            data_inicio: '2026-10-01',
            concluidas: [
              { ordem: 1, concluida_em: '2026-10-01' },
              { ordem: 2, concluida_em: '2026-10-05' },
            ],
          },
          { funcao: 'Soldador', disciplina: '', area: '', gestor_id: null, onda_id: ondaId, meta: null, candidato: null, data_inicio: '2026-10-22', concluidas: [] },
        ]),
      ])
      expect(rows[0].n).toBe(2)
      expect(await contar(c, 'select count(*) as n from vagas where projeto_id = $1', [projetoId])).toBe(3)
      expect(await contar(c, 'select count(*) as n from vaga_conclusoes vc join vagas v on v.id = vc.vaga_id where v.projeto_id = $1', [projetoId])).toBe(2)
      expect(await gerais()).toBe(antes + 1)
      expect(await contar(c, "select count(*) as n from historico where vaga_id is null and acao like 'Importou 2 vagas em %'")).toBe(1)
    }))
})
