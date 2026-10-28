# Painel de Mobilização

Acompanhamento das contratações da Mobilização Braskem 2027: 50 vagas, 13 etapas e 4 ondas, em painel.sudeste-timenow.com.br.

- Todos com login veem todas as vagas. Só o perfil **RH** altera.
- O banco guarda só fatos (cadastros e datas reais de conclusão). Previsões e cores são calculadas em `src/dominio` a cada leitura.
- Desenho: `docs/superpowers/specs/2026-10-27-painel-mobilizacao-design.md`. Plano: `docs/superpowers/plans/2026-10-27-plano-1-painel-mobilizacao.md`.

## Rodar

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do projeto Supabase "painel"
npm run dev
```

Variáveis (`.env.local` e Vercel): `NEXT_PUBLIC_SUPABASE_URL` (sem `/rest/v1/` no fim), `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Só no `.env.local`: `SUPABASE_PROJECT_REF` e `SUPABASE_DB_PASSWORD`, para `npm run db:push` e `npm run db:tipos`.

## Banco

- `npm run db:push` aplica as migrações de `supabase/migrations` e `npm run db:tipos` regenera `src/lib/supabase/tipos.ts`.
- A conexão usa o pooler do Supabase (IPv4); o endereço direto do banco só responde em IPv6.
- **O `.env.local` aponta para o banco de produção.** Mudança que apaga ou renomeia coluna: publique o código primeiro e aplique a migração depois.

## Testes

- `npm test`: testes de unidade e de tela.
- `npm run test:integracao`: roda no banco do `.env.local`, que é o de produção. A trava `tests/integracao/trava.ts` impede a execução quando já existem vagas reais (cuja função não começa com `teste-`). Depois da carga inicial, esses testes só rodam num projeto Supabase de testes.

## Primeiro acesso

`npm run criar-rh -- <email> "<nome>"` cria o primeiro usuário do RH. Os demais são cadastrados em Cadastros → Usuários.
