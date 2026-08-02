-- =====================================================================
-- Borgo 58 · Migrazione 0009 — Stati ricetta a due flag (§4, modulo 1)
-- =====================================================================
-- Lo status unico (in_sviluppo/attiva/in_pausa/archiviata) diventa due
-- flag indipendenti:
--   pronta_per_carta — testata e validata, resta acquisita nel tempo
--   in_carta         — si accende/spegne a ogni cambio menu stagionale
-- La promozione a "pronta" è sempre manuale (decisione di Alessio) — nessuna
-- automazione qui, solo storico di chi/quando è cambiato lo stato.
-- =====================================================================

alter table recipes add column pronta_per_carta boolean not null default false;
alter table recipes add column in_carta boolean not null default false;

-- Non si può essere "in carta" senza essere "pronti" — coerenza minima.
alter table recipes add constraint recipe_in_carta_requires_pronta
  check (not in_carta or pronta_per_carta);

-- Mappa ragionevole dallo status esistente (nessuna ricetta reale ancora in
-- produzione, ma teniamo la migrazione corretta per qualunque dato di prova):
-- attiva → pronta e in carta; in_pausa → pronta ma non in carta;
-- in_sviluppo/archiviata → nessuno dei due flag.
update recipes set
  pronta_per_carta = (status in ('attiva', 'in_pausa')),
  in_carta = (status = 'attiva');

alter table recipes drop column status;
drop type if exists recipe_status;

-- ---------------------------------------------------------------------
-- Storico cambi di stato
-- ---------------------------------------------------------------------
create table recipe_status_history (
  id                uuid primary key default gen_random_uuid(),
  recipe_id         uuid not null references recipes(id) on delete cascade,
  pronta_per_carta  boolean not null,
  in_carta          boolean not null,
  changed_at        timestamptz not null default now()
);
comment on table recipe_status_history is
  'Traccia ogni cambio dei due flag di stato ricetta. Un record per cambiamento, non solo lo stato attuale.';

create or replace function log_recipe_status_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.pronta_per_carta is distinct from old.pronta_per_carta
     or new.in_carta is distinct from old.in_carta then
    insert into recipe_status_history (recipe_id, pronta_per_carta, in_carta)
    values (new.id, new.pronta_per_carta, new.in_carta);
  end if;
  return new;
end;
$$;

create trigger trg_recipe_status_history
  after update on recipes
  for each row execute function log_recipe_status_change();

-- RLS: stesso pattern di recipes (lettura a tutti, scrittura titolare) — lo
-- storico si genera solo quando il titolare modifica lo stato, ma è utile
-- che anche lo staff possa consultarlo (capire da quando un piatto è in carta).
alter table recipe_status_history enable row level security;
create policy recipe_status_history_select_all on recipe_status_history
  for select to authenticated using (true);
grant select on recipe_status_history to authenticated;

-- Seed dello storico iniziale per le ricette esistenti (se ce ne sono).
insert into recipe_status_history (recipe_id, pronta_per_carta, in_carta, changed_at)
select id, pronta_per_carta, in_carta, created_at from recipes;
