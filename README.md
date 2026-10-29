# Painel de Mobilização

Acompanhamento de projetos de mobilização: cada cliente tem seus projetos, e cada projeto tem vagas que passam por 13 etapas, organizadas em ondas ou com uma meta por vaga. Painel em painel.sudeste-timenow.com.br.

- Perfis:
  - **Administrador**: vê e altera tudo, incluindo cadastros.
  - **Analista de RH**: opera como o Administrador só nos projetos liberados para ele e pode criar projetos.
  - **Gestor Timenow**: só lê os projetos liberados.
  - **Cliente**: só lê os projetos do próprio cliente que foram liberados.
- Os projetos são liberados em Cadastros → Usuários. O usuário Cliente pertence a um cliente e só recebe projetos dele; com um único projeto liberado, cai direto no painel.
- Projeto encerrado não aceita alteração até ser reaberto.
- Etapas por projeto: cada projeto tem a própria lista de etapas, que o RH edita na aba Configurar (incluir, renomear, mover, excluir e ajustar a duração); Captura e Admissão são obrigatórias. No quadro, o RH avança as vagas arrastando o cartão para a etapa.
- Importação: em cada projeto o RH baixa o modelo Excel, preenche as vagas (e as etapas já concluídas) e envia a planilha; o painel mostra a prévia com os erros por linha e só grava se estiver tudo certo.
- O banco guarda só fatos (cadastros e datas reais de conclusão). Previsões e cores são calculadas em `src/dominio` a cada leitura.
- Desenho: `docs/superpowers/specs/2026-10-27-painel-mobilizacao-design.md` e, para os projetos de mobilização, `docs/superpowers/specs/2026-10-28-projetos-de-mobilizacao-design.md`. Plano: `docs/superpowers/plans/2026-10-27-plano-1-painel-mobilizacao.md` e `docs/superpowers/plans/2026-10-28-plano-2-projetos-de-mobilizacao.md`.

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
- Regra: migração que apaga coluna vai em separado, depois do deploy (como a `20261028000006_limpeza_projetos.sql`, que só roda com o código novo já no ar).

## Testes

- `npm test`: testes de unidade e de tela.
- `npm run test:sql`: testa o banco do `.env.local` (o de produção) dentro de uma transação desfeita no fim; as migrações ainda não aplicadas rodam na mesma transação, então dá para testá-las antes do `db:push`. Não há testes que gravem de verdade no banco.

## Primeiro acesso

`npm run criar-rh -- <email> "<nome>"` cria o primeiro usuário do RH. Os demais são cadastrados em Cadastros → Usuários.
