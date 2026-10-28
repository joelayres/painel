-- Limpeza do modelo de uma mobilização só. Só vai ao ar depois que o código novo estiver publicado:
-- o código antigo ainda usa ondas.numero, o perfil visualizador e as funções que saem aqui.

-- O que o código antigo criou entre a 005 e a publicação do código novo entra na Braskem 2027,
-- como a 005 fez com os dados de antes dela.
do $$
declare v_cliente uuid; v_projeto uuid;
begin
  select id into v_cliente from clientes where nome = 'Braskem';
  select id into v_projeto from projetos where cliente_id = v_cliente and nome = 'Mobilização Braskem 2027';
  update ondas set projeto_id = coalesce(projeto_id, v_projeto), nome = coalesce(nome, numero || 'ª Onda')
    where projeto_id is null or nome is null;
  update vagas v set projeto_id = o.projeto_id from ondas o where o.id = v.onda_id and v.projeto_id is null;
  with convertidos as (update usuarios set perfil = 'gestor' where perfil = 'visualizador' returning id)
  insert into projeto_acessos (projeto_id, usuario_id) select v_projeto, id from convertidos on conflict do nothing;
  update gestores set cliente_id = v_cliente where cliente_id is null;
end $$;

-- Todo dado agora pertence a um projeto, e todo gestor a um cliente.
alter table gestores alter column cliente_id set not null;
alter table ondas alter column projeto_id set not null, alter column nome set not null;
alter table vagas alter column projeto_id set not null;

-- O número da onda sai; o unique e o check de 1 a 4 saem junto com a coluna.
alter table ondas drop column numero;

-- O perfil visualizador acabou (a 005 já converteu os usuários em gestores).
alter table usuarios drop constraint usuarios_perfil_check;
alter table usuarios add constraint usuarios_perfil_check check (perfil in ('rh', 'gestor', 'cliente'));

-- Vaga sem projeto não entra mais: o projeto é obrigatório e não vem mais da onda. Com projeto nulo
-- o gatilho deixa passar para a restrição not null recusar a linha.
create or replace function public.conferir_vaga() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_organizacao text; v_projeto_onda uuid;
begin
  if new.projeto_id is null then return new; end if;
  if new.onda_id is not null then select projeto_id into v_projeto_onda from ondas where id = new.onda_id; end if;
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

-- Funções do modelo antigo, trocadas por salvar_onda_projeto, alterar_duracao_cliente/projeto e importar_vagas.
drop function public.salvar_onda(uuid, smallint, date, date);
drop function public.alterar_duracao(smallint, smallint);
drop function public.importar_carga(jsonb, text);

do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef loop
    execute format('alter function %s set search_path = public, pg_temp', f);
  end loop;
end $$;
