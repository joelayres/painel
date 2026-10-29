// @vitest-environment node
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { ETAPAS_PADRAO, type EtapaDef } from '@/dominio/etapas'
import { type ContextoImportacao, lerModeloVagas } from '../ler'
import { gerarModelo } from '../modelo'

const ONDAS = [{ id: 'o1', nome: '1ª Onda', fim: '2026-12-18' }, { id: 'o2', nome: '2ª Onda', fim: '2027-01-29' }]
const GESTORES = [{ id: 'g1', nome: 'Ana Lima' }, { id: 'g2', nome: 'Bruno Costa' }]

const contexto = (extra: Partial<ContextoImportacao> = {}): ContextoImportacao => ({
  organizacao: 'ondas',
  ondas: ONDAS,
  gestores: GESTORES,
  etapas: ETAPAS_PADRAO,
  feriados: new Set(['2026-11-02']),
  hoje: '2026-10-28',
  existentes: [],
  ...extra,
})

// Preenche o modelo do projeto pelo nome da coluna, como o RH faria no Excel.
async function planilha(organizacao: 'ondas' | 'meta', linhas: Record<string, unknown>[], tirar: string[] = [], etapas: EtapaDef[] = ETAPAS_PADRAO): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load((await gerarModelo({ organizacao, ondas: ONDAS.map((o) => o.nome), gestores: GESTORES.map((g) => g.nome), etapas })) as unknown as ArrayBuffer)
  const ws = wb.getWorksheet('Vagas')!
  for (const nome of tirar) {
    const i = (ws.getRow(1).values as unknown[]).indexOf(nome)
    ws.spliceColumns(i, 1)
  }
  const cab = (ws.getRow(1).values as unknown[]).map((v) => (v === undefined ? '' : String(v)))
  for (const l of linhas) ws.addRow(cab.slice(1).map((c) => l[c] ?? null))
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

