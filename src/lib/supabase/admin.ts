import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './tipos'

// Ignora RLS. Usar só no servidor, depois de conferir quem age (sessão e perfil, ou o token do link).
export function criarClienteAdmin() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
