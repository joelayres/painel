import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

const previaImportacao = vi.fn()
const importarVagas = vi.fn()
const push = vi.fn()
vi.mock('../acoes', () => ({ previaImportacao, importarVagas }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))
const { ImportarVagas } = await import('../Cliente')

const nomes = { ondas: [{ id: 'o1', nome: '1ª Onda' }], gestores: [{ id: 'g1', nome: 'Ana Lima' }] }
const vaga = { linha: 2, funcao: 'Eletricista', disciplina: 'NR-10', area: 'Manutenção', gestorId: 'g1', ondaId: 'o1', meta: '2026-12-18', dataInicio: '2026-10-20', candidato: null, concluidas: [], aviso: 'Pelas etapas, a admissão sai em 19/11 e a meta é 18/11.', repetida: true }

beforeEach(() => vi.clearAllMocks())

test('prévia sem erros mostra as vagas, os avisos e o botão de importar', async () => {
  previaImportacao.mockResolvedValue({ ok: true, vagas: [vaga, { ...vaga, linha: 3, aviso: null, repetida: false }] })
  importarVagas.mockResolvedValue({ ok: true, vagas: 2 })
  render(<ImportarVagas projetoId="p1" organizacao="ondas" nomes={nomes} />)
  await userEvent.click(screen.getByRole('button', { name: 'Ver prévia' }))
  expect(await screen.findByText('2 vagas lidas')).toBeInTheDocument()
  expect(screen.getByText(/a admissão sai em 19\/11/)).toBeInTheDocument()
  expect(screen.getByText(/Já existe uma vaga igual/)).toBeInTheDocument()
  expect(screen.getAllByText('1ª Onda')).toHaveLength(2)
  await userEvent.click(screen.getByRole('button', { name: 'Importar 2 vagas' }))
  expect(importarVagas).toHaveBeenCalledWith('p1', expect.any(FormData))
  expect(push).toHaveBeenCalledWith('/projetos/p1/configurar?importadas=2')
})

test('prévia com erros mostra as linhas e não oferece importar', async () => {
  previaImportacao.mockResolvedValue({ ok: false, erros: [{ linha: 4, mensagem: 'Informe a função.' }] })
  render(<ImportarVagas projetoId="p1" organizacao="ondas" nomes={nomes} />)
  await userEvent.click(screen.getByRole('button', { name: 'Ver prévia' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Linha 4: Informe a função.')
  expect(screen.queryByRole('button', { name: /Importar/ })).not.toBeInTheDocument()
})

test('falha ao importar aparece na tela', async () => {
  previaImportacao.mockResolvedValue({ ok: true, vagas: [vaga] })
  importarVagas.mockResolvedValue({ ok: false, erro: 'A planilha tem erros. Corrija e envie de novo.' })
  render(<ImportarVagas projetoId="p1" organizacao="ondas" nomes={nomes} />)
  await userEvent.click(screen.getByRole('button', { name: 'Ver prévia' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Importar 1 vagas' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('A planilha tem erros. Corrija e envie de novo.')
  expect(push).not.toHaveBeenCalled()
})
