# Plano 5: Edição de vagas em grupo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Execução escolhida pelo Joel:** sem agentes, direto na sessão (executing-plans), com um revisor no fim.

**Goal:** No Configurar → Vagas, a equipe filtra e marca várias vagas e, numa ação só, avança a mesma etapa, troca a meta (ou a onda) ou troca a data de início. A ação vale para todas as vagas ou para nenhuma.

**Architecture:**
- **Banco (migração 010):** duas funções novas recebem a lista de vagas.
  - `concluir_etapa_em_grupo` chama a `concluir_etapas` de cada vaga.
  - `alterar_vagas_em_grupo` chama a `salvar_vaga` de cada vaga, com o campo trocado.
  - Isso reaproveita todas as regras, travas, permissões e o histórico que já existem. Qualquer erro aborta a transação inteira, e a mensagem diz qual vaga travou.
- **App:**
  - funções puras de seleção;
  - duas actions;
  - a tela de vagas do Configurar ganha filtros, caixas de seleção e uma barra de ações.

**Tech Stack:** Next.js 15.5, React 19.1, TypeScript, Tailwind 4, Supabase (Postgres, RLS), zod 4, Vitest com Testing Library, `pg` nos testes de SQL.

**Spec:** `docs/superpowers/specs/2026-10-29-edicao-de-vagas-em-grupo-design.md`

## Global Constraints

- Código, textos, nomes e comentários em pt-BR, no estilo do código atual: aspas simples, sem ponto e vírgula. Sem travessão nos textos de tela. Controles repetidos por linha têm nome acessível por linha.
- **O `.env.local` aponta para o banco de produção.** Testes de banco só em `tests/sql`, com `emTransacao`. O Joel roda o `npm run db:push`. O `git push` só com o OK dele.
- **Só a equipe** (`ehEquipe`) vê a seleção. O banco confere com `exigir_projeto`. **Projeto encerrado:** sem seleção.
- **Tudo ou nada:** uma vaga recusada aborta o grupo inteiro. A exceção é o "Trocar início", que **pula** as vagas com qualquer etapa concluída e informa quantas foram puladas.
- **Avançar** exige que todas as vagas estejam na mesma etapa atual (`ordem`).

## Review Focus

1. **Uma vaga do grupo com data de conclusão anterior mais tarde que a data escolhida:** nada muda, e a mensagem nomeia a vaga e o motivo. → Task 1 (SQL) e Task 2 (mapeamento).
2. **Um id de vaga de outro projeto no meio da lista**, por chamada direta ao banco: recusado, sem mudar nenhuma vaga. → Task 1.
3. **Trocar início com vagas mistas:** só mudam as vagas sem nenhuma conclusão. As outras ficam iguais, e o retorno conta as puladas. → Task 1.
4. **Selecionar todas com um filtro ativo:** marca só as vagas do filtro, nunca canceladas nem mobilizadas. → Task 2.

---

### Task 1: Banco: ações em grupo (migração 010)

**Files:**
- Create: `supabase/migrations/20261029000010_vagas_em_grupo.sql`
- Test: `tests/sql/grupo.test.ts`

**Interfaces:**
- `concluir_etapa_em_grupo(p_vagas uuid[], p_ordem_esperada smallint, p_data date) returns int`:
  - recusa uma lista vazia com `'nenhuma vaga'`;
  - todas as vagas precisam existir e ser do mesmo projeto, senão `'vagas de projetos diferentes'`;
  - `perform exigir_projeto(projeto)`;
  - para cada vaga, na ordem de `p_vagas`, `perform concluir_etapas(v, p_ordem_esperada, p_ordem_esperada, p_data)`. Um erro vira `raise exception 'vaga %: %', v, sqlerrm` e aborta tudo;
  - devolve o número de vagas.
- `alterar_vagas_em_grupo(p_vagas uuid[], p_campo text, p_valor text) returns jsonb`:
  - `p_campo` aceita `'onda_id'`, `'meta'` e `'data_inicio'`. Outro valor dá `'campo inválido'`;
  - as mesmas checagens de lista vazia, de mesmo projeto e de `exigir_projeto`;
  - para cada vaga, lê a linha atual, monta o `jsonb` que a `salvar_vaga` espera (`funcao, disciplina, area, onda_id, meta, gestor_id, candidato, data_inicio`) com o campo trocado e chama `perform salvar_vaga(v, p)`;
  - um erro vira `'vaga %: %'`, como acima;
  - com `'data_inicio'`, pula as vagas que têm qualquer `vaga_conclusoes`;
  - recusa vagas canceladas com `'vaga cancelada'`;
  - devolve `{"alteradas": n, "puladas": k}`.
- As duas são `security definer set search_path = public, pg_temp`, com revoke de `public` e `anon` e grant para `authenticated`. O laço do `search_path` se repete no fim.

