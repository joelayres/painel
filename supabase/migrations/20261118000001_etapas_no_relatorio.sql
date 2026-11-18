-- Etapas no relatório: o projeto mantém a lista inteira no dia a dia, e a equipe escolhe quais etapas
-- aparecem na aba Relatório (e no Excel dele). Toda etapa começa no relatório.
-- Migração aditiva: o código publicado não lê a coluna.

alter table projeto_etapas add column no_relatorio boolean not null default true;

-- Mesmas regras das outras mudanças na lista: só a equipe que pode mexer no projeto, e nunca em
-- projeto encerrado (o gatilho da tabela recusa). A fixa também pode sair do relatório.
create function public.mostrar_etapa_no_relatorio(p_etapa uuid, p_mostrar boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_etapa projeto_etapas; v_projeto text;
begin
  v_etapa := travar_etapa_rh(p_etapa, false);
  if v_etapa.no_relatorio = p_mostrar then return; end if;
  select nome into v_projeto from projetos where id = v_etapa.projeto_id;
  update projeto_etapas set no_relatorio = p_mostrar where id = p_etapa;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (null, meu_nome(), format(case when p_mostrar then 'Pôs a etapa %s no relatório' else 'Tirou a etapa %s do relatório' end, v_etapa.nome),
    jsonb_build_object('projeto', v_projeto, 'etapa', v_etapa.nome, 'no_relatorio', p_mostrar));
end $$;

revoke execute on function public.mostrar_etapa_no_relatorio from public, anon;
grant execute on function public.mostrar_etapa_no_relatorio to authenticated;
