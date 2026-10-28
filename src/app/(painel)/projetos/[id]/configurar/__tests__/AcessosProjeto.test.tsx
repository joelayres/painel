import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

const liberar = vi.fn()
const remover = vi.fn()
vi.mock('../acoesConfigurar', () => ({ liberar, remover }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const { AcessosProjeto } = await import('../AcessosProjeto')

const pessoas = [
  { id: 'u1', nome: 'Ana', perfil: 'gestor' as const },
  { id: 'u2', nome: 'Bia', perfil: 'cliente' as const },
]
const liberaveis = [{ id: 'u3', nome: 'Caio', perfil: 'gestor' as const }]

test('lista quem vê o projeto com o rótulo do perfil e remove', async () => {
  remover.mockResolvedValue({ ok: true })
  render(<AcessosProjeto projetoId="p1" cliente="Acme" pessoas={pessoas} liberaveis={liberaveis} />)
  expect(screen.getByText('Gestor Timenow')).toBeInTheDocument()
  expect(screen.getByText('Cliente')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'remover Bia' }))
  expect(remover).toHaveBeenCalledWith('p1', 'u2')
})

test('o seletor só oferece os liberáveis recebidos e libera o escolhido', async () => {
  liberar.mockResolvedValue({ ok: true })
  render(<AcessosProjeto projetoId="p1" cliente="Acme" pessoas={pessoas} liberaveis={liberaveis} />)
  const sel = screen.getByLabelText('Pessoa')
  expect(Array.from((sel as HTMLSelectElement).options).map((o) => o.textContent)).toEqual(['Escolha a pessoa', 'Caio (Gestor Timenow)'])
  expect(screen.getByText('Só aparecem os Gestores Timenow e as pessoas do cliente Acme.')).toBeInTheDocument()
  await userEvent.selectOptions(sel, 'u3')
  await userEvent.click(screen.getByRole('button', { name: 'Liberar' }))
  expect(liberar).toHaveBeenCalledWith('p1', 'u3')
})

test('falha ao liberar aparece na tela', async () => {
  liberar.mockResolvedValue({ ok: false, erro: 'Esta pessoa é de outro cliente e não pode ver este projeto.' })
  render(<AcessosProjeto projetoId="p1" cliente="Acme" pessoas={[]} liberaveis={liberaveis} />)
  await userEvent.selectOptions(screen.getByLabelText('Pessoa'), 'u3')
  await userEvent.click(screen.getByRole('button', { name: 'Liberar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('outro cliente')
})
