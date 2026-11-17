-- Folga mínima por projeto: com esta folga (em dias úteis) até a meta, ou menos, a vaga fica em
-- "Atenção" no painel. Antes era fixa em 3 no código; os projetos existentes começam com 3.
-- Migração aditiva: o código publicado não lê a coluna, e salvar_projeto sem o campo mantém o valor.

alter table projetos add column folga_minima smallint not null default 3 check (folga_minima between 0 and 30);

create or replace function public.salvar_projeto(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_antes projetos; v_folga smallint := (p->>'folga_minima')::smallint;
begin
  if p_id is null then
    if not (eh_rh() or eh_analista()) then raise exception 'sem permissão'; end if;
    insert into projetos (cliente_id, nome, area, organizacao, folga_minima)
    values ((p->>'cliente_id')::uuid, p->>'nome', nullif(p->>'area', ''), p->>'organizacao', coalesce(v_folga, 3))
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
  v_folga := coalesce(v_folga, v_antes.folga_minima);
  -- O gatilho conferir_projeto recusa trocar o cliente ou a organização.
  update projetos set cliente_id = (p->>'cliente_id')::uuid, nome = p->>'nome', area = nullif(p->>'area', ''), organizacao = p->>'organizacao',
    folga_minima = v_folga
  where id = p_id;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (null, meu_nome(), 'Alterou o projeto ' || (p->>'nome'), jsonb_build_object(
    'antes', jsonb_build_object('nome', v_antes.nome, 'area', v_antes.area, 'organizacao', v_antes.organizacao, 'folga_minima', v_antes.folga_minima),
    'depois', jsonb_build_object('nome', p->>'nome', 'area', nullif(p->>'area', ''), 'organizacao', p->>'organizacao', 'folga_minima', v_folga)));
  return p_id;
end $$;
