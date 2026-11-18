# Relatório de mobilização com tarifa — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** aba "Relatório" em cada projeto do painel, igual à Planilha1 do cliente (vaga × etapa com OK, % por etapa), com Tipo e Taxa lidos do Financeiro a cada abertura, e download em Excel.

**Architecture:** o Financeiro ganha a rota de leitura `GET /api/painel/tarifas` (todas as vagas do painel que ele conhece, com tipo, linha e tarifa vigente no mês). O painel lê essa rota sem cache e sem lançar erro, monta o relatório numa função pura (`src/dominio/relatorio.ts`) e mostra em uma página server-side e em uma rota de Excel.

**Tech Stack:** Next.js (App Router), Supabase, Vitest + Testing Library, exceljs. Dois repositórios: `~/financeiro` (Tasks 1–2) e `~/painel-mobilizacao` (Tasks 3–7).

**Spec:** `docs/superpowers/specs/2026-11-17-relatorio-de-mobilizacao-design.md`

## Global Constraints

- Código, nomes e textos em português, no estilo de cada repositório; sem dependências novas.
- Tipo do contrato, igual nos dois repositórios: `TarifaVaga = { painelVagaId: string; tipo: 'MOD' | 'MOI'; cobrada: boolean; linha: string | null; descricao: string | null; valor: number | null }` e `RespostaTarifasVagas = { versao: 1; vagas: TarifaVaga[] }`.
- Status `moi` → `'MOI'`; `ativo`, `afastado`, `nao_cobrar` → `'MOD'`. `cobrada` é `false` para `moi` e `nao_cobrar`, e aí `valor` é `null` mesmo com linha.
- Taxa de vaga não cobrada aparece como **"Não cobrada"** (tela e Excel) e não conta em "sem tarifa".
- Vaga com `pessoa_id`: vale a vigência da pessoa no mês atual (`vigente`); sem vigência no mês, o cadastro da vaga. Vaga sem pessoa: o cadastro da vaga.
- Valor = tarifa de `local|linha` vigente na competência atual (`tarifasDoMes`), só para `ativo` e `afastado`.
- Segredo: o Financeiro valida com `FINANCEIRO_SEGREDO_PAINEL`; o painel envia `FINANCEIRO_SEGREDO`. 404 sem segredo configurado, 401 com segredo errado, 500 na falha de leitura.
- Painel: endereço em `FINANCEIRO_ENDERECO`, limite de 4000 ms, `cache: 'no-store'`, nunca lança (devolve `null`).
- Etapa concluída aparece como **OK** (tela e Excel); vazio = não concluída. Na tela, a data vai no `title`.
- Aba visível para todos os perfis; ordem: Resumo · Painel · Relatório · Configurar.
- Nome do arquivo: `relatorio-<projeto-sem-acento>-<AAAA-MM-DD>.xlsx`.

## Review Focus

1. **Financeiro fora do ar ou segredo ausente:** o relatório abre com as etapas, Tipo/Taxa "—" e o aviso; o Excel também sai (Task 3 testa o `null`, Task 5 testa o aviso, Task 6 testa o Excel com `null`).
2. **Projeto sem vagas (ou onda sem vagas):** % fica 0, sem divisão por zero, e a tabela mostra "Nenhuma vaga" (Task 4 e Task 5).
3. **Tarifa com vigência futura:** uma nova tarifa cadastrada para o mês que vem não pode aparecer hoje (Task 1).
4. **Usuário sem acesso ao projeto pedindo o Excel:** o RLS não devolve o projeto → 404, nunca a planilha (Task 6).
5. **`?onda=` inválido ou de outro projeto:** ignorado, vale "Todas", igual ao Resumo (Task 5 e Task 6).

---

### Task 1: Financeiro — montar as tarifas por vaga

Repositório `~/financeiro`, branch `feat/tarifas-painel`.

