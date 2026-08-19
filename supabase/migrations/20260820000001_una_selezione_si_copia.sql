-- =====================================================================
-- UNA SELEZIONE SI COPIA — blocco 2 del mandato dei finger food
-- 20/08/2026
-- =====================================================================
-- Mandato: docs/mandati/20260819_i_finger_food_e_lo_storico_dei_costi.md
--
-- Richiesta di Alessio, scelta fra due strade il 19/08: «Selezione da 6» e
-- «Selezione da 8» si somigliano, e ricomporre da zero la seconda e' lavoro
-- ripetuto su una schermata dove ne inserira' decine.
--
-- 🔴 PERCHE' PASSA DAL CORRIDOIO: la copia tocca TRE tabelle — `recipes`,
-- `recipe_ingredients`, `recipe_steps` — ed e' tutto-o-niente per senso. Una
-- copia a meta' sarebbe **una ricetta col nome giusto e senza dentro
-- niente**: nessun errore, e un food cost di zero euro che ha l'aria di
-- essere un numero. E' esattamente la forma dichiarata il 19/08 — *una
-- risposta piu' corta che ha l'aria di essere intera*.
--
-- ⚠️ E' `security invoker`, non `definer`, ed e' una scelta: scrivere su
-- queste tre tabelle e' gia' riservato al titolare dalla RLS (nove policy,
-- tutte con `is_titolare()`), quindi la funzione non ha niente da
-- scavalcare. Un `definer` qui aggiungerebbe **una diciassettesima funzione
-- da sorvegliare** e un portiere da tenere allineato a mano, per ottenere
-- ciò che la RLS fa gia' da sola.
--
-- ⚠️ COSA NON SI COPIA, e la ragione di ognuna — perche' una copia
-- silenziosamente parziale e' il difetto che questa funzione evita:
--   · `pronta_per_carta` → una copia non l'ha riletta nessuno. Nasce in
--     sviluppo, come ogni ricetta nuova;
--   · `in_carta` → e' un RIFLESSO, lo scrive solo il trigger `e_in_carta()`:
--     una copia non e' in nessun menu, e il valore lo decide lui, non noi;
--   · `photo_url` → la fotografia e' di un altro piatto. Copiarla farebbe
--     vedere la selezione da 6 sulla scheda di quella da 8;
--   · lo storico di stato → e' un registro: la storia della copia comincia
--     adesso, non eredita quella dell'originale;
--   · i video → sono allegati dell'originale.
-- Ciò che si copia sono **le righe e i passi**, cioe' il lavoro vero.
--
-- ⚠️ E LA FUNZIONE DICE QUANTO HA COPIATO (righe e passi), non solo
-- l'identificativo: cosi' la schermata puo' dirlo a chi guarda invece di
-- lasciargli contare. Un «fatto» che non porta i numeri e' la stessa forma
-- di una lettura tagliata che non si denuncia.
-- =====================================================================

create or replace function duplica_ricetta(
  p_recipe_id uuid,
  p_nome text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
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
    waste_percentage, prep_note, is_optional
  )
  select v_nuova, ingredient_id, component_recipe_id, quantity, unit,
         waste_percentage, prep_note, is_optional
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
$$;

comment on function duplica_ricetta(uuid, text) is
  'Copia una ricetta con le sue righe e i suoi passi, in una transazione sola (20/08/2026). NON copia pronta_per_carta, in_carta (e'' un riflesso), la fotografia, lo storico di stato e i video: le ragioni stanno nella migrazione. Restituisce quante righe e quanti passi ha copiato, perche'' la schermata possa dirlo.';

