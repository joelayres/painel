# Etapas padrão do cliente e excluir cliente: desenho

Data: 2026-10-29 · Pedido do Joel (gerente de contratos, Timenow) · Evolução das [etapas por projeto](2026-10-28-etapas-por-projeto-design.md).

## Por quê

Hoje todo projeto novo nasce com as mesmas 13 etapas, qualquer que seja o cliente. Um cliente pode ter um processo próprio, com etapas a mais ou a menos. O Joel quer montar a lista uma vez no cadastro do cliente, em vez de ajustar projeto por projeto.

Também não há como apagar um cliente cadastrado por engano ou para teste.

## Decisões do Joel

1. **Cada cliente tem a sua lista padrão de etapas**, editável no cadastro do cliente.
2. **A lista do cliente vale só para projetos novos.** Os projetos que já existem não mudam.
3. **Só dá para apagar um cliente que não tem nenhum projeto.**

## Regras

### Lista padrão do cliente
- Fica em **Cadastros → Clientes → (cliente)**, num bloco **"Etapas"** que substitui o bloco "Duração das etapas". É só para o Administrador, como o resto do cadastro.
- **O que o Administrador pode fazer:**
  - incluir uma etapa, com nome, duração e "depois de";
  - excluir;
  - renomear;
  - subir e descer;
  - mudar a duração.
- **As mesmas regras da lista do projeto:**
  - Captura de Mercado e Admissão Timenow são obrigatórias, não saem nem mudam de nome, e a Captura vem antes da Admissão;
  - não pode haver nomes repetidos;
  - não pode haver nome de coluna fixa da planilha.
- **Diferente do projeto:** o cliente não tem vagas, então reordenar é sempre permitido, e não existe conclusão automática.
- **Duração:**
  - numa etapa padrão, é a duração do cliente, a mesma de hoje. Mudá-la continua valendo também para os projetos que seguem o padrão do cliente;
  - numa etapa incluída, é a duração própria dela.
- Toda mudança vai para o registro geral, dizendo de qual cliente.
- Um cliente novo nasce com as 13 etapas padrão. Os clientes que já existem, hoje só a Braskem (e o cliente de teste), ganham as 13 etapas na migração, sem mudar nada.

### Projeto novo
- Um projeto novo copia a lista do cliente: nomes, ordem, quais são obrigatórias e a duração das etapas incluídas.
- As etapas padrão continuam seguindo a duração do cliente, a menos que o projeto ajuste, como hoje.
- **Os projetos que já existem não mudam.**

### Excluir cliente
- Na lista de **Cadastros → Clientes**, o botão **"Excluir"** fica em cada linha, com nome acessível com o nome do cliente.
- A confirmação fica na própria tela: "Excluir {cliente}? Os gestores e as etapas do cliente também serão apagados."
- **O banco recusa:**
  - com `'cliente tem projetos'` se existir qualquer projeto do cliente, inclusive encerrado. A tela mostra: "Este cliente tem projetos e não pode ser excluído.";
  - com `'cliente tem usuários'` se algum usuário com perfil Cliente estiver ligado a ele. A tela mostra: "Há usuários ligados a este cliente. Mude o perfil ou o cliente deles antes." **[Claude: senão o usuário ficaria sem cliente]**
- Ao excluir, saem juntos os gestores, as durações e a lista de etapas do cliente.
- O registro geral guarda "Excluiu o cliente {nome}".
- Só o Administrador exclui.

## Fora do escopo
- Aplicar a lista do cliente a projetos existentes.
- Excluir cliente com projetos.

## Anti-objetivos
- Um projeto existente mudar por causa da lista do cliente.
- Um cliente com projeto ou com usuário ligado ser apagado.
- O Analista conseguir editar a lista do cliente ou apagar um cliente.

## Deixado para quem construir
O modelo de dados exato (por exemplo, uma tabela `cliente_etapas` parecida com `projeto_etapas`) e os textos das telas.
