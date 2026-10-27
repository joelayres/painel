# Plano 1: Painel de Mobilização

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um painel online, em painel.sudeste-timenow.com.br, para acompanhar as 50 vagas da Mobilização Braskem 2027 em 13 etapas e 4 ondas. Todos com login veem tudo, e só o RH altera.

**Architecture:** Projeto novo, que copia a base do HE Timenow: Next.js App Router, Supabase SSR e login por código no e-mail. O banco guarda só fatos (cadastros e datas reais de conclusão). Previsões, cores e agregados são calculados por funções puras em `src/dominio`, a cada leitura. As escritas do RH passam por funções SQL que conferem o perfil e registram histórico.

**Tech Stack:** Next.js 15.5, React 19.1, TypeScript, Tailwind 4, Supabase (Postgres, Auth, RLS), zod 4, exceljs (carga da planilha), lucide-react, next-themes, Vitest com Testing Library, Vercel e Resend (SMTP do Supabase).

**Spec:** `docs/superpowers/specs/2026-10-27-painel-mobilizacao-design.md`

**Base para copiar:** `/Users/joelayres/HE Timenow`. As versões das dependências são as de `package.json` de lá.

## Global Constraints

- Código, textos, nomes e comentários em pt-BR, no estilo do HE Timenow. Sem travessão como pontuação nos textos de tela.
- 13 etapas, nesta ordem e com estas durações em dias úteis: Abertura de vaga 1, Captura de Mercado 4, Triagem de Candidatos 1, Entrevista - Timenow 1, Entrevista - TNGO/Braskem 1, Envio para contratação 0, Agendamento exames 2, Realização de Exames 1, Liberação dos exames 7, Ambientação/TBS 1, Admissão Timenow 0, Atualização da CTPS 3, Treinamento 5.
- Dia útil: de segunda a sexta, fora dos feriados cadastrados. "Hoje" é sempre a data em `America/Sao_Paulo`.
- Prazo da onda: **Admissão Timenow (etapa 11)**. Amarelo quando a admissão estimada for depois do fim da onda. O fim da onda é inclusivo.
- Cores:
  - vermelho = hoje > fim previsto da etapa atual;
  - amarelo = não vermelho, ainda não admitida, e admissão estimada > fim da onda;
  - verde = o resto.
  - As cores só valem para vagas em andamento.
- Perfis: `rh` (lê e escreve) e `visualizador` (só lê). Todos veem todas as vagas.
- O histórico mostra o **nome** de quem alterou, nunca o e-mail.
- Os testes de integração **nunca** rodam no banco de produção (ver Task 0).

## Review Focus

1. **Vaga iniciada num sábado ou feriado:** a etapa 1 começa no próximo dia útil, e as previsões não ficam um dia adiantadas. → teste em Task 2.
2. **Etapa concluída numa sexta, com a seguinte de duração 0:** o marco de duração 0 termina no próximo dia útil, nunca num sábado. → teste em Task 2.
3. **Concluir uma etapa com data real anterior à conclusão da etapa anterior, ou no futuro:** a ação é recusada com mensagem clara. → teste em Task 4.
4. **Duas pessoas do RH clicando "Concluir etapa" na mesma vaga ao mesmo tempo:** só uma etapa avança. A função recebe a etapa esperada e recusa se ela já mudou. → teste em Task 4.
5. **Planilha com uma linha de etapa antes da primeira vaga, onda escrita "1ª Onda" ou "1º Onda", ou etapa concluída depois de uma não concluída:** a prévia aponta a linha com erro e não grava nada. → teste em Task 9.

---

### Task 0: Preparação externa (feita pelo Joel, com ajuda do controlador)

Não tem código. É a única tarefa que exige ações na conta do Joel. O controlador conduz pelo chat e só segue quando cada item estiver confirmado.

