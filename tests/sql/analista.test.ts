import type { Client } from 'pg'
import { describe, expect, it } from 'vitest'
import { comoUsuario, concluirAte, emTransacao, etapasDoProjeto, liberar, novaVaga, novoCliente, novoProjeto } from './apoio'

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

const contar = async (c: Client, sql: string, params: unknown[] = []) => Number((await c.query(sql, params)).rows[0].n)

// Cria um usuário que não é quem age no teste e volta ao papel do banco.
async function outroUsuario(c: Client, perfil: 'rh' | 'analista' | 'gestor' | 'cliente', clienteId?: string): Promise<string> {
  const { usuarioId } = await comoUsuario(c, perfil, clienteId)
  await c.query('reset role')
  return usuarioId
}

// Age com o papel do banco no meio do teste e volta a agir como o usuário de antes.
async function comoBanco<T>(c: Client, fn: () => Promise<T>): Promise<T> {
  await c.query('reset role')
  try {
    return await fn()
  } finally {
    await c.query('set local role authenticated')
  }
}

const inserirAcesso = (c: Client, projetoId: string, usuarioId: string) =>
  c.query('insert into projeto_acessos (projeto_id, usuario_id) values ($1, $2)', [projetoId, usuarioId])
const removerAcesso = (c: Client, projetoId: string, usuarioId: string) =>
  c.query('delete from projeto_acessos where projeto_id = $1 and usuario_id = $2', [projetoId, usuarioId])

