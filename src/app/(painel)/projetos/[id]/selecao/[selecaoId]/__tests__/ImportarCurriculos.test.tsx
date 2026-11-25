import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

const upload = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/supabase/cliente', () => ({ criarClienteNavegador: () => ({ storage: { from: () => ({ upload }) } }) }))
const acoes = vi.hoisted(() => ({
  registrarCurriculo: vi.fn(async () => ({ ok: true, participacaoId: 'p1' })),
  analisarParticipacao: vi.fn(async () => ({ ok: true, situacao: 'analisada' })),
}))
vi.mock('../../acoesSelecao', () => acoes)

import { ImportarCurriculos } from '../ImportarCurriculos'

beforeEach(() => upload.mockReset())

function pdfDe(tamanho: number, nome = 'grande.pdf') {
  const f = new File(['%PDF'], nome, { type: 'application/pdf' })
  Object.defineProperty(f, 'size', { value: tamanho })
  return f
}

test('recusa na tela o que não é PDF ou passa de 10 MB, sem enviar', async () => {
  render(<ImportarCurriculos selecaoId="s1" pendentes={[]} encerrada={false} />)
  await userEvent.upload(screen.getByLabelText('Importar currículos (PDF)'), [new File(['x'], 'foto.png', { type: 'image/png' }), pdfDe(11 * 1024 * 1024)], { applyAccept: false })
  expect(await screen.findByText(/foto\.png: só arquivos PDF/)).toBeInTheDocument()
  expect(screen.getByText(/grande\.pdf: o arquivo passa de 10 MB/)).toBeInTheDocument()
  expect(upload).not.toHaveBeenCalled()
})

const pendentes = [
  { id: 'a', arquivo: 'joao.pdf', erro: 'IA ocupada, tente de novo em instantes.' },
  { id: 'b', arquivo: 'maria.pdf', erro: null },
]

test('com pendentes, oferece continuar a análise', () => {
  render(<ImportarCurriculos selecaoId="s1" pendentes={pendentes} encerrada={false} />)
  expect(screen.getByRole('button', { name: 'Continuar análise (2)' })).toBeInTheDocument()
})

test('lista cada currículo com erro ou pendente, com o motivo e tentar de novo', async () => {
  render(<ImportarCurriculos selecaoId="s1" pendentes={pendentes} encerrada={false} />)
  expect(screen.getByText('joao.pdf: IA ocupada, tente de novo em instantes.')).toBeInTheDocument()
  expect(screen.getByText('maria.pdf: aguardando análise')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo joao.pdf' }))
  expect(acoes.analisarParticipacao).toHaveBeenCalledWith('a')
})

test('seleção encerrada: mostra os pendentes, sem importar nem analisar', () => {
  render(<ImportarCurriculos selecaoId="s1" pendentes={pendentes} encerrada />)
  expect(screen.getByText('joao.pdf: IA ocupada, tente de novo em instantes.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Importar currículos (PDF)')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Continuar análise|Tentar de novo/ })).not.toBeInTheDocument()
})
