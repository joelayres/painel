-- Etapas por projeto: cada projeto tem a própria lista de etapas (projeto_etapas), e as conclusões
-- passam a apontar para a etapa do projeto (vaga_conclusoes.etapa_id). Nas funções, a "ordem" que
-- chega (p_ordem_esperada, concluidas[].ordem) passa a ser a posição na lista do projeto.
-- Migração aditiva: o código publicado continua funcionando. Ele ainda lê vaga_conclusoes.ordem e
-- projeto_duracoes e chama alterar_duracao_projeto; tudo isso só sai na 008. Enquanto a lista do
-- projeto é a padrão, posição = ordem antiga, e o resultado das funções é o mesmo de antes.

-- A lista de cada projeto ------------------------------------------------------------------------

-- padrao: a etapa de `etapas` de onde a linha veio (null = incluída no projeto). duracao null só em
-- etapa padrão: vale a duração do cliente para `padrao`. fixa: Captura e Admissão, que não saem.
-- A posição só é conferida no fim da transação, para as funções poderem empurrar a lista.
create table projeto_etapas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos on delete cascade,
  posicao smallint not null check (posicao >= 1),
  nome text not null check (trim(nome) <> ''),
  duracao smallint check (duracao between 0 and 60),
  padrao smallint references etapas (ordem),
  fixa text check (fixa in ('captura', 'admissao')),
  check (duracao is not null or padrao is not null),
  unique (projeto_id, posicao) deferrable initially deferred
);
create unique index projeto_etapas_nome on projeto_etapas (projeto_id, lower(nome));
create unique index projeto_etapas_fixa on projeto_etapas (projeto_id, fixa) where fixa is not null;

-- Os projetos de hoje ganham as 13 etapas padrão, com os ajustes de duração que já tinham.
insert into projeto_etapas (projeto_id, posicao, nome, duracao, padrao, fixa)
select p.id, e.ordem, e.nome, d.duracao, e.ordem, case e.ordem when 2 then 'captura' when 11 then 'admissao' end
from projetos p cross join etapas e
left join projeto_duracoes d on d.projeto_id = p.id and d.ordem = e.ordem;

-- Projeto novo nasce com as 13 etapas padrão.
create function public.etapas_do_projeto_novo() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into projeto_etapas (projeto_id, posicao, nome, duracao, padrao, fixa)
  select new.id, ordem, nome, null, ordem, case ordem when 2 then 'captura' when 11 then 'admissao' end from etapas;
  return null;
end $$;

create trigger etapas_do_projeto_novo after insert on projetos for each row execute function etapas_do_projeto_novo();

-- Projeto encerrado: a lista também não muda.
create trigger projeto_aberto before insert or update or delete on projeto_etapas for each row execute function projeto_aberto();

-- Só leitura pela RLS: a lista muda só pelas funções abaixo (nem o RH escreve direto), para que as
-- regras das fixas, das posições e do histórico não possam ser contornadas.
alter table projeto_etapas enable row level security;
create policy leitura on projeto_etapas for select to authenticated using (pode_ver_projeto(projeto_id));

-- Funções auxiliares (só para as funções do banco) ------------------------------------------------

create function public.posicao_etapa(p_etapa uuid) returns smallint
language sql stable set search_path = public, pg_temp as $$
  select posicao from projeto_etapas where id = p_etapa
$$;

create function public.etapa_na_posicao(p_projeto uuid, p_posicao smallint) returns uuid
language sql stable set search_path = public, pg_temp as $$
  select id from projeto_etapas where projeto_id = p_projeto and posicao = p_posicao
$$;

create function public.etapa_fixa(p_projeto uuid, p_fixa text) returns projeto_etapas
language sql stable set search_path = public, pg_temp as $$
  select * from projeto_etapas where projeto_id = p_projeto and fixa = p_fixa
$$;

revoke execute on function public.posicao_etapa, public.etapa_na_posicao, public.etapa_fixa from public, anon, authenticated;

-- As conclusões apontam para a etapa do projeto --------------------------------------------------

alter table vaga_conclusoes add column etapa_id uuid references projeto_etapas on delete restrict;
-- Concluída sozinha por incluir_etapa (a vaga já tinha passado do ponto): a previsão não conta com
-- ela, para que nenhuma vaga mude de previsão por causa da inclusão.
alter table vaga_conclusoes add column automatica boolean not null default false;