describe('perfil analista', () => {
  it('analista vê só os projetos liberados', () =>
    emTransacao(async (c) => {
      const cli = await novoCliente(c)
      const p1 = await novoProjeto(c, { clienteId: cli, organizacao: 'ondas' })
      const p2 = await novoProjeto(c, { clienteId: cli, organizacao: 'ondas' })
      const v1 = await novaVaga(c, { projetoId: p1.projetoId, ondaId: p1.ondaId })
      const v2 = await novaVaga(c, { projetoId: p2.projetoId, ondaId: p2.ondaId })
      await concluirAte(c, v1, 1, '2026-10-22')
      await concluirAte(c, v2, 1, '2026-10-22')
      await c.query("insert into historico (vaga_id, nome_usuario, acao) values (null, 'teste-sql', 'geral'), ($1, 'teste-sql', 'da vaga 1'), ($2, 'teste-sql', 'da vaga 2')", [v1, v2])
      const gestor = await outroUsuario(c, 'gestor')
      await liberar(c, p1.projetoId, gestor)
      await liberar(c, p2.projetoId, gestor)
      await c.query('reset role')
      const { usuarioId } = await comoUsuario(c, 'analista')
      await liberar(c, p1.projetoId, usuarioId)

      expect((await c.query('select id from projetos')).rows).toEqual([{ id: p1.projetoId }])
      expect((await c.query('select id from vagas')).rows).toEqual([{ id: v1 }])
      expect((await c.query('select distinct projeto_id from ondas')).rows).toEqual([{ projeto_id: p1.projetoId }])
      expect((await c.query('select distinct projeto_id from projeto_etapas')).rows).toEqual([{ projeto_id: p1.projetoId }])
      expect((await c.query('select distinct vaga_id from vaga_conclusoes')).rows).toEqual([{ vaga_id: v1 }])
      expect(await contar(c, 'select count(*) as n from historico where vaga_id is null')).toBe(0)
      expect(await contar(c, 'select count(*) as n from historico where vaga_id = $1', [v2])).toBe(0)
      expect(await contar(c, 'select count(*) as n from historico where vaga_id = $1', [v1])).toBe(1)
      const { rows: acessos } = await c.query('select projeto_id, usuario_id from projeto_acessos')
      expect(acessos.map((a) => a.projeto_id)).toEqual([p1.projetoId, p1.projetoId])
      expect(acessos.map((a) => a.usuario_id).sort()).toEqual([gestor, usuarioId].sort())
      expect((await c.query('select id from usuarios')).rows).toEqual([{ id: usuarioId }])
    }))

  it('analista altera o projeto dele e não o dos outros', () =>
    emTransacao(async (c) => {
      const cli = await novoCliente(c)
      const meu = await novoProjeto(c, { clienteId: cli, organizacao: 'ondas' })
      const outro = await novoProjeto(c, { clienteId: cli, organizacao: 'ondas' })
      const vMeu = await novaVaga(c, { projetoId: meu.projetoId, ondaId: meu.ondaId })
      const vMeu2 = await novaVaga(c, { projetoId: meu.projetoId, ondaId: meu.ondaId })
      const vOutro = await novaVaga(c, { projetoId: outro.projetoId, ondaId: outro.ondaId })
      await concluirAte(c, vOutro, 1, '2026-10-22')
      const etapasMeu = await etapasDoProjeto(c, meu.projetoId)
      const etapasOutro = await etapasDoProjeto(c, outro.projetoId)
      const { usuarioId } = await comoUsuario(c, 'analista')
      await liberar(c, meu.projetoId, usuarioId)
      const vaga = (projetoId: string, ondaId: string | null) => ({ projeto_id: projetoId, funcao: 'teste-sql Vaga', onda_id: ondaId, data_inicio: '2026-10-22' })

      // No projeto dele, tudo passa.
      await c.query("select concluir_etapas($1, 1::smallint, 2::smallint, '2026-10-22'::date)", [vMeu])
      await c.query('select desfazer_etapa($1, 2::smallint)', [vMeu])
      await c.query("select concluir_etapa($1, 2::smallint, '2026-10-22'::date)", [vMeu])
      await c.query('select candidato_desistiu($1)', [vMeu])
      const { rows: criada } = await c.query('select salvar_vaga(null, $1) as id', [vaga(meu.projetoId, meu.ondaId)])
      await c.query('select salvar_vaga($1, $2)', [criada[0].id, { ...vaga(meu.projetoId, meu.ondaId), funcao: 'teste-sql Editada' }])
      await c.query('select cancelar_vaga($1)', [vMeu2])
      const { rows: nova } = await c.query("select incluir_etapa($1, 'teste-sql Nova', 1::smallint, null) as id", [meu.projetoId])
      await c.query("select renomear_etapa($1, 'teste-sql Renomeada')", [nova[0].id])
      await c.query('select alterar_duracao_etapa($1, 3::smallint)', [etapasMeu[8].id])
      await c.query('select excluir_etapa($1)', [nova[0].id])
      expect((await c.query('select importar_vagas($1, $2) as n', [meu.projetoId, JSON.stringify([vaga(meu.projetoId, meu.ondaId)])])).rows).toEqual([{ n: 1 }])
      await c.query("select salvar_onda_projeto(null, $1, 'teste-sql 2ª Onda', '2027-01-01', '2027-02-01')", [meu.projetoId])
      await c.query("select salvar_projeto($1, $2)", [meu.projetoId, { cliente_id: cli, nome: 'teste-sql Projeto editado', organizacao: 'ondas' }])
      await c.query('select encerrar_projeto($1)', [meu.projetoId])
      await c.query('select reabrir_projeto($1)', [meu.projetoId])
      expect(await contar(c, "select count(*) as n from historico where vaga_id = $1 and nome_usuario = 'teste-sql analista'", [vMeu])).toBeGreaterThan(0)

      // No dos outros (e com ids que não existem), nada passa.
      const nada = '00000000-0000-0000-0000-000000000000'
      const recusadas: [string, unknown[]][] = [
        ["select concluir_etapas($1, 2::smallint, 2::smallint, '2026-10-22'::date)", [vOutro]],
        ["select concluir_etapa($1, 2::smallint, '2026-10-22'::date)", [vOutro]],
        ['select desfazer_etapa($1, 1::smallint)', [vOutro]],
        ['select candidato_desistiu($1)', [vOutro]],
        ['select salvar_vaga(null, $1)', [vaga(outro.projetoId, outro.ondaId)]],
        ['select salvar_vaga($1, $2)', [vOutro, vaga(outro.projetoId, outro.ondaId)]],
        ['select cancelar_vaga($1)', [vOutro]],
        ["select incluir_etapa($1, 'teste-sql Nova', 1::smallint, null)", [outro.projetoId]],
        ['select excluir_etapa($1)', [etapasOutro[2].id]],
        ["select renomear_etapa($1, 'teste-sql x')", [etapasOutro[2].id]],
        ['select mover_etapa($1, 1::smallint)', [etapasOutro[2].id]],
        ['select alterar_duracao_etapa($1, 3::smallint)', [etapasOutro[8].id]],
        ['select importar_vagas($1, $2)', [outro.projetoId, JSON.stringify([vaga(outro.projetoId, outro.ondaId)])]],
        ["select salvar_onda_projeto(null, $1, 'teste-sql 2ª Onda', '2027-01-01', '2027-02-01')", [outro.projetoId]],
        ["select salvar_onda_projeto($1, $2, 'teste-sql x', '2027-01-01', '2027-02-01')", [outro.ondaId, outro.projetoId]],
        ['select salvar_projeto($1, $2)', [outro.projetoId, { cliente_id: cli, nome: 'teste-sql x', organizacao: 'ondas' }]],
        ['select encerrar_projeto($1)', [outro.projetoId]],
        ['select reabrir_projeto($1)', [outro.projetoId]],
        ["select concluir_etapas($1, 1::smallint, 1::smallint, '2026-10-22'::date)", [nada]],
        ['select cancelar_vaga($1)', [nada]],
        ['select salvar_vaga($1, $2)', [nada, vaga(outro.projetoId, outro.ondaId)]],
        ["select renomear_etapa($1, 'teste-sql x')", [nada]],
        ["select incluir_etapa($1, 'teste-sql Nova', 1::smallint, null)", [nada]],
        ['select encerrar_projeto($1)', [nada]],
        ['select salvar_projeto($1, $2)', [nada, { cliente_id: cli, nome: 'teste-sql x', organizacao: 'ondas' }]],
      ]
      for (const [sql, params] of recusadas) expect(await erroSalvo(c, () => c.query(sql, params)), sql).toContain('sem permissão')

      // Escrita direta nas tabelas do projeto, nem no dele: só pelas funções.
      expect(
        await erroSalvo(c, () =>
          c.query("insert into vagas (funcao, disciplina, area, projeto_id, onda_id, data_inicio) values ('x', 'x', 'x', $1, $2, '2026-10-22')", [meu.projetoId, meu.ondaId]),
        ),
      ).toMatch(/row-level security/)
      expect(await erroSalvo(c, () => c.query("insert into projetos (cliente_id, nome, organizacao) values ($1, 'teste-sql x', 'meta')", [cli]))).toMatch(/row-level security/)
      await c.query("update projetos set nome = 'teste-sql hack' where id = $1", [outro.projetoId])
      expect(await comoBanco(c, () => contar(c, "select count(*) as n from projetos where nome = 'teste-sql hack'"))).toBe(0)
    }))

  it('analista cria projeto e já tem acesso', () =>
    emTransacao(async (c) => {
      const cli = await novoCliente(c)
      const { usuarioId } = await comoUsuario(c, 'analista')
      const { rows } = await c.query('select salvar_projeto(null, $1) as id', [{ cliente_id: cli, nome: 'teste-sql Novo', organizacao: 'meta' }])
      const id = rows[0].id
      expect((await c.query('select id from projetos')).rows).toEqual([{ id }])
      expect((await c.query('select usuario_id from projeto_acessos where projeto_id = $1', [id])).rows).toEqual([{ usuario_id: usuarioId }])
      await c.query("select incluir_etapa($1, 'teste-sql Nova', 1::smallint, null)", [id])
      expect(await contar(c, 'select count(*) as n from projeto_etapas where projeto_id = $1', [id])).toBe(14)
    }))

  it('analista libera gestor e cliente, não analista', () =>
    emTransacao(async (c) => {
      const cliA = await novoCliente(c)
      const cliB = await novoCliente(c)
      const meu = await novoProjeto(c, { clienteId: cliA, organizacao: 'meta' })
      const outro = await novoProjeto(c, { clienteId: cliA, organizacao: 'meta' })
      const gestor = await outroUsuario(c, 'gestor')
      const clienteA = await outroUsuario(c, 'cliente', cliA)
      const clienteB = await outroUsuario(c, 'cliente', cliB)
      const outroAnalista = await outroUsuario(c, 'analista')
      const rh = await outroUsuario(c, 'rh')
      await liberar(c, meu.projetoId, outroAnalista)
      await liberar(c, outro.projetoId, gestor)
      await c.query('reset role')
      const { usuarioId } = await comoUsuario(c, 'analista')
      await liberar(c, meu.projetoId, usuarioId)

      await inserirAcesso(c, meu.projetoId, gestor)
      await inserirAcesso(c, meu.projetoId, clienteA)
      expect(await erroSalvo(c, () => inserirAcesso(c, meu.projetoId, clienteB))).toContain('cliente diferente')
      expect(await erroSalvo(c, () => inserirAcesso(c, meu.projetoId, outroAnalista))).toContain('analista não libera este perfil')
      expect(await erroSalvo(c, () => inserirAcesso(c, meu.projetoId, rh))).toContain('analista não libera este perfil')
      expect(await erroSalvo(c, () => removerAcesso(c, meu.projetoId, usuarioId))).toContain('analista não libera este perfil')
      expect(await erroSalvo(c, () => removerAcesso(c, meu.projetoId, outroAnalista))).toContain('analista não libera este perfil')
      // Nem trocando a linha.
      await c.query('update projeto_acessos set usuario_id = $2 where projeto_id = $1 and usuario_id = $3', [meu.projetoId, outroAnalista, gestor])
      // Em projeto que não é dele, nada: nem se liberar, nem liberar o gestor, nem remover.
      // (O gatilho roda antes da RLS e recusa primeiro a liberação de si mesmo.)
      expect(await erroSalvo(c, () => inserirAcesso(c, outro.projetoId, usuarioId))).toMatch(/row-level security|analista não libera este perfil/)
      expect(await erroSalvo(c, () => inserirAcesso(c, outro.projetoId, clienteA))).toMatch(/row-level security/)
      await removerAcesso(c, outro.projetoId, gestor)

      const acessos = await comoBanco(c, async () =>
        (await c.query('select projeto_id, usuario_id from projeto_acessos where projeto_id in ($1, $2)', [meu.projetoId, outro.projetoId])).rows,
      )
      const de = (p: string) => acessos.filter((a) => a.projeto_id === p).map((a) => a.usuario_id).sort()
      expect(de(meu.projetoId)).toEqual([gestor, clienteA, outroAnalista, usuarioId].sort())
      expect(de(outro.projetoId)).toEqual([gestor])

      // Remover gestor e cliente do projeto dele passa.
      await removerAcesso(c, meu.projetoId, gestor)
      await removerAcesso(c, meu.projetoId, clienteA)
      expect(await contar(c, 'select count(*) as n from projeto_acessos where projeto_id = $1', [meu.projetoId])).toBe(2)
    }))

  it('administrador libera analista', () =>
    emTransacao(async (c) => {
      const { projetoId } = await novoProjeto(c, { clienteId: await novoCliente(c), organizacao: 'meta' })
      const analista = await outroUsuario(c, 'analista')
      await comoUsuario(c, 'rh')
      await inserirAcesso(c, projetoId, analista)
      expect(await contar(c, 'select count(*) as n from projeto_acessos where projeto_id = $1 and usuario_id = $2', [projetoId, analista])).toBe(1)
      await removerAcesso(c, projetoId, analista)
      expect(await contar(c, 'select count(*) as n from projeto_acessos where projeto_id = $1', [projetoId])).toBe(0)
    }))

  it('analista que vira gestor perde a escrita, desativado perde tudo', () =>
    emTransacao(async (c) => {
      const cli = await novoCliente(c)
      const { projetoId, ondaId } = await novoProjeto(c, { clienteId: cli, organizacao: 'ondas' })
      const vaga = await novaVaga(c, { projetoId, ondaId })
      const { usuarioId } = await comoUsuario(c, 'analista')
      await liberar(c, projetoId, usuarioId)
      await c.query("select concluir_etapas($1, 1::smallint, 1::smallint, '2026-10-22'::date)", [vaga])

      await comoBanco(c, () => c.query("update usuarios set perfil = 'gestor' where id = $1", [usuarioId]))
      expect(await erroSalvo(c, () => c.query("select concluir_etapas($1, 2::smallint, 2::smallint, '2026-10-22'::date)", [vaga]))).toContain('sem permissão')
      expect(await erroSalvo(c, () => c.query("select incluir_etapa($1, 'teste-sql Nova', 1::smallint, null)", [projetoId]))).toContain('sem permissão')
      expect(await erroSalvo(c, () => c.query('select salvar_projeto(null, $1)', [{ cliente_id: cli, nome: 'x', organizacao: 'meta' }]))).toContain('sem permissão')
      expect((await c.query('select id from projetos')).rows).toEqual([{ id: projetoId }])

      await comoBanco(c, () => c.query("update usuarios set perfil = 'analista', ativo = false where id = $1", [usuarioId]))
      expect(await contar(c, 'select count(*) as n from projetos')).toBe(0)
      expect(await contar(c, 'select count(*) as n from vagas')).toBe(0)
      expect(await erroSalvo(c, () => c.query("select concluir_etapas($1, 2::smallint, 2::smallint, '2026-10-22'::date)", [vaga]))).toContain('sem permissão')
      expect(await erroSalvo(c, () => c.query('select salvar_projeto(null, $1)', [{ nome: 'x', organizacao: 'meta' }]))).toContain('sem permissão')
    }))

  it('analista não escreve em cadastros gerais', () =>
    emTransacao(async (c) => {
      const cli = await novoCliente(c)
      const { usuarioId } = await comoUsuario(c, 'analista')
      expect(await erroSalvo(c, () => c.query("select salvar_cliente(null, 'teste-sql Cliente')"))).toContain('sem permissão')
      expect(await erroSalvo(c, () => c.query('select salvar_cliente($1, $2)', [cli, 'teste-sql x']))).toContain('sem permissão')
      expect(await erroSalvo(c, () => c.query('select alterar_duracao_cliente($1, 1::smallint, 2::smallint)', [cli]))).toContain('sem permissão')
      expect(await erroSalvo(c, () => c.query("insert into gestores (nome, cliente_id) values ('teste-sql g', $1)", [cli]))).toMatch(/row-level security/)
      expect(await erroSalvo(c, () => c.query("insert into feriados (data, nome) values ('2027-06-01', 'teste-sql f')"))).toMatch(/row-level security/)
      expect(await erroSalvo(c, () => c.query("insert into clientes (nome) values ('teste-sql c')"))).toMatch(/row-level security/)
      // Nem o próprio perfil.
      await c.query("update usuarios set perfil = 'rh' where id = $1", [usuarioId])
      expect(await comoBanco(c, async () => (await c.query('select perfil from usuarios where id = $1', [usuarioId])).rows)).toEqual([{ perfil: 'analista' }])
    }))

  it('analista lê todos os clientes, mas não as durações de cliente sem projeto dele', () =>
    emTransacao(async (c) => {
      const cliA = await novoCliente(c)
      const cliB = await novoCliente(c)
      const { projetoId } = await novoProjeto(c, { clienteId: cliA, organizacao: 'meta' })
      await c.query("insert into gestores (nome, cliente_id) values ('teste-sql gA', $1), ('teste-sql gB', $2)", [cliA, cliB])
      const { usuarioId } = await comoUsuario(c, 'analista')
      await liberar(c, projetoId, usuarioId)
      const ids = (await c.query('select id from clientes')).rows.map((r) => r.id)
      expect(ids).toEqual(expect.arrayContaining([cliA, cliB]))
      expect(await contar(c, 'select count(*) as n from cliente_duracoes where cliente_id = $1', [cliA])).toBe(13)
      expect(await contar(c, 'select count(*) as n from cliente_duracoes where cliente_id = $1', [cliB])).toBe(0)
      expect(await contar(c, 'select count(*) as n from gestores where cliente_id = $1', [cliA])).toBe(1)
      expect(await contar(c, 'select count(*) as n from gestores where cliente_id = $1', [cliB])).toBe(0)
    }))

  it('pessoas_liberaveis e pessoas_do_projeto', () =>
    emTransacao(async (c) => {
      const cliA = await novoCliente(c)
      const cliB = await novoCliente(c)
      const meu = await novoProjeto(c, { clienteId: cliA, organizacao: 'meta' })
      const outro = await novoProjeto(c, { clienteId: cliA, organizacao: 'meta' })
      const gestor = await outroUsuario(c, 'gestor')
      const inativo = await outroUsuario(c, 'gestor')
      await c.query('update usuarios set ativo = false where id = $1', [inativo])
      const clienteA = await outroUsuario(c, 'cliente', cliA)
      const clienteB = await outroUsuario(c, 'cliente', cliB)
      const outroAnalista = await outroUsuario(c, 'analista')
      const rh = await outroUsuario(c, 'rh')
      await liberar(c, meu.projetoId, gestor)
      await c.query('reset role')
      const { usuarioId } = await comoUsuario(c, 'analista')
      await liberar(c, meu.projetoId, usuarioId)

      const liberaveis = await c.query('select * from pessoas_liberaveis($1)', [meu.projetoId])
      expect(liberaveis.fields.map((f) => f.name)).toEqual(['id', 'nome', 'perfil', 'cliente_id'])
      const ids = liberaveis.rows.map((r) => r.id)
      expect(ids).toEqual(expect.arrayContaining([gestor, clienteA]))
      for (const fora of [clienteB, outroAnalista, rh, inativo, usuarioId]) expect(ids).not.toContain(fora)
      for (const r of liberaveis.rows) expect(['gestor', 'cliente']).toContain(r.perfil)
      expect(liberaveis.rows.find((r) => r.id === clienteA).cliente_id).toBe(cliA)

      const doProjeto = await c.query('select * from pessoas_do_projeto($1)', [meu.projetoId])
      expect(doProjeto.fields.map((f) => f.name)).toEqual(['id', 'nome', 'perfil'])
      expect(doProjeto.rows.map((r) => r.id).sort()).toEqual([gestor, usuarioId].sort())

      expect(await erroSalvo(c, () => c.query('select * from pessoas_liberaveis($1)', [outro.projetoId]))).toContain('sem permissão')
      expect(await erroSalvo(c, () => c.query('select * from pessoas_do_projeto($1)', [outro.projetoId]))).toContain('sem permissão')

      // O Administrador também libera Analistas, e nunca outro Administrador.
      await c.query('reset role')
      await comoUsuario(c, 'rh')
      const doRh = (await c.query('select * from pessoas_liberaveis($1)', [outro.projetoId])).rows.map((r) => r.id)
      expect(doRh).toEqual(expect.arrayContaining([gestor, clienteA, outroAnalista, usuarioId]))
      for (const fora of [clienteB, rh, inativo]) expect(doRh).not.toContain(fora)

      // Gestor e cliente não chamam.
      await c.query('reset role')
      await comoUsuario(c, 'gestor')
      expect(await erroSalvo(c, () => c.query('select * from pessoas_liberaveis($1)', [meu.projetoId]))).toContain('sem permissão')
      expect(await erroSalvo(c, () => c.query('select * from pessoas_do_projeto($1)', [meu.projetoId]))).toContain('sem permissão')
    }))
})
