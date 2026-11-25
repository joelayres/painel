import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

const upload = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/supabase/cliente', () => ({ criarClienteNavegador: () => ({ storage: { from: () => ({ upload }) } }) }))
vi.mock('../../acoesSelecao', () => ({
  registrarCurriculo: vi.fn(async () => ({ ok: true, participacaoId: 'p1' })),
  analisarParticipacao: vi.fn(async () => ({ ok: true, situacao: 'analisada' })),
}))

import { ImportarCurriculos } from '../ImportarCurriculos'

beforeEach(() => upload.mockReset())

function pdfDe(tamanho: number, nome = 'grande.pdf') {
  const f = new File(['%PDF'], nome, { type: 'application/pdf' })
  Object.defineProperty(f, 'size', { value: tamanho })
  return f
}

test('recusa na tela o que não é PDF ou passa de 10 MB, sem enviar', async () => {
  render(<ImportarCurriculos selecaoId="s1" pendentes={[]} />)
  await userEvent.upload(screen.getByLabelText('Importar currículos (PDF)'), [new File(['x'], 'foto.png', { type: 'image/png' }), pdfDe(11 * 1024 * 1024)], { applyAccept: false })
  expect(await screen.findByText(/foto\.png: só arquivos PDF/)).toBeInTheDocument()
  expect(screen.getByText(/grande\.pdf: o arquivo passa de 10 MB/)).toBeInTheDocument()
  expect(upload).not.toHaveBeenCalled()
})

test('com pendentes, oferece continuar a análise', () => {
  render(<ImportarCurriculos selecaoId="s1" pendentes={['a', 'b']} />)
  expect(screen.getByRole('button', { name: 'Continuar análise (2)' })).toBeInTheDocument()
})
