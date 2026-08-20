-- =====================================================================
-- IL FABBISOGNO DI UN EVENTO — blocco 0 del mandato dei preventivi
-- 20/08/2026
-- =====================================================================
-- Mandato: docs/mandati/20260820_i_preventivi_per_gli_eventi.md
--
-- 🔴 PERCHE' VIENE PRIMA DI TUTTO IL RESTO. Costruire i preventivi sopra un
-- calcolo rotto produrrebbe numeri sbagliati con l'aria di essere giusti — e
-- quei numeri Alessio li mostra **a un cliente, in diretta**, sulla schermata
-- che commuta. E' il posto peggiore del gestionale dove poter sbagliare un
-- conto.
--
-- 🔴 IL DIFETTO, RIPRODOTTO PRIMA DI RIPARARE. `computeEventIngredientNeeds`
-- stimava il fabbisogno di un evento **nel browser**, sommando i soli
-- ingredienti diretti. Una riga di ricetta che contiene una preparazione o un
-- bocconcino ha `ingredient_id` vuoto: la funzione la teneva lo stesso e poi
-- ne leggeva il prezzo. La prova scritta PRIMA della riparazione e' diventata
-- rossa con *«Cannot read properties of null (reading current_price)»* —
-- quindi non un numero sbagliato: **si rompeva**. E si sarebbe rotta su quasi
-- ogni menu vero, perche' Alessio *«scompone sempre»*.
-- ⚠️ Piu' due difetti minori nello stesso posto: ignorava lo **scarto** (200 g
-- puliti si comprano 235) e la **resa** dei componenti.
--
-- 🔴 DOVE VIVE IL CALCOLO, ED E' LA PARTE CHE CONTA. Il numero degli
-- ingredienti di un evento e il food cost di una ricetta **non possono essere
-- calcolati in due posti**: prima o poi direbbero cose diverse e nessuno
-- saprebbe quale credere. E' la lezione tornata quattro volte in tre giorni.
--
-- ⚠️ E LA RIPARAZIONE NON SCRIVE UNA TERZA RICORSIONE: riusa
-- `fabbisogno_preparazione`, che esiste dal 14/08 e sa gia' fare tutto —
-- scende di livello in livello, divide per la **resa** del componente,
-- applica lo **scarto** a ogni foglia, esclude le righe opzionali e onora
-- l'interruttore delle preparazioni che stanno in cella. Qui si aggiunge
-- **solo** la moltiplicazione giusta: quante dosi di quel piatto servono per
-- quelle persone.
--
-- ⚠️ Un limite dichiarato: l'interruttore dei semilavorati in cella guarda la
-- giacenza di **oggi**, e un preventivo parla di fra due mesi. E' la stessa
-- regola che governa lo scarico vero, quindi si tiene — ma il numero e' una
-- stima di oggi, non una promessa su quella sera. E' precisamente il motivo
-- per cui il costo di un preventivo va **fotografato** quando si promette il
-- prezzo, e per cui esiste lo storico dei costi.
-- =====================================================================

