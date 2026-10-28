// Lê a planilha "Acompanhamento Mobilizações.xlsx" para a carga inicial.
// Linha de vaga: nome com até 3 espaços à esquerda; linhas de etapa (6+ espaços) vêm logo abaixo.
import ExcelJS from 'exceljs'
import { ETAPAS_PADRAO } from '@/dominio/etapas'
import { hojeSP } from '@/dominio/tempo'
import { dataValida } from '@/lib/validacao/vaga'

export type VagaCarga = {
  linha: number
  funcao: string
  disciplina: string
  area: string
  onda: number
  candidato: string | null
  dataInicio: string
  concluidas: { ordem: number; concluidaEm: string }[]
}
type Erro = { linha: number; mensagem: string }
export type ResultadoCarga = { ok: true; vagas: VagaCarga[]; erros: [] } | { ok: false; erros: Erro[] }

const normalizar = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
const ORDEM_POR_NOME = new Map(ETAPAS_PADRAO.map((e) => [normalizar(e.nome), e.ordem]))

function valor(celula: ExcelJS.CellValue): ExcelJS.CellValue {
  if (celula && typeof celula === 'object' && 'result' in celula) return celula.result as ExcelJS.CellValue
  if (celula && typeof celula === 'object' && 'richText' in celula) return celula.richText.map((t) => t.text).join('')
  return celula
}

const texto = (c: ExcelJS.CellValue) => {
  const v = valor(c)
  return v === null || v === undefined ? '' : String(v)
}

// "Qui 22/10/26", "22/10/2026" ou data do Excel → "2026-10-22".
function lerData(c: ExcelJS.CellValue): string | null {
  const v = valor(c)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})/.exec(texto(v))
  if (!m) return null
  const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  const iso = `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return dataValida(iso) ? iso : null
}

// "1º Onda", "1ª Onda" ou "Onda 1".
function lerOnda(c: ExcelJS.CellValue): number | null {
  const m = /^\s*(\d)\s*[ºª°o]?\s*onda\s*$|^\s*onda\s*(\d)\s*$/i.exec(texto(c))
  const n = m ? Number(m[1] ?? m[2]) : NaN
  return n >= 1 && n <= 4 ? n : null
}

// `hoje`: uma etapa marcada como feita com data futura (a data planejada) passa a valer hoje.
export async function lerPlanilhaMobilizacao(arquivo: ArrayBuffer, hoje: string = hojeSP()): Promise<ResultadoCarga> {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(arquivo)
  } catch {
    return { ok: false, erros: [{ linha: 0, mensagem: 'Não foi possível ler o arquivo. Envie a planilha .xlsx de acompanhamento.' }] }
  }
  const ws = wb.worksheets[0]
  if (!ws) return { ok: false, erros: [{ linha: 0, mensagem: 'A planilha não tem abas.' }] }

  const vagas: VagaCarga[] = []
  const erros: Erro[] = []
  // Etapas lidas de cada vaga; as conclusões são decididas depois de ler todas (ver resolverConclusoes).
  type EtapaLida = { linha: number; ordem: number; progresso: number; fim: string | null }
  type VagaLida = VagaCarga & { etapas: EtapaLida[] }
  let atual: VagaLida | null = null
  // Depois de uma vaga com erro, as etapas dela são puladas (o erro já aponta a linha da vaga).
  let pulandoEtapas = false

  ws.eachRow((row, n) => {
    if (n === 1) return
    const bruto = texto(row.getCell(1).value)
    const nome = bruto.trim()
    if (!nome) return
    const recuo = bruto.length - bruto.trimStart().length

    if (recuo <= 3) {
      atual = null
      pulandoEtapas = false
      const dataInicio = lerData(row.getCell(5).value)
      const ondaTexto = texto(row.getCell(8).value)
      // Linha de agrupamento sem dados (ex.: "Treinamento - Braskem") é ignorada.
      if (!dataInicio && !ondaTexto) return
      const onda = lerOnda(row.getCell(8).value)
      pulandoEtapas = true
      if (onda === null) return void erros.push({ linha: n, mensagem: 'onda inválida' })
      if (!dataInicio) return void erros.push({ linha: n, mensagem: 'data de início inválida' })
      pulandoEtapas = false
      atual = {
        linha: n,
        funcao: nome,
        disciplina: texto(row.getCell(2).value).trim(),
        area: texto(row.getCell(3).value).trim(),
        onda,
        candidato: texto(row.getCell(9).value).trim() || null,
        dataInicio,
        concluidas: [],
        etapas: [],
      }
      vagas.push(atual)
      return
    }

    if (pulandoEtapas) return
    if (!atual) return void erros.push({ linha: n, mensagem: 'etapa antes de qualquer vaga' })
    const vaga: VagaLida = atual
    const ordem = ORDEM_POR_NOME.get(normalizar(nome))
    if (!ordem) return void erros.push({ linha: n, mensagem: `etapa desconhecida: ${nome}` })
    // As etapas precisam vir 1, 2, 3… uma vez cada: o banco conta a etapa atual como "maior concluída + 1".
    if (ordem !== (vaga.etapas.at(-1)?.ordem ?? 0) + 1) {
      pulandoEtapas = true
      return void erros.push({ linha: n, mensagem: `etapa fora de ordem: ${nome}` })
    }
    vaga.etapas.push({ linha: n, ordem, progresso: Number(valor(row.getCell(7).value) ?? 0) || 0, fim: lerData(row.getCell(6).value) })
  })

  for (const v of vagas as VagaLida[]) erros.push(...resolverConclusoes(v, hoje))
  if (erros.length) return { ok: false, erros: erros.sort((a, b) => a.linha - b.linha) }
  return { ok: true, vagas: (vagas as VagaLida[]).map(({ etapas, ...v }) => (void etapas, v)), erros: [] }
}

// Concluídas = todas até a última etapa com 100%. Uma parcial (ex.: 99%) antes dela conta como
// concluída; uma com 0% antes dela é erro (a planilha diz que pulou uma etapa).
function resolverConclusoes(v: VagaCarga & { etapas: { linha: number; ordem: number; progresso: number; fim: string | null }[] }, hoje: string): Erro[] {
  const ultima = v.etapas.findLastIndex((e) => e.progresso >= 1)
  const erros: Erro[] = []
  for (let i = 0; i <= ultima; i++) {
    const e = v.etapas[i]
    if (e.progresso <= 0) {
      const seguinte = v.etapas.slice(i + 1).find((x) => x.progresso >= 1)!
      erros.push({ linha: seguinte.linha, mensagem: 'etapa concluída depois de uma não concluída' })
      break
    }
    if (!e.fim) {
      erros.push({ linha: e.linha, mensagem: 'data de fim inválida' })
      break
    }
    v.concluidas.push({ ordem: e.ordem, concluidaEm: e.fim > hoje ? hoje : e.fim })
  }
  return erros
}