-- Sem o gatilho de projeto encerrado: preencher etapa_id não muda nada, nem em projeto encerrado.
alter table vaga_conclusoes disable trigger projeto_aberto;
update vaga_conclusoes vc set etapa_id = e.id
from vagas v join projeto_etapas e on e.projeto_id = v.projeto_id
where v.id = vc.vaga_id and e.padrao = vc.ordem;
alter table vaga_conclusoes enable trigger projeto_aberto;

-- A chave passa a ser a etapa do projeto. A ordem fica (o código publicado a lê) e vale o padrao da
-- etapa, ou null numa etapa incluída no projeto.
alter table vaga_conclusoes drop constraint vaga_conclusoes_pkey;
alter table vaga_conclusoes add primary key (vaga_id, etapa_id);
alter table vaga_conclusoes alter column ordem drop not null;
create index on vaga_conclusoes (etapa_id);

-- O código publicado grava só a ordem: ela é a posição na lista do projeto da vaga. E a etapa
-- precisa ser do projeto da vaga.
create function public.etapa_da_conclusao() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_projeto uuid; v_etapa projeto_etapas;
begin
  select projeto_id into v_projeto from vagas where id = new.vaga_id;
  if new.etapa_id is null then new.etapa_id := etapa_na_posicao(v_projeto, new.ordem); end if;
  select * into v_etapa from projeto_etapas where id = new.etapa_id;
  if not found then raise exception 'etapa não encontrada'; end if;
  if v_etapa.projeto_id is distinct from v_projeto then raise exception 'etapa de outro projeto'; end if;
  new.ordem := v_etapa.padrao;
  return new;
end $$;

create trigger etapa_da_conclusao before insert on vaga_conclusoes for each row execute function etapa_da_conclusao();

revoke execute on function public.etapas_do_projeto_novo, public.etapa_da_conclusao from public, anon, authenticated;

-- Ações do RH por posição ------------------------------------------------------------------------

-- As conclusões são sempre as primeiras etapas da lista: a etapa atual é a quantidade + 1.
create or replace function public.etapa_atual(p_vaga uuid) returns smallint
language sql stable set search_path = public as $$
  select (count(*) + 1)::smallint from vaga_conclusoes where vaga_id = p_vaga
$$;

-- Conclui as posições de p_ordem_esperada até p_ate, todas na mesma data (arraste no quadro).
-- Tudo é conferido antes de gravar a primeira conclusão: o salto vai inteiro ou nada.
create function public.concluir_etapas(p_vaga uuid, p_ordem_esperada smallint, p_ate smallint, p_data date) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_projeto uuid; v_inicio date; v_retomada date; v_total int; v_captura smallint; v_anterior date; e projeto_etapas;
begin
  perform travar_vaga_rh(p_vaga);
  select projeto_id, data_inicio, retomada_em into v_projeto, v_inicio, v_retomada from vagas where id = p_vaga;
  select count(*) into v_total from projeto_etapas where projeto_id = v_projeto;
  -- A outra pessoa do RH pode ter avançado a mesma vaga, ou mudado a lista, enquanto esta olhava a tela.
  if etapa_atual(p_vaga) <> p_ordem_esperada or p_ate < p_ordem_esperada or p_ate > v_total then
    raise exception 'etapa mudou';
  end if;
  if p_data > hoje_sp() then raise exception 'data no futuro'; end if;
  if p_ordem_esperada = 1 and p_data < v_inicio then raise exception 'data antes do início da vaga'; end if;
  v_captura := (etapa_fixa(v_projeto, 'captura')).posicao;
  if v_captura between p_ordem_esperada and p_ate and v_retomada is not null and p_data < v_retomada then
    raise exception 'data antes da retomada';
  end if;
  select vc.concluida_em into v_anterior from vaga_conclusoes vc join projeto_etapas pe on pe.id = vc.etapa_id
    where vc.vaga_id = p_vaga and pe.posicao = p_ordem_esperada - 1;
  if v_anterior is not null and p_data < v_anterior then raise exception 'data antes da etapa anterior'; end if;
  for e in select * from projeto_etapas where projeto_id = v_projeto and posicao between p_ordem_esperada and p_ate order by posicao loop
    insert into vaga_conclusoes (vaga_id, etapa_id, ordem, concluida_em) values (p_vaga, e.id, e.padrao, p_data);
    insert into historico (vaga_id, nome_usuario, acao, detalhe)
    values (p_vaga, meu_nome(), 'Concluiu ' || e.nome, jsonb_build_object('ordem', e.posicao, 'data', p_data));
  end loop;
