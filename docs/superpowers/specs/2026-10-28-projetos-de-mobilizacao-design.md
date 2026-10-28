# Projetos de mobilização: desenho

Data: 2026-10-28 · Pedido do Joel (gerente de contratos, Timenow) · Evolução do Painel de Mobilização ([desenho original](2026-10-27-painel-mobilizacao-design.md)).

## Por quê

O painel nasceu para uma mobilização só, a **Mobilização Braskem 2027** (50 vagas em 4 ondas). Mas, no contrato com a Braskem, chegam vários pedidos de mobilização: o cliente pede contratações e a Timenow precisa entregar até a data pedida. O RH conduz o processo, e a gestão da Timenow e o cliente não tinham como ver como ele estava andando.

O Joel quer que o painel vire um **sistema de projetos de mobilização**: cada pedido vira um projeto, o RH carrega as vagas e acompanha tudo, e cada pessoa vê só os projetos que lhe dizem respeito. Hoje o único cliente é a Braskem. No futuro, o sistema deve atender a própria Timenow e outros clientes, alguns deles geridos pelo Joel.

**Sucesso:**
- O RH cria um projeto novo, baixa o modelo, carrega as vagas e libera o acesso sem precisar de ajuda.
- A pessoa do cliente entra e vê só os projetos dela, com o mesmo "bater o olho" de hoje.
- A gestão vê, numa tela de resumo, quantas vagas de cada função estão em cada etapa.

## Decisões do Joel

1. **Cliente → Projeto → vagas.** Hoje o único cliente é a Braskem, e deve dar para cadastrar outros, inclusive a própria Timenow.
2. **Ondas são opcionais.** Um projeto pode ter ondas, como a Braskem 2027, ou ser só "um punhado de vagas", cada uma com a sua data.
3. **A data do cliente é uma meta.** A data prevista de cada etapa, até a admissão, é sempre calculada pelo sistema a partir das durações e das datas reais. A cor compara a admissão prevista com a meta.
4. **Na hora do cadastro ou da importação, o sistema avisa quando a admissão prevista já cai depois da meta, mas aceita a data.** Quem define a meta é o cliente.
5. **Três perfis: RH, Gestor Timenow e Cliente.**
   - O **RH** administra o sistema: cria clientes e projetos, carrega vagas, avança etapas e decide quem vê o quê.
   - O **Gestor Timenow** e o **Cliente** veem e não alteram nada. Os dois enxergam a mesma coisa dentro de um projeto.
6. **O acesso é por projeto.** O Gestor Timenow e o Cliente veem só os projetos que o RH liberar para eles. Exemplo do Joel: dentro da Braskem, a Engenharia não pode ver as vagas da Manutenção, nem o contrário.
7. **O Cliente fica ligado a um cliente.** O RH só consegue liberar para essa pessoa projetos daquele cliente. O Gestor Timenow pode receber projetos de clientes diferentes (é o caso do Joel).
8. **A duração das etapas é configurável por cliente, e o projeto pode ajustar.** Exemplo: num cliente, o exame sai mais rápido.
9. **Importação por modelo.** O sistema oferece um modelo em Excel para baixar. O projeto pode chegar **já em andamento**, como aconteceu com a Braskem, e por isso o modelo aceita as datas das etapas já concluídas.
10. **Lista de projetos em cartões agrupados por cliente** (opção A do esboço).
11. **Tela nova de Resumo** no projeto: um cartão por etapa, com a quantidade de vagas de cada função, e filtro por onda. Aprovada como no esboço.
12. A tela de **configuração do projeto**, como no esboço: dados, durações, vagas e quem vê.

## Modelo

### Cliente
- Nome. Exemplos: "Braskem", "Timenow".
- **Tabela de durações do cliente**: as mesmas 13 etapas, com a duração de cada uma. Um cliente novo começa com uma cópia das durações padrão de hoje (desenho original, seção "As etapas"). **[Claude]**
- Gestores: cada cliente tem a sua lista de gestores (quem pede as vagas). Um projeto só mostra os gestores do cliente dele. **[Claude]**