- [ ] **Step 1: Criar o projeto Supabase do painel**, chamado `painel-mobilizacao`, na região sa-east-1. Anotar o REF, a URL, a anon key, a service role key e a senha do banco.
- [ ] **Step 2: Banco para os testes.** Tentar criar um segundo projeto, `painel-mobilizacao-testes`. Se o plano gratuito não permitir (limite de 2 projetos ativos, e o HE Timenow já ocupa 1), seguir assim:
  - os testes de integração rodam no projeto do painel **somente enquanto ele não tiver dados reais**;
  - o arquivo `tests/integracao/apoio.ts` aborta se encontrar em `vagas` alguma linha cuja função não comece com `teste-`;
  - depois da carga inicial (Task 9, Step 6), `npm run test:integracao` fica bloqueado nesse projeto.
- [ ] **Step 3: SMTP.** No projeto novo, em Auth → SMTP, usar o Resend com o domínio `sudeste-timenow.com.br`, igual ao HE Timenow. No template de "Magic Link", mostrar o código `{{ .Token }}`, como no HE Timenow.
- [ ] **Step 4: Repositório no GitHub.** Criar o repositório privado `joelayres/painel-mobilizacao`, vazio.

### Task 1: Base do projeto (cópia enxuta do HE Timenow)

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.mts`, `vitest.integracao.config.mts`, `vitest.setup.ts`, `.gitignore` (inclui `.env*.local` e `.superpowers/`), `.env.example`, `scripts/db.sh`
- Create (copiados e adaptados do HE Timenow): `src/app/layout.tsx`, `src/app/globals.css`, `src/app/icon.tsx`, `src/components/layout/Logo.tsx`, `src/components/marca/FundoRede.tsx`, `src/components/tema/*`, `src/components/ui/{Botao,Campo,Cartao,Selecao,PainelLateral}.tsx`, `src/lib/supabase/{admin,cliente,servidor}.ts`
- Create: `src/app/page.tsx` (placeholder "Painel de Mobilização")
- Test: `src/__tests__/smoke.test.ts`

**Interfaces:**
- Produces:
  - `criarClienteServidor()`, `criarClienteAdmin()` e `criarClienteNavegador()`, com as mesmas assinaturas do HE Timenow;
  - `hojeSP(agora?: Date): string` (AAAA-MM-DD) em `src/dominio/tempo.ts`, copiado do HE Timenow com o teste dele;
  - os scripts `dev`, `build`, `test`, `test:integracao`, `typecheck`, `lint`, `db:push`, `db:tipos`.

- [ ] **Step 1: Teste de fumaça que falha:** `smoke.test.ts` importa `hojeSP` e confere `hojeSP(new Date('2026-10-28T02:00:00Z')) === '2026-10-27'`.
- [ ] **Step 2: Rodar e ver falhar:** `npm test`. Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Montar o projeto.** `git init` e copiar e enxugar os arquivos listados. Nas dependências, tirar `jszip` e `pg` e manter `exceljs`. O título do app é "Painel de Mobilização". `npm install`.
- [ ] **Step 4: Rodar e ver passar:** `npm test && npm run typecheck && npm run lint && npm run build`. Expected: PASS.
- [ ] **Step 5: Commit:** `chore: base do Painel de Mobilização` (com o design e este plano), depois `git remote add origin` e `git push -u origin main`.

### Task 2: Calendário e previsão (funções puras)

**Files:**
- Create: `src/dominio/calendario.ts`, `src/dominio/previsao.ts`, `src/dominio/etapas.ts`
- Test: `src/dominio/__tests__/calendario.test.ts`, `src/dominio/__tests__/previsao.test.ts`

**Interfaces:**
- Produces:
  - `etapas.ts`:
    - `type EtapaDef = { ordem: number; nome: string; duracao: number }`;
    - `ETAPAS_PADRAO: EtapaDef[]` (as 13 das Global Constraints);
    - `ETAPA_ADMISSAO = 11`;
    - `ETAPA_CAPTURA = 2`.
  - `calendario.ts`:
    - `type Feriados = ReadonlySet<string>`;
    - `ehDiaUtil(data: string, f: Feriados): boolean`;
    - `proximoDiaUtil(data: string, f: Feriados): string` (a própria data, se já for útil);
    - `diaUtilSeguinte(data: string, f: Feriados): string` (estritamente depois);
    - `fimDaEtapa(inicio: string, duracao: number, f: Feriados): string`. Para duração ≥ 1, é o N-ésimo dia útil contando o início. Para 0, é o próprio início.
    - `diasUteisEntre(de: string, ate: string, f: Feriados): number` (dias úteis em `(de, ate]`; 0 se `ate <= de`).
  - `previsao.ts`:
    - `type Conclusao = { ordem: number; concluidaEm: string }`;
    - `type EtapaPrevista = { ordem: number; nome: string; inicio: string; fim: string; concluidaEm: string | null }`;
    - `type PrevisaoVaga = { etapas: EtapaPrevista[]; etapaAtual: number | null /* null = mobilizada */; inicioEtapaAtual: string | null; admissaoEstimada: string; conclusaoEstimada: string }`;
    - `preverVaga(p: { dataInicio: string; retomadaEm?: string | null; etapas: EtapaDef[]; conclusoes: Conclusao[]; feriados: Feriados }): PrevisaoVaga`.
    - `retomadaEm` é a data em que o RH registrou a desistência do candidato. Se existir, o início da etapa 2 é o mais tarde entre a regra normal e `proximoDiaUtil(retomadaEm)`.

Regras de `preverVaga`:
- As conclusões são sempre um prefixo (1..k).
- O início da etapa 1 é `proximoDiaUtil(dataInicio)`.
- O início da etapa n+1:
  - se n foi concluída: `diaUtilSeguinte(concluidaEm)`, a não ser que n tenha duração 0, caso em que é `proximoDiaUtil(concluidaEm)`;
  - se n não foi concluída: `diaUtilSeguinte(fim previsto de n)`, a não ser que n tenha duração 0, caso em que é o mesmo dia.
- O fim de uma etapa concluída é a sua `concluidaEm`.
- `admissaoEstimada` é o fim da etapa 11, e `conclusaoEstimada` é o fim da etapa 13.

- [ ] **Step 1: Testes que falham.** Feriados `F = {'2026-11-02','2026-11-15','2026-11-20'}`.
  - `fimDaEtapa('2026-10-23', 4, F) === '2026-10-28'`.
  - `fimDaEtapa('2026-10-30', 1, F) === '2026-10-30'`.
  - `diaUtilSeguinte('2026-10-30', F) === '2026-11-03'` (pula o fim de semana e Finados).
  - `fimDaEtapa('2026-11-19', 3, F) === '2026-11-24'`.
  - `diasUteisEntre('2026-10-30','2026-11-04', F) === 2`.
  - `'previsão sem conclusões a partir de 22/10'`: `preverVaga({ dataInicio:'2026-10-22', etapas: ETAPAS_PADRAO, conclusoes: [], feriados: F })` dá estes fins por ordem:
    - 1→`2026-10-22`, 2→`2026-10-28`, 3→`2026-10-29`, 4→`2026-10-30`, 5→`2026-11-03`;
    - 6→`2026-11-04`, 7→`2026-11-05` (começa em `2026-11-04`), 8→`2026-11-06`, 9→`2026-11-17`, 10→`2026-11-18`;
    - 11→`2026-11-19`, 12→`2026-11-24`, 13→`2026-12-01`;
    - `admissaoEstimada '2026-11-19'`, `conclusaoEstimada '2026-12-01'`, `etapaAtual 1`.
  - `'conclusão atrasada desloca as seguintes'`: conclusões `[{1,'2026-10-22'},{2,'2026-10-30'}]` dão `etapaAtual 3`, `inicioEtapaAtual '2026-11-03'` e etapa 3 com fim `'2026-11-03'`.
  - `'início num sábado'` (Review Focus 1): `dataInicio '2026-10-24'` faz a etapa 1 começar e terminar em `'2026-10-26'`.
  - `'marco de duração 0 depois de sexta'` (Review Focus 2): conclusões até a 5, com a 5 em `'2026-11-06'` (sexta), fazem a etapa 6 começar e terminar em `'2026-11-09'`.
  - `'todas concluídas'`: `etapaAtual null`, `inicioEtapaAtual null`.
  - `'retomada depois de desistência'`: com a conclusão 1 em `'2026-10-22'` e `retomadaEm '2026-11-04'`, a etapa 2 começa em `'2026-11-04'` e termina em `'2026-11-09'`.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run src/dominio`. Expected: FAIL.
