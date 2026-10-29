import { CascaApp } from '@/components/layout/CascaApp'
import { exigirSessao } from '@/lib/auth/perfil'

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao()
  const navegacao = sessao.perfil === 'rh'
    ? [{ href: '/', rotulo: 'Projetos' }, { href: '/cadastros', rotulo: 'Cadastros' }]
    : sessao.perfil === 'analista' ? [{ href: '/', rotulo: 'Projetos' }] : []
  return (
    <CascaApp titulo="Painel" usuario={sessao} navegacao={navegacao}>
      {children}
    </CascaApp>
  )
}
