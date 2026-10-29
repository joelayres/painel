// Lê o modelo Excel de vagas de um projeto (ver modelo.ts) e confere cada linha antes de importar.
import ExcelJS from 'exceljs'
import type { Feriados } from '@/dominio/calendario'
import type { EtapaDef } from '@/dominio/etapas'
import { chaveFuncao } from '@/dominio/painel'
import { preverVaga } from '@/dominio/previsao'
import { avisoMeta } from '@/dominio/situacao'
import { lerData, texto } from './datas'
import { COLUNAS_FIXAS, colunasFixas, type Organizacao } from './modelo'

export type ContextoImportacao = {
  organizacao: Organizacao
  ondas: { id: string; nome: string; fim: string }[]
  gestores: { id: string; nome: string }[]
  etapas: EtapaDef[]
  feriados: Feriados
  hoje: string
  existentes: { funcao: string; candidato: string | null; meta: string }[]
}

export type VagaImportada = {
  linha: number
  funcao: string
  disciplina: string
  area: string
  gestorId: string | null
  ondaId: string | null
  meta: string | null
  dataInicio: string
  candidato: string | null
  concluidas: { ordem: number; concluidaEm: string }[]
  aviso: string | null
  repetida: boolean
}

export type ErroImportacao = { linha: number; mensagem: string }
export type ResultadoImportacao = { ok: true; vagas: VagaImportada[] } | { ok: false; erros: ErroImportacao[] }

// Sem acento, minúsculas e espaços normalizados: casa cabeçalhos, ondas e gestores.
const normalizar = chaveFuncao

const chaveRepetida = (funcao: string, candidato: string | null, meta: string) => `${chaveFuncao(funcao)}|${candidato ? normalizar(candidato) : ''}|${meta}`

