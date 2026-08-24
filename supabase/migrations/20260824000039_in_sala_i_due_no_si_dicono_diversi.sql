-- =====================================================================
-- IN SALA I DUE «NO» SI COMPORTANO UGUALE MA NON SI DICONO UGUALE
-- 24/08/2026 — coda della 20260824000035, trovata GUARDANDO la schermata
-- =====================================================================
-- 🔴 IL DIFETTO, visto aprendo le Comande e non rileggendo il codice:
-- `allergeni_della_riga` restituiva un `eliminabile` booleano, cioè **due
-- risposte**. I tre stati del Ricettario — «si può togliere», «non si può
-- togliere», «non l'ha ancora guardato nessuno» — arrivavano in sala
-- schiacciati in due, e il pulsante spento diceva a tutti e due:
--
--     «non si può togliere»
--
-- ⚠️ SU UN ALLERGENE CHE NESSUNO HA ESAMINATO QUELLA FRASE È
-- UN'AFFERMAZIONE CHE IL GESTIONALE NON PUÒ FARE. È la regola del 19/08 —
-- *assenza di informazione e informazione di assenza sono due cose diverse*
-- — nel posto dove costa di più: davanti a un cliente che chiede se il
-- piatto si può fare senza qualcosa. «Non si può» chiude la conversazione;
-- «nessuno l'ha ancora guardato, chiedi in cucina» la apre.
--
-- ⚠️ IL COMPORTAMENTO NON CAMBIA, e non deve: tutti e due restano SPENTI,
-- perché fra i due il gestionale sbaglia sempre dalla parte di non
-- promettere. Cambia **la frase**, che è l'unica cosa che il cameriere può
-- riferire al cliente.
--
-- 🔴 E LA COSA CHE VALE PIÙ DEL DIFETTO: la migrazione che ha creato quella
-- funzione (…035) aveva scritto nel proprio commento *«i tre stati»*, e poi
-- ne restituiva due. Il commento diceva il vero sull'intenzione e il falso
-- sul codice — e nessuna prova poteva accorgersene, perché la verifica
-- controllava che l'allergene comparisse, non **come veniva chiamato**.
-- =====================================================================

drop function if exists public.allergeni_della_riga(uuid);

