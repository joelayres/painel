import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLICAS = ['/entrar', '/icon', '/apple-icon']

// Renova a sessão do Supabase e manda quem não entrou para /entrar.
// O perfil (rh, gestor ou cliente) é conferido nas páginas e ações (exigirSessao, exigirRh).
export async function middleware(request: NextRequest) {
  let resposta = NextResponse.next({ request })
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value))
        resposta = NextResponse.next({ request })
        lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options))
      },
    },
  })
  const { data: { user } } = await supabase.auth.getUser()

  const caminho = request.nextUrl.pathname
  if (!user && !PUBLICAS.some((p) => caminho.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/entrar'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return resposta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|marca/|manifest|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
}