create or replace function fabbisogno_menu_evento(
  p_menu_id  uuid,
  p_persone  integer
)
returns table(
  ingredient_id uuid,
  nome          text,
  unita         unit_type,
  quantita      numeric,
  costo         numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Serve un accesso per calcolare il fabbisogno di un evento.';
  end if;
  if p_persone is null or p_persone <= 0 then
    raise exception 'Per quante persone? Serve un numero maggiore di zero.';
  end if;

  return query
  select f.ingredient_id, i.name, i.unit,
         sum(f.quantita)::numeric(14,4),
         sum(f.quantita * i.current_price)::numeric(14,4)
    from menu_items mi
    join recipes r on r.id = mi.recipe_id
    -- ⚠️ LE DOSI, non le persone: un piatto da 4 porzioni servito a 8
    -- persone sono 2 dosi di ricetta. Passare le persone direttamente
    -- moltiplicherebbe per quattro tutto il menu.
    cross join lateral fabbisogno_preparazione(
      mi.recipe_id,
      p_persone::numeric / nullif(r.portions_yield, 0)
    ) f
    join ingredients i on i.id = f.ingredient_id
   where mi.menu_id = p_menu_id
   group by f.ingredient_id, i.name, i.unit
   order by i.name;
end;
$$;

comment on function fabbisogno_menu_evento(uuid, integer) is
  'Quanta materia prima serve per un menu evento a N persone, e quanto costa oggi (20/08/2026). Riusa `fabbisogno_preparazione`: nessuna ricorsione nuova, quindi resa, scarto, righe opzionali e semilavorati in cella si comportano ESATTAMENTE come nello scarico vero del magazzino. ⚠️ Sostituisce un calcolo che si faceva nel browser e che si ROMPEVA su ogni piatto con dentro una preparazione.';

revoke all on function fabbisogno_menu_evento(uuid, integer) from public, anon, authenticated;
grant execute on function fabbisogno_menu_evento(uuid, integer) to authenticated;


-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit   uuid;
  v_ente  uuid;
  v_ing   uuid;
  v_p1    uuid;
  v_p2    uuid;
  v_fing  uuid;
  v_pia   uuid;
  v_menu  uuid;
  v_riga  uuid;
  v_qta   numeric;
  v_costo numeric;
  v_senza numeric;
  v_n     integer;
  v_lap_p integer;
  v_lap_d integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_lap_p from deleted_records;
  select id into v_ente from entities order by created_at limit 1;

  -- LA CATENA A QUATTRO LIVELLI, con i numeri scelti perche' DISTINGUANO.
  -- 8 persone su un piatto da 4 porzioni = 2 dosi:
  --   dal bocconcino  2 x 6 pz x 1 kg              = 12,000 kg
  --   dall'ingrediente diretto 2 x 0,5 kg + 20%    =  1,200 kg
  --   totale                                        13,200 kg -> 26,40 €
  -- Le risposte sbagliate danno numeri tutti diversi: 1,200 (catena persa),
  -- 13,000 (scarto ignorato), 52,800 (porzioni ignorate).
  insert into ingredients (entity_id, name, category, unit, current_price, waste_percentage_default)
    values (v_ente, '__VERIFICA__ evento alice', 'pesce', 'kg', 2, 0)
    returning id into v_ing;

  insert into recipes (name, category, portions_yield, recipe_type, yield_quantity, yield_unit)
    values ('__VERIFICA__ evento base', 'antipasto', 1, 'preparazione', 1, 'kg') returning id into v_p1;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
    values (v_p1, v_ing, 1, 'kg');

  insert into recipes (name, category, portions_yield, recipe_type, yield_quantity, yield_unit)
    values ('__VERIFICA__ evento comp', 'antipasto', 1, 'preparazione', 1, 'kg') returning id into v_p2;
  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
    values (v_p2, v_p1, 1, 'kg');

  insert into recipes (name, category, portions_yield, recipe_type, yield_quantity, yield_unit)
    values ('__VERIFICA__ evento finger', 'antipasto', 1, 'finger', 1, 'pz') returning id into v_fing;
  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
    values (v_fing, v_p2, 1, 'kg');

  insert into recipes (name, category, portions_yield, recipe_type, pronta_per_carta)
    values ('__VERIFICA__ evento piatto', 'antipasto', 4, 'piatto_finito', true) returning id into v_pia;
  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
    values (v_pia, v_fing, 6, 'pz');
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit, waste_percentage)
    values (v_pia, v_ing, 0.5, 'kg', 20) returning id into v_riga;

  -- ⚠️ Il menu nasce SPENTO: un solo menu attivo e' ammesso, e accenderne
  -- uno qui spegnerebbe la carta vera.
  insert into menus (name, structure, is_active)
    values ('__VERIFICA__ evento menu', 'alla_carta', false) returning id into v_menu;
  insert into menu_items (menu_id, recipe_id, category, selling_price)
    values (v_menu, v_pia, 'antipasto', 30);

  -- 1 · LA CATENA ARRIVA IN FONDO, e il numero e' quello giusto.
  select quantita, costo into v_qta, v_costo
    from fabbisogno_menu_evento(v_menu, 8) where ingredient_id = v_ing;
  if v_qta is null then
    raise exception 'L''ingrediente non compare nel fabbisogno: la catena si e'' fermata.';
  end if;
  if round(v_qta, 3) <> 13.200 then
    raise exception 'Il fabbisogno e'' % invece di 13,200 kg.', v_qta;
  end if;
  if round(v_costo, 2) <> 26.40 then
    raise exception 'Il costo e'' % invece di 26,40.', v_costo;
  end if;

  -- 2 · NESSUNA RIGA SENZA INGREDIENTE, che era il modo silenzioso di
  --     rompersi: totale giusto e una voce senza nome nell'elenco.
  select count(*) into v_n from fabbisogno_menu_evento(v_menu, 8) where ingredient_id is null;
  if v_n <> 0 then
    raise exception 'Il fabbisogno contiene % righe senza ingrediente.', v_n;
  end if;

  -- 3 · LO SCARTO CAMBIA IL RISULTATO. ⚠️ Senza questo confronto la verifica
  --     passerebbe anche su un calcolo che lo ignora del tutto.
  update recipe_ingredients set waste_percentage = 0 where id = v_riga;
  select quantita into v_senza from fabbisogno_menu_evento(v_menu, 8) where ingredient_id = v_ing;
  update recipe_ingredients set waste_percentage = 20 where id = v_riga;
  if v_senza >= v_qta then
    raise exception 'Lo scarto non cambia niente (% contro %): il calcolo non lo guarda.', v_senza, v_qta;
  end if;
  if round(v_senza, 3) <> 13.000 then
    raise exception 'Senza scarto il fabbisogno e'' % invece di 13,000 kg.', v_senza;
  end if;

  -- 4 · LE PORZIONI CONTANO: 4 persone su un piatto da 4 sono UNA dose.
  select quantita into v_senza from fabbisogno_menu_evento(v_menu, 4) where ingredient_id = v_ing;
  if round(v_senza, 3) <> 6.600 then
    raise exception 'Con la meta'' delle persone il fabbisogno e'' % invece di 6,600 kg.', v_senza;
  end if;

  -- 5 · E ZERO PERSONE NON E'' UNA DOMANDA VALIDA: si rifiuta invece di
  --     rispondere zero, che somiglia a «non serve niente».
  begin
    perform fabbisogno_menu_evento(v_menu, 0);
    raise exception 'Un evento per zero persone ha ricevuto una risposta.';
  exception when raise_exception then
    if sqlerrm like 'Un evento per zero persone%' then raise; end if;
  end;

  -- =========== PULIZIA ===========
  delete from menu_items where menu_id = v_menu;
  delete from menus where id = v_menu;
  delete from recipe_ingredients
    where recipe_id in (select id from recipes where name like '__VERIFICA__ evento%')
       or component_recipe_id in (select id from recipes where name like '__VERIFICA__ evento%');
  delete from storico_costi_ricetta
    where recipe_id in (select id from recipes where name like '__VERIFICA__ evento%');
  delete from recipes where name like '__VERIFICA__ evento%';
  delete from ingredients where name like '__VERIFICA__ evento%';

  select count(*) into v_lap_d from deleted_records;
  if v_lap_d <> v_lap_p then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.', v_lap_d - v_lap_p;
  end if;
  if exists (select 1 from recipes where name like '__VERIFICA__ evento%')
     or exists (select 1 from menus where name like '__VERIFICA__ evento%') then
    raise exception 'La verifica ha lasciato delle righe finte.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Il fabbisogno di un evento regge la catena a quattro livelli, con lo scarto e le porzioni.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260820000005', 'il_fabbisogno_di_un_evento')
on conflict (version) do nothing;
