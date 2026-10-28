// Cria o primeiro usuário do RH: npm run criar-rh -- <email> "<nome>"
import { createClient } from '@supabase/supabase-js'

const [email, nome] = process.argv.slice(2)
if (!email || !nome) {
  console.error('uso: npm run criar-rh -- <email> "<nome>"')
  process.exit(1)
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})
const emailNormalizado = email.trim().toLowerCase()

const { data, error } = await admin.auth.admin.createUser({ email: emailNormalizado, email_confirm: true })
if (error) throw error
const { error: e1 } = await admin.from('usuarios').insert({ usuario_id: data.user.id, nome, email: emailNormalizado, perfil: 'rh' })
if (e1) {
  await admin.auth.admin.deleteUser(data.user.id)
  throw e1
}
console.log(`RH criado: ${nome} <${emailNormalizado}>`)
