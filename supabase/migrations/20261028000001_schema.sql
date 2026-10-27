-- Painel de Mobilização: o banco guarda só fatos (cadastros e datas reais de conclusão).
-- Previsões, cores e agregados são calculados no app a cada leitura.

create table usuarios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid unique references auth.users on delete set null,
  nome text not null,
  email text not null unique,
  perfil text not null check (perfil in ('rh', 'visualizador')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table ondas (
  id uuid primary key default gen_random_uuid(),
  numero smallint not null unique check (numero between 1 and 4),
  inicio date not null,
  fim date not null,
  check (fim >= inicio)
);

create table gestores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text,
  criado_em timestamptz not null default now()
);

create table etapas (
  ordem smallint primary key check (ordem between 1 and 13),
  nome text not null,
  duracao smallint not null check (duracao >= 0)
);

insert into etapas (ordem, nome, duracao) values
  (1, 'Abertura de vaga', 1),
  (2, 'Captura de Mercado', 4),
  (3, 'Triagem de Candidatos', 1),
  (4, 'Entrevista - Timenow', 1),
  (5, 'Entrevista - TNGO/Braskem', 1),
  (6, 'Envio para contratação', 0),
  (7, 'Agendamento exames', 2),
  (8, 'Realização de Exames', 1),
  (9, 'Liberação dos exames', 7),
  (10, 'Ambientação/TBS', 1),
  (11, 'Admissão Timenow', 0),
  (12, 'Atualização da CTPS', 3),
  (13, 'Treinamento', 5);

create table feriados (
  data date primary key,
  nome text not null
);

-- Feriados nacionais de 2026 e 2027. Estaduais e municipais o RH cadastra.
insert into feriados (data, nome) values
  ('2026-01-01', 'Confraternização Universal'),
  ('2026-04-03', 'Sexta-feira Santa'),
  ('2026-04-21', 'Tiradentes'),
  ('2026-05-01', 'Dia do Trabalho'),
  ('2026-09-07', 'Independência do Brasil'),
  ('2026-10-12', 'Nossa Senhora Aparecida'),
  ('2026-11-02', 'Finados'),
  ('2026-11-15', 'Proclamação da República'),
  ('2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra'),
  ('2026-12-25', 'Natal'),
  ('2027-01-01', 'Confraternização Universal'),
  ('2027-03-26', 'Sexta-feira Santa'),
  ('2027-04-21', 'Tiradentes'),
  ('2027-05-01', 'Dia do Trabalho'),
  ('2027-09-07', 'Independência do Brasil'),
  ('2027-10-12', 'Nossa Senhora Aparecida'),
  ('2027-11-02', 'Finados'),
  ('2027-11-15', 'Proclamação da República'),
  ('2027-11-20', 'Dia Nacional de Zumbi e da Consciência Negra'),
  ('2027-12-25', 'Natal');

create table vagas (
  id uuid primary key default gen_random_uuid(),
  funcao text not null,
  disciplina text not null,
  area text not null,
  onda_id uuid not null references ondas,
  gestor_id uuid references gestores on delete set null,
  candidato text,
  data_inicio date not null,
  -- Data da desistência do candidato: a captura recomeça nela (ver dominio/previsao.ts).
  retomada_em date,
  cancelada_em timestamptz,
  criado_em timestamptz not null default now()
);
create index on vagas (onda_id);

create table vaga_conclusoes (
  vaga_id uuid not null references vagas on delete cascade,
  ordem smallint not null references etapas,
  concluida_em date not null,
  primary key (vaga_id, ordem)
);

-- vaga_id null = mudança geral (durações, ondas). Guarda o nome, nunca o e-mail.
create table historico (
  id uuid primary key default gen_random_uuid(),
  vaga_id uuid references vagas on delete cascade,
  nome_usuario text not null,
  acao text not null,
  detalhe jsonb,
  em timestamptz not null default now()
);
create index on historico (vaga_id);

create function public.hoje_sp() returns date
language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create function public.meu_perfil() returns text
language sql stable security definer set search_path = public as $$
  select perfil from usuarios where usuario_id = auth.uid() and ativo
$$;

create function public.eh_rh() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(meu_perfil() = 'rh', false)
$$;

do $$
declare t text;
begin
  foreach t in array array['ondas', 'gestores', 'etapas', 'feriados', 'vagas', 'vaga_conclusoes', 'historico'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy leitura on %I for select to authenticated using (meu_perfil() is not null)', t);
    execute format('create policy rh_escreve on %I for all to authenticated using (eh_rh()) with check (eh_rh())', t);
  end loop;
end $$;

alter table usuarios enable row level security;
create policy proprio on usuarios for select to authenticated using (usuario_id = auth.uid());
create policy rh_tudo on usuarios for all to authenticated using (eh_rh()) with check (eh_rh());