describe('leitura do modelo de vagas', () => {
  it('lê duas vagas com etapas concluídas, onda e gestor pelo nome', async () => {
    const r = await lerModeloVagas(await planilha('ondas', [
      { 'Função': 'Eletricista', 'Disciplina': 'NR-10', 'Área': 'Manutenção', 'Gestor': 'ana lima', 'Onda': '1ª onda', 'Início do processo': '20/10/2026', 'Candidato': 'Lucas Santos', 'Abertura de vaga': '20/10/2026', 'Captura de Mercado': '26/10/26' },
      {},
      { 'Função': 'Técnico de Planejamento', 'Onda': '2ª Onda', 'Início do processo': '22/10/2026' },
    ]), contexto())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.vagas).toHaveLength(2)
    expect(r.vagas[0]).toMatchObject({
      linha: 2, funcao: 'Eletricista', disciplina: 'NR-10', area: 'Manutenção', gestorId: 'g1', ondaId: 'o1', meta: '2026-12-18',
      dataInicio: '2026-10-20', candidato: 'Lucas Santos', repetida: false,
    })
    expect(r.vagas[0].concluidas).toEqual([{ ordem: 1, concluidaEm: '2026-10-20' }, { ordem: 2, concluidaEm: '2026-10-26' }])
    expect(r.vagas[1]).toMatchObject({ linha: 4, funcao: 'Técnico de Planejamento', disciplina: '', gestorId: null, ondaId: 'o2', candidato: null, concluidas: [] })
  })

  it('início vazio com etapas concluídas usa a primeira conclusão', async () => {
    const r = await lerModeloVagas(await planilha('ondas', [{ 'Função': 'Eletricista', 'Onda': '1ª Onda', 'Abertura de vaga': '20/10/2026' }]), contexto())
    expect(r.ok && r.vagas[0].dataInicio).toBe('2026-10-20')
  })

  it('início vazio sem etapas concluídas usa hoje', async () => {
    const r = await lerModeloVagas(await planilha('ondas', [{ 'Função': 'Eletricista', 'Onda': '1ª Onda' }]), contexto())
    expect(r.ok && r.vagas[0].dataInicio).toBe('2026-10-28')
  })

  it('projeto meta avisa quando a admissão passa da meta', async () => {
    const r = await lerModeloVagas(await planilha('meta', [{ 'Função': 'Eletricista', 'Meta': '18/11/2026', 'Início do processo': '22/10/2026' }]), contexto({ organizacao: 'meta', ondas: [] }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.vagas[0]).toMatchObject({ ondaId: null, meta: '2026-11-18' })
    expect(r.vagas[0].aviso).toContain('a admissão sai em 19/11')
  })

  it('linha igual a uma vaga existente sai como repetida, sem erro', async () => {
    const existentes = [{ funcao: 'Eletricista', candidato: 'Lucas Santos', meta: '2026-12-18' }]
    const r = await lerModeloVagas(await planilha('ondas', [
      { 'Função': 'eletricista ', 'Onda': '1ª Onda', 'Candidato': 'Lucas Santos' },
      { 'Função': 'Pintor', 'Onda': '1ª Onda' },
      { 'Função': 'Pintor', 'Onda': '1ª Onda' },
    ]), contexto({ existentes }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.vagas.map((v) => v.repetida)).toEqual([true, false, true])
  })

  it('gestor inexistente dá erro na linha', async () => {
    const r = await lerModeloVagas(await planilha('ondas', [{ 'Função': 'Eletricista', 'Onda': '1ª Onda', 'Gestor': 'Carla' }]), contexto())
    expect(r).toEqual({ ok: false, erros: [{ linha: 2, mensagem: 'Gestor Carla não está cadastrado no cliente.' }] })
  })

  it('etapa concluída depois de uma não concluída dá erro na linha', async () => {
    const r = await lerModeloVagas(await planilha('ondas', [
      { 'Função': 'Pintor', 'Onda': '1ª Onda' },
      { 'Função': 'Eletricista', 'Onda': '1ª Onda', 'Captura de Mercado': '26/10/2026' },
    ]), contexto())
    expect(r).toEqual({ ok: false, erros: [{ linha: 3, mensagem: 'Etapa Captura de Mercado concluída depois de uma não concluída.' }] })
  })

  it('data no futuro dá erro na linha', async () => {
    const r = await lerModeloVagas(await planilha('ondas', [{ 'Função': 'Eletricista', 'Onda': '1ª Onda', 'Abertura de vaga': '29/10/2026' }]), contexto())
    expect(r).toEqual({ ok: false, erros: [{ linha: 2, mensagem: 'Data no futuro em Abertura de vaga.' }] })
  })

  it('falta da coluna Função dá erro na linha 1', async () => {
    const r = await lerModeloVagas(await planilha('ondas', [{ 'Onda': '1ª Onda' }], ['Função']), contexto())
    expect(r).toEqual({ ok: false, erros: [{ linha: 1, mensagem: 'Falta a coluna Função. Use o modelo baixado do projeto.' }] })
  })

  it('outros erros apontam a linha', async () => {
    const r = await lerModeloVagas(await planilha('ondas', [
      { 'Disciplina': 'NR-10', 'Onda': '1ª Onda' },
      { 'Função': 'A', 'Onda': '5ª Onda' },
      { 'Função': 'B', 'Onda': '1ª Onda', 'Início do processo': '31/02/2026' },
      { 'Função': 'C', 'Onda': '1ª Onda', 'Início do processo': '22/10/2026', 'Abertura de vaga': '21/10/2026' },
      { 'Função': 'D', 'Onda': '1ª Onda', 'Abertura de vaga': '22/10/2026', 'Captura de Mercado': '21/10/2026' },
    ]), contexto())
    expect(r).toEqual({ ok: false, erros: [
      { linha: 2, mensagem: 'Informe a função.' },
      { linha: 3, mensagem: 'Onda 5ª Onda não existe neste projeto.' },
      { linha: 4, mensagem: 'Data inválida em Início do processo.' },
      { linha: 5, mensagem: 'O início do processo é depois da conclusão da Abertura de vaga.' },
      { linha: 6, mensagem: 'Datas fora de ordem: Captura de Mercado antes de Abertura de vaga.' },
    ] })
  })

  it('projeto meta recusa onda preenchida e meta vazia', async () => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await planilha('meta', [{ 'Função': 'A' }]))
    const ws = wb.getWorksheet('Vagas')!
    ws.getRow(1).getCell(ws.columnCount + 1).value = 'Onda'
    ws.addRow(['B', null, null, null, '18/11/2026']).getCell(ws.columnCount).value = '1ª Onda'
    const r = await lerModeloVagas((await wb.xlsx.writeBuffer()) as ArrayBuffer, contexto({ organizacao: 'meta' }))
    expect(r).toEqual({ ok: false, erros: [
      { linha: 2, mensagem: 'Informe a meta.' },
      { linha: 3, mensagem: 'Este projeto não usa ondas; deixe a coluna Onda vazia.' },
    ] })
  })

  it('coluna de etapa que o projeto não tem dá erro e não importa nada', async () => {
    const semTreinamento = ETAPAS_PADRAO.filter((e) => e.nome !== 'Treinamento')
    const r = await lerModeloVagas(await planilha('ondas', [{ 'Função': 'A', 'Onda': '1ª Onda', 'Treinamento': '22/10/2026' }]), contexto({ etapas: semTreinamento }))
    expect(r).toEqual({ ok: false, erros: [{ linha: 1, mensagem: 'Coluna desconhecida: Treinamento. Baixe o modelo de novo.' }] })
  })

  it('falta de coluna de etapa dá erro pedindo o modelo de novo', async () => {
    const r = await lerModeloVagas(await planilha('ondas', [{ 'Função': 'A', 'Onda': '1ª Onda' }], ['Treinamento']), contexto())
    expect(r).toEqual({ ok: false, erros: [{ linha: 1, mensagem: 'Falta a coluna Treinamento. Baixe o modelo de novo.' }] })
  })

  it('lê a conclusão da etapa nova no modelo de um projeto de 14 etapas', async () => {
    const lista: EtapaDef[] = [
      ...ETAPAS_PADRAO.slice(0, 3),
      { id: 'nova', ordem: 4, nome: 'Teste prático', duracao: 2, fixa: null },
      ...ETAPAS_PADRAO.slice(3).map((e) => ({ ...e, ordem: e.ordem + 1 })),
    ]
    const r = await lerModeloVagas(await planilha('ondas', [
      { 'Função': 'A', 'Onda': '1ª Onda', 'Abertura de vaga': '20/10/2026', 'Captura de Mercado': '21/10/2026', 'Triagem de Candidatos': '22/10/2026', 'Teste prático': '23/10/2026' },
    ], [], lista), contexto({ etapas: lista }))
    expect(r.ok && r.vagas[0].concluidas).toEqual([
      { ordem: 1, concluidaEm: '2026-10-20' }, { ordem: 2, concluidaEm: '2026-10-21' }, { ordem: 3, concluidaEm: '2026-10-22' }, { ordem: 4, concluidaEm: '2026-10-23' },
    ])
  })
})
