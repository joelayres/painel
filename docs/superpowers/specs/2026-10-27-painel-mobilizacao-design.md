# Painel de Mobilização: desenho

Data: 2026-10-27 · Pedido do Joel (gerente de contratos, Timenow) · Projeto novo, separado do sistema de horas extras (HE Timenow).

## Por quê

A Timenow vai contratar 50 colaboradores para a **Mobilização Braskem 2027**. Hoje o acompanhamento fica numa planilha, `Acompanhamento Mobilizações.xlsx`, com uma linha por vaga e as etapas embaixo de cada uma. O cliente (Braskem), que pede as contratações, e os gestores precisam ver, **batendo o olho**, em que etapa cada vaga está e se cada onda vai ser entregue no prazo. O RH da Timenow precisa planejar e avançar as etapas.

**Sucesso:**
- O cliente abre o painel e entende em segundos como está cada onda e o que está atrasado.
- O RH avança uma etapa com um clique.
- A planilha deixa de ser a fonte da verdade.

## Decisões do Joel

1. O painel fica **online**, em **painel.sudeste-timenow.com.br**, com **login**. Entram o cliente, os gestores e o RH.
2. **O RH avança as etapas no painel.** A planilha serve só para a carga inicial.
3. **Todos que entram veem todas as vagas.** Só o RH altera.
4. Cada vaga tem uma **data de início do processo**. O sistema calcula a **data estimada de conclusão** somando as durações das etapas.
5. **Todas as durações são em dias úteis.**
6. As contratações são feitas em **4 ondas**, cada uma com data de início e de fim próprias.
7. **13 etapas**: as 12 da planilha mais **Treinamento**, com 5 dias úteis, no fim.
8. Cada vaga tem um **gestor**, cadastrado pelo RH.
9. **Filtros**: função, área, gestor e candidato (busca pelo nome, quando já houver).
10. **Layout**: no topo, a **visão por onda**, com cartões de onda e a lista "Precisa de atenção". Embaixo, o **quadro por etapa** (kanban), com uma coluna por etapa e um cartão por vaga. Corresponde às opções C e A escolhidas no esboço.
11. **Cores do prazo**:
    - **vermelho (atrasado)**: a etapa atual passou da data prevista;
    - **amarelo (em risco)**: a etapa está no prazo, mas a **admissão** estimada da vaga cai depois do fim da onda;
    - **verde**: no prazo.
12. **O compromisso da onda é a Admissão Timenow (etapa 11).** A vaga está entregue na onda quando a pessoa é admitida. A Atualização da CTPS e o Treinamento vêm depois e não contam para o prazo da onda.

## As etapas (ordem e duração padrão, em dias úteis)

| # | Etapa | Duração |
|---|---|---|
| 1 | Abertura de vaga | 1 |
| 2 | Captura de Mercado | 4 |
| 3 | Triagem de Candidatos | 1 |
| 4 | Entrevista - Timenow | 1 |
| 5 | Entrevista - TNGO/Braskem | 1 |
| 6 | Envio para contratação | 0 |
| 7 | Agendamento exames | 2 |
| 8 | Realização de Exames | 1 |
| 9 | Liberação dos exames | 7 |
| 10 | Ambientação/TBS | 1 |
| 11 | Admissão Timenow | 0 |
| 12 | Atualização da CTPS | 3 |
| 13 | Treinamento | 5 |

As durações de 1 a 12 vêm da planilha. Etapas de duração 0 são marcos: terminam no mesmo dia em que começam.

**Atenção:** na planilha, as datas nem sempre seguem as durações à risca. "Liberação dos exames" (7 dias) vai de 11/11 a 19/11, e "Ambientação" começa em 23/11, não em 20/11. O sistema segue a regra deste documento, não as datas da planilha.

## A planilha atual (carga inicial)

- Uma aba ("Planilha1") com 652 linhas.
- **Linha de vaga** (nome com até 3 espaços à esquerda), com as colunas:
  - `Mobilização Braskem 2027`: a função (ex.: "Técnico de Planejamento");
  - `Disciplina` (ex.: "NR-13", "Fornos");
  - `Atuação` (ex.: "Caldeiraria", "Planejamento");
  - `duração`, `inicio`, `fim` (ex.: "Qui 22/10/26");
  - `Conclusão` (fração);
  - `Ondas` ("1º Onda" a "4º Onda");
  - `Candidato` (vazio ou nome).
- **Linhas de etapa** (nome com 6 espaços à esquerda) vêm logo abaixo de cada vaga, com início, fim e `Conclusão` (1 = feita, 0 = não).
- São 50 vagas reais e uma linha "Treinamento - Braskem" sem dados, que é ignorada.
- Distribuição: 1ª onda com 17 vagas, 2ª com 20, 3ª com 4 e 4ª com 9.
- **Na carga inicial**:
  - a data de início da vaga é a data `inicio` da linha da vaga;
  - as etapas com `Conclusão = 1` ficam concluídas, com a data `fim` da planilha como data real;
  - a etapa atual é a primeira não concluída;
  - o candidato vem da coluna `Candidato`;
  - o gestor fica vazio, para o RH preencher.

