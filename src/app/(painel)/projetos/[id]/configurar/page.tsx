import { notFound } from 'next/navigation'
import { etapasDoProjeto } from '@/dominio/etapas'
import { hojeSP } from '@/dominio/tempo'
import { exigirRh } from '@/lib/auth/perfil'
import { usuariosLiberaveis } from '@/lib/cadastros/acessos'
import { carregarPainel } from '@/lib/painel/dados'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { ehUuid } from '@/lib/validacao/vaga'
import { AcessosProjeto } from './AcessosProjeto'
import { DadosProjeto } from './DadosProjeto'
import { DuracoesProjeto } from './DuracoesProjeto'
import { EncerrarProjeto } from './EncerrarProjeto'
import { OndasProjeto } from './OndasProjeto'
import { VagasProjeto } from './VagasProjeto'

export const metadata = { title: 'Configurar · Painel de Mobilização' }

type PerfilUsuario = 'rh' | 'gestor' | 'cliente'

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-titulo text-xl font-semibold">{titulo}</h3>
      {children}
    </section>
  )
}

export default async function Configurar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!ehUuid(id)) notFound()
  await exigirRh()
  const sb = await criarClienteServidor()
  const painel = await carregarPainel(sb, hojeSP(), id)
  if (!painel) notFound()
  const { projeto, ondas, gestores } = painel

  const [vagas, base, duracoesCliente, duracoesProjeto, usuarios, acessos] = await Promise.all([
    sb.from('vagas').select('id, funcao, disciplina, area, onda_id, meta, gestor_id, candidato, data_inicio, cancelada_em').eq('projeto_id', id).order('criado_em'),
    sb.from('etapas').select('ordem, nome, duracao').order('ordem'),
    sb.from('cliente_duracoes').select('ordem, duracao').eq('cliente_id', projeto.cliente.id),
    sb.from('projeto_duracoes').select('ordem, duracao').eq('projeto_id', id),
    sb.from('usuarios').select('id, nome, perfil, cliente_id, ativo').order('nome'),
    sb.from('projeto_acessos').select('usuario_id').eq('projeto_id', id),
  ])
  for (const r of [vagas, base, duracoesCliente, duracoesProjeto, usuarios, acessos]) {
    if (r.error) throw new Error(`Não foi possível ler a configuração do projeto: ${r.error.message}`)
  }

  const somenteLeitura = projeto.encerrado
  const porOndas = projeto.organizacao === 'ondas'
  const nomeOnda = new Map(ondas.map((o) => [o.id, o.nome]))
  const nomeGestor = new Map(gestores.map((g) => [g.id, g.nome]))
  const linhasVaga = (vagas.data ?? []).map((v) => ({
    id: v.id, funcao: v.funcao, disciplina: v.disciplina, area: v.area,
    ondaNome: v.onda_id ? (nomeOnda.get(v.onda_id) ?? null) : null, ondaId: v.onda_id, meta: v.meta,
    gestor: v.gestor_id ? (nomeGestor.get(v.gestor_id) ?? null) : null, gestorId: v.gestor_id,
    candidato: v.candidato, dataInicio: v.data_inicio, canceladaEm: v.cancelada_em,
  }))

  const doCliente = new Map((duracoesCliente.data ?? []).map((d) => [d.ordem, d.duracao]))
  const doProjeto = new Map((duracoesProjeto.data ?? []).map((d) => [d.ordem, d.duracao]))
  const padraoCliente = etapasDoProjeto(base.data ?? [], doCliente, new Map())
  const etapas = padraoCliente.map((e) => ({ ordem: e.ordem, nome: e.nome, padrao: e.duracao, ajuste: doProjeto.get(e.ordem) ?? null }))

  const todos = (usuarios.data ?? []).map((u) => ({ id: u.id, nome: u.nome, perfil: u.perfil as PerfilUsuario, clienteId: u.cliente_id, ativo: u.ativo }))
  const comAcesso = new Set((acessos.data ?? []).map((a) => a.usuario_id))
  const pessoas = todos.filter((u) => comAcesso.has(u.id))
  const liberaveis = usuariosLiberaveis(todos, projeto.cliente.id).filter((u) => !comAcesso.has(u.id))

  return (
    <div className="flex flex-col gap-8">
      {somenteLeitura && (
        <p role="status" className="rounded-lg px-3 py-2 font-medium" style={{ background: 'var(--st-reprovada-fundo)', color: 'var(--st-reprovada-texto)' }}>Projeto encerrado. Reabra para alterar.</p>
      )}
      <Bloco titulo="Dados">
        <DadosProjeto projeto={{ id: projeto.id, clienteId: projeto.cliente.id, clienteNome: projeto.cliente.nome, nome: projeto.nome, area: projeto.area, organizacao: projeto.organizacao }} />
      </Bloco>
      {porOndas && (
        <Bloco titulo="Ondas">
          <OndasProjeto projetoId={id} ondas={ondas} somenteLeitura={somenteLeitura} />
        </Bloco>
      )}
      <Bloco titulo="Duração das etapas">
        <DuracoesProjeto projetoId={id} cliente={projeto.cliente.nome} etapas={etapas} somenteLeitura={somenteLeitura} />
      </Bloco>
      <Bloco titulo="Vagas">
        <VagasProjeto projetoId={id} organizacao={projeto.organizacao} vagas={linhasVaga} opcoes={{ ondas: ondas.map((o) => ({ id: o.id, nome: o.nome })), gestores }} somenteLeitura={somenteLeitura} />
      </Bloco>
      <Bloco titulo="Quem vê este projeto">
        <AcessosProjeto projetoId={id} cliente={projeto.cliente.nome} pessoas={pessoas} liberaveis={liberaveis} />
      </Bloco>
      <EncerrarProjeto projetoId={id} encerrado={projeto.encerrado} />
    </div>
  )
}
