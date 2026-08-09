-- ---------------------------------------------------------------------
-- Blocco 4 del Piano correzioni: le tre rifiniture atomiche
-- ---------------------------------------------------------------------
-- Gli ultimi tre punti del Piano, piu' un difetto aggravante trovato
-- dalla verifica incrociata:
--
--  1. createIngredient: ingrediente e prima riga dello storico prezzi in
--     due scritture separate — un fallimento a meta' lasciava un
--     ingrediente il cui storico non parte mai dal prezzo iniziale, e
--     l'utente che riprova crea un doppione.
--  2. setActiveMenu: due update separate sulla stessa tabella — se la
--     seconda falliva NESSUN menu restava attivo: comande e sala senza
--     carta, senza un messaggio chiaro del perche'.
--  3. swapStepOrder (scambio ordine fasi ricetta): TRE update dal browser
--     con il trucco del numero temporaneo -1 per aggirare il vincolo di
--     unicita' — e NESSUNA delle tre controllava l'errore: un fallimento
--     a meta' lasciava una fase parcheggiata a -1 in silenzio.
--
-- Da questa migrazione ognuna e' UNA funzione Postgres invocata solo
-- attraverso il corridoio (Contratto B4).
--
-- Idempotente (§7 punto 3).

-- ---------------------------------------------------------------------
-- 1. Nuovo ingrediente con storico prezzi
-- ---------------------------------------------------------------------
create or replace function create_ingredient(
  p_entity_id                uuid,
  p_name                     text,
  p_category                 ingredient_category,
  p_unit                     unit_type,
  p_current_price            numeric default 0,
  p_source_type              ingredient_source default 'fornitore_esterno',
  p_supplier_id              uuid default null,
  p_producer_entity_id       uuid default null,
  p_allergens                allergen[] default '{}',
  p_seasonality              month_code[] default '{}',
  p_storage_type             storage_type default null,
  p_shelf_life_days          integer default null,
  p_waste_percentage_default numeric default 0,
  p_haccp_receiving_temp     text default null,
  p_haccp_notes              text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row ingredients%rowtype;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' gestire gli ingredienti';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'Serve il nome dell''ingrediente';
  end if;
  if p_current_price is null or p_current_price < 0 then
    raise exception 'Il prezzo non puo'' essere negativo o mancante';
  end if;

  insert into ingredients (
    entity_id, name, category, unit, current_price, source_type,
    supplier_id, producer_entity_id, allergens, seasonality, storage_type,
    shelf_life_days, waste_percentage_default, haccp_receiving_temp, haccp_notes
  ) values (
    p_entity_id, btrim(p_name), p_category, p_unit, p_current_price,
    coalesce(p_source_type, 'fornitore_esterno'), p_supplier_id,
    p_producer_entity_id, coalesce(p_allergens, '{}'),
    coalesce(p_seasonality, '{}'), p_storage_type, p_shelf_life_days,
    coalesce(p_waste_percentage_default, 0), p_haccp_receiving_temp, p_haccp_notes
  )
  returning * into v_row;

  -- Lo storico parte SEMPRE dal prezzo iniziale, nella stessa transazione.
  insert into price_history (ingredient_id, price, supplier_id, source, note)
  values (v_row.id, p_current_price, p_supplier_id, 'manuale', 'Prezzo iniziale');

  return to_jsonb(v_row);
end;
$$;

comment on function create_ingredient is
  'Ingrediente + prima riga dello storico prezzi in una transazione. Restituisce la riga creata (il client naviga con l''id). Solo titolare.';

revoke all on function create_ingredient(uuid, text, ingredient_category, unit_type, numeric, ingredient_source, uuid, uuid, allergen[], month_code[], storage_type, integer, numeric, text, text) from public;
grant execute on function create_ingredient(uuid, text, ingredient_category, unit_type, numeric, ingredient_source, uuid, uuid, allergen[], month_code[], storage_type, integer, numeric, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Cambio del menu attivo
-- ---------------------------------------------------------------------
create or replace function set_active_menu(p_menu_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row menus%rowtype;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' cambiare il menu attivo';
  end if;

  perform 1 from menus where id = p_menu_id for update;
  if not found then
    raise exception 'Menu non trovato';
  end if;

  -- Spegni-poi-accendi NELLA STESSA transazione: l'ordine rispetta
  -- l'indice unico sul menu attivo, e un fallimento riporta allo stato di
  -- prima — mai piu' lo stato "nessun menu attivo" che lasciava la sala
  -- senza carta.
  update menus set is_active = false where is_active and id <> p_menu_id;
  update menus set is_active = true where id = p_menu_id
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

comment on function set_active_menu is
  'Attiva un menu spegnendo l''attuale nella stessa transazione: in nessun istante osservabile restano zero o due menu attivi. Restituisce la riga del menu attivato. Solo titolare.';

revoke all on function set_active_menu(uuid) from public;
grant execute on function set_active_menu(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Scambio d'ordine di due fasi di una ricetta
-- ---------------------------------------------------------------------
create or replace function swap_recipe_steps(p_step_a uuid, p_step_b uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a recipe_steps%rowtype;
  v_b recipe_steps%rowtype;
  v_temp integer;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' riordinare le fasi di una ricetta';
  end if;
  if p_step_a = p_step_b then
    raise exception 'Le due fasi da scambiare devono essere diverse';
  end if;

  select * into v_a from recipe_steps where id = p_step_a for update;
  if v_a.id is null then
    raise exception 'Fase non trovata';
  end if;
  select * into v_b from recipe_steps where id = p_step_b for update;
  if v_b.id is null then
    raise exception 'Fase non trovata';
  end if;
  if v_a.recipe_id <> v_b.recipe_id then
    raise exception 'Le due fasi appartengono a ricette diverse';
  end if;

  -- Numero temporaneo garantito libero: sotto il minimo della ricetta.
  -- (Il -1 fisso di prima poteva collidere con un -1 rimasto parcheggiato
  -- proprio dal difetto che questa funzione corregge.)
  select least(-1, min(step_number) - 1) into v_temp
  from recipe_steps where recipe_id = v_a.recipe_id;

  update recipe_steps set step_number = v_temp where id = v_a.id;
  update recipe_steps set step_number = v_a.step_number where id = v_b.id;
  update recipe_steps set step_number = v_b.step_number where id = v_a.id;
end;
$$;

comment on function swap_recipe_steps is
  'Scambia l''ordine di due fasi della stessa ricetta in una transazione (numero temporaneo per il vincolo di unicita''). Prima erano tre update dal browser SENZA controllo degli errori: un fallimento a meta'' parcheggiava una fase a -1 in silenzio. Solo titolare.';

revoke all on function swap_recipe_steps(uuid, uuid) from public;
grant execute on function swap_recipe_steps(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Verifica sul campo (§7 punti 2-3)
-- ---------------------------------------------------------------------
-- Il cambio menu tocca per necessita' il menu attivo REALE: lo stato
-- originale viene fotografato all'inizio e ripristinato alla fine, e la
-- verifica si ferma con un errore se il ripristino non corrisponde.
do $verifica$
declare
  v_titolare uuid;
  v_staff    uuid;
  e1 uuid;
  v_ing jsonb; v_ing_id uuid;
  v_menu_orig uuid;
  m1 uuid; m2 uuid;
  v_ret jsonb;
  v_ric uuid; s1 uuid; s2 uuid;
  n integer;
  respinto boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into e1 from entities order by created_at limit 1;

  -- 1) INGREDIENTE: riga + storico insieme, riga restituita con id
  v_ing := create_ingredient(p_entity_id => e1, p_name => '__Prova B4 ingrediente__',
                             p_category => (enum_range(null::ingredient_category))[1],
                             p_unit => 'kg', p_current_price => 3.50);
  v_ing_id := (v_ing->>'id')::uuid;
  if v_ing_id is null then
    raise exception 'create_ingredient non ha restituito la riga con l''id.';
  end if;
  select count(*) into n from price_history
   where ingredient_id = v_ing_id and note = 'Prezzo iniziale' and price = 3.50;
  if n <> 1 then
    raise exception 'Storico prezzi dell''ingrediente non inizializzato (righe: %).', n;
  end if;

  -- Prezzo negativo respinto
  respinto := false;
  begin
    perform create_ingredient(p_entity_id => e1, p_name => 'x',
                              p_category => (enum_range(null::ingredient_category))[1],
                              p_unit => 'kg', p_current_price => -1);
  exception when others then respinto := true;
  end;
  if not respinto then
    raise exception 'Un ingrediente con prezzo negativo NON e'' stato respinto.';
  end if;

  -- 2) MENU: fotografa l'attivo reale, prova le transizioni, ripristina
  select id into v_menu_orig from menus where is_active;
  insert into menus (name) values ('__Prova B4 menu 1__') returning id into m1;
  insert into menus (name) values ('__Prova B4 menu 2__') returning id into m2;

  v_ret := set_active_menu(m1);
  if (v_ret->>'id')::uuid is distinct from m1 or not (v_ret->>'is_active')::boolean then
    raise exception 'set_active_menu non ha restituito il menu attivato.';
  end if;
  select count(*) into n from menus where is_active;
  if n <> 1 then
    raise exception 'Dopo il cambio risultano % menu attivi invece di 1.', n;
  end if;

  perform set_active_menu(m2);
  select count(*) into n from menus where is_active;
  if n <> 1 or not exists (select 1 from menus where id = m2 and is_active) then
    raise exception 'La seconda transizione di menu non ha lasciato esattamente m2 attivo.';
  end if;

  -- 3) FASI RICETTA: scambio atomico
  insert into recipes (name, category) values ('__Prova B4 ricetta__', 'primo')
  returning id into v_ric;
  insert into recipe_steps (recipe_id, step_number, phase, description)
  values (v_ric, 1, 'mise_en_place', 'prima') returning id into s1;
  insert into recipe_steps (recipe_id, step_number, phase, description)
  values (v_ric, 2, 'cottura', 'seconda') returning id into s2;

  perform swap_recipe_steps(s1, s2);
  if not exists (select 1 from recipe_steps where id = s1 and step_number = 2)
     or not exists (select 1 from recipe_steps where id = s2 and step_number = 1) then
    raise exception 'Lo scambio delle fasi non ha invertito i numeri.';
  end if;
  if exists (select 1 from recipe_steps where recipe_id = v_ric and step_number < 1) then
    raise exception 'Rimasta una fase parcheggiata su un numero temporaneo.';
  end if;

  -- Fasi di ricette diverse: respinto
  respinto := false;
  begin
    perform swap_recipe_steps(s1, gen_random_uuid());
  exception when others then respinto := true;
  end;
  if not respinto then
    raise exception 'Uno scambio con fase inesistente NON e'' stato respinto.';
  end if;

  -- 4) STAFF respinto sul cambio menu
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    respinto := false;
    begin
      perform set_active_menu(m1);
    exception when others then respinto := true;
    end;
    if not respinto then
      raise exception 'Un utente STAFF ha potuto cambiare il menu attivo.';
    end if;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  end if;

  -- PULIZIA E RIPRISTINO
  delete from recipe_steps where recipe_id = v_ric;
  delete from recipes where id = v_ric;
  delete from ingredients where id = v_ing_id;  -- storico a cascata
  delete from menus where id in (m1, m2);       -- erano di prova, m2 era attivo
  if v_menu_orig is not null then
    perform set_active_menu(v_menu_orig);
    if not exists (select 1 from menus where id = v_menu_orig and is_active) then
      raise exception 'RIPRISTINO FALLITO: il menu attivo originale non e'' tornato attivo.';
    end if;
  end if;
  select count(*) into n from menus where is_active;
  if v_menu_orig is null and n <> 0 then
    raise exception 'RIPRISTINO FALLITO: non doveva restare alcun menu attivo.';
  end if;

  raise notice 'Blocco 4 verificato: ingrediente con storico in transazione, transizioni menu sempre a UN attivo con ripristino dell''originale, scambio fasi atomico senza numeri parcheggiati, staff respinto. Prove ripulite.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260809000005', 'blocco4_rifiniture_atomiche')
on conflict (version) do nothing;

-- Riepilogo: 3 funzioni, zero residui, un solo menu attivo (quello vero).
select
  (select count(*) from pg_proc where proname in
    ('create_ingredient','set_active_menu','swap_recipe_steps'))            as funzioni_create,
  (select count(*) from ingredients where name = '__Prova B4 ingrediente__') as residui_ingredienti,
  (select count(*) from menus where name like '__Prova B4%')                 as residui_menu,
  (select count(*) from recipes where name = '__Prova B4 ricetta__')         as residui_ricette,
  (select count(*) from menus where is_active)                               as menu_attivi;