- [ ] **Step 1: Testes que falham** (`emTransacao`, um projeto com 3 vagas paradas na etapa 1, como RH ou Analista com acesso):
  - `'concluir em grupo conclui a mesma etapa em todas'`: 3 conclusões na posição 1 e 3 linhas de histórico "Concluiu Abertura de vaga".
  - `'uma vaga com data antes do início aborta o grupo'` (Review Focus 1): numa das vagas, `data_inicio` vem depois da data escolhida. O erro começa com `vaga <id da vaga>:` e contém `'data antes do início da vaga'`, e nenhuma vaga ganha conclusão.
  - `'vaga de outro projeto é recusada'` (Review Focus 2): dá `'vagas de projetos diferentes'`, e nada muda.
  - `'analista sem acesso não altera em grupo'`: dá `'sem permissão'`.
  - `'trocar meta em grupo'`: num projeto por meta, as 3 vagas ficam com a meta nova, e cada uma tem "Editou a vaga" no histórico.
  - `'trocar onda em grupo'`: num projeto por ondas, as vagas vão para a outra onda. Uma onda de outro projeto dá erro com o prefixo `vaga `.
  - `'trocar início pula quem já concluiu etapa'` (Review Focus 3): com 1 das 3 vagas com a etapa 1 concluída, o retorno é `{alteradas: 2, puladas: 1}`, e a vaga pulada mantém a data.
  - `'campo inválido'` e `'nenhuma vaga'`.
