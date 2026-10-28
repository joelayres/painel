# Etapas por projeto: desenho

Data: 2026-10-28 · Pedido do Joel (gerente de contratos, Timenow) · Evolução do Painel de Mobilização, depois dos [projetos de mobilização](2026-10-28-projetos-de-mobilizacao-design.md).

## Por quê

Hoje todas as vagas de todos os projetos seguem as mesmas 13 etapas, fixas no banco e no cálculo. Clientes e projetos diferentes têm processos diferentes.

- **Etapas que entram:** algumas mobilizações têm etapas a mais, como "Cadastro em sistema" e "Cadastro no eSocial".
- **Etapas que saem:** outras não têm Treinamento ou Integração.

O Joel também pediu que o RH possa avançar uma vaga arrastando o cartão no quadro do Painel, inclusive pulando etapas.

Com a lista fixa, o painel mostra etapas que não existem e esconde etapas que existem, e as previsões ficam erradas.

**Sucesso:**
- O RH monta a lista de etapas de um projeto, incluindo, excluindo e renomeando, sem ajuda técnica.
- O Resumo, o Painel, o detalhe da vaga e o modelo de importação passam a mostrar as etapas daquele projeto.
- Um projeto em andamento recebe uma etapa nova sem que vaga nenhuma fique atrasada por uma etapa que não existia quando ela passou por aquele ponto.

## Decisões do Joel

1. **A lista de etapas é por projeto.** O padrão continua sendo as 13 etapas de hoje: todo projeto novo começa com elas, e o projeto muda o que precisar.
2. **Captura de Mercado e Admissão Timenow existem em toda mobilização** e não podem ser excluídas. As outras etapas podem ser incluídas e excluídas.
3. **A lista pode mudar com o projeto em andamento**, com as regras abaixo:
   - **Incluir uma etapa:** as vagas que ainda não chegaram àquele ponto passam por ela. As vagas que já passaram dele ficam com a etapa concluída automaticamente, e o histórico registra isso.
   - **Excluir uma etapa:** ela sai da lista e do cálculo de todas as vagas. As datas de quem já tinha concluído a etapa não se perdem: ficam no histórico da vaga.
   - **Mudar a ordem** só é permitido enquanto o projeto não tem vagas.

## Regras

### A lista de etapas do projeto
- Cada etapa do projeto tem **nome**, **duração** em dias úteis (0 = marco, termina no dia em que começa, como hoje) e **posição** na lista.
- **Etapas fixas:** Captura de Mercado e Admissão Timenow. Elas não podem ser excluídas nem renomeadas. As regras que dependem delas continuam iguais:
  - a **meta** é comparada com a **admissão prevista**, ou seja, o fim previsto da Admissão Timenow;
  - **admitida** = a Admissão Timenow foi concluída;
  - a **desistência do candidato** volta a vaga para a Captura de Mercado.
- **Renomear** é permitido nas outras etapas. Exemplo: "Entrevista - TNGO/Braskem" vira "Entrevista - Cliente". **[Claude]**
- **Duração:**
  - nas 13 etapas padrão, a regra continua igual: vale o ajuste do projeto ou, sem ajuste, a duração do cliente;
  - numa etapa incluída no projeto, a duração é definida na hora de incluir e pode ser mudada depois. **[Claude]**
- **Mobilizada** = todas as etapas da lista do projeto concluídas. A **conclusão prevista** é o fim previsto da última etapa da lista.
- **A ordem das fixas:** a Captura de Mercado vem antes da Admissão Timenow em toda lista. **[Claude]**

### Mudanças com o projeto em andamento
Valem para todas as vagas do projeto, **inclusive as canceladas**, para que as conclusões de toda vaga continuem sendo as primeiras etapas da lista, em sequência. As vagas canceladas não aparecem no painel e não são reativadas, então para quem usa nada muda. A trava da ordem considera só as vagas não canceladas. Cada mudança vai para o registro geral, com quem, quando e o que mudou. **[Claude]**