- [ ] **Step 3: Implementar.** As datas são strings AAAA-MM-DD, e a aritmética é feita em UTC, como `partesData`/`formatarData` do HE Timenow.
- [ ] **Step 4: Rodar e ver passar.** Expected: PASS.
- [ ] **Step 5: Commit:** `feat: calendário de dias úteis e previsão das etapas`

### Task 3: Situação, filtros e resumo por onda (funções puras)

**Files:**
- Create: `src/dominio/situacao.ts`, `src/dominio/painel.ts`
- Test: `src/dominio/__tests__/situacao.test.ts`, `src/dominio/__tests__/painel.test.ts`

**Interfaces:**
- Consumes: `PrevisaoVaga`, `diasUteisEntre`, `ETAPA_ADMISSAO` (Task 2).
- Produces:
  - `type Cor = 'verde' | 'amarelo' | 'vermelho'`;
  - `type Situacao = { cor: Cor | null /* null = mobilizada */; admitida: boolean; mobilizada: boolean; diasNaEtapa: number }`;
  - `situacaoVaga(prev: PrevisaoVaga, fimOnda: string, hoje: string, f: Feriados): Situacao`;
  - `type VagaPainel = { id: string; funcao: string; disciplina: string; area: string; onda: { id: string; numero: number; inicio: string; fim: string }; gestor: { id: string; nome: string } | null; candidato: string | null; previsao: PrevisaoVaga; situacao: Situacao }`;
  - `type Filtro = { onda?: number; funcao?: string; area?: string; gestorId?: string; candidato?: string }`;
  - `filtrarVagas(vagas: VagaPainel[], f: Filtro): VagaPainel[]` (candidato por "contém", sem diferenciar maiúsculas nem acentos);
  - `type ResumoOnda = { numero: number; inicio: string; fim: string; total: number; admitidas: number; mobilizadas: number; verde: number; amarelo: number; vermelho: number }`;
  - `resumirOndas(vagas: VagaPainel[]): ResumoOnda[]` (em ordem de número; as cores contam só as não mobilizadas);
  - `vagasEmAtencao(vagas: VagaPainel[]): VagaPainel[]` (vermelhas primeiro, por mais dias além do fim previsto, depois amarelas por admissão mais tardia);
  - `porEtapa(vagas: VagaPainel[]): Map<number, VagaPainel[]>` (pela etapa atual; as mobilizadas ficam fora).

