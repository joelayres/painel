import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ehEquipe, exigirSessao } from '@/lib/auth/perfil'
import { ehUuid } from '@/lib/validacao/vaga'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { AbasProjeto } from './AbasProjeto'


export default async function LayoutProjeto({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!ehUuid(id)) notFound()
  const sessao = await exigirSessao()
  const sb = await criarClienteServidor()
  // O RLS só devolve o projeto a quem pode vê-lo.
  const [{ data: projeto }, { data: visiveis }] = await Promise.all([
    sb.from('projetos').select('id, nome, area, clientes(nome)').eq('id', id).maybeSingle(),
    sb.from('projetos').select('id').is('encerrado_em', null),
  ])
  if (!projeto) notFound()
  const equipe = ehEquipe(sessao.perfil)
  const clienteNome = projeto.clientes?.nome
  const subtitulo = [clienteNome, projeto.area].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-5">
      <div>
        {(equipe || (visiveis?.length ?? 0) > 1) && (
          <Link href="/" className="text-sm font-medium text-primaria hover:underline">← Projetos</Link>
        )}
        <h2 className="font-titulo text-2xl font-semibold">{projeto.nome}</h2>
        {subtitulo && <p className="text-texto-suave">{subtitulo}</p>}
      </div>
      <AbasProjeto projetoId={projeto.id} rh={equipe} />
      {children}
    </div>
  )
}
