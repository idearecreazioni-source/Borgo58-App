-- =====================================================================
-- La lista della spesa (Fase A del mandato «filiera della spesa»)
-- =====================================================================
-- Il mandato dice: «Cosa esiste gia': lotti, consumi, ingredienti,
-- diciture fornitore, prezzi storici. Cosa manca: la soglia di scorta.»
-- Andando a vedere, il modulo della lista c'era gia' quasi tutto — righe
-- automatiche e manuali, chiusura con acquisto e carico. Mancavano tre
-- cose, e la prima e' quella che tiene ferme le altre due:
--
--   1. **La soglia non si poteva scrivere da nessuna parte.** La colonna
--      esisteva dal primo giorno ed era solo MOSTRATA in Magazzino. Con
--      la soglia sempre vuota, la riga automatica non poteva nascere: il
--      pulsante «aggiungi quelli sotto soglia» rispondeva «nessuno», e
--      sembrava che funzionasse. E' lo stesso modo di fallire del
--      magazzino che non scendeva — tutto acceso, e muto.
--   2. **La lista non diceva i numeri veri.** La quantita' veniva
--      congelata quando la riga nasceva; se nel frattempo arrivava merce,
--      restava scritto il fabbisogno di ieri. Il mandato chiede giacenza,
--      soglia e fabbisogno, e li chiede **letti dallo stesso conteggio
--      del magazzino, mai da una copia** (lezione di `posti_liberi()` e
--      `orderTotals()`).
--   3. **Una riga rientrata non lo diceva.** Comprato il prodotto da
--      un'altra parte, la riga restava li' identica. Non si cancella da
--      sola — la lista e' sua, e il sistema propone senza decidere — ma
--      adesso dichiara «ora ce n'e' abbastanza» e lui la barra.
--
-- ⚠️ **Nessuna soglia viene inventata dal sistema.** Un ingrediente senza
--    soglia non entra MAI in lista da solo. Una soglia sbagliata che
--    sembra giusta e' peggio di una soglia assente: e' la stessa lezione
--    dello scarto a zero, e vale doppio qui, perche' una lista della
--    spesa che propone da sola le quantita' finisce in un ordine vero.
--    La proposta automatica delle soglie e' fuori perimetro finche' non
--    ci saranno mesi di consumi veri.
--
-- ⚠️ **La Fase A poteva nascere muta.** Fino a stanotte la giacenza non
--    scendeva mai (rilievo 7 del referto, chiuso poche ore fa): nessun
--    ingrediente sarebbe mai finito sotto soglia, e questa lista sarebbe
--    stata costruita, funzionante e silenziosa per sempre. E' il motivo
--    per cui il mandato metteva il magazzino PRIMA di questa fase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La soglia si scrive quando l'ingrediente nasce
-- ---------------------------------------------------------------------
-- ⚠️ Un parametro in piu' fa una funzione NUOVA, non la stessa con
--    un'opzione: due `create_ingredient` sovrapposte renderebbero
--    ambigua ogni chiamata per nome (42725, a tempo di esecuzione, sulla
--    creazione di un ingrediente che oggi funziona). Stessa trappola di
--    `register_stock_delivery` il 12/08 e di `segnala_allarme` il 13/08:
--    si CANCELLA la vecchia firma e si ricrea.
drop function if exists create_ingredient(
  uuid, text, ingredient_category, unit_type, numeric, ingredient_source,
  uuid, uuid, allergen[], month_code[], storage_type, integer, numeric,
  text, text
);

create or replace function create_ingredient(
  p_entity_id uuid,
  p_name text,
  p_category ingredient_category,
  p_unit unit_type,
  p_current_price numeric default 0,
  p_source_type ingredient_source default 'fornitore_esterno'::ingredient_source,
  p_supplier_id uuid default null,
  p_producer_entity_id uuid default null,
  p_allergens allergen[] default '{}'::allergen[],
  p_seasonality month_code[] default '{}'::month_code[],
  p_storage_type storage_type default null,
  p_shelf_life_days integer default null,
  p_waste_percentage_default numeric default 0,
  p_haccp_receiving_temp text default null,
  p_haccp_notes text default null,
  p_stock_minimum_threshold numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
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
    shelf_life_days, waste_percentage_default, haccp_receiving_temp, haccp_notes,
    stock_minimum_threshold
  ) values (
    p_entity_id, btrim(p_name), p_category, p_unit, p_current_price,
    coalesce(p_source_type, 'fornitore_esterno'), p_supplier_id,
    p_producer_entity_id, coalesce(p_allergens, '{}'),
    coalesce(p_seasonality, '{}'), p_storage_type, p_shelf_life_days,
    coalesce(p_waste_percentage_default, 0), p_haccp_receiving_temp, p_haccp_notes,
    p_stock_minimum_threshold
  )
  returning * into v_row;

  -- Lo storico parte SEMPRE dal prezzo iniziale, nella stessa transazione.
  insert into price_history (ingredient_id, price, supplier_id, source, note)
  values (v_row.id, p_current_price, p_supplier_id, 'manuale', 'Prezzo iniziale');

  return to_jsonb(v_row);
