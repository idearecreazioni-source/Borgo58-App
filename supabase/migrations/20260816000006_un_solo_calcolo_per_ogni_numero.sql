-- =====================================================================
-- Un solo calcolo per ogni numero
-- =====================================================================
-- Blocco 2 del mandato di correzione (16/08/2026). Tre punti in cui una
-- formula del database era stata riscritta nel browser. Due su tre danno
-- oggi lo stesso risultato — ma il problema non e' il risultato di oggi,
-- e' che alla prossima modifica bisogna ricordarsi di due posti.
--
-- ⚠️ IL TERZO NON DA' LO STESSO RISULTATO: E' ROTTO. Il simulatore
-- what-if del menu ricalcolava il food cost con una terza copia della
-- formula che **non conosce le preparazioni**. Su una riga-componente
-- `ri.ingredient` e' vuoto, quindi `ri.ingredient.current_price` fa
-- esplodere la schermata: **ogni piatto che contiene un semilavorato
-- rompe il simulatore**. E anche quando non esplodeva guardava i soli
-- ingredienti diretti: con l'approccio «scompongo sempre» di Alessio, un
-- rincaro dentro una preparazione non mostrava nessun piatto — cioe'
-- rispondeva «nessun piatto e' toccato» a un rincaro che tocca tutto.
--
-- LA CURA NON E' SPOSTARE LA FORMULA: E' TOGLIERNE UNA COPIA.
-- La regola 6 del mandato dice che una cura che introduce un secondo
-- posto dove si calcola la stessa cosa e' una cura sbagliata. Quindi qui
-- il food cost si scompone in tre pezzi che si conoscono in un verso
-- solo, senza mai ripetersi:
--
--   1. `espansione_costo_ricetta(ricetta)` — LA RICORSIONE. Attraversa i
--      componenti fino agli ingredienti foglia e dice, per ogni foglia,
--      da quale RIGA di primo livello discende. E' l'unico posto dove si
--      cammina nell'albero.
--   2. `v_recipe_row_costs` — LA FORMULA. Quanto costa una riga di
--      ricetta: quantita' x prezzo x (1 + scarto). E' l'unico posto dove
--      un costo si moltiplica.
--   3. `v_recipe_costs` — LA SOMMA. Diventa `sum()` delle righe diviso le
--      porzioni: **non ha piu' nessuna formula propria**. Le colonne, i
--      tipi e i numeri restano identici a prima (verificato costruendo
--      una ricetta a tre livelli e confrontando a mano).
--
-- Da li' discendono le due cure:
--   * la schermata della ricetta legge il costo di ogni riga da (2)
--     invece di ricalcolarlo;
--   * il simulatore chiede a `simula_prezzo_ingrediente()`, che usa (1)
--     per sapere quanto di quell'ingrediente entra in ogni piatto — anche
--     attraverso due o tre preparazioni — e applica la DIFFERENZA di
--     prezzo al costo che (3) gia' conosce. ⚠️ Non ricalcola il food
--     cost: lo sposta. Ricalcolarlo sarebbe stata la quarta copia.
--
-- Il terzo punto (il totale del conto nel Bar) non ha bisogno di database:
-- il modulo unico `src/lib/calcoli/conto.js` esiste dal 09/08 e il Bar
-- semplicemente non lo usava. Sta nel commit, non qui.
--
-- ⚠️ Stato di partenza VERO, letto col connettore prima di scrivere: il
-- Ricettario e' VUOTO — 0 ricette, 0 menu, 8 ingredienti. Nessun numero
-- esistente puo' cambiare, e nessuno di questi calcoli e' mai stato visto
-- su dati veri. E' anche il motivo per cui la verifica si costruisce da
-- sola una ricetta a tre livelli con dei numeri scelti apposta perche' il
-- risultato si possa controllare a mano.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La ricorsione, in un posto solo
-- ---------------------------------------------------------------------
-- Rispetto alla CTE che stava dentro `v_recipe_costs` c'e' una cosa in
-- piu' e una sola: `riga_id`, cioe' da quale riga di PRIMO livello questa
-- foglia discende. E' quel filo che permette a una schermata di dire
-- «questa riga costa X» senza rifare il conto per conto proprio.
create or replace function espansione_costo_ricetta(p_recipe_id uuid)
returns table (
  riga_id          uuid,
  ingredient_id    uuid,
  multiplier       numeric,
  waste_percentage numeric,
  is_optional      boolean,
  profondita       integer
)
language sql
stable
security invoker
set search_path = public
as $funzione$
  with recursive espansione as (
    select
      ri.id            as riga_id,
      ri.ingredient_id,
      ri.component_recipe_id,
      ri.quantity::numeric as multiplier,
      ri.waste_percentage,
      ri.is_optional,
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
      (e.is_optional or ri2.is_optional),
      e.profondita + 1
    from espansione e
    join recipes comp on comp.id = e.component_recipe_id
    join recipe_ingredients ri2 on ri2.recipe_id = e.component_recipe_id
    where e.component_recipe_id is not null
      and e.profondita < 10
  )
  select riga_id, ingredient_id, multiplier, waste_percentage, is_optional, profondita
    from espansione
   where ingredient_id is not null;