create or replace function public.allergeni_della_riga(p_order_item_id uuid)
returns table(
  allergene        allergen,
  stato            text,
  eliminabile      boolean,
  applicata        boolean,
  costo_aggiuntivo numeric,
  descrizione      text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_recipe uuid;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select oi.recipe_id into v_recipe from order_items oi where oi.id = p_order_item_id;
  if v_recipe is null then return; end if;

  return query
  select
    ap.allergene,
    -- 🔴 LO STATO INTERO, non lo schiacciamento a due: è la sola cosa da cui
    --    la sala può ricavare la frase giusta.
    ap.stato,
    ap.stato = 'eliminabile',
    exists (select 1 from order_item_sostituzioni os
             where os.order_item_id = p_order_item_id and os.allergene = ap.allergene),
    ap.costo_aggiuntivo,
    -- La frase che si vede prima di toccare: quella applicata la si rilegge
    -- fotografata, quella ancora da fare si compone dal Ricettario.
    coalesce(
      (select string_agg(os.descrizione, ' · ' order by os.descrizione)
         from order_item_sostituzioni os
        where os.order_item_id = p_order_item_id and os.allergene = ap.allergene),
      (select string_agg(
                x.nome || case when x.sostituto is null then ' (si toglie)' else ' → ' || x.sostituto end,
                ' · ' order by x.nome)
         from ingredienti_con_allergene(v_recipe, ap.allergene) x
        where x.coperto)
    )
  from allergeni_del_piatto(v_recipe) ap
  order by 1;
end;
$function$;

comment on function public.allergeni_della_riga(uuid) is
  'Gli allergeni del piatto di questa riga di comanda, col loro STATO INTERO: si puo'' togliere, non si puo'' togliere, oppure nessuno l''ha ancora guardato. In sala gli ultimi due sono tutti e due spenti, ma non si dicono con la stessa frase.';

revoke all on function public.allergeni_della_riga(uuid) from public, anon, authenticated;
grant execute on function public.allergeni_della_riga(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_lapidi   integer;
  v_lapidi2  integer;
  v_entita   uuid;
  v_ing      uuid;
  v_sub      uuid;
  v_piatto   uuid;
  v_conto    uuid;
  v_riga     uuid;
  r          record;
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_entita from entities limit 1;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  insert into ingredients (entity_id, name, category, unit, allergens)
  values (v_entita, '__VERIFICA__ tre stati latte', 'latticini', 'kg', array['latte']::allergen[])
  returning id into v_ing;
  insert into ingredients (entity_id, name, category, unit, allergens)
  values (v_entita, '__VERIFICA__ tre stati sostituto', 'latticini', 'kg', '{}'::allergen[])
  returning id into v_sub;

  insert into recipes (name, category, recipe_type, portions_yield)
  values ('__VERIFICA__ piatto tre stati', 'primo', 'piatto_finito', 1)
  returning id into v_piatto;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_piatto, v_ing, 0.1, 'kg');

  insert into orders (table_label, status, coperti, entity_id)
  values ('__VERIFICA__ tre stati', 'aperto', 2, v_entita)
  returning id into v_conto;
  insert into order_items (order_id, recipe_id, destination, quantity, unit_price, sent_at)
  values (v_conto, v_piatto, 'cucina', 1, 10.00, now())
  returning id into v_riga;

  -- (a) NESSUNA DICHIARAZIONE → «non deciso», e NON «non eliminabile».
  --     ⚠️ È il caso che il difetto schiacciava: prima qui arrivava solo
  --     `eliminabile = false`, indistinguibile dal caso (b).
  select * into r from allergeni_della_riga(v_riga) x where x.allergene = 'latte';
  if r.stato <> 'non_deciso' then
    raise exception 'Senza dichiarazione lo stato in sala dovrebbe essere «non_deciso», e'' «%».', r.stato;
  end if;
  if r.eliminabile then
    raise exception 'Senza dichiarazione la riga risulta togliibile in sala.';
  end if;

  -- (b) DICHIARATO NON TOGLIIBILE → stato diverso, comportamento uguale.
  insert into scelte_allergene (recipe_id, allergene, eliminabile)
  values (v_piatto, 'latte', false);
  select * into r from allergeni_della_riga(v_riga) x where x.allergene = 'latte';
  if r.stato <> 'non_eliminabile' then
    raise exception 'Dichiarato non togliibile, lo stato e'' «%».', r.stato;
  end if;
  if r.eliminabile then
    raise exception 'Dichiarato non togliibile, la riga risulta togliibile.';
  end if;

  -- (c) DICHIARATO TOGLIIBILE, con la copertura completa.
  insert into sostituzioni_allergene (recipe_id, allergene, ingrediente_id, sostituto_id, costo_aggiuntivo)
  values (v_piatto, 'latte', v_ing, v_sub, 0.80);
  update scelte_allergene set eliminabile = true
   where recipe_id = v_piatto and allergene = 'latte';

  select * into r from allergeni_della_riga(v_riga) x where x.allergene = 'latte';
  if r.stato <> 'eliminabile' or not r.eliminabile then
    raise exception 'Con la copertura completa lo stato e'' «%» ed eliminabile e'' %.', r.stato, r.eliminabile;
  end if;
  if r.costo_aggiuntivo <> 0.80 then
    raise exception 'Il supplemento in sala dovrebbe essere 0,80: e'' %.', r.costo_aggiuntivo;
  end if;

  -- Pulizia.
  alter table order_items disable trigger trg_riga_servita;
  alter table order_items disable trigger trg_log_delete;
  delete from order_item_sostituzioni where order_item_id = v_riga;
  delete from order_items where order_id = v_conto;
  delete from orders where id = v_conto;
  alter table order_items enable trigger trg_riga_servita;
  alter table order_items enable trigger trg_log_delete;
  if (select count(*) from pg_trigger
       where tgrelid = 'order_items'::regclass and tgenabled = 'D') > 0 then
    raise exception 'Un guardiano delle righe e'' rimasto spento.';
  end if;

  delete from scelte_allergene where recipe_id = v_piatto;
  delete from sostituzioni_allergene where recipe_id = v_piatto;
  delete from recipe_ingredients where recipe_id = v_piatto;
  delete from recipes where id = v_piatto;
  delete from ingredients where id in (v_ing, v_sub);

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'In sala i tre stati arrivano interi.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000039', 'in_sala_i_due_no_si_dicono_diversi') on conflict (version) do nothing;
