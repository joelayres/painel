# Plano 2: Projetos de mobilização

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o painel de uma mobilização só em um sistema de projetos de mobilização (Cliente → Projeto → vagas), com acesso liberado por projeto, durações por cliente e por projeto, metas por vaga, uma tela de Resumo por etapa e função, e importação por modelo Excel.

**Architecture:** O desenho de hoje continua: o banco guarda só fatos, `src/dominio` calcula previsões e cores a cada leitura, e as escritas do RH passam por funções SQL que conferem o perfil e gravam o histórico. A segurança por projeto fica no RLS, com uma função `pode_ver_projeto(id)`. O banco de produção já tem a Braskem 2027 (50 vagas, 4 ondas, 1 usuário RH). Por isso a mudança vai em duas migrações: a **005**, aditiva e compatível com o código no ar, que cria as tabelas novas e migra os dados, e a **006**, de limpeza, aplicada só depois de o código novo estar publicado.

**Tech Stack:** Next.js 15.5 (App Router), React 19.1, TypeScript, Tailwind 4, Supabase (Postgres, Auth, RLS), zod 4, exceljs, Vitest com Testing Library, `pg` nos testes de SQL.

**Spec:** `docs/superpowers/specs/2026-10-28-projetos-de-mobilizacao-design.md` (evolui `docs/superpowers/specs/2026-10-27-painel-mobilizacao-design.md`, cujas regras de cálculo continuam valendo).

## Global Constraints

- Código, textos, nomes e comentários em pt-BR, no estilo do código atual. Sem travessão como pontuação nos textos de tela.
- **O `.env.local` aponta para o banco de produção.** Os testes de banco rodam só em `tests/sql`, dentro de transação desfeita (`emTransacao`), e `aplicarPendentes` aplica as migrações novas dentro da transação. `npm run db:push` em produção só com o OK do Joel, na ordem da Task 11.
- A migração 005 não pode apagar nem renomear nada que o código publicado use (`ondas.numero`, `etapas.duracao`, `salvar_onda(uuid, smallint, date, date)`, `alterar_duracao`, `importar_carga`). Apagar é só na 006.
- Perfis: `rh`, `gestor`, `cliente`. O RH lê e escreve tudo. O gestor e o cliente só leem, e só os projetos de `projeto_acessos`.
- Um usuário `cliente` tem `cliente_id` obrigatório e só pode receber acesso a projetos desse cliente. Isso é regra **do banco**, não só da tela.
- A meta da vaga é o fim da onda (projeto `ondas`) ou `vagas.meta` (projeto `meta`). As cores são as de hoje, com "fim da onda" trocado por "meta": vermelho = hoje > fim previsto da etapa atual; amarelo = não vermelho, não admitida, e admissão estimada > meta; verde = o resto.
- Duração efetiva de uma etapa num projeto = o ajuste do projeto, se houver; senão, a do cliente. `etapas.duracao` passa a ser só o padrão copiado para um cliente novo.
- Projeto encerrado: o banco recusa qualquer escrita nas vagas, ondas, conclusões e durações dele, com `'projeto encerrado'`.
- O histórico mostra o **nome** de quem alterou, nunca o e-mail. O registro geral (`historico.vaga_id is null`) só o RH lê.
- As 13 etapas, os nomes e a ordem não mudam.

## Review Focus

1. **Pessoa de cliente abrindo o endereço de um projeto ou de uma vaga que não foi liberado para ela** (link repassado, por exemplo): "não encontrado", sem mostrar que existe. → teste de RLS na Task 2 e teste de `carregarPainel` devolvendo `null` na Task 3.
2. **O RH liberando, por engano, um projeto da Braskem para um usuário cliente de outro cliente** (ou trocando o cliente desse usuário depois): o banco recusa a liberação, e a troca remove os acessos que deixariam de valer. → testes na Task 2.
3. **O RH muda a duração de "Liberação dos exames" no cliente quando um projeto já tinha ajustado essa etapa:** o projeto ajustado não muda, e os outros projetos do cliente mudam. → testes nas Tasks 1 e 2.
4. **Planilha do modelo com a mesma função escrita de jeitos diferentes ("Eletricista", "eletricista ") e com "Início do processo" vazio numa linha que já traz etapas concluídas:** o Resumo conta as duas juntas, e o início vira a data mais antiga entre hoje e a primeira conclusão, sem a importação falhar. → testes nas Tasks 1 e 10.
5. **RH tentando concluir uma etapa numa vaga de projeto encerrado** (aba antiga aberta): a ação é recusada com uma mensagem clara. → teste na Task 2 e mapeamento da mensagem na Task 6.

---

### Task 1: Domínio: durações por projeto, meta da vaga e resumos

**Files:**
- Modify: `src/dominio/etapas.ts`, `src/dominio/situacao.ts`, `src/dominio/painel.ts`
- Test: `src/dominio/__tests__/etapas.test.ts` (novo), `src/dominio/__tests__/situacao.test.ts`, `src/dominio/__tests__/painel.test.ts`, `src/test/vagas.ts` (fábrica de vagas de teste)

**Interfaces:**
- Produces:
  - `etapas.ts`: `etapasDoProjeto(base: EtapaDef[], doCliente: ReadonlyMap<number, number>, doProjeto: ReadonlyMap<number, number>): EtapaDef[]` (ordem e nome de `base`; duração = projeto ?? cliente ?? base).
  - `situacao.ts`:
    - `situacaoVaga(prev: PrevisaoVaga, meta: string, hoje: string, f: Feriados): Situacao` (mesma regra, com o parâmetro renomeado de `fimOnda` para `meta`);
    - `avisoMeta(prev: PrevisaoVaga, meta: string): string | null`, que devolve `"Pelas etapas, a admissão sai em {dd/mm} e a meta é {dd/mm}."` quando `prev.admissaoEstimada > meta` e a vaga não foi admitida, ou `null` no resto (usa `ddmm` de `@/lib/formato/datas`).
  - `painel.ts`:
    - `type OndaVaga = { id: string; nome: string; inicio: string; fim: string }` (sai o `numero`);
    - `VagaPainel` ganha `projetoId: string` e `meta: string`, e `onda` passa a ser `OndaVaga | null`;
    - `type Filtro = { onda?: string /* id */; funcao?: string; area?: string; gestorId?: string; candidato?: string }`. Função comparada por `chaveFuncao`;
    - `chaveFuncao(t: string): string` (sem acento, minúsculas, espaços repetidos viram um, sem espaços nas pontas);
    - `type ResumoGrupo = { id: string; nome: string; inicio: string | null; fim: string | null; total: number; admitidas: number; mobilizadas: number; verde: number; amarelo: number; vermelho: number; proximaMeta: string | null }`. Substitui `ResumoOnda`;
    - `resumirOndas(vagas: VagaPainel[], cadastradas: OndaVaga[]): ResumoGrupo[]` (todas as cadastradas aparecem, ordenadas por `inicio` e depois `nome`);
    - `resumirProjeto(vagas: VagaPainel[]): ResumoGrupo` (`id: 'projeto'`, `nome: ''`, `inicio/fim: null`). `proximaMeta` é a menor `meta` entre as vagas não admitidas, ou `null`;
    - `type LinhaResumo = { funcao: string; total: number; vermelho: number; amarelo: number }`;
    - `type CartaoEtapa = { ordem: number | null /* null = Mobilizadas */; nome: string; total: number; funcoes: LinhaResumo[] }`;
    - `resumoPorEtapa(vagas: VagaPainel[], etapas: EtapaDef[]): CartaoEtapa[]`: as 13 etapas na ordem, mais o cartão `{ ordem: null, nome: 'Mobilizadas' }`, sempre 14 cartões. Agrupa por `chaveFuncao`. O rótulo é a primeira grafia encontrada na ordem de `vagas`. As funções vêm ordenadas por `total` decrescente e depois pelo nome (`localeCompare` pt-BR). No cartão de Mobilizadas, `vermelho` e `amarelo` ficam em 0.
    - `vagasEmAtencao` e `porEtapa` ficam como estão.

