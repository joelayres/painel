import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { gravarCarga } from '@/lib/carga/gravar'
import { cadastrarUsuario } from '@/lib/cadastros/usuarios'
import { apagarDoTeste, clienteAdmin, garantirOnda, prefixo } from './apoio'

const admin = clienteAdmin()
let ondaId: string

beforeAll(async () => {
  ondaId = await garantirOnda(admin, 1)
})
afterAll(async () => {
  await apagarDoTeste(admin)
})

describe('cadastro de usuários', () => {
  it('cadastrar um visualizador cria o login e ele lê as vagas', async () => {
    const email = `${prefixo}-novo@exemplo.test`
    const r = await cadastrarUsuario(admin, { nome: `${prefixo} Cliente`, email, perfil: 'visualizador' })
    expect(r).toEqual({ ok: true })
    const { data } = await admin.from('usuarios').select('usuario_id, perfil').eq('email', email).single()
    expect(data?.perfil).toBe('visualizador')
    expect(data?.usuario_id).toBeTruthy()
    // O login existe (entrarComo usa senha só nos testes; aqui basta o usuário no Auth).
    const { data: u } = await admin.auth.admin.getUserById(data!.usuario_id!)
    expect(u.user?.email).toBe(email)
  })

  it('e-mail repetido é recusado', async () => {
    const email = `${prefixo}-repetido@exemplo.test`
    await cadastrarUsuario(admin, { nome: `${prefixo} A`, email, perfil: 'visualizador' })
    const r = await cadastrarUsuario(admin, { nome: `${prefixo} B`, email, perfil: 'rh' })
    expect(r).toEqual({ ok: false, erros: { email: 'E-mail já cadastrado.' } })
  })
})

describe('carga inicial', () => {
  const vaga = (funcao: string) => ({ linha: 2, funcao, disciplina: 'NR-13', area: 'Caldeiraria', onda: 1, candidato: 'Lucas', dataInicio: '2026-10-22', concluidas: [{ ordem: 1, concluidaEm: '2026-10-22' }] })

  it('grava vagas e conclusões quando não há vagas', async () => {
    const { count } = await admin.from('vagas').select('id', { count: 'exact', head: true })
    if (count) return // banco já tem vagas de outro teste: a recusa é testada abaixo
    const r = await gravarCarga(admin, [vaga(`${prefixo} Carga`)], `${prefixo} RH`)
    expect(r).toEqual({ ok: true, vagas: 1 })
    const { data } = await admin.from('vagas').select('id, candidato, vaga_conclusoes(ordem)').eq('funcao', `${prefixo} Carga`).single()
    expect(data?.candidato).toBe('Lucas')
    expect(data?.vaga_conclusoes).toEqual([{ ordem: 1 }])
  })

  it('recusa a carga quando já existem vagas', async () => {
    await admin.from('vagas').insert({ funcao: `${prefixo} Existente`, disciplina: 'x', area: 'x', onda_id: ondaId, data_inicio: '2026-10-22' })
    const r = await gravarCarga(admin, [vaga(`${prefixo} Outra`)], `${prefixo} RH`)
    expect(r).toEqual({ ok: false, erro: 'A carga só pode ser feita com o painel vazio. Já existem vagas cadastradas.' })
  })

  it('recusa a carga quando falta cadastrar a onda (confere antes das vagas)', async () => {
    const { data: onda4 } = await admin.from('ondas').select('id').eq('numero', 4).maybeSingle()
    if (onda4) return // a 4ª onda já está cadastrada neste banco
    const r = await gravarCarga(admin, [{ ...vaga(`${prefixo} Sem onda`), onda: 4 }], `${prefixo} RH`)
    expect(r).toEqual({ ok: false, erro: 'Cadastre a 4ª Onda antes de fazer a carga.' })
  })
})
