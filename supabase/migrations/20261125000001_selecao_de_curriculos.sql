-- Seleção de Currículos: área só da equipe de RH (Administrador e Analista de RH). O RH cadastra o
-- descritivo de uma função num projeto, importa currículos em PDF, o Claude analisa a aderência e o
-- RH confirma. Os candidatos formam um banco pesquisável por todo o RH; as seleções seguem o acesso
-- ao projeto. Gestor e Cliente não leem nada daqui. Escrita só pelas funções abaixo.
-- Migração aditiva: o código publicado não conhece nada disto.

-- Tabelas ---------------------------------------------------------------------------------------

create table candidatos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text,
  telefone text,
  cpf text check (cpf ~ '^\d{11}$'),
  cidade text,
  uf text,
  criado_em timestamptz not null default now()
);
create index on candidatos (cpf);
create index on candidatos (email);

-- O currículo nasce sem candidato: quem ele é só se sabe depois da análise.
create table curriculos (
  id uuid primary key default gen_random_uuid(),
  candidato_id uuid references candidatos on delete cascade,
  caminho text not null unique,
  nome_arquivo text not null,
  enviado_por text not null,
  enviado_em timestamptz not null default now()
);
create index on curriculos (candidato_id);

create table selecoes (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos,
  funcao text not null check (length(funcao) between 1 and 120),
  descritivo text not null check (length(descritivo) between 1 and 20000),
  encerrada_em timestamptz,
  criado_por text,
  criado_em timestamptz not null default now()
);
create index on selecoes (projeto_id);

create table participacoes (
  id uuid primary key default gen_random_uuid(),
  selecao_id uuid not null references selecoes on delete cascade,
  candidato_id uuid references candidatos on delete cascade,
  curriculo_id uuid not null references curriculos on delete cascade,
  situacao text not null default 'pendente' check (situacao in ('pendente', 'analisando', 'analisada', 'erro', 'repetida')),
  analisando_desde timestamptz,
  erro text,
  classificacao text check (classificacao in ('a_confirmar', 'aderente', 'parcial', 'nao_aderente')),
  classificacao_por text,
  classificacao_em timestamptz,
  resultado text not null default 'em_andamento' check (resultado in ('em_andamento', 'escolhido', 'aprovado_nao_escolhido', 'reprovado', 'desistiu')),
  do_banco boolean not null default false,
  criado_em timestamptz not null default now()
);
create index on participacoes (selecao_id);
create index on participacoes (candidato_id);
-- Um candidato aparece uma vez por seleção; as repetidas ficam fora da regra (só registram o envio).
create unique index participacoes_unica on participacoes (selecao_id, candidato_id) where situacao <> 'repetida';

-- A análise da IA como veio, com o descritivo daquele momento. Nunca é alterada.
create table analises_ia (
  id uuid primary key default gen_random_uuid(),
  participacao_id uuid not null references participacoes on delete cascade,
  modelo text not null,
  versao_prompt text not null,
  descritivo text not null,
  nota smallint not null check (nota between 0 and 100),
  classificacao text not null check (classificacao in ('aderente', 'parcial', 'nao_aderente')),
  resposta jsonb not null,
  tokens_entrada int,
  tokens_saida int,
  criado_em timestamptz not null default now()
);
create index on analises_ia (participacao_id);

create table entrevistas (
  id uuid primary key default gen_random_uuid(),
  participacao_id uuid not null references participacoes on delete cascade,
  tipo text not null check (tipo in ('timenow', 'cliente')),
  data date not null,
  entrevistador text not null check (length(entrevistador) between 1 and 120),
  parecer text not null check (parecer in ('recomendado', 'ressalvas', 'nao_recomendado')),
  impressoes text not null default '' check (length(impressoes) <= 5000),
  registrado_por text not null,
  registrado_em timestamptz not null default now(),
  alterado_em timestamptz
);
create index on entrevistas (participacao_id);

-- Guarda o nome de quem fez, nunca o e-mail.
create table historico_selecao (
  id uuid primary key default gen_random_uuid(),
  selecao_id uuid not null references selecoes on delete cascade,
  participacao_id uuid references participacoes on delete cascade,
  nome_usuario text not null,
  acao text not null,
  detalhe jsonb,
  em timestamptz not null default now()
);
create index on historico_selecao (selecao_id);
create index on historico_selecao (participacao_id);