- [ ] **Step 1: Testes que falham:**
  - `etapasDoProjeto(ETAPAS_PADRAO, new Map([[9, 5]]), new Map([[9, 3], [8, 2]]))` dá a etapa 9 com 3, a 8 com 2 e a 2 com 4 (padrão) (Review Focus 3).
  - `etapasDoProjeto(ETAPAS_PADRAO, new Map([[9, 5]]), new Map())` dá a etapa 9 com 5.
  - `situacaoVaga` com meta `'2026-11-18'` e a admissão estimada em 19/11 dá `amarelo`; com meta `'2026-11-19'` dá `verde`.
  - `avisoMeta` com admissão 19/11 e meta `'2026-11-18'` dá `'Pelas etapas, a admissão sai em 19/11 e a meta é 18/11.'`; com meta `'2026-11-19'` dá `null`.
  - `resumoPorEtapa` com vagas na etapa 1 de funções `'Eletricista'`, `'eletricista '` e `'Técnico de Planejamento'` (2 vezes) dá, no cartão 1, `total 4` e `funcoes [{ funcao:'Eletricista', total:2 }, { funcao:'Técnico de Planejamento', total:2 }]` (Review Focus 4). Uma vaga mobilizada vai para o cartão `'Mobilizadas'`, e o resultado tem 14 cartões.
  - `resumoPorEtapa` conta `vermelho: 1` na função de uma vaga vermelha.
  - `resumirProjeto` com 3 vagas (metas 10/12, 05/12 com a vaga admitida, 20/12) dá `proximaMeta '2026-12-10'`.
  - `resumirOndas` com duas ondas cadastradas, uma sem vagas, devolve as duas, ordenadas por início.
  - `filtrarVagas({ funcao: 'eletricista' })` acha `'Eletricista '`, e `filtrarVagas({ onda: '<id>' })` filtra pelo id.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run src/dominio`. Expected: FAIL.
- [ ] **Step 3: Implementar** as funções acima. Ajustar `src/test/vagas.ts` para os tipos novos (`onda` com `nome`, `projetoId`, `meta`).
- [ ] **Step 4: Rodar e ver passar:** `npx vitest run src/dominio`. Expected: PASS. Os erros de tipo fora de `src/dominio` são corrigidos nas Tasks 3 a 7, então ainda não é hora de rodar `typecheck`.
- [ ] **Step 5: Commit:** `feat: durações por projeto, meta da vaga e resumo por etapa e função`

### Task 2: Banco: clientes, projetos, acessos e migração da Braskem 2027 (migração 005)

**Files:**
- Create: `supabase/migrations/20261028000005_projetos.sql`
- Modify: `tests/sql/apoio.ts`
- Test: `tests/sql/projetos.test.ts` (novo), `tests/sql/acoes.test.ts` (adaptar a `novaVaga`)

**Interfaces:**
- Produces (SQL, tudo aditivo; nada do que o código publicado usa é apagado):
  - `clientes (id uuid pk, nome text not null unique, criado_em timestamptz default now())`.
  - `cliente_duracoes (cliente_id uuid references clientes on delete cascade, ordem smallint references etapas, duracao smallint not null check (duracao >= 0), primary key (cliente_id, ordem))`.
  - `projetos (id uuid pk, cliente_id uuid not null references clientes, nome text not null, area text, organizacao text not null check (organizacao in ('ondas','meta')), encerrado_em timestamptz, criado_em timestamptz default now(), unique (cliente_id, nome))`.
  - `projeto_duracoes (projeto_id uuid references projetos on delete cascade, ordem smallint references etapas, duracao smallint not null check (duracao >= 0), primary key (projeto_id, ordem))`. Só os ajustes.
  - `projeto_acessos (projeto_id uuid references projetos on delete cascade, usuario_id uuid references usuarios(id) on delete cascade, primary key (projeto_id, usuario_id))`.
  - `ondas`: + `projeto_id uuid references projetos` (nullable na 005), + `nome text`, + `unique (projeto_id, nome)`.
  - `vagas`: + `projeto_id uuid references projetos` (nullable na 005), + `meta date`. `onda_id` deixa de ser `not null`. Index em `projeto_id`.
  - `gestores`: + `cliente_id uuid references clientes`.
  - `usuarios`: + `cliente_id uuid references clientes`. O check de perfil passa a aceitar `('rh','visualizador','gestor','cliente')` (o `visualizador` sai na 006). Novo check: `(perfil = 'cliente') = (cliente_id is not null)`.
  - **Gatilhos**:
    - `conferir_vaga` (before insert/update em `vagas`), com estes erros:
      - `'onda obrigatória'`: projeto `ondas` sem `onda_id`;
      - `'onda de outro projeto'`;
      - `'meta obrigatória'`: projeto `meta` sem `meta`;
      - `'projeto sem ondas'`: projeto `meta` com `onda_id`.
      - Só vale quando `projeto_id is not null`, para o código publicado continuar funcionando até a 006.
    - `projeto_aberto` (before insert/update/delete em `vagas`, `ondas`, `vaga_conclusoes` e `projeto_duracoes`): `'projeto encerrado'` quando o projeto da linha tem `encerrado_em`.
    - `conferir_acesso` (before insert em `projeto_acessos`): `'perfil sem acesso por projeto'` para o RH, e `'cliente diferente'` quando o usuário é `cliente` e `projetos.cliente_id <> usuarios.cliente_id`.
    - `acessos_do_usuario` (after update of perfil, cliente_id em `usuarios`): apaga os acessos que deixariam de obedecer à regra (todos, se virar `rh`).
  - **Leitura (RLS)**. `pode_ver_projeto(p uuid) returns boolean` (security definer) = `eh_rh() or exists (select 1 from projeto_acessos a join usuarios u on u.id = a.usuario_id where a.projeto_id = p and u.usuario_id = auth.uid() and u.ativo)`. A política `leitura` muda nas tabelas existentes, e as novas recebem a sua:
    - `projetos`: `pode_ver_projeto(id)`;
    - `ondas`, `vagas`, `projeto_duracoes`: `pode_ver_projeto(projeto_id)`;
    - `vaga_conclusoes`: a vaga é visível;
    - `historico`: `eh_rh()` ou (`vaga_id is not null` e a vaga é visível);
    - `clientes`, `cliente_duracoes`, `gestores`: `eh_rh()` ou existe projeto visível com aquele cliente;
    - `projeto_acessos`: `eh_rh()` ou é o próprio usuário;
    - `etapas`, `feriados`: como hoje (`meu_perfil() is not null`);
    - `vagas`/`ondas` com `projeto_id null` só o RH vê.
  - Escrita direta: só o RH (política `rh_escreve`, como hoje) em todas as tabelas novas.
  - **Funções** (security definer, `set search_path = public, pg_temp`, conferem `eh_rh()` e gravam o histórico com `meu_nome()`):
    - `salvar_cliente(p_id uuid, p_nome text) returns uuid`. Ao criar, copia `etapas.duracao` para `cliente_duracoes`.
    - `alterar_duracao_cliente(p_cliente uuid, p_ordem smallint, p_dias smallint) returns void`. Grava no histórico geral, com `detalhe {cliente, antes, depois}`.
    - `alterar_duracao_projeto(p_projeto uuid, p_ordem smallint, p_dias smallint) returns void`. `p_dias null` apaga o ajuste (volta ao padrão do cliente). Grava no histórico geral, com `detalhe {projeto, antes, depois}`.
    - `salvar_projeto(p_id uuid, p jsonb /* cliente_id, nome, area, organizacao */) returns uuid`. Erros: `'cliente não muda'` ao editar com outro `cliente_id`, e `'projeto tem vagas'` ao trocar `organizacao` com vagas não canceladas.
    - `encerrar_projeto(p_id uuid) returns void` e `reabrir_projeto(p_id uuid) returns void`, com histórico geral.
    - `salvar_onda_projeto(p_id uuid, p_projeto uuid, p_nome text, p_inicio date, p_fim date) returns uuid`. Erro `'projeto sem ondas'` se o projeto for `meta`. A função antiga `salvar_onda` continua até a 006.
    - `salvar_vaga(p_id uuid, p jsonb)`: o `p` passa a aceitar `projeto_id` (só ao criar), `meta` e `onda_id` nulo. `disciplina` e `area` vazias são gravadas como `''`. O histórico registra a meta no antes e depois.
    - `importar_vagas(p_projeto uuid, p_vagas jsonb) returns int`: uma transação, confere `eh_rh()` e **acrescenta** as vagas (com as conclusões) ao projeto. Cada item tem `{ funcao, disciplina, area, gestor_id, onda_id, meta, candidato, data_inicio, concluidas: [{ ordem, concluida_em }] }`. Os gatilhos garantem onda e meta. Grava no histórico geral: `'Importou {n} vagas em {projeto}'`.
  - **Migração dos dados** (na mesma 005):
    - cria o cliente `Braskem`, com as durações copiadas de `etapas`;
    - cria o projeto `Mobilização Braskem 2027` (`organizacao 'ondas'`, `area null`);
    - `ondas.projeto_id` = esse projeto e `ondas.nome = numero || 'ª Onda'`;
    - `vagas.projeto_id` = esse projeto;
    - `gestores.cliente_id` = Braskem;
    - os usuários `visualizador` viram `gestor`, com acesso à Braskem 2027. Em produção não há nenhum (conferido em 28/10), mas a migração cobre o caso.
- `tests/sql/apoio.ts`:
  - `comoUsuario(c: Client, perfil: 'rh' | 'gestor' | 'cliente', clienteId?: string): Promise<{ authId: string; usuarioId: string /* usuarios.id */ }>`;
  - `novoCliente(c: Client, nome?: string): Promise<string>`, que cria o cliente com as durações copiadas, como `salvar_cliente`;
  - `novoProjeto(c: Client, p: { clienteId: string; organizacao: 'ondas' | 'meta'; nome?: string }): Promise<{ projetoId: string; ondaId: string | null }>` (com `ondas`, já cria uma onda de 22/10 a 31/12/2026);
  - `novaVaga(c: Client, p: { projetoId: string; ondaId?: string | null; meta?: string | null; dataInicio?: string }): Promise<string>`.
  - Todos agem com o papel do banco, antes de `comoUsuario`.

- [ ] **Step 1: Testes que falham** em `tests/sql/projetos.test.ts`, todos com `emTransacao`:
  - `'a migração põe as vagas reais na Braskem 2027 sem perder nada'`: guarda, **antes** de `aplicarPendentes`, a contagem de `vagas`, `vaga_conclusoes` e `historico` e a lista `(vaga_id, ordem, concluida_em)`. Depois confere que todas as vagas têm `projeto_id` do projeto `'Mobilização Braskem 2027'`, que as ondas se chamam `'1ª Onda'` a `'4ª Onda'` e que as conclusões e as contagens são iguais. Para isso, `emTransacao` ganha o parâmetro opcional `antes?: (c) => Promise<void>`, rodado antes de `aplicarPendentes`.
  - `'cliente só vê os projetos liberados'` (Review Focus 1): dois projetos da mesma Braskem, um usuário `cliente` com acesso só ao primeiro. Ele lê 1 projeto, só as vagas desse projeto, nenhuma conclusão do outro, e `historico` com `vaga_id null` vem vazio.
  - `'gestor vê projetos de clientes diferentes'`: com acesso a projetos de dois clientes, lê os dois.
  - `'gestor e cliente não escrevem'`: o `insert` em `vagas` e a chamada a `concluir_etapa` dão erro.
  - `'acesso de cliente a projeto de outro cliente é recusado'` (Review Focus 2): o `insert` em `projeto_acessos` dá `'cliente diferente'`.
  - `'trocar o cliente do usuário remove os acessos que deixam de valer'` (Review Focus 2).
  - `'duração do cliente não muda projeto que ajustou a etapa'` (Review Focus 3): `alterar_duracao_projeto(p1, 9, 3)` e depois `alterar_duracao_cliente(cli, 9, 5)` deixam `projeto_duracoes` de p1 com 3, e `cliente_duracoes` com 5. Com `alterar_duracao_projeto(p1, 9, null)`, o ajuste some.
  - `'projeto encerrado recusa escrita'` (Review Focus 5): com `encerrar_projeto`, a chamada a `concluir_etapa` dá `'projeto encerrado'`. Depois de `reabrir_projeto`, funciona.
  - `'vaga de projeto por ondas exige onda do mesmo projeto'` (`'onda obrigatória'`, `'onda de outro projeto'`) e `'vaga de projeto meta exige meta e recusa onda'`.
  - `'trocar a organização com vagas é recusado'` e `'cliente do projeto não muda'`.
  - `'importar_vagas acrescenta vagas com as conclusões'`: importar 2 vagas, uma com conclusões 1 e 2, num projeto que já tem 1 vaga dá 3 vagas e 2 conclusões novas, com uma linha no histórico geral.
  - Em `acoes.test.ts`, os testes existentes passam a criar a vaga com `novoCliente`/`novoProjeto`/`novaVaga`.
- [ ] **Step 2: Rodar e ver falhar:** `npm run test:sql`. Expected: FAIL.
- [ ] **Step 3: Escrever a migração 005.** Sem `db:push` ainda.
- [ ] **Step 4: Rodar e ver passar:** `npm run test:sql`. Expected: PASS. Os testes aplicam a 005 dentro da transação desfeita, então nada fica gravado.
- [ ] **Step 5: Commit:** `feat: banco com clientes, projetos, acessos por projeto e durações por cliente`
- [ ] **Step 6 (com o Joel): aplicar a 005 em produção** com `npm run db:push`, depois `npm run db:tipos`, e commitar `src/lib/supabase/tipos.ts` (`chore: tipos do banco com projetos`). A 005 é compatível com o código no ar: o painel publicado continua lendo as mesmas colunas, e o único usuário é RH. Depois, abrir o painel publicado e conferir que as 50 vagas aparecem.

### Task 3: Leitura: painel de um projeto e lista de projetos

**Files:**
- Modify: `src/lib/painel/dados.ts`
- Test: `src/lib/painel/__tests__/dados.test.ts`

**Interfaces:**
- Consumes: `etapasDoProjeto`, `situacaoVaga`, `resumirProjeto` e os tipos da Task 1; as tabelas da Task 2 (`tipos.ts` regenerado).
- Produces:
  - `type ProjetoInfo = { id: string; nome: string; area: string | null; organizacao: 'ondas' | 'meta'; encerrado: boolean; cliente: { id: string; nome: string } }`.
  - `LinhasPainel` ganha:
    - `projetos: { id; nome; area; organizacao; encerrado_em; cliente_id }[]`;
    - `clientes: { id; nome }[]`;
    - `clienteDuracoes: { cliente_id; ordem; duracao }[]`;
    - `projetoDuracoes: { projeto_id; ordem; duracao }[]`.
    - As `vagas` ganham `projeto_id` e `meta`, e as `ondas` vêm com `id, nome, inicio, fim, projeto_id`.
  - `montarPainel(l: LinhasPainel, hoje: string): VagaPainel[]` calcula as etapas de cada vaga com `etapasDoProjeto` do projeto dela. Meta = `onda.fim` ou `vaga.meta`.
  - `carregarPainel(sb, hoje: string, projetoId: string): Promise<{ projeto: ProjetoInfo; vagas: VagaPainel[]; etapas: EtapaDef[] /* efetivas do projeto */; ondas: OndaVaga[]; gestores: { id: string; nome: string }[] /* do cliente */ } | null>`. Devolve `null` quando o projeto não é visível (o RLS não devolve a linha).
  - `type CartaoProjeto = { id: string; nome: string; area: string | null; organizacao: 'ondas' | 'meta'; ondas: number; encerrado: boolean; cliente: { id: string; nome: string }; resumo: ResumoGrupo }`.
  - `montarProjetos(l: LinhasPainel, hoje: string): CartaoProjeto[]` (pura) e `carregarProjetos(sb, hoje: string): Promise<CartaoProjeto[]>`. Vêm ordenados por cliente e depois por nome, e incluem os encerrados (a tela separa).
  - `carregarVaga(sb, hoje: string, vagaId: string): Promise<{ painel: NonNullable<Awaited<ReturnType<typeof carregarPainel>>>; vaga: VagaPainel } | null>`: acha o `projeto_id` da vaga e chama `carregarPainel`.

- [ ] **Step 1: Testes que falham** de `montarPainel` e `montarProjetos`, com linhas em memória:
  - dois projetos do mesmo cliente, com o projeto B ajustando a etapa 2 para 1 dia: a vaga de B tem a etapa 2 terminando antes da de A;
  - uma vaga de projeto `meta` com `meta '2026-11-18'` e admissão em 19/11 fica `amarelo`;
  - `montarProjetos` devolve um cartão por projeto, com `resumo.total` certo e `ondas` contando as ondas do projeto;
  - `carregarPainel` com um `sb` falso que devolve `projetos` vazio dá `null` (Review Focus 1).
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run src/lib/painel`. Expected: FAIL.
- [ ] **Step 3: Implementar.** Consultas em paralelo, como hoje, filtradas por `projeto_id` em `carregarPainel`.
- [ ] **Step 4: Rodar e ver passar.** Expected: PASS.
- [ ] **Step 5: Commit:** `feat: leitura do painel por projeto e da lista de projetos`

