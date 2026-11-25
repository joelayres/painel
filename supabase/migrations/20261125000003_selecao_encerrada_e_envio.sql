-- Seleção encerrada: o banco recusa a entrada de currículos (importar, incluir do banco, analisar,
-- reanalisar) e a edição do descritivo, como a tela já fazia. Resultado, entrevistas, classificação
-- e indicação continuam permitidos: o desfecho costuma ser registrado depois de encerrar.
-- Envio ao Storage: só na pasta de uma seleção aberta que a pessoa pode alterar. Migração aditiva.

create function public.selecao_aberta(p_selecao uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from selecoes where id = p_selecao and encerrada_em is null)
$$;
revoke execute on function public.selecao_aberta from public, anon, authenticated;

-- Participação nova, ou que volta para a fila (pendente) ou começa a ser analisada.
create function public.travar_selecao_encerrada() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not selecao_aberta(new.selecao_id) then raise exception 'seleção encerrada'; end if;
  return new;
end $$;

create trigger selecao_encerrada_inclusao before insert on participacoes for each row
  execute function travar_selecao_encerrada();
create trigger selecao_encerrada_analise before update of situacao on participacoes for each row
  when (new.situacao in ('pendente', 'analisando') and new.situacao is distinct from old.situacao)
  execute function travar_selecao_encerrada();

-- O descritivo e a função não mudam com a seleção encerrada (encerrar e reabrir seguem livres).
create function public.travar_descritivo_encerrado() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.encerrada_em is not null and new.encerrada_em is not null
     and (new.funcao is distinct from old.funcao or new.descritivo is distinct from old.descritivo) then
    raise exception 'seleção encerrada';
  end if;
  return new;
end $$;

create trigger descritivo_encerrado before update on selecoes for each row execute function travar_descritivo_encerrado();

revoke execute on function public.travar_selecao_encerrada, public.travar_descritivo_encerrado from public, anon, authenticated;

-- "<seleção>/<arquivo>.pdf": a pasta precisa ser um id de seleção aberta que a pessoa pode alterar.
create function public.pode_enviar_curriculo(p_nome text) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_pasta text := split_part(coalesce(p_nome, ''), '/', 1);
begin
  if v_pasta !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return false; end if;
  return (eh_rh() or eh_analista()) and pode_ver_selecao(v_pasta::uuid) and selecao_aberta(v_pasta::uuid);
end $$;
revoke execute on function public.pode_enviar_curriculo from public, anon;
grant execute on function public.pode_enviar_curriculo to authenticated;

drop policy curriculos_envio on storage.objects;
create policy curriculos_envio on storage.objects for insert to authenticated
  with check (bucket_id = 'curriculos' and public.pode_enviar_curriculo(name));
