-- =====================================================================
-- VIA LA GUARNIZIONE OPZIONALE
-- 29/08/2026 — decisione di Alessio
-- =====================================================================
-- La spunta «Guarnizione opzionale (esclusa dal food cost)» sulla riga di
-- una ricetta va tolta.
--
-- ⚠️ NON ERA UNA CASELLA ISOLATA, ed e' il motivo per cui questa
-- migrazione e' lunga. Misurato: `recipe_ingredients.is_optional` era
-- letta da NOVE funzioni e da DUE viste. Togliere la spunta dalla
-- schermata e lasciare il resto avrebbe lasciato in piedi un pezzo di
-- telaio orfano — una colonna che nessuno puo' piu' accendere, un ramo del
-- registro dei costi che non puo' piu' scattare, e un filtro
-- `and not e.is_optional` ripetuto sei volte che non toglie mai niente.
--
-- 🔴 QUANTO CAMBIA UN FOOD COST: NIENTE, e il numero e' misurato su tutti
-- e due i database prima di toccare qualunque cosa.
--   · in produzione: `recipe_ingredients` ha **0 righe** in tutto;
--   · sul progetto di prova: **320 righe, di cui 0 opzionali**.
-- Non c'e' nessun costo che possa muoversi, perche' non c'e' nessuna riga
-- che fosse esclusa. La verifica in fondo lo dimostra invece di dirlo:
-- fotografa il costo di ogni ricetta PRIMA e lo riconfronta DOPO.
--
-- ⚠️ SI TOGLIE, NON SI SPEGNE. E' la regola decisa il 14/08 con la pianta
-- viva — «una colonna spenta, fra tre mesi, qualcuno la riaccende credendo
-- di riparare qualcosa». Una colonna che nessuna schermata puo' scrivere e
-- che sei funzioni continuano a interrogare non e' un residuo innocuo: e'
-- un invito a rimetterci una casella sopra.
--
-- ⚠️ E I CORPI VENGONO DAL DATABASE, non dai file che li hanno creati: fra
-- i due ci stanno tutte le migrazioni che li hanno toccati dopo. Presi dal
-- progetto di prova, con le impronte confrontate una per una con la
-- produzione — identiche su tutt'e nove.
--
-- ⚠️ TRAPPOLA DEL 27/08, che qui e' esattamente in agguato: togliere una
-- colonna NON rompe una funzione che la nomina, finche' nessuno la
-- esegue. Postgres controlla le firme, non i corpi. Per questo la verifica
-- in fondo **le CHIAMA tutte e nove**, una per una.

-- ---------------------------------------------------------------------
-- 0. LA GUARDIA, prima di toccare qualunque cosa.
--
--    ⚠️ E una PROPRIETA, non una fotografia: questa migrazione e sicura
--    perche nessuna riga era esclusa dal costo. Se un giorno qualcuno la
--    rilanciasse su un database dove qualcuno lo era, si ferma e lo dice —
--    quel caso vuole una decisione di una persona, non un drop.
--
--    E si fotografa il costo di OGNI ricetta, per poterlo riconfrontare in
--    fondo: e la sola cosa che dimostra "nessun food cost si e mosso"
--    invece di affermarlo.
-- ---------------------------------------------------------------------
do $guardia$
declare
  v_escluse integer;
  v_ce      boolean;
begin
  select exists (select 1 from information_schema.columns
                  where table_schema = 'public'
                    and table_name = 'recipe_ingredients'
                    and column_name = 'is_optional') into v_ce;
  if not v_ce then
    raise notice 'La colonna non c''e'' gia'' piu'': la migrazione e'' gia'' stata applicata, si va avanti lo stesso.';
    return;
  end if;
  execute 'select count(*) from recipe_ingredients where is_optional' into v_escluse;
  if v_escluse > 0 then
    raise exception 'FERMO: ci sono % righe di ricetta marcate «guarnizione opzionale». Togliere la colonna adesso farebbe SALIRE il food cost di quelle ricette senza che nessuno l''abbia deciso. Guardare quelle righe una per una prima di rilanciare.', v_escluse;
  end if;
  raise notice 'Nessuna riga era esclusa dal costo: togliere la colonna non puo'' muovere nessun food cost.';
end
$guardia$;

create temp table costo_prima on commit drop as
  select recipe_id, sum(costo) as costo from v_recipe_row_costs group by recipe_id;

-- ---------------------------------------------------------------------
-- 1. Le due viste vanno tolte e rifatte, non modificate.
--    `create or replace view` sa solo AGGIUNGERE colonne in fondo: per
--    toglierne una in mezzo rifiuta con 42P16.
-- ---------------------------------------------------------------------
--    ⚠️ E LA CATENA E PIU LUNGA DI DUE: `v_recipe_row_costs` la usa
--    `v_recipe_costs`, che la usa `v_menu_item_economics`. Non l ho dedotto —
--    me l ha detto Postgres rifiutando il primo tentativo. Vanno tolte
--    dall alto verso il basso e rifatte dal basso verso l alto.
drop view if exists v_menu_item_economics;
drop view if exists v_recipe_costs;
drop view if exists v_recipe_row_costs;
drop view if exists recipe_ingredients_display;