$funzione$;

comment on function espansione_costo_ricetta is
  'L''UNICO posto dove si cammina nell''albero delle preparazioni per contare i costi (16/08/2026, Blocco 2). Restituisce le foglie con il moltiplicatore accumulato e, rispetto alla ricorsione che stava dentro v_recipe_costs, una cosa in piu'' e una sola: la RIGA di primo livello da cui ogni foglia discende. E'' quel filo che permette di valorizzare una riga senza rifare il conto altrove. security invoker: decide la RLS di recipe_ingredients, non una seconda serratura.';

revoke all on function espansione_costo_ricetta(uuid) from public, anon, authenticated;
grant execute on function espansione_costo_ricetta(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. La formula, in un posto solo
-- ---------------------------------------------------------------------
-- Quanto costa una riga di ricetta. Vale identica per una riga-ingrediente
-- (una foglia sola) e per una riga-componente (tutte le foglie che stanno
-- sotto quella preparazione): non ci sono due casi, c'e' una somma sulle
-- foglie che discendono dalla riga.
--
-- ⚠️ `is_optional` viene dall'espansione e non dalla riga: una guarnizione
-- dentro una preparazione resta esclusa anche quando la preparazione non
-- e' opzionale, che e' il comportamento che v_recipe_costs aveva gia'.
create or replace view v_recipe_row_costs
with (security_invoker = true) as
select
  ri.id        as recipe_ingredient_id,
  ri.recipe_id,
  ri.is_optional,
  coalesce(sum(
    case when not e.is_optional then
      e.multiplier * i.current_price
        * (1 + coalesce(e.waste_percentage, i.waste_percentage_default, 0) / 100.0)
    else 0 end
  ), 0)::numeric(14,4) as costo
from recipe_ingredients ri
left join lateral espansione_costo_ricetta(ri.recipe_id) e on e.riga_id = ri.id
left join ingredients i on i.id = e.ingredient_id
group by ri.id, ri.recipe_id, ri.is_optional;

grant select on v_recipe_row_costs to authenticated;

comment on view v_recipe_row_costs is
  'Quanto costa ogni riga di ricetta, ingredienti E componenti, calcolato dal database (16/08/2026, Blocco 2). Prima la schermata della ricetta lo ricalcolava nel browser accanto a v_recipe_costs. E'' l''UNICO posto dove un costo si moltiplica: v_recipe_costs ne e'' la somma e non ha piu'' formule proprie.';

-- ---------------------------------------------------------------------
-- 3. La somma — v_recipe_costs non ha piu' formule sue
-- ---------------------------------------------------------------------
-- ⚠️ CREATE OR REPLACE e non drop+create: `v_menu_item_economics` dipende
-- da questa vista. Colonne, ordine e tipi restano identici — e la verifica
-- non si fida di questa frase, confronta i numeri.
create or replace view v_recipe_costs
with (security_invoker = true) as
select
  r.id as recipe_id,
  r.portions_yield,
  coalesce(sum(rc.costo), 0)::numeric(14,4) as food_cost_base,
  (coalesce(sum(rc.costo), 0) / nullif(r.portions_yield, 0))::numeric(14,4) as food_cost_portion
from recipes r
left join v_recipe_row_costs rc on rc.recipe_id = r.id
group by r.id, r.portions_yield;

grant select on v_recipe_costs to authenticated;

comment on view v_recipe_costs is
  'Food cost di una ricetta: la SOMMA delle sue righe, divisa le porzioni. Dal 16/08/2026 non contiene piu'' nessuna formula propria — la ricorsione sta in espansione_costo_ricetta(), la moltiplicazione in v_recipe_row_costs. security_invoker rispetta la RLS di ingredients: resta di fatto riservata al titolare.';

-- ---------------------------------------------------------------------
-- 4. Il simulatore what-if: lo calcola il database
-- ---------------------------------------------------------------------
-- ⚠️ NON RICALCOLA IL FOOD COST, LO SPOSTA. Il costo di partenza e' quello
-- che v_recipe_costs gia' conosce; qui si aggiunge la sola DIFFERENZA di
-- prezzo moltiplicata per quanto di quell'ingrediente entra davvero nel
-- piatto — attraverso quante preparazioni siano. Rifare la moltiplicazione
-- sarebbe stata la quarta copia della stessa formula.
create or replace function simula_prezzo_ingrediente(
  p_menu_id        uuid,
  p_ingredient_id  uuid,
  p_variazione_pct numeric
)
returns table (
  menu_item_id      uuid,
  piatto            text,
  prezzo_vendita    numeric,
  food_cost_attuale numeric,
  food_cost_simulato numeric,
  pct_attuale       numeric,
  pct_simulata      numeric,
  via_preparazione  boolean
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
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
      and not e.is_optional
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
$funzione$;

comment on function simula_prezzo_ingrediente is
  'Il what-if «e se questo ingrediente rincarasse»: lo calcola il database (16/08/2026, Blocco 2). Prima era una terza copia della formula nel browser, che non conosceva le preparazioni — rompeva la schermata su ogni piatto con un semilavorato e taceva sui rincari che arrivano attraverso una preparazione. Non ricalcola il food cost: applica la differenza di prezzo al costo che v_recipe_costs gia'' conosce. `via_preparazione` dice quando l''ingrediente arriva al piatto passando per un semilavorato — cioe'' proprio il caso che prima era invisibile.';

revoke all on function simula_prezzo_ingrediente(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function simula_prezzo_ingrediente(uuid, uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 4bis. Quali ingredienti si possono simulare
-- ---------------------------------------------------------------------
-- ⚠️ Senza questa, la cura sarebbe a meta': l'elenco a tendina del
-- simulatore era costruito nel browser sui soli ingredienti DIRETTI delle
-- ricette del menu, quindi la cipolla che sta solo dentro un soffritto
-- **non era nemmeno selezionabile**. Si poteva simulare bene soltanto
-- cio' che il simulatore rotto sapeva gia' vedere.
create or replace function ingredienti_del_menu(p_menu_id uuid)
returns table (
  ingredient_id    uuid,
  nome             text,
  solo_in_preparazioni boolean
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
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
     and not e.is_optional
   group by i.id, i.name
   order by i.name;
end;
$funzione$;

comment on function ingredienti_del_menu is
  'Tutti gli ingredienti che un menu consuma davvero, preparazioni attraversate (16/08/2026, Blocco 2). `solo_in_preparazioni` marca quelli che nel menu non compaiono mai in una riga diretta: erano invisibili al simulatore vecchio, che li costruiva nel browser guardando un solo livello.';

revoke all on function ingredienti_del_menu(uuid) from public, anon, authenticated;
grant execute on function ingredienti_del_menu(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Verifica sul campo (§5 punti 1-3)
-- ---------------------------------------------------------------------
-- ⚠️ Nessun gestore d'eccezione sul blocco esterno (lezione del 15/08).
-- ⚠️ Il perimetro e' fatto SOLO di roba creata qui — ingredienti compresi
-- (lezione del 16/08 mattina). I numeri sono scelti apposta perche' il
-- risultato si possa controllare a mano invece che con un'altra query,
-- che sarebbe la stessa formula scritta un'altra volta.
--
-- La ricetta di prova, tre livelli:
--   SOFFRITTO   (resa 2 kg): 1 kg di CIPOLLA a 2,00/kg con 20% di scarto
--                            -> 1 x 2,00 x 1,20 = 2,40
--   RAGU        (resa 4 kg): 1 kg di SOFFRITTO  -> (1/2) x 2,40 = 1,20
--                            2 kg di CARNE a 10,00/kg, scarto 0 -> 20,00
--                            totale 21,20
--   PIATTO      (4 porzioni): 0,5 kg di RAGU -> (0,5/4) x 21,20 = 2,65
--                             0,1 kg di CARNE          -> 1,00
--                             1 kg di BASILICO opzionale -> escluso
--                            base 3,65 -> a porzione 0,9125
do $verifica$
declare
  v_titolare uuid;
  v_staff uuid;
  e1 uuid;
  i_cip uuid; i_car uuid; i_bas uuid;
  r_sof uuid; r_rag uuid; r_pia uuid;
  riga_ragu uuid; riga_carne uuid; riga_bas uuid;
  m_menu uuid; m_item uuid;
  v_base numeric; v_porz numeric; v_costo numeric;
  v_sim  numeric; v_via boolean; v_righe integer;
  respinto boolean;
  n integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into e1 from entities order by created_at limit 1;

  insert into ingredients (entity_id, name, category, unit, current_price, waste_percentage_default)
  values (e1, '__Prova B2 cipolla__', 'verdura', 'kg', 2.00, 20)
  returning id into i_cip;
  insert into ingredients (entity_id, name, category, unit, current_price, waste_percentage_default)
  values (e1, '__Prova B2 carne__', 'carne_rossa', 'kg', 10.00, 0)
  returning id into i_car;
  insert into ingredients (entity_id, name, category, unit, current_price, waste_percentage_default)
  values (e1, '__Prova B2 basilico__', 'verdura', 'kg', 50.00, 0)
  returning id into i_bas;

  insert into recipes (name, category, portions_yield, recipe_type, yield_quantity, yield_unit)
  values ('__Prova B2 soffritto__', 'antipasto', 1, 'preparazione', 2, 'kg')
  returning id into r_sof;
  insert into recipes (name, category, portions_yield, recipe_type, yield_quantity, yield_unit)
  values ('__Prova B2 ragu__', 'antipasto', 1, 'preparazione', 4, 'kg')
  returning id into r_rag;
  insert into recipes (name, category, portions_yield)
  values ('__Prova B2 piatto__', 'primo', 4)
  returning id into r_pia;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (r_sof, i_cip, 1, 'kg');
  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
  values (r_rag, r_sof, 1, 'kg');
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (r_rag, i_car, 2, 'kg');
  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
  values (r_pia, r_rag, 0.5, 'kg') returning id into riga_ragu;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (r_pia, i_car, 0.1, 'kg') returning id into riga_carne;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit, is_optional)
  values (r_pia, i_bas, 1, 'kg', true) returning id into riga_bas;

  -- 5a. LA SOMMA non e' cambiata: i numeri a mano, uno per uno.
  select food_cost_base into v_base from v_recipe_costs where recipe_id = r_sof;
  if v_base <> 2.40 then
    raise exception 'Soffritto: base % invece di 2,40 (lo scarto dell''ingrediente non e'' entrato).', v_base;
  end if;
  select food_cost_base into v_base from v_recipe_costs where recipe_id = r_rag;
  if v_base <> 21.20 then
    raise exception 'Ragu: base % invece di 21,20 (la resa del soffritto non e'' stata divisa).', v_base;
  end if;
  select food_cost_base, food_cost_portion into v_base, v_porz
    from v_recipe_costs where recipe_id = r_pia;
  if v_base <> 3.65 then
    raise exception 'Piatto: base % invece di 3,65.', v_base;
  end if;
  if v_porz <> 0.9125 then
    raise exception 'Piatto: a porzione % invece di 0,9125.', v_porz;
  end if;

  -- 5b. LE RIGHE valorizzate dal database, e la loro somma e' la base.
  select costo into v_costo from v_recipe_row_costs where recipe_ingredient_id = riga_ragu;
  if v_costo <> 2.65 then
    raise exception 'La riga del ragu costa % invece di 2,65.', v_costo;
  end if;
  select costo into v_costo from v_recipe_row_costs where recipe_ingredient_id = riga_carne;
  if v_costo <> 1.00 then
    raise exception 'La riga della carne costa % invece di 1,00.', v_costo;
  end if;
  -- ⚠️ Una riga opzionale costa ZERO, non «il suo prezzo mostrato a parte»:
  -- se costasse, la somma delle righe non sarebbe piu' il food cost.
  select costo into v_costo from v_recipe_row_costs where recipe_ingredient_id = riga_bas;
  if v_costo <> 0 then
    raise exception 'La guarnizione opzionale entra nel costo: %.', v_costo;
  end if;
  select sum(costo) into v_costo from v_recipe_row_costs where recipe_id = r_pia;
  if v_costo <> 3.65 then
    raise exception 'La somma delle righe (%) non e'' il food cost della ricetta (3,65).', v_costo;
  end if;

  -- 5c. IL SIMULATORE. La cipolla sta nel piatto solo attraverso DUE
  -- preparazioni: e' esattamente il caso su cui il vecchio simulatore
  -- taceva, dopo essersi rotto sulla riga del ragu.
  insert into menus (name, valid_from) values ('__Prova B2 menu__', current_date)
  returning id into m_menu;
  insert into menu_items (menu_id, recipe_id, category, selling_price)
  values (m_menu, r_pia, 'primo', 10.00) returning id into m_item;

  select count(*) into v_righe
    from simula_prezzo_ingrediente(m_menu, i_cip, 100);
  if v_righe <> 1 then
    raise exception 'Il simulatore non vede il piatto toccato dalla cipolla: % righe.', v_righe;
  end if;

  select food_cost_simulato, via_preparazione into v_sim, v_via
    from simula_prezzo_ingrediente(m_menu, i_cip, 100);
  -- Raddoppiando la cipolla (2,00 -> 4,00) il soffritto passa da 2,40 a
  -- 4,80; nel ragu vale (1/2) x 4,80 = 2,40 invece di 1,20, quindi il ragu
  -- passa da 21,20 a 22,40; nel piatto la riga del ragu vale
  -- (0,5/4) x 22,40 = 2,80 invece di 2,65. Base 3,80, a porzione 0,95.
  if v_sim <> 0.9500 then
    raise exception 'Simulazione: % invece di 0,95 — la cascata non e'' stata seguita.', v_sim;
  end if;
  if not v_via then
    raise exception 'Il simulatore non dichiara che la cipolla arriva attraverso una preparazione.';
  end if;

  -- E il simulato deve coincidere con quello che il food cost VERO dice
  -- se il prezzo si alza davvero: la simulazione sposta, non inventa.
  update ingredients set current_price = 4.00 where id = i_cip;
  select food_cost_portion into v_porz from v_recipe_costs where recipe_id = r_pia;
  if v_porz <> 0.9500 then
    raise exception 'Col prezzo alzato davvero il food cost e'' % : la simulazione diceva 0,95.', v_porz;
  end if;
  update ingredients set current_price = 2.00 where id = i_cip;

  -- 5c-bis. E la cipolla dev'essere SELEZIONABILE: prima l'elenco a
  -- tendina si costruiva nel browser sui soli ingredienti diretti, quindi
  -- di lei non c'era traccia.
  if not exists (
    select 1 from ingredienti_del_menu(m_menu)
     where ingredient_id = i_cip and solo_in_preparazioni
  ) then
    raise exception 'La cipolla non risulta fra gli ingredienti del menu, o non e'' marcata «solo dentro preparazioni».';
  end if;
  if exists (select 1 from ingredienti_del_menu(m_menu) where ingredient_id = i_bas) then
    raise exception 'Una guarnizione opzionale risulta fra gli ingredienti che il menu consuma.';
  end if;

  -- 5d. Un ingrediente che nel menu non c'e' non produce righe finte.
  select count(*) into v_righe from simula_prezzo_ingrediente(m_menu, i_bas, 50);
  if v_righe <> 0 then
    raise exception 'Il simulatore conta anche una guarnizione opzionale: % righe.', v_righe;
  end if;

  -- 5e. E i prezzi d'acquisto non escono da una security definer: chi non
  -- deve vedere riceve un RIFIUTO, non un elenco vuoto (13/08, i portieri).
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_staff is null then
    raise notice 'Nessuno staff in user_roles: il portiere del simulatore non e'' verificabile qui.';
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    respinto := false;
    begin
      perform simula_prezzo_ingrediente(m_menu, i_cip, 10);
    exception when sqlstate 'P0001' then
      respinto := true;
    end;
    if not respinto then
      raise exception 'Lo staff ha potuto usare il simulatore: da li'' escono i prezzi d''acquisto.';
    end if;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  end if;

  -- PULIZIA. Il Ricettario non e' sorvegliato da deleted_records (scelta
  -- dichiarata l'08/08: una cancellazione di ricetta e' una correzione),
  -- quindi qui non restano lapidi.
  delete from menu_items where menu_id = m_menu;
  delete from menus where id = m_menu;
  delete from recipe_ingredients where recipe_id in (r_sof, r_rag, r_pia);
  delete from recipes where id in (r_sof, r_rag, r_pia);
  delete from price_history where ingredient_id in (i_cip, i_car, i_bas);
  delete from ingredients where id in (i_cip, i_car, i_bas);

  select count(*) into n from ingredients where name like '\_\_Prova B2%';
  if n <> 0 then raise exception 'La verifica ha lasciato % ingredienti.', n; end if;
  select count(*) into n from recipes where name like '\_\_Prova B2%';
  if n <> 0 then raise exception 'La verifica ha lasciato % ricette.', n; end if;
  select count(*) into n from menus where name like '\_\_Prova B2%';
  if n <> 0 then raise exception 'La verifica ha lasciato % menu.', n; end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Blocco 2: una ricorsione, una formula, una somma. Il simulatore segue la cascata invece di rompersi.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260816000006', 'un_solo_calcolo_per_ogni_numero')
on conflict (version) do nothing;

select
  (select count(*) from pg_views where viewname = 'v_recipe_row_costs')  as vista_righe,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'espansione_costo_ricetta') as funzione_espansione,
  (select count(*) from recipes)                                          as ricette,
  (select count(*) from menu_items)                                       as voci_di_menu;