**Files:**
- Create: `src/lib/painel/contrato.ts` (tipos do contrato, comentário "Mude nos dois repositórios ao mesmo tempo.")
- Create: `src/lib/painel/tarifas.ts`
- Test: `src/lib/painel/__tests__/tarifas.test.ts`

**Interfaces:**
- Consumes: `vigente` (`@/dominio/vigencia`), `tarifasDoMes` (`@/dominio/mes`), `competenciaDe` (`@/dominio/competencia`), `lerTudo` (`@/lib/dados/mes`), `Tabela` (`@/lib/supabase/tabela`).
- Produces: `montarTarifasPainel(d: { vagas: Tabela<'vagas'>[]; vigencias: Tabela<'pessoa_vigencias'>[]; tarifas: Tabela<'tarifas'>[] }, competencia: string): TarifaVaga[]` e `carregarTarifasPainel(admin: SupabaseClient<Database>, hoje: string): Promise<RespostaTarifasVagas>`.

- [ ] **Step 1: Criar a branch e escrever os testes**

```bash
cd ~/financeiro && git checkout -b feat/tarifas-painel
```

Testes em `tarifas.test.ts` (competência `'2026-11-01'`; tarifas SP `12/2026` com vigência `2026-01-01` valor 24108.83 e `2026-12-01` valor 26000, descrição "Técnico de Campo JR"):
- `'vaga sem pessoa usa o cadastro da vaga'`: vaga `{ status: 'ativo', local: 'SP', linha: '12/2026', pessoa_id: null }` → `{ painelVagaId, tipo: 'MOD', cobrada: true, linha: '12/2026', descricao: 'Técnico de Campo JR', valor: 24108.83 }`.
- `'tarifa de vigência futura não vale ainda'`: mesma vaga, competência `'2026-11-01'` → `valor: 24108.83`; competência `'2026-12-01'` → `26000`.
- `'vaga ligada a pessoa usa a vigência da pessoa no mês'`: vaga com `linha: '12/2026'` e `pessoa_id: 'p1'`; vigências de p1: `2026-10-01` linha `'15/2026'`, `2026-12-01` linha `'12/2026'` → `linha: '15/2026'`.
- `'pessoa sem vigência no mês cai no cadastro da vaga'`: p1 só com vigência `2026-12-01` → linha da vaga.
- `'MOI e não cobrar não têm tarifa, mesmo com linha'`: pessoa com vigência `moi` e linha `'12/2026'` → `{ tipo: 'MOI', cobrada: false, valor: null }`; `nao_cobrar` → `{ tipo: 'MOD', cobrada: false, valor: null }`; `afastado` → `{ tipo: 'MOD', cobrada: true, valor: 24108.83 }`.
- `'sem linha: linha, descrição e valor nulos'`: vaga `status: 'ativo', linha: null` → `{ tipo: 'MOD', cobrada: true, linha: null, descricao: null, valor: null }`.
- `'linha sem tarifa vigente: valor nulo'`: linha `'99/2026'` sem tarifa → `valor: null`, `descricao: null`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/painel/__tests__/tarifas.test.ts`
Expected: FAIL (módulo `../tarifas` não existe).

- [ ] **Step 3: Implementar `montarTarifasPainel` e `carregarTarifasPainel`**

Agrupe as vigências por `pessoa_id`; `valor` é `Number(t.valor)`. `carregarTarifasPainel` lê `vagas`, `pessoa_vigencias` e `tarifas` com `lerTudo` em paralelo e usa `competenciaDe(hoje)`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/painel/__tests__/tarifas.test.ts && npm run typecheck`
Expected: PASS, sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add src/lib/painel && git commit -m "feat(painel): tarifa vigente de cada vaga do Painel"
```

### Task 2: Financeiro — rota `/api/painel/tarifas`

**Files:**
- Create: `src/app/api/painel/tarifas/route.ts`
- Test: `src/app/api/painel/tarifas/__tests__/route.test.ts`
- Modify: `.env.example` (comentário: `FINANCEIRO_SEGREDO_PAINEL` também autoriza o Painel a ler `/api/painel/tarifas`)

**Interfaces:**
- Consumes: `carregarTarifasPainel` (Task 1), `hojeSP` (`@/dominio/hoje`), `criarClienteAdmin`.
- Produces: `GET /api/painel/tarifas` → `RespostaTarifasVagas`, `Cache-Control: no-store`.

- [ ] **Step 1: Escrever os testes** (mesmo molde de `src/app/api/efetivo/linhas/__tests__/route.test.ts`, mockando `@/lib/painel/tarifas`)
- `'sem segredo 404; segredo errado 401; certo 200 versão 1'`: com `FINANCEIRO_SEGREDO_PAINEL='s'`, `Bearer s` → `200` e `{ versao: 1, vagas: [...] }`; `carregarTarifasPainel` chamado com `(expect.anything(), expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))`.
- `'falha na leitura: 500'`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/app/api/painel/tarifas`
Expected: FAIL (rota não existe).