end;
$funzione$;

-- ⚠️ Dopo un `drop` i permessi tornano quelli di partenza — eseguibile da
--    chiunque abbia la chiave pubblica del sito. Va richiusa a mano.
revoke all on function create_ingredient(
  uuid, text, ingredient_category, unit_type, numeric, ingredient_source,
  uuid, uuid, allergen[], month_code[], storage_type, integer, numeric,
  text, text, numeric
) from public, anon;
grant execute on function create_ingredient(
  uuid, text, ingredient_category, unit_type, numeric, ingredient_source,
  uuid, uuid, allergen[], month_code[], storage_type, integer, numeric,
  text, text, numeric
) to authenticated;

-- Un vincolo sulla colonna, perche' la regola valga anche entrando da
-- un'altra porta (la modifica dell'ingrediente e' una scrittura diretta).
alter table ingredients drop constraint if exists scorta_minima_positiva;
alter table ingredients add constraint scorta_minima_positiva
  check (stock_minimum_threshold is null or stock_minimum_threshold > 0);

comment on column ingredients.stock_minimum_threshold is
  'Sotto questa quantita'' l''ingrediente entra da solo nella lista della spesa. Facoltativa e mai proposta dal sistema: senza mesi di consumi veri, una soglia inventata sarebbe un numero credibile e sbagliato.';

-- ---------------------------------------------------------------------
-- 2. Lo stato «ordinata», che serve alla Fase B
-- ---------------------------------------------------------------------
-- Oggi non lo scrive nessuno: lo scrivera' l'invio dell'ordine. Sta qui
-- perche' il percorso di una riga (da comprare → ordinata → acquistata)
-- e' una cosa sola, e spezzarlo in due migrazioni vorrebbe dire toccare
-- due volte lo stesso vincolo.
alter table shopping_list_items drop constraint if exists shopping_list_items_status_check;
alter table shopping_list_items add constraint shopping_list_items_status_check
  check (status in ('da_comprare', 'ordinata', 'acquistato'));

