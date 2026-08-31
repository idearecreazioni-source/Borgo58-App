-- =====================================================================
-- LA CASELLA «VA IN CARTA» ARRIVA DAVVERO AL DATABASE — 31/08/2026
-- =====================================================================
--
-- 🔴 IL DIFETTO, ED E' MIO E DI STANOTTE: la colonna `va_in_carta` e' nata
-- alle 2, la Cantina la legge, e **nessuna schermata la scriveva**. La
-- Cantina diceva «nessun prodotto segnato "va in carta"» — una frase giusta
-- e senza uscita: non c'era **nessun posto** dove segnarlo.
-- ⚠️ Quinta volta in due giorni della stessa famiglia, e la rete costruita
-- stamattina NON l'avrebbe presa: guarda le funzioni, non le colonne.
--
-- 🔴 E LA META' PIU' INSIDIOSA: messa la casella sulla scheda, in MODIFICA
-- funziona (`update` diretto passa tutti i campi) e in CREAZIONE **no** —
-- perche' si passa da `create_ingredient(...)`, che ha i parametri
-- nominati uno per uno. Sarebbe stata la quarta ricomparsa della trappola
-- del 16/08, scritta nel commento di questa stessa funzione: *un valore che
-- si vede nella schermata non e' un valore che arriva al database*.
--
-- ⚠️ IL PARAMETRO VA IN FONDO: davanti sposterebbe le chiamate posizionali
-- gia' scritte. E il corpo e' preso dal database VIVO, non dalla migrazione
-- che l'ha creata (regola del 18/08).
-- ⚠️ E si DROPPA prima: in Postgres un parametro in piu' fa una funzione
-- NUOVA, e due sovrapposte rendono ambigua ogni chiamata per nome (42725, a
-- runtime, sul primo prodotto creato).

drop function if exists create_ingredient(uuid, text, text, unit_type, numeric,
  ingredient_source, uuid, uuid, allergen[], month_code[], storage_type, numeric,
  text, text, numeric, boolean, boolean);