- [ ] **Step 3: Implementar a rota**

Mesmo formato de `src/app/api/efetivo/linhas/route.ts`, com `export const dynamic = 'force-dynamic'` e `process.env.FINANCEIRO_SEGREDO_PAINEL`.

- [ ] **Step 4: Verificar**

Run: `npm test && npm run typecheck && npm run lint`
Expected: tudo verde.

- [ ] **Step 5: Commit, PR e merge**

```bash
git add src/app/api/painel .env.example && git commit -m "feat(painel): rota de leitura das tarifas por vaga para o Painel"
git push -u origin feat/tarifas-painel && gh pr create --fill
```

O merge vai para o ar antes da parte do painel (o painel aguenta a rota ausente).

### Task 3: Painel — ler as tarifas do Financeiro

Repositório `~/painel-mobilizacao`, branch `feat/relatorio`.

**Files:**
- Modify: `src/lib/financeiro/contrato.ts` (acrescentar `TarifaVaga` e `RespostaTarifasVagas`, idênticos aos da Task 1)
- Create: `src/lib/financeiro/tarifas.ts`
- Test: `src/lib/financeiro/__tests__/tarifas.test.ts`
- Modify: `.env.example` e `README.md` (seção Variáveis: `FINANCEIRO_ENDERECO`, endereço do Financeiro sem `/` no fim)

**Interfaces:**
- Produces: `buscarTarifasFinanceiro(f: typeof fetch = fetch): Promise<Map<string, TarifaVaga> | null>`, com a chave `painelVagaId`.

- [ ] **Step 1: Criar a branch (`git checkout -b feat/relatorio`) e escrever os testes** (`fetch` falso via `vi.fn`; `process.env.FINANCEIRO_ENDERECO='https://fin'` e `FINANCEIRO_SEGREDO='s'`)
- `'chama a rota com o segredo e devolve um mapa por vaga'`: URL `'https://fin/api/painel/tarifas'`, header `Authorization: 'Bearer s'`, `cache: 'no-store'`; `mapa.get('v1')?.valor === 24108.83`.
- `'sem endereço ou sem segredo: null sem chamar'`.
- `'versão diferente de 1: null'`.
- `'HTTP 500: null'`.
- `'fetch que rejeita (rede ou tempo esgotado): null'`.
- `'aborta depois de 4 s'`: com `vi.useFakeTimers()`, um fetch que só resolve no abort; avançar 4000 ms → `null`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/financeiro/__tests__/tarifas.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `buscarTarifasFinanceiro`**