### Task 4: Perfis, usuários e acessos

**Files:**
- Modify: `src/lib/auth/perfil.ts`, `src/lib/cadastros/usuarios.ts`, `src/middleware.ts` (só o comentário dos perfis)
- Create: `src/lib/cadastros/acessos.ts`
- Test: `src/lib/cadastros/__tests__/usuarios.test.ts`, `src/lib/cadastros/__tests__/acessos.test.ts` (novo)

**Interfaces:**
- Produces:
  - `type Perfil = 'rh' | 'gestor' | 'cliente'`. `Sessao` ganha `usuarioRegistroId: string` (o `usuarios.id`) e `clienteId: string | null`.
  - `esquemaUsuario`: `perfil: z.enum(['rh','gestor','cliente'])` e `clienteId`, obrigatório quando `perfil === 'cliente'` (mensagem `'Escolha o cliente.'`) e ignorado nos outros perfis (gravado como `null`).
  - `cadastrarUsuario(admin, entrada)` grava `cliente_id`.
  - `alterarUsuario(admin, id, entrada: { nome: string; perfil: Perfil; clienteId: string | null; ativo: boolean })`.
  - `ROTULO_PERFIL: Record<Perfil, string> = { rh: 'RH', gestor: 'Gestor Timenow', cliente: 'Cliente' }`.
  - `acessos.ts`:
    - `liberarAcesso(sb, projetoId: string, usuarioId: string): Promise<{ ok: true } | { ok: false; erro: string }>`;
    - `removerAcesso(sb, projetoId: string, usuarioId: string): Promise<{ ok: true } | { ok: false; erro: string }>`.
    - Mapeiam `'cliente diferente'` → `'Esta pessoa é de outro cliente e não pode ver este projeto.'` e `'perfil sem acesso por projeto'` → `'O RH já vê todos os projetos.'`.
  - `usuariosLiberaveis(usuarios: { id: string; perfil: Perfil; clienteId: string | null; ativo: boolean }[], clienteDoProjeto: string): typeof usuarios` (pura): os ativos com perfil `gestor`, mais os `cliente` daquele cliente.