CREATE OR REPLACE FUNCTION public.create_ingredient(p_entity_id uuid, p_name text, p_category text, p_unit unit_type, p_current_price numeric, p_source_type ingredient_source DEFAULT 'fornitore_esterno'::ingredient_source, p_supplier_id uuid DEFAULT NULL::uuid, p_producer_entity_id uuid DEFAULT NULL::uuid, p_allergens allergen[] DEFAULT '{}'::allergen[], p_seasonality month_code[] DEFAULT '{}'::month_code[], p_storage_type storage_type DEFAULT NULL::storage_type, p_waste_percentage_default numeric DEFAULT 0, p_haccp_receiving_temp text DEFAULT NULL::text, p_haccp_notes text DEFAULT NULL::text, p_stock_minimum_threshold numeric DEFAULT NULL::numeric, p_alimentare boolean DEFAULT true, p_tenuto_in_magazzino boolean DEFAULT true, p_va_in_carta boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Zero non e' «nessuna soglia»: sarebbe una soglia che non scatta mai,
  -- cioe' una riga vuota che sembra compilata. Se non serve, si lascia
  -- vuota (null) e l'ingrediente non entra in lista da solo.
  if p_stock_minimum_threshold is not null and p_stock_minimum_threshold <= 0 then
    raise exception 'La scorta minima deve essere maggiore di zero, oppure lasciata vuota';
  end if;

  insert into ingredients (
    entity_id, name, category, unit, current_price, source_type,
    supplier_id, producer_entity_id, allergens, seasonality, storage_type,
    waste_percentage_default, temperatura_attesa, haccp_notes,
    stock_minimum_threshold, alimentare, tenuto_in_magazzino, va_in_carta
  ) values (
    p_entity_id, btrim(p_name), p_category, p_unit, p_current_price,
    coalesce(p_source_type, 'fornitore_esterno'), p_supplier_id,
    p_producer_entity_id, coalesce(p_allergens, '{}'),
    coalesce(p_seasonality, '{}'), p_storage_type,
    coalesce(p_waste_percentage_default, 0), p_haccp_receiving_temp, p_haccp_notes,
    p_stock_minimum_threshold,
    -- ⚠️ `coalesce` e non il valore secco: chi non passa niente ottiene il
    -- predefinito di sempre, e nessuna chiamata gia' scritta cambia
    -- comportamento.
    coalesce(p_alimentare, true), coalesce(p_tenuto_in_magazzino, true),
    -- ⚠️ FALSO se nessuno lo dice: un prodotto che finisce in carta senza
    -- che qualcuno l'abbia spuntato **si vende a un cliente**, e quello e'
    -- l'errore che costa. Il contrario si vede subito: manca dal menu.
    coalesce(p_va_in_carta, false)
  )
  returning * into v_row;

  -- Lo storico parte SEMPRE dal prezzo iniziale, nella stessa transazione.
  insert into price_history (ingredient_id, price, supplier_id, source, note)
  values (v_row.id, p_current_price, p_supplier_id, 'manuale', 'Prezzo iniziale');

  return to_jsonb(v_row);
end;
$function$;

-- ⚠️ DOPO UN `drop` i permessi tornano aperti al mondo: si richiudono a mano,
--    e la verifica lo controlla invece di darlo per fatto.
revoke all on function create_ingredient(uuid, text, text, unit_type, numeric,
  ingredient_source, uuid, uuid, allergen[], month_code[], storage_type, numeric,
  text, text, numeric, boolean, boolean, boolean) from public, anon, authenticated;
grant execute on function create_ingredient(uuid, text, text, unit_type, numeric,
  ingredient_source, uuid, uuid, allergen[], month_code[], storage_type, numeric,
  text, text, numeric, boolean, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione ANNULLATA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_lap_prima integer; v_lap_dopo integer; v_ent uuid; v_cat text;
  v_r jsonb; v_quante integer; v_anon boolean; v_tit uuid;
begin
  select count(*) into v_lap_prima from deleted_records;

  begin
    select id into v_ent from entities where entity_type='srls';
    select codice into v_cat from categorie_ingrediente where mondo='vini' limit 1;
    -- ⚠️ Dentro una migrazione `is_titolare()` e' FALSO — gira come
    --    `postgres`, non come utente applicativo (§6). Senza questa riga il
    --    portiere della funzione rifiuta e la verifica si ferma sul proprio
    --    controllo: trappola del 16/08.
    select user_id into v_tit from user_roles where role = 'titolare' limit 1;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

    -- (1) UNA SOLA funzione con questo nome: due sovrapposte renderebbero
    --     ambigua ogni chiamata (42725), e l'errore arriverebbe a runtime.
    select count(*)::integer into v_quante from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='create_ingredient';
    if v_quante <> 1 then
      raise exception 'create_ingredient esiste in % versioni: le chiamate per nome diventano ambigue', v_quante;
    end if;

    -- (2) IL VALORE ARRIVA. E' tutto il punto della migrazione.
    select create_ingredient(v_ent, '__prova va in carta__', v_cat, 'pz'::unit_type, 1,
      null, null, null, null, null, null, null, null, null, null, true, true, true) into v_r;
    if (v_r->>'va_in_carta')::boolean is distinct from true then
      raise exception 'Il segno «va in carta» NON arriva al database: %', coalesce(v_r->>'va_in_carta','(vuoto)');
    end if;

    -- (3) E chi non lo dice ottiene FALSO, non un valore comodo.
    select create_ingredient(v_ent, '__prova senza segno__', v_cat, 'pz'::unit_type, 1) into v_r;
    if (v_r->>'va_in_carta')::boolean is distinct from false then
      raise exception 'Senza dirlo il prodotto nasce «in carta»: %', coalesce(v_r->>'va_in_carta','(vuoto)');
    end if;

    -- (4) La porta e' richiusa dopo il drop.
    select has_function_privilege('anon',
      'create_ingredient(uuid, text, text, unit_type, numeric, ingredient_source, uuid, uuid, allergen[], month_code[], storage_type, numeric, text, text, numeric, boolean, boolean, boolean)',
      'execute') into v_anon;
    if v_anon then
      raise exception 'Dopo il drop la funzione e'' rimasta aperta ad anon';
    end if;

    perform set_config('request.jwt.claims', null, true);
    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  select count(*) into v_lap_dopo from deleted_records;
  if v_lap_prima <> v_lap_dopo then
    raise exception 'la verifica ha lasciato % lapidi', v_lap_dopo - v_lap_prima;
  end if;

  raise notice 'Fatto: il segno «va in carta» arriva in creazione, chi tace ottiene falso, e la porta e'' richiusa. Annullato: % lapidi prima e dopo.', v_lap_prima;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260831000008', 'il_segno_della_carta_arriva_in_creazione') on conflict (version) do nothing;
