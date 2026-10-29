# Plano 4: Perfil Analista de RH e Administrador

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o perfil **Analista de RH**, que opera como o RH só nos projetos liberados para ele e pode criar projetos, e mostrar o perfil `rh` como **Administrador**.

**Architecture:**
- **Valores do perfil:** o valor `rh` continua no banco e passa a ser exibido como "Administrador". Entra o valor `analista`.
- **Permissão de escrita por projeto:** uma função nova, `pode_alterar_projeto(projeto)`, é verdadeira para o Administrador e para um Analista ativo com acesso ao projeto. Ela substitui `eh_rh()` em toda função de escrita que atua sobre um projeto. O que é de fora de projeto (clientes, gestores, usuários, feriados, registro geral) continua com `eh_rh()`.
- **Leituras gerais do Analista:** passam por funções `security definer` que devolvem só o necessário, sem e-mail.
- **Migração:** uma só, a **009**, compatível com o código no ar, porque para quem é `rh` nada muda. Não há migração de limpeza.

**Tech Stack:** Next.js 15.5, React 19.1, TypeScript, Tailwind 4, Supabase (Postgres, RLS), zod 4, Vitest com Testing Library, `pg` nos testes de SQL.

**Spec:** `docs/superpowers/specs/2026-10-28-perfil-analista-de-rh-design.md`. As regras dos specs anteriores continuam valendo.

## Global Constraints

- Código, textos, nomes e comentários em pt-BR, no estilo do código atual: aspas simples, sem ponto e vírgula. Sem travessão nos textos de tela. Botões repetidos por linha têm nome acessível por linha.
- **O `.env.local` aponta para o banco de produção.** Testes de banco só em `tests/sql`, com `emTransacao`. O Joel roda o `npm run db:push`. O `git push` só com o OK dele.
- **Perfis no banco:** `rh` (rótulo "Administrador"), `analista` (rótulo "Analista de RH"), `gestor` (rótulo "Gestor Timenow") e `cliente` (rótulo "Cliente").
- **Quem pode alterar um projeto:** `pode_alterar_projeto(p)` = `eh_rh()` ou (perfil `analista`, ativo, e existe `projeto_acessos` para p e o usuário).
  - Vale para toda escrita sobre um projeto, suas vagas, ondas, etapas, conclusões e acessos.
  - O que é de fora de projeto continua só com `eh_rh()`: clientes e as durações deles, gestores, usuários, feriados e o registro geral.
- **O Analista não vê nada de projeto não liberado**, por nenhum caminho: RLS, função ou tela.
- **Acessos que o Analista pode mexer:**
  - libera e remove só usuários `gestor` e `cliente` (este, do cliente do projeto);
  - não mexe em acesso de `analista` nem de `rh`, inclusive no próprio;
  - a regra vale **no banco**.
- **Projeto criado por um Analista** já nasce com o acesso dele, na mesma transação.
- O histórico mostra o **nome**, nunca o e-mail. O Analista não recebe e-mail de ninguém.

## Review Focus

1. **Analista abrindo o endereço de um projeto, vaga, importação ou modelo de outro projeto** (link repassado): "não encontrado", e nenhuma escrita passa. → testes de RLS e de funções na Task 1, e de rotas na Task 3.
2. **Analista chamando direto, pelo banco, uma função de escrita com o id de um projeto que não é dele** (`concluir_etapas`, `salvar_vaga`, `incluir_etapa`, `importar_vagas`, `salvar_onda_projeto`, `encerrar_projeto`): recusado com `'sem permissão'`. → Task 1.
3. **Analista tentando liberar o próprio acesso para outro Analista, ou remover o próprio acesso:** recusado pelo banco. → Task 1.
4. **Um Analista vira Gestor, ou é desativado:** deixa de conseguir alterar na hora, e os acessos que sobram são só de leitura (ou nenhum, se desativado). → Task 1.
5. **Analista criando um projeto:** consegue abrir e configurar o projeto logo em seguida, sem passar pelo Administrador. → Task 1 (banco) e Task 3 (tela).

