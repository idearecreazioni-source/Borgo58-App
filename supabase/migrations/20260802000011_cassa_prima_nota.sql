-- =====================================================================
-- Borgo 58 · Migrazione 0017 — Cassa, Banca e Prima Nota (§3.4, §4 modulo 5)
-- =====================================================================
-- SOLO la parte "prima nota" manuale (§3.2): la riconciliazione POS
-- automatica e il margine per piatto restano bloccati finché Alessio non
-- sceglie il sistema di cassa. Tutto qui è a inserimento manuale, com'è già
-- previsto dal brief come modalità di partenza.
--
-- Principi fiscali implementati (§3.4, §6) — NON dettagli rimandabili:
--   1. Ogni movimento è taggato per ENTITÀ (§1): S.r.l.s. vs agricola.
--   2. tipo_documento distingue ciò che entra nei calcoli fiscali
--      (fattura/scontrino/autofattura) da ciò che NON ci entra
--      (non_documentato) — mai confondere i due.
--   3. "Contante atteso = fondo cassa + incassi dichiarati − uscite":
--      il saldo di cassa è la somma algebrica dei movimenti. Se diventa
--      negativo c'è un "movimento sospeso senza provenienza" (§3.4) — non
--      lo blocchiamo a forza (l'inserimento può avvenire fuori ordine
--      cronologico), ma il saldo negativo è reso visibile come anomalia.
--   4. SCONTO ≠ OMAGGIO (§6): sono operazioni fiscalmente distinte.
--      Uno sconto riduce il corrispettivo di una vendita che avviene
--      comunque; un omaggio di beni oggetto dell'attività è una cessione
--      gratuita (IVA dovuta sul valore, autofattura TD27 cumulativa mensile,
--      nessuna soglia de minimis). Tabella separata, mai uno sconto al 100%.
--
-- Accesso: SOLO titolare (§3.5) — nessuna vista display, nessun accesso staff.
-- NULLA qui è un'automazione fiscale che decide da sola: tutto assiste, la
-- validazione resta a Laura (§6). L'autofattura TD27 NON viene emessa dal
-- sistema — se ne calcola solo la base imponibile mensile.
-- =====================================================================

create type cash_direction as enum ('entrata', 'uscita');
create type cash_document_type as enum ('fattura', 'scontrino', 'autofattura', 'non_documentato');
create type discount_gift_type as enum ('sconto', 'omaggio');