- [ ] **Step 1: Testes que falham:**
  - O esquema recusa `{ perfil: 'cliente' }` sem `clienteId`, com `'Escolha o cliente.'`, e aceita `{ perfil: 'gestor' }` sem cliente, gravando `clienteId null`.
  - `usuariosLiberaveis` com um gestor, um cliente da Braskem, um cliente de outro cliente e um RH, para um projeto da Braskem, devolve só o gestor e o cliente da Braskem.
  - `liberarAcesso` com um `sb` falso que devolve o erro `'cliente diferente'` dá a mensagem acima.
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.** Expected: PASS.
- [ ] **Step 5: Commit:** `feat: perfis RH, Gestor Timenow e Cliente com acesso por projeto`

### Task 5: Lista de projetos (tela inicial)

**Files:**
- Modify: `src/app/(painel)/page.tsx` (vira a lista), `src/app/(painel)/layout.tsx` (navegação do RH: "Projetos" `/` e "Cadastros" `/cadastros`), `src/components/layout/CascaApp.tsx`, `src/app/entrar/page.tsx`, `src/app/layout.tsx` (o nome fixo "Mobilização Braskem 2027" vira "Painel de Mobilização"; a linha de apoio da entrada vira "Acompanhamento das contratações")
- Create: `src/app/(painel)/CartaoProjeto.tsx`, `src/app/(painel)/FormProjeto.tsx`, `src/app/(painel)/acoesProjeto.ts`, `src/app/(painel)/encerrados/page.tsx`
- Test: `src/app/(painel)/__tests__/CartaoProjeto.test.tsx`, `src/app/(painel)/__tests__/ListaProjetos.test.tsx`

