-- =====================================================================
-- Borgo 58 · Migrazione 0012 — Magazzino (§4, modulo 4)
-- =====================================================================
-- Carico/scarico a lotti (per tracciare le scadenze — "cosa scade prima"),
-- soglie minime con alert, Lista della spesa con chiusura acquisto.
--
-- Carico automatico da fatture e scarico automatico da vendite dipendono
-- da moduli non ancora costruiti (Fatture Fornitori, Cassa — §3.2/§3.1 del
-- brief). Per ora tutto è manuale, com'è già previsto come fallback dal
-- brief stesso. Quando quei moduli esisteranno, si aggiungerà il carico/
-- scarico automatico SENZA toccare questo schema (stock_lots/stock_consumptions
-- restano la fonte di verità).
--
-- Stesso principio di sicurezza già usato nel Ricettario (§3.5): le tabelle
-- con dati economici (stock_lots.unit_cost, shopping_list_items.purchased_*)
-- sono raggiungibili in scrittura dallo staff SOLO tramite funzioni
-- SECURITY DEFINER che non accettano quei campi (o li rifiutano se non
-- titolare) — mai tramite RLS "a colonna", che in Postgres non esiste.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Soglia minima per ingrediente
-- ---------------------------------------------------------------------
alter table ingredients add column stock_minimum_threshold numeric(12,4);
comment on column ingredients.stock_minimum_threshold is
  'Soglia minima di giacenza per l''alert (§4 modulo 4). NULL = nessun alert tracciato per questo ingrediente.';

-- ---------------------------------------------------------------------
-- 2. Lotti di magazzino (carico) — un lotto per consegna, con scadenza
-- ---------------------------------------------------------------------
create table stock_lots (
  id                  uuid primary key default gen_random_uuid(),
  ingredient_id       uuid not null references ingredients(id) on delete restrict,
  supplier_id         uuid references suppliers(id) on delete set null,
  quantity_received   numeric(12,4) not null check (quantity_received > 0),
  quantity_remaining  numeric(12,4) not null check (quantity_remaining >= 0),
  unit_cost           numeric(12,4),          -- prezzo realmente pagato, IVA esclusa — dato economico
  expiry_date         date,
  received_at         timestamptz not null default now(),
  note                text,
  created_at          timestamptz not null default now(),

  constraint remaining_not_over_received check (quantity_remaining <= quantity_received)
);
create index idx_stock_lots_ingredient on stock_lots(ingredient_id);
create index idx_stock_lots_expiry on stock_lots(expiry_date) where quantity_remaining > 0;

comment on column stock_lots.unit_cost is
  'Prezzo pagato per questa consegna, IVA esclusa. Mai leggibile dallo staff — vedi stock_lots_display.';

-- ---------------------------------------------------------------------
-- 3. Scarichi (consumo/spreco/rettifica) — log, nessun dato economico
-- ---------------------------------------------------------------------
create table stock_consumptions (
  id             uuid primary key default gen_random_uuid(),
  ingredient_id  uuid not null references ingredients(id) on delete restrict,
  quantity       numeric(12,4) not null check (quantity > 0),
  reason         text not null default 'consumo' check (reason in ('consumo', 'spreco', 'rettifica')),
  note           text,
  created_at     timestamptz not null default now()
);
create index idx_stock_consumptions_ingredient on stock_consumptions(ingredient_id);

comment on table stock_consumptions is
  'Log di scarico manuale. Alimentato SOLO da record_stock_consumption(), che scala i lotti in ordine di scadenza (FEFO — First Expired First Out). Nessuna scrittura diretta prevista.';