### Projeto
- Nome, cliente e **área que pediu** (texto livre e opcional, exemplo: "Manutenção"). **[Claude: opcional porque a Braskem 2027 migrada não tem esse dado; o RH preenche depois]**
- **O cliente de um projeto não muda** depois de criado. Mudar o perfil ou o cliente de um usuário remove os acessos que deixariam de obedecer à regra "o Cliente só vê projetos do próprio cliente". **[Claude]**
- **Organização**: "por ondas" ou "meta por vaga".
  - **Por ondas**: o RH cadastra as ondas do projeto (nome, início e fim). Cada vaga pertence a uma onda, e a meta dela é o fim da onda.
  - **Meta por vaga**: não há ondas, e cada vaga tem a sua própria data de meta.
  - *(Claude)* Um projeto com ondas pode ter vagas avulsas? Não: num projeto por ondas, toda vaga tem onda. Trocar a organização de um projeto que já tem vagas não é permitido. Para trocar, o RH cria outro projeto.
- **Ajustes de duração**: para cada etapa, o projeto usa a duração do cliente, a menos que o RH defina outra só para aquele projeto. Mudar a duração do cliente afeta os projetos que não ajustaram aquela etapa.
- **Situação**: ativo ou encerrado. Um projeto encerrado sai da lista principal e fica num "Encerrados", só para consulta. Até ser reaberto, nem o RH altera nada nele, e o banco recusa as ações do RH (concluir etapa, editar vaga, importar etc.) em projeto encerrado. **[Claude]**

### Onda
- Pertence a um projeto. Tem nome, início e fim (fim inclusivo, como hoje).
- O nome é livre ("1ª Onda", "Lote Janeiro"). Hoje a onda tem só um número de 1 a 4. Isso deixa de valer, e as quatro ondas atuais viram "1ª Onda" a "4ª Onda". **[Claude]**

### Vaga
- Os mesmos campos de hoje (função, disciplina, área/atuação, gestor, candidato, data de início, datas reais das etapas), mais o projeto.
- **Meta**: o fim da onda, quando o projeto é por ondas, ou a data da própria vaga, quando é meta por vaga.

### Usuário
- Nome, e-mail, perfil (`rh`, `gestor`, `cliente`) e ativo, como hoje.
- **Cliente**: obrigatório para o perfil `cliente`, vazio para os outros.
- **Projetos liberados**: a lista de projetos que a pessoa vê. Não se aplica ao RH, que vê tudo.
- Os usuários `visualizador` de hoje viram `gestor` ou `cliente`. A decisão é do Joel, na hora da migração (ver "Migração").

## Regras de cálculo

Tudo o que está no desenho original continua valendo (dias úteis, previsão, datas reais, desistência, admitida, mobilizada), com estas trocas:

- **"Fim da onda" vira "meta da vaga"** em todas as regras.
  - **Risco (amarelo)**: não está atrasada, mas a admissão estimada cai depois da meta.
  - **Atraso (vermelho)**: igual a hoje (hoje é depois do fim previsto da etapa atual).
- **Durações**: a previsão de uma vaga usa as durações do projeto dela (o ajuste do projeto ou, sem ajuste, a duração do cliente). Mudar uma duração recalcula na hora as etapas não concluídas das vagas afetadas, e as datas reais não mudam, como hoje. A mudança vai para o registro geral, dizendo de qual cliente ou projeto. **[Claude]**
- **Feriados** continuam valendo para todos os projetos. **[Claude: o local de trabalho hoje é um só; feriados por cliente ficam para depois]**
- **Aviso de meta curta**: ao criar ou editar uma vaga, ou na prévia da importação, se a admissão prevista calculada já cai depois da meta, o sistema mostra, por exemplo, "pelas etapas, a admissão sai em 15/12 e a meta é 01/12". Não bloqueia nada.

## Telas