---

### Task 1: Banco: perfil analista e permissão por projeto (migração 009)

**Files:**
- Create: `supabase/migrations/20261028000009_perfil_analista.sql`
- Modify: `tests/sql/apoio.ts` (`comoUsuario` aceita `'analista'`; um helper `liberar(c, projetoId, usuarioId)`)
- Test: `tests/sql/analista.test.ts` (novo); os testes atuais continuam passando

**Interfaces:**
- Produces (SQL):
  - `usuarios_perfil_check` passa a aceitar `('rh','analista','gestor','cliente')`.
  - `eh_analista() returns boolean` (security definer): perfil `analista` e ativo.
  - `pode_alterar_projeto(p uuid) returns boolean` (security definer, `stable`), como nas Global Constraints. Um `p` nulo dá falso.
  - **Funções reescritas** (`create or replace`, mesma assinatura e mesmas mensagens), trocando `eh_rh()` por `pode_alterar_projeto(<projeto da linha>)`. Antes de reescrever, ler a definição viva de cada uma nas migrações 002 a 008:
    - `travar_vaga_rh`: acha o projeto da vaga;
    - `travar_etapa_rh`: acha o projeto da etapa;
    - `concluir_etapas`, `concluir_etapa`, `desfazer_etapa`, `candidato_desistiu`: passam por `travar_vaga_rh`, conferir;
    - `salvar_vaga`: na criação, `p->>'projeto_id'`; na edição, o projeto da vaga;
    - `cancelar_vaga`, `importar_vagas`, `salvar_onda_projeto`, `encerrar_projeto`, `reabrir_projeto`;
    - `incluir_etapa`, `excluir_etapa`, `renomear_etapa`, `mover_etapa`, `alterar_duracao_etapa`.
  - **`salvar_projeto`:**
    - na **criação**, aceita `eh_rh() or eh_analista()`. Quando quem cria é Analista, insere na mesma função `projeto_acessos (projeto, o próprio usuarios.id)`;
    - na **edição**, exige `pode_alterar_projeto(p_id)`.
  - **`conferir_acesso`** (gatilho em `projeto_acessos`):
    - aceita usuário alvo com perfil `analista` (hoje só recusa o `rh`);
    - quando quem age é Analista (`eh_analista() and not eh_rh()`), recusa com `'analista não libera este perfil'` se o alvo for `analista` ou `rh`;
    - vale também no `delete`. Isso impede o Analista de remover o próprio acesso ou o de outro Analista.
    - O acesso que a própria `salvar_projeto` cria passa, porque a função é `security definer` e a liberação do criador é feita por ela. O builder escolhe como distinguir esse caso, por exemplo um `set_config` local na transação ou fazer a regra comparar com o dono da sessão.
  - **RLS de `projeto_acessos`:**
    - leitura: `eh_rh()`, ou o próprio usuário, ou `pode_alterar_projeto(projeto_id)`;
    - escrita (`insert`/`delete`): `pode_alterar_projeto(projeto_id)`, além do `rh_escreve` de hoje.
  - **RLS de `clientes`:** a leitura passa a aceitar `eh_analista()`, para o Analista ver o nome de todos os clientes ao criar um projeto.
  - **`acessos_do_usuario`:** quando o perfil vira `rh`, apaga tudo, como hoje. Para `analista`, mantém.
  - **Novas funções de leitura** (security definer, grant para `authenticated`):
    - `pessoas_liberaveis(p_projeto uuid) returns table (id uuid, nome text, perfil text, cliente_id uuid)`: exige `pode_alterar_projeto(p_projeto)`. Devolve os usuários ativos que quem chama pode liberar naquele projeto:
      - para o Administrador: `gestor`, `analista` e os `cliente` do cliente do projeto;
      - para o Analista: `gestor` e os `cliente` do cliente do projeto.
    - `pessoas_do_projeto(p_projeto uuid) returns table (id uuid, nome text, perfil text)`: exige `pode_alterar_projeto(p_projeto)` e devolve quem tem acesso ao projeto, sem e-mail.
  - O laço do `search_path` se repete no fim.