Use `AbortController` + `setTimeout(4000)` e `try/catch/finally`, como `buscar` em `~/financeiro/src/lib/integracoes/buscar.ts`. O segredo vem de `segredoFinanceiro()`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/financeiro && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/financeiro .env.example README.md && git commit -m "feat(relatorio): leitura das tarifas do Financeiro"
```

### Task 4: Painel — montar o relatório (domínio)

**Files:**
- Create: `src/dominio/relatorio.ts`
- Test: `src/dominio/__tests__/relatorio.test.ts`

**Interfaces:**
- Consumes: `VagaPainel` (`@/dominio/painel`), `EtapaDef` (`@/dominio/etapas`), `TarifaVaga` (Task 3).
- Produces:

```ts
export type LinhaRelatorio = {
  id: string
  nome: string            // candidato; vazio → funcao
  vagaAberta: boolean     // sem candidato
  tipo: 'MOD' | 'MOI' | null
  funcao: string; disciplina: string; area: string
  onda: string | null; meta: string
  cobrada: boolean        // false só quando o Financeiro diz que não é cobrada (MOI / não cobrar)
  taxa: number | null
  etapas: (string | null)[] // concluidaEm de cada etapa, na ordem de `Relatorio.etapas`
  mobilizada: boolean
}
export type Relatorio = {
  etapas: { ordem: number; nome: string }[]
  linhas: LinhaRelatorio[]
  percentuais: number[]     // 0..1 por etapa: concluídas ÷ linhas; 0 sem linhas
  totalTaxas: number        // soma das taxas não nulas
  totalTaxasMobilizadas: number
  semTarifa: number         // linhas cobradas com taxa nula (não conta MOI / não cobrar)
  tarifasIndisponiveis: boolean // tarifas === null
}
export function montarRelatorio(vagas: VagaPainel[], etapas: EtapaDef[], tarifas: Map<string, TarifaVaga> | null): Relatorio
```

- [ ] **Step 1: Escrever os testes** (vagas com `vagaExemplo` de `src/test/vagas.ts` e `ETAPAS_PADRAO`)
- `'uma coluna por etapa, na ordem, com a data de conclusão'`: vaga com `etapaAtual: 3` → `etapas[0]` e `etapas[1]` = `'2026-10-22'`, `etapas[2]` = `null`; `relatorio.etapas.map((e) => e.nome)` igual a `ETAPAS_PADRAO` ordenadas.
- `'percentual por etapa'`: 4 vagas (etapaAtual 1, 2, 3, null) → `percentuais[0] === 0.75` e `percentuais[1] === 0.5`.
- `'sem vagas: percentuais zero e totais zero'`.
- `'nome é o candidato, ou a função com vagaAberta'`.
- `'tipo e taxa do Financeiro; totais e sem tarifa'`: v1 MOD cobrada 24108.83 mobilizada, v2 MOD cobrada 12809.51, v3 MOI `cobrada: false`, v4 ausente do mapa → `totalTaxas === 36918.34`, `totalTaxasMobilizadas === 24108.83`, `semTarifa === 1` (só v4); v3 com `tipo: 'MOI', cobrada: false, taxa: null`; v4 com `tipo: null, cobrada: true, taxa: null`.
- `'Financeiro indisponível'`: `tarifas = null` → `tarifasIndisponiveis: true`, `semTarifa === vagas.length`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/dominio/__tests__/relatorio.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `montarRelatorio`**

Ordene `etapas` por `ordem` e encontre cada etapa em `v.previsao.etapas` pela `ordem`. Use `v.situacao.mobilizada`. Para evitar erro de ponto flutuante na soma, arredonde os totais a centavos (`Math.round(x * 100) / 100`).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/dominio && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dominio/relatorio.ts src/dominio/__tests__/relatorio.test.ts && git commit -m "feat(relatorio): montagem do relatório por vaga e etapa"
```

### Task 5: Painel — aba e tela do Relatório

**Files:**
- Create: `src/app/(painel)/projetos/[id]/relatorio/page.tsx`
- Create: `src/app/(painel)/projetos/[id]/relatorio/TabelaRelatorio.tsx`
- Test: `src/app/(painel)/projetos/[id]/relatorio/__tests__/TabelaRelatorio.test.tsx`
- Modify: `src/app/(painel)/projetos/[id]/AbasProjeto.tsx` e o seu teste
- Create: `src/lib/formato/moeda.ts` (`reais(valor: number): string` → `"R$ 24.108,83"`, via `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`)

