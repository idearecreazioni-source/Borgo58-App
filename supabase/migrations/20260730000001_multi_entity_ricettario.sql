-- =====================================================================
-- Borgo 58 · Migrazione 0001 — Multi-entità + Modulo Ricettario
-- =====================================================================
-- Fonte: APP_Modulo_Ricettario_Progettazione.md (04/05/2026)
--        + vincolo multi-entità di APP_Borgo58_Brief_Tecnico_v2.md (§1, §4)
--
-- VINCOLO ARCHITETTURALE FONDAMENTALE (§1 del brief):
-- Il sistema tratta S.r.l.s. (ristorante) e Azienda Agricola (orto) come
-- DUE ENTITÀ FISCALI DISTINTE fin dal data model — partite IVA, regimi IVA
-- e contabilità separati — collegate da cessione intercompany fatturata.
-- La separazione è prevista da subito anche se l'agricola non è ancora attiva.
--
-- ⚠️ FISCALE — DA VALIDARE CON LA COMMERCIALISTA (Laura) PRIMA DELLA PRODUZIONE:
-- il costo di un ingrediente a produzione interna è il PREZZO DELLA CESSIONE
-- INTERCOMPANY (ciò che l'agricola fattura alla S.r.l.s.), non zero né il costo
-- di coltivazione. Questa migrazione predispone i campi; non automatizza calcoli
-- IVA/fiscali.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Estensioni
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- 1. Helper: aggiornamento automatico di updated_at
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Tipi enumerati
-- ---------------------------------------------------------------------

-- Entità fiscali
create type entity_type as enum ('srls', 'azienda_agricola');
create type vat_regime as enum (
  'ordinario',                 -- S.r.l.s. ristorante
  'forfettario',
  'regime_speciale_agricolo',  -- regime speciale IVA agricoltura (art. 34 DPR 633/72)
  'non_definito'               -- entità non ancora costituita
);

-- Fornitori
create type supplier_category as enum (
  'ortofrutta', 'carne', 'pesce', 'latticini', 'secco', 'bevande', 'altro'
);

-- Ingredienti
create type ingredient_category as enum (
  'verdura', 'frutta', 'carne_rossa', 'carne_bianca', 'pesce',
  'crostacei_molluschi', 'latticini', 'uova', 'farine_cereali', 'legumi',
  'olio_condimenti', 'spezie_aromi', 'secco_dispensa', 'bevande', 'altro'
);
create type unit_type as enum ('kg', 'l', 'pz', 'mazzo');
create type storage_type as enum (
  'frigo_0_4', 'frigo_4_8', 'freezer', 'dispensa', 'temperatura_ambiente'
);
-- Provenienza dell'ingrediente — distinzione multi-entità (§4 del brief)
create type ingredient_source as enum ('fornitore_esterno', 'produzione_interna');

-- Allergeni UE — 14 categorie obbligatorie (Reg. UE 1169/2011)
create type allergen as enum (
  'glutine', 'crostacei', 'uova', 'pesce', 'arachidi', 'soia', 'latte',
  'frutta_guscio', 'sedano', 'senape', 'sesamo', 'anidride_solforosa',
  'lupini', 'molluschi'
);

-- Stagionalità ingredienti (per mese) e ricette (per stagione)
create type month_code as enum (
  'gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic','tutto_anno'
);
create type season_code as enum ('primavera','estate','autunno','inverno','tutto_anno');

-- Storico prezzi
create type price_source as enum ('manuale', 'fattura', 'preventivo', 'cessione_interna');

-- Ricette
create type recipe_category as enum ('antipasto', 'primo', 'secondo', 'dolce');
create type recipe_status as enum ('in_sviluppo', 'attiva', 'in_pausa', 'archiviata');

-- Fasi di preparazione
create type step_phase as enum ('mise_en_place', 'cottura', 'finitura', 'impiattamento');
create type cooking_technique as enum (
  'tradizionale', 'sottovuoto', 'CBT', 'abbattitore', 'bagnomaria',
  'frittura', 'griglia', 'forno', 'crudo', 'altro'
);

-- ---------------------------------------------------------------------
-- 3. Tabelle
-- ---------------------------------------------------------------------

-- 3.1 ENTITÀ FISCALI — radice del modello multi-entità
create table entities (
  id            uuid primary key default gen_random_uuid(),
  entity_type   entity_type not null,
  name          text not null,               -- nome d'uso, es. "Borgo 58"
  legal_name    text,                         -- ragione sociale completa
  vat_number    text,                         -- partita IVA (null finché non costituita)
  tax_code      text,                         -- codice fiscale
  vat_regime    vat_regime not null default 'non_definito',
  is_active     boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table entities is
  'Entità fiscali distinte: S.r.l.s. (ristorante) e Azienda Agricola (orto). Separazione fiscale fondamentale — vedi §1 del brief tecnico.';

-- 3.2 FORNITORI — appartengono a una specifica entità
create table suppliers (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references entities(id) on delete restrict,
  name           text not null,
  contact_phone  text,
  contact_email  text,
  category       supplier_category,
  notes          text,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on column suppliers.entity_id is
  'Entità a cui il fornitore vende (il ristorante ha i suoi fornitori, l''agricola avrà i suoi).';

-- 3.3 INGREDIENTI — anagrafica centrale con estensione multi-entità
create table ingredients (
  id                        uuid primary key default gen_random_uuid(),
  entity_id                 uuid not null references entities(id) on delete restrict,
  name                      text not null,
  category                  ingredient_category not null,
  unit                      unit_type not null,
  current_price             numeric(12,4) not null default 0,   -- per unità, IVA esclusa
  source_type               ingredient_source not null default 'fornitore_esterno',
  supplier_id               uuid references suppliers(id) on delete set null,
  producer_entity_id        uuid references entities(id) on delete restrict,
  allergens                 allergen[] not null default '{}',
  seasonality               month_code[] not null default '{}',
  storage_type              storage_type,
  shelf_life_days           integer,
  waste_percentage_default  numeric(5,2) not null default 0,     -- % scarti standard
  haccp_receiving_temp      text,
  haccp_notes               text,
  active                    boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  -- Coerenza provenienza ⇄ entità/fornitore:
  -- interno  ⇒ deve avere producer_entity_id (l'agricola), niente fornitore esterno
  -- esterno  ⇒ niente producer_entity_id
  constraint ingredient_source_coherence check (
    (source_type = 'produzione_interna' and producer_entity_id is not null and supplier_id is null)
    or
    (source_type = 'fornitore_esterno' and producer_entity_id is null)
  )
);
comment on column ingredients.entity_id is
  'Entità proprietaria del record (nel Ricettario è sempre la S.r.l.s.: ogni ingrediente è un costo del ristorante).';
comment on column ingredients.source_type is
  'fornitore_esterno = acquistato da terzi · produzione_interna = ceduto dall''azienda agricola via cessione intercompany.';
comment on column ingredients.current_price is
  'Prezzo unitario IVA esclusa. Per produzione_interna = prezzo della cessione intercompany (ciò che l''agricola fattura al ristorante). DA VALIDARE CON LA COMMERCIALISTA.';
comment on column ingredients.producer_entity_id is
  'Entità produttrice (l''azienda agricola) quando source_type = produzione_interna.';

-- 3.4 STORICO PREZZI — timeline di ogni prezzo assunto dall'ingrediente
create table price_history (
  id             uuid primary key default gen_random_uuid(),
  ingredient_id  uuid not null references ingredients(id) on delete cascade,
  price          numeric(12,4) not null,
  supplier_id    uuid references suppliers(id) on delete set null,
  source         price_source not null default 'manuale',
  note           text,
  recorded_at    timestamptz not null default now()
);
comment on table price_history is
  'Append log dei prezzi. Alimentato da update_ingredient_price(). Base per grafici trend e alert variazione >10%.';

-- 3.5 CESSIONI INTERCOMPANY — cuore fiscale del rapporto agricola → ristorante
-- Predisposta da subito anche se l'agricola non è ancora attiva (§4 del brief).
create table intercompany_cessions (
  id                    uuid primary key default gen_random_uuid(),
  seller_entity_id      uuid not null references entities(id) on delete restrict,  -- agricola
  buyer_entity_id       uuid not null references entities(id) on delete restrict,  -- S.r.l.s.
  ingredient_id         uuid references ingredients(id) on delete set null,
  product_description   text not null,
  quantity              numeric(12,3) not null,
  unit                  unit_type not null,
  unit_price            numeric(12,4) not null,     -- prezzo di trasferimento, IVA esclusa
  vat_rate              numeric(5,2),               -- aliquota IVA sulla cessione
  total_amount          numeric(14,2),              -- imponibile (quantity × unit_price)
  cession_date          date not null,
  fiscal_document_type  text,                       -- rif. tipo documento (es. TD01/TD24) — non automatizzato
  invoice_reference     text,                       -- numero/rif. fattura elettronica
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint cession_distinct_entities check (seller_entity_id <> buyer_entity_id)
);
comment on table intercompany_cessions is
  'Cessioni fatturate agricola → S.r.l.s. Giustifica fiscalmente il costo degli ingredienti a produzione interna. Vuota finché l''agricola non è operativa. Emissione documenti fiscali NON automatizzata senza validazione della commercialista.';

-- 3.6 RICETTE (dominio ristorante — nessun entity_id, l'agricola non ha ricette)
create table recipes (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  category              recipe_category not null,
  subcategory           text,
  seasonality           season_code[] not null default '{}',
  portions_yield        integer not null default 1 check (portions_yield > 0),
  status                recipe_status not null default 'in_sviluppo',
  tags                  text[] not null default '{}',
  notes                 text,
  photo_url             text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
comment on table recipes is
  'Ricette del ristorante. Food cost, allergeni e tempi sono calcolati in tempo reale (viste v_recipe_costs / v_recipe_allergens), non memorizzati.';

-- 3.7 INGREDIENTI DELLA RICETTA (tabella ponte)
create table recipe_ingredients (
  id                uuid primary key default gen_random_uuid(),
  recipe_id         uuid not null references recipes(id) on delete cascade,
  ingredient_id     uuid not null references ingredients(id) on delete restrict,
  quantity          numeric(12,4) not null,            -- per ricetta base (non per porzione)
  unit              unit_type not null,
  waste_percentage  numeric(5,2),                       -- override su ingredients.waste_percentage_default
  prep_note         text,
  is_optional       boolean not null default false      -- guarnizione: esclusa dal food cost base
);
create index idx_recipe_ingredients_recipe on recipe_ingredients(recipe_id);
create index idx_recipe_ingredients_ingredient on recipe_ingredients(ingredient_id);

-- 3.8 FASI DI PREPARAZIONE
create table recipe_steps (
  id              uuid primary key default gen_random_uuid(),
  recipe_id       uuid not null references recipes(id) on delete cascade,
  step_number     integer not null,
  phase           step_phase not null,
  description     text not null,
  technique       cooking_technique,
  duration_min    integer,
  is_active_time  boolean not null default true,        -- true = richiede presidio
  temperature_c   text,
  is_haccp_ccp    boolean not null default false,       -- Punto Critico di Controllo
  haccp_limit     text,                                 -- limite critico
  haccp_action    text,                                 -- azione correttiva
  equipment       text,
  unique (recipe_id, step_number)
);
create index idx_recipe_steps_recipe on recipe_steps(recipe_id);

-- 3.9 MENU
create table menus (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  structure   text not null default '4-4-4-2',
  is_active   boolean not null default false,
  valid_from  date,
  valid_to    date,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Un solo menu attivo alla volta
create unique index uniq_single_active_menu on menus (is_active) where is_active;

-- 3.10 PIATTI NEL MENU (tabella ponte ricetta ⇄ menu con prezzo di vendita)
create table menu_items (
  id             uuid primary key default gen_random_uuid(),
  menu_id        uuid not null references menus(id) on delete cascade,
  recipe_id      uuid not null references recipes(id) on delete restrict,
  category       recipe_category not null,
  selling_price  numeric(12,2) not null,               -- IVA esclusa
  position       integer,
  unique (menu_id, recipe_id)
);
create index idx_menu_items_menu on menu_items(menu_id);

-- ---------------------------------------------------------------------
-- 4. Funzione: aggiornamento prezzo ingrediente con storico atomico
-- ---------------------------------------------------------------------
-- Aggiorna current_price e registra il nuovo prezzo in price_history in
-- un'unica operazione. Il food cost delle ricette si "aggiorna" perché è
-- derivato in tempo reale dalle viste.
create or replace function update_ingredient_price(
  p_ingredient_id uuid,
  p_new_price     numeric,
  p_source        price_source default 'manuale',
  p_note          text default null,
  p_supplier_id   uuid default null
)
returns void
language plpgsql
security invoker
as $$
begin
  update ingredients
     set current_price = p_new_price,
         updated_at = now()
   where id = p_ingredient_id;

  if not found then
    raise exception 'Ingrediente % inesistente', p_ingredient_id;
  end if;

  insert into price_history (ingredient_id, price, supplier_id, source, note)
  values (p_ingredient_id, p_new_price, p_supplier_id, p_source, p_note);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Viste derivate (food cost dinamico + allergeni auto-calcolati)
--    security_invoker = true → rispettano la RLS delle tabelle sottostanti
-- ---------------------------------------------------------------------

-- 5.1 Food cost per ricetta (base e per porzione)
-- costo ingrediente = quantity × current_price × (1 + waste%/100)
-- waste% = override della ricetta, altrimenti default dell'ingrediente
create view v_recipe_costs
with (security_invoker = true) as
select
  r.id as recipe_id,
  r.portions_yield,
  coalesce(sum(
    ri.quantity * i.current_price
      * (1 + coalesce(ri.waste_percentage, i.waste_percentage_default, 0) / 100.0)
  ) filter (where not ri.is_optional), 0)::numeric(14,4) as food_cost_base,
  (coalesce(sum(
    ri.quantity * i.current_price
      * (1 + coalesce(ri.waste_percentage, i.waste_percentage_default, 0) / 100.0)
  ) filter (where not ri.is_optional), 0) / r.portions_yield)::numeric(14,4) as food_cost_portion
from recipes r
left join recipe_ingredients ri on ri.recipe_id = r.id
left join ingredients i on i.id = ri.ingredient_id
group by r.id, r.portions_yield;

-- 5.2 Allergeni per ricetta (unione degli allergeni degli ingredienti usati)
create view v_recipe_allergens
with (security_invoker = true) as
select
  ri.recipe_id,
  array_agg(distinct a order by a) as allergens
from recipe_ingredients ri
join ingredients i on i.id = ri.ingredient_id
cross join lateral unnest(i.allergens) as a
group by ri.recipe_id;

-- 5.3 Economia dei piatti a menu (food cost %, margine)
create view v_menu_item_economics
with (security_invoker = true) as
select
  mi.id as menu_item_id,
  mi.menu_id,
  mi.recipe_id,
  mi.selling_price,
  vrc.food_cost_portion,
  case when mi.selling_price > 0
       then (vrc.food_cost_portion / mi.selling_price * 100)::numeric(6,2)
  end as food_cost_pct,
  (mi.selling_price - vrc.food_cost_portion)::numeric(12,2) as gross_margin
from menu_items mi
join v_recipe_costs vrc on vrc.recipe_id = mi.recipe_id;

-- ---------------------------------------------------------------------
-- 6. Trigger updated_at
-- ---------------------------------------------------------------------
create trigger trg_entities_updated_at before update on entities
  for each row execute function set_updated_at();
create trigger trg_suppliers_updated_at before update on suppliers
  for each row execute function set_updated_at();
create trigger trg_ingredients_updated_at before update on ingredients
  for each row execute function set_updated_at();
create trigger trg_cessions_updated_at before update on intercompany_cessions
  for each row execute function set_updated_at();
create trigger trg_recipes_updated_at before update on recipes
  for each row execute function set_updated_at();
create trigger trg_menus_updated_at before update on menus
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------
-- Modello di accesso ATTUALE: applicazione monoutente (Alessio) — vedi §3.3
-- del brief ("session-based, single user + pin"). Un unico utente autenticato
-- ha accesso completo. Le policy sono volutamente uniformi perché il modello di
-- accesso È uniforme.
-- ⚠️ DA RIVEDERE se in futuro si introduce la multiutenza: servirà scoping per
-- utente/ruolo (es. cucina vs amministrazione).
do $$
declare t text;
begin
  foreach t in array array[
    'entities','suppliers','ingredients','price_history','intercompany_cessions',
    'recipes','recipe_ingredients','recipe_steps','menus','menu_items'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true);',
      t || '_authenticated_all', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8. Dati fondamentali: le due entità fiscali
-- ---------------------------------------------------------------------
-- Nomi/P.IVA/regimi sono da completare da Alessio (l'agricola non è ancora
-- costituita). Struttura pronta fin da subito come richiesto dal brief.
insert into entities (entity_type, name, legal_name, vat_regime, is_active, notes)
values
  ('srls', 'Borgo 58', 'Borgo 58 S.r.l.s.', 'ordinario', true,
   'Società che gestisce il ristorante. Alessio socio unico e amministratore unico. Completare P.IVA e ragione sociale definitiva.'),
  ('azienda_agricola', 'Orto Borgo 58', null, 'regime_speciale_agricolo', false,
   'Azienda agricola separata per l''orto (aglione della Valdichiana, aglio triquetro, erba cipollina all''aglio). Non ancora costituita/operativa. Completare denominazione, P.IVA e regime al momento della costituzione.');
