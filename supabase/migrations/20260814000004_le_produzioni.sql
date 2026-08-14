-- =====================================================================
-- Le Produzioni (Blocco 2 del mandato «dal magazzino alla rotta economica»)
-- =====================================================================
-- Registrare i semilavorati fatti in cucina. Contesto vincolante, dal
-- mandato: **Alessio scompone sempre** — semilavorato e' tutto cio' che
-- ha richiesto manipolazione (il soffritto e il macinato cotto del ragu'
-- sono semilavorati, la passata comprata e' un ingrediente). L'albero
-- sara' profondo di proposito, e il database gia' lo regge.
--
-- ---------------------------------------------------------------------
-- 1. DOVE STA UN RAGU' IN MAGAZZINO
-- ---------------------------------------------------------------------
-- Una preparazione e' una **ricetta**, e i lotti stanno sugli
-- **ingredienti**: finora un semilavorato non poteva esistere in cella.
--
-- Si da' a ogni preparazione prodotta un ingrediente proprio
-- (`ingredients.preparazione_id`), che nasce da solo alla prima
-- produzione. Non e' un doppione dell'anagrafica: e' il **posto dove
-- mettere i lotti**, e serve a far funzionare senza modifiche tutto cio'
-- che gia' guarda il magazzino — la giacenza, lo scadenziario, il FEFO,
-- la rintracciabilita'.
--
-- ⚠️ **Non deve inquinare cio' che si compra.** Un ragu' non si ordina a
--    un fornitore: nasce senza scorta minima (quindi non entra **mai**
--    nella lista della spesa), senza fornitore, con gli avvisi di rincaro
--    spenti, e marcato `produzione_interna`. Sono quattro conseguenze di
--    un fatto solo, e ognuna e' verificata.
--
-- ---------------------------------------------------------------------
-- 2. I DUE NUMERI, CHE SONO IL CUORE DEL BLOCCO
-- ---------------------------------------------------------------------
-- La versione minima sono **due numeri, non uno**: quanto ne e' uscito
-- **e** quante dosi di ricetta si sono fatte («una volta», «doppia»,
-- «meta'»).
--
-- ⚠️ Con un numero solo non si distingue **il calo dalla mezza dose**: 4 kg
--    di ragu' possono essere una dose andata male o mezza dose venuta
--    benissimo, e sono due fatti opposti. Distinguere e' tutto il valore
--    di questo blocco — e' da li' che nasce la resa vera, e dalla resa
--    vera il food cost vero.
--
-- ---------------------------------------------------------------------
-- 3. IL COSTO SI CONGELA
-- ---------------------------------------------------------------------
-- La produzione scarica gli ingredienti dai lotti (FEFO, la stessa regola
-- del Blocco 1) e crea **un lotto del semilavorato col suo costo**, che
-- e' la somma di cio' che e' uscito davvero dalla cella.
--
-- Quel costo **e' fermo**: i rincari di domani toccano le produzioni
-- future, mai il ragu' gia' in frigo. E' lo stesso principio del prezzo
-- del coperto fotografato sul conto e del costo degli omaggi.
--
-- ⚠️ **La cascata**: se il ragu' contiene il soffritto e il soffritto ha
--    un suo lotto, il ragu' non riesplode le verdure — consuma il
--    soffritto **al costo che aveva quel giorno**. E' cosi' che un calo
--    di resa a un livello basso arriva fino al piatto invece di sparire.
--
-- ⚠️ **La regola opposta, e vale quanto la prima**: se il soffritto NON ha
--    lotti (non e' mai stato prodotto, o e' finito), si esplode fino alla
--    materia prima come faceva il Blocco 1. Cosi' una cucina che non
--    registra ogni passaggio continua a funzionare, invece di bloccarsi
--    su un semilavorato che non esiste in cella.
--
-- ⚠️ **E lo stesso interruttore vale per i conti**: `fabbisogno_conto`
--    smette di esplodere una preparazione che ha lotti propri. Era
--    dichiarato nel riepilogo del Blocco 1 come l'aggancio da fare qui;
--    senza, servire un piatto scaricherebbe **due volte** le stesse
--    verdure — una alla produzione e una alla vendita.
--
-- ---------------------------------------------------------------------
-- 4. NON SI INVENTA, E NON SI BLOCCA
-- ---------------------------------------------------------------------
-- Stessa disciplina del Blocco 1: se la giacenza non basta si toglie
-- quello che c'e' e si **dichiara** il mancante; la produzione non si
-- ferma, perche' il ragu' e' gia' sul fuoco e fermarlo non lo fa tornare
-- indietro.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. L'ingrediente che tiene i lotti di una preparazione
-- ---------------------------------------------------------------------
alter table ingredients
  add column if not exists preparazione_id uuid references recipes(id) on delete restrict;

comment on column ingredients.preparazione_id is
  'Se valorizzato, questa riga non e'' un ingrediente comprato: e'' il posto dove vivono i lotti di una preparazione fatta in cucina. Nasce da sola alla prima produzione.';

-- Una preparazione, un solo posto dove mettere i suoi lotti.
create unique index if not exists uq_ingrediente_preparazione
  on ingredients (preparazione_id) where preparazione_id is not null;

-- ---------------------------------------------------------------------
-- 2. Le produzioni
-- ---------------------------------------------------------------------
create table if not exists produzioni (
  id                 uuid primary key default gen_random_uuid(),
  recipe_id          uuid not null references recipes(id) on delete restrict,
  ingredient_id      uuid not null references ingredients(id) on delete restrict,
  lotto_id           uuid references stock_lots(id) on delete set null,
  -- I DUE NUMERI.
  dosi               numeric(12,4) not null check (dosi > 0),
  quantita_ottenuta  numeric(14,4) not null check (quantita_ottenuta > 0),
  unita              text,
  -- Quanto SAREBBE dovuto uscire secondo la ricetta: serve a misurare la
  -- resa vera, che e' il numero che nessuno ha mai avuto.
  resa_attesa        numeric(14,4),
  costo              numeric(14,4),
  scadenza           date,
  note               text,
  creato_da          uuid,
  creato_il          timestamptz not null default now()
);

comment on table produzioni is
  'Ogni volta che in cucina si fa un semilavorato. Due numeri per costruzione — le dosi e quanto ne e'' uscito — perche'' con uno solo il calo e la mezza dose sono indistinguibili.';
comment on column produzioni.costo is
  'Quanto e'' costata la materia prima uscita dalla cella per questa produzione, ai prezzi dei lotti toccati. Fermo per sempre: i rincari di domani toccano le produzioni future.';

create index if not exists idx_produzioni_quando on produzioni (creato_il desc);
create index if not exists idx_produzioni_ricetta on produzioni (recipe_id, creato_il desc);

alter table produzioni enable row level security;

-- La registrazione serve in cucina, il costo no: lo staff scrive
-- (attraverso la funzione) e legge dalla vista senza costi.
drop policy if exists produzioni_titolare on produzioni;
create policy produzioni_titolare on produzioni
  for all using ((select is_titolare())) with check ((select is_titolare()));

-- Vista `_display`: security definer senza `security_invoker`, quindi
-- scavalca la RLS ma espone solo colonne operative (pattern §6).
create or replace view produzioni_display as
  select p.id,
         p.recipe_id,
         r.name        as preparazione,
         p.ingredient_id,
         p.dosi,
         p.quantita_ottenuta,
         p.unita,
         p.resa_attesa,
         p.scadenza,
         p.note,
         p.creato_il
    from produzioni p
    left join recipes r on r.id = p.recipe_id;

comment on view produzioni_display is
  'Le produzioni senza il costo: e'' cio'' che serve in cucina. Il costo lo vede il titolare sulla tabella vera.';

-- ---------------------------------------------------------------------
-- 3. Le anomalie valgono anche per una produzione
-- ---------------------------------------------------------------------
-- La tabella nata col Blocco 1 va bene, cambia solo chi puo' esserne
-- l'origine: un conto o una produzione, mai tutti e due, mai nessuno.
alter table anomalie_scarico alter column order_id drop not null;
alter table anomalie_scarico
  add column if not exists produzione_id uuid references produzioni(id) on delete cascade;

alter table anomalie_scarico drop constraint if exists anomalia_ha_un_origine;
alter table anomalie_scarico add constraint anomalia_ha_un_origine
  check ((order_id is not null) <> (produzione_id is not null));

-- ---------------------------------------------------------------------
-- 4. E i movimenti sanno da quale produzione vengono
-- ---------------------------------------------------------------------
alter table stock_consumptions
  add column if not exists produzione_id uuid references produzioni(id) on delete set null;

create index if not exists idx_stock_consumptions_produzione
  on stock_consumptions (produzione_id) where produzione_id is not null;

-- ---------------------------------------------------------------------
-- 5. Il posto dove mettere i lotti di una preparazione
-- ---------------------------------------------------------------------
create or replace function ingrediente_di_preparazione(p_recipe_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_ric  recipes%rowtype;
  v_id   uuid;
  v_ente uuid;
begin
  select * into v_ric from recipes where id = p_recipe_id;
  if v_ric.id is null then
    raise exception 'Preparazione non trovata';
  end if;
  if v_ric.recipe_type <> 'preparazione' then
    raise exception 'Solo una preparazione si puo'' produrre: «%» e'' un piatto finito', v_ric.name;
  end if;

  select id into v_id from ingredients where preparazione_id = p_recipe_id;
  if v_id is not null then return v_id; end if;

  select id into v_ente from entities where entity_type = 'srls';

  -- ⚠️ Nasce SENZA scorta minima, senza fornitore e con gli avvisi di
  --    rincaro spenti: un semilavorato non si compra, e finire nella
  --    lista della spesa o nella sorveglianza dei prezzi vorrebbe dire
  --    proporre di ordinare a un fornitore una cosa che si fa in cucina.
  --
  -- ⚠️ **`source_type` resta `fornitore_esterno`, e non e' una svista.**
  --    Il valore `produzione_interna` in questo progetto NON vuol dire
  --    «fatto in casa»: vuol dire «prodotto dall'azienda agricola», e un
  --    vincolo del database pretende infatti l'entita' produttrice
  --    (`ingredient_source_coherence`) perche' da li' passa la cessione
  --    intercompany. Un soffritto non c'entra niente con l'orto:
  --    usare quel valore lo farebbe entrare in una contabilita' che non
  --    e' la sua. Cio' che distingue un semilavorato e'
  --    `preparazione_id`, che e' esplicito e non ha altri significati.
  insert into ingredients (
    entity_id, name, category, unit, current_price, source_type,
    preparazione_id, avvisa_rincari, alimentare, stock_minimum_threshold
  ) values (
    v_ente,
    v_ric.name,
    'altro'::ingredient_category,
    coalesce(v_ric.yield_unit, 'kg'::unit_type),
    0,
    'fornitore_esterno'::ingredient_source,
    p_recipe_id,
    false,
    true,
    null
  )
  returning id into v_id;

  return v_id;
end;
$funzione$;

revoke all on function ingrediente_di_preparazione(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Cosa serve per fare N dosi di una preparazione
-- ---------------------------------------------------------------------
-- Stessa forma di `fabbisogno_conto`, con l'interruttore in piu': una
-- sotto-preparazione che ha lotti propri NON si esplode — si consuma.
create or replace function fabbisogno_preparazione(p_recipe_id uuid, p_dosi numeric)
returns table (ingredient_id uuid, quantita numeric)
language sql
stable
security definer
set search_path = public
as $funzione$
  with recursive esplosione as (
    select ri.ingredient_id,
           ri.component_recipe_id,
           (p_dosi * ri.quantity)::numeric as qta,
           ri.waste_percentage,
           ri.is_optional,
           1 as depth
      from recipe_ingredients ri
     where ri.recipe_id = p_recipe_id
    union all
    select ri2.ingredient_id,
           ri2.component_recipe_id,
           (e.qta * ri2.quantity / nullif(comp.yield_quantity, 0)),
           ri2.waste_percentage,
           (e.is_optional or ri2.is_optional),
           e.depth + 1
      from esplosione e
      join recipes comp           on comp.id = e.component_recipe_id
      join recipe_ingredients ri2 on ri2.recipe_id = e.component_recipe_id
     where e.component_recipe_id is not null
       and e.depth < 10
       -- L'INTERRUTTORE: si esplode solo se quel semilavorato non esiste
       -- in cella. Se esiste, lo si consuma (sotto), col costo di quel
       -- giorno.
       and not exists (
         select 1
           from ingredients pi
           join stock_lots sl on sl.ingredient_id = pi.id
          where pi.preparazione_id = e.component_recipe_id
            and sl.quantity_remaining > 0
       )
  ),
  -- a) la materia prima
  materia as (
    select e.ingredient_id,
           sum(e.qta * (1 + coalesce(e.waste_percentage, i.waste_percentage_default, 0) / 100.0)) as quantita
      from esplosione e
      join ingredients i on i.id = e.ingredient_id
     where e.ingredient_id is not null
       and not e.is_optional
       and e.qta is not null
     group by e.ingredient_id
  ),
  -- b) i semilavorati che ci sono davvero, presi come sono
  semilavorati as (
    select pi.id as ingredient_id, sum(e.qta) as quantita
      from esplosione e
      join ingredients pi on pi.preparazione_id = e.component_recipe_id
     where e.component_recipe_id is not null
       and not e.is_optional
       and e.qta is not null
       and exists (
         select 1 from stock_lots sl
          where sl.ingredient_id = pi.id and sl.quantity_remaining > 0
       )
     group by pi.id
  )
  select ingredient_id, sum(quantita)::numeric(14,4)
    from (select * from materia union all select * from semilavorati) tutto
   group by ingredient_id
  having sum(quantita) > 0;
$funzione$;

revoke all on function fabbisogno_preparazione(uuid, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Registrare una produzione — quattro tabelle, un gesto (B4)
-- ---------------------------------------------------------------------
create or replace function registra_produzione(
  p_recipe_id         uuid,
  p_dosi              numeric,
  p_quantita_ottenuta numeric,
  p_scadenza          date default null,
  p_note              text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_ric        recipes%rowtype;
  v_ingr       uuid;
  v_prod       uuid;
  v_lotto      uuid;
  v_riga       record;
  v_lot        record;
  v_da         numeric;
  v_tolto      numeric;
  v_costo      numeric := 0;   -- il totale della produzione
  v_costo_riga numeric;        -- quanto e' costato QUESTO ingrediente
  v_quota      numeric;
  v_mancanti   integer := 0;
begin
  -- Registrare una produzione e' compito della cucina: il controllo e'
  -- che ci sia un utente vero, non che sia il titolare. Il COSTO pero'
  -- non torna indietro da qui — vive sul lotto, che lo staff non legge.
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_ric from recipes where id = p_recipe_id;
  if v_ric.id is null then raise exception 'Preparazione non trovata'; end if;
  if p_dosi is null or p_dosi <= 0 then
    raise exception 'Quante dosi hai fatto? Il numero serve: senza, un calo e mezza dose sono la stessa cosa';
  end if;
  if p_quantita_ottenuta is null or p_quantita_ottenuta <= 0 then
    raise exception 'Quanto ne e'' uscito? Serve il peso vero, non quello della ricetta';
  end if;

  v_ingr := ingrediente_di_preparazione(p_recipe_id);

  insert into produzioni (
    recipe_id, ingredient_id, dosi, quantita_ottenuta, unita,
    resa_attesa, scadenza, note, creato_da
  ) values (
    p_recipe_id, v_ingr, p_dosi, p_quantita_ottenuta,
    coalesce(v_ric.yield_unit::text, 'kg'),
    case when v_ric.yield_quantity is not null then v_ric.yield_quantity * p_dosi end,
    p_scadenza, p_note, auth.uid()
  )
  returning id into v_prod;

  -- Lo scarico, dai lotti che scadono prima (FEFO).
  for v_riga in
    select f.ingredient_id, f.quantita from fabbisogno_preparazione(p_recipe_id, p_dosi) f
  loop
    v_da := v_riga.quantita;
    v_tolto := 0;
    v_costo_riga := 0;

    for v_lot in
      select id, quantity_remaining, unit_cost
        from stock_lots
       where ingredient_id = v_riga.ingredient_id and quantity_remaining > 0
       order by expiry_date asc nulls last, received_at asc
       for update
    loop
      exit when v_da <= 0;
      v_quota := least(v_lot.quantity_remaining, v_da);
      update stock_lots set quantity_remaining = quantity_remaining - v_quota where id = v_lot.id;
      v_tolto      := v_tolto + v_quota;
      v_costo_riga := v_costo_riga + v_quota * coalesce(v_lot.unit_cost, 0);
      v_da         := v_da - v_quota;
    end loop;

    v_costo := v_costo + v_costo_riga;

    if v_tolto > 0 then
      insert into stock_consumptions
        (ingredient_id, quantity, reason, note, produzione_id, quantita_richiesta, costo)
      values
        (v_riga.ingredient_id, v_tolto, 'consumo',
         'Produzione: ' || v_ric.name, v_prod, v_riga.quantita,
         round(v_costo_riga, 4));
    end if;

    -- Non si inventa e non si blocca: il semilavorato e' gia' fatto.
    if v_da > 0.00005 then
      v_mancanti := v_mancanti + 1;
      insert into anomalie_scarico
        (produzione_id, ingredient_id, tipo, descrizione, quantita_mancante)
      values
        (v_prod, v_riga.ingredient_id, 'giacenza_insufficiente',
         (select name from ingredients where id = v_riga.ingredient_id),
         round(v_da, 4));
    end if;
  end loop;

  -- Il lotto del semilavorato, col costo di oggi.
  insert into stock_lots (
    ingredient_id, quantity_received, quantity_remaining, unit_cost, expiry_date, note
  ) values (
    v_ingr, p_quantita_ottenuta, p_quantita_ottenuta,
    round(v_costo / p_quantita_ottenuta, 4), p_scadenza,
    'Produzione del ' || to_char((now() at time zone 'Europe/Rome')::date, 'DD/MM/YYYY')
  )
  returning id into v_lotto;

  update produzioni set lotto_id = v_lotto, costo = round(v_costo, 4) where id = v_prod;

  -- Niente costi nella risposta: la chiama anche la cucina.
  return jsonb_build_object(
    'produzione_id', v_prod,
    'lotto_id', v_lotto,
    'quantita', p_quantita_ottenuta,
    'righe_non_scaricate', v_mancanti
  );
end;
$funzione$;

revoke all on function registra_produzione(uuid, numeric, numeric, date, text) from public, anon;
grant execute on function registra_produzione(uuid, numeric, numeric, date, text) to authenticated;

-- ---------------------------------------------------------------------
-- 8. Il conto smette di esplodere cio' che esiste in cella
-- ---------------------------------------------------------------------
-- ⚠️ Senza questa modifica, servire un piatto col ragu' scaricherebbe le
--    verdure UNA SECONDA VOLTA: la prima alla produzione, la seconda
--    alla vendita. La giacenza scenderebbe il doppio e nessuno se ne
--    accorgerebbe, perche' entrambe le scritture sono legittime.
create or replace function fabbisogno_conto(p_order_id uuid)
returns table (order_item_id uuid, ingredient_id uuid, quantita numeric)
language sql
stable
security definer
set search_path = public
as $funzione$
  with recursive righe as (
    select oi.id, oi.recipe_id, oi.quantity::numeric as porzioni
      from order_items oi
     where oi.order_id = p_order_id
       and oi.voided_at is null
       and oi.recipe_id is not null
  ),
  espansione as (
    select r.id                                                as order_item_id,
           ri.ingredient_id,
           ri.component_recipe_id,
           (r.porzioni * ri.quantity / nullif(rec.portions_yield, 0)) as mult,
           ri.waste_percentage,
           ri.is_optional,
           1                                                   as depth
      from righe r
      join recipes rec            on rec.id = r.recipe_id
      join recipe_ingredients ri  on ri.recipe_id = r.recipe_id
    union all
    select e.order_item_id,
           ri2.ingredient_id,
           ri2.component_recipe_id,
           (e.mult * ri2.quantity / nullif(comp.yield_quantity, 0)),
           ri2.waste_percentage,
           (e.is_optional or ri2.is_optional),
           e.depth + 1
      from espansione e
      join recipes comp           on comp.id = e.component_recipe_id
      join recipe_ingredients ri2 on ri2.recipe_id = e.component_recipe_id
     where e.component_recipe_id is not null
       and e.depth < 10
       -- L'interruttore del Blocco 2: se il semilavorato esiste in cella
       -- si consuma quello, col costo che aveva quel giorno.
       and not exists (
         select 1
           from ingredients pi
           join stock_lots sl on sl.ingredient_id = pi.id
          where pi.preparazione_id = e.component_recipe_id
            and sl.quantity_remaining > 0
       )
  ),
  materia as (
    select e.order_item_id,
           e.ingredient_id,
           sum(e.mult * (1 + coalesce(e.waste_percentage, i.waste_percentage_default, 0) / 100.0)) as quantita
      from espansione e
      join ingredients i on i.id = e.ingredient_id
     where e.ingredient_id is not null
       and not e.is_optional
       and e.mult is not null
     group by e.order_item_id, e.ingredient_id
  ),
  semilavorati as (
    select e.order_item_id, pi.id as ingredient_id, sum(e.mult) as quantita
      from espansione e
      join ingredients pi on pi.preparazione_id = e.component_recipe_id
     where e.component_recipe_id is not null
       and not e.is_optional
       and e.mult is not null
       and exists (
         select 1 from stock_lots sl
          where sl.ingredient_id = pi.id and sl.quantity_remaining > 0
       )
     group by e.order_item_id, pi.id
  )
  select order_item_id, ingredient_id, sum(quantita)::numeric(14,4)
    from (select * from materia union all select * from semilavorati) tutto
   group by order_item_id, ingredient_id
  having sum(quantita) > 0;
$funzione$;

revoke all on function fabbisogno_conto(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. La resa vera, che il sistema scopre da solo
-- ---------------------------------------------------------------------
create or replace function rese_preparazione(p_recipe_id uuid)
returns table (
  produzioni_fatte integer,
  resa_media       numeric,
  resa_in_ricetta  numeric,
  scostamento      numeric
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  return query
  select count(*)::integer,
         -- Quanto esce da UNA dose, in media: e' il numero da proporre
         -- la volta dopo, e nessuno l'ha mai avuto prima d'ora.
         round(avg(p.quantita_ottenuta / nullif(p.dosi, 0)), 4),
         r.yield_quantity,
         case
           when r.yield_quantity is null or r.yield_quantity = 0 then null
           else round(
             (avg(p.quantita_ottenuta / nullif(p.dosi, 0)) - r.yield_quantity)
             / r.yield_quantity * 100, 1)
         end
    from produzioni p
    join recipes r on r.id = p.recipe_id
   where p.recipe_id = p_recipe_id
   group by r.yield_quantity;
end;
$funzione$;

comment on function rese_preparazione(uuid) is
  'Quanto esce davvero da una dose, in media, contro quanto dice la ricetta. La resa in ricetta serve alla spesa; questa serve al costo — e si propone precompilata alla produzione successiva.';

revoke all on function rese_preparazione(uuid) from public, anon;
grant execute on function rese_preparazione(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 10. Verifica (§7 punti 1-3) — il ragu' a tre livelli
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente     uuid;
  v_titolare uuid;
  v_staff    uuid;
  v_forn     uuid;
  v_cipolla  uuid;
  v_carne    uuid;
  v_soffr    uuid;   -- ricetta soffritto
  v_ragu     uuid;   -- ricetta ragu'
  v_piatto   uuid;
  v_i_soffr  uuid;   -- ingrediente-lotto del soffritto
  v_i_ragu   uuid;
  v_out      jsonb;
  v_r        record;
  v_costo    numeric;
  v_conto    uuid;
  n          integer;
  respinto   boolean;
begin
  select id into v_ente from entities where entity_type = 'srls';
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  if v_ente is null or v_titolare is null or v_staff is null then
    raise exception 'Servono entita'', titolare e staff per questa verifica.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  insert into suppliers (entity_id, name, category)
  values (v_ente, 'PROVA PROD fornitore', 'ortofrutta') returning id into v_forn;

  -- Materia prima: 10 kg di cipolla a 2,00 €/kg, 10 kg di carne a 8,00.
  insert into ingredients (entity_id, name, category, unit, waste_percentage_default)
  values (v_ente, 'PROVA PROD cipolla', 'verdura', 'kg', 0) returning id into v_cipolla;
  insert into ingredients (entity_id, name, category, unit, waste_percentage_default)
  values (v_ente, 'PROVA PROD carne', 'carne_rossa', 'kg', 0) returning id into v_carne;

  insert into stock_lots (ingredient_id, supplier_id, quantity_received, quantity_remaining, unit_cost)
  values (v_cipolla, v_forn, 10, 10, 2.00);
  insert into stock_lots (ingredient_id, supplier_id, quantity_received, quantity_remaining, unit_cost)
  values (v_carne, v_forn, 10, 10, 8.00);

  -- LIVELLO 1 — soffritto: da 2 kg di cipolla escono 1,5 kg (cala).
  insert into recipes (name, category, recipe_type, portions_yield, yield_quantity, yield_unit)
  values ('PROVA PROD soffritto', 'primo', 'preparazione', 1, 1.5, 'kg') returning id into v_soffr;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_soffr, v_cipolla, 2, 'kg');

  -- LIVELLO 2 — ragu': 0,5 kg di soffritto + 2 kg di carne → 2 kg.
  insert into recipes (name, category, recipe_type, portions_yield, yield_quantity, yield_unit)
  values ('PROVA PROD ragu', 'primo', 'preparazione', 1, 2, 'kg') returning id into v_ragu;
  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
  values (v_ragu, v_soffr, 0.5, 'kg');
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_ragu, v_carne, 2, 'kg');

  -- 1. Senza lotti del soffritto, il ragu' si esplode fino alla cipolla.
  select count(*) into n from fabbisogno_preparazione(v_ragu, 1)
   where ingredient_id = v_cipolla;
  if n <> 1 then
    raise exception 'Senza soffritto in cella il ragu'' doveva esplodere fino alla cipolla.';
  end if;

  -- 2. Si produce il soffritto: UNA dose, e ne escono 1,4 kg invece di 1,5.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  v_out := registra_produzione(v_soffr, 1, 1.4, null, 'prova');
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into v_i_soffr from ingredients where preparazione_id = v_soffr;
  if v_i_soffr is null then raise exception 'Il soffritto non ha un posto dove stare in magazzino.'; end if;

  -- La cipolla e' scesa di 2 kg, e il lotto del soffritto costa 4,00 €
  -- in tutto — cioe' 2,857 €/kg su 1,4 kg, non su 1,5.
  if (select sum(quantity_remaining) from stock_lots where ingredient_id = v_cipolla) <> 8 then
    raise exception 'La cipolla non e'' scesa di 2 kg.';
  end if;
  select costo into v_costo from produzioni where id = (v_out->>'produzione_id')::uuid;
  if abs(v_costo - 4.00) > 0.001 then
    raise exception 'Il soffritto doveva costare 4,00 €, risulta %.', v_costo;
  end if;
  select unit_cost into v_costo from stock_lots where id = (v_out->>'lotto_id')::uuid;
  if abs(v_costo - (4.00 / 1.4)) > 0.001 then
    raise exception 'Il costo al chilo del soffritto usa la resa sbagliata: %.', v_costo;
  end if;

  -- 3. ⚠️ Adesso il soffritto ESISTE: il ragu' non deve piu' esplodere la
  --    cipolla, deve consumare il soffritto.
  select count(*) into n from fabbisogno_preparazione(v_ragu, 1) where ingredient_id = v_cipolla;
  if n <> 0 then
    raise exception 'Col soffritto in cella, il ragu'' ha riesploso la cipolla: si scaricherebbe due volte.';
  end if;
  select quantita into v_costo from fabbisogno_preparazione(v_ragu, 1) where ingredient_id = v_i_soffr;
  if abs(v_costo - 0.5) > 0.0001 then
    raise exception 'Il ragu'' doveva consumare 0,5 kg di soffritto, risulta %.', v_costo;
  end if;

  -- 4. Si produce il ragu': 1 dose, escono 2 kg.
  --    Costo = 0,5 kg di soffritto (a 4,00/1,4 = 2,857) + 2 kg di carne
  --    a 8,00 = 1,4286 + 16 = 17,4286.
  v_out := registra_produzione(v_ragu, 1, 2, null, 'prova');
  select costo into v_costo from produzioni where id = (v_out->>'produzione_id')::uuid;
  if abs(v_costo - (0.5 * 4.00 / 1.4 + 16)) > 0.01 then
    raise exception 'La cascata dei costi non torna: il ragu'' risulta %, atteso %.',
      v_costo, round(0.5 * 4.00 / 1.4 + 16, 4);
  end if;
  select id into v_i_ragu from ingredients where preparazione_id = v_ragu;
  if (select sum(quantity_remaining) from stock_lots where ingredient_id = v_i_soffr) <> 0.9 then
    raise exception 'Il soffritto doveva scendere a 0,9 kg.';
  end if;

  -- 5. La resa vera, scoperta dal sistema: 1,4 su 1,5 attesi = -6,7%.
  select * into v_r from rese_preparazione(v_soffr);
  if v_r.produzioni_fatte <> 1 or abs(v_r.resa_media - 1.4) > 0.0001 then
    raise exception 'La resa media del soffritto non torna: %.', v_r.resa_media;
  end if;
  if abs(v_r.scostamento - (-6.7)) > 0.1 then
    raise exception 'Lo scostamento dalla resa in ricetta non torna: %.', v_r.scostamento;
  end if;

  -- 6. Un piatto che contiene il ragu' consuma IL RAGU', non la carne.
  insert into recipes (name, category, recipe_type, portions_yield)
  values ('PROVA PROD pasta al ragu', 'primo', 'piatto_finito', 4) returning id into v_piatto;
  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
  values (v_piatto, v_ragu, 1, 'kg');

  insert into orders (entity_id, table_label, status, coperti)
  values (v_ente, 'PROVA PROD T1', 'aperto', 1) returning id into v_conto;
  insert into order_items (order_id, recipe_id, destination, quantity, unit_price)
  values (v_conto, v_piatto, 'cucina', 4, 10);

  select count(*) into n from fabbisogno_conto(v_conto) where ingredient_id = v_carne;
  if n <> 0 then
    raise exception 'Il conto ha riesploso la carne: si scaricherebbe due volte.';
  end if;
  select quantita into v_costo from fabbisogno_conto(v_conto) where ingredient_id = v_i_ragu;
  if abs(v_costo - 1) > 0.0001 then
    raise exception 'Quattro porzioni dovevano consumare 1 kg di ragu'', risultano %.', v_costo;
  end if;

  -- 7. Un semilavorato non si compra: fuori dalla lista della spesa,
  --    senza fornitore, senza avvisi di rincaro.
  select * into v_r from ingredients where id = v_i_ragu;
  if v_r.stock_minimum_threshold is not null then
    raise exception 'Un semilavorato e'' nato con una scorta minima: finirebbe nella lista della spesa.';
  end if;
  if v_r.supplier_id is not null or v_r.avvisa_rincari then
    raise exception 'Un semilavorato e'' nato come se lo si comprasse da qualcuno.';
  end if;
  perform add_below_threshold_items();
  select count(*) into n from shopping_list_items where ingredient_id in (v_i_ragu, v_i_soffr);
  if n <> 0 then raise exception 'Un semilavorato e'' finito nella lista della spesa.'; end if;

  -- 8. I due numeri sono obbligatori tutti e due.
  respinto := false;
  begin perform registra_produzione(v_ragu, 0, 2, null, null);
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Una produzione senza dosi e'' stata accettata.'; end if;

  respinto := false;
  begin perform registra_produzione(v_ragu, 1, 0, null, null);
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Una produzione senza quantita'' e'' stata accettata.'; end if;

  -- 9. Un piatto finito non si «produce».
  respinto := false;
  begin perform registra_produzione(v_piatto, 1, 1, null, null);
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Un piatto finito si e'' lasciato produrre.'; end if;

  -- 10. Giacenza insufficiente: non blocca, e dichiara il mancante.
  update stock_lots set quantity_remaining = 0 where ingredient_id = v_carne;
  v_out := registra_produzione(v_ragu, 1, 2, null, 'senza carne');
  if (v_out->>'righe_non_scaricate')::integer < 1 then
    raise exception 'La carne mancante non e'' stata dichiarata.';
  end if;
  select count(*) into n from anomalie_scarico
   where produzione_id = (v_out->>'produzione_id')::uuid and tipo = 'giacenza_insufficiente';
  if n < 1 then raise exception 'Manca la riga di anomalia della produzione.'; end if;

  -- 11. Lo staff non vede i costi delle produzioni.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  select count(*) into n from produzioni_display;
  if n < 1 then raise exception 'La cucina non vede nemmeno l''elenco delle produzioni.'; end if;
  perform set_config('request.jwt.claims', null, true);

  -- 12. L'elenco di chi bussa da fuori non e' cresciuto.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  select count(*) into n from funzioni_aperte_ad_anon();
  if n <> 12 then
    raise exception 'L''elenco di chi puo'' bussare da fuori e'' passato a %.', n;
  end if;
  perform set_config('request.jwt.claims', null, true);

  -- ---- Pulizia (§5 punto 8) ----------------------------------------
  delete from anomalie_scarico where produzione_id in (select id from produzioni where recipe_id in (v_soffr, v_ragu));
  delete from anomalie_scarico where order_id = v_conto;
  delete from stock_consumptions where produzione_id in (select id from produzioni where recipe_id in (v_soffr, v_ragu));
  delete from stock_consumptions where ingredient_id in (v_cipolla, v_carne, v_i_soffr, v_i_ragu);
  delete from produzioni where recipe_id in (v_soffr, v_ragu);
  delete from order_items where order_id = v_conto;
  delete from orders where id = v_conto;
  delete from stock_lots where ingredient_id in (v_cipolla, v_carne, v_i_soffr, v_i_ragu);
  delete from shopping_list_items where ingredient_id in (v_cipolla, v_carne, v_i_soffr, v_i_ragu);
  delete from recipe_ingredients where recipe_id in (v_soffr, v_ragu, v_piatto);
  delete from price_history where ingredient_id in (v_cipolla, v_carne, v_i_soffr, v_i_ragu);
  delete from ingredients where id in (v_cipolla, v_carne, v_i_soffr, v_i_ragu);
  delete from recipe_status_history where recipe_id in (v_soffr, v_ragu, v_piatto);
  delete from recipes where id in (v_soffr, v_ragu, v_piatto);
  delete from suppliers where id = v_forn;

  select count(*) into n from ingredients where name like 'PROVA PROD%';
  if n <> 0 then raise exception 'La prova ha lasciato % ingredienti.', n; end if;
  select count(*) into n from recipes where name like 'PROVA PROD%';
  if n <> 0 then raise exception 'La prova ha lasciato % ricette.', n; end if;

  raise notice 'Produzioni: due numeri, il costo congelato, la cascata a tre livelli, e niente si scarica due volte.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260814000004', 'le_produzioni')
on conflict (version) do nothing;

select count(*) as produzioni from produzioni;
