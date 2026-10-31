import type { Client } from 'pg'
import { describe, expect, it } from 'vitest'
import { comoUsuario, concluirAte, emTransacao, liberar, novaVaga, novoCliente, novoProjeto } from './apoio'

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

const salvar = (c: Client, vaga: string, ordem: number, texto: string) =>
  c.query('select salvar_motivo_atraso($1, $2::smallint, $3)', [vaga, ordem, texto])
const motivos = async (c: Client, vaga: string) =>
  (await c.query('select texto from vaga_motivos where vaga_id = $1', [vaga])).rows.map((r) => r.texto as string)
const acoes = async (c: Client, vaga: string) =>
  (await c.query("select acao, detalhe from historico where vaga_id = $1 and acao like '%motivo%' order by em, id", [vaga])).rows

// Projeto por ondas com uma vaga na etapa 3 (1 e 2 concluídas).
async function cenario(c: Client) {
  const cli = await novoCliente(c)
  const p = await novoProjeto(c, { clienteId: cli, organizacao: 'ondas' })
  const vaga = await novaVaga(c, { projetoId: p.projetoId, ondaId: p.ondaId })
  await concluirAte(c, vaga, 2, '2026-10-22')
  return { cli, ...p, vaga }
}

describe('motivo do atraso', () => {
  it('RH escreve, altera e apaga o motivo da etapa atual, com histórico', () =>
    emTransacao(async (c) => {
      const { vaga } = await cenario(c)
      await comoUsuario(c, 'rh')
      await salvar(c, vaga, 3, '  Candidato remarcou a triagem.  ')
      expect(await motivos(c, vaga)).toEqual(['Candidato remarcou a triagem.'])
      await salvar(c, vaga, 3, 'Triagem remarcada para 04/11.')
      expect(await motivos(c, vaga)).toEqual(['Triagem remarcada para 04/11.'])
      await salvar(c, vaga, 3, '   ')
      expect(await motivos(c, vaga)).toEqual([])
      const h = await acoes(c, vaga)
      expect(h.map((r) => r.acao)).toEqual([
        'Escreveu o motivo do atraso em Triagem de Candidatos',
        'Alterou o motivo do atraso em Triagem de Candidatos',
        'Apagou o motivo do atraso em Triagem de Candidatos',
      ])
      expect(h[1].detalhe).toEqual({ motivo: 'Triagem remarcada para 04/11.' })
    }))

  it('recusa etapa que não é a atual e texto longo demais', () =>
    emTransacao(async (c) => {
      const { vaga } = await cenario(c)
      await comoUsuario(c, 'rh')
      expect(await erroSalvo(c, () => salvar(c, vaga, 2, 'x'))).toContain('etapa mudou')
      expect(await erroSalvo(c, () => salvar(c, vaga, 3, 'x'.repeat(501)))).toContain('motivo longo demais')
    }))

  it('cliente e gestor leem, mas não escrevem; analista só no projeto liberado', () =>
    emTransacao(async (c) => {
      const { cli, projetoId, vaga } = await cenario(c)
      const { usuarioId: analista } = await comoUsuario(c, 'analista')
      expect(await erroSalvo(c, () => salvar(c, vaga, 3, 'x'))).toContain('sem permissão')
      await liberar(c, projetoId, analista)
      await salvar(c, vaga, 3, 'Gestor em viagem.')
      await c.query('reset role')
      const { usuarioId: cliente } = await comoUsuario(c, 'cliente', cli)
      await liberar(c, projetoId, cliente)
      expect(await motivos(c, vaga)).toEqual(['Gestor em viagem.'])
      expect(await erroSalvo(c, () => salvar(c, vaga, 3, 'y'))).toContain('sem permissão')
      expect(await erroSalvo(c, () => c.query("update vaga_motivos set texto = 'y'"))).toBeNull()
      expect(await motivos(c, vaga)).toEqual(['Gestor em viagem.'])
    }))

  it('quem não vê o projeto não lê o motivo', () =>
    emTransacao(async (c) => {
      const { vaga } = await cenario(c)
      await comoUsuario(c, 'rh')
      await salvar(c, vaga, 3, 'Gestor em viagem.')
      await c.query('reset role')
      await comoUsuario(c, 'gestor')
      expect(await motivos(c, vaga)).toEqual([])
    }))

  it('projeto encerrado não aceita motivo', () =>
    emTransacao(async (c) => {
      const { projetoId, vaga } = await cenario(c)
      await c.query('update projetos set encerrado_em = now() where id = $1', [projetoId])
      await comoUsuario(c, 'rh')
      expect(await erroSalvo(c, () => salvar(c, vaga, 3, 'x'))).toContain('projeto encerrado')
    }))
})
