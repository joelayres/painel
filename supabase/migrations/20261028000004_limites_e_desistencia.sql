-- Datas de conclusão não podem vir antes do início da vaga (etapa 1) nem da retomada depois de
-- uma desistência (etapa 2); a desistência guarda as datas apagadas e não vale depois da admissão;
-- e as funções com permissão elevada fixam pg_temp no fim do search_path.

create or replace function public.concluir_etapa(p_vaga uuid, p_ordem_esperada smallint, p_data date) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_anterior date; v_nome text; v_inicio date; v_retomada date;
begin
  perform travar_vaga_rh(p_vaga);
  -- A outra pessoa do RH pode ter avançado a mesma vaga enquanto esta olhava a tela.
  if etapa_atual(p_vaga) <> p_ordem_esperada or p_ordem_esperada > 13 then raise exception 'etapa mudou'; end if;
  if p_data > hoje_sp() then raise exception 'data no futuro'; end if;
  select data_inicio, retomada_em into v_inicio, v_retomada from vagas where id = p_vaga;
  if p_ordem_esperada = 1 and p_data < v_inicio then raise exception 'data antes do início da vaga'; end if;
  if p_ordem_esperada = 2 and v_retomada is not null and p_data < v_retomada then raise exception 'data antes da retomada'; end if;
  select concluida_em into v_anterior from vaga_conclusoes where vaga_id = p_vaga and ordem = p_ordem_esperada - 1;
  if v_anterior is not null and p_data < v_anterior then raise exception 'data antes da etapa anterior'; end if;
  insert into vaga_conclusoes (vaga_id, ordem, concluida_em) values (p_vaga, p_ordem_esperada, p_data);
  select nome into v_nome from etapas where ordem = p_ordem_esperada;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (p_vaga, meu_nome(), 'Concluiu ' || v_nome, jsonb_build_object('ordem', p_ordem_esperada, 'data', p_data));
end $$;

create or replace function public.candidato_desistiu(p_vaga uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_candidato text; v_apagadas jsonb;
begin
  perform travar_vaga_rh(p_vaga);
  -- Depois da admissão a pessoa já é da Timenow: a vaga não volta para a captura.
  if exists (select 1 from vaga_conclusoes where vaga_id = p_vaga and ordem = 11) then raise exception 'vaga já admitida'; end if;
  select candidato into v_candidato from vagas where id = p_vaga;
  select coalesce(jsonb_agg(jsonb_build_object('ordem', ordem, 'concluida_em', concluida_em) order by ordem), '[]'::jsonb)
    into v_apagadas from vaga_conclusoes where vaga_id = p_vaga and ordem >= 2;
  delete from vaga_conclusoes where vaga_id = p_vaga and ordem >= 2;
  update vagas set candidato = null, retomada_em = hoje_sp() where id = p_vaga;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (p_vaga, meu_nome(), 'Candidato desistiu', jsonb_build_object('candidato', v_candidato, 'conclusoes', v_apagadas));
end $$;

do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef loop
    execute format('alter function %s set search_path = public, pg_temp', f);
  end loop;
end $$;
