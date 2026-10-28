-- Projetos de mobilização: Cliente → Projeto → vagas, com acesso liberado por projeto e durações
-- por cliente (e ajustes por projeto). Migração aditiva: o código publicado continua funcionando
-- (ondas.numero, etapas.duracao, salvar_onda, alterar_duracao e importar_carga só saem na 006).
-- No fim, os dados de hoje viram o cliente Braskem e o projeto Mobilização Braskem 2027.

-- Tabelas novas ----------------------------------------------------------------------------------

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  criado_em timestamptz not null default now()
);

create table cliente_duracoes (
  cliente_id uuid not null references clientes on delete cascade,
  ordem smallint not null references etapas,
  duracao smallint not null check (duracao >= 0),
  primary key (cliente_id, ordem)
);

create table projetos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes,
  nome text not null,
  area text,
  organizacao text not null check (organizacao in ('ondas', 'meta')),
  encerrado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (cliente_id, nome)
);

-- Só os ajustes: sem linha, a etapa usa a duração do cliente.
create table projeto_duracoes (
  projeto_id uuid not null references projetos on delete cascade,
  ordem smallint not null references etapas,
  duracao smallint not null check (duracao >= 0),
  primary key (projeto_id, ordem)
);

create table projeto_acessos (
  projeto_id uuid not null references projetos on delete cascade,
  usuario_id uuid not null references usuarios (id) on delete cascade,
  primary key (projeto_id, usuario_id)
);
create index on projeto_acessos (usuario_id);

-- Colunas novas nas tabelas de hoje --------------------------------------------------------------

-- A onda passa a ter nome livre e a pertencer a um projeto. O número fica até a 006, mas deixa de
-- ser obrigatório para as ondas criadas pelas funções novas.
alter table ondas add column projeto_id uuid references projetos, add column nome text, add unique (projeto_id, nome);
alter table ondas alter column numero drop not null;
create index on ondas (projeto_id);

-- Projeto meta por vaga: a vaga não tem onda e traz a própria meta.
alter table vagas add column projeto_id uuid references projetos, add column meta date;
alter table vagas alter column onda_id drop not null;
create index on vagas (projeto_id);

alter table gestores add column cliente_id uuid references clientes;

-- O perfil visualizador sai na 006, depois que o código novo estiver no ar.
alter table usuarios add column cliente_id uuid references clientes;
alter table usuarios drop constraint usuarios_perfil_check;
alter table usuarios add constraint usuarios_perfil_check check (perfil in ('rh', 'visualizador', 'gestor', 'cliente'));
alter table usuarios add constraint usuarios_cliente_check check ((perfil = 'cliente') = (cliente_id is not null));

-- Gatilhos ---------------------------------------------------------------------------------------
-- Rodam com permissão elevada para que a regra não dependa do que quem escreve consegue ler.

-- Onda e meta conforme a organização do projeto. Vaga sem projeto (criada pelo código antigo, até
-- a 006) entra no projeto da onda, para não ficar fora dele.
create function public.conferir_vaga() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_organizacao text; v_projeto_onda uuid;
begin
  if new.onda_id is not null then select projeto_id into v_projeto_onda from ondas where id = new.onda_id; end if;
  if new.projeto_id is null then
    new.projeto_id := v_projeto_onda;
    if new.projeto_id is null then return new; end if;
  end if;
  select organizacao into v_organizacao from projetos where id = new.projeto_id;
  if v_organizacao = 'ondas' then
    if new.onda_id is null then raise exception 'onda obrigatória'; end if;
    if v_projeto_onda is distinct from new.projeto_id then raise exception 'onda de outro projeto'; end if;
  else
    if new.meta is null then raise exception 'meta obrigatória'; end if;
    if new.onda_id is not null then raise exception 'projeto sem ondas'; end if;
  end if;
  return new;
end $$;

create trigger conferir_vaga before insert or update on vagas for each row execute function conferir_vaga();

-- Projeto encerrado: nem o RH altera vagas, ondas, conclusões ou durações dele até ser reaberto.
create function public.projeto_aberto() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_linha jsonb; v_projeto uuid;
begin
  -- Na edição valem a linha de antes e a de depois: nada sai de um projeto encerrado nem entra nele.
  foreach v_linha in array (case tg_op when 'INSERT' then array[to_jsonb(new)] when 'DELETE' then array[to_jsonb(old)]
                                       else array[to_jsonb(old), to_jsonb(new)] end) loop
    if tg_table_name = 'vaga_conclusoes' then
      select projeto_id into v_projeto from vagas where id = (v_linha->>'vaga_id')::uuid;
    else
      v_projeto := (v_linha->>'projeto_id')::uuid;
    end if;
    if exists (select 1 from projetos where id = v_projeto and encerrado_em is not null) then
      raise exception 'projeto encerrado';
    end if;
  end loop;
  return case tg_op when 'DELETE' then old else new end;