-- ---------------------------------------------------------------------
-- Causali editabili (§3.4: "modificabile da Alessio in app, non hardcoded")
-- ---------------------------------------------------------------------
create table cash_causali (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  kind        text not null check (kind in ('entrata', 'uscita', 'sconto_omaggio')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (label, kind)
);
comment on table cash_causali is
  'Causali dei movimenti di cassa e degli sconti/omaggi, gestibili dal titolare in-app (§3.4). kind separa i tre contesti d''uso.';

insert into cash_causali (label, kind) values
  ('Incasso giornaliero', 'entrata'),
  ('Altro incasso', 'entrata'),
  ('Spesa alimentare', 'uscita'),
  ('Utenze', 'uscita'),
  ('Manutenzione', 'uscita'),
  ('Materiale di consumo / economato', 'uscita'),
  ('Trasporti', 'uscita'),
  ('Altra uscita', 'uscita'),
  ('Cliente ricorrente', 'sconto_omaggio'),
  ('Cortesia', 'sconto_omaggio'),
  ('Recupero disservizio', 'sconto_omaggio'),
  ('Altro', 'sconto_omaggio');

-- ---------------------------------------------------------------------
-- Prima nota di cassa — il libro dei movimenti in contante
-- ---------------------------------------------------------------------
create table cash_movements (
  id                 uuid primary key default gen_random_uuid(),
  entity_id          uuid not null references entities(id) on delete restrict,
  direction          cash_direction not null,
  amount             numeric(12,2) not null check (amount > 0),
  movement_date      date not null default current_date,
  causale_id         uuid references cash_causali(id) on delete set null,
  tipo_documento     cash_document_type not null default 'non_documentato',
  document_reference text,
  business_purpose   text,   -- finalità aziendale dell'acquisto (§3.4/§6: rafforza la deducibilità)
  -- Distingue il fondo cassa / versamento titolare dagli incassi veri
  -- (serve alla formula "fondo cassa + incassi dichiarati − uscite").
  is_owner_injection boolean not null default false,
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Un versamento titolare è per definizione un'entrata (fondo cassa).
  constraint owner_injection_is_entrata check (not is_owner_injection or direction = 'entrata')
);
create index idx_cash_movements_date on cash_movements(movement_date desc);
create index idx_cash_movements_entity on cash_movements(entity_id);
comment on column cash_movements.tipo_documento is
  'Solo fattura/scontrino/autofattura entrano nei calcoli fiscali; non_documentato è tracciato ma escluso (§3.4).';
comment on column cash_movements.is_owner_injection is
  'true = versamento del titolare / fondo cassa, non un incasso da vendita. Serve a separare fondo cassa e incassi dichiarati nella riconciliazione (§3.4).';

create trigger trg_cash_movements_updated_at before update on cash_movements
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Sconti e omaggi — operazioni fiscalmente distinte (§3.4, §6)
-- ---------------------------------------------------------------------
create table discounts_gifts (
  id                uuid primary key default gen_random_uuid(),
  entity_id         uuid not null references entities(id) on delete restrict,
  type              discount_gift_type not null,
  full_amount       numeric(12,2) not null check (full_amount >= 0),        -- importo_pieno (valore a listino)
  collected_amount  numeric(12,2) not null default 0 check (collected_amount >= 0), -- importo_incassato
  causale_id        uuid references cash_causali(id) on delete set null,
  causale_note      text,
  customer_id       uuid references customers(id) on delete set null,       -- §3.14, quando identificabile
  movement_date     date not null default current_date,
  note              text,
  created_at        timestamptz not null default now(),

  -- Un omaggio non incassa nulla; uno sconto incassa qualcosa ma meno del pieno.
  constraint gift_collects_nothing check (type <> 'omaggio' or collected_amount = 0),
  constraint collected_not_over_full check (collected_amount <= full_amount)
);
create index idx_discounts_gifts_date on discounts_gifts(movement_date desc);
comment on table discounts_gifts is
  'Sconti e omaggi (§3.4, §6). L''omaggio di beni oggetto dell''attività è una cessione gratuita: la somma mensile dei full_amount degli omaggi è la base imponibile per l''autofattura TD27 cumulativa mensile — DA VALIDARE con Laura, il sistema NON emette il documento.';

-- ---------------------------------------------------------------------
-- Viste derivate — controlli deterministici, niente LLM (§3.8)
-- ---------------------------------------------------------------------
-- Saldo di cassa ("contante atteso") per entità, con le tre componenti
-- della formula del brief separate.
create view v_cash_balance
with (security_invoker = true) as
select
  e.id as entity_id,
  e.name as entity_name,
  coalesce(sum(case when m.direction = 'entrata' then m.amount else -m.amount end), 0)::numeric(14,2) as balance,
  coalesce(sum(case when m.is_owner_injection then m.amount else 0 end), 0)::numeric(14,2) as owner_float,
  coalesce(sum(case when m.direction = 'entrata' and not m.is_owner_injection then m.amount else 0 end), 0)::numeric(14,2) as declared_takings,
  coalesce(sum(case when m.direction = 'uscita' then m.amount else 0 end), 0)::numeric(14,2) as total_out
from entities e
left join cash_movements m on m.entity_id = e.id
group by e.id, e.name;
grant select on v_cash_balance to authenticated;
comment on view v_cash_balance is
  'Contante atteso = fondo cassa (owner_float) + incassi dichiarati (declared_takings) − uscite (total_out). Un balance negativo segnala un movimento senza provenienza (§3.4).';

-- Totale mensile sconti/omaggi per entità: base della TD27 sugli omaggi.
create view v_discounts_gifts_monthly
with (security_invoker = true) as
select
  entity_id,
  date_trunc('month', movement_date)::date as month,
  type,
  count(*) as count,
  sum(full_amount)::numeric(14,2) as total_full,
  sum(collected_amount)::numeric(14,2) as total_collected,
  sum(full_amount - collected_amount)::numeric(14,2) as total_forgone
from discounts_gifts
group by entity_id, date_trunc('month', movement_date), type;
grant select on v_discounts_gifts_monthly to authenticated;
comment on view v_discounts_gifts_monthly is
  'Aggregazione mensile per la revisione fiscale. Per type=omaggio, total_full del mese = base imponibile della TD27 cumulativa mensile (§6).';

-- ---------------------------------------------------------------------
-- RLS — tutto SOLO titolare (§3.5). Nessun dato di cassa allo staff.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['cash_causali', 'cash_movements', 'discounts_gifts']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy %I on %I for all to authenticated using ((select is_titolare())) with check ((select is_titolare()));',
      t || '_titolare_all', t
    );
  end loop;
end $$;
