# Relatório de mobilização com tarifa — design

Data: 2026-11-17 · Autor: Joel Ayres (com Claude) · Status: rascunho para aprovação

## 1. Por que existe

O cliente da mobilização 2027 acompanha o projeto numa planilha ("MOBILIZAÇÃO TIMENOW 2027", aba Planilha1): uma linha por vaga com Nome, Tipo (MOD/MOI), Função, Pacote/Escopo e Taxa, e as etapas Entrevistas → Validação BRK → Exames → Admissão → Treinamentos → Mobilizado marcadas com "OK". No rodapé fica o % de vagas que já passaram por cada etapa. Ele quer ver isso no painel, inclusive a taxa que vai pagar.

O painel já tem as vagas e as datas das etapas. Ele não tem o Tipo nem a Taxa, que já estão no Financeiro: cada vaga do painel tem lá um registro (`vagas.painel_vaga_id`) com `status` (`ativo` ou `moi`) e `local` + `linha`, que levam à tarifa vigente (`tarifas`).

**Sucesso:** o cliente abre o projeto, vê a mesma tabela da planilha sempre atualizada (etapas do painel e tarifa do Financeiro) e baixa em Excel quando quiser. A equipe deixa de manter a planilha à mão.

## 2. Objetivos e não-objetivos

**Objetivos**
- Aba **Relatório** em cada projeto, para todos os perfis que veem o projeto (inclusive Cliente).
- Tipo e Taxa lidos do Financeiro **a cada abertura**, sem cópia no painel: se a linha da vaga ou a tarifa mudar lá, o relatório muda junto.
- Botão **Baixar Excel** com a mesma tabela.

**Não-objetivos**
- Rentabilidade, salário, encargos ou margem (abas RENTABILIDADE e PONTOS DE ATENÇÃO). Ficam no Financeiro.
- Cadastrar tarifa, tipo ou linha no painel. O cadastro continua só no Financeiro.
- Mudar a regra das etapas. O projeto é configurado na aba Configurar (§6).

## 3. Mapeamento planilha → painel

| Planilha | Relatório |
|---|---|
| Nome | candidato; vazio → a função da vaga, em texto suave ("vaga em aberto") |
| Tipo | Financeiro: `status` `ativo` → **MOD**, `moi` → **MOI** |
| Função | `funcao` |
| Pacote / Escopo | `disciplina` e `area` (duas colunas) |
| Taxa | Financeiro: tarifa vigente no mês atual da `local` + `linha` da vaga (R$/mês) |
| Etapas com "OK" | uma coluna por etapa do projeto, na ordem dele (inclusive Captura), com **OK** quando concluída; vazio = não concluída. A data fica no `title` da célula, mas o que aparece é só OK |
| Rodapé % | por etapa: vagas que concluíram ÷ total de vagas do relatório |

Vagas canceladas ficam de fora, como no resto do painel. Com o projeto em ondas, o relatório tem o mesmo filtro de onda do Resumo (Todas / cada onda) e uma coluna Onda; em projeto por meta, uma coluna Meta.

**Rodapé, além do %:** total das taxas de todas as vagas listadas e total das taxas das vagas mobilizadas (última etapa concluída). As vagas sem tarifa não entram na soma, e o rodapé diz quantas são ("3 vagas sem tarifa").

## 4. Integração com o Financeiro

Hoje só o Financeiro chama o painel (`/api/financeiro/vagas`). Agora o painel também passa a chamar o Financeiro.

**No Financeiro**, uma rota nova `GET /api/painel/tarifas`, que devolve todas as vagas do painel cadastradas no Financeiro (são poucas centenas; o painel filtra as do projeto, e assim não há lista de ids no endereço), protegida pelo segredo compartilhado (404 sem segredo configurado, 401 com segredo errado, como as outras rotas):

```ts
// Mude nos dois repositórios ao mesmo tempo.
export type TarifaVaga = {
  painelVagaId: string
  tipo: 'MOD' | 'MOI'
  cobrada: boolean          // false para MOI e "não cobrar"
  linha: string | null      // "12/2026"; null = vaga sem linha cadastrada
  descricao: string | null  // descrição da linha na tabela de tarifas
  valor: number | null      // tarifa vigente no mês atual (vigente(), mesma regra da medição); null se não cobrada, sem linha ou sem vigência
}
export type RespostaTarifasVagas = { versao: 1; vagas: TarifaVaga[] }
```

Uma vaga que o Financeiro não conhece não volta na resposta.

