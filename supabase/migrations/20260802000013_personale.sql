-- =====================================================================
-- Borgo 58 · Migrazione 0019 — Personale & Buste Paga (§4 mod. 11, §6)
-- =====================================================================
-- DUE PRINCIPI DEL BRIEF, non dettagli:
--   1. Il sistema NON calcola le buste paga (compito del Consulente del
--      Lavoro). Questo è un ARCHIVIO: conserva l'importo/riferimento della
--      busta già calcolata altrove, non la produce.
--   2. Materie sensibili (buste paga, regime mance): il sistema assiste e
--      segnala, non decide da solo (§3.8, §6). La verifica dei tetti mance
--      mostra i numeri; la scelta resta umana.
--
-- Accesso: SOLO titolare (§3.5) — "no self-service, no coadiuvanti
-- familiari per ora". Nessun accesso staff a nessuna tabella qui.
--
-- File fisici (buste paga PDF, documenti): per ora si registra solo il
-- riferimento/metadati, nessun upload né estrazione AI (quella è un modulo
-- AI, §3.13, da fare quando si decide l'integrazione LLM). Come per le
-- video ricette: prima il dato strutturato, l'AI dopo.
-- =====================================================================

create type employee_status as enum ('attivo', 'cessato');
create type contract_type as enum ('indeterminato', 'determinato', 'apprendistato', 'stagionale', 'extra', 'altro');
create type leave_type as enum ('ferie', 'permesso', 'malattia', 'altro');
create type compliance_doc_type as enum (
  'contratto', 'idoneita_sanitaria', 'formazione_haccp', 'formazione_sicurezza',
  'documento_identita', 'permesso_soggiorno', 'altro'
);

-- ---------------------------------------------------------------------
-- Anagrafica personale
-- ---------------------------------------------------------------------
create table employees (
  id                 uuid primary key default gen_random_uuid(),
  entity_id          uuid not null references entities(id) on delete restrict,
  first_name         text not null,
  last_name          text not null,
  role               text,                    -- mansione
  contract_type      contract_type,
  hire_date          date,
  end_date           date,
  status             employee_status not null default 'attivo',
  phone              text,
  email              text,
  -- Regime mance (§6): reddito da lavoro dipendente dell'anno precedente,
  -- per verificare la soglia 75.000€ e il tetto del 30%.
  prior_year_income  numeric(12,2),
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index idx_employees_status on employees(status);
create trigger trg_employees_updated_at before update on employees
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Documenti di compliance con scadenza → promemoria in Agenda
-- ---------------------------------------------------------------------
create table employee_documents (
  id                  uuid primary key default gen_random_uuid(),
  employee_id         uuid not null references employees(id) on delete cascade,
  doc_type            compliance_doc_type not null,
  description         text,
  issue_date          date,
  expiry_date         date,
  document_reference  text,          -- dove si trova il file fisico/esterno
  task_id             uuid references tasks(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_employee_documents_employee on employee_documents(employee_id);
create index idx_employee_documents_expiry on employee_documents(expiry_date);
create trigger trg_employee_documents_updated_at before update on employee_documents
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Ferie / permessi / malattia
-- ---------------------------------------------------------------------
create table employee_leaves (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references employees(id) on delete cascade,
  leave_type   leave_type not null,
  start_date   date not null,
  end_date     date not null,
  days         numeric(5,1),
  note         text,
  created_at   timestamptz not null default now(),

  constraint leave_dates_ordered check (end_date >= start_date)
);
create index idx_employee_leaves_employee on employee_leaves(employee_id);

-- ---------------------------------------------------------------------
-- Archivio buste paga (NON calcolate qui — solo conservate)
-- ---------------------------------------------------------------------
create table payslips (
  id                  uuid primary key default gen_random_uuid(),
  employee_id         uuid not null references employees(id) on delete cascade,
  period_month        date not null,           -- primo giorno del mese di competenza
  gross_amount        numeric(12,2),
  net_amount          numeric(12,2),
  document_reference  text,
  note                text,
  created_at          timestamptz not null default now(),

  unique (employee_id, period_month)
);
create index idx_payslips_employee on payslips(employee_id);
comment on table payslips is
  'Archivio buste paga già calcolate dal Consulente del Lavoro. Il sistema non le calcola (§4 mod. 11): conserva importi e riferimento.';

-- ---------------------------------------------------------------------
-- Mance: raccolta (chiude il monte lasciato aperto in Cassa, §3.4) +
-- distribuzione mensile con verifica del regime (§6)
-- ---------------------------------------------------------------------
create table tips_collected (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references entities(id) on delete restrict,
  amount         numeric(12,2) not null check (amount > 0),
  collected_date date not null default current_date,
  note           text,
  created_at     timestamptz not null default now()
);
create index idx_tips_collected_date on tips_collected(collected_date desc);
comment on table tips_collected is
  'Raccolta mance clienti (§3.4: raccolta quotidiana → monte accumulato → distribuzione mensile qui). Consolidata nel modulo Personale insieme alla distribuzione.';

create table tip_distributions (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references entities(id) on delete restrict,
  period_month   date not null,
  total_amount   numeric(12,2) not null check (total_amount >= 0),
  distributed_at timestamptz not null default now(),
  note           text
);

create table tip_distribution_lines (
  id               uuid primary key default gen_random_uuid(),
  distribution_id  uuid not null references tip_distributions(id) on delete cascade,
  employee_id      uuid not null references employees(id) on delete restrict,
  amount           numeric(12,2) not null check (amount >= 0)
);
create index idx_tip_distribution_lines_distribution on tip_distribution_lines(distribution_id);
create index idx_tip_distribution_lines_employee on tip_distribution_lines(employee_id);

-- Monte mance: raccolto − distribuito (riconciliazione §3.4).
create view v_tips_balance
with (security_invoker = true) as
select
  e.id as entity_id,
  e.name as entity_name,
  coalesce((select sum(amount) from tips_collected t where t.entity_id = e.id), 0)::numeric(14,2) as collected,
  coalesce((
    select sum(d.total_amount) from tip_distributions d where d.entity_id = e.id
  ), 0)::numeric(14,2) as distributed,
  (
    coalesce((select sum(amount) from tips_collected t where t.entity_id = e.id), 0)
    - coalesce((select sum(d.total_amount) from tip_distributions d where d.entity_id = e.id), 0)
  )::numeric(14,2) as balance
from entities e;
grant select on v_tips_balance to authenticated;
comment on view v_tips_balance is
  'Monte mance non ancora distribuito = raccolto − distribuito. Riconciliazione raccolto=distribuito (§3.4).';

-- Mance distribuite per dipendente nell'anno: base per il tetto 30% (§6).
create view v_tips_per_employee_year
with (security_invoker = true) as
select
  l.employee_id,
  extract(year from d.period_month)::int as year,
  sum(l.amount)::numeric(14,2) as total_received
from tip_distribution_lines l
join tip_distributions d on d.id = l.distribution_id
group by l.employee_id, extract(year from d.period_month);
grant select on v_tips_per_employee_year to authenticated;

-- ---------------------------------------------------------------------
-- RLS — tutto solo titolare (§3.5)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'employees', 'employee_documents', 'employee_leaves', 'payslips',
    'tips_collected', 'tip_distributions', 'tip_distribution_lines'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy %I on %I for all to authenticated using ((select is_titolare())) with check ((select is_titolare()));',
      t || '_titolare_all', t
    );
  end loop;
end $$;