- [ ] **Step 2: Rodar e ver falhar:** `npm run test:sql`. Expected: FAIL.
- [ ] **Step 3: Escrever a 010.**
- [ ] **Step 4: Rodar e ver passar:** `npm run test:sql`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: banco com ações em grupo nas vagas`
- [ ] **Step 6 (com o Joel):** o Joel roda `npm run db:push`. Depois, `npm run db:tipos` e commit dos tipos.

### Task 2: Seleção e actions

**Files:**
- Create: `src/lib/validacao/mensagens.ts` (o `MENSAGENS` sai de `acoesVaga.ts` e vai para cá, com `traduzirErro(mensagem: string, padrao: string): string`), `src/app/(painel)/projetos/[id]/configurar/selecao.ts`
- Modify: `src/app/(painel)/vagas/[id]/acoesVaga.ts` (passa a importar as mensagens), `src/app/(painel)/projetos/[id]/configurar/acoesConfigurar.ts`
- Test: `src/app/(painel)/projetos/[id]/configurar/__tests__/selecao.test.ts`, `src/app/(painel)/projetos/[id]/configurar/__tests__/acoesGrupo.test.ts`

**Interfaces:**
- `selecao.ts` (funções puras):
  - `type VagaSelecionavel = { id: string; funcao: string; ondaId: string | null; etapaAtual: number | null; concluiuAlguma: boolean; cancelada: boolean }`;
  - `type FiltroSelecao = { funcao?: string; onda?: string; etapa?: number }`;
  - `selecionaveis(vagas, filtro): VagaSelecionavel[]`: tira as canceladas e as mobilizadas (`etapaAtual === null`) e aplica o filtro. A função é comparada com `chaveFuncao`;
  - `etapaComum(selecionadas): number | null`: a etapa atual em comum, ou `null` se forem diferentes ou se a lista estiver vazia;
  - `puladasNoInicio(selecionadas): number`: quantas têm `concluiuAlguma`.
- **Actions**, em `acoesConfigurar.ts` (`exigirEquipe()` e `revalidatePath('/', 'layout')`):
  - `avancarEmGrupo(projetoId: string, vagaIds: string[], ordem: number, data: string): Promise<RespostaGrupo>`;
  - `alterarEmGrupo(projetoId: string, vagaIds: string[], campo: 'onda_id' | 'meta' | 'data_inicio', valor: string): Promise<RespostaGrupo>`;
  - `type RespostaGrupo = { ok: true; alteradas: number; puladas: number; foraDaMeta: number } | { ok: false; erro: string; vagaId: string | null }`.
  - **Validação:** os ids são uuid, a lista não pode ser vazia, e a data passa por `dataValida`.
  - **Erro:** uma mensagem `'vaga <uuid>: <motivo>'` vira `vagaId` + `traduzirErro(motivo, ...)`. `'sem permissão'` vira "Você não tem acesso a este projeto.".
  - **`foraDaMeta`:** depois do sucesso, `carregarPainel` conta, entre as vagas do grupo, quantas têm `avisoMeta(previsao, meta) !== null`.

- [ ] **Step 1: Testes que falham:**
  - `selecionaveis` com 4 vagas (1 cancelada, 1 mobilizada, 2 de "Técnico de Campo" e "técnico de campo ") e o filtro `{ funcao: 'Técnico de Campo' }` dá as 2 (Review Focus 4).
  - `etapaComum` dá 3 para `[3, 3]` e `null` para `[3, 4]`.
  - `puladasNoInicio` conta as vagas com `concluiuAlguma`.
  - `avancarEmGrupo` com um rpc falso que devolve o erro `'vaga 1111…: data antes da etapa anterior'` dá `{ ok: false, vagaId: '1111…', erro: 'A data não pode ser antes da conclusão da etapa anterior.' }`.
  - `alterarEmGrupo` repassa `{ p_vagas, p_campo: 'meta', p_valor }` e devolve `alteradas` e `puladas` do `jsonb`.
  - Uma lista vazia dá erro sem chamar o rpc.
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar:** `npm test && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: seleção de vagas e ações em grupo no servidor`

### Task 3: Tela de vagas com seleção

**Files:**
- Modify: `src/app/(painel)/projetos/[id]/configurar/VagasProjeto.tsx`, `src/app/(painel)/projetos/[id]/configurar/page.tsx`
- Create: `src/app/(painel)/projetos/[id]/configurar/AcoesEmGrupo.tsx`
- Test: `src/app/(painel)/projetos/[id]/configurar/__tests__/VagasProjeto.test.tsx`, `src/app/(painel)/projetos/[id]/configurar/__tests__/AcoesEmGrupo.test.tsx`

**Interfaces:**
- **A página** passa para cada `VagaProjeto`:
  - `etapaAtual: number | null` e `etapaNome: string | null`, vindos de `painel.vagas`, pelo id;
  - `concluiuAlguma: boolean`;
  - as `etapas` do projeto, com `ordem` e `nome`, para o filtro.
- **`VagasProjeto`:**
  - **Filtros** acima da tabela: Função (todas + as funções ativas), Onda (só em projeto por ondas) e Etapa atual (todas + as etapas). É estado local, não vai para o endereço;
  - **Seleção:** uma coluna com uma caixa por vaga selecionável (`aria-label` "Selecionar {funcao} · {disciplina}{ · candidato}"), "Selecionar todas ({n})" e "Limpar seleção";
  - ao mudar o filtro, as vagas marcadas que saíram do filtro são desmarcadas;
  - **Barra:** com `somenteLeitura`, nada disso aparece. Com seleção, aparece `AcoesEmGrupo`.
- **`AcoesEmGrupo({ projetoId, organizacao, selecionadas, ondas, etapaNome, rotuloDe })`:**
  - o título é "{n} vagas selecionadas" (singular para 1);
  - **"Avançar etapa":** desabilitado com a dica "Para avançar juntas, as vagas precisam estar na mesma etapa." quando `etapaComum` for nula. Abre um painel com "Concluir {etapa} em {n} vagas", a data (hoje), "Concluir" e "Cancelar";
  - **"Trocar meta"** (projeto `meta`), com um campo de data, ou **"Trocar onda"** (projeto `ondas`), com um `Selecao` das ondas. O botão é "Aplicar";
  - **"Trocar início":** campo de data e o aviso "{k} das vagas selecionadas já passaram da primeira etapa e ficam de fora." quando k > 0;
  - **Resultado:**
    - em caso de sucesso, a mensagem `role="status"` "{n} vagas alteradas.", com " {k} ficaram de fora." e " {m} ficaram com a admissão prevista depois da meta." quando houver, limpa a seleção e chama `router.refresh()`;
    - em caso de erro, `role="alert"` com "{rotuloDe(vagaId)}: {erro}", ou só o erro;
  - enquanto estiver pendente, os botões ficam desabilitados.

- [ ] **Step 1: Testes que falham:**
  - "Selecionar todas" com o filtro de função "Técnico de Campo" marca só essas vagas e mostra "2 vagas selecionadas".
  - Com vagas em etapas diferentes, "Avançar etapa" fica desabilitado e a dica aparece.
  - "Concluir" chama `avancarEmGrupo('p1', [ids], 2, '<hoje>')`.
  - Em projeto `ondas` aparece "Trocar onda", e não "Trocar meta".
  - O aviso de "ficam de fora" aparece com uma vaga que já concluiu alguma etapa.
  - Um erro com `vagaId` mostra o rótulo da vaga.
  - Com `somenteLeitura`, nenhuma caixa de seleção aparece.
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar:** `npm test && npm run typecheck && npm run lint && npm run build`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: seleção e ações em grupo nas vagas do Configurar`

### Task 4: Revisão e publicação

- [ ] **Step 1:** Um revisor (um único agente, no fim) lê o branch inteiro contra o desenho.
- [ ] **Step 2:** Corrigir o que ele apontar. Rodar `npm test && npm run test:sql && npm run typecheck && npm run lint && npm run build`.
- [ ] **Step 3 (com o Joel):** OK para `git push origin main`. Depois, o Joel testa no projeto Braskem 2027, marcando 2 vagas e trocando o início, por exemplo.
