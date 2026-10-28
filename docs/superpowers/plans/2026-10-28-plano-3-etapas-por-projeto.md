# Plano 3: Etapas por projeto e arraste no quadro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada projeto passa a ter a própria lista de etapas. O RH pode incluir, excluir, renomear, mudar a duração e reordenar enquanto não houver vagas. Captura de Mercado e Admissão Timenow continuam obrigatórias. O RH também passa a avançar vagas arrastando o cartão no quadro, inclusive pulando etapas.

**Architecture:**
- Uma tabela nova, `projeto_etapas`, guarda a lista de cada projeto.
- As conclusões passam a apontar para a etapa do projeto (`vaga_conclusoes.etapa_id`).
- No código, `ordem` passa a significar **a posição da etapa na lista do projeto** (1..N). Assim, o domínio, as telas e as funções SQL continuam numéricos, e a mudança fica concentrada no banco e em `dados.ts`.
- O banco muda em duas migrações:
  - a **007**, aditiva e compatível com o código no ar, cria a lista dos projetos existentes, preenche `etapa_id` e reescreve as ações por posição. Enquanto a lista é a padrão, posição = ordem antiga, então o resultado é o mesmo;
  - a **008**, de limpeza, é aplicada depois da publicação.

**Tech Stack:** Next.js 15.5 (App Router), React 19.1, TypeScript, Tailwind 4, Supabase (Postgres, RLS), zod 4, exceljs, Vitest com Testing Library, `pg` nos testes de SQL.

**Spec:** `docs/superpowers/specs/2026-10-28-etapas-por-projeto-design.md`. As regras dos projetos estão em `2026-10-28-projetos-de-mobilizacao-design.md` e as de cálculo em `2026-10-27-painel-mobilizacao-design.md`, e todas continuam valendo.

## Global Constraints

- Código, textos, nomes e comentários em pt-BR, no estilo do código atual: aspas simples, sem ponto e vírgula, comentários curtos. Sem travessão como pontuação nos textos de tela. Botões repetidos por linha têm nome acessível por linha (sufixo `sr-only`).
- **O `.env.local` aponta para o banco de produção.**
  - Os testes de banco rodam só em `tests/sql`, dentro de `emTransacao`, que aplica as migrações pendentes numa transação desfeita.
  - Nunca rodar `npm run db:push` nem `npm run db:tipos` sem o OK do Joel. O `db:push` em produção quem roda é o Joel, no terminal dele.
  - Nunca fazer `git push` sem o OK do Joel.
- A 007 não pode apagar nem renomear nada que o código publicado use: `vaga_conclusoes.ordem`, `projeto_duracoes`, `alterar_duracao_projeto`, as assinaturas de `concluir_etapa(uuid, smallint, date)`, `desfazer_etapa(uuid, smallint)`, `candidato_desistiu(uuid)` e `importar_vagas(uuid, jsonb)`. Apagar só na 008.
- `ordem`, no domínio, nas telas e nos parâmetros `p_ordem_esperada` das funções SQL, é a **posição na lista do projeto** (1..N, contínua). Nunca mais o número global de 1 a 13.
- **Etapas fixas:**
  - `fixa = 'captura'` (Captura de Mercado) e `fixa = 'admissao'` (Admissão Timenow), uma de cada por projeto;
  - não são excluídas nem renomeadas;
  - a Captura vem antes da Admissão.
  - Admissão prevista = fim previsto da etapa `admissao`; admitida = `admissao` concluída; a desistência volta a vaga para a etapa `captura`.
- **Duração efetiva de uma etapa:** `projeto_etapas.duracao`, quando não for nula. Se for nula, o que só acontece em etapa padrão: a duração do cliente para `padrao`, ou, faltando, `etapas.duracao`.
- As conclusões de uma vaga são sempre as primeiras N etapas da lista do projeto, em sequência.
- Toda escrita do RH confere `eh_rh()` e grava o histórico com `meu_nome()`. O registro geral (`historico.vaga_id is null`) só o RH lê.
- **Projeto encerrado:** o banco recusa escrita em `projeto_etapas` também, com `'projeto encerrado'`.

## Review Focus