- **Incluir uma etapa na posição P** **[Joel, opção A]**:
  - uma vaga que **já chegou ao ponto P** passa a ter a etapa nova concluída automaticamente. "Já chegou" significa que concluiu a etapa imediatamente anterior a P; se P é a primeira posição, vale toda vaga. Isso cobre:
    - a vaga parada na etapa logo depois de P;
    - as vagas admitidas;
    - as vagas mobilizadas.
  - a data dessa conclusão automática é a da etapa imediatamente anterior a P; se P é a primeira posição, é a data de início da vaga. O histórico da vaga registra "Etapa X incluída e marcada como concluída". Assim, **nenhuma vaga muda de etapa atual, de previsão ou de cor por causa da inclusão.** **[Claude: a data da etapa anterior é a que não mexe em nada]**
  - uma vaga que **ainda não chegou ao ponto P** passa pela etapa nova normalmente.
  - se o RH quiser que uma vaga específica faça a etapa nova mesmo assim, usa "Desfazer último avanço" nela.
- **Excluir uma etapa:**
  - a etapa sai da lista e do cálculo de todas as vagas;
  - as conclusões dela, quando existirem, saem da vaga e vão para o histórico da vaga, com a data;
  - uma vaga que estava **nessa etapa** passa para a próxima etapa da lista, que começa no dia útil seguinte à conclusão da etapa anterior, como em qualquer previsão. **[Claude]**
- **Mudar a ordem:** recusado quando o projeto tem alguma vaga não cancelada, com a mensagem "A ordem das etapas só muda antes de o projeto ter vagas."
- **Projeto encerrado:** nada muda na lista, como já vale para o resto do projeto.

### Ações do RH que já existem
"Concluir etapa", "Desfazer último avanço" e "Candidato desistiu" passam a seguir a lista do projeto:
- a etapa atual é a primeira etapa da lista ainda não concluída;
- as conclusões continuam sendo sempre as primeiras etapas da lista, em sequência.

As mensagens e as proteções de hoje continuam: etapa que mudou enquanto o RH olhava, data no futuro, data antes da etapa anterior.

## Telas

### Configurar → bloco "Etapas" (só o RH)
O bloco "Duração das etapas" de hoje vira **"Etapas"**: uma linha por etapa, na ordem da lista.
- **Colunas:** posição, nome, duração (padrão do cliente e deste projeto, como hoje, quando a etapa é padrão; só a deste projeto, quando a etapa foi incluída) e as ações.
- **Ações por linha:**
  - **Renomear**, menos nas fixas;
  - **Excluir**, menos nas fixas, com confirmação na própria tela. A confirmação diz quantas vagas já concluíram a etapa e que essas datas vão para o histórico. **[Claude]**
  - **Mover para cima e para baixo**, só sem vagas.
- **"+ Incluir etapa":** nome, duração e "depois de qual etapa". Com vagas no projeto, a tela avisa antes de confirmar quantas vagas vão ficar com a etapa concluída automaticamente. **[Claude]**
- As fixas aparecem marcadas como **"obrigatória"**.
- Com o projeto encerrado, o bloco fica só para leitura, como os outros.

### O que se ajusta sozinho
- **Resumo:** um cartão por etapa da lista do projeto, mais o cartão Mobilizadas.
- **Painel:** o quadro tem uma coluna por etapa da lista.
- **Detalhe da vaga:** a tabela mostra as etapas da lista do projeto. O histórico mostra as datas de etapas excluídas e as conclusões automáticas.
- **Modelo de importação:** uma coluna por etapa da lista do projeto, com o nome dela. A importação lê pelas colunas do projeto. Uma planilha baixada antes de uma mudança na lista dá erro de coluna ("Falta a coluna X" ou coluna desconhecida), e a pessoa baixa o modelo de novo. **[Claude]**
- **Numeração na tela:** "1. Abertura de vaga" etc. passa a ser a posição na lista do projeto.

