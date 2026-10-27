import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

const concluirEtapa = vi.fn()
const desfazerEtapa = vi.fn()
const candidatoDesistiu = vi.fn()
vi.mock('../acoesVaga', () => ({ concluirEtapa, desfazerEtapa, candidatoDesistiu }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const { Acoes } = await import('../Acoes')

const base = { vagaId: 'v1', etapaAtual: { ordem: 3, nome: 'Triagem de Candidatos' }, ultimaConcluida: 2, hoje: '2026-10-27' }

beforeEach(() => {
  vi.clearAllMocks()
  concluirEtapa.mockResolvedValue({ ok: true })
  desfazerEtapa.mockResolvedValue({ ok: true })
  candidatoDesistiu.mockResolvedValue({ ok: true })
})

test('visualizador não vê as ações', () => {
  const { container } = render(<Acoes {...base} perfil="visualizador" />)
  expect(container).toBeEmptyDOMElement()
  expect(screen.queryByRole('button', { name: /Concluir/ })).toBeNull()
})

test('RH conclui a etapa atual com a data de hoje em um clique', async () => {
  render(<Acoes {...base} perfil="rh" />)
  await userEvent.click(screen.getByRole('button', { name: 'Concluir Triagem de Candidatos' }))
  expect(concluirEtapa).toHaveBeenCalledWith('v1', 3, '2026-10-27')
})

test('mostra o erro devolvido pela ação', async () => {
  concluirEtapa.mockResolvedValue({ ok: false, erro: 'Esta vaga mudou enquanto você olhava. Atualize a página.' })
  render(<Acoes {...base} perfil="rh" />)
  await userEvent.click(screen.getByRole('button', { name: 'Concluir Triagem de Candidatos' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Esta vaga mudou enquanto você olhava.')
})

test('desfazer usa a última etapa concluída', async () => {
  render(<Acoes {...base} perfil="rh" />)
  await userEvent.click(screen.getByRole('button', { name: 'Desfazer último avanço' }))
  expect(desfazerEtapa).toHaveBeenCalledWith('v1', 2)
})

test('candidato desistiu pede confirmação antes de chamar', async () => {
  render(<Acoes {...base} perfil="rh" />)
  await userEvent.click(screen.getByRole('button', { name: 'Candidato desistiu' }))
  expect(candidatoDesistiu).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar desistência' }))
  expect(candidatoDesistiu).toHaveBeenCalledWith('v1')
})
