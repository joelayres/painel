// Modelo Excel para importar as vagas de um projeto: aba "Vagas" (só o cabeçalho) e aba "Instruções".
import ExcelJS from 'exceljs'
import type { EtapaDef } from '@/dominio/etapas'

export type Organizacao = 'ondas' | 'meta'

// A quinta coluna é "Onda" ou "Meta", conforme a organização do projeto.
export const COLUNAS_FIXAS = ['Função', 'Disciplina', 'Área', 'Gestor', 'Onda', 'Início do processo', 'Candidato'] as const
export const colunasFixas = (organizacao: Organizacao): string[] => COLUNAS_FIXAS.map((c) => (c === 'Onda' && organizacao === 'meta' ? 'Meta' : c))

export async function gerarModelo(p: { organizacao: Organizacao; ondas: string[]; gestores: string[]; etapas: EtapaDef[] }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const etapas = [...p.etapas].sort((a, b) => a.ordem - b.ordem)
  const fixas = colunasFixas(p.organizacao)

  const ws = wb.addWorksheet('Vagas', { views: [{ state: 'frozen', ySplit: 1 }] })
  const cabecalho = ws.addRow([...fixas, ...etapas.map((e) => e.nome)])
  cabecalho.font = { bold: true }
  const datas = new Set(['Meta', 'Início do processo', ...etapas.map((e) => e.nome)])
  ;[...fixas, ...etapas.map((e) => e.nome)].forEach((nome, i) => {
    const col = ws.getColumn(i + 1)
    col.width = Math.max(14, nome.length + 4)
    if (datas.has(nome)) col.numFmt = 'dd/mm/yyyy'
  })

  const inst = wb.addWorksheet('Instruções')
  inst.getColumn(1).width = 110
  const linhas = [
    'Como preencher a aba Vagas',
    '',
    'Uma linha por vaga. Linhas totalmente vazias são ignoradas.',
    'Função é obrigatória. Disciplina, Área, Gestor e Candidato podem ficar vazios.',
    'Datas em DD/MM/AAAA (por exemplo, 22/10/2026).',
    p.organizacao === 'ondas'
      ? 'Onda é obrigatória e precisa ser uma das ondas do projeto, listadas abaixo. A meta da vaga é o fim da onda.'
      : 'Meta é obrigatória: a data em que a vaga precisa estar admitida.',
    'As colunas de etapa recebem a data em que a etapa foi concluída. Vazio quer dizer não concluída.',
    'As etapas são concluídas em ordem: não deixe uma etapa vazia antes de uma preenchida, e as datas não podem voltar no tempo.',
    'Início do processo vazio vale hoje, ou a data da primeira etapa concluída, se for antes.',
    'Não mude os títulos das colunas.',
    '',
    ...(p.organizacao === 'ondas' ? ['Ondas válidas:', ...(p.ondas.length ? p.ondas.map((o) => `  ${o}`) : ['  (nenhuma onda cadastrada)']), ''] : []),
    'Gestores válidos:',
    ...(p.gestores.length ? p.gestores.map((g) => `  ${g}`) : ['  (nenhum gestor cadastrado no cliente)']),
  ]
  for (const l of linhas) inst.addRow([l])
  inst.getRow(1).font = { bold: true, size: 14 }

  return Buffer.from(await wb.xlsx.writeBuffer())
}
