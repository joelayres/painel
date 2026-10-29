-- Ações em grupo nas vagas de um projeto: avançar a mesma etapa, trocar meta, onda ou início.
-- Cada uma chama, vaga por vaga, a função de uma vaga só (mesmas regras, travas e histórico).
-- Um erro aborta o grupo inteiro e diz qual vaga travou: 'vaga <id>: <motivo>'.

-- Confere a lista e devolve o projeto das vagas: todas existem e são do mesmo projeto.
create function public.projeto_do_grupo(p_vagas uuid[]) returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_projetos uuid[]; v_achadas int;
begin
  if coalesce(array_length(p_vagas, 1), 0) = 0 then raise exception 'nenhuma vaga'; end if;
  select array_agg(distinct projeto_id), count(*) into v_projetos, v_achadas from vagas where id = any(p_vagas);
  if v_achadas <> (select count(distinct x) from unnest(p_vagas) x) then raise exception 'vaga não encontrada'; end if;
  if array_length(v_projetos, 1) <> 1 then raise exception 'vagas de projetos diferentes'; end if;
  perform exigir_projeto(v_projetos[1]);
  return v_projetos[1];
end $$;

create function public.concluir_etapa_em_grupo(p_vagas uuid[], p_ordem_esperada smallint, p_data date) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid; v_n int := 0;
begin
  perform projeto_do_grupo(p_vagas);
  foreach v in array p_vagas loop
    begin
      perform concluir_etapas(v, p_ordem_esperada, p_ordem_esperada, p_data);
    exception when others then
      raise exception 'vaga %: %', v, sqlerrm;
    end;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create function public.alterar_vagas_em_grupo(p_vagas uuid[], p_campo text, p_valor text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid; l vagas; p jsonb; v_alteradas int := 0; v_puladas int := 0;
begin
  if p_campo not in ('onda_id', 'meta', 'data_inicio') then raise exception 'campo inválido'; end if;
  perform projeto_do_grupo(p_vagas);
  foreach v in array p_vagas loop
    begin
      select * into l from vagas where id = v;
      if l.cancelada_em is not null then raise exception 'vaga cancelada'; end if;
      -- O início só pesa na previsão antes da primeira conclusão: quem já concluiu alguma etapa fica de fora.
      if p_campo = 'data_inicio' and exists (select 1 from vaga_conclusoes where vaga_id = v) then
        v_puladas := v_puladas + 1;
        continue;
      end if;
      p := jsonb_build_object('funcao', l.funcao, 'disciplina', l.disciplina, 'area', l.area, 'onda_id', l.onda_id, 'meta', l.meta,
        'gestor_id', l.gestor_id, 'candidato', l.candidato, 'data_inicio', l.data_inicio) || jsonb_build_object(p_campo, p_valor);
      perform salvar_vaga(v, p);
    exception when others then
      raise exception 'vaga %: %', v, sqlerrm;
    end;
    v_alteradas := v_alteradas + 1;
  end loop;
  return jsonb_build_object('alteradas', v_alteradas, 'puladas', v_puladas);
end $$;

revoke execute on function public.projeto_do_grupo from public, anon, authenticated;
revoke execute on function public.concluir_etapa_em_grupo, public.alterar_vagas_em_grupo from public, anon;
grant execute on function public.concluir_etapa_em_grupo, public.alterar_vagas_em_grupo to authenticated;

do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef loop
    execute format('alter function %s set search_path = public, pg_temp', f);
  end loop;
end $$;