revoke all on function duplica_ricetta(uuid, text) from public, anon, authenticated;
grant execute on function duplica_ricetta(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit    uuid;
  v_ing    uuid;
  v_ente   uuid;
  v_f1     uuid;
  v_f2     uuid;
  v_sel    uuid;
  v_esito  jsonb;
  v_copia  uuid;
  v_copia2 uuid;
  v_nome_letto text;
  v_n      integer;
  v_costo  numeric;
  v_costoc numeric;
  v_lap_p  integer;
  v_lap_d  integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_lap_p from deleted_records;
  select id into v_ente from entities order by created_at limit 1;

  insert into ingredients (entity_id, name, category, unit, current_price)
    values (v_ente, '__VERIFICA__ copia alice', 'pesce', 'kg', 20)
    returning id into v_ing;

  insert into recipes (name, category, portions_yield, recipe_type, yield_quantity, yield_unit)
    values ('__VERIFICA__ copia bocconcino 1', 'antipasto', 1, 'finger', 1, 'pz')
    returning id into v_f1;
  insert into recipes (name, category, portions_yield, recipe_type, yield_quantity, yield_unit)
    values ('__VERIFICA__ copia bocconcino 2', 'antipasto', 1, 'finger', 1, 'pz')
    returning id into v_f2;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
    values (v_f1, v_ing, 0.010, 'kg'), (v_f2, v_ing, 0.010, 'kg');

  insert into recipes (name, category, portions_yield, recipe_type, pronta_per_carta)
    values ('__VERIFICA__ copia selezione', 'antipasto', 1, 'piatto_finito', true)
    returning id into v_sel;
  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
    values (v_sel, v_f1, 1, 'pz'), (v_sel, v_f2, 1, 'pz');
  insert into recipe_steps (recipe_id, step_number, phase, description)
    values (v_sel, 1, 'cottura', '__VERIFICA__ impiatta');

  -- 1 · La copia porta con se' le righe e i passi, E LI DICHIARA.
  v_esito := duplica_ricetta(v_sel, null);
  v_copia := (v_esito->>'id')::uuid;
  if (v_esito->>'righe')::int <> 2 then
    raise exception 'La copia dichiara % righe invece di 2.', v_esito->>'righe';
  end if;
  if (v_esito->>'passi')::int <> 1 then
    raise exception 'La copia dichiara % passi invece di 1.', v_esito->>'passi';
  end if;

  -- ⚠️ E le righe si CONTANO nel database, non si crede al numero
  -- restituito: se la funzione dicesse 2 e ne avesse scritte 0, il valore
  -- di ritorno sarebbe l'unico posto dove la copia e' completa.
  select count(*) into v_n from recipe_ingredients where recipe_id = v_copia;
  if v_n <> 2 then
    raise exception 'Nel database la copia ha % righe invece di 2.', v_n;
  end if;
  select count(*) into v_n from recipe_steps where recipe_id = v_copia;
  if v_n <> 1 then
    raise exception 'Nel database la copia ha % passi invece di 1.', v_n;
  end if;

  -- 2 · 🔴 IL CONTROLLO CHE CONTA DAVVERO: la copia COSTA quanto
  --     l'originale. Contare le righe non basta — righe copiate senza la
  --     quantita' darebbero due righe e zero euro.
  select food_cost_base into v_costo  from v_recipe_costs where recipe_id = v_sel;
  select food_cost_base into v_costoc from v_recipe_costs where recipe_id = v_copia;
  if v_costoc is distinct from v_costo then
    raise exception 'La copia costa % e l''originale %.',
      coalesce(v_costoc::text, 'NULLO'), coalesce(v_costo::text, 'NULLO');
  end if;
  if coalesce(v_costo, 0) <= 0 then
    raise exception 'L''originale costa zero: questo controllo non distinguerebbe niente.';
  end if;

  -- 3 · Il nome non e' lo stesso dell'originale...
  select name into v_nome_letto from recipes where id = v_copia;
  if v_nome_letto = '__VERIFICA__ copia selezione' then
    raise exception 'La copia ha lo stesso nome dell''originale.';
  end if;

  -- ...e un nome proposto VINCE sul predefinito. ⚠️ Senza questo controllo
  -- il parametro potrebbe essere ignorato del tutto e la prova passerebbe:
  -- il nome sarebbe comunque diverso dall'originale.
  v_copia2 := (duplica_ricetta(v_sel, '  __VERIFICA__ copia da otto  ')->>'id')::uuid;
  select name into v_nome_letto from recipes where id = v_copia2;
  if v_nome_letto <> '__VERIFICA__ copia da otto' then
    raise exception 'Il nome proposto e'' diventato «%».', v_nome_letto;
  end if;

  -- 4 · «Pronta per carta» NON si eredita: nessuno ha riletto la copia.
  if (select pronta_per_carta from recipes where id = v_copia) then
    raise exception 'La copia e'' nata gia'' pronta per la carta.';
  end if;

  -- =========== PULIZIA ===========
  delete from recipe_ingredients
    where recipe_id in (select id from recipes where name like '__VERIFICA__ copia%')
       or component_recipe_id in (select id from recipes where name like '__VERIFICA__ copia%');
  delete from recipe_steps
    where recipe_id in (select id from recipes where name like '__VERIFICA__ copia%');
  delete from recipes where name like '__VERIFICA__ copia%';
  delete from ingredients where name like '__VERIFICA__ copia%';

  select count(*) into v_lap_d from deleted_records;
  if v_lap_d <> v_lap_p then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.', v_lap_d - v_lap_p;
  end if;
  if exists (select 1 from recipes where name like '__VERIFICA__ copia%') then
    raise exception 'La verifica ha lasciato delle ricette finte.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Una selezione si copia intera: righe, passi e costo identico.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260820000001', 'una_selezione_si_copia')
on conflict (version) do nothing;
