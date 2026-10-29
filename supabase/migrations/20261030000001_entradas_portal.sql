-- Tokens de entrada vindos do Portal da Gestão já usados: cada um vale uma vez só.
create table entradas_portal (
  jti uuid primary key,
  usado_em timestamptz not null default now()
);
alter table entradas_portal enable row level security; -- sem policy: só o cliente admin usa