- [ ] **Step 1: Testes que falham** em `tests/sql/analista.test.ts`, todos com `emTransacao`:
  - `'analista vê só os projetos liberados'` (Review Focus 1):
    - dois projetos, e o Analista com acesso só ao primeiro;
    - ele lê 1 projeto, só as vagas, ondas e etapas dele;
    - `historico` com `vaga_id null` vem vazio;
    - `projeto_acessos` traz só as linhas do projeto dele.
  - `'analista altera o projeto dele e não o dos outros'` (Review Focus 2):
    - `concluir_etapas`, `salvar_vaga` (criação e edição), `incluir_etapa`, `importar_vagas`, `salvar_onda_projeto` e `encerrar_projeto` passam no projeto dele;
    - no outro projeto, cada uma dá `'sem permissão'`.
  - `'analista cria projeto e já tem acesso'` (Review Focus 5): `salvar_projeto` sem id, como Analista, cria o projeto, e `projeto_acessos` tem a linha dele. Ele consegue chamar `incluir_etapa` no projeto novo.
  - `'analista libera gestor e cliente, não analista'` (Review Focus 3):
    - liberar um `gestor` passa;
    - liberar um `cliente` de outro cliente dá `'cliente diferente'`;
    - liberar outro `analista` dá `'analista não libera este perfil'`;
    - remover o próprio acesso dá o mesmo erro.
  - `'administrador libera analista'`: como `rh`, liberar um Analista num projeto passa.
  - `'analista que vira gestor perde a escrita, desativado perde tudo'` (Review Focus 4):
    - depois de `update usuarios set perfil = 'gestor'`, `concluir_etapas` dá `'sem permissão'`, mas a leitura do projeto continua;
    - com `ativo = false`, a leitura volta vazia.
  - `'analista não escreve em cadastros gerais'`: `salvar_cliente`, `alterar_duracao_cliente`, insert em `gestores` e insert em `feriados` são recusados.
  - `'analista lê todos os clientes, mas não as durações de cliente sem projeto dele'`.
  - `'pessoas_liberaveis e pessoas_do_projeto':`
    - para o Analista, não incluem `analista` nem `rh` entre os liberáveis;
    - não têm coluna de e-mail;
    - num projeto que não é dele dão `'sem permissão'`.
- [ ] **Step 2: Rodar e ver falhar:** `npm run test:sql`. Expected: FAIL.
- [ ] **Step 3: Escrever a 009.**
- [ ] **Step 4: Rodar e ver passar:** `npm run test:sql`. Expected: PASS, com todos os testes antigos.
- [ ] **Step 5: Commit:** `feat: banco com perfil Analista de RH e permissão de escrita por projeto`
- [ ] **Step 6 (com o Joel):** o Joel roda `npm run db:push`. O controlador roda `npm run db:tipos`, confere só lendo que os 2 usuários `rh` continuam `rh` e commita os tipos.

### Task 2: Perfis, rótulos e acessos no servidor

**Files:**
- Modify: `src/lib/auth/perfil.ts`, `src/lib/cadastros/usuarios.ts`, `src/lib/cadastros/acessos.ts`, `src/middleware.ts` (só o comentário)
- Test: `src/lib/cadastros/__tests__/{usuarios,acessos}.test.ts`, `src/lib/auth/__tests__/perfil.test.ts` (novo, para as funções puras)