## Regras de cálculo

- **Dias úteis**: de segunda a sexta, menos os feriados cadastrados. O sistema vem com os feriados nacionais de 2026 e 2027, e o RH cadastra os estaduais e municipais do local de trabalho. Os feriados valem para todas as vagas. **[Claude]**
- **Previsão de cada etapa**:
  - A etapa 1 começa na data de início da vaga, ajustada para o próximo dia útil se cair em fim de semana ou feriado.
  - Uma etapa de N dias (N ≥ 1) termina no N-ésimo dia útil contando o dia de início.
  - Uma etapa de 0 dias termina no próprio dia de início.
  - A próxima etapa começa no dia útil seguinte ao fim da anterior. Depois de uma etapa de 0 dias, a próxima começa no mesmo dia.
  - Isso reproduz a planilha: "Captura de Mercado", 4 dias, começando na sexta 23/10, termina na quarta 28/10. **[Claude]**
- **Data real**:
  - Quando o RH conclui uma etapa, a data real de conclusão é gravada.
  - A data é a de hoje (horário de SP), e o RH pode trocar por uma data passada. **[Claude]**
  - A previsão das etapas seguintes é recalculada a partir dessa data real.
  - Assim, um atraso ou adiantamento muda a conclusão estimada na hora.
- **Admissão estimada**: o fim previsto da etapa 11 (Admissão Timenow), ou a data real, se ela já foi concluída. É a data comparada com o fim da onda. **[Joel]**
- **Conclusão estimada**: o fim previsto da etapa 13 (Treinamento). Aparece no detalhe da vaga, só como informação.
- **Atraso (vermelho)**: hoje é depois do fim previsto da etapa atual.
- **Risco (amarelo)**: não está atrasada, mas a admissão estimada é depois do fim da onda da vaga. Depois da admissão, a vaga não fica mais amarela.
- **Admitida**: a etapa 11 foi concluída. Conta como **entregue** na onda, e o cartão da onda mostra "N admitidos de M". A vaga continua no quadro até o Treinamento.
- **Mobilizada**: as 13 etapas concluídas. A vaga sai do quadro.
- **Duração alterada pelo RH**: vale para as previsões de todas as vagas a partir dali. As etapas não concluídas são recalculadas na hora, e as datas reais já gravadas não mudam. A mudança fica num registro geral, com quem mudou, quando e de quanto para quanto. **[Claude]**
- **Início da etapa atual** = dia útil seguinte à data real de conclusão da etapa anterior, ou a data de início da vaga, se for a etapa 1. "Dias na etapa atual" conta dias úteis desde esse início. **[Claude]**
- **Sempre a partir das datas reais**: a previsão é sempre recalculada a partir da última data real. Uma etapa concluída antes ou depois do previsto desloca as seguintes. Depois da carga inicial, vagas cujas datas da planilha já estejam fora da regra aparecem vermelhas ou amarelas na hora, e isso é o comportamento esperado. **[Claude]**
- **Contagens das ondas**: as cores (no prazo, em risco, atrasada) contam só as vagas **em andamento**. As mobilizadas aparecem num número à parte ("12 mobilizadas"). O fim da onda é inclusivo: concluir no próprio dia do fim está no prazo. O atraso compara datas (hoje > fim previsto), mesmo em fim de semana. **[Claude]**
- **Mudar a onda ou a data de início** de uma vaga já em andamento recalcula a previsão a partir das datas reais. A data de início só pesa enquanto a etapa 1 não foi concluída. A troca de onda muda só o prazo usado na comparação. **[Claude]**
- **Candidato**: avançar etapas não exige candidato. O RH preenche o nome quando houver, na edição da vaga. **[Claude]**

## Telas

### Painel (todos os perfis)

**Topo**
- Nome da mobilização, data de hoje e um botão "Sair".

**Filtros**
- Onda, função, área (= Atuação), gestor e candidato (busca por texto).
- Valem para todo o painel e ficam no endereço da página, para que um link filtrado possa ser compartilhado. **[Claude]**

**Visão por onda** (4 cartões)
- Número da onda, período (início e fim) e quantidade de vagas.
- Barra de progresso: **admitidos de M vagas**, o compromisso da onda, além do número de mobilizados. **[Claude]**
- Contagem de vagas no prazo, em risco e atrasadas.
- Clicar num cartão filtra o painel por aquela onda.

**Precisa de atenção**
- Lista das vagas atrasadas ou em risco, com função, disciplina, gestor, etapa atual, dias parados nela, conclusão prevista e fim da onda.
- Ordenada por gravidade: atrasadas primeiro, depois as mais atrasadas. **[Claude]**

