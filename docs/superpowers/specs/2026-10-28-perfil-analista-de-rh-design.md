# Perfil Analista de RH: desenho

Data: 2026-10-28 · Pedido do Joel (gerente de contratos, Timenow) · Evolução do Painel de Mobilização, depois das [etapas por projeto](2026-10-28-etapas-por-projeto-design.md).

## Por quê

Hoje quem opera o painel tem o perfil **RH**, que vê e altera todos os projetos de todos os clientes. Com mais projetos e mais gente no RH, cada analista deve trabalhar só nos projetos da realidade dele, sem ver nem mexer nos dos outros. O Joel também quer que o perfil de hoje passe a se chamar **Administrador**.

**Sucesso:**
- Um Analista de RH entra e vê só os projetos liberados para ele, e trabalha neles como o RH trabalha hoje.
- Um Analista cria um projeto novo e já consegue trabalhar nele.
- Nada que um Analista faça alcança um projeto que não é dele.

## Decisões do Joel

1. **"RH" passa a se chamar "Administrador"** em todas as telas. Ele continua vendo e alterando tudo.
2. **Novo perfil: Analista de RH.** Dentro dos projetos liberados para ele, faz **tudo** o que o RH faz hoje, inclusive:
   - concluir etapas e arrastar cartões;
   - editar, cancelar e importar vagas;
   - mexer nas ondas e na lista de etapas;
   - editar os dados do projeto, encerrar e reabrir;
   - escolher quem vê o projeto.
3. **O Analista não vê nem altera projetos que não foram liberados para ele.** A liberação é feita como hoje para gestores e clientes, em "Quem vê este projeto".
4. **O Analista pode criar projetos novos.** O projeto que ele cria já nasce liberado para ele.

## Regras

### O que fica só com o Administrador **[Claude]**
Tudo o que é de fora de um projeto:
- Cadastros → **Clientes**, incluindo as durações padrão e os gestores do cliente;
- Cadastros → **Usuários**: criar, editar, desativar e liberar projetos para qualquer pessoa;
- Cadastros → **Feriados**;
- o **registro geral** de mudanças;
- a página **Encerrados** com os projetos encerrados de todos.

O Analista vê os encerrados **dos projetos dele**, numa seção da própria lista.

### O que o Analista pode liberar **[Claude]**
- Em "Quem vê este projeto", nos projetos dele, o Analista libera e remove **Gestores Timenow** e **Clientes**, com as mesmas regras de hoje: um Cliente só recebe projeto do próprio cliente.
- O Analista **não** libera projeto para outro Analista nem para um Administrador, e **não** remove o acesso de outro Analista. Isso é com o Administrador, em Cadastros → Usuários ou na mesma tela do projeto. Assim, um Analista não abre acesso de outros analistas a projetos que não são deles.

### O que o Analista lê fora dos projetos dele **[Claude]**
O Analista é da equipe da Timenow. Ele precisa de algumas listas gerais para trabalhar, e nenhuma delas é dado de projeto:
- **Clientes:** o nome de todos os clientes, para escolher ao criar um projeto. Não vê durações nem gestores de clientes sem projeto dele.
- **Pessoas que pode liberar:** nome e perfil dos usuários Gestor Timenow e Cliente, e o cliente de cada usuário Cliente, para escolher em "Quem vê este projeto". O e-mail não aparece para o Analista.
- **Gestores do cliente:** os gestores dos clientes dos projetos dele, para escolher numa vaga. O e-mail do gestor não aparece na tela, mas pode ser lido por consulta direta ao banco, como já acontece para gestores e clientes. **[Joel, 28/10: aceito, é contato de trabalho]**
- **Comum a todos:** os feriados e as 13 etapas padrão, como já é para todos os perfis.

Ele **não** lê projetos, ondas, vagas, conclusões, histórico de vaga, listas de etapas, acessos ou durações de projetos que não são dele, nem o registro geral.

### Mudança de perfil e acesso **[Claude]**
- O Analista só pode alterar um projeto quando, **ao mesmo tempo**, o perfil dele é Analista de RH, ele está ativo e o projeto está liberado para ele. Se o perfil mudar para Gestor, o acesso que sobra é só de leitura. Se mudar para Cliente, a regra de hoje remove os projetos de outros clientes.
- O Analista **não remove o próprio acesso**, pela mesma regra que o impede de mexer no acesso de outro Analista. Assim, nenhum projeto fica fora do alcance de quem o criou por engano.
- **O cliente de um projeto não muda**, regra que o banco já garante. Excluir projeto não existe, só encerrar e reabrir.

### Criar projeto
- Ao criar, o Analista escolhe um dos clientes cadastrados. Cadastrar cliente novo é com o Administrador.
- O projeto criado nasce com o acesso liberado para quem o criou, no mesmo momento, pelo banco, e não só pela tela.

### Segurança
- **A regra fica no banco**, como as demais: o RLS e as funções de escrita conferem, para cada projeto, se a pessoa é Administrador ou Analista com acesso àquele projeto. Toda função de escrita que hoje confere "é RH" passa a conferir "pode alterar este projeto", e as de fora de projeto passam a conferir "é Administrador".
- Um endereço de projeto não liberado, aberto por um Analista, mostra "não encontrado", como já acontece com gestor e cliente.
- O histórico continua mostrando o **nome** de quem alterou.

### Telas
- **Menu do Administrador:** igual ao de hoje (Projetos, Cadastros).
- **Menu do Analista:** só **Projetos**. Dentro de um projeto liberado, as abas Resumo, Painel e Configurar, como o RH tem hoje.
- **Tela inicial do Analista:** os projetos liberados, agrupados por cliente, com o botão **"+ Novo projeto"** e o filtro de cliente quando houver mais de um.
- **Cadastros → Usuários:** o campo Perfil oferece **Administrador, Analista de RH, Gestor Timenow e Cliente**. As caixas de projetos liberados valem também para o Analista de RH.
- **Rótulos:** em toda tela, "RH" como perfil vira "Administrador". "Analista de RH" é o rótulo do perfil novo.

## Migração
- Quem hoje tem o perfil RH (o Joel e mais uma pessoa, em 28/10/2026) passa a ser **Administrador**, sem perder nada.
- **[Claude]** O valor guardado no banco pode continuar `rh` para o Administrador, mudando só o rótulo, ou ser renomeado. A escolha fica com quem construir, desde que nenhum acesso se perca no caminho e a migração siga a regra das anteriores: a parte aditiva antes do código novo, a de limpeza depois.

## Fora do escopo
- Permissões finas dentro do projeto, como um Analista que só conclui etapas mas não edita vagas.
- Grupos ou equipes de analistas.
- O Analista cadastrar clientes, gestores, feriados ou usuários.

## Anti-objetivos (seria falha mesmo funcionando)
- Um Analista ver, por qualquer caminho, um projeto, vaga, histórico ou registro de outro projeto: tela, endereço direto, filtro ou chamada ao banco.
- Um Analista conseguir dar a si mesmo, ou a outro Analista, acesso a um projeto que não é dele.
- O Joel ou o outro Administrador perderem qualquer acesso na migração.
- Um Analista criar um projeto e não conseguir abri-lo.

## Deixado para quem construir
- O nome exato do perfil no banco e das funções de permissão.
- O texto exato das telas.