**Interfaces:**
- Produces:
  - `type Perfil = 'rh' | 'analista' | 'gestor' | 'cliente'`. `PerfilUsuario` passa a ser o mesmo tipo, sem duplicar.
  - `ROTULO_PERFIL = { rh: 'Administrador', analista: 'Analista de RH', gestor: 'Gestor Timenow', cliente: 'Cliente' }`.
  - `ehEquipe(perfil: Perfil): boolean` (pura): `rh` ou `analista`. Quem é da equipe opera projetos.
  - `exigirAdmin(): Promise<Sessao>`: o `exigirRh` de hoje, renomeado, que redireciona para `/` quem não é `rh`. Trocar todos os usos de `exigirRh` nos cadastros gerais e em `/encerrados`.
  - `exigirEquipe(): Promise<Sessao>`: redireciona para `/` quem não é `rh` nem `analista`. Serve para as actions e páginas de projeto. A permissão por projeto fica com o banco.
  - `esquemaUsuario`: `perfil` aceita os quatro valores. `clienteId` continua obrigatório só para `cliente`.
  - A regra "você não pode tirar o seu próprio acesso de Administrador" continua.
  - `acessos.ts`:
    - `traduzir` mapeia `'analista não libera este perfil'` → "Você não pode liberar nem remover o acesso de um Analista de RH ou de um Administrador." e `'perfil sem acesso por projeto'` → "O Administrador já vê todos os projetos.";
    - `usuariosLiberaveis` sai, substituída pela função `pessoas_liberaveis` do banco;
    - entra `carregarPessoasDoProjeto(sb, projetoId): Promise<{ liberadas: { id; nome; perfil }[]; liberaveis: { id; nome; perfil; clienteId }[] }>`, que chama `pessoas_do_projeto` e `pessoas_liberaveis` e tira das liberáveis quem já tem acesso.

- [ ] **Step 1: Testes que falham:**
  - `ehEquipe('analista') === true` e `ehEquipe('gestor') === false`.
  - O esquema aceita `{ perfil: 'analista' }` sem cliente.
  - `ROTULO_PERFIL.rh === 'Administrador'`.
  - `liberarAcesso` com o erro `'analista não libera este perfil'` dá a mensagem acima.
  - `carregarPessoasDoProjeto` com um `sb` falso tira das liberáveis quem já está em `pessoas_do_projeto`.
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar.** Ajustar os imports de `exigirRh` nos arquivos de cadastros e `/encerrados`, que passam a usar `exigirAdmin`. As actions e páginas de projeto ficam para a Task 3.
- [ ] **Step 4: Rodar e ver passar:** `npm test && npm run typecheck && npm run lint`. Expected: PASS, exceto os usos de `exigirRh`, `usuariosLiberaveis` e `perfil === 'rh'` nas páginas de projeto, que a Task 3 troca. Anotar quais são.
- [ ] **Step 5: Commit:** `feat: perfis Administrador e Analista de RH no servidor`

### Task 3: Telas para o Analista

**Files:**
- Modify:
  - `src/app/(painel)/layout.tsx`;
  - `src/app/(painel)/page.tsx`, `ListaProjetos.tsx`, `FormProjeto.tsx`, `acoesProjeto.ts`;
  - `src/app/(painel)/projetos/[id]/{layout,page}.tsx`;
  - `src/app/(painel)/projetos/[id]/configurar/{page,AcessosProjeto,acoesConfigurar}.tsx`;
  - `src/app/(painel)/projetos/[id]/importar/{page,acoes}.ts(x)`, `src/app/(painel)/projetos/[id]/modelo/route.ts`;
  - `src/app/(painel)/vagas/[id]/{page,Acoes,acoesVaga}.tsx`;
  - `src/app/(painel)/cadastros/usuarios/{page,Cliente}.tsx`.
- Test: os testes dessas telas (`ListaProjetos`, `AcessosProjeto`, `Acoes`, usuários) e `src/app/(painel)/projetos/[id]/__tests__/AbasProjeto.test.tsx`.

