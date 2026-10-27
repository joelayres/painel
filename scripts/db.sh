#!/bin/sh
# Aplica migrations ou gera tipos usando as credenciais de .env.local.
# Usa o pooler (IPv4): o endereço direto db.<ref>.supabase.co de projetos novos só responde em IPv6.
set -e
set -a; . ./.env.local; set +a
SENHA=$(node -e 'console.log(encodeURIComponent(process.env.SUPABASE_DB_PASSWORD))')
URL="postgresql://postgres.${SUPABASE_PROJECT_REF}:${SENHA}@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
case "$1" in
  push) npx supabase db push --db-url "$URL" ;;
  tipos) npx supabase gen types typescript --db-url "$URL" --schema public > src/lib/supabase/tipos.ts ;;
  *) echo "uso: sh scripts/db.sh push|tipos"; exit 1 ;;
esac
