# Plano 6: Etapas padrão do cliente e excluir cliente

> Execução: inline, sem agentes (pedido do Joel), com auto-revisão no fim.

**Goal:** Cada cliente tem a sua lista padrão de etapas, editável em Cadastros → Clientes, que vale para os projetos novos. Um cliente sem projetos e sem usuários pode ser excluído.

**Spec:** `docs/superpowers/specs/2026-10-29-etapas-do-cliente-e-excluir-cliente-design.md`

## Global Constraints
- O padrão do código é pt-BR, com aspas simples e sem ponto e vírgula. Os botões repetidos têm nome acessível por linha.
- O `.env.local` aponta para a produção. Os testes de banco rodam só em `tests/sql`, com `emTransacao`. O Joel roda o `db:push`, e o `git push` só acontece com o OK dele.
- Só o Administrador (`eh_rh()`) edita as etapas do cliente e exclui clientes.
- Os projetos que já existem não mudam.

### Task 1: Banco (migração 011)
- **Tabela `cliente_etapas`:**
  - campos `(id, cliente_id → clientes on delete cascade, posicao, nome, duracao null 0..60, padrao → etapas.ordem, fixa 'captura'|'admissao')`;
  - restrições únicas: `(cliente_id, posicao)` deferrable, `(cliente_id, lower(nome))` e `(cliente_id, fixa)` quando houver fixa;
  - `check (duracao is not null or padrao is not null)`;
  - RLS: leitura e escrita só `eh_rh()`.
- **Migração dos clientes existentes:** cada cliente ganha as 13 etapas padrão.
- **`salvar_cliente`:** o cliente novo nasce com as 13.
- **Gatilho `etapas_do_projeto_novo`:** copia `posicao`, `nome`, `padrao`, `fixa` e `duracao` de `cliente_etapas` do cliente. Sem lista, usa as 13 de `etapas`.
- **Funções** (`eh_rh()`, registro geral com `detalhe.cliente`, as mesmas mensagens das etapas do projeto):
  - `incluir_etapa_cliente(p_cliente, p_nome, p_duracao, p_depois_de)`;
  - `excluir_etapa_cliente(p_etapa)`;
  - `renomear_etapa_cliente(p_etapa, p_nome)`;
  - `mover_etapa_cliente(p_etapa, p_para)`, sem a trava de vagas;
  - `alterar_duracao_etapa_cliente(p_etapa, p_dias)`: numa etapa padrão, grava em `cliente_duracoes`; numa incluída, grava na própria linha. Nos dois casos, `p_dias` é obrigatório.
- **`excluir_cliente(p_id)`:**
  - recusa com `'cliente tem projetos'` e com `'cliente tem usuários'`;
  - apaga os gestores do cliente e o cliente (as durações e as etapas saem em cascata);
  - grava no registro geral.
- **Testes** (`tests/sql/cliente.test.ts`):
  - a migração dá 13 etapas à Braskem;
  - um projeto novo copia a lista do cliente, com a etapa incluída e sem a excluída, e os projetos existentes não mudam;
  - as fixas são protegidas;
  - a ordem das obrigatórias é respeitada;
  - mudar a duração de uma etapa padrão altera `cliente_duracoes`;
  - excluir cliente: recusa com projeto e com usuário, e passa sem eles;
  - o Analista é recusado em tudo.

### Task 2: Telas
- **`EtapasProjeto`** ganha a prop `alvo: { tipo: 'projeto' | 'cliente'; id: string }`:
  - para o cliente, escolhe as actions do cliente;
  - esconde a coluna "Padrão {cliente}" e mostra uma coluna só, "Duração";
  - não mostra "Voltar ao padrão" nem os avisos de conclusão automática;
  - permite subir e descer sempre.
- **Actions do cliente** em `acoesCadastros.ts`, com `exigirAdmin()`, a validação de nome reservado e as mesmas mensagens:
  - `incluirEtapaCliente`;
  - `excluirEtapaCliente`;
  - `renomearEtapaCliente`;
  - `moverEtapaCliente`;
  - `alterarDuracaoEtapaCliente`;
  - `excluirCliente`.
- **Página do cliente:** o bloco "Duração das etapas" vira o `EtapasProjeto` com `alvo` de cliente.
- **Lista de clientes:** botão "Excluir {cliente}" com confirmação na tela e as mensagens de erro.
- **Testes:**
  - o componente no modo cliente não mostra a coluna Padrão e chama a action do cliente;
  - excluir pede confirmação e mostra o erro "Este cliente tem projetos e não pode ser excluído.".

### Task 3: Auto-revisão e publicação
- Rodar `npm test && npm run test:sql && npm run typecheck && npm run lint && npm run build`.
- O Joel roda o `db:push` e dá o OK para o `git push`.