-- ---------------------------------------------------------------------
-- 4. register_stock_delivery — unico punto di scrittura per un carico
-- ---------------------------------------------------------------------
-- SECURITY DEFINER: permette allo staff di registrare una consegna (senza
-- costo) pur non avendo alcun permesso diretto sulla tabella stock_lots.
-- Il titolare può passare anche unit_cost; se lo staff prova, viene rifiutato
-- qui — non è un controllo lato UI che si possa aggirare.
create or replace function register_stock_delivery(
  p_ingredient_id  uuid,
  p_quantity       numeric,
  p_supplier_id    uuid default null,
  p_expiry_date    date default null,
  p_note           text default null,
  p_unit_cost      numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La quantità deve essere maggiore di zero';
  end if;
  if p_unit_cost is not null and not is_titolare() then
    raise exception 'Solo il titolare può registrare il costo di un carico';
  end if;

  insert into stock_lots (ingredient_id, supplier_id, quantity_received, quantity_remaining, unit_cost, expiry_date, note)
  values (p_ingredient_id, p_supplier_id, p_quantity, p_quantity, p_unit_cost, p_expiry_date, p_note)
  returning id into v_id;

  return v_id;
end;
$$;
grant execute on function register_stock_delivery(uuid, numeric, uuid, date, text, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 5. record_stock_consumption — unico punto di scrittura per uno scarico
-- ---------------------------------------------------------------------
-- Scala i lotti in ordine di scadenza (i più vicini a scadere per primi),
-- così chi registra lo scarico indica solo "quanto ho usato di X", senza
-- dover scegliere manualmente il lotto — la giacenza per-lotto resta comunque
-- accurata per "cosa scade prima" (v_stock_levels).
create or replace function record_stock_consumption(
  p_ingredient_id  uuid,
  p_quantity       numeric,
  p_reason         text default 'consumo',
  p_note           text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining_to_deduct numeric := p_quantity;
  v_lot record;
  v_deduct numeric;
  v_available numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La quantità deve essere maggiore di zero';
  end if;
  if p_reason not in ('consumo', 'spreco', 'rettifica') then
    raise exception 'Motivo non valido: %', p_reason;
  end if;

  select coalesce(sum(quantity_remaining), 0) into v_available
  from stock_lots where ingredient_id = p_ingredient_id;

  if v_available < p_quantity then
    raise exception 'Giacenza insufficiente: disponibili %, richiesti %', v_available, p_quantity;
  end if;

  for v_lot in
    select id, quantity_remaining
    from stock_lots
    where ingredient_id = p_ingredient_id and quantity_remaining > 0
    order by expiry_date asc nulls last, received_at asc
    for update
  loop
    exit when v_remaining_to_deduct <= 0;
    v_deduct := least(v_lot.quantity_remaining, v_remaining_to_deduct);
    update stock_lots set quantity_remaining = quantity_remaining - v_deduct where id = v_lot.id;
    v_remaining_to_deduct := v_remaining_to_deduct - v_deduct;
  end loop;

  insert into stock_consumptions (ingredient_id, quantity, reason, note)
  values (p_ingredient_id, p_quantity, p_reason, p_note);
end;
$$;
grant execute on function record_stock_consumption(uuid, numeric, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. RLS sulle tabelle base — titolare pieno accesso, staff solo funzioni
-- ---------------------------------------------------------------------
alter table stock_lots enable row level security;
create policy stock_lots_titolare_all on stock_lots
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

alter table stock_consumptions enable row level security;
create policy stock_consumptions_select_all on stock_consumptions
  for select to authenticated using (true);
-- Nessuna policy insert/update/delete: si scrive solo tramite record_stock_consumption().

-- ---------------------------------------------------------------------
-- 7. Viste sicure per lo staff (senza costi)
-- ---------------------------------------------------------------------
-- Come recipe_ingredients_display: SECURITY DEFINER di default (nessuna
-- clausola security_invoker), così bypassa la RLS titolare-only di
-- stock_lots ma espone solo colonne non economiche.
-- PostgREST fa embedding automatico solo via foreign key reali: una vista non
-- può averne, quindi il nome del fornitore va appiattito qui (stesso motivo
-- per cui recipe_ingredients_display espone ingredient_name e non un embed).
create view stock_lots_display as
select
  sl.id, sl.ingredient_id, sl.supplier_id, s.name as supplier_name,
  sl.quantity_received, sl.quantity_remaining, sl.expiry_date, sl.received_at, sl.note
from stock_lots sl
left join suppliers s on s.id = sl.supplier_id;
grant select on stock_lots_display to authenticated;
comment on view stock_lots_display is
  'Lotti di magazzino senza unit_cost — sicura per lo staff (§3.5).';

-- Giacenza corrente per ingrediente, soglia minima, prossima scadenza.
-- Nessun dato economico: sicura per titolare e staff.
create view v_stock_levels as
select
  i.id as ingredient_id,
  i.name as ingredient_name,
  i.unit,
  i.stock_minimum_threshold,
  coalesce(sum(sl.quantity_remaining), 0)::numeric(12,4) as current_quantity,
  (i.stock_minimum_threshold is not null
    and coalesce(sum(sl.quantity_remaining), 0) < i.stock_minimum_threshold) as below_threshold,
  min(sl.expiry_date) filter (where sl.quantity_remaining > 0) as nearest_expiry
from ingredients i
left join stock_lots sl on sl.ingredient_id = i.id
where i.active
group by i.id, i.name, i.unit, i.stock_minimum_threshold;
grant select on v_stock_levels to authenticated;
comment on view v_stock_levels is
  'Giacenza per ingrediente (somma dei lotti), soglia minima e prossima scadenza. Nessun dato economico — sicura anche per lo staff.';

-- Anagrafica fornitori minima per lo staff: gli servono per registrare un
-- carico o un articolo in lista della spesa, ma suppliers resta titolare-only
-- (fa parte del gruppo di tabelle "money-relevant" per entity_id). Qui si
-- espone solo id/nome/categoria, niente di economico o di contatto.
create view suppliers_display as
select id, name, category from suppliers where active;
grant select on suppliers_display to authenticated;
comment on view suppliers_display is
  'Fornitori (solo id/nome/categoria) — sicura per lo staff, usata dai form di Magazzino.';

-- ---------------------------------------------------------------------
-- 8. Lista della spesa
-- ---------------------------------------------------------------------
create table shopping_list_items (
  id                  uuid primary key default gen_random_uuid(),
  ingredient_id       uuid references ingredients(id) on delete set null,
  custom_name         text,                     -- per articoli non alimentari/economato
  supplier_id         uuid references suppliers(id) on delete set null,
  quantity_needed     numeric(12,4),
  unit                unit_type,
  source              text not null default 'manuale' check (source in ('manuale', 'soglia_minima')),
  status              text not null default 'da_comprare' check (status in ('da_comprare', 'acquistato')),
  note                text,
  purchased_amount    numeric(12,2),            -- dato economico, solo titolare
  payment_method      text check (payment_method in ('contante', 'bonifico', 'carta')),
  document_reference  text,
  purchased_at        timestamptz,
  created_at          timestamptz not null default now(),

  constraint item_has_a_name check (ingredient_id is not null or custom_name is not null)
);
create index idx_shopping_list_status on shopping_list_items(status);

comment on table shopping_list_items is
  'Lista della spesa (§4 modulo 4): articoli alimentari (ingredient_id) o generici/economato (custom_name), tutti collegati all''Anagrafica Fornitori esistente (suppliers). La chiusura economica (purchased_amount/payment_method/document_reference) resta riservata al titolare. NON genera ancora un''uscita di cassa (modulo 5) né si aggancia a Fatture Fornitori (modulo 3): nessuno dei due esiste ancora — il dato resta qui in attesa di quei moduli.';

alter table shopping_list_items enable row level security;
create policy shopping_list_items_titolare_all on shopping_list_items
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- Stesso motivo di stock_lots_display: nomi ingrediente/fornitore appiattiti,
-- niente embed via foreign key (una vista non ne ha).
create view shopping_list_display as
select
  sli.id, sli.ingredient_id, i.name as ingredient_name, i.unit as ingredient_unit,
  sli.custom_name, sli.supplier_id, s.name as supplier_name,
  sli.quantity_needed, sli.unit, sli.source, sli.status, sli.note, sli.created_at,
  (sli.status = 'acquistato') as is_purchased
from shopping_list_items sli
left join ingredients i on i.id = sli.ingredient_id
left join suppliers s on s.id = sli.supplier_id;
grant select on shopping_list_display to authenticated;
comment on view shopping_list_display is
  'Lista della spesa senza importi/metodo di pagamento — sicura per lo staff (§3.5).';

-- add_shopping_list_item: entrambi i ruoli, mai campi economici.
create or replace function add_shopping_list_item(
  p_ingredient_id    uuid default null,
  p_custom_name      text default null,
  p_supplier_id      uuid default null,
  p_quantity_needed  numeric default null,
  p_unit             unit_type default null,
  p_note             text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_ingredient_id is null and (p_custom_name is null or btrim(p_custom_name) = '') then
    raise exception 'Serve un ingrediente o un nome articolo';
  end if;

  insert into shopping_list_items (ingredient_id, custom_name, supplier_id, quantity_needed, unit, note)
  values (p_ingredient_id, nullif(btrim(p_custom_name), ''), p_supplier_id, p_quantity_needed, p_unit, p_note)
  returning id into v_id;

  return v_id;
end;
$$;
grant execute on function add_shopping_list_item(uuid, text, uuid, numeric, unit_type, text) to authenticated;

-- add_below_threshold_items: popola la lista con gli ingredienti sotto soglia
-- non già presenti come "da comprare" — azione esplicita (bottone), non un
-- automatismo silenzioso in background (coerente col principio del brief:
-- nessuna interpretazione automatica salvata senza un'azione umana).
create or replace function add_below_threshold_items()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source)
  select
    v.ingredient_id,
    greatest(v.stock_minimum_threshold - v.current_quantity, 0),
    v.unit,
    'soglia_minima'
  from v_stock_levels v
  where v.below_threshold
    and not exists (
      select 1 from shopping_list_items sli
      where sli.ingredient_id = v.ingredient_id and sli.status = 'da_comprare'
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
grant execute on function add_below_threshold_items() to authenticated;

-- remove_shopping_list_item: solo articoli non ancora chiusi (storico immutabile).
create or replace function remove_shopping_list_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from shopping_list_items where id = p_item_id and status = 'da_comprare';
end;
$$;
grant execute on function remove_shopping_list_item(uuid) to authenticated;

-- close_shopping_list_item: SOLO titolare. Chiude l'acquisto con importo
-- reale e metodo di pagamento, e se l'articolo è un ingrediente crea anche
-- il lotto di magazzino corrispondente (la spesa diventa automaticamente
-- giacenza) — p_quantity_received permette di correggere la quantità se
-- diversa da quella richiesta.
create or replace function close_shopping_list_item(
  p_item_id            uuid,
  p_purchased_amount   numeric,
  p_payment_method     text,
  p_quantity_received  numeric default null,
  p_document_reference text default null,
  p_expiry_date        date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item shopping_list_items;
  v_qty numeric;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare può chiudere un acquisto con importo e metodo di pagamento';
  end if;
  if p_payment_method not in ('contante', 'bonifico', 'carta') then
    raise exception 'Metodo di pagamento non valido: %', p_payment_method;
  end if;

  select * into v_item from shopping_list_items where id = p_item_id;
  if v_item.id is null then
    raise exception 'Articolo non trovato';
  end if;
  if v_item.status = 'acquistato' then
    raise exception 'Articolo già chiuso';
  end if;

  update shopping_list_items
  set status = 'acquistato',
      purchased_amount = p_purchased_amount,
      payment_method = p_payment_method,
      document_reference = p_document_reference,
      purchased_at = now()
  where id = p_item_id;

  v_qty := coalesce(p_quantity_received, v_item.quantity_needed);

  if v_item.ingredient_id is not null and v_qty is not null and v_qty > 0 then
    insert into stock_lots (ingredient_id, supplier_id, quantity_received, quantity_remaining, unit_cost, expiry_date, note)
    values (
      v_item.ingredient_id,
      v_item.supplier_id,
      v_qty,
      v_qty,
      p_purchased_amount / v_qty,
      p_expiry_date,
      'Da lista della spesa'
    );
  end if;
end;
$$;
grant execute on function close_shopping_list_item(uuid, numeric, text, numeric, text, date) to authenticated;