### Lista de projetos (tela inicial, todos os perfis)
- **Cartões agrupados por cliente** (opção A do esboço).
- Cada cartão traz:
  - nome do projeto, área, se tem ondas (e quantas) e quantas vagas;
  - barra de **admitidos de N**;
  - contagem 🟢 no prazo, 🟡 em risco e 🔴 atrasadas (só das vagas em andamento, como hoje);
  - num projeto meta por vaga, a **próxima meta** (a menor meta entre as vagas ainda não admitidas). **[Claude]**
- O RH vê todos os projetos ativos e um botão "+ Novo projeto". O Gestor Timenow e o Cliente veem só os projetos liberados.
- **Quem tem só um projeto liberado entra direto no painel dele.** **[Claude]**
- Quem não tem nenhum projeto liberado vê uma mensagem dizendo que ainda não há projetos liberados e que deve falar com o RH. **[Claude]**
- No topo, para o RH: Projetos, Clientes, Usuários e Feriados, e o botão Sair.

### Dentro do projeto: três abas
O nome do projeto e do cliente ficam no topo, com um link de volta para a lista (quando a pessoa tiver mais de um projeto).

**Painel**: o painel de hoje, restrito às vagas do projeto.
- Projeto por ondas: os cartões de onda, como hoje.
- Projeto meta por vaga: no lugar dos cartões de onda, um único cartão do projeto, com admitidos de N e as cores. Na lista "Precisa de atenção" e no detalhe, aparece a **meta** da vaga no lugar do "fim da onda". **[Claude]**
- O filtro de onda só aparece em projeto por ondas.

**Resumo** (novo, todos os perfis):
- Um **cartão por etapa**, na ordem das 13, com o total de vagas que estão naquela etapa agora e, embaixo, a contagem **por função** (exemplo: "Abertura de vaga: Técnico de Planejamento 5, Engenheiro de Campo 1").
- Um último cartão de **Mobilizadas**, também por função.
- **Filtro por onda** no topo ("Todas", "1ª Onda", …), só em projeto por ondas.
- *(Claude)* Ao lado de cada número de função, quantas daquelas vagas estão 🔴 ou 🟡.
- *(Claude)* Clicar numa função abre o Painel filtrado por aquela função, na mesma onda.
- *(Claude)* Etapas sem vagas aparecem apagadas, com "nenhuma vaga". Vagas canceladas não contam.
- *(Claude)* A função é texto livre, então o agrupamento ignora maiúsculas e espaços extras ("Eletricista" e "eletricista " contam juntas).
- Os outros filtros do Painel (área, gestor, candidato) não aparecem no Resumo. **[Claude: o Joel pediu por onda e por função]**

**Configurar** (só o RH), em quatro blocos:
1. **Dados**: nome, cliente, área que pediu e organização (por ondas ou meta por vaga). Com ondas, o cadastro das ondas do projeto fica aqui.
2. **Duração das etapas**: tabela com a duração do cliente e a do projeto. O RH muda só o que for diferente e pode voltar ao padrão do cliente.
3. **Vagas**: "Baixar modelo Excel", "Importar planilha" (com prévia), "+ Vaga avulsa" e a lista de canceladas.
4. **Quem vê este projeto**: lista das pessoas liberadas (nome e perfil), com "remover". Para liberar alguém, o campo só oferece os usuários `cliente` daquele cliente e os usuários `gestor`.
- E também "Encerrar projeto" e "Reabrir". **[Claude]**

### Cadastros do RH (gerais)
- **Clientes**: nome, durações do cliente e gestores do cliente.
- **Usuários**: nome, e-mail, perfil e, se for `cliente`, de qual cliente. A lista mostra quais projetos cada um vê, e dá para liberar projetos também por aqui. **[Claude]**
- **Feriados**: como hoje.
- Ondas, vagas, durações do projeto e carga passam a ficar dentro do projeto (Configurar).

## Modelo de importação

