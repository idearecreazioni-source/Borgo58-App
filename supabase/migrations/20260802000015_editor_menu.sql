-- =====================================================================
-- Borgo 58 · Migrazione 0021 — Editor Menu Cartaceo (§4 modulo 13)
-- =====================================================================
-- Il menu principale stampabile NON richiede nuove tabelle: legge i piatti
-- già presenti in menus/menu_items (progettati nel Ricettario). La stampa
-- avviene con il pattern print già usato (CSS print + "Salva come PDF").
--
-- Questa migrazione aggiunge solo il MINI-FORMATO "piatti del giorno / fuori
-- menu" (§4 mod. 13): un inserto leggero legato a una data, con ciclo di
-- aggiornamento indipendente dal menu principale — buon posto anche per
-- testare piatti pronta_per_carta prima di metterli in carta stabile.
--
-- Accesso: solo titolare (i menu sono già titolare-only, coerente).
-- =====================================================================

create table daily_menus (
  id            uuid primary key default gen_random_uuid(),
  service_date  date not null default current_date,
  title         text,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_daily_menus_date on daily_menus(service_date desc);
create trigger trg_daily_menus_updated_at before update on daily_menus
  for each row execute function set_updated_at();

create table daily_menu_items (
  id             uuid primary key default gen_random_uuid(),
  daily_menu_id  uuid not null references daily_menus(id) on delete cascade,
  recipe_id      uuid references recipes(id) on delete set null,   -- opzionale: piatto dal ricettario
  custom_name    text,                                             -- oppure nome libero
  category       recipe_category,
  price          numeric(12,2),
  position       integer,
  created_at     timestamptz not null default now(),

  constraint daily_item_has_name check (recipe_id is not null or custom_name is not null)
);
create index idx_daily_menu_items_menu on daily_menu_items(daily_menu_id);
comment on table daily_menu_items is
  'Voci del menu del giorno. recipe_id opzionale (anche piatti pronta_per_carta in prova) o nome libero.';

-- RLS solo titolare (coerente con menus/menu_items)
do $$
declare t text;
begin
  foreach t in array array['daily_menus', 'daily_menu_items']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy %I on %I for all to authenticated using ((select is_titolare())) with check ((select is_titolare()));',
      t || '_titolare_all', t
    );
  end loop;
end $$;