**Interfaces:**
- Consumes: `ehEquipe`, `exigirEquipe`, `exigirAdmin`, `ROTULO_PERFIL` e `carregarPessoasDoProjeto` (Task 2); as funções da Task 1.
- Produces:
  - **Menu:** o Administrador vê "Projetos · Cadastros"; o Analista vê só "Projetos"; gestor e cliente, como hoje.
  - **Tela inicial:**
    - o Analista vê os projetos liberados agrupados por cliente, com "+ Novo projeto" e o filtro de cliente;
    - os encerrados dele aparecem numa seção "Encerrados" no fim da lista. O link para `/encerrados` é só do Administrador;
    - o redirecionamento direto para o único projeto vale só para gestor e cliente, não para o Analista.
  - **`FormProjeto`** lista os clientes para o Analista, que já pode lê-los pela Task 1.
  - **`salvarProjeto`, `encerrarProjeto`, `reabrirProjeto`** usam `exigirEquipe()`. O erro `'sem permissão'` vira "Você não tem acesso a este projeto.".
  - **Dentro do projeto:**
    - a aba **Configurar**, o arraste (`podeArrastar`), os botões do detalhe da vaga (`podeEditar`), o Importar e o `/modelo` passam a valer para `ehEquipe(perfil)`, em vez de `perfil === 'rh'`;
    - as actions de vaga, de configurar e de importar usam `exigirEquipe()`;
    - o `MENSAGENS` de `acoesVaga.ts` ganha `['sem permissão', 'Você não tem acesso a este projeto.']`.
  - **Quem vê este projeto:**
    - a página usa `carregarPessoasDoProjeto`, e não lê mais `usuarios` direto;
    - a lista mostra o perfil com `ROTULO_PERFIL`;
    - para o Analista, as linhas de outros Analistas e de Administradores aparecem sem o botão "remover", inclusive a dele;
    - a dica do campo diz: "Só aparecem os Gestores Timenow e as pessoas do cliente {cliente}." Para o Administrador, acrescenta: " e os Analistas de RH.".
  - **Cadastros → Usuários** (só Administrador):
    - o campo Perfil oferece Administrador, Analista de RH, Gestor Timenow e Cliente;
    - as caixas de projetos aparecem para `analista` também, com todos os projetos não encerrados;
    - "Vê:" mostra os projetos do Analista e "todos" para o Administrador.
  - **Textos:** todo "RH" que se refere ao perfil vira "Administrador", por exemplo "O Administrador vê todos os projetos.". "RH da Timenow", como área da empresa, pode ficar.

- [ ] **Step 1: Testes que falham:**
  - `ListaProjetos` com `perfil="analista"` mostra "+ Novo projeto" e não mostra o link "Encerrados". Os encerrados vêm numa seção com esse título.
  - `AbasProjeto` com `rh={true}` (equipe) mostra Configurar. A página passa `ehEquipe(perfil)`.
  - `AcessosProjeto` para o Analista não mostra "remover" na linha de um Analista nem na de um Administrador, e mostra na de um Gestor.
  - `Acoes` com `perfil="analista"` mostra "Concluir etapa".
  - O formulário de usuário oferece "Analista de RH" e, ao escolhê-lo, mostra as caixas de projetos.
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar:** `npm test && npm run typecheck && npm run lint && npm run build`. Expected: PASS. Conferir também com `grep -rn "perfil === 'rh'\|exigirRh\|usuariosLiberaveis" src` que não sobrou uso de projeto preso ao `rh`.
- [ ] **Step 5: Commit:** `feat: telas do Analista de RH e Administrador no lugar de RH`

### Task 4: Publicação

**Files:**
- Modify: `README.md` (os perfis: Administrador, Analista de RH, Gestor Timenow e Cliente, numa linha cada)

- [ ] **Step 1:** Atualizar o README. Rodar `npm test && npm run test:sql && npm run typecheck && npm run lint && npm run build`. Expected: PASS.
- [ ] **Step 2: Commit:** `docs: perfis no README`
- [ ] **Step 3 (com o Joel):**
  1. Confirmar que a 009 está em produção (Task 1, Step 6).
  2. Com o OK do Joel, `git push origin main`, e esperar a Vercel.
  3. O Joel cadastra um usuário de teste com perfil **Analista de RH** (por exemplo `joel.ayres10+analista@gmail.com`), libera para ele só a Braskem 2027, entra numa janela anônima e confere:
     - ele vê só esse projeto;
     - tem a aba Configurar;
     - consegue criar um projeto de teste e abrir o projeto criado;
     - não vê Cadastros.
  4. O Joel encerra ou remove o projeto e o usuário de teste.
