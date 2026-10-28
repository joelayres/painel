import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

vi.mock('../../acoesCadastros', () => ({ salvarUsuario: vi.fn(), liberarAcessoUsuario: vi.fn(), removerAcessoUsuario: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const { CadastroUsuarios } = await import('../Cliente')

const clientes = [{ id: 'c1', nome: 'Braskem' }]
const projetos = [{ id: 'p1', nome: 'Mobilização Braskem 2027', clienteId: 'c1' }]
const usuarios = [
  { id: 'u1', nome: 'Rafaela', email: 'rafa@x.com', perfil: 'rh' as const, clienteId: null, ativo: true, acessos: [] },
  { id: 'u2', nome: 'Gabriel', email: 'gabriel@x.com', perfil: 'gestor' as const, clienteId: null, ativo: true, acessos: ['p1'] },
]

test('a tabela mostra os projetos que o gestor vê e "todos" para o RH', () => {
  render(<CadastroUsuarios usuarios={usuarios} clientes={clientes} projetos={projetos} />)
  expect(screen.getByText('Vê: Mobilização Braskem 2027')).toBeInTheDocument()
  expect(screen.getByText('Vê: todos')).toBeInTheDocument()
})

test('o campo Cliente só aparece quando o perfil é Cliente', async () => {
  render(<CadastroUsuarios usuarios={usuarios} clientes={clientes} projetos={projetos} />)
  await userEvent.click(screen.getByRole('button', { name: 'Novo usuário' }))
  expect(screen.queryByLabelText('Cliente')).not.toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Perfil'), 'Cliente')
  expect(screen.getByLabelText('Cliente')).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Perfil'), 'Gestor Timenow')
  expect(screen.queryByLabelText('Cliente')).not.toBeInTheDocument()
})