-- ---------------------------------------------------------------------
-- 2. `espansione_costo_ricetta` cambia FORMA (restituiva `is_optional`),
--    quindi va tolta e rifatta.
--    🔴 E UNA FUNZIONE RIFATTA NASCE APERTA A CHIUNQUE ABBIA LA CHIAVE
--    PUBBLICA. I permessi qui sotto NON sono ricopiati a memoria dalle
--    funzioni accanto — sono quelli veri, letti da `pg_proc.proacl` prima
--    di toccarla: `authenticated=X/postgres`, e nient'altro. E' l'errore
--    gia' fatto tre volte in questo progetto, l'ultima il 27/08.
-- ---------------------------------------------------------------------
-- rete-guardie: espansione_costo_ricetta — la colonna is_optional si toglie apposta: la guarnizione opzionale non esiste piu
drop function if exists public.espansione_costo_ricetta(uuid);

CREATE OR REPLACE FUNCTION public.duplica_ricetta(p_recipe_id uuid, p_nome text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_orig   recipes%rowtype;
  v_nuova  uuid;
  v_nome   text;
  v_righe  integer;
  v_passi  integer;
begin
  select * into v_orig from recipes where id = p_recipe_id;
  if not found then
    raise exception 'La ricetta da copiare non esiste piu''.';
  end if;

  -- ⚠️ Il nome NON puo' restare identico: due schede con lo stesso nome in
  -- un elenco sono indistinguibili, e la prima cosa che si fa dopo una
  -- copia e' cercarla. Se chi chiama non ne propone uno, «(copia)».
  v_nome := coalesce(nullif(btrim(p_nome), ''), v_orig.name || ' (copia)');

  insert into recipes (
    name, category, subcategory, seasonality, portions_yield, tags, notes,
    menu_description, recipe_type, yield_quantity, yield_unit, prezzo_al_pezzo
  ) values (
    v_nome, v_orig.category, v_orig.subcategory, v_orig.seasonality,
    v_orig.portions_yield, v_orig.tags, v_orig.notes, v_orig.menu_description,
    v_orig.recipe_type, v_orig.yield_quantity, v_orig.yield_unit,
    v_orig.prezzo_al_pezzo
  )
  returning id into v_nuova;

  insert into recipe_ingredients (
    recipe_id, ingredient_id, component_recipe_id, quantity, unit,
    waste_percentage, prep_note
  )
  select v_nuova, ingredient_id, component_recipe_id, quantity, unit,
         waste_percentage, prep_note
  from recipe_ingredients
  where recipe_id = p_recipe_id;
  get diagnostics v_righe = row_count;

  insert into recipe_steps (
    recipe_id, step_number, phase, description, technique, duration_min,
    is_active_time, temperature_c, is_haccp_ccp, haccp_limit, haccp_action,
    equipment
  )
  select v_nuova, step_number, phase, description, technique, duration_min,
         is_active_time, temperature_c, is_haccp_ccp, haccp_limit,
         haccp_action, equipment
  from recipe_steps
  where recipe_id = p_recipe_id;
  get diagnostics v_passi = row_count;

  return jsonb_build_object(
    'id', v_nuova,
    'nome', v_nome,
    'righe', v_righe,
    'passi', v_passi
  );
end;
$function$
;

-- ================================================

CREATE OR REPLACE FUNCTION public.espansione_costo_ricetta(p_recipe_id uuid)
 RETURNS TABLE(riga_id uuid, ingredient_id uuid, multiplier numeric, waste_percentage numeric, profondita integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with recursive espansione as (
    select
      ri.id            as riga_id,
      ri.ingredient_id,
      ri.component_recipe_id,
      ri.quantity::numeric as multiplier,
      ri.waste_percentage,
      1                as profondita
    from recipe_ingredients ri
    where ri.recipe_id = p_recipe_id

    union all

    select
      e.riga_id,
      ri2.ingredient_id,
      ri2.component_recipe_id,
      e.multiplier * ri2.quantity / nullif(comp.yield_quantity, 0),
      ri2.waste_percentage,
      e.profondita + 1
    from espansione e
    join recipes comp on comp.id = e.component_recipe_id
    join recipe_ingredients ri2 on ri2.recipe_id = e.component_recipe_id
    where e.component_recipe_id is not null
      and e.profondita < 10
  )
  select riga_id, ingredient_id, multiplier, waste_percentage, profondita
    from espansione
   where ingredient_id is not null;
$function$
;

-- ================================================

CREATE OR REPLACE FUNCTION public.fabbisogno_conto(p_order_id uuid)
 RETURNS TABLE(order_item_id uuid, ingredient_id uuid, quantita numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with recursive porzioni_evento as (
    select pe.recipe_id, pe.porzioni_per_persona
      from porzioni_evento_del_conto(p_order_id) pe
  ),
  righe as (
    select oi.id,
           oi.recipe_id,
           -- 🔴 LE PORZIONI DELL'EVENTO, DOVE CI SONO (22/08). `coalesce`
           -- a 1 e non a zero: un piatto ordinato quella sera ma **non**
           -- previsto dal preventivo si scarica come in carta — e' un
           -- fuori-menu, non un piatto da non scaricare.
           oi.quantity::numeric * coalesce(pev.porzioni_per_persona, 1) as porzioni,
           -- 🔴 L'ISTANTE DEL CONTO, portato dentro la ricorsione invece
           -- che riletto: un conto aperto vive adesso, un conto chiuso
           -- vive nella sera in cui e' stato chiuso e non si muove piu'.
           coalesce(o.closed_at, now()) as istante
      from order_items oi
      join orders o on o.id = oi.order_id
      left join porzioni_evento pev on pev.recipe_id = oi.recipe_id
     where oi.order_id = p_order_id
       and oi.voided_at is null
       -- ⚠️ Mai inviata = mai cucinata: dalla cella non e' uscito niente.
       and oi.sent_at is not null
       and oi.recipe_id is not null
  ),
  espansione as (
    select r.id as order_item_id,
           ri.ingredient_id,
           ri.component_recipe_id,
           r.porzioni * ri.quantity / nullif(rec.portions_yield, 0) as multiplier,
           ri.waste_percentage,
           r.istante,
           1 as depth
      from righe r
      join recipes rec on rec.id = r.recipe_id
      join recipe_ingredients ri on ri.recipe_id = r.recipe_id

    union all

    select e.order_item_id,
           ri2.ingredient_id,
           ri2.component_recipe_id,
           e.multiplier * ri2.quantity / nullif(comp.yield_quantity, 0),
           ri2.waste_percentage,
           e.istante,
           e.depth + 1
      from espansione e
      join recipes comp on comp.id = e.component_recipe_id
      join recipe_ingredients ri2 on ri2.recipe_id = e.component_recipe_id
     where e.component_recipe_id is not null
       and e.depth < 10
       -- L'interruttore del 14/08: una preparazione CHE HA LOTTI non si
       -- esplode piu', si consuma (sotto). Senza, servire un piatto
       -- scaricherebbe due volte le stesse verdure.
       and preparazione_in_cella(e.component_recipe_id, e.istante) is null
  ),
  -- a) la materia prima
  --    🔴 LA SOSTITUZIONE (24/08): dove il cameriere ha tolto un allergene
  --       da questa riga, dal magazzino esce il SOSTITUTO. E dove il
  --       sostituto non c'e' — «si toglie e basta» — non esce niente.
  materia as (
    select e.order_item_id,
           coalesce(s.sostituto_id, e.ingredient_id) as ingredient_id,
           sum(e.multiplier * (1 + coalesce(e.waste_percentage, i.waste_percentage_default, 0) / 100.0)) as quantita
      from espansione e
      join ingredients i on i.id = e.ingredient_id
      left join order_item_sostituzioni s
             on s.order_item_id = e.order_item_id
            and s.ingrediente_id = e.ingredient_id
     where e.ingredient_id is not null
       and not (s.id is not null and s.sostituto_id is null)
     group by e.order_item_id, coalesce(s.sostituto_id, e.ingredient_id)
  ),
  -- b) i semilavorati che c'erano davvero quella sera, presi come sono
  --    ⚠️ Nessuno scarto: un semilavorato in cella e' gia' pulito e gia'
  --       pesato — lo scarto e' stato pagato quando l'hanno prodotto.
  --       Stessa scelta di `fabbisogno_preparazione`.
  semilavorati as (
    select e.order_item_id,
           coalesce(s.sostituto_id, prep.id) as ingredient_id,
           sum(e.multiplier) as quantita
      from espansione e
      join lateral (
        select preparazione_in_cella(e.component_recipe_id, e.istante) as id
      ) prep on prep.id is not null
      left join order_item_sostituzioni s
             on s.order_item_id = e.order_item_id
            and s.ingrediente_id = prep.id
     where e.component_recipe_id is not null
       and e.multiplier is not null
       and not (s.id is not null and s.sostituto_id is null)
     group by e.order_item_id, coalesce(s.sostituto_id, prep.id)
  )
  select t.order_item_id, t.ingredient_id, sum(t.quantita)
    from (select * from materia union all select * from semilavorati) t
   group by t.order_item_id, t.ingredient_id;
$function$
;

-- ================================================

CREATE OR REPLACE FUNCTION public.fabbisogno_preparazione(p_recipe_id uuid, p_dosi numeric)
 RETURNS TABLE(ingredient_id uuid, quantita numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with recursive esplosione as (
    select ri.ingredient_id,
           ri.component_recipe_id,
           (p_dosi * ri.quantity)::numeric as qta,
           ri.waste_percentage,
           1 as depth
      from recipe_ingredients ri
     where ri.recipe_id = p_recipe_id
    union all
    select ri2.ingredient_id,
           ri2.component_recipe_id,
           (e.qta * ri2.quantity / nullif(comp.yield_quantity, 0)),
           ri2.waste_percentage,
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
       and e.qta is not null
     group by e.ingredient_id
  ),
  -- b) i semilavorati che ci sono davvero, presi come sono
  semilavorati as (
    select pi.id as ingredient_id, sum(e.qta) as quantita
      from esplosione e
      join ingredients pi on pi.preparazione_id = e.component_recipe_id
     where e.component_recipe_id is not null
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
$function$
;

-- ================================================

CREATE OR REPLACE FUNCTION public.ingredienti_del_menu(p_menu_id uuid)
 RETURNS TABLE(ingredient_id uuid, nome text, solo_in_preparazioni boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_titolare() then
    raise exception 'L''elenco degli ingredienti del menu e'' riservato al titolare.';
  end if;

  return query
  select i.id, i.name, bool_and(e.profondita > 1)
    from menu_items mi
    cross join lateral espansione_costo_ricetta(mi.recipe_id) e
    join ingredients i on i.id = e.ingredient_id
   where mi.menu_id = p_menu_id
   group by i.id, i.name
   order by i.name;
end;
$function$
;

-- ================================================

CREATE OR REPLACE FUNCTION public.prodotti_troppo_piccoli()
 RETURNS TABLE(ingredient_id uuid, nome text, in_piatti integer, impieghi_ciechi integer, max_euro_porzione numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' vedere quali prodotti il magazzino non riesce a seguire';
  end if;

  return query
  with recursive esploso as (
    select r.id as piatto, ri.ingredient_id, ri.component_recipe_id,
           ri.quantity / nullif(r.portions_yield, 0) as mult,
           coalesce(ri.waste_percentage, 0) as scarto, 1 as d
      from recipes r
      join recipe_ingredients ri on ri.recipe_id = r.id
     where r.recipe_type in ('piatto_finito', 'finger')
    union all
    select e.piatto, ri2.ingredient_id, ri2.component_recipe_id,
           e.mult * ri2.quantity / nullif(c.yield_quantity, 0),
           coalesce(ri2.waste_percentage, 0), e.d + 1
      from esploso e
      join recipes c on c.id = e.component_recipe_id
      join recipe_ingredients ri2 on ri2.recipe_id = e.component_recipe_id
     where e.component_recipe_id is not null and e.d < 10
  ),
  voci as (
    select e.piatto, e.ingredient_id,
           e.mult * (1 + e.scarto / 100.0) as kg,
           e.mult * (1 + e.scarto / 100.0) * coalesce(i.current_price, 0) as euro
      from esploso e
      join ingredients i on i.id = e.ingredient_id
     where e.ingredient_id is not null
  )
  select i.id, i.name,
         count(*)::integer,
         count(*) filter (where pizzico_trascurabile(v.kg))::integer,
         round(max(v.euro), 4)
    from voci v
    join ingredients i on i.id = v.ingredient_id
   where i.tenuto_in_magazzino
   group by i.id, i.name
  having count(*) filter (where pizzico_trascurabile(v.kg)) > 0
   order by count(*) filter (where pizzico_trascurabile(v.kg)) desc, i.name;
end;
$function$
;

-- ================================================

CREATE OR REPLACE FUNCTION public.registra_storico_costi(p_ricette uuid[], p_causa text, p_dettaglio text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id      uuid;
  v_base    numeric(14,4);
  v_porz    numeric(14,4);
  v_senza   integer;
  v_ub      numeric(14,4);
  v_up      numeric(14,4);
  v_us      integer;
  v_scritte integer := 0;
begin
  foreach v_id in array coalesce(p_ricette, '{}'::uuid[]) loop
    -- La ricetta puo' essere sparita (una cancellazione a cascata fa
    -- scattare i trigger sulle righe figlie): niente storia per chi non c'e'.
    if not exists (select 1 from recipes where id = v_id) then
      continue;
    end if;

    -- ⚠️ Il costo si CHIEDE alla vista che lo calcola per tutto il
    -- gestionale, non si rifa' qui: due calcoli dello stesso numero sono il
    -- difetto tolto da nove punti col mandato di correzione.
    select c.food_cost_base, c.food_cost_portion
      into v_base, v_porz
      from v_recipe_costs c
     where c.recipe_id = v_id;

    -- Quante righe entrano nel costo con prezzo zero, cioe' senza prezzo.
    select count(*) into v_senza
      from espansione_costo_ricetta(v_id) e
      join ingredients i on i.id = e.ingredient_id
     where i.current_price = 0;

    -- L'ultima voce, se c'e'.
    select s.food_cost_base, s.food_cost_portion, s.righe_senza_prezzo
      into v_ub, v_up, v_us
      from storico_costi_ricetta s
     where s.recipe_id = v_id
     order by s.progressivo desc
     limit 1;

    -- ⚠️ SOLO I CAMBIAMENTI VERI. Se niente si e' mosso non si scrive: e' la
    -- riga che distingue «registra i cambiamenti» da «registra i
    -- salvataggi». ⚠️ Anche il numero di righe senza prezzo conta come
    -- cambiamento: passare da «costo completo» a «costo parziale» e'
    -- un'informazione, e a volte il costo in euro non si muove.
    if found
       and v_ub is not distinct from v_base
       and v_up is not distinct from v_porz
       and v_us is not distinct from v_senza then
      continue;
    end if;

    insert into storico_costi_ricetta
      (recipe_id, food_cost_base, food_cost_portion, causa, dettaglio, righe_senza_prezzo)
    values (v_id, coalesce(v_base, 0), v_porz, p_causa, p_dettaglio, coalesce(v_senza, 0));
    v_scritte := v_scritte + 1;
  end loop;

  return v_scritte;
end;
$function$
;

-- ================================================

CREATE OR REPLACE FUNCTION public.simula_prezzo_ingrediente(p_menu_id uuid, p_ingredient_id uuid, p_variazione_pct numeric)
 RETURNS TABLE(menu_item_id uuid, piatto text, prezzo_vendita numeric, food_cost_attuale numeric, food_cost_simulato numeric, pct_attuale numeric, pct_simulata numeric, via_preparazione boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_prezzo numeric;
  v_scarto numeric;
  v_delta  numeric;
begin
  -- ⚠️ security definer: il controllo va rimesso dentro, altrimenti la
  -- funzione gira senza RLS e i prezzi d'acquisto escono da qui.
  if not is_titolare() then
    raise exception 'Il simulatore del menu e'' riservato al titolare.';
  end if;
  if p_variazione_pct is null then
    raise exception 'Serve di quanto cambia il prezzo.';
  end if;

  select i.current_price, coalesce(i.waste_percentage_default, 0)
    into v_prezzo, v_scarto
    from ingredients i where i.id = p_ingredient_id;
  if v_prezzo is null then
    raise exception 'Ingrediente non trovato.';
  end if;

  v_delta := v_prezzo * p_variazione_pct / 100.0;

  return query
  with peso as (
    -- Quanto di questo ingrediente entra in una porzione del piatto,
    -- scarto compreso. E' la sola cosa che serve sapere in piu'.
    select
      mi.id as menu_item_id,
      sum(e.multiplier * (1 + coalesce(e.waste_percentage, v_scarto, 0) / 100.0)) as quantita,
      bool_or(e.profondita > 1) as via_prep
    from menu_items mi
    cross join lateral espansione_costo_ricetta(mi.recipe_id) e
    where mi.menu_id = p_menu_id
      and e.ingredient_id = p_ingredient_id
    group by mi.id
  )
  select
    p.menu_item_id,
    r.name,
    mi.selling_price,
    ec.food_cost_portion,
    (ec.food_cost_portion
      + v_delta * p.quantita / nullif(r.portions_yield, 0))::numeric(14,4),
    ec.food_cost_pct,
    case when mi.selling_price > 0 then
      round(100 * (ec.food_cost_portion
        + v_delta * p.quantita / nullif(r.portions_yield, 0)) / mi.selling_price, 2)
    end,
    p.via_prep
  from peso p
  join menu_items mi on mi.id = p.menu_item_id
  join recipes r on r.id = mi.recipe_id
  join v_menu_item_economics ec on ec.menu_item_id = mi.id
  order by p.via_prep desc, r.name;
end;
$function$
;

-- ================================================

CREATE OR REPLACE FUNCTION public.storico_al_cambio_riga()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_riga    recipe_ingredients;
  v_nome    text;
  v_causa   text;
  v_dett    text;
begin
  v_riga := case when tg_op = 'DELETE' then old else new end;

  select coalesce(i.name, r.name) into v_nome
    from (select 1) x
    left join ingredients i on i.id = v_riga.ingredient_id
    left join recipes r on r.id = v_riga.component_recipe_id;
  v_nome := coalesce(v_nome, 'una voce');

  if tg_op = 'INSERT' then
    v_causa := 'composizione';
    v_dett  := 'Aggiunto ' || v_nome;
  elsif tg_op = 'DELETE' then
    v_causa := 'composizione';
    v_dett  := 'Tolto ' || v_nome;
  elsif new.quantity is distinct from old.quantity then
    v_causa := 'quantita';
    v_dett  := 'Cambiata la dose di ' || v_nome || ': '
               || trim(to_char(old.quantity, 'FM999999990.0999')) || ' → '
               || trim(to_char(new.quantity, 'FM999999990.0999')) || ' ' || new.unit;
  elsif new.waste_percentage is distinct from old.waste_percentage then
    v_causa := 'scarto';
    v_dett  := 'Cambiato lo scarto di ' || v_nome || ': '
               || coalesce(old.waste_percentage::text, 'quello dell''ingrediente') || '% → '
               || coalesce(new.waste_percentage::text, 'quello dell''ingrediente') || '%';
  else
    return null;   -- una modifica che il costo non vede
  end if;

  perform registra_storico_costi(
    array(select recipe_id from ricette_toccate_da_ricetta(v_riga.recipe_id)),
    v_causa, v_dett
  );
  return null;
end;
$function$
;

-- ---------------------------------------------------------------------
-- 3. I permessi della funzione rifatta, MISURATI e non ricordati.
-- ---------------------------------------------------------------------
revoke all on function public.espansione_costo_ricetta(uuid) from public, anon, authenticated;
grant execute on function public.espansione_costo_ricetta(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Le due viste, rifatte senza la colonna.
--
--    ⚠️ `recipe_ingredients_display` NASCE SENZA `security_invoker`, ed e'
--    voluto: e' una delle viste `_display` che scavalcano la RLS per
--    mostrare allo staff le sole colonne sicure (§6). Metterle
--    `security_invoker` per uniformita' la renderebbe muta in cucina.
--    `v_recipe_row_costs` invece ce l'ha, e resta com'era. Anche qui i
--    permessi sono quelli letti da `pg_class.relacl` prima di toccarle.
-- ---------------------------------------------------------------------
create view recipe_ingredients_display as
  select ri.id as recipe_ingredient_id,
         ri.recipe_id,
         coalesce(i.name, comp.name) as ingredient_name,
         i.category as ingredient_category,
         ri.quantity,
         ri.unit,
         coalesce(ri.waste_percentage, i.waste_percentage_default, 0::numeric) as waste_percentage,
         ri.prep_note,
         coalesce(i.allergens, '{}'::allergen[]) as allergens,
         (ri.component_recipe_id is not null) as is_preparation
    from recipe_ingredients ri
    left join ingredients i on i.id = ri.ingredient_id
    left join recipes comp on comp.id = ri.component_recipe_id;

grant select on recipe_ingredients_display to authenticated;

create view v_recipe_row_costs with (security_invoker = true) as
  select ri.id as recipe_ingredient_id,
         ri.recipe_id,
         coalesce(sum(e.multiplier * i.current_price
                      * (1::numeric + coalesce(e.waste_percentage, i.waste_percentage_default, 0::numeric) / 100.0)),
                  0::numeric)::numeric(14,4) as costo
    from recipe_ingredients ri
    left join lateral espansione_costo_ricetta(ri.recipe_id)
         e(riga_id, ingredient_id, multiplier, waste_percentage, profondita) on e.riga_id = ri.id
    left join ingredients i on i.id = e.ingredient_id
   group by ri.id, ri.recipe_id;

grant select, insert, update, delete on v_recipe_row_costs to authenticated;

create view v_recipe_costs with (security_invoker = true) as
  select r.id as recipe_id,
         r.portions_yield,
         (coalesce(sum(rc.costo), 0::numeric))::numeric(14,4) as food_cost_base,
         (coalesce(sum(rc.costo), 0::numeric) / nullif(r.portions_yield, 0)::numeric)::numeric(14,4) as food_cost_portion
    from recipes r
    left join v_recipe_row_costs rc on rc.recipe_id = r.id
   group by r.id, r.portions_yield;

grant select, insert, update, delete on v_recipe_costs to authenticated;

create view v_menu_item_economics with (security_invoker = true) as
  select mi.id as menu_item_id,
         mi.menu_id,
         mi.recipe_id,
         mi.selling_price,
         vrc.food_cost_portion,
         case when mi.selling_price > 0::numeric
              then ((vrc.food_cost_portion / mi.selling_price) * 100::numeric)::numeric(6,2)
              else null::numeric end as food_cost_pct,
         (mi.selling_price - vrc.food_cost_portion)::numeric(12,2) as gross_margin
    from menu_items mi
    join v_recipe_costs vrc on vrc.recipe_id = mi.recipe_id;

grant select, insert, update, delete on v_menu_item_economics to authenticated;

-- ---------------------------------------------------------------------
-- 5. E adesso la colonna puo' cadere.
-- ---------------------------------------------------------------------
alter table recipe_ingredients drop column if exists is_optional;

comment on table recipe_ingredients is
  'Le righe di una ricetta. Dal 29/08/2026 non esiste piu la «guarnizione opzionale»: ogni riga entra nel food cost. Chi cerca quella casella cerca una cosa tolta apposta, non una cosa dimenticata.';

-- =====================================================================
-- VERIFICA
-- =====================================================================
-- ⚠️ NON BASTA CHE I CORPI SI CREINO. Postgres controlla le firme, non i
-- corpi: una funzione che nomina una colonna sparita si crea benissimo e
-- muore alla prima esecuzione (trappola del 27/08). Quindi qui si CHIAMANO
-- tutte e nove, su un esempio COSTRUITO da questa verifica — mai preso in
-- prestito da dati veri.
do $verifica$
declare
  v_foto      jsonb;
  v_tit       uuid;
  v_ente      uuid;
  v_ing       uuid;
  v_prep      uuid;
  v_piatto    uuid;
  v_copia     uuid;
  v_menu      uuid;
  v_riga      uuid;
  v_miei      uuid[] := '{}';
  v_quante    integer;
  v_n         integer;
  v_scostano  integer;
  v_costo     numeric;
  r           record;
begin
  v_foto := foto_righe();

  -- (0) NESSUN FOOD COST SI E' MOSSO. E' il numero che il mandato chiede
  --     dichiarato prima e dopo: qui si confrontano ricetta per ricetta.
  select count(*) into v_scostano
    from costo_prima p
    full join (select recipe_id, sum(costo) as costo from v_recipe_row_costs group by recipe_id) d
      on d.recipe_id = p.recipe_id
   where p.costo is distinct from d.costo;
  if v_scostano <> 0 then
    raise exception 'Togliendo la guarnizione opzionale il costo di % ricette e cambiato. Non doveva cambiare niente.', v_scostano;
  end if;
  select count(*) into v_n from costo_prima;
  raise notice 'Food cost confrontato su % ricette: prima e dopo coincidono, scostamenti 0.', v_n;

  -- (1) LA COLONNA NON C'E' PIU', ne sulla tabella ne sulle due viste.
  if exists (select 1 from information_schema.columns
              where table_schema = 'public'
                and table_name in ('recipe_ingredients', 'recipe_ingredients_display', 'v_recipe_row_costs')
                and column_name = 'is_optional') then
    raise exception 'La colonna «guarnizione opzionale» e ancora in giro.';
  end if;

  -- (2) E NESSUNA FUNZIONE LA NOMINA PIU'. Da sola questa non basterebbe
  --     (un corpo che si crea non e un corpo che risponde), ma senza di
  --     lei una funzione dimenticata resterebbe muta fino al primo uso.
  select count(*) into v_quante
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and position('is_optional' in pg_get_functiondef(p.oid)) > 0;
  if v_quante <> 0 then
    raise exception 'Ci sono ancora % funzioni che nominano la guarnizione opzionale.', v_quante;
  end if;

  -- (3) I PERMESSI DI CIO CHE E STATO RIFATTO. Una funzione o una vista
  --     appena create nascono aperte a chiunque abbia la chiave pubblica,
  --     ed e un errore gia fatto tre volte in questo progetto.
  if has_function_privilege('anon', 'public.espansione_costo_ricetta(uuid)', 'execute') then
    raise exception 'L espansione del costo e eseguibile con la chiave pubblica: rifacendola e rimasta una porta aperta.';
  end if;
  if not has_function_privilege('authenticated', 'public.espansione_costo_ricetta(uuid)', 'execute') then
    raise exception 'L espansione del costo non e piu eseguibile da chi usa il gestionale: rifacendola il permesso e andato perso.';
  end if;
  if has_table_privilege('anon', 'recipe_ingredients_display', 'select')
     or has_table_privilege('anon', 'v_recipe_row_costs', 'select') then
    raise exception 'Una delle due viste rifatte e leggibile con la chiave pubblica.';
  end if;
  if not has_table_privilege('authenticated', 'recipe_ingredients_display', 'select') then
    raise exception 'La vista che legge lo staff non e piu leggibile: rifacendola il permesso e andato perso.';
  end if;

  -- --- l esempio, costruito qui e solo qui ------------------------------
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Verifica impossibile: nessun titolare in user_roles.';
  end if;

  select id into v_ente from entities where entity_type = 'srls' limit 1;
  if v_ente is null then select id into v_ente from entities limit 1; end if;
  if v_ente is null then
    raise exception 'Verifica impossibile: nessuna societa in entities.';
  end if;

  insert into ingredients (entity_id, name, unit, category, current_price)
  values (v_ente, 'VERIFICA-guarnizione', 'kg', 'verdura', 10)
  returning id into v_ing;

  insert into recipes (name, category, recipe_type, yield_quantity, yield_unit, portions_yield)
  values ('VERIFICA-preparazione', 'primo', 'preparazione', 1, 'kg', 1) returning id into v_prep;
  insert into recipes (name, category, recipe_type, portions_yield)
  values ('VERIFICA-piatto', 'primo', 'piatto_finito', 1) returning id into v_piatto;
  v_miei := v_miei || v_prep || v_piatto;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_prep, v_ing, 2, 'kg');
  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
  values (v_piatto, v_prep, 3, 'kg') returning id into v_riga;

  -- (4) `espansione_costo_ricetta` — la forma nuova, e la ricorsione che
  --     scende dentro la preparazione: 3 kg di preparazione, 2 kg di
  --     ingrediente a dose, resa 1 kg, quindi moltiplicatore 6.
  select count(*) into v_quante from espansione_costo_ricetta(v_piatto);
  if v_quante <> 1 then
    raise exception 'L espansione del costo torna % righe invece di 1.', v_quante;
  end if;
  select * into r from espansione_costo_ricetta(v_piatto);
  if r.ingredient_id is distinct from v_ing or r.multiplier <> 6 or r.profondita <> 2 then
    raise exception 'L espansione sbaglia: moltiplicatore %, profondita %.', r.multiplier, r.profondita;
  end if;

  -- (5) La VISTA dei costi di riga risponde, e col numero giusto:
  --     6 kg x 10 euro = 60.
  select costo into v_costo from v_recipe_row_costs where recipe_ingredient_id = v_riga;
  if v_costo is null or v_costo <> 60 then
    raise exception 'Il costo della riga e % invece di 60.', coalesce(v_costo::text, 'vuoto');
  end if;

  -- (6) La VISTA che legge lo staff risponde.
  select count(*) into v_quante from recipe_ingredients_display where recipe_id = v_piatto;
  if v_quante <> 1 then
    raise exception 'La vista dello staff torna % righe invece di 1.', v_quante;
  end if;

  -- (7) `fabbisogno_preparazione`: 2 dosi = 4 kg.
  select * into r from fabbisogno_preparazione(v_prep, 2);
  if r.ingredient_id is distinct from v_ing or r.quantita <> 4 then
    raise exception 'Il fabbisogno di 2 dosi e % invece di 4.', coalesce(r.quantita::text, 'vuoto');
  end if;

  -- (8) `duplica_ricetta` — copiava anche la colonna sparita.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select (duplica_ricetta(v_piatto, 'VERIFICA-copia') ->> 'id')::uuid into v_copia;
  if v_copia is null then
    raise exception 'La duplicazione non ha restituito nessuna ricetta.';
  end if;
  v_miei := v_miei || v_copia;
  select count(*) into v_quante from recipe_ingredients where recipe_id = v_copia;
  if v_quante <> 1 then
    raise exception 'La copia ha % righe invece di 1.', v_quante;
  end if;
  perform set_config('request.jwt.claims', null, true);

  -- (9) `ingredienti_del_menu` e `simula_prezzo_ingrediente`, che
  --     chiedevano tutt e due l espansione filtrata.
  insert into menus (name, is_active) values ('VERIFICA-carta', false) returning id into v_menu;
  insert into menu_items (menu_id, recipe_id, category, selling_price) values (v_menu, v_piatto, 'primo', 100);

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_quante from ingredienti_del_menu(v_menu);
  if v_quante <> 1 then
    raise exception 'Gli ingredienti del menu sono % invece di 1.', v_quante;
  end if;
  select count(*) into v_quante from simula_prezzo_ingrediente(v_menu, v_ing, 10);
  if v_quante <> 1 then
    raise exception 'La simulazione del prezzo torna % righe invece di 1.', v_quante;
  end if;

  -- (10) `prodotti_troppo_piccoli` e `registra_storico_costi`: qui non
  --      conta il numero, conta che RISPONDANO senza morire.
  select count(*) into v_quante from prodotti_troppo_piccoli();
  select registra_storico_costi(array[v_piatto], 'composizione', 'VERIFICA') into v_n;
  perform set_config('request.jwt.claims', null, true);

  -- (11) `storico_al_cambio_riga`: il trigger aveva un ramo sulla colonna
  --      sparita. Si tocca una riga e si pretende che non esploda.
  update recipe_ingredients set quantity = 4 where id = v_riga;

  -- --- si toglie SOLO quello che questa verifica ha creato --------------
  -- ⚠️ Per identificativo, raccolti in un elenco mentre si creavano: mai
  --    «l ultima riga», che il 26/08 ha cancellato uno sconto vero.
  delete from menu_items where menu_id = v_menu;
  delete from menus where id = v_menu;
  delete from storico_costi_ricetta where recipe_id = any(v_miei);
  delete from recipe_ingredients where recipe_id = any(v_miei);
  delete from recipes where id = any(v_miei);
  delete from ingredients where id = v_ing;

  -- ⚠️ E LE LAPIDI CHE QUESTA VERIFICA HA LASCIATO, tolte una per una.
  --    Cancellando le proprie righe da tabelle sorvegliate, il registro
  --    delle cancellazioni ne conserva una copia — e quel registro e
  --    ESIBIBILE: righe finte la dentro sono dati di prova in mezzo ai
  --    dati veri. Si tolgono SOLO quelle riconoscibili come proprie,
  --    per identificativo o per il legame con cio che questa verifica
  --    ha creato. Mai un criterio che potrebbe pescare un dato vero.
  delete from deleted_records
   where record_id = any(array[v_ing::text, v_menu::text, v_riga::text] || v_miei::text[])
      or record->>'recipe_id' = any(v_miei::text[])
      or record->>'menu_id' = v_menu::text
      or record->>'ingredient_id' = v_ing::text;

  perform pretendi_nessun_residuo(v_foto, 'la verifica della guarnizione opzionale');
  raise notice 'Guarnizione opzionale tolta: 9 funzioni e 2 viste rifatte e CHIAMATE, permessi invariati, food cost identico.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000023', 'via_la_guarnizione_opzionale') on conflict (version) do nothing;