**Interfaces:**
- Consumes: `carregarProjetos` (Task 3), `Sessao` (Task 4), `salvar_projeto` (Task 2).
- Produces:
  - `acoesProjeto.ts` (server actions, todas com `exigirRh()`):
    - `salvarProjeto(id: string | null, entrada: unknown): Promise<{ ok: true; id: string } | { ok: false; erros: Record<string, string> }>`. Esquema zod: `nome` obrigatório, `clienteId` uuid, `area` opcional, `organizacao` `'ondas' | 'meta'`. Mapeia `'cliente não muda'` → "O cliente de um projeto não muda.", `'projeto tem vagas'` → "Este projeto já tem vagas. Para mudar a organização, crie outro projeto." e o código `23505` → "Já existe um projeto com este nome neste cliente.";
    - `encerrarProjeto(id: string)` e `reabrirProjeto(id: string)`, que devolvem `{ ok: true } | { ok: false; erro: string }`.
  - Lista (`/`):
    - os projetos **não encerrados**, agrupados por cliente (título do grupo = nome do cliente), em grade de cartões (`sm:grid-cols-2`);
    - para o RH, o botão "+ Novo projeto" (abre `FormProjeto` num `PainelLateral` e, ao salvar, vai para `/projetos/{id}/configurar`) e o link "Encerrados" (`/encerrados`).
  - Quem não é RH e tem **exatamente um** projeto não encerrado vai direto (`redirect`) para `/projetos/{id}`. Com nenhum, aparece: "Ainda não há projetos liberados para você. Fale com o RH."
  - `CartaoProjeto({ projeto: CartaoProjeto })` é um link para `/projetos/{id}` com `aria-label="Projeto {nome}"`. Mostra:
    - o nome;
    - "{área} · {n} ondas · {total} vagas", ou "{área} · sem ondas · {total} vagas" (sem a área quando ela for nula);
    - a barra "{admitidas} admitidos de {total}";
    - num projeto `meta` com `proximaMeta`, o texto "próxima meta {dd/mm}";
    - "{verde} no prazo · {amarelo} em risco · {vermelho} atrasadas", com as cores de `cores.ts`.
  - `/encerrados`: mesma grade, só com os encerrados, e o texto "Encerrado" no cartão.

- [ ] **Step 1: Testes que falham:**
  - `CartaoProjeto` de um projeto com ondas mostra "4 ondas · 50 vagas" e "12 admitidos de 50". O de um projeto `meta` mostra "sem ondas" e "próxima meta 10/12".
  - A lista agrupa dois projetos da Braskem sob o título "Braskem" e um terceiro sob "Timenow".
  - "+ Novo projeto" só aparece para o RH.
  - A mensagem de nenhum projeto aparece para um gestor sem projetos.
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar.** Para manter a lista testável, separar a parte de apresentação num componente `ListaProjetos({ projetos, perfil })`.
- [ ] **Step 4: Rodar e ver passar.** Expected: PASS.
- [ ] **Step 5: Commit:** `feat: lista de projetos agrupada por cliente`

### Task 6: Dentro do projeto: abas, Painel e detalhe da vaga

**Files:**
- Create: `src/app/(painel)/projetos/[id]/layout.tsx` (topo com o nome do projeto, "{cliente} · {área}", "← Projetos" quando a pessoa vê mais de um projeto ou é RH, e as abas "Painel", "Resumo" e "Configurar" (esta só para o RH)), `src/app/(painel)/projetos/[id]/page.tsx` (o painel, com o conteúdo do antigo `src/app/(painel)/page.tsx`)
- Move: `Atencao.tsx`, `CartoesOnda.tsx`, `Filtros.tsx`, `Quadro.tsx`, `CartaoVaga.tsx` e os testes deles, de `src/app/(painel)/` para `src/app/(painel)/projetos/[id]/`
- Modify: `src/app/(painel)/vagas/[id]/page.tsx`, `src/app/(painel)/vagas/[id]/acoesVaga.ts`, `src/components/rh/FormVaga.tsx`, `src/lib/validacao/vaga.ts`
- Test: os testes movidos, `src/app/(painel)/vagas/[id]/__tests__/acoesVaga.test.ts`, `src/components/rh/__tests__/FormVaga.test.tsx` (novo)

