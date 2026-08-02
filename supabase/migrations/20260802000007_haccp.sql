-- =====================================================================
-- Borgo 58 · Migrazione 0013 — HACCP: Piano di Autocontrollo (§4, modulo 7)
-- =====================================================================
-- Estende l'HACCP già presente a livello ricetta (migrazione 0001: fasi con
-- is_haccp_ccp/haccp_limit/haccp_action, ingredienti con haccp_receiving_temp)
-- a tutto il locale: registro temperature, ricevimento merci, pulizia e
-- sanificazione, disinfestazione, rintracciabilità lotti, non conformità.
--
-- IMPORTANTE (come da brief): questo modulo costruisce solo la STRUTTURA
-- software. Le attrezzature, gli intervalli di temperatura target, le
-- attività di pulizia e le loro frequenze restano REGISTRI VUOTI da
-- compilare — nessun valore di sicurezza alimentare è inventato qui.
-- Il piano di autocontrollo completo (cosa monitorare, con quali soglie,
-- ogni quanto) richiede la validazione di un consulente alimentare/tecnico
-- HACCP prima di essere usato in produzione (obbligo esplicito del brief).
--
-- Permessi (§3.5, diversi da tutti gli altri moduli): lo staff fa SOLO
-- immissione operativa quotidiana — può leggere e inserire nuove
-- registrazioni, ma MAI modificare la struttura (attrezzature, attività di
-- pulizia) né lo storico (correggere/cancellare una registrazione passata).
-- Il titolare ha accesso pieno. Nessun dato economico qui: niente pattern
-- "vista display", solo RLS su chi può inserire/modificare cosa.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Rintracciabilità lotti — il numero di lotto dichiarato dal fornitore
-- ---------------------------------------------------------------------
-- stock_lots (migrazione 0012) traccia già consegna/scadenza/fornitore per
-- ogni lotto: aggiunge solo il numero di lotto del documento di trasporto,
-- che è il dato mancante per la rintracciabilità HACCP vera e propria.
alter table stock_lots add column supplier_batch_number text;
comment on column stock_lots.supplier_batch_number is
  'Numero di lotto dichiarato dal fornitore sul documento di trasporto (rintracciabilità HACCP, §4 modulo 7). Non obbligatorio: non tutti i fornitori lo riportano.';

-- ---------------------------------------------------------------------
-- 1. Attrezzature a temperatura controllata (struttura — solo titolare)
-- ---------------------------------------------------------------------
create table haccp_equipment (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,                 -- es. "Frigo pesce"
  storage_type   storage_type,                  -- riuso dell'enum già usato per gli ingredienti
  target_min_c   numeric(5,2),
  target_max_c   numeric(5,2),
  active         boolean not null default true,
  created_at     timestamptz not null default now(),

  constraint target_range_coherent check (
    target_min_c is null or target_max_c is null or target_min_c <= target_max_c
  )
);
comment on table haccp_equipment is
  'Anagrafica attrezzature (frigo, freezer, ecc.) con range di temperatura target — DA VALIDARE con un consulente HACCP prima dell''uso in produzione.';

-- ---------------------------------------------------------------------
-- 2. Registro temperature (log — immissione anche staff)
-- ---------------------------------------------------------------------
create table haccp_temperature_logs (
  id                 uuid primary key default gen_random_uuid(),
  equipment_id       uuid not null references haccp_equipment(id) on delete restrict,
  recorded_temp_c    numeric(5,2) not null,
  recorded_at        timestamptz not null default now(),
  note               text,
  corrective_action  text,
  created_at         timestamptz not null default now()
);
create index idx_haccp_temp_logs_equipment on haccp_temperature_logs(equipment_id, recorded_at desc);

-- Compliance calcolata, non salvata (stesso principio del food cost: la
-- fonte di verità è il dato + il range attuale, non un valore congelato).
create view v_haccp_temperature_logs
with (security_invoker = true) as
select
  tl.id, tl.equipment_id, e.name as equipment_name,
  e.target_min_c, e.target_max_c,
  tl.recorded_temp_c, tl.recorded_at, tl.note, tl.corrective_action,
  (e.target_min_c is not null and e.target_max_c is not null
    and tl.recorded_temp_c between e.target_min_c and e.target_max_c) as is_compliant
from haccp_temperature_logs tl
join haccp_equipment e on e.id = tl.equipment_id;
grant select on v_haccp_temperature_logs to authenticated;

-- ---------------------------------------------------------------------
-- 3. Ricevimento merci (log)
-- ---------------------------------------------------------------------
create table haccp_goods_receiving (
  id                  uuid primary key default gen_random_uuid(),
  supplier_id         uuid references suppliers(id) on delete set null,
  product_description text not null,
  received_at         timestamptz not null default now(),
  temperature_c       numeric(5,2),
  packaging_ok        boolean not null default true,
  conformity          boolean not null default true,
  note                text,
  created_at          timestamptz not null default now()
);
create index idx_haccp_goods_receiving_date on haccp_goods_receiving(received_at desc);