1. **Incluir uma etapa num projeto em andamento** (Review Focus 1, anti-objetivo):
   - vagas mobilizadas, admitidas e paradas logo depois do ponto da inclusão não mudam de etapa atual, de previsão nem de cor;
   - só as vagas que ainda não chegaram ao ponto passam pela etapa nova.

   → testes nas Tasks 1 e 2.
2. **Excluir a etapa em que uma vaga está parada, ou uma etapa já concluída por algumas vagas:** as datas vão para o histórico da vaga, e a vaga segue para a próxima etapa, sem buraco na sequência. → testes na Task 2.
3. **Dois cliques ou dois RH ao mesmo tempo:** um arraste de várias etapas e um "Concluir etapa" na mesma vaga não concluem nada pela metade. O segundo é recusado com "etapa mudou". → teste na Task 2 e mapeamento na Task 4.
4. **A Braskem 2027 depois da 007:** as mesmas 13 etapas, as mesmas 64 conclusões nas mesmas vagas, as mesmas previsões e as mesmas cores. → teste na Task 2 (no banco) e na Task 3 (`montarPainel` com a lista padrão dá o mesmo resultado de antes).
5. **Planilha de importação baixada antes de uma mudança na lista:** dá erro de coluna claro e não importa nada. → teste na Task 3.

---

### Task 1: Domínio: a lista de etapas do projeto

**Files:**
- Modify: `src/dominio/etapas.ts`, `src/dominio/previsao.ts`, `src/dominio/situacao.ts`, `src/test/vagas.ts`
- Test: `src/dominio/__tests__/etapas.test.ts`, `src/dominio/__tests__/previsao.test.ts`, `src/dominio/__tests__/situacao.test.ts`

**Interfaces:**
- Produces:
  - `type EtapaFixa = 'captura' | 'admissao'`.
  - `type EtapaDef = { id: string; ordem: number /* posição 1..N */; nome: string; duracao: number; fixa: EtapaFixa | null }`.
  - `ETAPAS_PADRAO: EtapaDef[]`: as 13 de hoje, com `id: 'padrao-<n>'`. Ordem 2 tem `fixa: 'captura'`, ordem 11 tem `fixa: 'admissao'` e as demais `null`.
  - Saem `ETAPA_ADMISSAO` e `ETAPA_CAPTURA`. O código passa a achar essas etapas por `fixa`.
  - `type LinhaEtapaProjeto = { id: string; posicao: number; nome: string; duracao: number | null; padrao: number | null; fixa: EtapaFixa | null }`.
  - `etapasDoProjeto(linhas: LinhaEtapaProjeto[], doCliente: ReadonlyMap<number, number>): EtapaDef[]`:
    - ordenadas por `posicao`, com `ordem = posicao`;
    - `duracao = linha.duracao ?? doCliente.get(padrao) ?? ETAPAS_PADRAO[padrao-1].duracao`;
    - lança erro se faltar uma fixa, se a Captura vier depois da Admissão, ou se as posições não forem 1..N contínuas.
  - `preverVaga` mantém a assinatura (`etapas: EtapaDef[]`, `conclusoes: { ordem; concluidaEm }[]`). A retomada vale para a etapa `fixa === 'captura'`, e `admissaoEstimada` é o fim da etapa `fixa === 'admissao'`.
  - `situacaoVaga` e `avisoMeta`: admitida = a etapa `fixa === 'admissao'` foi concluída.