**Interfaces:**
- Consumes: `carregarPainel` e `carregarVaga` (Task 3), `avisoMeta`, `resumirOndas` e `resumirProjeto` (Task 1).
- Produces:
  - `/projetos/[id]`: `notFound()` quando `carregarPainel` devolve `null`.
    - Projeto `ondas`: `CartoesOnda` com `resumirOndas` (o link do cartão põe `onda=<id>` no endereço, e o rótulo é `onda.nome`).
    - Projeto `meta`: um único cartão com `resumirProjeto` e o título "Todas as vagas", sem período e sem link.
    - Os filtros ficam no endereço, com `onda=<id>`. O filtro de onda só aparece em projeto `ondas`.
  - `Atencao` troca "(onda até {dd/mm})" por "(meta {dd/mm})".
  - Detalhe `/vagas/[id]`:
    - usa `carregarVaga` e dá `notFound()` com `null`;
    - "← Voltar ao painel" vai para `/projetos/{projetoId}`;
    - a linha de dados mostra "{onda.nome} (meta {dd/mm})" ou "Meta {dd/mm}";
    - num projeto encerrado, não mostra os botões do RH.
  - `esquemaVaga`:
    - `disciplina` e `area` opcionais (vazias viram `''`);
    - `ondaId` uuid ou `null`;
    - `meta` data ou `null`;
    - `projetoId` uuid.
    - A regra "onda ou meta" fica no banco. A action mapeia `'onda obrigatória'` → `{ ondaId: 'Escolha a onda.' }` e `'meta obrigatória'` → `{ meta: 'Informe a meta.' }`.
  - `salvarVaga(id, entrada)` devolve `{ ok: true; id: string; aviso: string | null } | { ok: false; erros }`. O `aviso` é o `avisoMeta` da vaga recarregada.
  - `FormVaga` recebe `organizacao: 'ondas' | 'meta'` e `projetoId`. Mostra "Onda" ou "Meta (data pedida pelo cliente)" conforme a organização. Se houver `aviso` depois de salvar, o painel continua aberto e mostra o aviso (`role="status"`) com o botão "Entendi", que fecha o painel.
  - `MENSAGENS` de `acoesVaga.ts` ganha `['projeto encerrado', 'Este projeto está encerrado. Reabra para alterar.']` (Review Focus 5).

- [ ] **Step 1: Testes que falham:**
  - Os testes movidos passam com os tipos novos. `CartoesOnda` mostra "1ª Onda" vindo de `nome`.
  - `Atencao` mostra "(meta 18/11)".
  - `acoesVaga`: o erro `'projeto encerrado'` vira a mensagem acima, e `'meta obrigatória'` vira o erro no campo `meta`.
  - `FormVaga` com `organizacao 'meta'` mostra o campo "Meta" e não o "Onda". Quando `salvarVaga` (mock) devolve `aviso`, o texto aparece e o painel continua aberto.
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar:** `npm test && npm run typecheck && npm run lint`. Expected: PASS, exceto os erros de tipo das páginas de `cadastros/` que a Task 9 reescreve. Anotar quais são.
- [ ] **Step 5: Commit:** `feat: painel e detalhe da vaga dentro do projeto`

### Task 7: Aba Resumo

**Files:**
- Create: `src/app/(painel)/projetos/[id]/resumo/page.tsx`, `src/app/(painel)/projetos/[id]/resumo/CartoesEtapa.tsx`
- Test: `src/app/(painel)/projetos/[id]/resumo/__tests__/CartoesEtapa.test.tsx`