end $$;

create trigger projeto_aberto before insert or update or delete on vagas for each row execute function projeto_aberto();
create trigger projeto_aberto before insert or update or delete on ondas for each row execute function projeto_aberto();
create trigger projeto_aberto before insert or update or delete on vaga_conclusoes for each row execute function projeto_aberto();
create trigger projeto_aberto before insert or update or delete on projeto_duracoes for each row execute function projeto_aberto();

-- O cliente de um projeto não muda (senão um usuário cliente com acesso passaria a ver projeto de
-- outro cliente), e a organização só muda sem vagas. Vale também para o update direto na tabela.
create function public.conferir_projeto() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.cliente_id is distinct from old.cliente_id then raise exception 'cliente não muda'; end if;
  if new.organizacao is distinct from old.organizacao
     and exists (select 1 from vagas where projeto_id = new.id and cancelada_em is null) then
    raise exception 'projeto tem vagas';
  end if;
  return new;
end $$;

create trigger conferir_projeto before update on projetos for each row execute function conferir_projeto();

-- O RH já vê tudo; o usuário cliente só recebe projetos do próprio cliente.
create function public.conferir_acesso() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_perfil text; v_cliente uuid;
begin
  select perfil, cliente_id into v_perfil, v_cliente from usuarios where id = new.usuario_id;
  if v_perfil = 'rh' then raise exception 'perfil sem acesso por projeto'; end if;
  if v_perfil = 'cliente' and v_cliente is distinct from (select cliente_id from projetos where id = new.projeto_id) then
    raise exception 'cliente diferente';
  end if;
  return new;
end $$;

create trigger conferir_acesso before insert or update on projeto_acessos for each row execute function conferir_acesso();

-- Mudou o perfil ou o cliente do usuário: saem os acessos que deixariam de obedecer à regra.
create function public.acessos_do_usuario() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from projeto_acessos a
  where a.usuario_id = new.id
    and (new.perfil = 'rh'
      or (new.perfil = 'cliente' and exists (select 1 from projetos p where p.id = a.projeto_id and p.cliente_id is distinct from new.cliente_id)));
  return null;
end $$;

create trigger acessos_do_usuario after update of perfil, cliente_id on usuarios for each row execute function acessos_do_usuario();

revoke execute on function public.conferir_vaga, public.conferir_projeto, public.projeto_aberto, public.conferir_acesso, public.acessos_do_usuario from public, anon, authenticated;

-- Leitura (RLS) ----------------------------------------------------------------------------------
-- O RH vê tudo. O gestor e o cliente veem só os projetos liberados em projeto_acessos e o que é
-- deles. Vagas e ondas sem projeto, e o registro geral do histórico, só o RH.