- [ ] **Step 1: Testes que falham:**
  - `etapasDoProjeto` com as 13 padrão (`duracao: null`, `padrao` 1..13) e o cliente com `9 → 5` dá a etapa 9 com 5 e a 2 com 4.
  - Com uma etapa incluída `{ posicao: 12, nome: 'Cadastro no eSocial', duracao: 2, padrao: null, fixa: null }`, as seguintes empurradas (CTPS 13, Treinamento 14), dá 14 etapas, e a 12 é a nova, com 2 dias.
  - Recusa a lista sem `admissao`, a lista com a Captura depois da Admissão e as posições 1, 2, 4.
  - `'previsão com etapa incluída antes da admissão'`: a lista padrão mais "Cadastro em sistema" (1 dia) entre a Ambientação (10) e a Admissão (agora 12), sem conclusões, a partir de 22/10 e com `F = {'2026-11-02','2026-11-15','2026-11-20'}`.
    - Hoje a Ambientação termina em `'2026-11-18'`.
    - A etapa nova é de `'2026-11-19'` a `'2026-11-19'`.
    - A Admissão, que é marco, começa no dia útil seguinte. 20/11 é feriado e 21 e 22 são fim de semana, então `admissaoEstimada === '2026-11-23'`, contra `'2026-11-19'` sem a etapa.
  - `'lista sem Treinamento'`: a conclusão estimada é o fim da CTPS.
  - `situacaoVaga` numa lista em que a Admissão está na posição 12 trata a vaga como admitida só quando a posição 12 foi concluída.
  - Os testes de hoje de `preverVaga` continuam passando com `ETAPAS_PADRAO` (Review Focus 4).
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run src/dominio`. Expected: FAIL.
- [ ] **Step 3: Implementar.** Ajustar `src/test/vagas.ts` aos novos campos.
- [ ] **Step 4: Rodar e ver passar:** `npx vitest run src/dominio`. Expected: PASS. Os erros de tipo fora de `src/dominio` ficam para as Tasks 3 e 4.
- [ ] **Step 5: Commit:** `feat: lista de etapas por projeto no cálculo das previsões`

### Task 2: Banco: lista de etapas por projeto e ações por posição (migração 007)

**Files:**
- Create: `supabase/migrations/20261028000007_etapas_por_projeto.sql`
- Modify: `tests/sql/apoio.ts` (helpers para a lista)
- Test: `tests/sql/etapas.test.ts` (novo); `tests/sql/acoes.test.ts` e `tests/sql/projetos.test.ts` continuam passando

**Interfaces:**
- Produces (SQL, aditivo):
  - `projeto_etapas`:
    - colunas: `id uuid pk default gen_random_uuid()`, `projeto_id uuid not null references projetos on delete cascade`, `posicao smallint not null check (posicao >= 1)`, `nome text not null check (trim(nome) <> '')`, `duracao smallint check (duracao between 0 and 60)`, `padrao smallint references etapas(ordem)`, `fixa text check (fixa in ('captura','admissao'))`;
    - restrições: `unique (projeto_id, posicao) deferrable initially deferred`, `unique (projeto_id, lower(nome))` (índice único), `unique (projeto_id, fixa)` (onde `fixa` não é nula), `check (duracao is not null or padrao is not null)`.
  - **Gatilho** `etapas_do_projeto_novo` (after insert em `projetos`): cria as 13 a partir de `etapas`, com `posicao = padrao = ordem`, `duracao null`, a fixa em 2 e 11 e o nome de `etapas`.
  - **Dados:**
    - para cada projeto existente, as 13 linhas, com `duracao` = o valor em `projeto_duracoes` daquele projeto e ordem, ou `null`;
    - `vaga_conclusoes` ganha `etapa_id uuid references projeto_etapas on delete restrict`, preenchido pela etapa do projeto da vaga com `padrao = ordem`;
    - depois disso, a chave primária vira `(vaga_id, etapa_id)` e `ordem` perde o `not null`.
  - **Gatilho** `etapa_da_conclusao` (before insert em `vaga_conclusoes`): se `etapa_id` vier nulo (código antigo), preenche pela etapa do projeto da vaga com `posicao = new.ordem`.
  - `projeto_aberto` passa a valer em `projeto_etapas`.
  - **RLS em `projeto_etapas`:** leitura com `pode_ver_projeto(projeto_id)`; escrita só pelo RH (`rh_escreve`).
  - **Funções auxiliares** (sem grant para `authenticated`):
    - `posicao_etapa(p_etapa uuid) returns smallint`;
    - `etapa_na_posicao(p_projeto uuid, p_posicao smallint) returns uuid`;
    - `etapa_fixa(p_projeto uuid, p_fixa text) returns projeto_etapas`.
  - `etapa_atual(p_vaga)` = número de conclusões + 1, porque as conclusões são sempre um prefixo.
  - **Reescritas por posição**, com a mesma assinatura e as mesmas mensagens:
    - `concluir_etapa(p_vaga, p_ordem_esperada, p_data)`:
      - `p_ordem_esperada` é posição; recusa `'etapa mudou'` também quando a posição passa do tamanho da lista;
      - grava `etapa_id` e `ordem` (= `padrao` ou `null`);
      - aplica a regra da data antes do início da vaga na posição 1 e a da retomada na posição da `captura`.
    - `desfazer_etapa(p_vaga, p_ordem_esperada)`: apaga a conclusão da etapa naquela posição.
    - `candidato_desistiu(p_vaga)`:
      - `'vaga já admitida'` quando a `admissao` foi concluída;
      - apaga as conclusões de posição ≥ a da `captura`.
    - `importar_vagas(p_projeto, p_vagas)`: `concluidas[].ordem` é posição, convertida em `etapa_id`.
  - **Novas** (security definer, `eh_rh()`, `search_path = public, pg_temp`, grant para `authenticated`):
    - `concluir_etapas(p_vaga uuid, p_ordem_esperada smallint, p_ate smallint, p_data date) returns void`:
      - conclui as posições de `p_ordem_esperada` até `p_ate`, todas com `p_data`, numa única chamada, com a vaga travada;
      - mesmas recusas de `concluir_etapa`, conferidas antes de gravar qualquer conclusão;
      - `p_ate` menor que `p_ordem_esperada` ou maior que o tamanho da lista → `'etapa mudou'`;
      - uma linha de histórico por etapa ("Concluiu <nome>").
    - `incluir_etapa(p_projeto uuid, p_nome text, p_duracao smallint, p_depois_de uuid) returns uuid`:
      - `p_depois_de` nulo = primeira posição;
      - trava o projeto e as vagas dele (`for update`);
      - empurra as posições seguintes e insere a etapa nova (`padrao null`, `fixa null`);
      - para cada vaga do projeto, inclusive as canceladas, que **já chegou ao ponto**, isto é, que concluiu `p_depois_de` (ou toda vaga, quando `p_depois_de` é nulo), insere a conclusão da etapa nova com a data de conclusão de `p_depois_de` (ou a `data_inicio` da vaga) e grava no histórico da vaga `'Etapa <nome> incluída e marcada como concluída'`;
      - grava no registro geral `detalhe {projeto, etapa, depois_de, concluidas_automaticamente: n}`;
      - nome repetido no projeto → `'etapa repetida'`.
    - `excluir_etapa(p_etapa uuid) returns void`:
      - `'etapa obrigatória'` se for fixa;
      - para cada vaga com conclusão dessa etapa, grava no histórico da vaga `'Etapa <nome> excluída'` com `detalhe {concluida_em}` e apaga a conclusão;
      - apaga a etapa, fecha as posições e grava no registro geral `detalhe {projeto, etapa, vagas_com_data: n}`.
    - `renomear_etapa(p_etapa uuid, p_nome text) returns void`: `'etapa obrigatória'` se for fixa, `'etapa repetida'` se o nome se repetir. Grava no registro geral.
    - `mover_etapa(p_etapa uuid, p_para smallint) returns void`:
      - `'projeto tem vagas'` se houver vaga não cancelada;
      - `'ordem das obrigatórias'` se a Captura ficar depois da Admissão;
      - grava no registro geral.
    - `alterar_duracao_etapa(p_etapa uuid, p_dias smallint) returns void`: `p_dias` nulo só é aceito em etapa padrão (volta ao padrão do cliente) e é recusado em etapa incluída com `'duração obrigatória'`. Grava no registro geral, como `alterar_duracao_projeto`.
  - **Para o registro geral:** os `detalhe` das novas funções levam o **nome** do projeto em `detalhe.projeto`, como a `RegistroGeral` já mostra.
- `tests/sql/apoio.ts`: `etapasDoProjeto(c, projetoId): Promise<{ id: string; posicao: number; nome: string; fixa: string | null }[]>` e `concluirAte(c, vagaId, posicao, data)`. Este age como o banco, preenchendo as conclusões direto.

- [ ] **Step 1: Testes que falham** em `tests/sql/etapas.test.ts`, todos com `emTransacao`:
  - `'a 007 dá às vagas reais da Braskem 2027 a lista padrão sem mudar nada'` (Review Focus 4). Antes (`antes`): guarda `(vaga_id, ordem, concluida_em)` de todas as conclusões. Depois:
    - o projeto tem 13 etapas, com nomes e posições iguais a `etapas`;
    - toda conclusão tem `etapa_id` cuja `posicao = ordem`;
    - as datas são as mesmas, e a contagem também.
  - `'projeto novo nasce com as 13 etapas'`.
  - `'incluir etapa não muda vaga que já chegou ao ponto'` (Review Focus 1):
    - projeto com 4 vagas: uma sem conclusões, uma parada na posição 10 (concluiu 1..9), uma parada na 11 (concluiu 1..10) e uma mobilizada (1..13);
    - `incluir_etapa` depois da posição 10 (Ambientação);
    - a primeira e a segunda não ganham conclusão nova;
    - a terceira e a quarta ganham a conclusão da etapa nova com a data da conclusão da posição 10;
    - a etapa atual da terceira passa a ser a posição 12, que é a mesma Admissão;
    - o histórico de cada uma registra a conclusão automática.
  - `'incluir na primeira posição usa a data de início'`.
  - `'excluir etapa guarda as datas no histórico e não deixa buraco'` (Review Focus 2):
    - uma vaga concluiu 1..5, e `excluir_etapa` remove a posição 3;
    - a vaga fica com 4 conclusões, nas posições 1..4;
    - o histórico tem `'Etapa ... excluída'` com a data;
    - uma vaga parada na 3 passa a estar na nova 3.
  - `'fixas não saem nem mudam de nome'`: `excluir_etapa` e `renomear_etapa` na Captura dão `'etapa obrigatória'`.
  - `'mover só sem vagas'`: com uma vaga não cancelada dá `'projeto tem vagas'`; sem vagas, move; colocar a Captura depois da Admissão dá `'ordem das obrigatórias'`.
  - `'concluir_etapas conclui o salto inteiro ou nada'` (Review Focus 3):
    - concluir de 3 a 5 numa data válida grava 3 conclusões e 3 linhas de histórico;
    - com uma data antes da etapa anterior, nada é gravado;
    - uma segunda chamada com a mesma `p_ordem_esperada` dá `'etapa mudou'`.
  - `'desistência volta para a captura onde ela estiver'`: numa lista com uma etapa incluída antes da Captura, a desistência apaga a partir da posição da Captura.
  - `'projeto encerrado recusa mudar a lista'`.
  - `'gestor e cliente não leem lista de projeto não liberado e não escrevem'`.
  - `'código antigo continua concluindo'`: um `insert` em `vaga_conclusoes` só com `ordem` preenche `etapa_id`.
- [ ] **Step 2: Rodar e ver falhar:** `npm run test:sql`. Expected: FAIL.
- [ ] **Step 3: Escrever a 007.**
- [ ] **Step 4: Rodar e ver passar:** `npm run test:sql`. Expected: PASS, com os testes antigos.
- [ ] **Step 5: Commit:** `feat: banco com etapas por projeto, ações por posição e salto de etapas`
- [ ] **Step 6 (com o Joel):**
  1. Conferir, só lendo, que a Braskem 2027 continua com as contagens esperadas.
  2. O Joel roda `npm run db:push` no terminal dele.
  3. O controlador roda `npm run db:tipos`, confere de novo só lendo (13 etapas por projeto, `etapa_id` em todas as conclusões) e commita os tipos (`chore: tipos do banco com etapas por projeto`).
  4. O painel publicado continua funcionando, porque a 007 é compatível.

### Task 3: Leitura e telas que mostram as etapas

**Files:**
- Modify: `src/lib/painel/dados.ts`, `src/app/(painel)/vagas/[id]/acoesVaga.ts`, `src/app/(painel)/projetos/[id]/importar/acoes.ts`, `src/lib/importacao/{ler,modelo}.ts`
- Test: `src/lib/painel/__tests__/dados.test.ts`, `src/lib/importacao/__tests__/ler.test.ts`, `src/app/(painel)/vagas/[id]/__tests__/acoesVaga.test.ts`

**Interfaces:**
- Consumes: `etapasDoProjeto(linhas, doCliente)` (Task 1); as tabelas da Task 2.
- Produces:
  - `LinhasPainel`:
    - troca `etapas` e `projetoDuracoes` por `projetoEtapas: { id; projeto_id; posicao; nome; duracao; padrao; fixa }[]`;
    - as `conclusoes` vêm com `etapa_id`;
    - `montarPainel` converte `etapa_id` em `ordem` (a posição) pela lista do projeto;
    - `carregarPainel` devolve `etapas` = a lista efetiva do projeto.
  - `carregarProjetos` e `carregarPainel` não leem mais `projeto_duracoes` nem `vaga_conclusoes.ordem`.
  - `concluirEtapas(vagaId: string, ordemEsperada: number, ate: number, data: string): Promise<Resposta>` em `acoesVaga.ts`:
    - chama `concluir_etapas`;
    - `concluirEtapa` passa a chamá-la com `ate = ordemEsperada`;
    - as mensagens são as de hoje, mais `['etapa obrigatória', 'Esta etapa é obrigatória e não pode ser excluída nem renomeada.']`.
  - **Importação:**
    - o modelo e o leitor já usam `ctx.etapas`; garantir que vêm da lista do projeto;
    - uma coluna de etapa que não existe na lista dá o erro `'Coluna desconhecida: {nome}. Baixe o modelo de novo.'` (Review Focus 5);
    - a falta de uma coluna de etapa dá `'Falta a coluna {nome}. Baixe o modelo de novo.'`.
  - Quadro, Atenção, Resumo e detalhe da vaga já usam `previsao.etapas`, `ordem` e `nome`. Só confirmar que não sobrou referência às 13 fixas.

- [ ] **Step 1: Testes que falham:**
  - `montarPainel` com a lista padrão e as conclusões por `etapa_id` dá as mesmas previsões e cores do teste atual (Review Focus 4).
  - Com uma lista de 14 etapas (uma incluída), a vaga tem 14 etapas previstas, e uma conclusão da etapa nova cai na posição certa.
  - O leitor com uma planilha que tem a coluna "Treinamento", num projeto que excluiu o Treinamento, dá `'Coluna desconhecida: Treinamento. Baixe o modelo de novo.'` e não importa nada.
  - O leitor com o modelo de um projeto de 14 etapas lê a conclusão da etapa nova.
  - `acoesVaga`: `concluirEtapas('v', 3, 5, '2026-10-28')` chama o rpc `concluir_etapas` com `{ p_vaga: 'v', p_ordem_esperada: 3, p_ate: 5, p_data: '2026-10-28' }`.
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar:** `npm test && npm run typecheck && npm run lint`. Expected: PASS, exceto os erros de tipo da tela de durações em `configurar/`, que a Task 4 reescreve. Anotar quais são.
- [ ] **Step 5: Commit:** `feat: painel, resumo, detalhe e importação seguem as etapas do projeto`

### Task 4: Configurar → bloco "Etapas"

**Files:**
- Create: `src/app/(painel)/projetos/[id]/configurar/EtapasProjeto.tsx`, que substitui `DuracoesProjeto.tsx` (apagar este e o teste dele)
- Modify: `src/app/(painel)/projetos/[id]/configurar/page.tsx`, `src/app/(painel)/projetos/[id]/configurar/acoesConfigurar.ts`
- Test: `src/app/(painel)/projetos/[id]/configurar/__tests__/EtapasProjeto.test.tsx`

**Interfaces:**
- Consumes: as funções SQL da Task 2; `ROTULO`s de hoje; `useEnvio`; o padrão de `PainelLateral`.
- Produces:
  - **Actions em `acoesConfigurar.ts`**, todas com `exigirRh()`, `revalidatePath('/', 'layout')` e retorno `RespostaAcao`:
    - `incluirEtapa(projetoId, entrada: { nome; duracao; depoisDe: string /* id ou '' */ })`;
    - `excluirEtapa(projetoId, etapaId)`;
    - `renomearEtapa(projetoId, etapaId, entrada: { nome })`;
    - `moverEtapa(projetoId, etapaId, para: number)`;
    - `alterarDuracaoEtapa(projetoId, etapaId, entrada: { duracao })`, onde vazio = voltar ao padrão.
    - Sai `alterarDuracaoProjeto`.
  - **Mensagens:**
    - `'etapa obrigatória'` → "Esta etapa é obrigatória e não pode ser excluída nem renomeada.";
    - `'etapa repetida'` → "Já existe uma etapa com este nome no projeto.";
    - `'projeto tem vagas'` → "A ordem das etapas só muda antes de o projeto ter vagas.";
    - `'ordem das obrigatórias'` → "A Captura de Mercado precisa vir antes da Admissão Timenow.";
    - `'duração obrigatória'` → "Informe a duração desta etapa.";
    - `'projeto encerrado'` → como hoje.
  - **`EtapasProjeto({ projetoId, cliente, etapas, temVagas, somenteLeitura })`:**
    - `etapas: { id; ordem; nome; fixa; padraoCliente: number | null; duracao: number | null; concluidasPor: number; chegaramAoPonto: number }[]`;
    - seção com o título **"Etapas"**, com uma linha por etapa: `"{ordem}. {nome}"`, a marca "obrigatória" nas fixas, a coluna "Padrão {cliente}" (vazia nas etapas incluídas), o campo "Neste projeto" e as ações;
    - **Ações por linha** (nome acessível com o nome da etapa):
      - "Salvar";
      - "Voltar ao padrão", só em etapa padrão ajustada;
      - "Renomear" e "Excluir", fora das fixas;
      - "Subir" e "Descer", só sem vagas.
    - **"Excluir"** abre uma confirmação na própria linha: "Excluir {nome}? {concluidasPor} vagas já concluíram esta etapa; essas datas ficam no histórico de cada vaga." Os botões são "Excluir etapa" e "Cancelar".
    - **"+ Incluir etapa"** abre um `PainelLateral` com:
      - os campos Nome, Duração (dias úteis) e "Depois de", um `Selecao` com "No início" e cada etapa;
      - com vagas, o aviso "{n} vagas já passaram deste ponto e vão ficar com a etapa concluída automaticamente.", calculado na tela a partir de `chegaramAoPonto` da etapa escolhida.
    - Com `somenteLeitura`, só a tabela, sem ações.
  - **A página** monta `etapas` a partir de `carregarPainel` (lista efetiva) e de `projeto_etapas`. `concluidasPor` e `chegaramAoPonto` vêm da contagem das conclusões das vagas do projeto: `chegaramAoPonto` da etapa X é o número de vagas que concluíram X.

- [ ] **Step 1: Testes que falham:**
  - As fixas mostram "obrigatória" e não têm "Excluir" nem "Renomear".
  - "Excluir Treinamento" mostra a confirmação com "3 vagas já concluíram esta etapa", e "Excluir etapa" chama `excluirEtapa('p1', '<id>')`.
  - Com `temVagas`, não há "Subir" nem "Descer"; sem vagas, "Descer Triagem de Candidatos" chama `moverEtapa('p1', '<id>', 4)`.
  - Incluir depois de "Ambientação/TBS", que tem `chegaramAoPonto: 2`, mostra "2 vagas já passaram deste ponto…" e chama `incluirEtapa('p1', { nome: 'Cadastro no eSocial', duracao: '2', depoisDe: '<id>' })`.
  - "Voltar ao padrão Exames" chama `alterarDuracaoEtapa('p1', '<id>', { duracao: '' })`.
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar:** `npm test && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: RH monta a lista de etapas do projeto no Configurar`

### Task 5: Arrastar o cartão no quadro (só RH)

**Files:**
- Modify: `src/app/(painel)/projetos/[id]/Quadro.tsx`, `src/app/(painel)/projetos/[id]/CartaoVaga.tsx`, `src/app/(painel)/projetos/[id]/page.tsx`
- Create: `src/app/(painel)/projetos/[id]/ConfirmarAvanco.tsx`
- Test: `src/app/(painel)/projetos/[id]/__tests__/Quadro.test.tsx`, `src/app/(painel)/projetos/[id]/__tests__/ConfirmarAvanco.test.tsx`

**Interfaces:**
- Consumes: `concluirEtapas` (Task 3), `hojeSP`.
- Produces:
  - **`Quadro({ vagas, etapas, podeArrastar })`:**
    - `podeArrastar = rh && !projeto.encerrado`;
    - o arraste usa a Drag and Drop API do HTML (`draggable`, `onDragStart`, `onDragOver`, `onDrop`), sem biblioteca;
    - só vale com ponteiro fino, `matchMedia('(pointer: fine)')`. Sem ponteiro fino, nada é arrastável;
    - sem `podeArrastar`, o cartão continua um link comum, sem `draggable`.
  - **Soltar** o cartão de uma vaga na etapa atual A sobre a coluna B:
    - `B > A` → abre `ConfirmarAvanco`;
    - `B ≤ A`, ou a coluna Mobilizadas com a vaga já mobilizada → nada acontece;
    - a coluna Mobilizadas vale como `B = N` (última posição) e conclui tudo o que falta.
  - **`ConfirmarAvanco({ vaga, de, ate, etapas, aoFechar })`:**
    - painel na própria tela (`role="dialog"`, `aria-modal`, foco no primeiro campo, Esc fecha);
    - o texto lista as etapas: "Concluir 2 etapas: Entrevista - Timenow e Entrevista - TNGO/Braskem", ou "Concluir Entrevista - Timenow" quando é uma só;
    - o campo Data vem com hoje;
    - os botões são "Concluir" e "Cancelar";
    - chama `concluirEtapas(vaga.id, de, ate, data)`;
    - mostra o erro em `role="alert"` e, em caso de sucesso, faz `router.refresh()`.

- [ ] **Step 1: Testes que falham:**
  - Com `podeArrastar: false`, nenhum cartão tem `draggable="true"`.
  - Com `podeArrastar: true` (e `matchMedia` simulado como fino), soltar o cartão da etapa 4 na coluna 6 abre a confirmação com "Concluir 2 etapas: Entrevista - Timenow e Entrevista - TNGO/Braskem".
  - Soltar na própria coluna ou numa anterior não abre nada.
  - `ConfirmarAvanco`: "Concluir" chama `concluirEtapas('v1', 4, 5, '<hoje>')`. O erro `'Esta vaga mudou enquanto você olhava. Atualize a página.'` aparece em `role="alert"`.
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar:** `npm test && npm run typecheck && npm run lint && npm run build`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: RH avança vagas arrastando o cartão no quadro`

