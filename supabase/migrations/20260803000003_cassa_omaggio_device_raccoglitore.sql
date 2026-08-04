-- =====================================================================
-- Borgo 58 · Migrazione 0024 — Cassa: device sconti/omaggi + raccoglitore
-- occasionale (§3.4, §3.17, revisione 03/08/2026)
-- =====================================================================
-- Tre aggiornamenti al modulo Cassa già esistente:
--   1. Nuovo tipo_documento "documento_raccoglitore_occasionale" (§3.17) per
--      l'acquisto a norma da un raccoglitore occasionale (regime L.145/2018).
--   2. Campi del raccoglitore sui movimenti di cassa (CF + regione di raccolta,
--      obbligo regione dal 01/01/2026 — L.199/2025 c.932).
--   3. Registro dei device (tablet) + device di provenienza su sconti/omaggi:
--      base per la "segnalazione silenziosa" (§3.4) — sconti/omaggi partiti da
--      un tablet diverso da quello del titolare vengono evidenziati solo nel
--      suo riepilogo. Anti-furto: intercetta chi omaggia per intascare, utile
--      perché lo staff usa un account condiviso (§3.5).
-- =====================================================================

-- 1. Nuovo valore dell'enum (non referenziato altrove in questa migrazione:
--    in Postgres 15 ADD VALUE è ok in transazione se il valore non viene usato
--    nella stessa transazione).
alter type cash_document_type add value if not exists 'documento_raccoglitore_occasionale';

-- 2. Campi del raccoglitore occasionale sui movimenti di cassa.
alter table cash_movements add column forager_tax_code text;   -- CF del raccoglitore
alter table cash_movements add column harvest_region text;      -- regione di raccolta (obbligo 2026)
comment on column cash_movements.forager_tax_code is
  'Codice fiscale del raccoglitore occasionale (tipo_documento=documento_raccoglitore_occasionale, §3.17).';
comment on column cash_movements.harvest_region is
  'Regione di raccolta — obbligo dal 01/01/2026 (L.199/2025 c.932) per gli acquisti da raccoglitore occasionale.';

-- 3. Registro device (tablet).
create table pos_devices (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,                       -- es. "Tablet Sala", "Tablet Alessio"
  is_owner_device  boolean not null default false,      -- il tablet del titolare
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);
comment on table pos_devices is
  'Tablet/device configurati una volta (§3.4). is_owner_device = quello del titolare: sconti/omaggi da altri device sono evidenziati solo nel riepilogo del titolare.';

alter table discounts_gifts add column device_id uuid references pos_devices(id) on delete set null;

-- RLS: entrambe solo titolare per ora (Cassa è titolare-only §3.5). Quando
-- arriveranno le comande, lo staff scriverà sconti/omaggi da un percorso
-- dedicato; qui resta la vista amministrativa del titolare.
alter table pos_devices enable row level security;
create policy pos_devices_titolare_all on pos_devices
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ---------------------------------------------------------------------
-- 4. Ammorbidimento testo TD27 (§3.4, revisione 03/08/2026)
-- ---------------------------------------------------------------------
-- La formulazione precedente ("nessuna soglia de minimis, sempre TD27") era
-- più assertiva di quanto le fonti confermino per un pasto servito (diverso
-- dalla cessione di un bene/gadget) — resta da chiarire con Laura SE e
-- QUANDO gli omaggi sistematici generano l'obbligo, in base a volume/
-- frequenza. Aggiornati i commenti che affermavano il contrario come certo.
comment on table discounts_gifts is
  'Sconti e omaggi (§3.4, §6). Un omaggio NON passa dal registratore telematico: resta un movimento del solo gestionale (per costruzione non alimenta i corrispettivi RT). Se e quando gli omaggi sistematici generano un obbligo di autofattura TD27 dipende da volume/frequenza — DA VERIFICARE con Laura, non dato per certo.';

comment on view v_discounts_gifts_monthly is
  'Aggregazione mensile per la revisione fiscale. Per type=omaggio, total_full del mese è il totale a valore di listino degli omaggi — utile a Laura per valutare se e quando scatta un obbligo di autofattura TD27 (dipende da volume/frequenza, non automatico).';
