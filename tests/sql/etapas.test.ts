import type { Client } from 'pg'
import { describe, expect, it } from 'vitest'
import { comoUsuario, concluirAte, emTransacao, etapasDoProjeto, novaVaga, novoCliente, novoProjeto } from './apoio'

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

// Age com o papel do banco no meio do teste e volta a agir como o usuário de antes.
async function comoBanco<T>(c: Client, fn: () => Promise<T>): Promise<T> {
  await c.query('reset role')
  try {
    return await fn()
  } finally {
    await c.query('set local role authenticated')
  }
}

// A unicidade das posições só é conferida no commit: aqui ela é conferida na hora, e a conferência
// volta a ficar para o fim da transação, como numa chamada de verdade.
const conferirPosicoes = async (c: Client) => {
  await c.query('set constraints all immediate')
  await c.query('set constraints all deferred')
}

const etapaAtual = async (c: Client, vaga: string) => Number((await c.query('select etapa_atual($1) as n', [vaga])).rows[0].n)

// Posições concluídas pela vaga, com as datas.
async function conclusoes(c: Client, vaga: string): Promise<{ posicao: number; nome: string; data: string }[]> {
  const { rows } = await c.query(
    `select e.posicao, e.nome, vc.concluida_em::text as data from vaga_conclusoes vc join projeto_etapas e on e.id = vc.etapa_id
     where vc.vaga_id = $1 order by e.posicao`,
    [vaga],
  )
  return rows
}

async function projetoComOnda(c: Client) {
  return novoProjeto(c, { clienteId: await novoCliente(c), organizacao: 'ondas' })
}

describe('migração 007', () => {
  it('a 007 dá às vagas reais da Braskem 2027 a lista padrão sem mudar nada', async () => {
    let antes: { vaga_id: string; ordem: number; concluida_em: string }[] = []
    await emTransacao(
      async (c) => {
        const { rows: projeto } = await c.query("select id from projetos where nome = 'Mobilização Braskem 2027'")
        const lista = await etapasDoProjeto(c, projeto[0].id)
        const { rows: padrao } = await c.query('select ordem as posicao, nome from etapas order by ordem')
        expect(lista.map(({ posicao, nome }) => ({ posicao, nome }))).toEqual(padrao)
        expect(lista.filter((e) => e.fixa).map((e) => [e.posicao, e.fixa])).toEqual([
          [2, 'captura'],
          [11, 'admissao'],
        ])
        // A Braskem 2027 tem as 13 padrão, com os ajustes de duração que já tinha.
        expect(
          await contar(
            c,
            `select count(*) as n from projeto_etapas e left join projeto_duracoes d on d.projeto_id = e.projeto_id and d.ordem = e.padrao
             where e.projeto_id = $1 and (e.duracao is distinct from d.duracao or e.padrao is distinct from e.posicao)`,
            [projeto[0].id],
          ),
        ).toBe(0)
        // As conclusões de toda vaga são as primeiras etapas da lista, sem buraco.
        expect(
          await contar(
            c,
            `select count(*) as n from (select vc.vaga_id from vaga_conclusoes vc join projeto_etapas e on e.id = vc.etapa_id
             group by vc.vaga_id having count(*) <> max(e.posicao)) x`,
          ),
        ).toBe(0)
        expect(await contar(c, 'select count(*) as n from vaga_conclusoes where automatica')).toBe(0)
        const { rows: depois } = await c.query(
          `select vc.vaga_id, vc.ordem, vc.concluida_em, e.posicao from vaga_conclusoes vc join projeto_etapas e on e.id = vc.etapa_id
           join vagas v on v.id = vc.vaga_id where e.projeto_id = v.projeto_id order by vc.vaga_id, vc.ordem`,
        )
        expect(depois).toHaveLength(antes.length)
        expect(await contar(c, 'select count(*) as n from vaga_conclusoes')).toBe(antes.length)
        for (const d of depois) expect(d.posicao).toBe(d.ordem)
        expect(depois.map(({ vaga_id, ordem, concluida_em }) => ({ vaga_id, ordem, concluida_em }))).toEqual(antes)
      },
      async (c) => {
        antes = (await c.query('select vaga_id, ordem, concluida_em from vaga_conclusoes order by vaga_id, ordem')).rows
        expect(antes.length).toBeGreaterThan(0)
      },
    )
  })

  it('projeto novo nasce com as 13 etapas', () =>
    emTransacao(async (c) => {
      const { projetoId } = await novoProjeto(c, { clienteId: await novoCliente(c), organizacao: 'meta' })
      const { rows } = await c.query(
        'select e.posicao, e.nome, e.duracao, e.padrao, e.fixa from projeto_etapas e where projeto_id = $1 order by posicao',
        [projetoId],
      )
      const { rows: padrao } = await c.query('select ordem, nome from etapas order by ordem')
      expect(rows).toEqual(
        padrao.map((e) => ({
          posicao: e.ordem,
          nome: e.nome,
          duracao: null,
          padrao: e.ordem,
          fixa: e.ordem === 2 ? 'captura' : e.ordem === 11 ? 'admissao' : null,
        })),
      )
    }))

  it('código antigo continua concluindo', () =>
    emTransacao(async (c) => {
      const { projetoId, ondaId } = await projetoComOnda(c)
      const vaga = await novaVaga(c, { projetoId, ondaId })
      await c.query("insert into vaga_conclusoes (vaga_id, ordem, concluida_em) values ($1, 1, '2026-10-22'), ($1, 2, '2026-10-23')", [vaga])
      expect(await conclusoes(c, vaga)).toEqual([
        { posicao: 1, nome: 'Abertura de vaga', data: '2026-10-22' },
        { posicao: 2, nome: 'Captura de Mercado', data: '2026-10-23' },
      ])
    }))
})