- [ ] **Step 1: Testes que falham** (reusam a previsão de 22/10 da Task 2):
  - `situacaoVaga` com `hoje '2026-10-29'` e etapa atual 2 (fim previsto 28/10) dá `vermelho`.
  - Com `hoje '2026-10-27'` e onda até `'2026-11-18'`, a admissão estimada 19/11 dá `amarelo`.
  - Com a onda até `'2026-11-19'` dá `verde`, porque o fim da onda é inclusivo.
  - Uma vaga com a etapa 11 concluída e a atual no prazo nunca é `amarelo`, mesmo com a onda vencida.
  - Uma vaga mobilizada dá `cor null`.
  - `diasNaEtapa`: início da etapa atual 03/11 e hoje 05/11 dão 2.
  - `resumirOndas`: 3 vagas na onda 1 (verde, vermelho, mobilizada) dão `{ total:3, verde:1, vermelho:1, amarelo:0, mobilizadas:1, admitidas:1 }`.
  - `filtrarVagas({ candidato: 'joao' })` encontra "João Silva".
  - `vagasEmAtencao` coloca a vermelha antes da amarela.
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.** Expected: PASS.
- [ ] **Step 5: Commit:** `feat: situação das vagas, filtros e resumo por onda`

### Task 4: Banco: tabelas, segurança e ações do RH

**Files:**
- Create: `supabase/migrations/20261028000001_schema.sql`, `supabase/migrations/20261028000002_acoes_rh.sql`
- Create: `src/lib/supabase/tipos.ts` (gerado), `tests/integracao/apoio.ts` (com a trava da Task 0), `tests/integracao/banco.test.ts`