**Quadro por etapa**
- Uma coluna por etapa, com a contagem no título.
- **Cartão da vaga**:
  - função, disciplina, gestor e candidato (quando houver);
  - dias na etapa atual e conclusão prevista;
  - faixa colorida conforme o prazo.
- Em telas estreitas (celular), as colunas rolam na horizontal. **[Claude]**
- Uma coluna "Mobilizadas" no fim, recolhida por padrão, mostra só a contagem. **[Claude]**

**Detalhe da vaga** (ao clicar no cartão)
- Os dados da vaga.
- As 13 etapas com início e fim previstos e a data real de conclusão.
- O histórico do que mudou: quem e quando. Mostra o **nome** de quem alterou, nunca o e-mail. **[Claude]**
- O nome do candidato aparece para todos os perfis, inclusive o cliente, porque o Joel pediu filtro por candidato.

### Ações do RH (só perfil RH)

**No detalhe da vaga**
- **"Concluir etapa"**: grava a data real, que pode ser trocada, e passa a vaga para a próxima etapa.
- **"Desfazer último avanço"**: volta a última etapa concluída para em andamento, apaga a data real dela e recalcula a previsão. Pode ser repetido, uma etapa por vez. **[Claude]**
- **"Candidato desistiu"**:
  - volta a vaga para "Captura de Mercado" e limpa o candidato;
  - as datas reais das etapas a partir da Captura são apagadas e a previsão é recalculada a partir de hoje;
  - o histórico guarda o que aconteceu. **[Claude]**
- **Editar** a vaga: função, disciplina, área, onda, gestor, data de início e candidato.

**Cadastros**
- Ondas (número, início e fim).
- Gestores (nome e e-mail).
- Vagas: criar e cancelar. Uma vaga cancelada some do painel e fica na lista de canceladas.
- Durações das etapas.
- Feriados.
- Usuários (nome, e-mail e perfil: `rh` ou `visualizador`).

**Carga inicial**
- Importa a planilha no formato descrito acima.
- Mostra uma prévia (vagas, etapas concluídas, erros) antes de gravar.
- Pode ser usada uma vez com o banco vazio. **[Claude: para não duplicar vagas]**

## Acesso

- **Login por código enviado ao e-mail, sem senha**, igual ao do sistema de horas extras.
- Só entra quem o RH cadastrou como usuário.
- **Perfis**:
  - `rh`: vê e altera tudo;
  - `visualizador`: cliente e gestores, vê tudo e não altera nada.
- Um gestor cadastrado como responsável por vagas não ganha acesso automaticamente: o RH cadastra o usuário. **[Claude]**
- A segurança fica no banco (Row Level Security): o visualizador só lê, e o RH lê e escreve.

## Como é construído **[Claude, aprovado pelo Joel]**

- Next.js (App Router) na Vercel e Supabase (Postgres, Auth, RLS).
- **Repositório novo** em `/Users/joelayres/painel-mobilizacao`.
- **Projeto Supabase novo, só para este painel**, separado do de horas extras. O plano gratuito permite 2 projetos.
- **Também um projeto Supabase de testes separado**, ou testes de integração que não toquem o banco real. No HE Timenow, o banco de "desenvolvimento" era o de produção, e isso causou problema.
- E-mails de login pelo Resend, com o domínio sudeste-timenow.com.br já verificado no HE Timenow.
- Domínio: subdomínio `painel` em sudeste-timenow.com.br, apontado para o projeto Vercel novo.
- Visual: na mesma família do HE Timenow (fontes, cores e tema claro/escuro), adaptado para leitura à distância, com números grandes e cores fortes. **[Claude]**

## Fora do escopo

- Integração com sistemas de RH, de ponto ou da Braskem.
- E-mails de aviso (de atraso, etapa concluída etc.). Fica para uma fase 2. **[Claude]**
- Etapas diferentes por função. Todas as vagas usam as mesmas 13 etapas.
- Duração por vaga. A duração é por etapa e vale para todas.
- Anexos ou documentos dos candidatos.
- Mais de uma mobilização ao mesmo tempo. **[Claude: fica para depois; o modelo já tem a mobilização como cabeçalho]**

## Anti-objetivos (seria falha mesmo funcionando)

- O cliente precisar de explicação para entender o painel.
- Um atraso real aparecer verde.
- O RH precisar de mais de dois cliques para avançar uma etapa.
- Um visualizador conseguir alterar qualquer coisa.

## Deixado para quem construir

- O modelo de dados exato, a estrutura do projeto e os testes.
- O texto exato das telas, no tom do HE Timenow.

## Questões abertas

- Nenhuma. A revisão perguntou qual é o marco de entrega da onda, e o Joel respondeu: a Admissão Timenow (decisão 12).
