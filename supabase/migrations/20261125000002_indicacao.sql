-- Indicação: quem indicou o candidato (por exemplo, "Ivan Braskem"), em cada participação. Quando o
-- candidato entra numa seleção nova (reconhecido na análise ou incluído do banco), a participação já
-- vem com a última indicação dele; o RH corrige se mudar. Migração aditiva.

alter table participacoes add column indicado_por text check (length(indicado_por) between 1 and 120);

-- Texto vazio tira a indicação. O histórico guarda o valor anterior.
create function public.definir_indicacao(p_participacao uuid, p_indicado_por text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_sel uuid; v_de text; v_para text := nullif(trim(coalesce(p_indicado_por, '')), '');
begin
  v_sel := exigir_participacao(p_participacao);
  if length(v_para) > 120 then raise exception 'indicação longa demais'; end if;
  select indicado_por into v_de from participacoes where id = p_participacao for update;
  if v_de is not distinct from v_para then return; end if;
  update participacoes set indicado_por = v_para where id = p_participacao;
  perform registrar_selecao(v_sel, p_participacao,
    case when v_de is null then 'Registrou a indicação' when v_para is null then 'Tirou a indicação' else 'Mudou a indicação' end,
    jsonb_build_object('de', v_de, 'para', v_para));
end $$;

-- A participação ganhou candidato (análise ou inclusão do banco) e ainda não tem indicação: repete a
-- última indicação registrada desse candidato em outra seleção.
create function public.herdar_indicacao() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v text;
begin
  select indicado_por into v from participacoes
  where candidato_id = new.candidato_id and id <> new.id and indicado_por is not null
  order by criado_em desc, id limit 1;
  if v is null then return null; end if;
  update participacoes set indicado_por = v where id = new.id and indicado_por is null;
  perform registrar_selecao(new.selecao_id, new.id, 'Repetiu a indicação da seleção anterior', jsonb_build_object('para', v));
  return null;
end $$;

create trigger herdar_indicacao_inclusao after insert on participacoes for each row
  when (new.candidato_id is not null and new.indicado_por is null and new.situacao <> 'repetida')
  execute function herdar_indicacao();
create trigger herdar_indicacao_analise after update of candidato_id on participacoes for each row
  when (old.candidato_id is null and new.candidato_id is not null and new.indicado_por is null and new.situacao <> 'repetida')
  execute function herdar_indicacao();

-- Os nomes já usados, para sugerir na tela e evitar o mesmo indicador escrito de jeitos diferentes.
create function public.indicadores() returns text[]
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform exigir_equipe();
  return coalesce((select array_agg(distinct indicado_por order by indicado_por) from participacoes where indicado_por is not null), '{}');
end $$;

-- Busca e ficha passam a trazer a indicação (o retorno muda: recriadas).
drop function public.buscar_candidatos(jsonb);
create function public.buscar_candidatos(p jsonb) returns table (
  id uuid, nome text, cidade text, uf text, ultima_em timestamptz, funcoes text[], melhor_nota smallint, resultados text[], indicacoes text[]
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform exigir_equipe();
  return query
  with resumo as (
    select k.id, k.nome, k.cidade, k.uf,
      coalesce(max(pa.criado_em), k.criado_em) as ultima_em,
      coalesce(array_agg(distinct s.funcao) filter (where s.funcao is not null), '{}') as funcoes,
      (select max(a.nota) from analises_ia a join participacoes x on x.id = a.participacao_id where x.candidato_id = k.id) as melhor_nota,
      coalesce(array_agg(distinct pa.resultado) filter (where pa.resultado is not null), '{}') as resultados,
      coalesce(array_agg(distinct pa.classificacao) filter (where pa.classificacao is not null), '{}') as classificacoes,
      coalesce(array_agg(distinct pa.indicado_por) filter (where pa.indicado_por is not null), '{}') as indicacoes
    from candidatos k
    left join participacoes pa on pa.candidato_id = k.id and pa.situacao <> 'repetida'
    left join selecoes s on s.id = pa.selecao_id
    group by k.id
  )
  select r.id, r.nome, r.cidade, r.uf, r.ultima_em, r.funcoes, r.melhor_nota, r.resultados, r.indicacoes
  from resumo r
  where (nullif(trim(p->>'nome'), '') is null or r.nome ilike '%' || trim(p->>'nome') || '%')
    and (nullif(trim(p->>'funcao'), '') is null or exists (select 1 from unnest(r.funcoes) f where f ilike '%' || trim(p->>'funcao') || '%'))
    and (nullif(p->>'resultado', '') is null or (p->>'resultado') = any (r.resultados))
    and (nullif(p->>'classificacao', '') is null or (p->>'classificacao') = any (r.classificacoes))
    and (nullif(p->>'nota_min', '') is null or r.melhor_nota >= (p->>'nota_min')::int)
    and (nullif(trim(p->>'uf'), '') is null or upper(r.uf) = upper(trim(p->>'uf')))
    and (nullif(p->>'desde', '') is null or r.ultima_em >= (p->>'desde')::date)
    and (nullif(trim(p->>'indicado_por'), '') is null or exists (select 1 from unnest(r.indicacoes) i where i ilike '%' || trim(p->>'indicado_por') || '%'))
  order by r.ultima_em desc
  limit 200;
end $$;

drop function public.participacoes_do_candidato(uuid);
create function public.participacoes_do_candidato(p_candidato uuid) returns table (
  participacao_id uuid, selecao_id uuid, projeto_id uuid, projeto text, funcao text, criado_em timestamptz,
  nota smallint, classificacao text, resultado text, detalhe_visivel boolean, indicado_por text
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform exigir_equipe();
  return query
  select pa.id, s.id, pr.id, pr.nome, s.funcao, pa.criado_em,
    (select a.nota from analises_ia a where a.participacao_id = pa.id order by a.criado_em desc, a.id limit 1),
    pa.classificacao, pa.resultado, pode_alterar_projeto(pr.id), pa.indicado_por
  from participacoes pa join selecoes s on s.id = pa.selecao_id join projetos pr on pr.id = s.projeto_id
  where pa.candidato_id = p_candidato and pa.situacao <> 'repetida'
  order by pa.criado_em desc;
end $$;

revoke execute on function public.herdar_indicacao from public, anon, authenticated;
revoke execute on function public.definir_indicacao, public.indicadores, public.buscar_candidatos, public.participacoes_do_candidato from public, anon;
grant execute on function public.definir_indicacao, public.indicadores, public.buscar_candidatos, public.participacoes_do_candidato to authenticated;