**Interfaces:**
- Produces (SQL):
  - `usuarios (id uuid pk, usuario_id uuid unique references auth.users on delete set null, nome text not null, email text unique not null, perfil text check in ('rh','visualizador'), ativo boolean default true)`.
  - `meu_perfil() returns text` e `eh_rh() returns boolean` (security definer, `set search_path = public`).
  - `ondas (id uuid pk, numero smallint unique check 1..4, inicio date, fim date, check fim >= inicio)`.
  - `gestores (id uuid pk, nome text, email text)`.
  - `etapas (ordem smallint pk check 1..13, nome text, duracao smallint check >= 0)`, já preenchida com `ETAPAS_PADRAO`.
  - `feriados (data date pk, nome text)`, com os feriados nacionais de 2026 e 2027 copiados de `HE Timenow/supabase/migrations/20261024000003_feriados_nacionais.sql`.
  - `vagas (id uuid pk, funcao text, disciplina text, area text, onda_id uuid references ondas, gestor_id uuid references gestores on delete set null, candidato text, data_inicio date not null, retomada_em date, cancelada_em timestamptz, criado_em timestamptz default now())`.
  - `vaga_conclusoes (vaga_id uuid references vagas on delete cascade, ordem smallint references etapas, concluida_em date not null, primary key (vaga_id, ordem))`.
  - `historico (id uuid pk, vaga_id uuid references vagas on delete cascade, nome_usuario text not null, acao text not null, detalhe jsonb, em timestamptz default now())`, com `vaga_id null` para mudanças gerais (durações, ondas).
  - RLS: `select` para quem tem `meu_perfil() is not null`, e `insert/update/delete` só para `eh_rh()`, em todas as tabelas acima. `usuarios` só o RH lê inteiro, e cada um lê a própria linha.
  - Funções (security definer, confere `eh_rh()`, grava em `historico` com o nome do usuário):
    - `concluir_etapa(p_vaga uuid, p_ordem_esperada smallint, p_data date) returns void`. Recusa com estas mensagens:
      - `'etapa mudou'` se a etapa atual (maior ordem concluída + 1) ≠ `p_ordem_esperada`;
      - `'data antes da etapa anterior'` se `p_data` < conclusão da etapa anterior;
      - `'data no futuro'` se `p_data` > hoje SP;
      - `'vaga cancelada'`.
    - `desfazer_etapa(p_vaga uuid, p_ordem_esperada smallint) returns void`: apaga a conclusão de maior ordem, que precisa ser igual a `p_ordem_esperada`.
    - `candidato_desistiu(p_vaga uuid) returns void`: apaga as conclusões de ordem ≥ 2, limpa `candidato` e grava `retomada_em = hoje SP`. A etapa 1 continua concluída, e a previsão a partir da Captura começa hoje, como diz a spec. Concluir a etapa 2 depois disso não exige mexer em `retomada_em`, porque a regra só pesa enquanto a etapa 2 está aberta.
    - `alterar_duracao(p_ordem smallint, p_dias smallint) returns void`: grava o histórico geral com o valor anterior e o novo.

- [ ] **Step 1: Testes de integração que falham** (usuários de teste criados com `apoio.ts`):
  - O visualizador lê `vagas` e falha ao fazer `insert`/`update` (Anti-objetivo).
  - O RH conclui a etapa 1 e o histórico registra o nome dele.
  - `'concluir com etapa esperada errada é recusado'` (Review Focus 4): duas chamadas com `p_ordem_esperada 1`, e a segunda dá erro `'etapa mudou'`.
  - `'data anterior à etapa anterior é recusada'` e `'data no futuro é recusada'` (Review Focus 3).
  - `desfazer_etapa` apaga só a última.
  - `candidato_desistiu` deixa só a conclusão 1, `candidato null` e `retomada_em` = hoje.
  - Um visualizador chamando `concluir_etapa` recebe erro de permissão.
- [ ] **Step 2: Rodar e ver falhar:** `npm run db:push && npm run test:integracao`. Expected: FAIL.
- [ ] **Step 3: Escrever as migrações**, depois `npm run db:push && npm run db:tipos`.
- [ ] **Step 4: Rodar e ver passar.** Expected: PASS.
- [ ] **Step 5: Commit:** `feat: banco do painel com segurança e ações do RH`