create function public.pode_ver_projeto(p uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select eh_rh() or exists (
    select 1 from projeto_acessos a join usuarios u on u.id = a.usuario_id
    where a.projeto_id = p and u.usuario_id = auth.uid() and u.ativo
  )
$$;

revoke execute on function public.pode_ver_projeto from public, anon;
grant execute on function public.pode_ver_projeto to authenticated;

do $$
declare t text;
begin
  foreach t in array array['clientes', 'cliente_duracoes', 'projetos', 'projeto_duracoes', 'projeto_acessos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy rh_escreve on %I for all to authenticated using (eh_rh()) with check (eh_rh())', t);
  end loop;
  foreach t in array array['ondas', 'gestores', 'vagas', 'vaga_conclusoes', 'historico'] loop
    execute format('drop policy leitura on %I', t);
  end loop;
end $$;

create policy leitura on projetos for select to authenticated using (pode_ver_projeto(id));
create policy leitura on ondas for select to authenticated using (pode_ver_projeto(projeto_id));
create policy leitura on vagas for select to authenticated using (pode_ver_projeto(projeto_id));
create policy leitura on projeto_duracoes for select to authenticated using (pode_ver_projeto(projeto_id));
create policy leitura on vaga_conclusoes for select to authenticated
  using (exists (select 1 from vagas v where v.id = vaga_conclusoes.vaga_id and pode_ver_projeto(v.projeto_id)));
create policy leitura on historico for select to authenticated
  using (eh_rh() or (historico.vaga_id is not null
    and exists (select 1 from vagas v where v.id = historico.vaga_id and pode_ver_projeto(v.projeto_id))));
create policy leitura on clientes for select to authenticated
  using (eh_rh() or exists (select 1 from projetos p where p.cliente_id = clientes.id and pode_ver_projeto(p.id)));
create policy leitura on cliente_duracoes for select to authenticated
  using (eh_rh() or exists (select 1 from projetos p where p.cliente_id = cliente_duracoes.cliente_id and pode_ver_projeto(p.id)));
create policy leitura on gestores for select to authenticated
  using (eh_rh() or exists (select 1 from projetos p where p.cliente_id = gestores.cliente_id and pode_ver_projeto(p.id)));
create policy leitura on projeto_acessos for select to authenticated
  using (eh_rh() or projeto_acessos.usuario_id in (select u.id from usuarios u where u.usuario_id = auth.uid()));

-- Funções do RH ----------------------------------------------------------------------------------

-- Cliente novo começa com uma cópia das durações padrão das etapas.
create function public.salvar_cliente(p_id uuid, p_nome text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_antes text;
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
  if p_id is null then
    insert into clientes (nome) values (p_nome) returning id into v_id;
    insert into cliente_duracoes (cliente_id, ordem, duracao) select v_id, ordem, duracao from etapas;
    insert into historico (vaga_id, nome_usuario, acao) values (null, meu_nome(), 'Cadastrou o cliente ' || p_nome);
    return v_id;
  end if;
  select nome into v_antes from clientes where id = p_id for update;
  if not found then raise exception 'cliente não encontrado'; end if;
  update clientes set nome = p_nome where id = p_id;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (null, meu_nome(), 'Alterou o cliente ' || p_nome, jsonb_build_object('antes', v_antes, 'depois', p_nome));
  return p_id;
end $$;

create function public.alterar_duracao_cliente(p_cliente uuid, p_ordem smallint, p_dias smallint) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_antes smallint; v_etapa text; v_cliente text;
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
  if p_dias is null or p_dias < 0 then raise exception 'duração inválida'; end if;
  select d.duracao, e.nome, c.nome into v_antes, v_etapa, v_cliente
    from cliente_duracoes d join etapas e on e.ordem = d.ordem join clientes c on c.id = d.cliente_id
    where d.cliente_id = p_cliente and d.ordem = p_ordem for update of d;
  if not found then raise exception 'etapa não encontrada'; end if;
  update cliente_duracoes set duracao = p_dias where cliente_id = p_cliente and ordem = p_ordem;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (null, meu_nome(), 'Alterou a duração de ' || v_etapa, jsonb_build_object('cliente', v_cliente, 'antes', v_antes, 'depois', p_dias));
end $$;

-- p_dias null apaga o ajuste: a etapa volta a usar a duração do cliente. O "antes" e o "depois"
-- são as durações efetivas no projeto.
create function public.alterar_duracao_projeto(p_projeto uuid, p_ordem smallint, p_dias smallint) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_antes smallint; v_cliente_dias smallint; v_etapa text; v_projeto text;
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
  if p_dias < 0 then raise exception 'duração inválida'; end if;
  select p.nome, e.nome, cd.duracao into v_projeto, v_etapa, v_cliente_dias
    from projetos p join etapas e on e.ordem = p_ordem
    left join cliente_duracoes cd on cd.cliente_id = p.cliente_id and cd.ordem = p_ordem
    where p.id = p_projeto for update of p;
  if not found then raise exception 'etapa não encontrada'; end if;
  select coalesce((select duracao from projeto_duracoes where projeto_id = p_projeto and ordem = p_ordem), v_cliente_dias) into v_antes;
  if p_dias is null then
    delete from projeto_duracoes where projeto_id = p_projeto and ordem = p_ordem;
  else
    insert into projeto_duracoes (projeto_id, ordem, duracao) values (p_projeto, p_ordem, p_dias)
    on conflict (projeto_id, ordem) do update set duracao = excluded.duracao;
  end if;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (null, meu_nome(), 'Alterou a duração de ' || v_etapa,
    jsonb_build_object('projeto', v_projeto, 'antes', v_antes, 'depois', coalesce(p_dias, v_cliente_dias)));
end $$;

-- p: cliente_id, nome, area, organizacao. O cliente não muda, e a organização só muda sem vagas
-- (regras do gatilho conferir_projeto).
create function public.salvar_projeto(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_antes projetos;
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
  if p_id is null then
    insert into projetos (cliente_id, nome, area, organizacao)
    values ((p->>'cliente_id')::uuid, p->>'nome', nullif(p->>'area', ''), p->>'organizacao')
    returning id into v_id;
    insert into historico (vaga_id, nome_usuario, acao) values (null, meu_nome(), 'Criou o projeto ' || (p->>'nome'));
    return v_id;
  end if;
  select * into v_antes from projetos where id = p_id for update;
  if not found then raise exception 'projeto não encontrado'; end if;
  -- O gatilho conferir_projeto recusa trocar o cliente ou a organização.
  update projetos set cliente_id = (p->>'cliente_id')::uuid, nome = p->>'nome', area = nullif(p->>'area', ''), organizacao = p->>'organizacao'
  where id = p_id;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (null, meu_nome(), 'Alterou o projeto ' || (p->>'nome'), jsonb_build_object(
    'antes', jsonb_build_object('nome', v_antes.nome, 'area', v_antes.area, 'organizacao', v_antes.organizacao),
    'depois', jsonb_build_object('nome', p->>'nome', 'area', nullif(p->>'area', ''), 'organizacao', p->>'organizacao')));
  return p_id;
end $$;

create function public.encerrar_projeto(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_nome text;
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
  update projetos set encerrado_em = now() where id = p_id and encerrado_em is null returning nome into v_nome;
  if not found then raise exception 'projeto não encontrado'; end if;
  insert into historico (vaga_id, nome_usuario, acao) values (null, meu_nome(), 'Encerrou o projeto ' || v_nome);
end $$;

create function public.reabrir_projeto(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_nome text;
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
  update projetos set encerrado_em = null where id = p_id and encerrado_em is not null returning nome into v_nome;
  if not found then raise exception 'projeto não encontrado'; end if;
  insert into historico (vaga_id, nome_usuario, acao) values (null, meu_nome(), 'Reabriu o projeto ' || v_nome);
end $$;

create function public.salvar_onda_projeto(p_id uuid, p_projeto uuid, p_nome text, p_inicio date, p_fim date) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_antes jsonb; v_organizacao text; v_projeto text;
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
  select organizacao, nome into v_organizacao, v_projeto from projetos where id = p_projeto;
  if not found then raise exception 'projeto não encontrado'; end if;
  if v_organizacao <> 'ondas' then raise exception 'projeto sem ondas'; end if;
  if p_id is null then
    insert into ondas (projeto_id, nome, inicio, fim) values (p_projeto, p_nome, p_inicio, p_fim) returning id into v_id;
    insert into historico (vaga_id, nome_usuario, acao, detalhe)
    values (null, meu_nome(), format('Cadastrou a %s em %s', p_nome, v_projeto), jsonb_build_object('inicio', p_inicio, 'fim', p_fim));
    return v_id;
  end if;
  select jsonb_build_object('nome', nome, 'inicio', inicio, 'fim', fim) into v_antes from ondas where id = p_id and projeto_id = p_projeto for update;
  if not found then raise exception 'onda não encontrada'; end if;
  update ondas set nome = p_nome, inicio = p_inicio, fim = p_fim where id = p_id;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (null, meu_nome(), format('Alterou a %s em %s', p_nome, v_projeto),
    jsonb_build_object('antes', v_antes, 'depois', jsonb_build_object('nome', p_nome, 'inicio', p_inicio, 'fim', p_fim)));
  return p_id;
end $$;

-- p: funcao, disciplina, area, onda_id, meta, gestor_id, candidato, data_inicio e, só ao criar,
-- projeto_id. O código publicado ainda chama sem projeto_id e sem meta (até a 006).
create or replace function public.salvar_vaga(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_antes jsonb;
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
  if p_id is null then
    insert into vagas (projeto_id, funcao, disciplina, area, onda_id, meta, gestor_id, candidato, data_inicio)
    values (nullif(p->>'projeto_id', '')::uuid, p->>'funcao', coalesce(p->>'disciplina', ''), coalesce(p->>'area', ''),
      nullif(p->>'onda_id', '')::uuid, nullif(p->>'meta', '')::date, nullif(p->>'gestor_id', '')::uuid,
      nullif(p->>'candidato', ''), (p->>'data_inicio')::date)
    returning id into v_id;
    insert into historico (vaga_id, nome_usuario, acao) values (v_id, meu_nome(), 'Criou a vaga');
    return v_id;
  end if;
  select jsonb_build_object('funcao', funcao, 'disciplina', disciplina, 'area', area, 'onda_id', onda_id, 'meta', meta,
      'gestor_id', gestor_id, 'candidato', candidato, 'data_inicio', data_inicio)
    into v_antes from vagas where id = p_id for update;
  if not found then raise exception 'vaga não encontrada'; end if;
  update vagas set
    funcao = p->>'funcao', disciplina = coalesce(p->>'disciplina', ''), area = coalesce(p->>'area', ''),
    onda_id = nullif(p->>'onda_id', '')::uuid, meta = nullif(p->>'meta', '')::date,
    gestor_id = nullif(p->>'gestor_id', '')::uuid, candidato = nullif(p->>'candidato', ''), data_inicio = (p->>'data_inicio')::date
  where id = p_id;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  select p_id, meu_nome(), 'Editou a vaga', jsonb_build_object('antes', v_antes, 'depois', jsonb_build_object(
    'funcao', funcao, 'disciplina', disciplina, 'area', area, 'onda_id', onda_id, 'meta', meta,
    'gestor_id', gestor_id, 'candidato', candidato, 'data_inicio', data_inicio))
  from vagas where id = p_id;
  return p_id;
end $$;

-- Importação do modelo: acrescenta as vagas (com as conclusões) ao projeto numa transação só.
-- Os gatilhos conferem onda, meta e projeto encerrado.
create function public.importar_vagas(p_projeto uuid, p_vagas jsonb) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare v jsonb; c jsonb; v_id uuid; v_n int := 0; v_projeto text;
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
  select nome into v_projeto from projetos where id = p_projeto for update;
  if not found then raise exception 'projeto não encontrado'; end if;
  for v in select * from jsonb_array_elements(p_vagas) loop
    insert into vagas (projeto_id, funcao, disciplina, area, onda_id, meta, gestor_id, candidato, data_inicio)
    values (p_projeto, v->>'funcao', coalesce(v->>'disciplina', ''), coalesce(v->>'area', ''),
      nullif(v->>'onda_id', '')::uuid, nullif(v->>'meta', '')::date, nullif(v->>'gestor_id', '')::uuid,
      nullif(v->>'candidato', ''), (v->>'data_inicio')::date)
    returning id into v_id;
    for c in select * from jsonb_array_elements(coalesce(v->'concluidas', '[]'::jsonb)) loop
      insert into vaga_conclusoes (vaga_id, ordem, concluida_em) values (v_id, (c->>'ordem')::smallint, (c->>'concluida_em')::date);
    end loop;
    v_n := v_n + 1;
  end loop;
  insert into historico (vaga_id, nome_usuario, acao) values (null, meu_nome(), format('Importou %s vagas em %s', v_n, v_projeto));
  return v_n;
end $$;

revoke execute on function public.salvar_cliente, public.alterar_duracao_cliente, public.alterar_duracao_projeto, public.salvar_projeto,
  public.encerrar_projeto, public.reabrir_projeto, public.salvar_onda_projeto, public.importar_vagas from public, anon;
grant execute on function public.salvar_cliente, public.alterar_duracao_cliente, public.alterar_duracao_projeto, public.salvar_projeto,
  public.encerrar_projeto, public.reabrir_projeto, public.salvar_onda_projeto, public.importar_vagas to authenticated;

-- Migração dos dados de hoje ---------------------------------------------------------------------
-- Sem histórico: nada do que existe muda, só ganha cliente e projeto.

do $$
declare v_cliente uuid; v_projeto uuid;
begin
  insert into clientes (nome) values ('Braskem') returning id into v_cliente;
  insert into cliente_duracoes (cliente_id, ordem, duracao) select v_cliente, ordem, duracao from etapas;
  insert into projetos (cliente_id, nome, area, organizacao) values (v_cliente, 'Mobilização Braskem 2027', null, 'ondas') returning id into v_projeto;
  update ondas set projeto_id = v_projeto, nome = numero || 'ª Onda';
  update vagas set projeto_id = v_projeto;
  update gestores set cliente_id = v_cliente;
  -- Ninguém perde o que via: os visualizadores viram gestores com acesso à Braskem 2027.
  update usuarios set perfil = 'gestor' where perfil = 'visualizador';
  insert into projeto_acessos (projeto_id, usuario_id) select v_projeto, id from usuarios where perfil = 'gestor';
end $$;
