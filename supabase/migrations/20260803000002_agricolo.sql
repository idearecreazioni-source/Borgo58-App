-- =====================================================================
-- Borgo 58 · Migrazione 0023 — Agricolo / Orto (§4 modulo 8, §1)
-- =====================================================================
-- Chiude il disegno a due entità già predisposto dalla migrazione 0001:
-- l'azienda agricola coltiva l'orto e cede il raccolto alla S.r.l.s. tramite
-- cessione intercompany fatturata (tabella intercompany_cessions, già
-- esistente e finora vuota — l'agricola non è ancora operativa).
--
-- Questa migrazione aggiunge solo le COLTURE (semine/raccolti). Le cessioni
-- usano la tabella già presente; il collegamento al Ricettario avviene via
-- ingredients a source_type='produzione_interna' (già nello schema).
--
-- Decisione fiscale chiave (§1, memoria progetto): il costo di un ingrediente
-- a produzione interna = prezzo della cessione intercompany, NON zero né il
-- costo di coltivazione. DA VALIDARE con la commercialista (Laura).
--
-- Accesso: solo titolare (l'agricola è di Alessio; le cessioni sono materia
-- fiscale). intercompany_cessions è già titolare-only dalla migrazione 0005.
-- =====================================================================

create type crop_status as enum ('pianificato', 'seminato', 'in_crescita', 'raccolto', 'chiuso');

create table crops (
  id                     uuid primary key default gen_random_uuid(),
  entity_id              uuid not null references entities(id) on delete restrict,  -- l'azienda agricola
  name                   text not null,                 -- es. "Aglione della Valdichiana"
  variety                text,
  plot                   text,                          -- appezzamento / zona dell'orto
  status                 crop_status not null default 'pianificato',
  sowing_date            date,
  expected_harvest_date  date,
  actual_harvest_date    date,
  harvested_quantity     numeric(12,3),
  unit                   unit_type,
  -- Collegamento al Ricettario: quale ingrediente (a produzione interna)
  -- alimenta questa coltura.
  ingredient_id          uuid references ingredients(id) on delete set null,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index idx_crops_status on crops(status);
create index idx_crops_expected_harvest on crops(expected_harvest_date);
comment on table crops is
  'Colture dell''orto (azienda agricola). Il raccolto diventa ingrediente a produzione interna e viene ceduto alla S.r.l.s. via intercompany_cessions.';

create trigger trg_crops_updated_at before update on crops
  for each row execute function set_updated_at();

alter table crops enable row level security;
create policy crops_titolare_all on crops
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));
