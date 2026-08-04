-- =====================================================================
-- Borgo 58 · Migrazione 0033 — Tavoli come griglia (§3.2, ridisegno comande)
-- =====================================================================
-- Su richiesta esplicita di Alessio dopo aver provato la prima versione
-- (testo libero): selezione tavolo a griglia, come nel prototipo UX di
-- Cowork. Resta una lista MINIMA di etichette — nessuna pianta del
-- locale, nessuna capienza, nessun accostamento tavoli: il brief §3.2 è
-- esplicito ("niente pagamenti/gestione tavoli") e questa tabella non lo
-- contraddice, è solo un elenco di nomi con un ordine di visualizzazione.
--
-- Stesso pattern già validato oggi per pos_devices ("Configura i tablet
-- in uso"): titolare configura la lista una volta, staff la usa tutti i
-- giorni senza poterla modificare.
-- =====================================================================
create table dining_tables (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  position   integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),

  constraint dining_tables_label_unique unique (label)
);
comment on table dining_tables is
  'Elenco minimo di etichette tavolo per la griglia di selezione in Comande — non una gestione tavoli (pianta/capienza/accostamenti restano fuori scope, §3.2).';

create index idx_dining_tables_active on dining_tables(position) where active;

alter table dining_tables enable row level security;
create policy dining_tables_select_all on dining_tables for select to authenticated using (true);
create policy dining_tables_ins_titolare on dining_tables for insert to authenticated with check ((select is_titolare()));
create policy dining_tables_upd_titolare on dining_tables for update to authenticated using ((select is_titolare())) with check ((select is_titolare()));
create policy dining_tables_del_titolare on dining_tables for delete to authenticated using ((select is_titolare()));
grant select, insert, update, delete on dining_tables to authenticated;