### Task 5: Login por código e perfis

**Files:**
- Create (copiados e adaptados do HE Timenow): `src/middleware.ts`, `src/app/entrar/{page.tsx,FormularioEntrada.tsx,acoes.ts}`, `src/lib/auth/perfil.ts`
- Test: `src/app/entrar/__tests__/acoes.test.ts`, `src/__tests__/middleware.test.ts`

**Interfaces:**
- Consumes: `meu_perfil()` (Task 4).
- Produces:
  - `type Perfil = 'rh' | 'visualizador'`;
  - `type Sessao = { usuarioId: string; perfil: Perfil; nome: string }`;
  - `obterSessao(): Promise<Sessao | null>` (lê `usuarios`);
  - `exigirSessao(): Promise<Sessao>` (redireciona para `/entrar`);
  - `exigirRh(): Promise<Sessao>` (redireciona para `/`).
  - Depois de entrar, todos vão para `/`. As rotas públicas são `/entrar`, `/icon` e `/apple-icon`.
  - A tela de entrada usa o layout do HE Timenow: no celular, a opção B com o fundo de rede e o cartão embaixo. O título é "Mobilização Braskem 2027", com a linha "Acompanhamento das contratações".

- [ ] **Step 1: Testes que falham**, adaptando os do HE Timenow:
  - `enviarCodigo` usa `shouldCreateUser: false`;
  - `verificarCodigo` sem perfil faz `signOut` e devolve erro;
  - o middleware manda quem não entrou para `/entrar` e deixa `/entrar` passar.
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.** Expected: PASS.
- [ ] **Step 5: Commit:** `feat: login por código no e-mail com perfis rh e visualizador`

### Task 6: Leitura do painel

**Files:**
- Create: `src/lib/painel/dados.ts`
- Test: `src/lib/painel/__tests__/dados.test.ts`

**Interfaces:**
- Consumes: `preverVaga`, `situacaoVaga` e os tipos das Tasks 2 e 3, e o cliente da sessão.
- Produces:
  - `montarPainel(linhas: { vagas, conclusoes, etapas, feriados, ondas, gestores }, hoje: string): VagaPainel[]` (pura; ignora vagas canceladas);
  - `carregarPainel(sb: SupabaseClient<Database>, hoje: string): Promise<{ vagas: VagaPainel[]; etapas: EtapaDef[]; ondas: ...; gestores: ... }>` (6 consultas em paralelo; lança erro claro se alguma falhar).

- [ ] **Step 1: Teste que falha** de `montarPainel`: linhas em memória com 2 vagas e uma onda dão 2 `VagaPainel` com a previsão e a cor esperadas, e uma vaga cancelada fica de fora.
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.** Expected: PASS.
- [ ] **Step 5: Commit:** `feat: leitura do painel`

### Task 7: Tela do painel (ondas, atenção e quadro)

**Files:**
- Create: `src/app/(painel)/layout.tsx` (casca com topo, nome, data de hoje e "Sair"; menu "Cadastros" só para o RH), `src/app/(painel)/page.tsx`, `src/app/(painel)/Filtros.tsx`, `src/app/(painel)/CartoesOnda.tsx`, `src/app/(painel)/Atencao.tsx`, `src/app/(painel)/Quadro.tsx`, `src/app/(painel)/CartaoVaga.tsx`
- Test: `src/app/(painel)/__tests__/{CartoesOnda,Atencao,Quadro,Filtros}.test.tsx`

**Interfaces:**
- Consumes: `carregarPainel` (Task 6), `filtrarVagas`, `resumirOndas`, `vagasEmAtencao` e `porEtapa` (Task 3).
- Produces:
  - Os filtros ficam no endereço: `?onda=1&funcao=…&area=…&gestor=<id>&candidato=…`.
  - O cartão de onda tem `aria-label="Onda {n}"` e é um link que põe `onda=n` no endereço.
  - `CartaoVaga` é um link para `/vagas/{id}`.
  - Texto do cartão de onda: "{n}ª Onda", "{dd/mm} a {dd/mm}", "{admitidas} admitidos de {total}", "{mobilizadas} mobilizados", "{verde} no prazo · {amarelo} em risco · {vermelho} atrasadas".
  - Cartão da vaga: função, disciplina, gestor (ou "Sem gestor"), candidato (se houver), "{n} dias nesta etapa" e "Admissão prevista {dd/mm}", com uma faixa à esquerda na cor da situação.
  - A coluna "Mobilizadas" no fim mostra só a contagem.
  - Cores fortes, com contraste AA nos temas claro e escuro. Números grandes nos cartões de onda (≥ 28px). As colunas do quadro rolam na horizontal no celular.