-- ---------------------------------------------------------------------
-- 4. Pulizia e sanificazione (attività = struttura, log = immissione)
-- ---------------------------------------------------------------------
create table haccp_cleaning_tasks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,               -- es. "Sanificazione banco pesce"
  area        text,
  frequency   text not null check (frequency in ('giornaliera', 'settimanale', 'mensile', 'altro')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table haccp_cleaning_logs (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references haccp_cleaning_tasks(id) on delete restrict,
  completed_at  timestamptz not null default now(),
  note          text,
  created_at    timestamptz not null default now()
);
create index idx_haccp_cleaning_logs_task on haccp_cleaning_logs(task_id, completed_at desc);

-- ---------------------------------------------------------------------
-- 5. Disinfestazione (log — tipicamente ditta esterna periodica)
-- ---------------------------------------------------------------------
create table haccp_pest_control_logs (
  id            uuid primary key default gen_random_uuid(),
  performed_at  timestamptz not null default now(),
  performed_by  text,                       -- es. nome ditta esterna
  type          text not null default 'ispezione' check (type in ('ispezione', 'trattamento')),
  findings      text,
  note          text,
  created_at    timestamptz not null default now()
);
create index idx_haccp_pest_control_date on haccp_pest_control_logs(performed_at desc);

-- ---------------------------------------------------------------------
-- 6. Non conformità
-- ---------------------------------------------------------------------
create table haccp_non_conformities (
  id                 uuid primary key default gen_random_uuid(),
  category           text not null check (category in ('temperatura', 'ricevimento', 'pulizia', 'disinfestazione', 'altro')),
  description        text not null,
  detected_at        timestamptz not null default now(),
  corrective_action  text,
  resolved           boolean not null default false,
  resolved_at        timestamptz,
  note               text,
  created_at         timestamptz not null default now(),

  constraint resolved_has_timestamp check (not resolved or resolved_at is not null)
);
create index idx_haccp_nc_resolved on haccp_non_conformities(resolved);

-- ---------------------------------------------------------------------
-- 7. RLS — struttura solo titolare, log: lettura+inserimento a tutti,
--    modifica/cancellazione solo titolare (mai al di fuori di questo modulo
--    lo staff ha permessi così granulari: qui li vuole esplicitamente il brief)
-- ---------------------------------------------------------------------
alter table haccp_equipment enable row level security;
create policy haccp_equipment_select_all on haccp_equipment for select to authenticated using (true);
create policy haccp_equipment_write_titolare on haccp_equipment for insert to authenticated with check ((select is_titolare()));
create policy haccp_equipment_update_titolare on haccp_equipment for update to authenticated using ((select is_titolare())) with check ((select is_titolare()));
create policy haccp_equipment_delete_titolare on haccp_equipment for delete to authenticated using ((select is_titolare()));

alter table haccp_cleaning_tasks enable row level security;
create policy haccp_cleaning_tasks_select_all on haccp_cleaning_tasks for select to authenticated using (true);
create policy haccp_cleaning_tasks_ins_titolare on haccp_cleaning_tasks for insert to authenticated with check ((select is_titolare()));
create policy haccp_cleaning_tasks_upd_titolare on haccp_cleaning_tasks for update to authenticated using ((select is_titolare())) with check ((select is_titolare()));
create policy haccp_cleaning_tasks_del_titolare on haccp_cleaning_tasks for delete to authenticated using ((select is_titolare()));

do $$
declare t text;
begin
  foreach t in array array[
    'haccp_temperature_logs', 'haccp_goods_receiving', 'haccp_cleaning_logs', 'haccp_pest_control_logs'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('create policy %I on %I for select to authenticated using (true);', t || '_select_all', t);
    execute format('create policy %I on %I for insert to authenticated with check (true);', t || '_insert_all', t);
    execute format('create policy %I on %I for update to authenticated using ((select is_titolare())) with check ((select is_titolare()));', t || '_upd_titolare', t);
    execute format('create policy %I on %I for delete to authenticated using ((select is_titolare()));', t || '_del_titolare', t);
  end loop;
end $$;

-- Non conformità: lo staff segnala (insert) e legge, ma solo il titolare
-- corregge/risolve/cancella — coerente col resto del modulo.
alter table haccp_non_conformities enable row level security;
create policy haccp_nc_select_all on haccp_non_conformities for select to authenticated using (true);
create policy haccp_nc_insert_all on haccp_non_conformities for insert to authenticated with check (true);
create policy haccp_nc_upd_titolare on haccp_non_conformities for update to authenticated using ((select is_titolare())) with check ((select is_titolare()));
create policy haccp_nc_del_titolare on haccp_non_conformities for delete to authenticated using ((select is_titolare()));
