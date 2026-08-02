-- =====================================================================
-- Borgo 58 · Migrazione 0014 — Fatture Fornitori, versione manuale (§4, modulo 3)
-- =====================================================================
-- La sincronizzazione automatica via API Fatture in Cloud (§3.1) resta
-- bloccata finché Alessio non attiva il piano "Complete" (~51€/mese) e
-- registra un'app OAuth2 sul loro portale sviluppatori — non è
-- un'incertezza tecnica (l'API è già confermata), solo un passo
-- amministrativo non ancora fatto. Nel frattempo questo modulo è
-- pienamente utilizzabile in inserimento manuale: quando la sincronizzazione
-- arriverà, si aggiungerà un canale di scrittura in più su questa stessa
-- tabella (una Edge Function che riceve i webhook), senza cambiare schema.
--
-- Dato economico + legato a un'entità fiscale specifica (§1): stesso
-- gruppo "money-relevant" di ingredients/suppliers, quindi entity_id
-- obbligatorio e RLS titolare-only. **Accesso staff: no** (esplicito nel
-- brief, a differenza di Magazzino/HACCP) — nessuna vista "display" qui,
-- lo staff non ha alcun accesso a questa tabella.
-- =====================================================================

create table supplier_invoices (
  id              uuid primary key default gen_random_uuid(),
  entity_id       uuid not null references entities(id) on delete restrict,
  supplier_id     uuid not null references suppliers(id) on delete restrict,
  invoice_number  text,
  invoice_date    date not null,
  due_date        date,
  amount          numeric(12,2) not null,       -- totale fattura, IVA inclusa
  status          text not null default 'da_pagare' check (status in ('da_pagare', 'pagata')),
  paid_at         timestamptz,
  payment_method  text check (payment_method in ('contante', 'bonifico', 'carta')),
  document_reference text,                      -- rif./numero del documento, nessun upload per ora
  note            text,
  -- Promemoria di scadenza collegato in Agenda (origine_modulo, migrazione
  -- 0007): creato alla registrazione della fattura se ha una due_date,
  -- completato automaticamente quando la fattura viene segnata pagata.
  task_id         uuid references tasks(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint paid_is_coherent check (
    (status = 'pagata') = (paid_at is not null)
  )
);
create index idx_supplier_invoices_supplier on supplier_invoices(supplier_id);
create index idx_supplier_invoices_status on supplier_invoices(status);
create index idx_supplier_invoices_due_date on supplier_invoices(due_date);

comment on table supplier_invoices is
  'Fatture fornitori, inserimento manuale (§4 modulo 3). Sincronizzazione automatica via API Fatture in Cloud rimandata a quando Alessio attiva il piano Complete + OAuth2 — vedi §3.1 del brief.';

create trigger trg_supplier_invoices_updated_at before update on supplier_invoices
  for each row execute function set_updated_at();

alter table supplier_invoices enable row level security;
create policy supplier_invoices_titolare_all on supplier_invoices
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));
