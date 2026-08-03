-- =====================================================================
-- Borgo 58 · Migrazione 0018 — Proiezione Fiscale (§4 modulo 9, §3.7, §6)
-- =====================================================================
-- PRINCIPIO NON NEGOZIABILE (§6): tutto qui è STIMA INTERNA, mai un dato
-- fiscale certo. Il sistema assiste, non sostituisce Laura. Nessuna
-- automazione emette documenti o decide da sola su materie fiscali (§3.8).
--
-- Cosa è concreto e affidabile (regole matematiche deterministiche, §3.8):
--   - Deduzioni fiscali: categorizzazione spese, regola contanti 2025,
--     plafond rappresentanza, accumulo annuo. Ogni importo mostra PERCHÉ
--     è (in)deducibile — mai una scatola nera (§3.10).
--   - Catalogo strumenti fiscali (§3.7): tabella di riferimento condivisa
--     con il modulo 10 (che la popolerà), usata qui per categorizzare.
--
-- Cosa resta un SIMULATORE TRASPARENTE (non un numero "automatico"):
--   - IVA / IRES / IRAP: senza una contabilità IVA completa e un conto
--     economico live (il locale non è ancora aperto), un numero
--     "automatico" sarebbe una falsa certezza. Il simulatore usa input
--     espliciti e mostra le formule — onesto, non allucinato.
--
-- Accesso: SOLO titolare (§3.5). Multi-entità (§1): tutto taggato per entità.
-- =====================================================================

create type deduction_category as enum ('formazione', 'trasferta', 'rappresentanza', 'marketing', 'altro');
create type fiscal_payment_method as enum ('bonifico', 'carta', 'app', 'contante', 'altro_tracciato');
create type fiscal_tool_category as enum ('deduzione', 'credito_imposta', 'bando', 'incentivo');
create type fiscal_tool_status as enum ('attivo', 'scaduto', 'abolito', 'da_verificare');

-- ---------------------------------------------------------------------
-- Impostazioni fiscali: aliquote e ricavi stimati (soglie sempre
-- verificabili, non scritte una volta e dimenticate — §3.7)
-- ---------------------------------------------------------------------
create table fiscal_settings (
  entity_id                uuid primary key references entities(id) on delete cascade,
  annual_revenue_estimate  numeric(14,2),           -- base del plafond rappresentanza (§6)
  ires_rate                numeric(5,2) not null default 24.0,
  irap_rate                numeric(5,2) not null default 3.9,
  updated_at               timestamptz not null default now()
);
comment on table fiscal_settings is
  'Parametri del simulatore fiscale (aliquote IRES/IRAP, ricavi stimati per il plafond rappresentanza). Da verificare/aggiornare con Laura ogni anno.';

create trigger trg_fiscal_settings_updated_at before update on fiscal_settings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Spese deducibili (§6): categoria, metodo di pagamento, regola contanti
-- ---------------------------------------------------------------------
create table deductible_expenses (
  id                    uuid primary key default gen_random_uuid(),
  entity_id             uuid not null references entities(id) on delete restrict,
  category              deduction_category not null,
  description           text not null,
  amount                numeric(12,2) not null check (amount > 0),
  expense_date          date not null default current_date,
  payment_method        fiscal_payment_method not null,
  -- Esente dalla regola contanti 2025 (§6): biglietti di trasporto pubblico
  -- di linea, indennità chilometriche entro i limiti ordinari.
  exempt_from_cash_rule boolean not null default false,
  people_count          integer check (people_count is null or people_count > 0), -- rappresentanza: soglia 50€/persona
  document_reference    text,
  business_purpose      text,
  note                  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index idx_deductible_expenses_date on deductible_expenses(expense_date desc);
create index idx_deductible_expenses_entity_year on deductible_expenses(entity_id, expense_date);
comment on table deductible_expenses is
  'Spese documentate per il calcolo della deducibilità (§6). La deducibilità (%, plafond, regola contanti 2025) è calcolata lato app e mostrata con la sua motivazione — mai un numero senza spiegazione.';

create trigger trg_deductible_expenses_updated_at before update on deductible_expenses
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Catalogo strumenti fiscali (§3.7) — riferimento condiviso coi moduli 9/10
-- ---------------------------------------------------------------------
create table fiscal_tools (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  category            fiscal_tool_category not null,
  description         text,
  applicability       text,                 -- condizioni di applicabilità per Borgo 58
  status              fiscal_tool_status not null default 'da_verificare',
  normative_reference text,
  last_verified_date  date,
  in_use              boolean not null default false,   -- "lo sto usando: sì/no" (§3.7)
  deadline            date,
  -- Scadenza collegata → task in Agenda (§3.7), come le fatture fornitori.
  task_id             uuid references tasks(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table fiscal_tools is
  'Catalogo strumenti fiscali/agevolazioni (§3.7). Popolato a mano per ora; il modulo 10 (ricerca ricorrente) lo alimenterà automaticamente in futuro.';

create trigger trg_fiscal_tools_updated_at before update on fiscal_tools
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- RLS — tutto solo titolare (§3.5)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['fiscal_settings', 'deductible_expenses', 'fiscal_tools']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy %I on %I for all to authenticated using ((select is_titolare())) with check ((select is_titolare()));',
      t || '_titolare_all', t
    );
  end loop;
end $$;
