import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { ETAPAS_PADRAO } from '@/dominio/etapas'
import { hojeSP } from '@/dominio/tempo'
import { vagaExemplo } from '@/test/vagas'

const concluirEtapas = vi.fn()
const refresh = vi.fn()
vi.mock('@/app/(painel)/vagas/[id]/acoesVaga', () => ({ concluirEtapas: (...a: unknown[]) => concluirEtapas(...a) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

import { ConfirmarAvanco } from '../ConfirmarAvanco'

const vaga = vagaExemplo('v1', { cor: 'verde', etapaAtual: 4 })

beforeEach(() => {
  concluirEtapas.mockReset()
  refresh.mockReset()
})

test('lista as etapas e conclui com a data de hoje', async () => {
  concluirEtapas.mockResolvedValue({ ok: true })
  const aoFechar = vi.fn()
  render(<ConfirmarAvanco vaga={vaga} de={4} ate={5} etapas={ETAPAS_PADRAO} aoFechar={aoFechar} />)
  const dialogo = screen.getByRole('dialog')
  expect(dialogo).toHaveAttribute('aria-modal', 'true')
  expect(dialogo).toHaveTextContent('Concluir 2 etapas: Entrevista - Timenow e Entrevista - TNGO/Braskem')
  await userEvent.click(screen.getByRole('button', { name: 'Concluir' }))
  await waitFor(() => expect(concluirEtapas).toHaveBeenCalledWith('v1', 4, 5, hojeSP()))
  await waitFor(() => expect(refresh).toHaveBeenCalled())
})

test('uma só etapa no singular', () => {
  render(<ConfirmarAvanco vaga={vaga} de={4} ate={4} etapas={ETAPAS_PADRAO} aoFechar={() => {}} />)
  expect(screen.getByRole('dialog')).toHaveTextContent('Concluir Entrevista - Timenow')
})

test('mostra o erro em alerta', async () => {
  concluirEtapas.mockResolvedValue({ ok: false, erro: 'Esta vaga mudou enquanto você olhava. Atualize a página.' })
  render(<ConfirmarAvanco vaga={vaga} de={4} ate={5} etapas={ETAPAS_PADRAO} aoFechar={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: 'Concluir' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Esta vaga mudou enquanto você olhava. Atualize a página.')
  expect(refresh).not.toHaveBeenCalled()
})

test('Esc e Cancelar fecham', async () => {
  const aoFechar = vi.fn()
  render(<ConfirmarAvanco vaga={vaga} de={4} ate={5} etapas={ETAPAS_PADRAO} aoFechar={aoFechar} />)
  await userEvent.keyboard('{Escape}')
  expect(aoFechar).toHaveBeenCalledTimes(1)
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(aoFechar).toHaveBeenCalledTimes(2)
})