### Task 6: Limpeza (migração 008) e publicação

**Files:**
- Create: `supabase/migrations/20261028000008_limpeza_etapas.sql`
- Modify: `tests/sql/etapas.test.ts`, `README.md` (uma linha sobre etapas por projeto e o arraste)

**Interfaces:**
- Produces (SQL da 008, só depois do código novo publicado):
  - `vaga_conclusoes.etapa_id` passa a `not null`, e sai `vaga_conclusoes.ordem`;
  - sai o gatilho `etapa_da_conclusao`;
  - sai a tabela `projeto_duracoes`, com o gatilho `projeto_aberto` dela;
  - sai a função `alterar_duracao_projeto`;
  - o laço do `search_path` se repete.
  - `concluir_etapa` e `desfazer_etapa` ficam como estão.
  - **Auto-reparo antes do `not null`:** preenche `etapa_id` nulo pela posição, como o gatilho faz.

- [ ] **Step 1: Teste que falha:** `'depois da limpeza toda conclusão tem etapa'` (a coluna `ordem` não existe; `projeto_duracoes` não existe).
- [ ] **Step 2: Rodar e ver falhar:** `npm run test:sql`. Expected: FAIL.
- [ ] **Step 3: Escrever a 008.**
- [ ] **Step 4: Rodar e ver passar:** `npm test && npm run test:sql && npm run typecheck && npm run lint && npm run build`. Expected: PASS.
- [ ] **Step 5: Commit:** `chore: limpeza das etapas fixas`
- [ ] **Step 6 (com o Joel):**
  1. Confirmar que a 007 está em produção.
  2. Com o OK do Joel, `git push origin main`, e esperar a Vercel.
  3. O Joel confere a aba Configurar (bloco Etapas) e arrasta um cartão de teste, que pode desfazer depois.
  4. Conferir, só lendo, que não há conclusão sem `etapa_id`.
  5. O Joel roda `npm run db:push` (008); o controlador roda `npm run db:tipos`, conclui `typecheck` e commita.