**Interfaces:**
- Consumes: `carregarPainel` (Task 3), `resumoPorEtapa` e `filtrarVagas` (Task 1).
- Produces:
  - Página: `notFound()` com `null`. No topo, para projeto `ondas`, os botões "Todas" e um por onda, que põem `?onda=<id>` no endereço. Ao lado, "{n} em andamento · {m} mobilizadas".
  - `CartoesEtapa({ cartoes: CartaoEtapa[]; hrefFuncao: (funcao: string) => string })`: grade de 14 cartões (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`).
    - Título "{ordem}. {nome}" e o total, com número grande (≥ 24px).
    - Uma linha por função, com o nome, o total e, quando houver, "{n} atrasadas" em vermelho e "{n} em risco" em amarelo, com as cores de `cores.ts`.
    - Cada função é um link para `hrefFuncao(funcao)` = `/projetos/{id}?funcao={funcao}&onda={onda atual}`.
    - O cartão sem vagas fica apagado (`opacity-60`), com "nenhuma vaga".
    - O cartão "Mobilizadas" vem por último.

- [ ] **Step 1: Testes que falham:**
  - Com o resultado de `resumoPorEtapa` da Task 1, o cartão "1. Abertura de vaga" mostra "Técnico de Planejamento" com 5 e "Engenheiro de Campo" com 1.
  - O link da função tem `href` com `funcao=T%C3%A9cnico+de+Planejamento` (ou o equivalente codificado).
  - Uma etapa vazia mostra "nenhuma vaga".
  - Uma linha com `vermelho: 2` mostra "2 atrasadas".
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar.** Conferir em `npm run dev` em 1280 px e 390 px, nos temas claro e escuro.
- [ ] **Step 4: Rodar e ver passar.** Expected: PASS.
- [ ] **Step 5: Commit:** `feat: resumo do projeto por etapa e função`

### Task 8: Aba Configurar (só RH)

**Files:**
- Create: `src/app/(painel)/projetos/[id]/configurar/page.tsx` e, na mesma pasta, `DadosProjeto.tsx`, `OndasProjeto.tsx`, `DuracoesProjeto.tsx`, `VagasProjeto.tsx` (reaproveita a lista de vagas com "Editar" e "Cancelar" de `src/app/(painel)/cadastros/vagas/Cliente.tsx`, com as canceladas), `AcessosProjeto.tsx`, `acoesConfigurar.ts`
- Test: `src/app/(painel)/projetos/[id]/configurar/__tests__/{DuracoesProjeto,AcessosProjeto,VagasProjeto}.test.tsx`

**Interfaces:**
- Consumes: `salvarProjeto`, `encerrarProjeto` e `reabrirProjeto` (Task 5); `liberarAcesso`, `removerAcesso` e `usuariosLiberaveis` (Task 4); `salvar_onda_projeto` e `alterar_duracao_projeto` (Task 2); `FormVaga` (Task 6).
- Produces:
  - `acoesConfigurar.ts` (todas com `exigirRh()` e `revalidatePath('/', 'layout')`):
    - `salvarOndaProjeto(projetoId: string, id: string | null, entrada: unknown): Promise<RespostaAcao>`. Valida nome, início e fim (fim ≥ início). O código `23505` vira "Já existe uma onda com este nome.";
    - `alterarDuracaoProjeto(projetoId: string, ordem: number, entrada: { duracao: string }): Promise<RespostaAcao>`. Vazio = voltar ao padrão do cliente. Inteiro de 0 a 60;
    - `liberar(projetoId: string, usuarioId: string)` e `remover(projetoId: string, usuarioId: string)`, que chamam `acessos.ts`.
  - A página, com `exigirRh()` e `notFound()`, tem cinco blocos, em `<section>`, com estes títulos:
    1. "Dados": o `FormProjeto` em modo edição (o cliente aparece só para leitura).
    2. "Ondas": só em projeto `ondas`. Tabela nome/início/fim e "+ Nova onda".
    3. "Duração das etapas": tabela "Etapa | Padrão {cliente} | Neste projeto". O campo fica vazio quando não há ajuste, e a linha ajustada mostra "ajustado" e um botão "Voltar ao padrão".
    4. "Vagas": os botões "Baixar modelo Excel" e "Importar planilha" (ligados na Task 10; nesta task, o "Importar" leva para `/projetos/{id}/importar`, criado na Task 10), "+ Vaga avulsa" (`FormVaga`) e a lista de vagas e de canceladas.
    5. "Quem vê este projeto": tabela "Pessoa | Perfil | remover" e um `Selecao` com os `usuariosLiberaveis` que ainda não têm acesso, mais o botão "Liberar". A dica do campo diz: "Só aparecem os Gestores Timenow e as pessoas do cliente {cliente}."
  - No fim da página, "Encerrar projeto" (pede confirmação) ou, se o projeto estiver encerrado, "Reabrir projeto". Num projeto encerrado, os blocos 2 a 4 ficam só para leitura, e aparece o aviso "Projeto encerrado. Reabra para alterar."

- [ ] **Step 1: Testes que falham:**
  - `DuracoesProjeto` com o padrão do cliente 7 e o ajuste 5 na etapa 9 mostra "ajustado" e "Voltar ao padrão" nessa linha. Clicar chama `alterarDuracaoProjeto(projetoId, 9, { duracao: '' })`.
  - `AcessosProjeto` lista as pessoas liberadas com o rótulo do perfil ("Gestor Timenow", "Cliente"). O `Selecao` só oferece os liberáveis recebidos, e "remover" chama `remover`.
  - `VagasProjeto` mostra os botões "Baixar modelo Excel", "Importar planilha" e "+ Vaga avulsa".
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.** Expected: PASS.
- [ ] **Step 5: Commit:** `feat: configuração do projeto com ondas, durações, vagas e acessos`

### Task 9: Cadastros gerais: clientes, usuários e feriados

**Files:**
- Modify: `src/app/(painel)/cadastros/page.tsx` (os itens passam a ser Clientes, Usuários e Feriados, e o registro geral continua), `src/app/(painel)/cadastros/acoesCadastros.ts`, `src/app/(painel)/cadastros/usuarios/{page,Cliente}.tsx`
- Create: `src/app/(painel)/cadastros/clientes/{page,Cliente}.tsx` (lista e "+ Novo cliente"), `src/app/(painel)/cadastros/clientes/[id]/{page,Duracoes,Gestores}.tsx`
- Delete: `src/app/(painel)/cadastros/{ondas,gestores,etapas,vagas}/` (o que serve das vagas foi para a Task 8)
- Test: `src/app/(painel)/cadastros/usuarios/__tests__/Cliente.test.tsx` (novo), `src/app/(painel)/cadastros/clientes/__tests__/Duracoes.test.tsx` (novo)

**Interfaces:**
- Consumes: `salvar_cliente` e `alterar_duracao_cliente` (Task 2), o esquema de usuário e `ROTULO_PERFIL` (Task 4), `liberarAcesso`/`removerAcesso` (Task 4).
- Produces (actions em `acoesCadastros.ts`):
  - `salvarCliente(id: string | null, entrada: unknown)`. O código `23505` vira "Já existe um cliente com este nome.";
  - `alterarDuracaoCliente(clienteId: string, ordem: number, entrada: { duracao: string })` (inteiro de 0 a 60);
  - `salvarGestor(clienteId: string, id: string | null, entrada: unknown)`, que grava `cliente_id`;
  - `salvarUsuario` aceita `perfil` (`rh`/`gestor`/`cliente`) e `clienteId`. A regra "você não pode tirar o seu próprio acesso de RH" continua.
  - Página do cliente (`/cadastros/clientes/[id]`): as durações das 13 etapas, editáveis, com a dica "Vale para os projetos deste cliente que não ajustaram a etapa.", e os gestores do cliente (nome e e-mail).
  - Usuários:
    - a tabela mostra nome, e-mail, perfil (`ROTULO_PERFIL`), cliente (para `cliente`) e "Vê: {projetos, separados por vírgula}" ("todos" para o RH);
    - o formulário tem "Cliente", que só aparece quando o perfil é "Cliente";
    - na edição, uma lista de caixas com os projetos que a pessoa pode receber (todos os não encerrados para o gestor; os do cliente dela para o cliente), que chamam `liberarAcesso`/`removerAcesso` ao marcar e desmarcar.

- [ ] **Step 1: Testes que falham:**
  - No formulário de usuário, escolher "Cliente" mostra o campo "Cliente", e escolher "Gestor Timenow" esconde.
  - A tabela de usuários mostra "Vê: Mobilização Braskem 2027" para um gestor com esse acesso, e "todos" para o RH.
  - `Duracoes` do cliente chama `alterarDuracaoCliente(clienteId, 9, { duracao: '5' })` ao salvar.
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar:** `npm test && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: cadastros de clientes, usuários com perfis e feriados`

### Task 10: Modelo Excel e importação de vagas

**Files:**
- Create: `src/lib/importacao/modelo.ts`, `src/lib/importacao/ler.ts`, `src/app/(painel)/projetos/[id]/modelo/route.ts` (GET, devolve o `.xlsx`), `src/app/(painel)/projetos/[id]/importar/{page,Cliente,acoes}.ts(x)`
- Test: `src/lib/importacao/__tests__/ler.test.ts`, `src/lib/importacao/__tests__/modelo.test.ts`

**Interfaces:**
- Consumes: `importar_vagas` (Task 2), `preverVaga` (plano 1), `avisoMeta` e `chaveFuncao` (Task 1), `carregarPainel` (Task 3), `dataValida` (`src/lib/validacao/vaga.ts`).
- Produces:
  - `COLUNAS_FIXAS = ['Função', 'Disciplina', 'Área', 'Gestor', 'Onda' | 'Meta', 'Início do processo', 'Candidato']`. Depois delas, uma coluna por etapa, com o título igual ao nome da etapa (por exemplo, "Abertura de vaga").
  - `gerarModelo(p: { organizacao: 'ondas' | 'meta'; ondas: string[]; gestores: string[]; etapas: EtapaDef[] }): Promise<Buffer>`:
    - aba "Vagas", só com o cabeçalho e a coluna "Onda" ou "Meta", conforme a organização;
    - aba "Instruções" explicando: uma linha por vaga; Função obrigatória; datas em DD/MM/AAAA; as colunas de etapa recebem a data em que a etapa foi concluída, e vazio quer dizer não concluída; "Início do processo" vazio = hoje ou a primeira conclusão; a lista das ondas e dos gestores válidos.
  - `type ContextoImportacao = { organizacao: 'ondas' | 'meta'; ondas: { id: string; nome: string; fim: string }[]; gestores: { id: string; nome: string }[]; etapas: EtapaDef[]; feriados: Feriados; hoje: string; existentes: { funcao: string; candidato: string | null; meta: string }[] }`.
  - `type VagaImportada = { linha: number; funcao: string; disciplina: string; area: string; gestorId: string | null; ondaId: string | null; meta: string | null; dataInicio: string; candidato: string | null; concluidas: { ordem: number; concluidaEm: string }[]; aviso: string | null; repetida: boolean }`.
  - `lerModeloVagas(arquivo: ArrayBuffer, ctx: ContextoImportacao): Promise<{ ok: true; vagas: VagaImportada[] } | { ok: false; erros: { linha: number; mensagem: string }[] }>`. Regras:
    - os cabeçalhos são casados pelo nome (sem acento, maiúsculas nem espaços extras). Faltar uma coluna fixa dá erro na linha 1: "Falta a coluna {nome}. Use o modelo baixado do projeto.";
    - linhas totalmente vazias são ignoradas;
    - datas em "DD/MM/AAAA", "DD/MM/AA" ou data do Excel (reaproveitar a lógica de `lerData` de `src/lib/carga/ler.ts`, movendo-a para `src/lib/importacao/datas.ts`);
    - onda e gestor são casados pelo nome, sem acento nem maiúsculas;
    - `dataInicio` = a coluna, ou, vazia, o menor entre `hoje` e a primeira conclusão (Review Focus 4);
    - meta da vaga = `onda.fim` ou a coluna Meta. `aviso = avisoMeta(preverVaga(...), meta)`;
    - `repetida` = existe em `ctx.existentes` ou numa linha anterior uma vaga com a mesma `chaveFuncao(funcao)`, o mesmo candidato e a mesma meta.
  - Erros, sempre com a linha:
    - "Informe a função.";
    - "Onda {x} não existe neste projeto.";
    - "Este projeto não usa ondas; deixe a coluna Onda vazia." (quando o modelo traz uma coluna Onda num projeto meta);
    - "Informe a meta.";
    - "Gestor {x} não está cadastrado no cliente.";
    - "Data inválida em {coluna}.";
    - "Etapa {nome} concluída depois de uma não concluída.";
    - "Data no futuro em {coluna}.";
    - "O início do processo é depois da conclusão da Abertura de vaga.";
    - "Datas fora de ordem: {etapa} antes de {etapa anterior}.".
  - `/projetos/[id]/modelo` (GET, só o RH, 404 fora disso): `Content-Disposition: attachment; filename="modelo-{nome-do-projeto}.xlsx"`.
  - Tela `/projetos/[id]/importar`:
    - envio do arquivo e prévia: "{n} vagas lidas", a lista de erros (com a linha) ou a tabela das vagas, com os avisos de meta curta e de linha repetida destacados;
    - o botão "Importar {n} vagas" só aparece sem erros;
    - ao terminar, volta para `/projetos/{id}/configurar` com a mensagem "{n} vagas importadas.".
    - As actions `previaImportacao(projetoId, form)` e `importarVagas(projetoId, form)` releem o arquivo no servidor. Importar com erros devolve "A planilha tem erros. Corrija e envie de novo.".

- [ ] **Step 1: Testes que falham** (as planilhas são geradas com `gerarModelo` e preenchidas com exceljs no próprio teste):
  - `gerarModelo` de um projeto `meta` tem a coluna "Meta" e não "Onda", e 13 colunas de etapa depois de "Candidato".
  - Lê duas vagas, uma com "Abertura de vaga" e "Captura de Mercado" preenchidas, e dá `concluidas` com as duas, `ondaId` resolvido pelo nome "1ª onda" (minúsculas) e o gestor resolvido.
  - `'início vazio com etapas concluídas usa a primeira conclusão'` (Review Focus 4): com `hoje '2026-10-28'` e "Abertura de vaga" em 20/10/2026, `dataInicio '2026-10-20'`.
  - Uma vaga de projeto `meta` com meta 18/11/2026, sem conclusões e início em 22/10/2026, dá `aviso` com "a admissão sai em 19/11".
  - Uma linha igual a uma de `existentes` sai com `repetida: true` e não dá erro.
  - Cada um destes dá o erro com a linha: gestor inexistente, "Captura de Mercado" preenchida com "Abertura de vaga" vazia, data no futuro, coluna "Função" ausente.
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar** o leitor, o modelo, a rota e a tela. Ligar os botões do bloco "Vagas" da Task 8.
- [ ] **Step 4: Rodar e ver passar:** `npm test && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: modelo Excel e importação de vagas por projeto`

### Task 11: Limpeza (migração 006) e publicação

**Files:**
- Create: `supabase/migrations/20261028000006_limpeza_projetos.sql`
- Delete: `src/lib/carga/` (sem `datas`, que foi movido na Task 10), `src/app/(painel)/cadastros/carga/`, `tests/integracao/`, `vitest.integracao.config.mts`, `tests/trava.test.ts`, e o script `test:integracao` do `package.json`
- Modify: `README.md`, `tests/sql/projetos.test.ts`

**Interfaces:**
- Produces (SQL da 006):
  - `vagas.projeto_id` e `ondas.projeto_id` passam a `not null`, e `ondas.nome` também;
  - sai `ondas.numero` (com o `unique` e o `check` de 1 a 4);
  - o check de `usuarios.perfil` fica `('rh','gestor','cliente')`;
  - o gatilho `conferir_vaga` deixa de aceitar `projeto_id null`;
  - saem as funções `salvar_onda(uuid, smallint, date, date)`, `alterar_duracao(smallint, smallint)` e `importar_carga(jsonb, text)`;
  - repete o laço que fixa `search_path = public, pg_temp` nas funções security definer.
- `tests/integracao` sai porque não pode mais rodar: o único banco é o de produção, com vagas reais. A cobertura de banco fica em `tests/sql`, que roda em transação desfeita.

- [ ] **Step 1: Teste que falha** em `tests/sql/projetos.test.ts`: `'depois da limpeza não existe vaga sem projeto'` (`insert` sem `projeto_id` dá erro de not null) e `'perfil visualizador não existe mais'`.
- [ ] **Step 2: Rodar e ver falhar:** `npm run test:sql`. Expected: FAIL.
- [ ] **Step 3: Escrever a 006 e apagar** os arquivos listados. No README:
  - trocar a descrição para "projetos de mobilização";
  - explicar perfis e acessos;
  - descrever a importação por modelo;
  - tirar a seção de `test:integracao`;
  - registrar a regra: "migração que apaga coluna vai em separado, depois do deploy".
- [ ] **Step 4: Rodar e ver passar:** `npm test && npm run test:sql && npm run typecheck && npm run lint && npm run build`. Expected: PASS.
- [ ] **Step 5: Commit:** `chore: limpeza do modelo de uma mobilização só`
- [ ] **Step 6 (com o Joel): publicar, nesta ordem.**
  1. Confirmar que a 005 já está em produção (Task 2, Step 6).
  2. `git push`, e esperar o deploy da Vercel terminar.
  3. Entrar no painel publicado. A lista tem o cartão "Mobilização Braskem 2027" sob "Braskem", e ele abre o painel com as 50 vagas, como antes.
  4. Só então rodar `npm run db:push` (aplica a 006), depois `npm run db:tipos`, e commitar os tipos se mudarem.
  5. Conferir de novo o painel publicado.
  6. Criar com o Joel um usuário de teste com perfil Cliente, liberar a Braskem 2027 para ele, entrar como ele e conferir que ele cai direto no painel e não vê Configurar.
