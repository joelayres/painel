import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

const upload = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/supabase/cliente', () => ({ criarClienteNavegador: () => ({ storage: { from: () => ({ upload }) } }) }))
const acoes = vi.hoisted(() => ({ registrarCurriculo: vi.fn(async () => ({ ok: true, participacaoId: 'p1' })) }))
vi.mock('../../acoesSelecao', () => acoes)
const rota = vi.hoisted(() => ({ pedirAnalise: vi.fn(async () => ({ ok: true, situacao: 'analisada' })) }))
vi.mock('../pedirAnalise', () => rota)

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
  expect(rota.pedirAnalise).toHaveBeenCalledWith('a')
})

test('seleção encerrada: mostra os pendentes, sem importar nem analisar', () => {
  render(<ImportarCurriculos selecaoId="s1" pendentes={pendentes} encerrada />)
  expect(screen.getByText('joao.pdf: IA ocupada, tente de novo em instantes.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Importar currículos (PDF)')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Continuar análise|Tentar de novo/ })).not.toBeInTheDocument()
})

test('análise rodando em outra aba: avisa, mostra a fila e não oferece continuar', () => {
  render(<ImportarCurriculos selecaoId="s1" pendentes={pendentes} emAndamento={3} encerrada={false} />)
  expect(screen.getByRole('status')).toHaveTextContent('3 currículos sendo analisados agora')
  expect(screen.getByText('maria.pdf: na fila')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Continuar análise/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Tentar de novo maria.pdf' })).not.toBeInTheDocument()
  // O que deu erro pode ser tentado de novo mesmo com a fila andando.
  expect(screen.getByRole('button', { name: 'Tentar de novo joao.pdf' })).toBeInTheDocument()
})
