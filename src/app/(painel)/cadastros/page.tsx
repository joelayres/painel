import Link from 'next/link'
import { exigirRh } from '@/lib/auth/perfil'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { RegistroGeral } from './RegistroGeral'

const ITENS = [
  { href: '/cadastros/clientes', titulo: 'Clientes', texto: 'Durações das etapas e gestores de cada cliente.' },
  { href: '/cadastros/usuarios', titulo: 'Usuários', texto: 'Quem pode entrar no painel e o que vê.' },
  { href: '/cadastros/feriados', titulo: 'Feriados', texto: 'Dias que não contam como úteis.' },
]

export default async function Cadastros() {
  await exigirRh()
  // Mudanças gerais (feriados, clientes) ficam no histórico sem vaga.
  const { data: registro } = await (await criarClienteServidor())
    .from('historico').select('id, acao, nome_usuario, em, detalhe').is('vaga_id', null).order('em', { ascending: false }).limit(50)
  return (
    <div className="flex flex-col gap-5">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ITENS.map((i) => (
        <Link key={i.href} href={i.href} className="rounded-xl border border-borda bg-superficie p-4 hover:border-primaria focus-visible:outline-2 focus-visible:outline-foco">
          <span className="font-titulo text-xl font-semibold">{i.titulo}</span>
          <span className="mt-1 block text-texto-suave">{i.texto}</span>
        </Link>
      ))}
    </div>
    <RegistroGeral itens={(registro ?? []).map((r) => ({ id: r.id, acao: r.acao, nome: r.nome_usuario, em: r.em, detalhe: r.detalhe }))} />
    </div>
  )
}