end $$;

create or replace function public.concluir_etapa(p_vaga uuid, p_ordem_esperada smallint, p_data date) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform concluir_etapas(p_vaga, p_ordem_esperada, p_ordem_esperada, p_data);
end $$;

create or replace function public.desfazer_etapa(p_vaga uuid, p_ordem_esperada smallint) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_nome text;
begin
  perform travar_vaga_rh(p_vaga);
  if etapa_atual(p_vaga) - 1 <> p_ordem_esperada or p_ordem_esperada < 1 then raise exception 'etapa mudou'; end if;
  delete from vaga_conclusoes vc using projeto_etapas e
    where e.id = vc.etapa_id and vc.vaga_id = p_vaga and e.posicao = p_ordem_esperada
    returning e.nome into v_nome;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (p_vaga, meu_nome(), 'Desfez ' || v_nome, jsonb_build_object('ordem', p_ordem_esperada));
end $$;

-- A desistência volta a vaga para a Captura, esteja ela onde estiver na lista.
create or replace function public.candidato_desistiu(p_vaga uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_projeto uuid; v_candidato text; v_captura smallint; v_apagadas jsonb;
begin
  perform travar_vaga_rh(p_vaga);
  select projeto_id, candidato into v_projeto, v_candidato from vagas where id = p_vaga;
  -- Depois da admissão a pessoa já é da Timenow: a vaga não volta para a captura.
  if exists (select 1 from vaga_conclusoes where vaga_id = p_vaga and etapa_id = (etapa_fixa(v_projeto, 'admissao')).id) then
    raise exception 'vaga já admitida';
  end if;
  v_captura := (etapa_fixa(v_projeto, 'captura')).posicao;
  select coalesce(jsonb_agg(jsonb_build_object('ordem', e.posicao, 'concluida_em', vc.concluida_em) order by e.posicao), '[]'::jsonb)
    into v_apagadas from vaga_conclusoes vc join projeto_etapas e on e.id = vc.etapa_id
    where vc.vaga_id = p_vaga and e.posicao >= v_captura;
  delete from vaga_conclusoes vc using projeto_etapas e
    where e.id = vc.etapa_id and vc.vaga_id = p_vaga and e.posicao >= v_captura;
  update vagas set candidato = null, retomada_em = hoje_sp() where id = p_vaga;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (p_vaga, meu_nome(), 'Candidato desistiu', jsonb_build_object('candidato', v_candidato, 'conclusoes', v_apagadas));
end $$;

-- Importação do modelo: concluidas[].ordem é a posição na lista do projeto.
create or replace function public.importar_vagas(p_projeto uuid, p_vagas jsonb) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare v jsonb; c jsonb; v_id uuid; v_etapa uuid; v_n int := 0; v_projeto text;
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
      v_etapa := etapa_na_posicao(p_projeto, (c->>'ordem')::smallint);
      if v_etapa is null then raise exception 'etapa não encontrada'; end if;
      insert into vaga_conclusoes (vaga_id, etapa_id, concluida_em) values (v_id, v_etapa, (c->>'concluida_em')::date);
    end loop;
    v_n := v_n + 1;
  end loop;
  insert into historico (vaga_id, nome_usuario, acao) values (null, meu_nome(), format('Importou %s vagas em %s', v_n, v_projeto));
  return v_n;
end $$;

-- O código publicado muda a duração por ordem: a lista acompanha, até a 008.
create or replace function public.alterar_duracao_projeto(p_projeto uuid, p_ordem smallint, p_dias smallint) returns void
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
  update projeto_etapas set duracao = p_dias where projeto_id = p_projeto and padrao = p_ordem;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (null, meu_nome(), 'Alterou a duração de ' || v_etapa,
    jsonb_build_object('projeto', v_projeto, 'antes', v_antes, 'depois', coalesce(p_dias, v_cliente_dias)));
end $$;

-- Mudanças na lista ------------------------------------------------------------------------------
-- Travam o projeto (e, quando mexem nas posições, as vagas dele), para não correr junto com um
-- "Concluir etapa", que trava a vaga. Valem para todas as vagas, inclusive as canceladas, para que
-- as conclusões continuem sendo as primeiras etapas da lista. O gatilho projeto_aberto recusa
-- qualquer mudança em projeto encerrado.

-- Trava o projeto da etapa e devolve a etapa relida depois da trava.
create function public.travar_etapa_rh(p_etapa uuid, p_vagas boolean) returns projeto_etapas
language plpgsql set search_path = public, pg_temp as $$
declare v_projeto uuid; v_etapa projeto_etapas;
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
  select projeto_id into v_projeto from projeto_etapas where id = p_etapa;
  if not found then raise exception 'etapa não encontrada'; end if;
  perform 1 from projetos where id = v_projeto for update;
  if p_vagas then perform 1 from vagas where projeto_id = v_projeto for update; end if;
  select * into v_etapa from projeto_etapas where id = p_etapa;
  if not found then raise exception 'etapa não encontrada'; end if;
  return v_etapa;
end $$;

revoke execute on function public.travar_etapa_rh from public, anon, authenticated;

-- Duração efetiva da etapa no projeto: a da lista ou, numa etapa padrão sem ajuste, a do cliente.
create function public.duracao_efetiva(p_etapa uuid) returns smallint
language sql stable set search_path = public, pg_temp as $$
  select coalesce(e.duracao, cd.duracao, et.duracao)
  from projeto_etapas e join projetos p on p.id = e.projeto_id
  left join cliente_duracoes cd on cd.cliente_id = p.cliente_id and cd.ordem = e.padrao
  left join etapas et on et.ordem = e.padrao
  where e.id = p_etapa
$$;

revoke execute on function public.duracao_efetiva from public, anon, authenticated;

-- Inclui uma etapa depois de p_depois_de (null = na primeira posição). A vaga que já chegou ao ponto
-- (concluiu p_depois_de; na primeira posição, toda vaga) fica com a etapa nova concluída na data da
-- anterior (ou no início da vaga): nenhuma vaga muda de etapa atual, de previsão nem de cor.
create function public.incluir_etapa(p_projeto uuid, p_nome text, p_duracao smallint, p_depois_de uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_projeto text; v_nome text := trim(p_nome); v_depois projeto_etapas; v_posicao smallint; v_id uuid; v_n int;
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
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

-- Exclui uma etapa: as datas de quem já tinha concluído vão para o histórico da vaga, e as posições
-- seguintes sobem uma, sem buraco. A vaga parada nela passa para a próxima da lista.
create function public.excluir_etapa(p_etapa uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_etapa projeto_etapas; v_projeto text; v_n int;
begin
  v_etapa := travar_etapa_rh(p_etapa, true);
  if v_etapa.fixa is not null then raise exception 'etapa obrigatória'; end if;
  select nome into v_projeto from projetos where id = v_etapa.projeto_id;
  with apagadas as (delete from vaga_conclusoes where etapa_id = p_etapa returning vaga_id, concluida_em)
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  select vaga_id, meu_nome(), 'Etapa ' || v_etapa.nome || ' excluída', jsonb_build_object('concluida_em', concluida_em) from apagadas;
  get diagnostics v_n = row_count;
  delete from projeto_etapas where id = p_etapa;
  update projeto_etapas set posicao = posicao - 1 where projeto_id = v_etapa.projeto_id and posicao > v_etapa.posicao;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (null, meu_nome(), format('Excluiu a etapa %s de %s', v_etapa.nome, v_projeto),
    jsonb_build_object('projeto', v_projeto, 'etapa', v_etapa.nome, 'vagas_com_data', v_n));
end $$;

create function public.renomear_etapa(p_etapa uuid, p_nome text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_etapa projeto_etapas; v_projeto text; v_nome text := trim(p_nome);
begin
  v_etapa := travar_etapa_rh(p_etapa, false);
  if v_etapa.fixa is not null then raise exception 'etapa obrigatória'; end if;
  if coalesce(v_nome, '') = '' then raise exception 'nome obrigatório'; end if;
  if exists (select 1 from projeto_etapas where projeto_id = v_etapa.projeto_id and id <> p_etapa and lower(nome) = lower(v_nome)) then
    raise exception 'etapa repetida';
  end if;
  select nome into v_projeto from projetos where id = v_etapa.projeto_id;
  update projeto_etapas set nome = v_nome where id = p_etapa;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (null, meu_nome(), format('Renomeou a etapa %s para %s', v_etapa.nome, v_nome),
    jsonb_build_object('projeto', v_projeto, 'antes', v_etapa.nome, 'depois', v_nome));
end $$;

-- A ordem só muda antes de o projeto ter vagas (as canceladas não contam), e a Captura fica antes
-- da Admissão.
create function public.mover_etapa(p_etapa uuid, p_para smallint) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_etapa projeto_etapas; v_projeto text; v_total int;
begin
  v_etapa := travar_etapa_rh(p_etapa, true);
  if exists (select 1 from vagas where projeto_id = v_etapa.projeto_id and cancelada_em is null) then
    raise exception 'projeto tem vagas';
  end if;
  select count(*) into v_total from projeto_etapas where projeto_id = v_etapa.projeto_id;
  if p_para is null or p_para < 1 or p_para > v_total then raise exception 'posição inválida'; end if;
  if p_para < v_etapa.posicao then
    update projeto_etapas set posicao = posicao + 1 where projeto_id = v_etapa.projeto_id and posicao >= p_para and posicao < v_etapa.posicao;
  else
    update projeto_etapas set posicao = posicao - 1 where projeto_id = v_etapa.projeto_id and posicao > v_etapa.posicao and posicao <= p_para;
  end if;
  update projeto_etapas set posicao = p_para where id = p_etapa;
  if (etapa_fixa(v_etapa.projeto_id, 'captura')).posicao > (etapa_fixa(v_etapa.projeto_id, 'admissao')).posicao then
    raise exception 'ordem das obrigatórias';
  end if;
  select nome into v_projeto from projetos where id = v_etapa.projeto_id;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (null, meu_nome(), format('Moveu a etapa %s para a posição %s', v_etapa.nome, p_para),
    jsonb_build_object('projeto', v_projeto, 'etapa', v_etapa.nome, 'antes', v_etapa.posicao, 'depois', p_para));
end $$;

-- p_dias null volta a etapa padrão à duração do cliente; numa etapa incluída é recusado. O "antes"
-- e o "depois" são as durações efetivas, como em alterar_duracao_projeto.
create function public.alterar_duracao_etapa(p_etapa uuid, p_dias smallint) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_etapa projeto_etapas; v_projeto text; v_antes smallint;
begin
  v_etapa := travar_etapa_rh(p_etapa, false);
  if p_dias is null and v_etapa.padrao is null then raise exception 'duração obrigatória'; end if;
  if p_dias not between 0 and 60 then raise exception 'duração inválida'; end if;
  select nome into v_projeto from projetos where id = v_etapa.projeto_id;
  v_antes := duracao_efetiva(p_etapa);
  update projeto_etapas set duracao = p_dias where id = p_etapa;
  -- Até a 008 o código publicado lê projeto_duracoes: o ajuste da etapa padrão vai para lá também.
  if v_etapa.padrao is not null then
    if p_dias is null then
      delete from projeto_duracoes where projeto_id = v_etapa.projeto_id and ordem = v_etapa.padrao;
    else
      insert into projeto_duracoes (projeto_id, ordem, duracao) values (v_etapa.projeto_id, v_etapa.padrao, p_dias)
      on conflict (projeto_id, ordem) do update set duracao = excluded.duracao;
    end if;
  end if;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (null, meu_nome(), 'Alterou a duração de ' || v_etapa.nome,
    jsonb_build_object('projeto', v_projeto, 'antes', v_antes, 'depois', duracao_efetiva(p_etapa)));
end $$;

revoke execute on function public.concluir_etapas, public.incluir_etapa, public.excluir_etapa, public.renomear_etapa,
  public.mover_etapa, public.alterar_duracao_etapa from public, anon;
grant execute on function public.concluir_etapas, public.incluir_etapa, public.excluir_etapa, public.renomear_etapa,
  public.mover_etapa, public.alterar_duracao_etapa to authenticated;

do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef loop
    execute format('alter function %s set search_path = public, pg_temp', f);
  end loop;
end $$;
