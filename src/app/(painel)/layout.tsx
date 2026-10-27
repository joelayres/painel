import { CascaApp } from '@/components/layout/CascaApp'
import { exigirSessao } from '@/lib/auth/perfil'

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao()
  const navegacao = sessao.perfil === 'rh' ? [{ href: '/', rotulo: 'Painel' }, { href: '/cadastros', rotulo: 'Cadastros' }] : []
  return (
    <CascaApp titulo="Painel" usuario={sessao} navegacao={navegacao}>
      {children}
    </CascaApp>
  )
}