-- ---------------------------------------------------------------------
-- 3. La lista, coi numeri letti dal magazzino e non da una copia
-- ---------------------------------------------------------------------
create or replace function lista_spesa()
returns table (
  id                uuid,
  ingredient_id     uuid,
  nome              text,
  unita             text,
  quantita_da_comprare numeric,
  origine           text,
  stato             text,
  nota              text,
  supplier_id       uuid,
  fornitore         text,
  in_lista_dal      timestamptz,
  giacenza          numeric,
  soglia            numeric,
  mancante          numeric,
  rientrata         boolean
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  -- `security definer` gira senza RLS: il controllo va rimesso dentro.
  -- Qui escono nomi di fornitori e quantita' d'acquisto.
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' vedere la lista della spesa completa';
  end if;

  return query
  select
    sli.id,
    sli.ingredient_id,
    coalesce(i.name, sli.custom_name)::text,
    coalesce(sli.unit, i.unit)::text,
    sli.quantity_needed,
    sli.source::text,
    sli.status::text,
    sli.note,
    sli.supplier_id,
    f.name::text,
    sli.created_at,
    -- La giacenza si legge dalla stessa vista che usa il Magazzino: due
    -- conteggi diversi finirebbero per dire due numeri diversi davanti
    -- allo stesso prodotto.
    v.current_quantity,
    i.stock_minimum_threshold,
    case
      when i.stock_minimum_threshold is null then null
      else greatest(i.stock_minimum_threshold - coalesce(v.current_quantity, 0), 0)
    end,
    -- «Rientrata»: la riga e' nata perche' mancava, e adesso ce n'e'
    -- abbastanza. Non si cancella da sola — la lista e' di Alessio, e il
    -- sistema propone senza decidere — ma smette di far comprare roba
    -- che c'e' gia'.
    (sli.source = 'soglia_minima'
     and sli.status = 'da_comprare'
     and i.stock_minimum_threshold is not null
     and coalesce(v.current_quantity, 0) >= i.stock_minimum_threshold)
  from shopping_list_items sli
  left join ingredients i    on i.id = sli.ingredient_id
  left join suppliers f      on f.id = sli.supplier_id
  left join v_stock_levels v on v.ingredient_id = sli.ingredient_id
  order by
    case sli.status when 'da_comprare' then 0 when 'ordinata' then 1 else 2 end,
    sli.created_at desc;
end;
$funzione$;

comment on function lista_spesa() is
  'La lista della spesa con i numeri veri: giacenza e soglia lette dal conteggio del magazzino, non congelate quando la riga e'' nata.';

revoke all on function lista_spesa() from public, anon, authenticated;
grant execute on function lista_spesa() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente     uuid;
  v_titolare uuid;
  v_staff    uuid;
  v_ing      uuid;
  v_senza    uuid;
  v_riga     record;
  n          integer;
  respinto   boolean;
begin
  select id into v_ente from entities order by created_at limit 1;
  if v_ente is null then raise exception 'Nessuna entita''.'; end if;
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'Servono un titolare e uno staff in user_roles per questa verifica.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- 1. La soglia si scrive alla nascita dell'ingrediente.
  v_ing := ((create_ingredient(
      v_ente, 'PROVA SPESA pomodoro', 'verdura'::ingredient_category, 'kg'::unit_type,
      3.00, 'fornitore_esterno'::ingredient_source, null, null,
      '{}'::allergen[], '{}'::month_code[], null, null, 0, null, null,
      5))->>'id')::uuid;
  if (select stock_minimum_threshold from ingredients where id = v_ing) <> 5 then
    raise exception 'La scorta minima non e'' stata scritta alla creazione.';
  end if;

  -- 2. Zero non e' «nessuna soglia»: sarebbe una soglia che non scatta mai.
  respinto := false;
  begin
    perform create_ingredient(v_ente, 'PROVA SPESA zero', 'verdura'::ingredient_category,
      'kg'::unit_type, 1.00, 'fornitore_esterno'::ingredient_source, null, null,
      '{}'::allergen[], '{}'::month_code[], null, null, 0, null, null, 0);
  exception when sqlstate 'P0001' then respinto := true;
           when sqlstate '23514' then respinto := true;
  end;
  if not respinto then raise exception 'Una scorta minima di zero e'' stata accettata.'; end if;

  -- ...e nemmeno entrando dalla porta della modifica diretta.
  respinto := false;
  begin
    update ingredients set stock_minimum_threshold = -1 where id = v_ing;
  exception when sqlstate '23514' then respinto := true;
  end;
  if not respinto then raise exception 'Una scorta minima negativa e'' passata dalla modifica diretta.'; end if;

  -- 3. Un ingrediente SENZA soglia non entra mai in lista da solo.
  v_senza := ((create_ingredient(
      v_ente, 'PROVA SPESA senza soglia', 'verdura'::ingredient_category, 'kg'::unit_type,
      2.00))->>'id')::uuid;

  perform add_below_threshold_items();
  select count(*) into n from shopping_list_items where ingredient_id = v_senza;
  if n <> 0 then
    raise exception 'Un ingrediente senza soglia e'' finito in lista da solo.';
  end if;

  -- 4. Uno sotto soglia ci entra, e la riga porta i numeri VERI.
  select count(*) into n from shopping_list_items
   where ingredient_id = v_ing and status = 'da_comprare';
  if n <> 1 then
    raise exception 'L''ingrediente sotto soglia non e'' entrato in lista (righe %).', n;
  end if;

  select * into v_riga from lista_spesa() where ingredient_id = v_ing;
  if v_riga.giacenza is distinct from 0 then
    raise exception 'La giacenza in lista dovrebbe essere 0, risulta %.', v_riga.giacenza;
  end if;
  if v_riga.soglia <> 5 then
    raise exception 'La soglia in lista dovrebbe essere 5, risulta %.', v_riga.soglia;
  end if;
  if v_riga.mancante <> 5 then
    raise exception 'Il fabbisogno dovrebbe essere 5, risulta %.', v_riga.mancante;
  end if;
  if v_riga.origine <> 'soglia_minima' then
    raise exception 'La riga automatica non si distingue da una manuale.';
  end if;
  if v_riga.rientrata then
    raise exception 'Una riga con la cella vuota risulta gia'' rientrata.';
  end if;

  -- 5. Arriva la merce: i numeri della lista si aggiornano da soli,
  --    perche' vengono letti e non copiati. E la riga dichiara che ormai
  --    ce n'e' abbastanza, invece di far comprare due volte.
  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost)
  values (v_ing, 8, 8, 3.00);

  select * into v_riga from lista_spesa() where ingredient_id = v_ing;
  if v_riga.giacenza <> 8 then
    raise exception 'La lista non ha visto la merce arrivata: giacenza %.', v_riga.giacenza;
  end if;
  if v_riga.mancante <> 0 then
    raise exception 'Il fabbisogno doveva azzerarsi, risulta %.', v_riga.mancante;
  end if;
  if not v_riga.rientrata then
    raise exception 'La riga non dichiara che ormai ce n''e'' abbastanza.';
  end if;

  -- 6. ...ma non sparisce da sola: la lista e' di Alessio.
  select count(*) into n from shopping_list_items where ingredient_id = v_ing;
  if n <> 1 then
    raise exception 'La riga rientrata e'' stata cancellata dal sistema invece che da lui.';
  end if;

  -- 7. Non si duplica: un secondo giro non aggiunge la stessa riga.
  perform add_below_threshold_items();
  select count(*) into n from shopping_list_items where ingredient_id = v_ing;
  if n <> 1 then raise exception 'La riga e'' stata aggiunta due volte (ora %).', n; end if;

  -- 8. Lo stato «ordinata» e' ammesso (lo scrivera' la Fase B).
  update shopping_list_items set status = 'ordinata' where ingredient_id = v_ing;
  respinto := false;
  begin
    update shopping_list_items set status = 'inventato' where ingredient_id = v_ing;
  exception when sqlstate '23514' then respinto := true;
  end;
  if not respinto then raise exception 'Uno stato inventato e'' stato accettato.'; end if;
  update shopping_list_items set status = 'da_comprare' where ingredient_id = v_ing;

  perform set_config('request.jwt.claims', null, true);

  -- 9. Il portiere: la lista completa non e' dello staff (ci sono
  --    fornitori e quantita' d'acquisto). Un rifiuto, non un elenco vuoto.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  respinto := false;
  begin perform lista_spesa();
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Lo staff ha potuto leggere la lista della spesa completa.'; end if;

  -- ...e non puo' nemmeno creare un ingrediente dopo la ricreazione della
  --    funzione: dopo un `drop` i permessi tornano quelli di partenza.
  respinto := false;
  begin
    perform create_ingredient(v_ente, 'PROVA SPESA staff', 'verdura'::ingredient_category,
      'kg'::unit_type, 1.00);
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Lo staff ha potuto creare un ingrediente.'; end if;
  perform set_config('request.jwt.claims', null, true);

  -- 10. L'elenco di chi puo' bussare da fuori non e' cresciuto: dopo un
  --     `drop` la funzione ricreata sarebbe aperta al mondo.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  select count(*) into n from funzioni_aperte_ad_anon();
  if n <> 12 then
    raise exception 'L''elenco di chi puo'' bussare da fuori e'' passato a %.', n;
  end if;
  perform set_config('request.jwt.claims', null, true);

  -- ---- Pulizia (§5 punto 8) ----------------------------------------
  delete from shopping_list_items where ingredient_id in (v_ing, v_senza);
  delete from stock_lots where ingredient_id in (v_ing, v_senza);
  delete from price_history where ingredient_id in (v_ing, v_senza);
  delete from ingredients where id in (v_ing, v_senza);

  select count(*) into n from ingredients where name like 'PROVA SPESA%';
  if n <> 0 then raise exception 'La prova ha lasciato % ingredienti.', n; end if;

  raise notice 'Lista della spesa: la soglia si scrive, nessuna viene inventata, e i numeri in lista sono letti dal magazzino.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260813000014', 'la_lista_della_spesa')
on conflict (version) do nothing;

select count(*) filter (where stock_minimum_threshold is not null) as con_soglia,
       count(*)                                                    as ingredienti
  from ingredients where active;
