-- Adiar a etapa atual: a vaga já foi aberta, mas a próxima etapa só começa numa data futura (vagas
-- de ondas que ainda não começaram). A previsão conta a etapa adiada a partir dessa data; ao concluí-la,
-- vale a conclusão real e o adiamento deixa de pesar. Um adiamento por vaga: adiar de novo troca o anterior.
-- Migração aditiva: o código publicado não lê as colunas nem chama as funções.

alter table vagas add column adiada_ate date;
alter table vagas add column adiada_etapa_id uuid references projeto_etapas on delete set null;

-- Adia a etapa atual da vaga até `p_data`. Data de hoje ou do passado tira o adiamento.
create function public.adiar_etapa(p_vaga uuid, p_data date) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_projeto uuid; v_etapa projeto_etapas;
begin
  if p_data is null then raise exception 'data obrigatória'; end if;
  perform travar_vaga_rh(p_vaga);
  select projeto_id into v_projeto from vagas where id = p_vaga;
  select e.* into v_etapa from projeto_etapas e
  where e.projeto_id = v_projeto and not exists (select 1 from vaga_conclusoes c where c.vaga_id = p_vaga and c.etapa_id = e.id)
  order by e.posicao limit 1;
  if not found then raise exception 'vaga mobilizada'; end if;
  if p_data <= hoje_sp() then
    if not exists (select 1 from vagas where id = p_vaga and adiada_ate is not null) then return; end if;
    update vagas set adiada_ate = null, adiada_etapa_id = null where id = p_vaga;
    insert into historico (vaga_id, nome_usuario, acao) values (p_vaga, meu_nome(), 'Tirou o adiamento de ' || v_etapa.nome);
    return;
  end if;
  update vagas set adiada_ate = p_data, adiada_etapa_id = v_etapa.id where id = p_vaga;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (p_vaga, meu_nome(), 'Adiou ' || v_etapa.nome || ' para ' || to_char(p_data, 'DD/MM/YYYY'), jsonb_build_object('adiada_ate', p_data));
end $$;

-- Em grupo, tudo ou nada, como as outras ações em grupo. Vagas mobilizadas ficam de fora (puladas).
create function public.adiar_etapa_em_grupo(p_vagas uuid[], p_data date) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid; v_alteradas int := 0; v_puladas int := 0;
begin
  perform projeto_do_grupo(p_vagas);
  foreach v in array p_vagas loop
    begin
      if not exists (
        select 1 from projeto_etapas e join vagas g on g.projeto_id = e.projeto_id
        where g.id = v and not exists (select 1 from vaga_conclusoes c where c.vaga_id = v and c.etapa_id = e.id)
      ) then
        v_puladas := v_puladas + 1;
        continue;
      end if;
      perform adiar_etapa(v, p_data);
    exception when others then
      raise exception 'vaga %: %', v, sqlerrm;
    end;
    v_alteradas := v_alteradas + 1;
  end loop;
  return jsonb_build_object('alteradas', v_alteradas, 'puladas', v_puladas);
end $$;

revoke execute on function public.adiar_etapa, public.adiar_etapa_em_grupo from public, anon;
grant execute on function public.adiar_etapa, public.adiar_etapa_em_grupo to authenticated;
