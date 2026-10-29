import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../acoes', () => ({ enviarCodigo: vi.fn(), verificarCodigo: vi.fn() }))

const { FormularioEntrada } = await import('../FormularioEntrada')

test('aviso de entrada recusada pelo portal', () => {
  render(<FormularioEntrada aviso="portal" />)
  expect(screen.getByText('Seu acesso pelo portal não foi aceito. Entre com o código ou fale com o administrador.')).toBeTruthy()
})

test('aviso de acesso inativo continua igual', () => {
  render(<FormularioEntrada aviso="sem-acesso" />)
  expect(screen.getByText('Seu acesso não está ativo. Fale com o Administrador.')).toBeTruthy()
})