- [ ] **Step 1: Testes que falham:**
  - `CartoesOnda` com o resumo da Task 3 mostra "1ª Onda", "1 admitidos de 3" e "1 no prazo · 0 em risco · 1 atrasadas".
  - `Atencao` lista a vermelha antes da amarela e mostra "parada em Triagem de Candidatos há 2 dias".
  - `Quadro` mostra 13 colunas com o título e a contagem, mais "Mobilizadas (1)".
  - `Filtros`: escolher um gestor chama `router.push` com `?gestor=<id>` e mantém os outros filtros.
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar.** Conferir em `npm run dev`, com dados de teste, em 1280 px e 390 px, nos temas claro e escuro.
- [ ] **Step 4: Rodar e ver passar**, junto com `npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: tela do painel com ondas, atenção e quadro por etapa`

### Task 8: Detalhe da vaga e ações do RH

**Files:**
- Create: `src/app/(painel)/vagas/[id]/page.tsx`, `src/app/(painel)/vagas/[id]/Acoes.tsx`, `src/app/(painel)/vagas/[id]/acoes.ts`
- Test: `src/app/(painel)/vagas/[id]/__tests__/{Acoes,acoes}.test.tsx`

**Interfaces:**
- Consumes: as funções SQL da Task 4, `exigirRh` (Task 5) e `carregarPainel` (Task 6).
- Produces (server actions; todas conferem `exigirRh()` e fazem `revalidatePath('/')`):
  - `concluirEtapa(vagaId: string, ordemEsperada: number, data: string)`;
  - `desfazerEtapa(vagaId: string, ordemEsperada: number)`;
  - `candidatoDesistiu(vagaId: string)`;
  - `salvarVaga(id: string | null, entrada: unknown)`;
  - `cancelarVaga(id: string)`.
  - Todas devolvem `{ ok: true } | { ok: false; erro: string }`. Os erros SQL viram mensagens:
    - `'etapa mudou'` → "Esta vaga mudou enquanto você olhava. Atualize a página.";
    - `'data antes da etapa anterior'` → "A data não pode ser antes da conclusão da etapa anterior.";
    - `'data no futuro'` → "A data não pode ser no futuro.".
  - Tela:
    - os dados da vaga;
    - a tabela das 13 etapas com "Previsto: início a fim" e "Concluída em", com a etapa atual destacada;
    - o histórico, com o nome, a data e a ação.
  - Para o RH:
    - o botão "Concluir etapa", com a data (hoje, editável);
    - "Desfazer último avanço";
    - "Candidato desistiu", que pede confirmação;
    - "Editar vaga".
    - O visualizador não vê nenhum desses botões.

- [ ] **Step 1: Testes que falham:**
  - O visualizador não vê "Concluir etapa".
  - O RH clica em "Concluir etapa" e `concluirEtapa` é chamada com a ordem atual e a data de hoje (2 cliques no máximo: abrir o detalhe e concluir; Anti-objetivo).
  - A ação mapeia `'etapa mudou'` para a mensagem acima.
  - "Candidato desistiu" pede confirmação antes de chamar.
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.** Expected: PASS.
- [ ] **Step 5: Commit:** `feat: detalhe da vaga e ações do RH`

### Task 9: Cadastros do RH e carga inicial da planilha

**Files:**
- Create: `src/app/(painel)/cadastros/{page.tsx,ondas,gestores,vagas,etapas,feriados,usuarios}/…`, `src/lib/carga/ler.ts`, `src/app/(painel)/cadastros/carga/{page.tsx,acoes.ts}`
- Test: `src/lib/carga/__tests__/ler.test.ts` (com uma planilha gerada por exceljs no formato da spec), `tests/integracao/usuarios.test.ts`

