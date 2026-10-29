# Edição de vagas em grupo: desenho

Data: 2026-10-29 · Pedido do Joel (gerente de contratos, Timenow) · Evolução do Painel de Mobilização, depois do [perfil Analista de RH](2026-10-28-perfil-analista-de-rh-design.md).

## Por quê

Um projeto tem muitas vagas parecidas, como 19 de Técnico de Campo na mesma onda. Hoje o Analista precisa abrir vaga por vaga para avançar a mesma etapa, trocar a meta ou trocar a data de início. Isso dá muito trabalho e abre espaço para erro.

**Sucesso:** a equipe filtra o grupo, marca todas as vagas de uma vez e aplica a mudança num clique, com o histórico de cada vaga registrando o que mudou.

## Decisões do Joel

1. **Três ações em grupo:**
   - **Avançar a etapa**;
   - **Trocar a meta**;
   - **Trocar a data de início**.
2. **O grupo é escolhido pelo filtro:** a pessoa filtra e marca todas as vagas do filtro, ou marca uma a uma.
3. **Avançar exige que todas as vagas marcadas estejam na mesma etapa**, que é concluída numa data só.

## Esclarecimento: o gestor da vaga (sem mudança no sistema)

O "gestor da vaga" vem da lista **Cadastros → Clientes → (cliente) → Gestores**, que guarda só nome e e-mail e não depende de login. Uma pessoa do cliente que tem login como **Cliente** também pode estar nessa lista. Para atribuí-la a uma vaga, basta cadastrar o nome dela ali. O perfil "Gestor Timenow" serve só para quem entra no painel. Isso foi explicado ao Joel, e nenhuma mudança foi pedida.

## Regras

### Onde e quem
- Fica em **Configurar → bloco Vagas**, para a equipe (Administrador e Analista de RH com acesso ao projeto). Gestor e Cliente não veem.
- Num **projeto encerrado**, nada de seleção nem ações, como já é no Configurar.

### Seleção **[Claude]**
- **Filtros** acima da lista: função, onda (em projeto por ondas) e etapa atual.
- Cada vaga ganha uma **caixa de seleção**. O nome acessível dela é a função, a disciplina e o candidato, quando houver.
- **"Selecionar todas (N)"** marca as N vagas do filtro atual, e **"Limpar seleção"** desmarca todas.
- Vagas **canceladas** e **mobilizadas** não entram na seleção.
- Com vagas marcadas, aparece a barra **"{n} vagas selecionadas"**, com as ações.

### Ações
- **Avançar etapa:**
  - só fica disponível quando todas as vagas marcadas estão na **mesma etapa atual**. Senão, aparece: "Para avançar juntas, as vagas precisam estar na mesma etapa.";
  - mostra a etapa ("Concluir {etapa} em {n} vagas") e a data, que vem como hoje e pode ser trocada;
  - aplica as regras de hoje a cada vaga: data no futuro, data antes da etapa anterior, data antes do início ou da retomada, vaga que mudou enquanto a pessoa olhava.
- **Trocar meta** *(só em projeto organizado por meta)*: uma data nova, igual para todas.
- **Trocar onda** *(só em projeto organizado por ondas)*: a meta de uma vaga de projeto por ondas é o fim da onda, então lá a ação é mover as vagas para outra onda. Para mudar a meta de uma onda inteira, edita-se o fim dela no bloco Ondas, como já existe. **[Claude]**
- **Trocar início:** uma data nova, igual para todas.
  - Vale só para vagas que **ainda não concluíram a primeira etapa da lista**, porque depois disso a data de início já não pesa na previsão.
  - Antes de confirmar, a tela avisa: "{k} das vagas selecionadas já passaram da primeira etapa e ficam de fora." Essas vagas não mudam. **[Claude]**
- **Aviso de meta curta:** depois de trocar a meta, a onda ou o início, a tela diz em quantas vagas a admissão prevista passou a cair depois da meta, como o aviso de hoje faz para uma vaga. **[Claude]**

### Tudo ou nada **[Claude]**
- Cada ação é aplicada de uma vez pelo banco, numa única transação.
- Se alguma vaga do grupo for recusada, **nenhuma muda**, e a tela diz qual vaga travou e por quê. Exemplo: "Técnico de Campo · Fornos: a data não pode ser antes da conclusão da etapa anterior."
- A exceção é o "Trocar início", que **pula** as vagas que já passaram da primeira etapa, como avisado antes de confirmar.
- O histórico de cada vaga registra a mudança com o nome de quem fez, como nas ações de uma vaga só.

### Segurança
- As regras de permissão por projeto valem igual: só quem pode alterar o projeto aplica, e o banco confere vaga por vaga que todas são daquele projeto.

## Fora do escopo
- Outras ações em grupo: trocar gestor, candidato, função ou disciplina; cancelar; desfazer etapa; candidato desistiu.
- Avançar vagas que estão em etapas diferentes.
- Seleção no quadro do Painel. A seleção fica só no Configurar.

## Anti-objetivos (seria falha mesmo funcionando)
- Uma ação em grupo deixar parte das vagas mudada e parte não, fora o caso avisado do "Trocar início".
- Uma vaga de outro projeto mudar.
- O Analista conseguir aplicar a ação num projeto que não é dele.
- Uma vaga ficar sem registro no histórico da mudança.

## Deixado para quem construir
- O formato exato das funções do banco, por exemplo uma função por ação recebendo a lista de vagas.
- O desenho da barra de ações e das confirmações, no estilo do Configurar.
