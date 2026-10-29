-- Lista padrão de etapas por cliente (vale para projetos novos) e exclusão de cliente sem projetos.
-- Só o Administrador mexe. Nas etapas padrão a duração continua em cliente_duracoes; nas incluídas, na linha.

create table cliente_etapas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes on delete cascade,
  posicao smallint not null check (posicao >= 1),
  nome text not null check (trim(nome) <> ''),
  duracao smallint check (duracao between 0 and 60),
  padrao smallint references etapas(ordem),
  fixa text check (fixa in ('captura', 'admissao')),
  check (duracao is not null or padrao is not null),
  constraint cliente_etapas_posicao unique (cliente_id, posicao) deferrable initially deferred
);
create unique index cliente_etapas_nome on cliente_etapas (cliente_id, lower(nome));
create unique index cliente_etapas_fixa on cliente_etapas (cliente_id, fixa) where fixa is not null;

alter table cliente_etapas enable row level security;
create policy leitura on cliente_etapas for select to authenticated using (eh_rh());
create policy rh_escreve on cliente_etapas for all to authenticated using (eh_rh()) with check (eh_rh());

-- As 13 padrão para quem já existe e para quem for criado.
create function public.etapas_padrao_do_cliente(p_cliente uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into cliente_etapas (cliente_id, posicao, nome, duracao, padrao, fixa)
  select p_cliente, ordem, nome, null, ordem, case ordem when 2 then 'captura' when 11 then 'admissao' end from etapas
$$;
select etapas_padrao_do_cliente(id) from clientes;

create or replace function public.salvar_cliente(p_id uuid, p_nome text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_antes text;
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
  if p_id is null then
    insert into clientes (nome) values (p_nome) returning id into v_id;
    insert into cliente_duracoes (cliente_id, ordem, duracao) select v_id, ordem, duracao from etapas;
    perform etapas_padrao_do_cliente(v_id);
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

-- Projeto novo copia a lista do cliente (sem lista, as 13 padrão). Projetos existentes não mudam.
create or replace function public.etapas_do_projeto_novo() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from cliente_etapas where cliente_id = new.cliente_id) then
    insert into projeto_etapas (projeto_id, posicao, nome, duracao, padrao, fixa)
    select new.id, posicao, nome, duracao, padrao, fixa from cliente_etapas where cliente_id = new.cliente_id;
  else
    insert into projeto_etapas (projeto_id, posicao, nome, duracao, padrao, fixa)
    select new.id, ordem, nome, null, ordem, case ordem when 2 then 'captura' when 11 then 'admissao' end from etapas;
  end if;
  return null;
end $$;

-- Trava a etapa do cliente (e o cliente) para quem é Administrador.
create function public.travar_etapa_cliente(p_etapa uuid) returns cliente_etapas
language plpgsql security definer set search_path = public, pg_temp as $$
declare v cliente_etapas;
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
  select * into v from cliente_etapas where id = p_etapa;
  if not found then raise exception 'etapa não encontrada'; end if;
  perform 1 from clientes where id = v.cliente_id for update;
  select * into v from cliente_etapas where id = p_etapa;
  return v;
end $$;

create function public.incluir_etapa_cliente(p_cliente uuid, p_nome text, p_duracao smallint, p_depois_de uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cliente text; v_nome text := trim(p_nome); v_depois cliente_etapas; v_posicao smallint; v_id uuid;
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
  select nome into v_cliente from clientes where id = p_cliente for update;
  if not found then raise exception 'cliente não encontrado'; end if;
  if coalesce(v_nome, '') = '' then raise exception 'nome obrigatório'; end if;
  if p_duracao is null then raise exception 'duração obrigatória'; end if;
  if p_duracao not between 0 and 60 then raise exception 'duração inválida'; end if;
  if exists (select 1 from cliente_etapas where cliente_id = p_cliente and lower(nome) = lower(v_nome)) then raise exception 'etapa repetida'; end if;
  if p_depois_de is null then
    v_posicao := 1;
  else
    select * into v_depois from cliente_etapas where id = p_depois_de and cliente_id = p_cliente;
    if not found then raise exception 'etapa não encontrada'; end if;
    v_posicao := v_depois.posicao + 1;
  end if;
  update cliente_etapas set posicao = posicao + 1 where cliente_id = p_cliente and posicao >= v_posicao;
  insert into cliente_etapas (cliente_id, posicao, nome, duracao) values (p_cliente, v_posicao, v_nome, p_duracao) returning id into v_id;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (null, meu_nome(), format('Incluiu a etapa %s no padrão de %s', v_nome, v_cliente),
    jsonb_build_object('cliente', v_cliente, 'etapa', v_nome, 'depois_de', v_depois.nome));
  return v_id;
end $$;

create function public.excluir_etapa_cliente(p_etapa uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v cliente_etapas; v_cliente text;
begin
  v := travar_etapa_cliente(p_etapa);
  if v.fixa is not null then raise exception 'etapa obrigatória'; end if;
  select nome into v_cliente from clientes where id = v.cliente_id;
  delete from cliente_etapas where id = p_etapa;
  update cliente_etapas set posicao = posicao - 1 where cliente_id = v.cliente_id and posicao > v.posicao;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (null, meu_nome(), format('Excluiu a etapa %s do padrão de %s', v.nome, v_cliente), jsonb_build_object('cliente', v_cliente, 'etapa', v.nome));
end $$;

create function public.renomear_etapa_cliente(p_etapa uuid, p_nome text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v cliente_etapas; v_cliente text; v_nome text := trim(p_nome);
begin
  v := travar_etapa_cliente(p_etapa);
  if v.fixa is not null then raise exception 'etapa obrigatória'; end if;
  if coalesce(v_nome, '') = '' then raise exception 'nome obrigatório'; end if;
  if exists (select 1 from cliente_etapas where cliente_id = v.cliente_id and id <> p_etapa and lower(nome) = lower(v_nome)) then raise exception 'etapa repetida'; end if;
  select nome into v_cliente from clientes where id = v.cliente_id;
  update cliente_etapas set nome = v_nome where id = p_etapa;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (null, meu_nome(), format('Renomeou a etapa %s para %s no padrão de %s', v.nome, v_nome, v_cliente),
    jsonb_build_object('cliente', v_cliente, 'antes', v.nome, 'depois', v_nome));
end $$;

create function public.mover_etapa_cliente(p_etapa uuid, p_para smallint) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v cliente_etapas; v_cliente text; v_total int;
begin
  v := travar_etapa_cliente(p_etapa);
  select count(*) into v_total from cliente_etapas where cliente_id = v.cliente_id;
  if p_para is null or p_para < 1 or p_para > v_total then raise exception 'posição inválida'; end if;
  if p_para < v.posicao then
    update cliente_etapas set posicao = posicao + 1 where cliente_id = v.cliente_id and posicao >= p_para and posicao < v.posicao;
  else
    update cliente_etapas set posicao = posicao - 1 where cliente_id = v.cliente_id and posicao > v.posicao and posicao <= p_para;
  end if;
  update cliente_etapas set posicao = p_para where id = p_etapa;
  if (select posicao from cliente_etapas where cliente_id = v.cliente_id and fixa = 'captura')
     > (select posicao from cliente_etapas where cliente_id = v.cliente_id and fixa = 'admissao') then
    raise exception 'ordem das obrigatórias';
  end if;
  select nome into v_cliente from clientes where id = v.cliente_id;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (null, meu_nome(), format('Moveu a etapa %s para a posição %s no padrão de %s', v.nome, p_para, v_cliente),
    jsonb_build_object('cliente', v_cliente, 'etapa', v.nome, 'antes', v.posicao, 'depois', p_para));
end $$;

-- Etapa padrão: a duração é a do cliente (cliente_duracoes, a mesma de antes). Incluída: a da própria linha.
create function public.alterar_duracao_etapa_cliente(p_etapa uuid, p_dias smallint) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v cliente_etapas;
begin
  v := travar_etapa_cliente(p_etapa);
  if p_dias is null then raise exception 'duração obrigatória'; end if;
  if v.padrao is not null then
    perform alterar_duracao_cliente(v.cliente_id, v.padrao, p_dias);
  else
    if p_dias not between 0 and 60 then raise exception 'duração inválida'; end if;
    update cliente_etapas set duracao = p_dias where id = p_etapa;
    insert into historico (vaga_id, nome_usuario, acao, detalhe)
    values (null, meu_nome(), 'Alterou a duração de ' || v.nome,
      jsonb_build_object('cliente', (select nome from clientes where id = v.cliente_id), 'antes', v.duracao, 'depois', p_dias));
  end if;
end $$;

create function public.excluir_cliente(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_nome text;
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
  select nome into v_nome from clientes where id = p_id for update;
  if not found then raise exception 'cliente não encontrado'; end if;
  if exists (select 1 from projetos where cliente_id = p_id) then raise exception 'cliente tem projetos'; end if;
  if exists (select 1 from usuarios where cliente_id = p_id) then raise exception 'cliente tem usuários'; end if;
  delete from gestores where cliente_id = p_id;
  delete from clientes where id = p_id;
  insert into historico (vaga_id, nome_usuario, acao) values (null, meu_nome(), 'Excluiu o cliente ' || v_nome);
end $$;

revoke execute on function public.etapas_padrao_do_cliente, public.travar_etapa_cliente from public, anon, authenticated;
revoke execute on function public.incluir_etapa_cliente, public.excluir_etapa_cliente, public.renomear_etapa_cliente,
  public.mover_etapa_cliente, public.alterar_duracao_etapa_cliente, public.excluir_cliente from public, anon;
grant execute on function public.incluir_etapa_cliente, public.excluir_etapa_cliente, public.renomear_etapa_cliente,
  public.mover_etapa_cliente, public.alterar_duracao_etapa_cliente, public.excluir_cliente to authenticated;

do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef loop
    execute format('alter function %s set search_path = public, pg_temp', f);
  end loop;
end $$;