**De onde vem cada valor (mesma regra da tela Mês do Financeiro):**
- Vaga **ligada a uma pessoa** (`vagas.pessoa_id`): vale a vigência da pessoa no mês atual (`pessoa_vigencias`, via `vigente`). Status `moi` → MOI; `ativo`, `afastado` e `nao_cobrar` → MOD. A linha e o local vêm dessa vigência. Se a pessoa não tiver vigência no mês, cai no cadastro da vaga.
- Vaga **sem pessoa**: vale o cadastro da vaga (`vagas.status`, `local`, `linha`).
- **Valor:** a tarifa da `local` + `linha` vigente no mês atual (`tarifasDoMes`), para `ativo` e `afastado`. **MOI e "não cobrar" não têm tarifa**: `cobrada: false` e `valor: null`, mesmo com linha cadastrada.
- No relatório, uma vaga com `cobrada: false` mostra "Não cobrada" na Taxa (MOI já aparece no Tipo) e **não** entra na contagem "sem tarifa", que fica só para as vagas cobradas sem valor (sem cadastro, sem linha ou sem vigência).

**Segredo:** o Financeiro aceita o mesmo valor que já usa para chamar o painel (`FINANCEIRO_SEGREDO_PAINEL`), e o painel envia o seu `FINANCEIRO_SEGREDO`. As duas variáveis já existem com o mesmo valor. Só o painel ganha uma variável nova, `FINANCEIRO_ENDERECO`.

**No painel**, `src/lib/financeiro/tarifas.ts` busca essa rota (endereço em `FINANCEIRO_ENDERECO`), com limite de 4 s e sem cache. Ela **nunca lança**: se o Financeiro estiver fora do ar ou responder errado, devolve `null`. A página faz uma chamada só e monta um `Map` por `painelVagaId`.

**Falhas que aparecem na tela:**
- Financeiro fora do ar: Tipo e Taxa vêm como "—", e um aviso acima da tabela diz "Não foi possível ler as tarifas do Financeiro agora". As etapas aparecem normalmente.
- Vaga desconhecida no Financeiro, ou sem linha: Tipo e Taxa "—", e ela entra na contagem "sem tarifa".

## 5. Tela e Excel

- **Aba:** Resumo · Painel · **Relatório** · Configurar. Rota `/projetos/[id]/relatorio`, server component. Usa `carregarPainel` (vagas, etapas e previsão já calculados) mais a leitura das tarifas.
- **Tabela:** cabeçalho fixo e rolagem horizontal no celular. Ordem: Nome, Tipo, Função, Disciplina, Área, Onda/Meta, Taxa, etapas. As linhas seguem a ordem do painel. A Taxa vem em R$ com duas casas.
- **Excel:** rota `/projetos/[id]/relatorio/excel`, com a mesma verificação de acesso da página (o RLS do Supabase decide quem lê o projeto) e o filtro de onda da tela. A planilha tem uma aba "Relatório", o título com o projeto e a data, o cabeçalho em negrito congelado, "OK" nas etapas concluídas (como na planilha do cliente), a Taxa em moeda e o rodapé com % e totais como valores (não fórmulas). Nome do arquivo: `relatorio-<projeto>-<AAAA-MM-DD>.xlsx`. Usa `exceljs`, que o painel já tem.
- O cálculo da tabela (linhas, %, totais, contagem sem tarifa) é uma função pura em `src/dominio/relatorio.ts`, que a tela e o Excel usam igual.

## 6. Configuração do projeto 2027 (sem código)

Na aba Configurar do projeto, deixar a lista como **Captura → Entrevistas → Validação BRK → Exames → Admissão → Treinamentos → Mobilizado**, com as durações combinadas com o cliente. A Captura é uma etapa própria (busca de candidatos), diferente das Entrevistas, e continua fixa: é para onde a vaga volta quando o candidato desiste. Por isso o relatório tem uma coluna a mais que a planilha do cliente. Depois, importar as vagas pela planilha modelo, com as datas das etapas já concluídas.

## 7. Testes

- `dominio/relatorio`: % por etapa, totais com e sem tarifa, vaga sem candidato, filtro de onda.
- `lib/financeiro/tarifas`: resposta válida, versão errada, erro HTTP, tempo esgotado → `null`.
- Tela: OK nas etapas concluídas e vazio nas demais, tabela com tarifa, aviso de Financeiro fora do ar, "—" para vaga sem tarifa, aba visível para o Cliente.
- Rota do Excel: acesso negado sem sessão; cabeçalho e rodapé corretos.
- Financeiro: rota com e sem segredo, vaga MOI, vaga sem linha, tarifa com duas vigências (pega a do mês atual).

## 8. Ordem de entrega

1. Financeiro: rota `/api/painel/tarifas` (no ar antes; o painel aguenta ela ausente).
2. Painel: domínio, leitura, aba, Excel. Configurar `FINANCEIRO_ENDERECO` na Vercel.
3. Configurar as etapas do projeto 2027 e importar as vagas.
