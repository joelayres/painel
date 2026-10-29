-- Perfil Analista de RH: trabalha como o RH (rótulo "Administrador"), mas só nos projetos liberados
-- para ele em projeto_acessos. Toda escrita sobre um projeto passa a conferir "pode alterar este
-- projeto"; o que é de fora de projeto (clientes, gestores, usuários, feriados, registro geral)
-- continua só com o RH. Migração aditiva: o código publicado só conhece rh, gestor e cliente e chama
-- as mesmas funções, com o mesmo resultado para o RH.

-- O perfil ----------------------------------------------------------------------------------------

alter table usuarios drop constraint usuarios_perfil_check;
alter table usuarios add constraint usuarios_perfil_check check (perfil in ('rh', 'analista', 'gestor', 'cliente'));

create function public.eh_analista() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(meu_perfil() = 'analista', false)
$$;

-- RH, ou Analista ativo com o projeto liberado. Perfil e acesso valem juntos: o Analista que vira
-- Gestor fica só com a leitura, e o desativado fica sem nada. Projeto nulo (não existe) dá falso.
create function public.pode_alterar_projeto(p uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p is not null and (eh_rh() or (eh_analista() and exists (
    select 1 from projeto_acessos a join usuarios u on u.id = a.usuario_id
    where a.projeto_id = p and u.usuario_id = auth.uid()
  )))
$$;

revoke execute on function public.eh_analista, public.pode_alterar_projeto from public, anon;
grant execute on function public.eh_analista, public.pode_alterar_projeto to authenticated;

-- Para as funções de escrita: recusa quem não pode alterar o projeto. O RH passa mesmo com projeto
-- nulo, para continuar recebendo o "não encontrado" de sempre; o Analista recebe "sem permissão",
-- sem saber se o id existe em outro projeto.
create function public.exigir_projeto(p uuid) returns void
language plpgsql set search_path = public, pg_temp as $$
begin
  if not (eh_rh() or pode_alterar_projeto(p)) then raise exception 'sem permissão'; end if;
end $$;

revoke execute on function public.exigir_projeto from public, anon, authenticated;

-- Ações sobre a vaga ------------------------------------------------------------------------------
-- concluir_etapas, concluir_etapa, desfazer_etapa e candidato_desistiu passam por aqui.

create or replace function public.travar_vaga_rh(p_vaga uuid) returns void
language plpgsql set search_path = public, pg_temp as $$
declare v_projeto uuid; v_cancelada timestamptz;
begin
  -- A permissão vem antes da trava: ninguém trava vaga de projeto que não pode alterar.
  perform exigir_projeto((select projeto_id from vagas where id = p_vaga));
  select projeto_id, cancelada_em into v_projeto, v_cancelada from vagas where id = p_vaga for update;
  if not found then raise exception 'vaga não encontrada'; end if;
  perform exigir_projeto(v_projeto);
  if v_cancelada is not null then raise exception 'vaga cancelada'; end if;
end $$;

revoke execute on function public.travar_vaga_rh from public, anon, authenticated;

-- p: funcao, disciplina, area, onda_id, meta, gestor_id, candidato, data_inicio e, só ao criar,
-- projeto_id.
create or replace function public.salvar_vaga(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_antes jsonb;
begin
  if p_id is null then
    perform exigir_projeto(nullif(p->>'projeto_id', '')::uuid);
    insert into vagas (projeto_id, funcao, disciplina, area, onda_id, meta, gestor_id, candidato, data_inicio)
    values (nullif(p->>'projeto_id', '')::uuid, p->>'funcao', coalesce(p->>'disciplina', ''), coalesce(p->>'area', ''),
      nullif(p->>'onda_id', '')::uuid, nullif(p->>'meta', '')::date, nullif(p->>'gestor_id', '')::uuid,
      nullif(p->>'candidato', ''), (p->>'data_inicio')::date)
    returning id into v_id;
    insert into historico (vaga_id, nome_usuario, acao) values (v_id, meu_nome(), 'Criou a vaga');
    return v_id;
  end if;
  perform exigir_projeto((select projeto_id from vagas where id = p_id));
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

create or replace function public.cancelar_vaga(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform exigir_projeto((select projeto_id from vagas where id = p_id));
  update vagas set cancelada_em = now() where id = p_id and cancelada_em is null;
  if not found then raise exception 'vaga não encontrada'; end if;
  insert into historico (vaga_id, nome_usuario, acao) values (p_id, meu_nome(), 'Cancelou a vaga');
end $$;

-- Importação do modelo: concluidas[].ordem é a posição na lista do projeto.
create or replace function public.importar_vagas(p_projeto uuid, p_vagas jsonb) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare v jsonb; c jsonb; v_id uuid; v_etapa uuid; v_n int := 0; v_projeto text;
begin
  perform exigir_projeto(p_projeto);
  select nome into v_projeto from projetos where id = p_projeto for update;
  if not found then raise exception 'projeto não encontrado'; end if;
  for v in select * from jsonb_array_elements(p_vagas) loop
    insert into vagas (projeto_id, funcao, disciplina, area, onda_id, meta, gestor_id, candidato, data_inicio)
    values (p_projeto, v->>'funcao', coalesce(v->>'disciplina', ''), coalesce(v->>'area', ''),
      nullif(v->>'onda_id', '')::uuid, nullif(v->>'meta', '')::date, nullif(v->>'gestor_id', '')::uuid,
      nullif(v->>'candidato', ''), (v->>'data_inicio')::date)
    returning id into v_id;
    for c in select * from jsonb_array_elements(coalesce(v->'concluidas', '[]'::jsonb)) loop
      v_etapa := etapa_na_posicao(p_projeto, (c->>'ordem')::smallint);
      if v_etapa is null then raise exception 'etapa não encontrada'; end if;
      insert into vaga_conclusoes (vaga_id, etapa_id, concluida_em) values (v_id, v_etapa, (c->>'concluida_em')::date);
    end loop;
    v_n := v_n + 1;
  end loop;
  insert into historico (vaga_id, nome_usuario, acao) values (null, meu_nome(), format('Importou %s vagas em %s', v_n, v_projeto));
  return v_n;
end $$;

-- Ações sobre o projeto ---------------------------------------------------------------------------

-- p: cliente_id, nome, area, organizacao. O cliente não muda, e a organização só muda sem vagas
-- (regras do gatilho conferir_projeto). O projeto que um Analista cria já nasce liberado para ele,
-- aqui mesmo: a marca painel.projeto_criado deixa o gatilho conferir_acesso aceitar essa liberação.
create or replace function public.salvar_projeto(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_antes projetos;
begin
  if p_id is null then
    if not (eh_rh() or eh_analista()) then raise exception 'sem permissão'; end if;
    insert into projetos (cliente_id, nome, area, organizacao)
    values ((p->>'cliente_id')::uuid, p->>'nome', nullif(p->>'area', ''), p->>'organizacao')
    returning id into v_id;
    if not eh_rh() then
      perform set_config('painel.projeto_criado', v_id::text, true);
      insert into projeto_acessos (projeto_id, usuario_id) select v_id, id from usuarios where usuario_id = auth.uid();
      perform set_config('painel.projeto_criado', '', true);
    end if;
    insert into historico (vaga_id, nome_usuario, acao) values (null, meu_nome(), 'Criou o projeto ' || (p->>'nome'));
    return v_id;
  end if;
  perform exigir_projeto(p_id);
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

create or replace function public.encerrar_projeto(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_nome text;
begin
  perform exigir_projeto(p_id);
  update projetos set encerrado_em = now() where id = p_id and encerrado_em is null returning nome into v_nome;
  if not found then raise exception 'projeto não encontrado'; end if;
  insert into historico (vaga_id, nome_usuario, acao) values (null, meu_nome(), 'Encerrou o projeto ' || v_nome);
end $$;

create or replace function public.reabrir_projeto(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_nome text;
begin
  perform exigir_projeto(p_id);
  update projetos set encerrado_em = null where id = p_id and encerrado_em is not null returning nome into v_nome;
  if not found then raise exception 'projeto não encontrado'; end if;
  insert into historico (vaga_id, nome_usuario, acao) values (null, meu_nome(), 'Reabriu o projeto ' || v_nome);
end $$;

create or replace function public.salvar_onda_projeto(p_id uuid, p_projeto uuid, p_nome text, p_inicio date, p_fim date) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_antes jsonb; v_organizacao text; v_projeto text;
begin
  perform exigir_projeto(p_projeto);
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

-- A lista de etapas -------------------------------------------------------------------------------
-- excluir_etapa, renomear_etapa, mover_etapa e alterar_duracao_etapa passam por travar_etapa_rh.

-- Trava o projeto da etapa e devolve a etapa relida depois da trava.
create or replace function public.travar_etapa_rh(p_etapa uuid, p_vagas boolean) returns projeto_etapas
language plpgsql set search_path = public, pg_temp as $$
declare v_projeto uuid; v_etapa projeto_etapas;
begin
  select projeto_id into v_projeto from projeto_etapas where id = p_etapa;
  perform exigir_projeto(v_projeto);
  if v_projeto is null then raise exception 'etapa não encontrada'; end if;
  perform 1 from projetos where id = v_projeto for update;
  if p_vagas then perform 1 from vagas where projeto_id = v_projeto for update; end if;
  select * into v_etapa from projeto_etapas where id = p_etapa;
  if not found then raise exception 'etapa não encontrada'; end if;
  return v_etapa;
end $$;

revoke execute on function public.travar_etapa_rh from public, anon, authenticated;

-- Inclui uma etapa depois de p_depois_de (null = na primeira posição). A vaga que já chegou ao ponto
-- (concluiu p_depois_de; na primeira posição, toda vaga) fica com a etapa nova concluída na data da
-- anterior (ou no início da vaga): nenhuma vaga muda de etapa atual, de previsão nem de cor.
create or replace function public.incluir_etapa(p_projeto uuid, p_nome text, p_duracao smallint, p_depois_de uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_projeto text; v_nome text := trim(p_nome); v_depois projeto_etapas; v_posicao smallint; v_id uuid; v_n int;
begin
  perform exigir_projeto(p_projeto);
  select nome into v_projeto from projetos where id = p_projeto for update;
  if not found then raise exception 'projeto não encontrado'; end if;
  perform 1 from vagas where projeto_id = p_projeto for update;
  if coalesce(v_nome, '') = '' then raise exception 'nome obrigatório'; end if;
  if p_duracao is null then raise exception 'duração obrigatória'; end if;
  if p_duracao not between 0 and 60 then raise exception 'duração inválida'; end if;
  if exists (select 1 from projeto_etapas where projeto_id = p_projeto and lower(nome) = lower(v_nome)) then
    raise exception 'etapa repetida';
  end if;
  if p_depois_de is null then
    v_posicao := 1;
  else
    select * into v_depois from projeto_etapas where id = p_depois_de and projeto_id = p_projeto;
    if not found then raise exception 'etapa não encontrada'; end if;
    v_posicao := v_depois.posicao + 1;
  end if;
  update projeto_etapas set posicao = posicao + 1 where projeto_id = p_projeto and posicao >= v_posicao;
  insert into projeto_etapas (projeto_id, posicao, nome, duracao) values (p_projeto, v_posicao, v_nome, p_duracao) returning id into v_id;

  with chegaram as (
    select v.id as vaga_id, coalesce(vc.concluida_em, v.data_inicio) as data
    from vagas v left join vaga_conclusoes vc on vc.vaga_id = v.id and vc.etapa_id = p_depois_de
    where v.projeto_id = p_projeto and (p_depois_de is null or vc.vaga_id is not null)
  ), gravadas as (
    insert into vaga_conclusoes (vaga_id, etapa_id, concluida_em, automatica)
    select vaga_id, v_id, data, true from chegaram returning vaga_id, concluida_em
  )
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  select vaga_id, meu_nome(), 'Etapa ' || v_nome || ' incluída e marcada como concluída', jsonb_build_object('data', concluida_em) from gravadas;
  get diagnostics v_n = row_count;

  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (null, meu_nome(), format('Incluiu a etapa %s em %s', v_nome, v_projeto),
    jsonb_build_object('projeto', v_projeto, 'etapa', v_nome, 'depois_de', v_depois.nome, 'concluidas_automaticamente', v_n));
  return v_id;
end $$;

-- Quem vê o projeto -------------------------------------------------------------------------------

-- O RH já vê tudo; o usuário cliente só recebe projetos do próprio cliente. O Analista não libera
-- nem remove o acesso de um Analista ou do RH, nem o próprio: só gestores e clientes. A única
-- exceção é a liberação do criador, feita por salvar_projeto com a marca painel.projeto_criado.
create or replace function public.conferir_acesso() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_linha projeto_acessos; v_perfil text; v_cliente uuid;
begin
  v_linha := case tg_op when 'DELETE' then old else new end;
  select perfil, cliente_id into v_perfil, v_cliente from usuarios where id = v_linha.usuario_id;
  if eh_analista() and not eh_rh() and v_perfil in ('analista', 'rh')
     and not (tg_op = 'INSERT' and v_linha.projeto_id::text = current_setting('painel.projeto_criado', true)
              and v_linha.usuario_id = (select id from usuarios where usuario_id = auth.uid())) then
    raise exception 'analista não libera este perfil';
  end if;
  -- Na edição, a linha de antes também passa pela regra do Analista.
  if tg_op = 'UPDATE' and eh_analista() and not eh_rh()
     and (select perfil from usuarios where id = old.usuario_id) in ('analista', 'rh') then
    raise exception 'analista não libera este perfil';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if v_perfil = 'rh' then raise exception 'perfil sem acesso por projeto'; end if;
  if v_perfil = 'cliente' and v_cliente is distinct from (select cliente_id from projetos where id = new.projeto_id) then
    raise exception 'cliente diferente';
  end if;
  return new;
end $$;

drop trigger conferir_acesso on projeto_acessos;
create trigger conferir_acesso before insert or update or delete on projeto_acessos for each row execute function conferir_acesso();

-- Para a tela "Quem vê este projeto": quem pode receber o projeto e quem já o vê, sem e-mail.
-- O RH libera gestores, analistas e os clientes do cliente do projeto; o Analista, só gestores e
-- esses clientes.
create function public.pessoas_liberaveis(p_projeto uuid) returns table (id uuid, nome text, perfil text, cliente_id uuid)
language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
begin
  if not pode_alterar_projeto(p_projeto) then raise exception 'sem permissão'; end if;
  return query
    select u.id, u.nome, u.perfil, u.cliente_id from usuarios u
    where u.ativo and (u.perfil = 'gestor' or (u.perfil = 'analista' and eh_rh())
      or (u.perfil = 'cliente' and u.cliente_id = (select p.cliente_id from projetos p where p.id = p_projeto)))
    order by u.nome, u.id;
end $$;

create function public.pessoas_do_projeto(p_projeto uuid) returns table (id uuid, nome text, perfil text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
begin
  if not pode_alterar_projeto(p_projeto) then raise exception 'sem permissão'; end if;
  return query
    select u.id, u.nome, u.perfil from projeto_acessos a join usuarios u on u.id = a.usuario_id
    where a.projeto_id = p_projeto
    order by u.nome, u.id;
end $$;

revoke execute on function public.pessoas_liberaveis, public.pessoas_do_projeto from public, anon;
grant execute on function public.pessoas_liberaveis, public.pessoas_do_projeto to authenticated;

-- Leitura e escrita (RLS) -------------------------------------------------------------------------

-- O Analista vê os acessos dos projetos que pode alterar, e libera e remove neles (o gatilho
-- conferir_acesso diz quem). Editar uma linha continua só com o RH.
drop policy leitura on projeto_acessos;
create policy leitura on projeto_acessos for select to authenticated
  using (eh_rh() or projeto_acessos.usuario_id in (select u.id from usuarios u where u.usuario_id = auth.uid())
    or pode_alterar_projeto(projeto_acessos.projeto_id));
create policy libera on projeto_acessos for insert to authenticated with check (pode_alterar_projeto(projeto_id));
create policy remove on projeto_acessos for delete to authenticated using (pode_alterar_projeto(projeto_id));

-- O Analista vê o nome de todos os clientes, para escolher ao criar um projeto. As durações e os
-- gestores, só dos clientes dos projetos dele (políticas de hoje).
drop policy leitura on clientes;
create policy leitura on clientes for select to authenticated
  using (eh_rh() or eh_analista() or exists (select 1 from projetos p where p.cliente_id = clientes.id and pode_ver_projeto(p.id)));

do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef loop
    execute format('alter function %s set search_path = public, pg_temp', f);
  end loop;
end $$;
