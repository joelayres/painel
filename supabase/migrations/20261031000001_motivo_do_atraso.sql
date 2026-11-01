-- Motivo do atraso: a equipe de RH explica por que a vaga passou do prazo da etapa atual, e o
-- cliente e o gestor leem no painel. Um motivo por vaga e etapa; quando a etapa é concluída, o
-- motivo dela some das telas (o painel só mostra o da etapa atual) e fica no histórico da vaga.
-- Migração aditiva: o código publicado não lê a tabela nem chama a função.

create table vaga_motivos (
  vaga_id uuid not null references vagas on delete cascade,
  etapa_id uuid not null references projeto_etapas on delete cascade,
  texto text not null check (char_length(texto) between 1 and 500),
  nome_usuario text not null,
  atualizado_em timestamptz not null default now(),
  primary key (vaga_id, etapa_id)
);

alter table vaga_motivos enable row level security;

create policy leitura on vaga_motivos for select to authenticated
  using (exists (select 1 from vagas v where v.id = vaga_motivos.vaga_id and pode_ver_projeto(v.projeto_id)));

-- Escreve, troca ou (com texto vazio) apaga o motivo da etapa atual da vaga. `p_ordem_esperada` é a
-- etapa atual que a tela mostrava: se ela já foi concluída, a vaga mudou enquanto a pessoa olhava.
create function public.salvar_motivo_atraso(p_vaga uuid, p_ordem_esperada smallint, p_texto text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_projeto uuid; v_etapa projeto_etapas; v_texto text := btrim(coalesce(p_texto, '')); v_tinha boolean;
begin
  perform travar_vaga_rh(p_vaga);
  select projeto_id into v_projeto from vagas where id = p_vaga;
  if exists (select 1 from projetos where id = v_projeto and encerrado_em is not null) then raise exception 'projeto encerrado'; end if;
  select * into v_etapa from projeto_etapas where projeto_id = v_projeto and posicao = p_ordem_esperada;
  if not found or exists (select 1 from vaga_conclusoes where vaga_id = p_vaga and etapa_id = v_etapa.id) then
    raise exception 'etapa mudou';
  end if;
  if char_length(v_texto) > 500 then raise exception 'motivo longo demais'; end if;
  v_tinha := exists (select 1 from vaga_motivos where vaga_id = p_vaga and etapa_id = v_etapa.id);
  if v_texto = '' then
    if not v_tinha then return; end if;
    delete from vaga_motivos where vaga_id = p_vaga and etapa_id = v_etapa.id;
    insert into historico (vaga_id, nome_usuario, acao) values (p_vaga, meu_nome(), 'Apagou o motivo do atraso em ' || v_etapa.nome);
    return;
  end if;
  insert into vaga_motivos (vaga_id, etapa_id, texto, nome_usuario) values (p_vaga, v_etapa.id, v_texto, meu_nome())
  on conflict (vaga_id, etapa_id) do update set texto = excluded.texto, nome_usuario = excluded.nome_usuario, atualizado_em = now();
  insert into historico (vaga_id, nome_usuario, acao, detalhe)
  values (p_vaga, meu_nome(), (case when v_tinha then 'Alterou' else 'Escreveu' end) || ' o motivo do atraso em ' || v_etapa.nome,
    jsonb_build_object('motivo', v_texto));
end $$;

revoke execute on function public.salvar_motivo_atraso from public, anon;
grant execute on function public.salvar_motivo_atraso to authenticated;