-- Leitura ---------------------------------------------------------------------------------------

create function public.pode_ver_selecao(p_selecao uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select pode_alterar_projeto((select projeto_id from selecoes where id = p_selecao))
$$;
revoke execute on function public.pode_ver_selecao from public, anon;
grant execute on function public.pode_ver_selecao to authenticated;

alter table candidatos enable row level security;
alter table curriculos enable row level security;
alter table selecoes enable row level security;
alter table participacoes enable row level security;
alter table analises_ia enable row level security;
alter table entrevistas enable row level security;
alter table historico_selecao enable row level security;

create policy leitura on candidatos for select to authenticated using (eh_rh() or eh_analista());
create policy leitura on curriculos for select to authenticated using (eh_rh() or eh_analista());
create policy leitura on selecoes for select to authenticated using (pode_alterar_projeto(projeto_id));
create policy leitura on participacoes for select to authenticated using (pode_ver_selecao(selecao_id));
create policy leitura on historico_selecao for select to authenticated using (pode_ver_selecao(selecao_id));
create policy leitura on analises_ia for select to authenticated
  using (pode_ver_selecao((select selecao_id from participacoes where id = participacao_id)));
create policy leitura on entrevistas for select to authenticated
  using (pode_ver_selecao((select selecao_id from participacoes where id = participacao_id)));

revoke insert, update, delete on candidatos, curriculos, selecoes, participacoes, analises_ia, entrevistas, historico_selecao from anon;
revoke update, delete on analises_ia from authenticated;

-- Arquivos --------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('curriculos', 'curriculos', false, 10485760, '{application/pdf}');

create policy curriculos_leitura on storage.objects for select to authenticated
  using (bucket_id = 'curriculos' and (public.eh_rh() or public.eh_analista()));
create policy curriculos_envio on storage.objects for insert to authenticated
  with check (bucket_id = 'curriculos' and (public.eh_rh() or public.eh_analista()));

-- Funções de escrita ----------------------------------------------------------------------------
-- Todas conferem quem age (exigir_projeto ou o perfil) e registram o histórico com o nome.

-- A seleção e a participação levam ao projeto; quem não pode alterá-lo recebe "sem permissão".
create function public.exigir_selecao(p_selecao uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_projeto uuid;
begin
  select projeto_id into v_projeto from selecoes where id = p_selecao;
  perform exigir_projeto(v_projeto);
  if v_projeto is null then raise exception 'seleção não encontrada'; end if;
end $$;

create function public.exigir_participacao(p_participacao uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_selecao uuid;
begin
  select selecao_id into v_selecao from participacoes where id = p_participacao;
  perform exigir_projeto((select projeto_id from selecoes where id = v_selecao));
  if v_selecao is null then raise exception 'candidato não encontrado na seleção'; end if;
  return v_selecao;
end $$;

create function public.registrar_selecao(p_selecao uuid, p_participacao uuid, p_acao text, p_detalhe jsonb default null, p_nome text default null) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into historico_selecao (selecao_id, participacao_id, nome_usuario, acao, detalhe)
  values (p_selecao, p_participacao, coalesce(p_nome, meu_nome(), 'Sistema'), p_acao, p_detalhe)
$$;

revoke execute on function public.exigir_selecao, public.exigir_participacao, public.registrar_selecao from public, anon, authenticated;

-- p: funcao, descritivo e, só ao criar, projeto_id.
create function public.salvar_selecao(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_funcao text := trim(p->>'funcao'); v_desc text := trim(p->>'descritivo'); v_antes selecoes;
begin
  if p_id is null then
    perform exigir_projeto((p->>'projeto_id')::uuid);
  else
    perform exigir_selecao(p_id);
  end if;
  if coalesce(v_funcao, '') = '' then raise exception 'função obrigatória'; end if;
  if coalesce(v_desc, '') = '' then raise exception 'descritivo obrigatório'; end if;
  if p_id is null then
    insert into selecoes (projeto_id, funcao, descritivo, criado_por) values ((p->>'projeto_id')::uuid, v_funcao, v_desc, meu_nome()) returning id into v_id;
    perform registrar_selecao(v_id, null, 'Criou a seleção');
  else
    select * into v_antes from selecoes where id = p_id for update;
    update selecoes set funcao = v_funcao, descritivo = v_desc where id = p_id;
    v_id := p_id;
    perform registrar_selecao(v_id, null, 'Alterou a seleção', jsonb_build_object('antes', jsonb_build_object('funcao', v_antes.funcao, 'descritivo', v_antes.descritivo)));
  end if;
  return v_id;
end $$;

create function public.encerrar_selecao(p_id uuid, p_encerrar boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform exigir_selecao(p_id);
  update selecoes set encerrada_em = case when p_encerrar then now() end where id = p_id;
  perform registrar_selecao(p_id, null, case when p_encerrar then 'Encerrou a seleção' else 'Reabriu a seleção' end);
end $$;

-- O PDF já está no Storage, em <seleção>/<arquivo>.pdf. Devolve a participação pendente.
create function public.registrar_curriculo(p_selecao uuid, p_caminho text, p_nome_arquivo text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cv uuid; v_part uuid;
begin
  perform exigir_selecao(p_selecao);
  if p_caminho is null or not starts_with(p_caminho, p_selecao::text || '/') or p_caminho like '%..%' then raise exception 'caminho inválido'; end if;
  insert into curriculos (caminho, nome_arquivo, enviado_por) values (p_caminho, left(coalesce(nullif(trim(p_nome_arquivo), ''), 'curriculo.pdf'), 200), meu_nome()) returning id into v_cv;
  insert into participacoes (selecao_id, curriculo_id) values (p_selecao, v_cv) returning id into v_part;
  perform registrar_selecao(p_selecao, v_part, 'Importou um currículo', jsonb_build_object('arquivo', p_nome_arquivo));
  return v_part;
end $$;

-- Só uma análise por vez: quem chega com outra em andamento (há menos de 5 minutos) é recusado.
create function public.iniciar_analise(p_participacao uuid) returns table (caminho text, nome_arquivo text, descritivo text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_part participacoes;
begin
  perform exigir_participacao(p_participacao);
  select * into v_part from participacoes where id = p_participacao for update;
  if not (v_part.situacao in ('pendente', 'erro')
      or (v_part.situacao = 'analisando' and v_part.analisando_desde < now() - interval '5 minutes')) then
    raise exception 'análise em andamento';
  end if;
  update participacoes set situacao = 'analisando', analisando_desde = now(), erro = null where id = p_participacao;
  return query
    select k.caminho, k.nome_arquivo, s.descritivo
    from participacoes p join curriculos k on k.id = p.curriculo_id join selecoes s on s.id = p.selecao_id
    where p.id = p_participacao;
end $$;

create function public.reanalisar(p_participacoes uuid[]) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid; v_sel uuid;
begin
  foreach v in array coalesce(p_participacoes, '{}') loop
    v_sel := exigir_participacao(v);
    update participacoes set situacao = 'pendente', erro = null where id = v and situacao in ('analisada', 'erro');
    if found then perform registrar_selecao(v_sel, v, 'Pediu nova análise'); end if;
  end loop;
end $$;

-- Gravado pelo servidor depois da resposta do Claude (service_role). Identifica o candidato pelo
-- CPF, depois pelo e-mail; só preenche dados vazios. Devolve 'analisada' ou 'repetida'.
create function public.registrar_analise(p_participacao uuid, p jsonb) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_part participacoes; v_cand uuid; v_cpf text; v_email text; v_nome text; v_arquivo text; v_desc text;
  c jsonb := coalesce(p->'candidato', '{}');
  v_nome_usuario text := coalesce(p->>'nome_usuario', 'Sistema');
begin
  select * into v_part from participacoes where id = p_participacao for update;
  if not found then raise exception 'candidato não encontrado na seleção'; end if;
  select nome_arquivo into v_arquivo from curriculos where id = v_part.curriculo_id;
  select s.descritivo into v_desc from selecoes s where s.id = v_part.selecao_id;
  v_cpf := nullif(c->>'cpf', '');
  if v_cpf is not null and v_cpf !~ '^\d{11}$' then v_cpf := null; end if;
  v_email := nullif(lower(trim(c->>'email')), '');
  v_nome := nullif(trim(c->>'nome'), '');

  -- A fila analisa vários currículos ao mesmo tempo: duas análises do mesmo candidato esperam uma
  -- pela outra aqui, e a segunda já encontra o cadastro da primeira. Sempre CPF antes do e-mail.
  if v_cpf is not null then perform pg_advisory_xact_lock(hashtext('candidato:' || v_cpf)); end if;
  if v_email is not null then perform pg_advisory_xact_lock(hashtext('candidato:' || v_email)); end if;

  v_cand := v_part.candidato_id;
  if v_cand is null and v_cpf is not null then
    select id into v_cand from candidatos where cpf = v_cpf order by criado_em limit 1;
  end if;
  if v_cand is null and v_email is not null then
    select id into v_cand from candidatos where email = v_email order by criado_em limit 1;
  end if;

  if v_cand is not null and exists (
    select 1 from participacoes where selecao_id = v_part.selecao_id and candidato_id = v_cand and id <> p_participacao and situacao <> 'repetida'
  ) then
    update curriculos set candidato_id = v_cand where id = v_part.curriculo_id;
    update participacoes set situacao = 'repetida', candidato_id = v_cand, analisando_desde = null where id = p_participacao;
    perform registrar_selecao(v_part.selecao_id, p_participacao, 'Currículo de candidato que já estava na seleção', null, v_nome_usuario);
    return 'repetida';
  end if;

  if v_cand is null then
    insert into candidatos (nome, email, telefone, cpf, cidade, uf)
    values (coalesce(v_nome, format('Sem nome (%s)', v_arquivo)), v_email, nullif(trim(c->>'telefone'), ''), v_cpf,
            nullif(trim(c->>'cidade'), ''), nullif(upper(trim(c->>'uf')), ''))
    returning id into v_cand;
  else
    update candidatos set
      email = coalesce(email, v_email),
      telefone = coalesce(telefone, nullif(trim(c->>'telefone'), '')),
      cpf = coalesce(cpf, v_cpf),
      cidade = coalesce(cidade, nullif(trim(c->>'cidade'), '')),
      uf = coalesce(uf, nullif(upper(trim(c->>'uf')), ''))
    where id = v_cand;
  end if;

  update curriculos set candidato_id = v_cand where id = v_part.curriculo_id;
  insert into analises_ia (participacao_id, modelo, versao_prompt, descritivo, nota, classificacao, resposta, tokens_entrada, tokens_saida)
  values (p_participacao, p->>'modelo', p->>'versao_prompt', v_desc, (p->>'nota')::smallint, p->>'classificacao', p->'resposta',
          (p->>'tokens_entrada')::int, (p->>'tokens_saida')::int);
  update participacoes set candidato_id = v_cand, situacao = 'analisada', analisando_desde = null, erro = null,
    classificacao = 'a_confirmar', classificacao_por = null, classificacao_em = null
  where id = p_participacao;
  perform registrar_selecao(v_part.selecao_id, p_participacao, 'A IA analisou o currículo',
    jsonb_build_object('nota', (p->>'nota')::int, 'classificacao', p->>'classificacao', 'modelo', p->>'modelo'), v_nome_usuario);
  return 'analisada';
end $$;

create function public.falhar_analise(p_participacao uuid, p_erro text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update participacoes set situacao = 'erro', erro = left(coalesce(p_erro, 'Falha na análise.'), 300), analisando_desde = null
  where id = p_participacao and situacao <> 'repetida';
end $$;

revoke execute on function public.registrar_analise, public.falhar_analise from public, anon, authenticated;
grant execute on function public.registrar_analise, public.falhar_analise to service_role;

-- Inclui candidatos do banco com o currículo mais recente de cada um. Devolve quantos entraram.
create function public.incluir_do_banco(p_selecao uuid, p_candidatos uuid[]) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid; v_cv uuid; v_part uuid; v_n int := 0;
begin
  perform exigir_selecao(p_selecao);
  foreach v in array coalesce(p_candidatos, '{}') loop
    continue when exists (select 1 from participacoes where selecao_id = p_selecao and candidato_id = v and situacao <> 'repetida');
    select id into v_cv from curriculos where candidato_id = v order by enviado_em desc limit 1;
    continue when v_cv is null;
    insert into participacoes (selecao_id, candidato_id, curriculo_id, do_banco) values (p_selecao, v, v_cv, true) returning id into v_part;
    perform registrar_selecao(p_selecao, v_part, 'Incluiu do banco de candidatos');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Confirma a sugestão da IA (a análise mais recente) das que estão a confirmar.
create function public.confirmar_classificacao(p_participacoes uuid[]) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid; v_sel uuid; v_cls text; v_n int := 0;
begin
  foreach v in array coalesce(p_participacoes, '{}') loop
    v_sel := exigir_participacao(v);
    select a.classificacao into v_cls from analises_ia a where a.participacao_id = v order by a.criado_em desc, a.id limit 1;
    update participacoes set classificacao = v_cls, classificacao_por = meu_nome(), classificacao_em = now()
    where id = v and classificacao = 'a_confirmar' and v_cls is not null;
    if found then
      perform registrar_selecao(v_sel, v, 'Confirmou a classificação da IA', jsonb_build_object('classificacao', v_cls));
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

create function public.mudar_classificacao(p_participacao uuid, p_classificacao text, p_justificativa text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_sel uuid; v_de text; v_just text := trim(coalesce(p_justificativa, ''));
begin
  v_sel := exigir_participacao(p_participacao);
  if p_classificacao not in ('aderente', 'parcial', 'nao_aderente') then raise exception 'classificação inválida'; end if;
  if v_just = '' then raise exception 'justificativa obrigatória'; end if;
  if length(v_just) > 500 then raise exception 'justificativa longa demais'; end if;
  select classificacao into v_de from participacoes where id = p_participacao and situacao = 'analisada' for update;
  if not found then raise exception 'candidato ainda não analisado'; end if;
  update participacoes set classificacao = p_classificacao, classificacao_por = meu_nome(), classificacao_em = now() where id = p_participacao;
  perform registrar_selecao(v_sel, p_participacao, 'Mudou a classificação',
    jsonb_build_object('de', v_de, 'para', p_classificacao, 'justificativa', v_just));
end $$;

-- p: tipo, data, entrevistador, parecer, impressoes. Ao corrigir, o histórico guarda a versão anterior.
create function public.salvar_entrevista(p_id uuid, p_participacao uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_sel uuid; v_id uuid; v_antes entrevistas;
begin
  v_sel := exigir_participacao(p_participacao);
  if coalesce(trim(p->>'entrevistador'), '') = '' then raise exception 'entrevistador obrigatório'; end if;
  if p_id is null then
    insert into entrevistas (participacao_id, tipo, data, entrevistador, parecer, impressoes, registrado_por)
    values (p_participacao, p->>'tipo', (p->>'data')::date, trim(p->>'entrevistador'), p->>'parecer', coalesce(trim(p->>'impressoes'), ''), meu_nome())
    returning id into v_id;
    perform registrar_selecao(v_sel, p_participacao, 'Registrou uma entrevista', jsonb_build_object('tipo', p->>'tipo', 'parecer', p->>'parecer'));
  else
    select * into v_antes from entrevistas where id = p_id and participacao_id = p_participacao for update;
    if not found then raise exception 'entrevista não encontrada'; end if;
    update entrevistas set tipo = p->>'tipo', data = (p->>'data')::date, entrevistador = trim(p->>'entrevistador'),
      parecer = p->>'parecer', impressoes = coalesce(trim(p->>'impressoes'), ''), alterado_em = now()
    where id = p_id;
    v_id := p_id;
    perform registrar_selecao(v_sel, p_participacao, 'Corrigiu uma entrevista', jsonb_build_object('antes', to_jsonb(v_antes) - 'participacao_id'));
  end if;
  return v_id;
end $$;

create function public.definir_resultado(p_participacao uuid, p_resultado text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_sel uuid;
begin
  v_sel := exigir_participacao(p_participacao);
  update participacoes set resultado = p_resultado where id = p_participacao;
  perform registrar_selecao(v_sel, p_participacao, 'Definiu o resultado', jsonb_build_object('resultado', p_resultado));
end $$;

-- Banco de candidatos ----------------------------------------------------------------------------
-- Todo o RH busca em todos os projetos; o detalhe de projeto alheio não sai daqui.

create function public.exigir_equipe() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not (eh_rh() or eh_analista()) then raise exception 'sem permissão'; end if;
end $$;
revoke execute on function public.exigir_equipe from public, anon, authenticated;

-- p (todos opcionais): nome, funcao, resultado, classificacao, nota_min, uf, desde (data).
create function public.buscar_candidatos(p jsonb) returns table (
  id uuid, nome text, cidade text, uf text, ultima_em timestamptz, funcoes text[], melhor_nota smallint, resultados text[]
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
      coalesce(array_agg(distinct pa.classificacao) filter (where pa.classificacao is not null), '{}') as classificacoes
    from candidatos k
    left join participacoes pa on pa.candidato_id = k.id and pa.situacao <> 'repetida'
    left join selecoes s on s.id = pa.selecao_id
    group by k.id
  )
  select r.id, r.nome, r.cidade, r.uf, r.ultima_em, r.funcoes, r.melhor_nota, r.resultados
  from resumo r
  where (nullif(trim(p->>'nome'), '') is null or r.nome ilike '%' || trim(p->>'nome') || '%')
    and (nullif(trim(p->>'funcao'), '') is null or exists (select 1 from unnest(r.funcoes) f where f ilike '%' || trim(p->>'funcao') || '%'))
    and (nullif(p->>'resultado', '') is null or (p->>'resultado') = any (r.resultados))
    and (nullif(p->>'classificacao', '') is null or (p->>'classificacao') = any (r.classificacoes))
    and (nullif(p->>'nota_min', '') is null or r.melhor_nota >= (p->>'nota_min')::int)
    and (nullif(trim(p->>'uf'), '') is null or upper(r.uf) = upper(trim(p->>'uf')))
    and (nullif(p->>'desde', '') is null or r.ultima_em >= (p->>'desde')::date)
  order by r.ultima_em desc
  limit 200;
end $$;

create function public.participacoes_do_candidato(p_candidato uuid) returns table (
  participacao_id uuid, selecao_id uuid, projeto_id uuid, projeto text, funcao text, criado_em timestamptz,
  nota smallint, classificacao text, resultado text, detalhe_visivel boolean
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform exigir_equipe();
  return query
  select pa.id, s.id, pr.id, pr.nome, s.funcao, pa.criado_em,
    (select a.nota from analises_ia a where a.participacao_id = pa.id order by a.criado_em desc, a.id limit 1),
    pa.classificacao, pa.resultado, pode_alterar_projeto(pr.id)
  from participacoes pa join selecoes s on s.id = pa.selecao_id join projetos pr on pr.id = s.projeto_id
  where pa.candidato_id = p_candidato and pa.situacao <> 'repetida'
  order by pa.criado_em desc;
end $$;

-- LGPD: só o Administrador. Devolve os arquivos para o servidor apagar do Storage. O registro geral
-- guarda só que houve a exclusão, sem o nome.
create function public.excluir_candidato(p_candidato uuid) returns text[]
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_caminhos text[];
begin
  if not eh_rh() then raise exception 'sem permissão'; end if;
  select coalesce(array_agg(caminho order by enviado_em), '{}') into v_caminhos from curriculos where candidato_id = p_candidato;
  delete from candidatos where id = p_candidato;
  if not found then raise exception 'candidato não encontrado'; end if;
  insert into historico (vaga_id, nome_usuario, acao) values (null, meu_nome(), 'Excluiu um candidato do banco de currículos (LGPD)');
  return v_caminhos;
end $$;

revoke execute on function public.salvar_selecao, public.encerrar_selecao, public.registrar_curriculo, public.iniciar_analise,
  public.reanalisar, public.incluir_do_banco, public.confirmar_classificacao, public.mudar_classificacao, public.salvar_entrevista,
  public.definir_resultado, public.buscar_candidatos, public.participacoes_do_candidato, public.excluir_candidato from public, anon;
grant execute on function public.salvar_selecao, public.encerrar_selecao, public.registrar_curriculo, public.iniciar_analise,
  public.reanalisar, public.incluir_do_banco, public.confirmar_classificacao, public.mudar_classificacao, public.salvar_entrevista,
  public.definir_resultado, public.buscar_candidatos, public.participacoes_do_candidato, public.excluir_candidato to authenticated;