**Interfaces:**
- Produces:
  - Telas de lista e formulário, no padrão `TabelaCadastro` e `PainelLateral` do HE Timenow, para ondas (número, início, fim), gestores (nome, e-mail), vagas (criar e cancelar; lista de canceladas), etapas (só a duração é editável; chama `alterar_duracao`), feriados (data, nome) e usuários (nome, e-mail, perfil).
  - Cadastrar um usuário cria o login no Supabase Auth com `admin.auth.admin.createUser({ email, email_confirm: true })`. Desativar bloqueia com `ban_duration`, como em `alternarAtivo` do HE Timenow.
  - `lerPlanilhaMobilizacao(arquivo: ArrayBuffer): Promise<{ ok: true; vagas: VagaCarga[]; erros: [] } | { ok: false; erros: { linha: number; mensagem: string }[] }>`, com:
    - `type VagaCarga = { linha: number; funcao: string; disciplina: string; area: string; onda: number; candidato: string | null; dataInicio: string; concluidas: { ordem: number; concluidaEm: string }[] }`.
  - Regras de leitura:
    - A linha de vaga tem até 3 espaços à esquerda, e a de etapa tem 6 ou mais.
    - As etapas são casadas pelo nome, sem diferenciar maiúsculas, acentos nem espaços.
    - A onda aceita "1º Onda", "1ª Onda" ou "Onda 1".
    - As datas aceitam "Qui 22/10/26" e datas do Excel.
    - Uma vaga sem função e sem datas, como "Treinamento - Braskem", é ignorada.
  - Erros, sempre com o número da linha:
    - "etapa antes de qualquer vaga";
    - "onda inválida";
    - "etapa concluída depois de uma não concluída";
    - "etapa desconhecida: {nome}".
  - A carga só grava se `vagas` estiver vazia e todas as linhas forem válidas. A tela mostra a prévia (quantas vagas por onda e quantas etapas concluídas) e o botão "Importar".

- [ ] **Step 1: Testes que falham:**
  - `ler.test.ts` lê uma planilha com 2 vagas (uma com 4 etapas concluídas) e dá 2 `VagaCarga`, com `onda`, `dataInicio '2026-10-22'` e `concluidas` corretas.
  - "1ª Onda" e "1º Onda" valem.
  - Os três erros da Review Focus 5 apontam a linha.
  - Integração: cadastrar um usuário `visualizador` cria o login, e ele lê `vagas`.
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar**, junto com `npm test && npm run test:integracao && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: cadastros do RH e carga inicial da planilha`
- [ ] **Step 6 (com o Joel, depois do deploy da Task 10):**
  1. Apagar os dados de teste.
  2. Cadastrar as ondas.
  3. Rodar a carga da planilha real (`~/Downloads/Acompanhamento Mobilizações.xlsx`) e conferir 50 vagas: 17, 20, 4 e 9 por onda.
  4. Daqui em diante, `test:integracao` fica bloqueado nesse projeto (Task 0).

### Task 10: Publicação

**Files:**
- Modify: `README.md` (como rodar, variáveis e a regra de que os testes de integração não rodam em produção)

- [ ] **Step 1:** Criar o projeto `painel-mobilizacao` na Vercel, ligado ao repositório. Variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] **Step 2:** Em Domains, adicionar `painel.sudeste-timenow.com.br`. No Registro.br, criar o registro CNAME `painel` apontando para `cname.vercel-dns.com`. Esta parte é com o Joel.
- [ ] **Step 3:** No Supabase, em Auth → URL Configuration, usar Site URL `https://painel.sudeste-timenow.com.br`.
- [ ] **Step 4:** Cadastrar o primeiro usuário RH, o Joel, com um script `scripts/criar-rh.mts` copiado do HE Timenow. Entrar pelo endereço real e ver o painel vazio.
- [ ] **Step 5:** Seguir para a Task 9, Step 6 (carga real). Conferir no celular e no computador.
- [ ] **Step 6: Commit:** `docs: como publicar e operar o painel`
