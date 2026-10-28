-- Mudanças de vaga e de onda passam por funções que registram o histórico (quem, quando, antes e depois),
-- e a carga inicial grava tudo numa transação só.

create function public.salvar_vaga(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_antes jsonb;
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
  if p_id is null then
    insert into vagas (funcao, disciplina, area, onda_id, gestor_id, candidato, data_inicio)
    values (p->>'funcao', p->>'disciplina', p->>'area', (p->>'onda_id')::uuid, nullif(p->>'gestor_id', '')::uuid, nullif(p->>'candidato', ''), (p->>'data_inicio')::date)
    returning id into v_id;
    insert into historico (vaga_id, nome_usuario, acao) values (v_id, meu_nome(), 'Criou a vaga');
    return v_id;
  end if;
  select jsonb_build_object('funcao', funcao, 'disciplina', disciplina, 'area', area, 'onda_id', onda_id, 'gestor_id', gestor_id, 'candidato', candidato, 'data_inicio', data_inicio)
    into v_antes from vagas where id = p_id for update;
  if not found then raise exception 'vaga não encontrada'; end if;
  update vagas set
    funcao = p->>'funcao', disciplina = p->>'disciplina', area = p->>'area', onda_id = (p->>'onda_id')::uuid,
    gestor_id = nullif(p->>'gestor_id', '')::uuid, candidato = nullif(p->>'candidato', ''), data_inicio = (p->>'data_inicio')::date
  where id = p_id;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  select p_id, meu_nome(), 'Editou a vaga', jsonb_build_object('antes', v_antes, 'depois', jsonb_build_object(
    'funcao', funcao, 'disciplina', disciplina, 'area', area, 'onda_id', onda_id, 'gestor_id', gestor_id, 'candidato', candidato, 'data_inicio', data_inicio))
  from vagas where id = p_id;
  return p_id;
end $$;

create function public.cancelar_vaga(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
  update vagas set cancelada_em = now() where id = p_id and cancelada_em is null;
  if not found then raise exception 'vaga não encontrada'; end if;
  insert into historico (vaga_id, nome_usuario, acao) values (p_id, meu_nome(), 'Cancelou a vaga');
end $$;

create function public.salvar_onda(p_id uuid, p_numero smallint, p_inicio date, p_fim date) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_antes jsonb;
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
  if p_id is null then
    insert into ondas (numero, inicio, fim) values (p_numero, p_inicio, p_fim) returning id into v_id;
    insert into historico (vaga_id, nome_usuario, acao, detalhe)
    values (null, meu_nome(), format('Cadastrou a %sª Onda', p_numero), jsonb_build_object('inicio', p_inicio, 'fim', p_fim));
    return v_id;
  end if;
  select jsonb_build_object('inicio', inicio, 'fim', fim) into v_antes from ondas where id = p_id for update;
  if not found then raise exception 'onda não encontrada'; end if;
  update ondas set numero = p_numero, inicio = p_inicio, fim = p_fim where id = p_id;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (null, meu_nome(), format('Alterou a %sª Onda', p_numero), jsonb_build_object('antes', v_antes, 'depois', jsonb_build_object('inicio', p_inicio, 'fim', p_fim)));
  return p_id;
end $$;

-- Carga inicial: uma transação, com a tabela travada, só com o painel vazio.
-- Chamada pelo servidor (service_role) depois de conferir que quem pede é do RH.
create function public.importar_carga(p_vagas jsonb, p_nome text) returns int
language plpgsql security definer set search_path = public as $$
declare v jsonb; c jsonb; v_id uuid; v_onda uuid; v_n int := 0;
begin
  lock table vagas in share row exclusive mode;
  for v in select * from jsonb_array_elements(p_vagas) loop
    if not exists (select 1 from ondas where numero = (v->>'onda')::smallint) then
      raise exception 'falta onda %', v->>'onda';
    end if;
  end loop;
  if exists (select 1 from vagas) then raise exception 'painel não está vazio'; end if;
  for v in select * from jsonb_array_elements(p_vagas) loop
    select id into v_onda from ondas where numero = (v->>'onda')::smallint;
    insert into vagas (funcao, disciplina, area, onda_id, candidato, data_inicio)
    values (v->>'funcao', v->>'disciplina', v->>'area', v_onda, nullif(v->>'candidato', ''), (v->>'dataInicio')::date)
    returning id into v_id;
    for c in select * from jsonb_array_elements(v->'concluidas') loop
      insert into vaga_conclusoes (vaga_id, ordem, concluida_em) values (v_id, (c->>'ordem')::smallint, (c->>'concluidaEm')::date);
    end loop;
    v_n := v_n + 1;
  end loop;
  insert into historico (vaga_id, nome_usuario, acao) values (null, p_nome, format('Carga inicial da planilha: %s vagas', v_n));
  return v_n;
end $$;

revoke execute on function public.salvar_vaga, public.cancelar_vaga, public.salvar_onda from public, anon;
grant execute on function public.salvar_vaga, public.cancelar_vaga, public.salvar_onda to authenticated;
revoke execute on function public.importar_carga from public, anon, authenticated;
grant execute on function public.importar_carga to service_role;