describe('incluir etapa', () => {
  it('incluir etapa não muda vaga que já chegou ao ponto', () =>
    emTransacao(async (c) => {
      const { projetoId, ondaId } = await projetoComOnda(c)
      const nova = () => novaVaga(c, { projetoId, ondaId, dataInicio: '2026-10-01' })
      const [semNada, na10, na11, mobilizada, cancelada] = [await nova(), await nova(), await nova(), await nova(), await nova()]
      await concluirAte(c, na10, 9, '2026-10-05')
      await concluirAte(c, na11, 10, '2026-10-05')
      await concluirAte(c, mobilizada, 13, '2026-10-05')
      await concluirAte(c, cancelada, 12, '2026-10-05')
      await c.query('update vagas set cancelada_em = now() where id = $1', [cancelada])
      // A posição 10 (Ambientação) tem data própria, para ver que é ela que vale.
      const lista = await etapasDoProjeto(c, projetoId)
      const ambientacao = lista[9]
      expect(ambientacao.nome).toBe('Ambientação/TBS')
      await c.query("update vaga_conclusoes set concluida_em = '2026-10-09' where etapa_id = $1", [ambientacao.id])
      const admissao = lista[10].id
      await comoUsuario(c, 'rh')

      const { rows } = await c.query("select incluir_etapa($1, 'Cadastro no eSocial', 2::smallint, $2) as id", [projetoId, ambientacao.id])
      await conferirPosicoes(c)
      const id = rows[0].id
      const depois = await etapasDoProjeto(c, projetoId)
      expect(depois).toHaveLength(14)
      expect(depois[10]).toEqual({ id, posicao: 11, nome: 'Cadastro no eSocial', fixa: null })
      expect(depois[11].id).toBe(admissao)

      const daNova = async (vaga: string) => (await conclusoes(c, vaga)).filter((x) => x.posicao === 11)
      expect(await daNova(semNada)).toEqual([])
      expect(await daNova(na10)).toEqual([])
      expect(await daNova(na11)).toEqual([{ posicao: 11, nome: 'Cadastro no eSocial', data: '2026-10-09' }])
      expect(await daNova(mobilizada)).toEqual([{ posicao: 11, nome: 'Cadastro no eSocial', data: '2026-10-09' }])
      // A cancelada também, para as conclusões continuarem sendo as primeiras da lista.
      expect(await daNova(cancelada)).toEqual([{ posicao: 11, nome: 'Cadastro no eSocial', data: '2026-10-09' }])
      expect((await conclusoes(c, cancelada)).map((x) => x.posicao)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
      // Só as conclusões automáticas ficam marcadas, para a previsão não contar com elas.
      const { rows: auto } = await c.query('select vaga_id, automatica from vaga_conclusoes where etapa_id = $1 order by vaga_id', [id])
      expect(auto.map((a) => a.vaga_id).sort()).toEqual([na11, mobilizada, cancelada].sort())
      for (const a of auto) expect(a.automatica).toBe(true)
      expect(await contar(c, 'select count(*) as n from vaga_conclusoes where etapa_id <> $1 and automatica and vaga_id in ($2, $3, $4)', [id, na11, mobilizada, cancelada])).toBe(0)
      expect(await etapaAtual(c, na10)).toBe(10)
      expect(await etapaAtual(c, na11)).toBe(12)
      expect(depois[11].nome).toBe('Admissão Timenow')
      expect(await etapaAtual(c, mobilizada)).toBe(15)

      for (const vaga of [na11, mobilizada, cancelada]) {
        const { rows: h } = await c.query('select acao, nome_usuario from historico where vaga_id = $1', [vaga])
        expect(h).toEqual([{ acao: 'Etapa Cadastro no eSocial incluída e marcada como concluída', nome_usuario: 'teste-sql rh' }])
      }
      expect(await contar(c, 'select count(*) as n from historico where vaga_id in ($1, $2)', [semNada, na10])).toBe(0)
      const { rows: geral } = await c.query("select detalhe from historico where vaga_id is null and detalhe->>'etapa' = 'Cadastro no eSocial'")
      const { rows: projeto } = await c.query('select nome from projetos where id = $1', [projetoId])
      expect(geral.map((g) => g.detalhe)).toEqual([
        { projeto: projeto[0].nome, etapa: 'Cadastro no eSocial', depois_de: 'Ambientação/TBS', concluidas_automaticamente: 3 },
      ])
    }))

  it('incluir na primeira posição usa a data de início', () =>
    emTransacao(async (c) => {
      const { projetoId, ondaId } = await projetoComOnda(c)
      const vazia = await novaVaga(c, { projetoId, ondaId, dataInicio: '2026-10-20' })
      const andando = await novaVaga(c, { projetoId, ondaId, dataInicio: '2026-10-21' })
      await concluirAte(c, andando, 3, '2026-10-23')
      await comoUsuario(c, 'rh')
      await c.query("select incluir_etapa($1, 'Cadastro em sistema', 0::smallint, null)", [projetoId])
      await conferirPosicoes(c)
      expect((await etapasDoProjeto(c, projetoId))[0]).toMatchObject({ posicao: 1, nome: 'Cadastro em sistema' })
      expect((await conclusoes(c, vazia)).map((x) => [x.posicao, x.data])).toEqual([[1, '2026-10-20']])
      expect((await conclusoes(c, andando)).map((x) => [x.posicao, x.data])).toEqual([
        [1, '2026-10-21'],
        [2, '2026-10-23'],
        [3, '2026-10-23'],
        [4, '2026-10-23'],
      ])
      expect(await etapaAtual(c, vazia)).toBe(2)
    }))

  it('nome repetido e duração inválida são recusados', () =>
    emTransacao(async (c) => {
      const { projetoId } = await projetoComOnda(c)
      await comoUsuario(c, 'rh')
      expect(await erroSalvo(c, () => c.query("select incluir_etapa($1, ' captura de mercado ', 1::smallint, null)", [projetoId]))).toContain('etapa repetida')
      expect(await erroSalvo(c, () => c.query("select incluir_etapa($1, 'Nova', null, null)", [projetoId]))).toContain('duração obrigatória')
    }))
})

describe('excluir, renomear e mover', () => {
  it('excluir etapa guarda as datas no histórico e não deixa buraco', () =>
    emTransacao(async (c) => {
      const { projetoId, ondaId } = await projetoComOnda(c)
      const ate5 = await novaVaga(c, { projetoId, ondaId, dataInicio: '2026-10-01' })
      const na3 = await novaVaga(c, { projetoId, ondaId, dataInicio: '2026-10-01' })
      const cancelada = await novaVaga(c, { projetoId, ondaId, dataInicio: '2026-10-01' })
      await concluirAte(c, ate5, 5, '2026-10-06')
      await concluirAte(c, na3, 2, '2026-10-06')
      await concluirAte(c, cancelada, 4, '2026-10-06')
      await c.query('update vagas set cancelada_em = now() where id = $1', [cancelada])
      const lista = await etapasDoProjeto(c, projetoId)
      await c.query("update vaga_conclusoes set concluida_em = '2026-10-03' where etapa_id = $1", [lista[2].id])
      await comoUsuario(c, 'rh')

      await c.query('select excluir_etapa($1)', [lista[2].id])
      await conferirPosicoes(c)
      const depois = await etapasDoProjeto(c, projetoId)
      expect(depois.map((e) => e.posicao)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
      expect(depois.map((e) => e.nome)).not.toContain('Triagem de Candidatos')
      expect((await conclusoes(c, ate5)).map((x) => x.posicao)).toEqual([1, 2, 3, 4])
      const { rows: h } = await c.query('select acao, detalhe from historico where vaga_id = $1', [ate5])
      expect(h).toEqual([{ acao: 'Etapa Triagem de Candidatos excluída', detalhe: { concluida_em: '2026-10-03' } }])
      // A cancelada também perde a conclusão, com a data no histórico, e fica sem buraco.
      expect((await conclusoes(c, cancelada)).map((x) => x.posicao)).toEqual([1, 2, 3])
      const { rows: hc } = await c.query('select acao, detalhe from historico where vaga_id = $1', [cancelada])
      expect(hc).toEqual([{ acao: 'Etapa Triagem de Candidatos excluída', detalhe: { concluida_em: '2026-10-03' } }])
      expect(await etapaAtual(c, na3)).toBe(3)
      expect(depois[2].nome).toBe('Entrevista - Timenow')
      expect(await contar(c, 'select count(*) as n from historico where vaga_id = $1', [na3])).toBe(0)
      const { rows: geral } = await c.query("select detalhe from historico where vaga_id is null and detalhe->>'etapa' = 'Triagem de Candidatos'")
      expect(geral[0].detalhe).toMatchObject({ etapa: 'Triagem de Candidatos', vagas_com_data: 2 })
      expect(geral[0].detalhe.projeto).toEqual(expect.stringContaining('teste-sql Projeto'))
    }))

  it('fixas não saem nem mudam de nome', () =>
    emTransacao(async (c) => {
      const { projetoId } = await projetoComOnda(c)
      const lista = await etapasDoProjeto(c, projetoId)
      await comoUsuario(c, 'rh')
      for (const fixa of [lista[1], lista[10]]) {
        expect(await erroSalvo(c, () => c.query('select excluir_etapa($1)', [fixa.id]))).toContain('etapa obrigatória')
        expect(await erroSalvo(c, () => c.query("select renomear_etapa($1, 'Outra')", [fixa.id]))).toContain('etapa obrigatória')
      }
      expect(await erroSalvo(c, () => c.query("select renomear_etapa($1, 'Treinamento')", [lista[4].id]))).toContain('etapa repetida')
      await c.query("select renomear_etapa($1, 'Entrevista - Cliente')", [lista[4].id])
      expect((await etapasDoProjeto(c, projetoId))[4].nome).toBe('Entrevista - Cliente')
      expect(await contar(c, "select count(*) as n from historico where vaga_id is null and detalhe->>'depois' = 'Entrevista - Cliente'")).toBe(1)
    }))

  it('mover só sem vagas', () =>
    emTransacao(async (c) => {
      const { projetoId, ondaId } = await projetoComOnda(c)
      await novaVaga(c, { projetoId, ondaId })
      const vazio = await projetoComOnda(c)
      const comVaga = await etapasDoProjeto(c, projetoId)
      const lista = await etapasDoProjeto(c, vazio.projetoId)
      await comoUsuario(c, 'rh')
      expect(await erroSalvo(c, () => c.query('select mover_etapa($1, 1::smallint)', [comVaga[12].id]))).toContain('projeto tem vagas')

      await c.query('select mover_etapa($1, 1::smallint)', [lista[12].id])
      await conferirPosicoes(c)
      const depois = await etapasDoProjeto(c, vazio.projetoId)
      expect(depois.map((e) => e.nome)).toEqual([lista[12], ...lista.slice(0, 12)].map((e) => e.nome))
      expect(depois.map((e) => e.posicao)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
      expect(await contar(c, "select count(*) as n from historico where vaga_id is null and acao like 'Moveu a etapa Treinamento%'")).toBe(1)

      // A Captura (agora na 3) não pode ficar depois da Admissão (agora na 12).
      expect(await erroSalvo(c, () => c.query('select mover_etapa($1, 13::smallint)', [lista[1].id]))).toContain('ordem das obrigatórias')
      await c.query('select mover_etapa($1, 11::smallint)', [lista[1].id])
      await conferirPosicoes(c)
      expect((await etapasDoProjeto(c, vazio.projetoId)).filter((e) => e.fixa).map((e) => [e.posicao, e.fixa])).toEqual([
        [11, 'captura'],
        [12, 'admissao'],
      ])
    }))
})

describe('ações por posição', () => {
  it('concluir_etapas conclui o salto inteiro ou nada', () =>
    emTransacao(async (c) => {
      const { projetoId, ondaId } = await projetoComOnda(c)
      const vaga = await novaVaga(c, { projetoId, ondaId, dataInicio: '2026-10-01' })
      const outra = await novaVaga(c, { projetoId, ondaId, dataInicio: '2026-10-01' })
      await concluirAte(c, vaga, 2, '2026-10-05')
      await concluirAte(c, outra, 2, '2026-10-20')
      await comoUsuario(c, 'rh')

      await c.query("select concluir_etapas($1, 3::smallint, 5::smallint, '2026-10-06'::date)", [vaga])
      expect((await conclusoes(c, vaga)).map((x) => [x.posicao, x.data])).toEqual([
        [1, '2026-10-05'],
        [2, '2026-10-05'],
        [3, '2026-10-06'],
        [4, '2026-10-06'],
        [5, '2026-10-06'],
      ])
      const { rows: h } = await c.query("select acao, detalhe from historico where vaga_id = $1 order by detalhe->>'ordem'", [vaga])
      expect(h).toEqual([
        { acao: 'Concluiu Triagem de Candidatos', detalhe: { ordem: 3, data: '2026-10-06' } },
        { acao: 'Concluiu Entrevista - Timenow', detalhe: { ordem: 4, data: '2026-10-06' } },
        { acao: 'Concluiu Entrevista - TNGO/Braskem', detalhe: { ordem: 5, data: '2026-10-06' } },
      ])

      expect(await erroSalvo(c, () => c.query("select concluir_etapas($1, 3::smallint, 5::smallint, '2026-10-06'::date)", [outra]))).toContain(
        'data antes da etapa anterior',
      )
      expect(await erroSalvo(c, () => c.query("select concluir_etapas($1, 3::smallint, 2::smallint, '2026-10-21'::date)", [outra]))).toContain('etapa mudou')
      expect(await erroSalvo(c, () => c.query("select concluir_etapas($1, 3::smallint, 14::smallint, '2026-10-21'::date)", [outra]))).toContain('etapa mudou')
      expect(await erroSalvo(c, () => c.query('select concluir_etapas($1, 3::smallint, 4::smallint, hoje_sp() + 1)', [outra]))).toContain('data no futuro')
      expect(await contar(c, 'select count(*) as n from vaga_conclusoes where vaga_id = $1', [outra])).toBe(2)
      expect(await contar(c, 'select count(*) as n from historico where vaga_id = $1', [outra])).toBe(0)

      // Outra pessoa do RH já concluiu daqui: a mesma posição esperada é recusada.
      expect(await erroSalvo(c, () => c.query("select concluir_etapas($1, 3::smallint, 5::smallint, '2026-10-06'::date)", [vaga]))).toContain('etapa mudou')
      expect(await erroSalvo(c, () => c.query("select concluir_etapa($1, 3::smallint, '2026-10-06'::date)", [vaga]))).toContain('etapa mudou')

      // Até o fim da lista: a vaga fica mobilizada.
      await c.query("select concluir_etapas($1, 6::smallint, 13::smallint, '2026-10-07'::date)", [vaga])
      expect(await etapaAtual(c, vaga)).toBe(14)
      expect(await erroSalvo(c, () => c.query("select concluir_etapa($1, 14::smallint, '2026-10-07'::date)", [vaga]))).toContain('etapa mudou')
    }))

  it('concluir e desfazer seguem a lista do projeto', () =>
    emTransacao(async (c) => {
      const { projetoId, ondaId } = await projetoComOnda(c)
      const vaga = await novaVaga(c, { projetoId, ondaId, dataInicio: '2026-10-01' })
      await concluirAte(c, vaga, 1, '2026-10-02')
      const lista = await etapasDoProjeto(c, projetoId)
      await comoUsuario(c, 'rh')
      await c.query("select incluir_etapa($1, 'Cadastro em sistema', 1::smallint, $2)", [projetoId, lista[0].id])
      await c.query('select excluir_etapa($1)', [lista[2].id])
      // Lista: Abertura, Cadastro em sistema (concluída na inclusão), Captura, Entrevista - Timenow...
      expect(await etapaAtual(c, vaga)).toBe(3)
      expect(await erroSalvo(c, () => c.query("select concluir_etapa($1, 3::smallint, '2026-10-01'::date)", [vaga]))).toContain('data antes da etapa anterior')
      await c.query("select concluir_etapa($1, 3::smallint, '2026-10-05'::date)", [vaga])
      const ultima = (await conclusoes(c, vaga)).at(-1)
      expect(ultima).toEqual({ posicao: 3, nome: 'Captura de Mercado', data: '2026-10-05' })
      // A ordem antiga continua a da etapa padrão (Captura = 2), para o código publicado.
      expect((await c.query('select ordem from vaga_conclusoes where vaga_id = $1 and etapa_id = $2', [vaga, lista[1].id])).rows).toEqual([{ ordem: 2 }])
      expect(await erroSalvo(c, () => c.query('select desfazer_etapa($1, 2::smallint)', [vaga]))).toContain('etapa mudou')
      await c.query('select desfazer_etapa($1, 3::smallint)', [vaga])
      expect((await conclusoes(c, vaga)).map((x) => x.posicao)).toEqual([1, 2])
      const { rows } = await c.query("select acao, detalhe from historico where vaga_id = $1 and acao like 'Desfez%'", [vaga])
      expect(rows).toEqual([{ acao: 'Desfez Captura de Mercado', detalhe: { ordem: 3 } }])
    }))

  it('desistência volta para a captura onde ela estiver', () =>
    emTransacao(async (c) => {
      const { projetoId, ondaId } = await projetoComOnda(c)
      const vaga = await novaVaga(c, { projetoId, ondaId, dataInicio: '2026-10-01' })
      const lista = await etapasDoProjeto(c, projetoId)
      await comoUsuario(c, 'rh')
      await c.query("select incluir_etapa($1, 'Cadastro em sistema', 1::smallint, $2)", [projetoId, lista[0].id])
      await comoBanco(c, () => concluirAte(c, vaga, 4, '2026-10-05'))
      expect((await etapasDoProjeto(c, projetoId))[2].fixa).toBe('captura')

      await c.query('select candidato_desistiu($1)', [vaga])
      expect((await conclusoes(c, vaga)).map((x) => x.posicao)).toEqual([1, 2])
      const { rows } = await c.query("select detalhe from historico where vaga_id = $1 and acao = 'Candidato desistiu'", [vaga])
      expect(rows[0].detalhe.conclusoes).toEqual([
        { ordem: 3, concluida_em: '2026-10-05' },
        { ordem: 4, concluida_em: '2026-10-05' },
      ])
    }))

  it('desistência depois da admissão é recusada onde a admissão estiver', () =>
    emTransacao(async (c) => {
      const { projetoId, ondaId } = await projetoComOnda(c)
      const vaga = await novaVaga(c, { projetoId, ondaId, dataInicio: '2026-10-01' })
      const lista = await etapasDoProjeto(c, projetoId)
      await comoUsuario(c, 'rh')
      await c.query('select excluir_etapa($1)', [lista[2].id])
      // A Admissão passou para a posição 10.
      await comoBanco(c, () => concluirAte(c, vaga, 10, '2026-10-05'))
      expect(await erroSalvo(c, () => c.query('select candidato_desistiu($1)', [vaga]))).toContain('vaga já admitida')
    }))

  it('importar_vagas lê as conclusões por posição', () =>
    emTransacao(async (c) => {
      const { projetoId, ondaId } = await projetoComOnda(c)
      const lista = await etapasDoProjeto(c, projetoId)
      await comoUsuario(c, 'rh')
      await c.query("select incluir_etapa($1, 'Cadastro em sistema', 1::smallint, null)", [projetoId])
      await c.query('select importar_vagas($1, $2)', [
        projetoId,
        JSON.stringify([
          {
            funcao: 'Eletricista',
            onda_id: ondaId,
            data_inicio: '2026-10-01',
            concluidas: [
              { ordem: 1, concluida_em: '2026-10-01' },
              { ordem: 2, concluida_em: '2026-10-02' },
            ],
          },
        ]),
      ])
      const { rows } = await c.query('select id from vagas where projeto_id = $1', [projetoId])
      expect(await conclusoes(c, rows[0].id)).toEqual([
        { posicao: 1, nome: 'Cadastro em sistema', data: '2026-10-01' },
        { posicao: 2, nome: lista[0].nome, data: '2026-10-02' },
      ])
    }))
})

describe('durações da lista', () => {
  it('alterar_duracao_etapa e alterar_duracao_projeto mantêm a lista igual', () =>
    emTransacao(async (c) => {
      const { projetoId } = await projetoComOnda(c)
      const lista = await etapasDoProjeto(c, projetoId)
      await comoUsuario(c, 'rh')
      const duracao = async (id: string) => (await c.query('select duracao from projeto_etapas where id = $1', [id])).rows[0].duracao
      // O código publicado ainda muda a duração por ordem: a lista acompanha.
      await c.query('select alterar_duracao_projeto($1, 9::smallint, 3::smallint)', [projetoId])
      expect(await duracao(lista[8].id)).toBe(3)
      await c.query('select alterar_duracao_projeto($1, 9::smallint, null)', [projetoId])
      expect(await duracao(lista[8].id)).toBe(null)

      await c.query('select alterar_duracao_etapa($1, 4::smallint)', [lista[8].id])
      expect(await duracao(lista[8].id)).toBe(4)
      await c.query('select alterar_duracao_etapa($1, null)', [lista[8].id])
      expect(await duracao(lista[8].id)).toBe(null)
      const { rows } = await c.query("select incluir_etapa($1, 'Cadastro em sistema', 2::smallint, null) as id", [projetoId])
      expect(await erroSalvo(c, () => c.query('select alterar_duracao_etapa($1, null)', [rows[0].id]))).toContain('duração obrigatória')
      await c.query('select alterar_duracao_etapa($1, 5::smallint)', [rows[0].id])
      expect(await duracao(rows[0].id)).toBe(5)
      const { rows: h } = await c.query(
        "select detalhe from historico where vaga_id is null and acao = 'Alterou a duração de Cadastro em sistema'",
      )
      expect(h.map((x) => [x.detalhe.antes, x.detalhe.depois])).toEqual([[2, 5]])
      expect(h[0].detalhe.projeto).toEqual(expect.stringContaining('teste-sql Projeto'))
    }))
})

describe('permissões e projeto encerrado', () => {
  it('projeto encerrado recusa mudar a lista', () =>
    emTransacao(async (c) => {
      const { projetoId } = await projetoComOnda(c)
      const lista = await etapasDoProjeto(c, projetoId)
      await comoUsuario(c, 'rh')
      await c.query('select encerrar_projeto($1)', [projetoId])
      const chamadas: [string, unknown[]][] = [
        ["select incluir_etapa($1, 'Nova', 1::smallint, $2)", [projetoId, lista[12].id]],
        ["select incluir_etapa($1, 'Nova', 1::smallint, $2)", [projetoId, lista[3].id]],
        ['select excluir_etapa($1)', [lista[3].id]],
        ["select renomear_etapa($1, 'Outra')", [lista[3].id]],
        ['select mover_etapa($1, 1::smallint)', [lista[3].id]],
        ['select alterar_duracao_etapa($1, 3::smallint)', [lista[3].id]],
      ]
      for (const [sql, params] of chamadas) expect(await erroSalvo(c, () => c.query(sql, params)), sql).toContain('projeto encerrado')
      await comoBanco(c, async () => {
        expect(await erroSalvo(c, () => c.query("update projeto_etapas set nome = 'x' where id = $1", [lista[3].id]))).toContain('projeto encerrado')
      })
    }))

  for (const perfil of ['gestor', 'cliente'] as const) {
    it(`gestor e cliente não leem lista de projeto não liberado e não escrevem (${perfil})`, () =>
      emTransacao(async (c) => {
        const cli = await novoCliente(c)
        const liberado = await novoProjeto(c, { clienteId: cli, organizacao: 'ondas' })
        const fechado = await novoProjeto(c, { clienteId: cli, organizacao: 'ondas' })
        const vaga = await novaVaga(c, { projetoId: liberado.projetoId, ondaId: liberado.ondaId })
        const lista = await etapasDoProjeto(c, liberado.projetoId)
        const { usuarioId } = await comoUsuario(c, perfil, perfil === 'cliente' ? cli : undefined)
        await comoBanco(c, () => c.query('insert into projeto_acessos (projeto_id, usuario_id) values ($1, $2)', [liberado.projetoId, usuarioId]))

        expect(await contar(c, 'select count(*) as n from projeto_etapas where projeto_id = $1', [fechado.projetoId])).toBe(0)
        expect(await contar(c, 'select count(*) as n from projeto_etapas where projeto_id = $1', [liberado.projetoId])).toBe(13)
        expect(
          await erroSalvo(c, () => c.query("insert into projeto_etapas (projeto_id, posicao, nome, duracao) values ($1, 14, 'x', 1)", [liberado.projetoId])),
        ).toMatch(/row-level security/)
        expect((await c.query("update projeto_etapas set nome = 'x' where id = $1", [lista[3].id])).rowCount).toBe(0)
        expect((await c.query('delete from projeto_etapas where id = $1', [lista[3].id])).rowCount).toBe(0)
        const chamadas: [string, unknown[]][] = [
          ["select incluir_etapa($1, 'Nova', 1::smallint, null)", [liberado.projetoId]],
          ['select excluir_etapa($1)', [lista[3].id]],
          ["select renomear_etapa($1, 'Outra')", [lista[3].id]],
          ['select mover_etapa($1, 1::smallint)', [lista[3].id]],
          ['select alterar_duracao_etapa($1, 3::smallint)', [lista[3].id]],
          ["select concluir_etapas($1, 1::smallint, 2::smallint, '2026-10-22'::date)", [vaga]],
        ]
        for (const [sql, params] of chamadas) expect(await erroSalvo(c, () => c.query(sql, params)), sql).toContain('sem permissão')
      }))
  }

  it('nem o RH escreve direto na lista: só pelas funções', () =>
    emTransacao(async (c) => {
      const { projetoId } = await projetoComOnda(c)
      const lista = await etapasDoProjeto(c, projetoId)
      await comoUsuario(c, 'rh')
      expect(await contar(c, 'select count(*) as n from projeto_etapas where projeto_id = $1', [projetoId])).toBe(13)
      expect(
        await erroSalvo(c, () => c.query("insert into projeto_etapas (projeto_id, posicao, nome, duracao) values ($1, 14, 'x', 1)", [projetoId])),
      ).toMatch(/row-level security/)
      expect((await c.query("update projeto_etapas set nome = 'x', fixa = null where id = $1", [lista[1].id])).rowCount).toBe(0)
      expect((await c.query('update projeto_etapas set posicao = 20 where id = $1', [lista[10].id])).rowCount).toBe(0)
      expect((await c.query('delete from projeto_etapas where id = $1', [lista[3].id])).rowCount).toBe(0)
      expect(await etapasDoProjeto(c, projetoId)).toEqual(lista)
    }))

  it('as funções internas da lista não podem ser chamadas pelo usuário', () =>
    emTransacao(async (c) => {
      for (const f of [
        'etapas_do_projeto_novo()',
        'etapa_da_conclusao()',
        'posicao_etapa(uuid)',
        'etapa_na_posicao(uuid, smallint)',
        'etapa_fixa(uuid, text)',
      ]) {
        for (const papel of ['authenticated', 'anon']) {
          expect((await c.query('select has_function_privilege($1, $2, $3) as ok', [papel, f, 'execute'])).rows[0].ok, `${papel} ${f}`).toBe(false)
        }
      }
      for (const f of [
        'concluir_etapas(uuid, smallint, smallint, date)',
        'incluir_etapa(uuid, text, smallint, uuid)',
        'excluir_etapa(uuid)',
        'renomear_etapa(uuid, text)',
        'mover_etapa(uuid, smallint)',
        'alterar_duracao_etapa(uuid, smallint)',
      ]) {
        expect((await c.query("select has_function_privilege('authenticated', $1, 'execute') as ok", [f])).rows[0].ok, f).toBe(true)
        expect((await c.query("select has_function_privilege('anon', $1, 'execute') as ok", [f])).rows[0].ok, f).toBe(false)
      }
    }))
})
