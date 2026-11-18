import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

const push = vi.fn()
let busca = 'onda=o1&ordem=area'
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/projetos/p1/relatorio',
  useSearchParams: () => new URLSearchParams(busca),
}))
const { FiltrosRelatorio } = await import('../FiltrosRelatorio')
const opcoes = { funcoes: ['Assistente Técnico', 'Técnico de Campo'], disciplinas: ['APOIOS', 'NR13'], areas: ['Q1', 'Q3'] }

beforeEach(() => { push.mockReset(); busca = 'onda=o1&ordem=area' })

test('três filtros com as opções e "todas"', () => {
  render(<FiltrosRelatorio opcoes={opcoes} />)
  for (const rotulo of ['Função', 'Disciplina', 'Área']) expect(screen.getByRole('combobox', { name: rotulo })).toHaveValue('')
  expect(screen.getByRole('option', { name: 'Função: todas' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'NR13' })).toBeInTheDocument()
})

test('escolher um valor vai para o endereço, mantendo onda e ordem', async () => {
  render(<FiltrosRelatorio opcoes={opcoes} />)
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Disciplina' }), 'NR13')
  expect(push).toHaveBeenCalledWith('/projetos/p1/relatorio?onda=o1&ordem=area&disciplina=NR13')
})

test('o filtro ativo aparece selecionado e "Limpar filtros" tira só os filtros', async () => {
  busca = 'onda=o1&funcao=T%C3%A9cnico+de+Campo&area=Q1&ordem=area'
  render(<FiltrosRelatorio opcoes={opcoes} />)
  expect(screen.getByRole('combobox', { name: 'Função' })).toHaveValue('Técnico de Campo')
  await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
  expect(push).toHaveBeenCalledWith('/projetos/p1/relatorio?onda=o1&ordem=area')
})

test('sem filtro ativo não há "Limpar filtros"', () => {
  render(<FiltrosRelatorio opcoes={opcoes} />)
  expect(screen.queryByRole('button', { name: 'Limpar filtros' })).toBeNull()
})