export async function lerModeloVagas(arquivo: ArrayBuffer, ctx: ContextoImportacao): Promise<ResultadoImportacao> {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(arquivo)
  } catch {
    return { ok: false, erros: [{ linha: 0, mensagem: 'Não foi possível ler o arquivo. Envie o modelo .xlsx baixado do projeto.' }] }
  }
  const ws = wb.getWorksheet('Vagas') ?? wb.worksheets[0]
  if (!ws) return { ok: false, erros: [{ linha: 0, mensagem: 'A planilha não tem abas.' }] }

  // Coluna de cada cabeçalho, pelo nome normalizado.
  const colunas = new Map<string, number>()
  ws.getRow(1).eachCell((c, n) => {
    const nome = normalizar(texto(c.value))
    if (nome && !colunas.has(nome)) colunas.set(nome, n)
  })
  const erros: ErroImportacao[] = []
  const fixas = colunasFixas(ctx.organizacao)
  const faltando = fixas.filter((c) => !colunas.has(normalizar(c)))
  if (faltando.length) return { ok: false, erros: faltando.map((c) => ({ linha: 1, mensagem: `Falta a coluna ${c}. Use o modelo baixado do projeto.` })) }

  // Toda coluna do cabeçalho precisa ser do modelo: as fixas ou uma etapa da lista do projeto.
  const conhecidas = new Set([...COLUNAS_FIXAS, 'Meta', ...ctx.etapas.map((e) => e.nome)].map(normalizar))
  const desconhecidas = [...colunas.keys()].filter((c) => !conhecidas.has(c))
  if (desconhecidas.length) {
    ws.getRow(1).eachCell((c) => {
      if (desconhecidas.includes(normalizar(texto(c.value)))) erros.push({ linha: 1, mensagem: `Coluna desconhecida: ${texto(c.value).trim()}. Baixe o modelo de novo.` })
    })
  }
  const semEtapa = ctx.etapas.filter((e) => !colunas.has(normalizar(e.nome)))
  erros.push(...semEtapa.map((e) => ({ linha: 1, mensagem: `Falta a coluna ${e.nome}. Baixe o modelo de novo.` })))
  if (erros.length) return { ok: false, erros }

  const col = (nome: string) => colunas.get(normalizar(nome))
  const etapas = [...ctx.etapas].sort((a, b) => a.ordem - b.ordem)
  const ondas = new Map(ctx.ondas.map((o) => [normalizar(o.nome), o]))
  const gestores = new Map(ctx.gestores.map((g) => [normalizar(g.nome), g]))
  const vistas = new Set(ctx.existentes.map((e) => chaveRepetida(e.funcao, e.candidato, e.meta)))
  const colunaOnda = col('Onda')

  const vagas: VagaImportada[] = []

  ws.eachRow((row, n) => {
    if (n === 1) return
    const celula = (c: number | undefined) => (c === undefined ? '' : texto(row.getCell(c).value).trim())
    const vazia = Array.from({ length: ws.columnCount }, (_, i) => celula(i + 1)).every((t) => t === '')
    if (vazia) return

    const errosDaLinha: string[] = []
    const erro = (mensagem: string) => void errosDaLinha.push(mensagem)
    // Data de uma coluna: null se vazia, undefined se inválida (o erro já fica anotado).
    const data = (nome: string): string | null | undefined => {
      const c = col(nome)
      if (c === undefined || celula(c) === '') return null
      const d = lerData(row.getCell(c).value)
      if (!d) erro(`Data inválida em ${nome}.`)
      return d ?? undefined
    }

    const funcao = celula(col('Função'))
    if (!funcao) erro('Informe a função.')

    let ondaId: string | null = null
    let meta: string | null = null
    if (ctx.organizacao === 'ondas') {
      const nome = celula(colunaOnda)
      const onda = ondas.get(normalizar(nome))
      if (!nome) erro('Informe a onda.')
      else if (!onda) erro(`Onda ${nome} não existe neste projeto.`)
      else {
        ondaId = onda.id
        meta = onda.fim
      }
    } else {
      if (celula(colunaOnda)) erro('Este projeto não usa ondas; deixe a coluna Onda vazia.')
      const m = data('Meta')
      if (m === null) erro('Informe a meta.')
      else if (m) meta = m
    }

    const nomeGestor = celula(col('Gestor'))
    const gestor = nomeGestor ? gestores.get(normalizar(nomeGestor)) : undefined
    if (nomeGestor && !gestor) erro(`Gestor ${nomeGestor} não está cadastrado no cliente.`)

    const inicio = data('Início do processo')

    // Conclusões: as etapas vêm em ordem; uma preenchida depois de uma vazia é erro.
    const concluidas: { ordem: number; concluidaEm: string }[] = []
    let datasOk = true
    let lacuna = false
    let anterior: { nome: string; data: string } | null = null
    for (const e of etapas) {
      const d = data(e.nome)
      if (d === undefined) {
        datasOk = false
        continue
      }
      if (d === null) {
        lacuna = true
        continue
      }
      if (lacuna) {
        erro(`Etapa ${e.nome} concluída depois de uma não concluída.`)
        datasOk = false
        break
      }
      if (d > ctx.hoje) {
        erro(`Data no futuro em ${e.nome}.`)
        datasOk = false
      } else if (anterior && d < anterior.data) {
        erro(`Datas fora de ordem: ${e.nome} antes de ${anterior.nome}.`)
        datasOk = false
      }
      concluidas.push({ ordem: e.ordem, concluidaEm: d })
      anterior = { nome: e.nome, data: d }
    }

    const primeira = concluidas[0]?.concluidaEm
    if (inicio && primeira && datasOk && inicio > primeira) erro(`O início do processo é depois da conclusão da ${etapas[0].nome}.`)

    if (errosDaLinha.length) return void erros.push(...errosDaLinha.map((mensagem) => ({ linha: n, mensagem })))
    if (inicio === undefined || meta === null) return

    const dataInicio = inicio ?? (primeira && primeira < ctx.hoje ? primeira : ctx.hoje)
    const candidato = celula(col('Candidato')) || null
    const previsao = preverVaga({ dataInicio, etapas, conclusoes: concluidas, feriados: ctx.feriados })
    const chave = chaveRepetida(funcao, candidato, meta)
    const repetida = vistas.has(chave)
    vistas.add(chave)
    vagas.push({
      linha: n,
      funcao,
      disciplina: celula(col('Disciplina')),
      area: celula(col('Área')),
      gestorId: gestor?.id ?? null,
      ondaId,
      meta,
      dataInicio,
      candidato,
      concluidas,
      aviso: avisoMeta(previsao, meta),
      repetida,
    })
  })

  if (erros.length) return { ok: false, erros }
  return { ok: true, vagas }
}
