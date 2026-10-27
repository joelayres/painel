-- Ações do RH sobre as vagas. Conferem o perfil, travam a vaga e registram o histórico com o nome.

create function public.meu_nome() returns text
language sql stable security definer set search_path = public as $$
  select nome from usuarios where usuario_id = auth.uid()
$$;

-- Etapa atual = maior ordem concluída + 1 (as conclusões são sempre um prefixo).
create function public.etapa_atual(p_vaga uuid) returns smallint
language sql stable set search_path = public as $$
  select (coalesce(max(ordem), 0) + 1)::smallint from vaga_conclusoes where vaga_id = p_vaga
$$;

create function public.travar_vaga_rh(p_vaga uuid) returns void
language plpgsql set search_path = public as $$
declare v_cancelada timestamptz;
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
  select cancelada_em into v_cancelada from vagas where id = p_vaga for update;
  if not found then raise exception 'vaga não encontrada'; end if;
  if v_cancelada is not null then raise exception 'vaga cancelada'; end if;
end $$;

create function public.concluir_etapa(p_vaga uuid, p_ordem_esperada smallint, p_data date) returns void
language plpgsql security definer set search_path = public as $$
declare v_anterior date; v_nome text;
begin
  perform travar_vaga_rh(p_vaga);
  -- A outra pessoa do RH pode ter avançado a mesma vaga enquanto esta olhava a tela.
  if etapa_atual(p_vaga) <> p_ordem_esperada or p_ordem_esperada > 13 then raise exception 'etapa mudou'; end if;
  if p_data > hoje_sp() then raise exception 'data no futuro'; end if;
  select concluida_em into v_anterior from vaga_conclusoes where vaga_id = p_vaga and ordem = p_ordem_esperada - 1;
  if v_anterior is not null and p_data < v_anterior then raise exception 'data antes da etapa anterior'; end if;
  insert into vaga_conclusoes (vaga_id, ordem, concluida_em) values (p_vaga, p_ordem_esperada, p_data);
  select nome into v_nome from etapas where ordem = p_ordem_esperada;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (p_vaga, meu_nome(), 'Concluiu ' || v_nome, jsonb_build_object('ordem', p_ordem_esperada, 'data', p_data));
end $$;

create function public.desfazer_etapa(p_vaga uuid, p_ordem_esperada smallint) returns void
language plpgsql security definer set search_path = public as $$
declare v_nome text;
begin
  perform travar_vaga_rh(p_vaga);
  if etapa_atual(p_vaga) - 1 <> p_ordem_esperada or p_ordem_esperada < 1 then raise exception 'etapa mudou'; end if;
  delete from vaga_conclusoes where vaga_id = p_vaga and ordem = p_ordem_esperada;
  select nome into v_nome from etapas where ordem = p_ordem_esperada;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (p_vaga, meu_nome(), 'Desfez ' || v_nome, jsonb_build_object('ordem', p_ordem_esperada));
end $$;

create function public.candidato_desistiu(p_vaga uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_candidato text;
begin
  perform travar_vaga_rh(p_vaga);
  select candidato into v_candidato from vagas where id = p_vaga;
  delete from vaga_conclusoes where vaga_id = p_vaga and ordem >= 2;
  update vagas set candidato = null, retomada_em = hoje_sp() where id = p_vaga;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (p_vaga, meu_nome(), 'Candidato desistiu', jsonb_build_object('candidato', v_candidato));
end $$;

create function public.alterar_duracao(p_ordem smallint, p_dias smallint) returns void
language plpgsql security definer set search_path = public as $$
declare v_antes smallint; v_nome text;
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
  if p_dias < 0 then raise exception 'duração inválida'; end if;
  select duracao, nome into v_antes, v_nome from etapas where ordem = p_ordem for update;
  if not found then raise exception 'etapa não encontrada'; end if;
  update etapas set duracao = p_dias where ordem = p_ordem;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (null, meu_nome(), 'Alterou a duração de ' || v_nome, jsonb_build_object('antes', v_antes, 'depois', p_dias));
end $$;

revoke execute on function public.concluir_etapa, public.desfazer_etapa, public.candidato_desistiu, public.alterar_duracao from public, anon;
grant execute on function public.concluir_etapa, public.desfazer_etapa, public.candidato_desistiu, public.alterar_duracao to authenticated;
revoke execute on function public.travar_vaga_rh from public, anon, authenticated;
