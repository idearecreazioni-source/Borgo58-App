-- =====================================================================
-- Borgo 58 · Migrazione 0025 — Raccolta propria (§3.17, HACCP)
-- =====================================================================
-- Erbe spontanee/prodotti autoraccolti da Alessio o dallo staff: nessuno
-- statuto normativo dedicato in Italia (diverso dai funghi, dove il D.P.R.
-- 376/1995 impone la certificazione di un micologo ASL) — zona grigia
-- normativa. Resta la responsabilità civile/penale generale sulla sicurezza
-- alimentare: da qui l'adozione di una prassi di identificazione verificata
-- come best practice volontaria.
--
-- Puro HACCP/tracciabilità — NON tocca il tracciamento di cassa (§3.4):
-- non c'è alcun documento fiscale coinvolto, non è un acquisto.
--
-- DA VALIDARE col consulente alimentare/tecnico HACCP (§6, §7) prima di un
-- uso in produzione — stesso principio delle attrezzature/soglie HACCP già
-- costruite (registri pronti, contenuto da validare).
--
-- Accesso: stesso pattern del resto di HACCP (§3.5) — staff fa immissione
-- operativa (registra una raccolta), titolare ha accesso pieno.
-- =====================================================================

create table foraged_items (
  id                       uuid primary key default gen_random_uuid(),
  species                  text not null,               -- specie raccolta
  harvest_date             date not null default current_date,
  harvest_location         text,                        -- luogo di raccolta
  forager_name             text,                        -- identità del raccoglitore
  identification_method    text,                        -- come è stata verificata l'identificazione
  contamination_risk_note  text,                         -- nota sul rischio di contaminazione (es. vicinanza a strade)
  internal_lot             text,                        -- lotto generato internamente
  ingredient_id            uuid references ingredients(id) on delete set null,  -- collegamento opzionale al Ricettario
  note                     text,
  created_at               timestamptz not null default now()
);
create index idx_foraged_items_date on foraged_items(harvest_date desc);
comment on table foraged_items is
  'Raccolta propria di erbe spontanee/prodotti autoraccolti (§3.17). Zona grigia normativa italiana: nessun documento fiscale, pura tracciabilità HACCP. DA VALIDARE con un consulente alimentare/tecnico HACCP prima di un uso in produzione.';

-- Lotto interno progressivo: data + iniziale specie + progressivo giornaliero,
-- generato di default se non specificato (comodo, non obbligatorio scriverlo
-- a mano). Semplice trigger, coerente con "lotto generato internamente".
create or replace function generate_foraged_lot()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  if new.internal_lot is not null then
    return new;
  end if;
  select count(*) + 1 into v_count
  from foraged_items
  where harvest_date = new.harvest_date;
  new.internal_lot := to_char(new.harvest_date, 'YYYYMMDD') || '-RP-' || lpad(v_count::text, 3, '0');
  return new;
end;
$$;

create trigger trg_generate_foraged_lot before insert on foraged_items
  for each row execute function generate_foraged_lot();

alter table foraged_items enable row level security;
create policy foraged_items_select_all on foraged_items for select to authenticated using (true);
create policy foraged_items_insert_all on foraged_items for insert to authenticated with check (true);
create policy foraged_items_upd_titolare on foraged_items for update to authenticated using ((select is_titolare())) with check ((select is_titolare()));
create policy foraged_items_del_titolare on foraged_items for delete to authenticated using ((select is_titolare()));
