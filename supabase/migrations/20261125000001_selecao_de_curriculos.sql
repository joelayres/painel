-- Seleção de Currículos: área só da equipe de RH (Administrador e Analista de RH). O RH cadastra o
-- descritivo de uma função num projeto, importa currículos em PDF, o Claude analisa a aderência e o
-- RH confirma. Os candidatos formam um banco pesquisável por todo o RH; as seleções seguem o acesso
-- ao projeto. Gestor e Cliente não leem nada daqui. Escrita só pelas funções abaixo.
-- Migração aditiva: o código publicado não conhece nada disto.

-- Tabelas ---------------------------------------------------------------------------------------

create table candidatos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text,
  telefone text,
  cpf text check (cpf ~ '^\d{11}$'),
  cidade text,
  uf text,
  criado_em timestamptz not null default now()
);
create index on candidatos (cpf);
create index on candidatos (email);

-- O currículo nasce sem candidato: quem ele é só se sabe depois da análise.
create table curriculos (
  id uuid primary key default gen_random_uuid(),
  candidato_id uuid references candidatos on delete cascade,
  caminho text not null unique,
  nome_arquivo text not null,
  enviado_por text not null,
  enviado_em timestamptz not null default now()
);
create index on curriculos (candidato_id);

create table selecoes (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos,
  funcao text not null check (length(funcao) between 1 and 120),
  descritivo text not null check (length(descritivo) between 1 and 20000),
  encerrada_em timestamptz,
  criado_por text,
  criado_em timestamptz not null default now()
);
create index on selecoes (projeto_id);

create table participacoes (
  id uuid primary key default gen_random_uuid(),
  selecao_id uuid not null references selecoes on delete cascade,
  candidato_id uuid references candidatos on delete cascade,
  curriculo_id uuid not null references curriculos on delete cascade,
  situacao text not null default 'pendente' check (situacao in ('pendente', 'analisando', 'analisada', 'erro', 'repetida')),
  analisando_desde timestamptz,
  erro text,
  classificacao text check (classificacao in ('a_confirmar', 'aderente', 'parcial', 'nao_aderente')),
  classificacao_por text,
  classificacao_em timestamptz,
  resultado text not null default 'em_andamento' check (resultado in ('em_andamento', 'escolhido', 'aprovado_nao_escolhido', 'reprovado', 'desistiu')),
  do_banco boolean not null default false,
  criado_em timestamptz not null default now()
);
create index on participacoes (selecao_id);
create index on participacoes (candidato_id);
-- Um candidato aparece uma vez por seleção; as repetidas ficam fora da regra (só registram o envio).
create unique index participacoes_unica on participacoes (selecao_id, candidato_id) where situacao <> 'repetida';

-- A análise da IA como veio, com o descritivo daquele momento. Nunca é alterada.
create table analises_ia (
  id uuid primary key default gen_random_uuid(),
  participacao_id uuid not null references participacoes on delete cascade,
  modelo text not null,
  versao_prompt text not null,
  descritivo text not null,
  nota smallint not null check (nota between 0 and 100),
  classificacao text not null check (classificacao in ('aderente', 'parcial', 'nao_aderente')),
  resposta jsonb not null,
  tokens_entrada int,
  tokens_saida int,
  criado_em timestamptz not null default now()
);
create index on analises_ia (participacao_id);

create table entrevistas (
  id uuid primary key default gen_random_uuid(),
  participacao_id uuid not null references participacoes on delete cascade,
  tipo text not null check (tipo in ('timenow', 'cliente')),
  data date not null,
  entrevistador text not null check (length(entrevistador) between 1 and 120),
  parecer text not null check (parecer in ('recomendado', 'ressalvas', 'nao_recomendado')),
  impressoes text not null default '' check (length(impressoes) <= 5000),
  registrado_por text not null,
  registrado_em timestamptz not null default now(),
  alterado_em timestamptz
);
create index on entrevistas (participacao_id);

-- Guarda o nome de quem fez, nunca o e-mail.
create table historico_selecao (
  id uuid primary key default gen_random_uuid(),
  selecao_id uuid not null references selecoes on delete cascade,
  participacao_id uuid references participacoes on delete cascade,
  nome_usuario text not null,
  acao text not null,
  detalhe jsonb,
  em timestamptz not null default now()
);
create index on historico_selecao (selecao_id);
create index on historico_selecao (participacao_id);

-- Leitura ---------------------------------------------------------------------------------------

create function public.pode_ver_selecao(p_selecao uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select pode_alterar_projeto((select projeto_id from selecoes where id = p_selecao))
$$;
revoke execute on function public.pode_ver_selecao from public, anon;
grant execute on function public.pode_ver_selecao to authenticated;

alter table candidatos enable row level security;
alter table curriculos enable row level security;
alter table selecoes enable row level security;
alter table participacoes enable row level security;
alter table analises_ia enable row level security;
alter table entrevistas enable row level security;
alter table historico_selecao enable row level security;

create policy leitura on candidatos for select to authenticated using (eh_rh() or eh_analista());
create policy leitura on curriculos for select to authenticated using (eh_rh() or eh_analista());
create policy leitura on selecoes for select to authenticated using (pode_alterar_projeto(projeto_id));
create policy leitura on participacoes for select to authenticated using (pode_ver_selecao(selecao_id));
create policy leitura on historico_selecao for select to authenticated using (pode_ver_selecao(selecao_id));
create policy leitura on analises_ia for select to authenticated
  using (pode_ver_selecao((select selecao_id from participacoes where id = participacao_id)));
create policy leitura on entrevistas for select to authenticated
  using (pode_ver_selecao((select selecao_id from participacoes where id = participacao_id)));

revoke insert, update, delete on candidatos, curriculos, selecoes, participacoes, analises_ia, entrevistas, historico_selecao from anon;
revoke update, delete on analises_ia from authenticated;

-- Arquivos --------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('curriculos', 'curriculos', false, 10485760, '{application/pdf}');

create policy curriculos_leitura on storage.objects for select to authenticated
  using (bucket_id = 'curriculos' and (public.eh_rh() or public.eh_analista()));
create policy curriculos_envio on storage.objects for insert to authenticated
  with check (bucket_id = 'curriculos' and (public.eh_rh() or public.eh_analista()));
