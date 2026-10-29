-- Limpeza das etapas fixas: sai o que a 007 deixou para o código antigo (vaga_conclusoes.ordem,
-- projeto_duracoes, alterar_duracao_projeto e o gatilho etapa_da_conclusao). Só roda depois de o
-- código novo estar publicado: ele já não lê nem grava nada disso.

-- As funções param de gravar a ordem e projeto_duracoes antes de as colunas e a tabela saírem.
-- Conclui as posições de p_ordem_esperada até p_ate, todas na mesma data (arraste no quadro).
-- Tudo é conferido antes de gravar a primeira conclusão: o salto vai inteiro ou nada.
create or replace function public.concluir_etapas(p_vaga uuid, p_ordem_esperada smallint, p_ate smallint, p_data date) returns void
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
    insert into vaga_conclusoes (vaga_id, etapa_id, concluida_em) values (p_vaga, e.id, p_data);
    insert into historico (vaga_id, nome_usuario, acao, detalhe)
    values (p_vaga, meu_nome(), 'Concluiu ' || e.nome, jsonb_build_object('ordem', e.posicao, 'data', p_data));
  end loop;
end $$;

-- O "Desfez" do histórico passa a guardar a data que foi desfeita.
create or replace function public.desfazer_etapa(p_vaga uuid, p_ordem_esperada smallint) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_nome text; v_data date;
begin
  perform travar_vaga_rh(p_vaga);
  if etapa_atual(p_vaga) - 1 <> p_ordem_esperada or p_ordem_esperada < 1 then raise exception 'etapa mudou'; end if;
  delete from vaga_conclusoes vc using projeto_etapas e
    where e.id = vc.etapa_id and vc.vaga_id = p_vaga and e.posicao = p_ordem_esperada
    returning e.nome, vc.concluida_em into v_nome, v_data;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (p_vaga, meu_nome(), 'Desfez ' || v_nome, jsonb_build_object('ordem', p_ordem_esperada, 'concluida_em', v_data));
end $$;

-- p_dias null volta a etapa padrão à duração do cliente; numa etapa incluída é recusado. O "antes"
-- e o "depois" são as durações efetivas.
create or replace function public.alterar_duracao_etapa(p_etapa uuid, p_dias smallint) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_etapa projeto_etapas; v_projeto text; v_antes smallint;
begin
  v_etapa := travar_etapa_rh(p_etapa, false);
  if p_dias is null and v_etapa.padrao is null then raise exception 'duração obrigatória'; end if;
  if p_dias not between 0 and 60 then raise exception 'duração inválida'; end if;
  select nome into v_projeto from projetos where id = v_etapa.projeto_id;
  v_antes := duracao_efetiva(p_etapa);
  update projeto_etapas set duracao = p_dias where id = p_etapa;
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (null, meu_nome(), 'Alterou a duração de ' || v_etapa.nome,
    jsonb_build_object('projeto', v_projeto, 'antes', v_antes, 'depois', duracao_efetiva(p_etapa)));
end $$;

-- Auto-reparo: conclusão sem etapa (gravada pelo código antigo depois da 007) recebe a etapa da
-- posição que a ordem tinha, como o gatilho fazia. Sem o gatilho de projeto encerrado: não muda nada.
alter table vaga_conclusoes disable trigger projeto_aberto;
update vaga_conclusoes vc set etapa_id = e.id
from vagas v join projeto_etapas e on e.projeto_id = v.projeto_id
where v.id = vc.vaga_id and vc.etapa_id is null and e.posicao = vc.ordem;
alter table vaga_conclusoes enable trigger projeto_aberto;

drop trigger etapa_da_conclusao on vaga_conclusoes;
drop function public.etapa_da_conclusao();

alter table vaga_conclusoes alter column etapa_id set not null;
alter table vaga_conclusoes drop column ordem;

drop function public.alterar_duracao_projeto(uuid, smallint, smallint);
drop table projeto_duracoes;

do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef loop
    execute format('alter function %s set search_path = public, pg_temp', f);
  end loop;
end $$;
