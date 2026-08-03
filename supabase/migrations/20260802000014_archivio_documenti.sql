-- =====================================================================
-- Borgo 58 · Migrazione 0020 — Archivio Documenti (§3.13, modulo 15)
-- =====================================================================
-- PRIMO modulo che archivia FILE veri (non solo dati): usa Supabase Storage.
-- Tutto in server UE (Irlanda, GDPR — importante per contratti/dati personali).
--
-- Versione SENZA AI (come video ricette e buste paga): i metadati (tipo,
-- data, controparti, importi, scadenza) si inseriscono a mano. L'estrazione
-- automatica AI (OCR + lettura del documento) arriverà quando si attiverà
-- l'integrazione LLM — prima il dato strutturato, l'AI dopo (§3.13/§3.10).
--
-- "Nessuna categoria fissa predefinita" (§3.13): doc_type è testo libero,
-- non un enum. Le scadenze generano un promemoria in Agenda. Solo titolare.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Contenitore dei file (Supabase Storage) — bucket privato
-- ---------------------------------------------------------------------
-- Se la creazione del bucket o delle policy sotto dà errore di permessi
-- dall'SQL Editor, si può creare il bucket "documents" (privato) dalla UI
-- Storage della dashboard e aggiungere lì le stesse policy.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- RLS su storage.objects (già abilitata da Supabase): accesso al bucket
-- 'documents' solo al titolare, per ogni operazione.
create policy "documents_select_titolare" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and (select is_titolare()));
create policy "documents_insert_titolare" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (select is_titolare()));
create policy "documents_update_titolare" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and (select is_titolare()))
  with check (bucket_id = 'documents' and (select is_titolare()));
create policy "documents_delete_titolare" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (select is_titolare()));

-- ---------------------------------------------------------------------
-- 2. Metadati dei documenti
-- ---------------------------------------------------------------------
create table documents (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid references entities(id) on delete set null,   -- opzionale
  title          text not null,
  doc_type       text,                    -- LIBERO, nessuna categoria fissa (§3.13)
  document_date  date,
  counterparties text,                    -- controparti (es. locatore, assicurazione)
  amount         numeric(12,2),
  expiry_date    date,
  storage_path   text,                    -- percorso del file nel bucket (null = solo metadati)
  file_name      text,
  note           text,
  -- Scadenza → promemoria in Agenda (§3.13), come fatture/documenti personale.
  task_id        uuid references tasks(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_documents_expiry on documents(expiry_date);
create index idx_documents_type on documents(doc_type);
comment on table documents is
  'Archivio documenti (§3.13). Metadati inseriti a mano in questa versione; estrazione AL momento del caricamento da aggiungere con l''integrazione LLM. File nel bucket Storage privato "documents".';

create trigger trg_documents_updated_at before update on documents
  for each row execute function set_updated_at();

alter table documents enable row level security;
create policy documents_titolare_all on documents
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));
