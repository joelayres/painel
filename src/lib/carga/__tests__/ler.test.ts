// @vitest-environment node
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { lerPlanilhaMobilizacao } from '../ler'

const CAB = ['Mobilização Braskem 2027', 'Disciplina', 'Atuação', 'duração', 'inicio', 'fim', 'Conclusão', 'Ondas', 'Candidato']
const ETAPAS = ['Abertura de vaga', 'Captura de Mercado', 'Triagem de Candidatos', 'Entrevista - Timenow', 'Entrevista - TNGO/Braskem', 'Envio para contratação',
  'Agendamento exames', 'Realização de Exames', 'Liberação dos exames', 'Ambientação/TBS', 'Admissão Timenow', 'Atualização da CTPS']
const FINS = ['Qui 22/10/26', 'Qua 28/10/26', 'Qui 29/10/26', 'Sex 30/10/26', 'Ter 03/11/26', 'Ter 03/11/26', 'Seg 09/11/26', 'Ter 10/11/26', 'Qui 19/11/26', 'Seg 23/11/26', 'Seg 23/11/26', 'Qui 26/11/26']

const vaga = (funcao: string, disciplina: string, area: string, onda: string, candidato: string | null): unknown[] =>
  [`   ${funcao}`, disciplina, area, '26 dias', 'Qui 22/10/26', 'Qui 26/11/26', 0.32, onda, candidato]
const etapas = (concluidas: number) => ETAPAS.map((e, i) => [`      ${e}`, null, null, '1 dia', 'Qui 22/10/26', FINS[i], i < concluidas ? 1 : 0])

async function planilha(linhas: unknown[][]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Planilha1')
  ws.addRow(CAB)
  for (const l of linhas) ws.addRow(l)
  const buf = await wb.xlsx.writeBuffer()
  return buf as ArrayBuffer
}

describe('leitura da planilha de mobilização', () => {
  it('lê as vagas com onda, candidato, início e etapas concluídas', async () => {
    const r = await lerPlanilhaMobilizacao(await planilha([
      vaga('Engenheiro de Campo', 'NR-13', 'Caldeiraria', '1º Onda', null), ...etapas(4),
      ['   Treinamento - Braskem'],
      vaga('Técnico de Planejamento', 'NR-13', 'Planejamento', '2ª Onda', 'Lucas Santos'), ...etapas(0),
    ]))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.vagas).toHaveLength(2)
    expect(r.vagas[0]).toMatchObject({ linha: 2, funcao: 'Engenheiro de Campo', disciplina: 'NR-13', area: 'Caldeiraria', onda: 1, candidato: null, dataInicio: '2026-10-22' })
    expect(r.vagas[0].concluidas).toEqual([
      { ordem: 1, concluidaEm: '2026-10-22' }, { ordem: 2, concluidaEm: '2026-10-28' }, { ordem: 3, concluidaEm: '2026-10-29' }, { ordem: 4, concluidaEm: '2026-10-30' },
    ])
    expect(r.vagas[1]).toMatchObject({ onda: 2, candidato: 'Lucas Santos', concluidas: [] })
  })

  it('aceita datas do Excel e "Onda 3"', async () => {
    const linha = vaga('Técnico de Campo', 'Fornos', 'Caldeiraria', 'Onda 3', null)
    linha[4] = new Date(Date.UTC(2026, 9, 26))
    const r = await lerPlanilhaMobilizacao(await planilha([linha, ...etapas(0)]))
    expect(r.ok && r.vagas[0]).toMatchObject({ onda: 3, dataInicio: '2026-10-26' })
  })

  it('aponta etapa antes de qualquer vaga', async () => {
    const r = await lerPlanilhaMobilizacao(await planilha([...etapas(0)]))
    expect(r).toEqual({ ok: false, erros: expect.arrayContaining([{ linha: 2, mensagem: 'etapa antes de qualquer vaga' }]) })
  })

  it('aponta onda inválida', async () => {
    const r = await lerPlanilhaMobilizacao(await planilha([vaga('X', 'Y', 'Z', '5º Onda', null), ...etapas(0)]))
    expect(r).toEqual({ ok: false, erros: [{ linha: 2, mensagem: 'onda inválida' }] })
  })

  it('aponta etapa concluída depois de uma não concluída', async () => {
    const linhas = etapas(0)
    linhas[2][6] = 1
    const r = await lerPlanilhaMobilizacao(await planilha([vaga('X', 'Y', 'Z', '1º Onda', null), ...linhas]))
    expect(r).toEqual({ ok: false, erros: [{ linha: 5, mensagem: 'etapa concluída depois de uma não concluída' }] })
  })

  it('etapa parcial seguida de etapa concluída conta como concluída', async () => {
    const linhas = etapas(8)
    linhas[5][6] = 0.99
    const r = await lerPlanilhaMobilizacao(await planilha([vaga('X', 'Y', 'Z', '1º Onda', null), ...linhas]))
    expect(r.ok && r.vagas[0].concluidas.map((c) => c.ordem)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('etapa parcial sem etapa concluída depois não conta como concluída', async () => {
    const linhas = etapas(2)
    linhas[2][6] = 0.5
    const r = await lerPlanilhaMobilizacao(await planilha([vaga('X', 'Y', 'Z', '1º Onda', null), ...linhas]))
    expect(r.ok && r.vagas[0].concluidas.map((c) => c.ordem)).toEqual([1, 2])
  })

  it('aponta etapa fora de ordem', async () => {
    const linhas = etapas(0)
    ;[linhas[1], linhas[2]] = [linhas[2], linhas[1]]
    const r = await lerPlanilhaMobilizacao(await planilha([vaga('X', 'Y', 'Z', '1º Onda', null), ...linhas]))
    expect(r).toEqual({ ok: false, erros: [{ linha: 4, mensagem: 'etapa fora de ordem: Triagem de Candidatos' }] })
  })

  it('aponta etapa repetida', async () => {
    const linhas = etapas(0)
    linhas.splice(2, 0, linhas[1])
    const r = await lerPlanilhaMobilizacao(await planilha([vaga('X', 'Y', 'Z', '1º Onda', null), ...linhas]))
    expect(r).toEqual({ ok: false, erros: [{ linha: 5, mensagem: 'etapa fora de ordem: Captura de Mercado' }] })
  })

  it('aponta etapa desconhecida', async () => {
    const r = await lerPlanilhaMobilizacao(await planilha([vaga('X', 'Y', 'Z', '1º Onda', null), ['      Etapa inventada', null, null, '1 dia', 'Qui 22/10/26', 'Qui 22/10/26', 0]]))
    expect(r).toEqual({ ok: false, erros: [{ linha: 3, mensagem: 'etapa desconhecida: Etapa inventada' }] })
  })

  it('arquivo que não é planilha dá erro claro', async () => {
    const r = await lerPlanilhaMobilizacao(new TextEncoder().encode('não é xlsx').buffer as ArrayBuffer)
    expect(r).toEqual({ ok: false, erros: [{ linha: 0, mensagem: 'Não foi possível ler o arquivo. Envie a planilha .xlsx de acompanhamento.' }] })
  })
})
