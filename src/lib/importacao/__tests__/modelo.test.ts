// @vitest-environment node
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { ETAPAS_PADRAO } from '@/dominio/etapas'
import { COLUNAS_FIXAS, gerarModelo } from '../modelo'

async function abrir(buf: Buffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  return wb
}

const cabecalho = (ws: ExcelJS.Worksheet) => (ws.getRow(1).values as unknown[]).slice(1).map(String)

describe('modelo Excel do projeto', () => {
  it('projeto meta tem a coluna Meta, não Onda, e 13 colunas de etapa depois de Candidato', async () => {
    const wb = await abrir(await gerarModelo({ organizacao: 'meta', ondas: [], gestores: ['Ana'], etapas: ETAPAS_PADRAO }))
    const cab = cabecalho(wb.getWorksheet('Vagas')!)
    expect(cab).toContain('Meta')
    expect(cab).not.toContain('Onda')
    expect(cab.slice(0, 7)).toEqual(['Função', 'Disciplina', 'Área', 'Gestor', 'Meta', 'Início do processo', 'Candidato'])
    expect(cab.slice(cab.indexOf('Candidato') + 1)).toEqual(ETAPAS_PADRAO.map((e) => e.nome))
    expect(wb.getWorksheet('Vagas')!.rowCount).toBe(1)
  })

  it('projeto por ondas tem a coluna Onda e as instruções listam ondas e gestores', async () => {
    const wb = await abrir(await gerarModelo({ organizacao: 'ondas', ondas: ['1ª Onda', '2ª Onda'], gestores: ['Ana Lima'], etapas: ETAPAS_PADRAO }))
    const cab = cabecalho(wb.getWorksheet('Vagas')!)
    expect(cab[4]).toBe('Onda')
    expect(cab).not.toContain('Meta')
    expect(COLUNAS_FIXAS).toHaveLength(7)
    const textos: string[] = []
    wb.getWorksheet('Instruções')!.eachRow((r) => textos.push((r.values as unknown[]).slice(1).join(' ')))
    const tudo = textos.join('\n')
    expect(tudo).toContain('DD/MM/AAAA')
    expect(tudo).toContain('1ª Onda')
    expect(tudo).toContain('Ana Lima')
  })
})