**Interfaces:**
- Consumes: `montarRelatorio` (Task 4), `buscarTarifasFinanceiro` (Task 3), `carregarPainel`, `filtrarVagas`, `hojeSP`, `dataBR`.
- Produces: `TabelaRelatorio({ relatorio, porOndas }: { relatorio: Relatorio; porOndas: boolean })`.

- [ ] **Step 1: Escrever os testes**

`AbasProjeto.test.tsx`: atualizar para `['Resumo', 'Painel', 'Relatório', 'Configurar']` (equipe) e `['Resumo', 'Painel', 'Relatório']` (gestor/cliente), com `href` `/projetos/p1/relatorio`.

`TabelaRelatorio.test.tsx` (com um `Relatorio` montado à mão):
- `'cabeçalho na ordem da planilha'`: colunas `Nome, Tipo, Função, Disciplina, Área, Onda, Taxa` + nomes das etapas (com `porOndas: false`, a coluna é `Meta`).
- `'OK nas etapas concluídas, com a data no title'`: célula com texto `OK` e `title="22/10/2026"`; etapa não concluída sem texto.
- `'taxa em reais, Não cobrada e — sem tarifa'`: `R$ 24.108,83`, `Não cobrada` (linha com `cobrada: false`) e `—`.
- `'vaga aberta mostra a função em texto suave'`: o nome tem a classe `text-texto-suave`.
- `'rodapé com % por etapa e totais'`: `75%`, `Total das taxas: R$ 36.918,34`, `Mobilizadas: R$ 24.108,83`, `1 vaga sem tarifa`.
- `'aviso quando o Financeiro está fora'`: `tarifasIndisponiveis: true` → texto "Não foi possível ler as tarifas do Financeiro agora".
- `'sem vagas'`: texto "Nenhuma vaga".

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run "src/app/(painel)/projetos/[id]"`
Expected: FAIL (aba nova e componente ausentes).

- [ ] **Step 3: Implementar**

- `AbasProjeto`: entrada `{ href: \`${base}/relatorio\`, rotulo: 'Relatório' }` depois do Painel, para todos.
- `page.tsx`: mesmo esqueleto de `resumo/page.tsx` (validação do uuid, `carregarPainel` com `notFound`, o mesmo seletor de onda com links para `/projetos/${id}/relatorio?onda=`). `metadata.title` `'Relatório · Painel de Mobilização'`. Chame `carregarPainel` e `buscarTarifasFinanceiro()` em `Promise.all`. No topo, o link "Baixar Excel" para `/projetos/${id}/relatorio/excel` (mantém o `?onda=` quando houver).
- `TabelaRelatorio`: `<table>` dentro de um `div` com `overflow-x-auto`, cabeçalho `sticky top-0`, `<tfoot>` com a linha de % e o resumo dos totais. Use os tokens de cor que o projeto já tem (`border-borda`, `bg-superficie`, `text-texto-suave`).

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test && npm run typecheck && npm run lint`
Expected: tudo verde.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(painel)/projetos/[id]" src/lib/formato/moeda.ts && git commit -m "feat(relatorio): aba Relatório do projeto"
```

### Task 6: Painel — baixar em Excel

**Files:**
- Create: `src/lib/relatorio/excel.ts`
- Test: `src/lib/relatorio/__tests__/excel.test.ts`
- Create: `src/app/(painel)/projetos/[id]/relatorio/excel/route.ts`
- Test: `src/app/(painel)/projetos/[id]/relatorio/excel/__tests__/route.test.ts`
- Modify: `src/app/(painel)/projetos/[id]/modelo/route.ts`: mover `nomeArquivo` para `src/lib/formato/arquivo.ts` e importar dos dois lugares.

**Interfaces:**
- Consumes: `Relatorio` (Task 4), `nomeArquivo` (movido), `dataBR`.
- Produces: `gerarExcelRelatorio(p: { relatorio: Relatorio; projeto: string; onda: string | null; porOndas: boolean; hoje: string }): Promise<Buffer>`.

- [ ] **Step 1: Escrever os testes**

`excel.test.ts` (relê o buffer com `ExcelJS.Workbook().xlsx.load`):
- `'aba Relatório com título, data e cabeçalho na linha 4'`: A1 `"<projeto> · Relatório de mobilização"`, A2 `"Gerado em 17/11/2026"` (com a onda: `" · Onda 1"`), linha 4 igual ao cabeçalho da tela, `views[0].ySplit === 4`.
- `'OK nas etapas concluídas e taxa como número em moeda'`: a célula da etapa vale `'OK'`; a da taxa vale `24108.83` com `numFmt` contendo `R$`; não cobrada vale `'Não cobrada'`; sem tarifa fica vazia.
- `'rodapé com % por etapa e totais'`: na linha "% concluído", o valor `0.75` com `numFmt '0%'`; linhas "Total das taxas", "Total das taxas (mobilizadas)" e "Vagas sem tarifa" com os valores.
- `'Financeiro indisponível: linha de aviso'`: A3 contém "Tarifas indisponíveis".

`route.test.ts` (mock de `obterSessao`, `carregarPainel`, `buscarTarifasFinanceiro`):
- `'sem sessão: 404'`.
- `'projeto que o usuário não vê (carregarPainel null): 404'`.
- `'id inválido: 404'`.
- `'cliente baixa: 200, xlsx, nome relatorio-<projeto>-<data>.xlsx'`.
- `'onda de outro projeto é ignorada'`: `?onda=xyz` → todas as vagas.
- `'Financeiro fora: ainda gera o arquivo'`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/relatorio "src/app/(painel)/projetos/[id]/relatorio/excel"`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`gerarExcelRelatorio`: largura das colunas com `Math.max(12, título + 4)`, Nome e Função com 32; formato de moeda `'"R$" #,##0.00'`. Na linha do %, cada etapa vale o próprio número. As linhas de total ficam abaixo, com o rótulo na coluna A e o valor na coluna da Taxa.

A rota segue `modelo/route.ts`, mas aceita qualquer sessão (o RLS decide). Ela filtra a onda como a página e responde com `Content-Disposition: attachment; filename="relatorio-${nomeArquivo(projeto)}-${hoje}.xlsx"` e `Cache-Control: no-store`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test && npm run typecheck && npm run lint`
Expected: tudo verde.

- [ ] **Step 5: Commit**

```bash
git add src/lib/relatorio src/lib/formato/arquivo.ts "src/app/(painel)/projetos/[id]" && git commit -m "feat(relatorio): baixar o relatório em Excel"
```

### Task 7: Conferir no app, publicar e configurar

- [ ] **Step 1: Ver funcionando localmente**

Com `FINANCEIRO_ENDERECO` no `.env.local` apontando para o Financeiro no ar (ou ausente, para ver o aviso), rode `npm run dev` e abra `/projetos/<id>/relatorio`. Confira a tabela, o OK com a data ao passar o mouse, o rodapé e o "Baixar Excel" abrindo no Excel. Tire um screenshot.

- [ ] **Step 2: PR do painel**

```bash
git push -u origin feat/relatorio && gh pr create --fill
```

- [ ] **Step 3: Depois do merge (Joel)**

1. Vercel do painel: `FINANCEIRO_ENDERECO` (o `FINANCEIRO_SEGREDO` já existe).
2. Projeto 2027 → Configurar: etapas Captura → Entrevistas → Validação BRK → Exames → Admissão → Treinamentos → Mobilizado.
3. Importar as vagas pelo modelo e conferir, no Relatório, a taxa de algumas vagas contra a Planilha1.