- Baixado na aba Configurar do projeto. É um `.xlsx` com **uma linha por vaga**, um cabeçalho fixo e uma aba de instruções. **[Claude]**
- **Colunas:**
  - **Função** (obrigatória);
  - **Disciplina** e **Área/Atuação** (as mesmas da planilha atual; *Claude: opcionais no modelo, porque um pedido pequeno pode não ter*);
  - **Gestor** (nome; tem que existir entre os gestores do cliente, ou a prévia aponta o erro); **[Claude]**
  - **Onda** (nome da onda, obrigatória em projeto por ondas e proibida em projeto meta por vaga);
  - **Meta** (data, obrigatória em projeto meta por vaga e ignorada em projeto por ondas);
  - **Início do processo** (data; vazio = o dia da importação ou, se a linha já traz etapas concluídas, a data mais antiga entre elas, a que for anterior); **[Claude]**
  - **Candidato** (opcional);
  - **Uma coluna de data para cada uma das 13 etapas**: a data real de conclusão, opcional. As etapas preenchidas contam como concluídas.
- **Validação na prévia** (nada é gravado se houver erro, como hoje):
  - etapa concluída depois de uma não concluída, data inválida, onda ou gestor inexistente, meta faltando;
  - o aviso de meta curta aparece para cada vaga, sem bloquear.
- **Importar várias vezes** no mesmo projeto é permitido: cada importação **acrescenta** vagas. A prévia avisa quando uma linha parece repetir uma vaga já existente (mesma função, candidato e meta), mas não bloqueia. **[Claude: o pedido do cliente pode crescer]**
- A carga da planilha antiga (formato "Acompanhamento Mobilizações.xlsx") pode sair do sistema depois da migração. **[Claude]**

## Migração do que já existe

- Os dados de hoje viram o cliente **Braskem** e o projeto **Mobilização Braskem 2027**, por ondas, com as 4 ondas, as vagas, as datas reais, o histórico e as durações atuais (que viram as durações do cliente Braskem).
- Os usuários `rh` continuam `rh`. Os `visualizador` precisam virar `gestor` ou `cliente` (Braskem). Antes de aplicar a migração, o construtor lista os visualizadores atuais para o Joel decidir. Todos ganham acesso ao projeto Braskem 2027, para que ninguém perca o que via. **[Claude]**
- Nenhuma vaga, data real ou registro do histórico pode se perder.

## Acesso e segurança

- O login continua por código no e-mail.
- **A segurança fica no banco (RLS)**, como hoje:
  - o RH lê e escreve tudo;
  - o Gestor e o Cliente leem só os projetos liberados para eles e tudo o que pertence a esses projetos (ondas, vagas, datas, histórico das vagas, durações), e nada mais;
  - o Gestor e o Cliente não leem a lista de clientes, de usuários nem de projetos não liberados;
  - o banco recusa liberar a um usuário `cliente` um projeto de outro cliente (não só a tela).
- O registro geral (mudanças de duração e de ondas) só aparece para o RH. **[Claude]**
- Um endereço de projeto não liberado, ou de vaga desse projeto, aberto por um Gestor ou Cliente mostra "não encontrado", sem revelar que o projeto existe. **[Claude]**

## Fora do escopo

- Etapas diferentes por cliente ou projeto: todos usam as mesmas 13 etapas e a mesma ordem. Só as durações mudam.
- Duração por vaga.
- Um cliente cadastrar os próprios usuários. Só o RH faz isso.
- E-mails de aviso.
- Feriados por cliente ou por local.
- Resumo que junte vários projetos numa tela só (o Resumo é por projeto).

## Anti-objetivos (seria falha mesmo funcionando)

- Uma pessoa ver um projeto que não foi liberado para ela, principalmente uma pessoa de cliente vendo projeto de outro cliente ou de outra área.
- A migração perder ou alterar qualquer vaga, data ou histórico da Braskem 2027.
- O RH precisar de ajuda técnica para criar um projeto e carregar as vagas.
- Um atraso real aparecer verde por causa de duração ou meta errada no cálculo.
- O painel da Braskem 2027 ficar mais confuso do que é hoje.

## Deixado para quem construir

- O modelo de dados exato, as migrações e os testes.
- Os endereços das páginas e o texto exato das telas, no tom do que já existe.
- O visual dos cartões de projeto e do Resumo, na mesma família do painel atual.