### Painel → arrastar o cartão para avançar (só o RH) **[Joel]**
Exemplo do Joel: o gestor aprova o candidato sem entrevista, e o RH puxa o cartão para a frente no quadro, sem abrir a vaga.
- **Só o RH arrasta.** Para o cliente e o gestor, o quadro continua só de leitura, sem nenhuma alça ou indicação de arrastar.
- **Arrastar para a frente** conclui a etapa atual da vaga. **Pode pular várias colunas de uma vez:** soltar o cartão N colunas à frente conclui a etapa atual e as que estão no caminho, todas na mesma data. Quando o cliente flexibiliza alguma etapa, o projeto ganha prazo.
- **Ao soltar, aparece uma confirmação** na própria tela, sem janela do navegador. Ela mostra:
  - quais etapas serão concluídas, por exemplo "Concluir 2 etapas: Entrevista - Timenow e Entrevista - TNGO/Braskem";
  - a data, que vem como hoje e pode ser trocada;
  - os botões **Concluir** e **Cancelar**.
- **Tudo ou nada:** as etapas do salto são concluídas juntas. Se alguma regra recusar, nenhuma é concluída e a mensagem diz o motivo. As regras são as de hoje: data no futuro, data antes da etapa anterior, data antes do início da vaga ou da retomada, vaga que mudou enquanto o RH olhava, projeto encerrado. **[Claude]**
- O histórico da vaga registra cada etapa concluída, como no "Concluir etapa" de hoje. **[Claude]**
- **Arrastar para trás, ou para a mesma coluna,** não faz nada, e o cartão volta ao lugar. Voltar uma etapa continua sendo "Desfazer último avanço", no detalhe da vaga.
- **A coluna Mobilizadas** aceita o cartão. Soltar ali conclui todas as etapas que faltam. **[Claude]**
- **Teclado e celular:** o arraste é um atalho. "Concluir etapa", no detalhe da vaga, continua sendo o caminho que funciona em qualquer tela e pelo teclado. No celular, onde o quadro rola para o lado, o arraste pode ficar desligado. **[Claude]**

### Cadastros → Clientes
As durações do cliente continuam valendo só para as 13 etapas padrão. **[Claude]**

## Migração do que já existe
- O projeto Mobilização Braskem 2027, e qualquer outro que exista, ganha a própria lista: as 13 etapas padrão, na ordem de hoje, com os mesmos nomes e os ajustes de duração que já tiver.
- **Nenhuma conclusão, data, previsão, cor ou histórico muda.** Todas as 50 vagas continuam na mesma etapa, com as mesmas datas.
- A migração segue a mesma regra das anteriores: a parte que só acrescenta vai antes do código novo, e a que apaga vai depois da publicação. O `.env.local` aponta para o banco de produção, e os testes de banco rodam em transação desfeita.

## Fora do escopo
- Uma lista de etapas própria **por cliente**. Se um cliente sempre tiver etapas diferentes, o RH monta a lista projeto a projeto.
- Mudar a ordem com o projeto em andamento.
- Etapas diferentes por vaga ou por função dentro do mesmo projeto.
- Etapas opcionais ou que acontecem em paralelo. A lista continua sendo uma sequência.
- Restaurar uma etapa excluída com as datas antigas. A etapa pode ser incluída de novo, mas as datas antigas ficam só no histórico.

## Anti-objetivos (seria falha mesmo funcionando)
- Uma vaga ficar vermelha ou amarela por causa de uma etapa incluída depois que ela já tinha passado daquele ponto.
- Uma data de conclusão sumir sem deixar registro.
- A Braskem 2027 mudar qualquer número, data ou cor por causa da migração.
- O RH conseguir excluir a Captura de Mercado ou a Admissão Timenow, ou colocar a Admissão antes da Captura.
- O cliente ou o gestor conseguir alterar a lista, ou arrastar um cartão.
- Um arraste sem querer avançar uma vaga sem confirmação.
- Um salto de várias etapas ficar pela metade.

## Deixado para quem construir
- O modelo de dados exato. As conclusões deixam de apontar para a ordem global 1 a 13 e passam a apontar para a etapa do projeto. As migrações e os testes ficam com quem construir.
- Como o cálculo de previsão recebe a lista do projeto.
- O texto exato das telas e das confirmações, no tom do que já existe.
