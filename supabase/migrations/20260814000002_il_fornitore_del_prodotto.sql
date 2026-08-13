-- =====================================================================
-- Una riga della lista eredita il fornitore del prodotto
-- =====================================================================
-- Trovato da Alessio dieci minuti dopo aver messo in funzione la Fase B,
-- e la sua domanda conteneva gia' mezza diagnosi:
--
--   «Ho aggiunto il fornitore a mandorle e melanzane ma non genera
--    messaggi. Lo fa perche' ho aggiunto il fornitore dopo che
--    l'articolo e' entrato nella lista della spesa?»
--
-- **No, e la risposta vera e' peggiore della sua ipotesi**: il fornitore
-- l'aveva messo **sul prodotto** (Augeri sulle melanzane, Mililli sulle
-- mandorle), mentre la riga della lista ne teneva **uno suo**, rimasto
-- vuoto. Nessun errore da nessuna parte: la lista mostrava le righe, la
-- schermata degli ordini le metteva nel riquadro «senza fornitore», e
-- tutti e due i posti dicevano il vero. Solo che lui aveva gia' risposto
-- alla domanda, in un'altra schermata, e il gestionale non lo sapeva.
--
-- ⚠️ **E' la forma di difetto che questo progetto cerca apposta**: due
--    posti dove vive la stessa informazione, e nessuno dei due sbagliato.
--    Un dato chiesto due volte e' un dato che prima o poi si contraddice
--    — qui non si contraddiceva, taceva, che e' anche peggio perche' non
--    somiglia a un guasto.
--
-- **La correzione e' in tre punti, e nessuno da solo basta:**
--   1. una riga che nasce **eredita** il fornitore abituale del prodotto
--      (entrambe le porte: il controllo automatico delle scorte e
--      l'aggiunta a mano);
--   2. le righe **gia' in lista** vengono sistemate una volta, qui —
--      altrimenti la correzione varrebbe solo per il futuro e le sue due
--      righe resterebbero mute;
--   3. il fornitore si puo' **cambiare sulla riga** dalla schermata
--      della lista (fuori da questa migrazione): ereditarlo senza poterlo
--      correggere sposterebbe soltanto il punto in cui ci si blocca.
--
-- ⚠️ **Ereditare non e' scegliere in silenzio**: il fornitore lo ha
--    scritto lui sulla scheda del prodotto, la riga lo mostra, e il
--    messaggio si rilegge prima di partire. Il sistema propone quello che
--    lui ha gia' detto; non inventa un fornitore che non ha mai nominato.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Chi nasce sotto soglia nasce col suo fornitore
-- ---------------------------------------------------------------------
create or replace function add_below_threshold_items()
returns integer
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_count integer;
begin
  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source, supplier_id)
  select
    v.ingredient_id,
    greatest(v.stock_minimum_threshold - v.current_quantity, 0),
    v.unit,
    'soglia_minima',
    -- Il fornitore abituale, quello scritto sulla scheda del prodotto.
    -- Senza, la riga nasce muta: la lista la mostra e nessun ordine la
    -- puo' raccogliere.
    i.supplier_id
  from v_stock_levels v
  join ingredients i on i.id = v.ingredient_id
  where v.below_threshold
    and not exists (
      select 1 from shopping_list_items sli
      where sli.ingredient_id = v.ingredient_id and sli.status <> 'acquistato'
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$funzione$;

-- ⚠️ Corretto nella stessa passata: il controllo dei doppioni guardava
--    solo le righe `da_comprare`. Una riga gia' ORDINATA non lo era, e
--    al giro dopo lo stesso prodotto sarebbe rientrato in lista una
--    seconda volta — cioe' si sarebbe ordinato due volte cio' che era
--    gia' stato chiesto e non era ancora arrivato. Nessuno se ne
--    sarebbe accorto prima della consegna doppia.
comment on function add_below_threshold_items() is
  'Mette in lista i prodotti scesi sotto la scorta minima, col fornitore abituale del prodotto. Non tocca chi e'' gia'' in lista o gia'' ordinato.';

revoke all on function add_below_threshold_items() from public, anon;
grant execute on function add_below_threshold_items() to authenticated;

-- ---------------------------------------------------------------------
-- 2. ...e anche chi viene aggiunto a mano
-- ---------------------------------------------------------------------
create or replace function add_shopping_list_item(
  p_ingredient_id uuid default null,
  p_custom_name text default null,
  p_supplier_id uuid default null,
  p_quantity_needed numeric default null,
  p_unit unit_type default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_id uuid;
begin
  if p_ingredient_id is null and (p_custom_name is null or btrim(p_custom_name) = '') then
    raise exception 'Serve un ingrediente o un nome articolo';
  end if;

  insert into shopping_list_items (ingredient_id, custom_name, supplier_id, quantity_needed, unit, note)
  values (
    p_ingredient_id,
    nullif(btrim(p_custom_name), ''),
    -- Se non lo dice la schermata, lo dice la scheda del prodotto. Una
    -- scelta esplicita vince sempre su quella ereditata.
    coalesce(p_supplier_id, (select i.supplier_id from ingredients i where i.id = p_ingredient_id)),
    p_quantity_needed,
    p_unit,
    p_note
  )
  returning id into v_id;

  return v_id;
end;
$funzione$;

revoke all on function add_shopping_list_item(uuid, text, uuid, numeric, unit_type, text) from public, anon;
grant execute on function add_shopping_list_item(uuid, text, uuid, numeric, unit_type, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Le righe gia' in lista: sistemate una volta sola
-- ---------------------------------------------------------------------
-- ⚠️ Tocca DATI VERI di Alessio, quindi il perimetro e' stretto e
--    dichiarato: solo righe ancora da comprare, solo dove il fornitore
--    sulla riga e' vuoto, e solo copiando quello che lui stesso ha
--    scritto sulla scheda del prodotto. Non si sovrascrive mai una scelta
--    gia' fatta su una riga.
do $sistema$
declare
  n integer;
begin
  update shopping_list_items sli
     set supplier_id = i.supplier_id
    from ingredients i
   where i.id = sli.ingredient_id
     and sli.supplier_id is null
     and i.supplier_id is not null
     and sli.status = 'da_comprare';

  get diagnostics n = row_count;
  raise notice 'Righe della lista che hanno ritrovato il loro fornitore: %', n;
end
$sistema$;

-- ---------------------------------------------------------------------
-- 4. Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente     uuid;
  v_titolare uuid;
  v_forn     uuid;
  v_forn2    uuid;
  v_ing      uuid;
  v_r1       uuid;
  v_r2       uuid;
  v_r3       uuid;
  v_trovato  uuid;
  n          integer;
begin
  select id into v_ente from entities order by created_at limit 1;
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_ente is null or v_titolare is null then
    raise exception 'Servono un''entita'' e un titolare per questa verifica.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  insert into suppliers (entity_id, name, category)
  values (v_ente, 'PROVA FORN abituale', 'ortofrutta') returning id into v_forn;
  insert into suppliers (entity_id, name, category)
  values (v_ente, 'PROVA FORN altro', 'ortofrutta') returning id into v_forn2;

  -- Un prodotto col suo fornitore abituale e una scorta minima.
  insert into ingredients (entity_id, name, category, unit, supplier_id, stock_minimum_threshold)
  values (v_ente, 'PROVA FORN mandorle', 'secco_dispensa', 'kg', v_forn, 5)
  returning id into v_ing;

  -- 1. Nasce sotto soglia → nasce col fornitore del prodotto.
  perform add_below_threshold_items();
  select id, supplier_id into v_r1, v_trovato from shopping_list_items where ingredient_id = v_ing;
  if v_trovato is distinct from v_forn then
    raise exception 'Una riga nata sotto soglia non ha ereditato il fornitore del prodotto.';
  end if;

  -- 2. Un secondo giro non la rimette in lista.
  perform add_below_threshold_items();
  select count(*) into n from shopping_list_items where ingredient_id = v_ing;
  if n <> 1 then raise exception 'La riga e'' stata aggiunta due volte (ora %).', n; end if;

  -- 3. ⚠️ E nemmeno quando e' gia' ORDINATA: era il buco vero — si
  --    sarebbe ordinato due volte cio' che era gia' stato chiesto.
  update shopping_list_items set status = 'ordinata' where id = v_r1;
  perform add_below_threshold_items();
  select count(*) into n from shopping_list_items where ingredient_id = v_ing;
  if n <> 1 then
    raise exception 'Un prodotto gia'' ordinato e'' rientrato in lista (righe %).', n;
  end if;
  delete from shopping_list_items where id = v_r1;

  -- 4. Aggiunta a mano senza dire il fornitore: lo eredita.
  v_r2 := add_shopping_list_item(v_ing, null, null, 2, 'kg'::unit_type, null);
  if (select supplier_id from shopping_list_items where id = v_r2) is distinct from v_forn then
    raise exception 'Un''aggiunta a mano non ha ereditato il fornitore del prodotto.';
  end if;
  delete from shopping_list_items where id = v_r2;

  -- 5. ...ma una scelta esplicita vince sempre sull'eredita'.
  v_r3 := add_shopping_list_item(v_ing, null, v_forn2, 2, 'kg'::unit_type, null);
  if (select supplier_id from shopping_list_items where id = v_r3) <> v_forn2 then
    raise exception 'Il fornitore scelto a mano e'' stato sovrascritto da quello del prodotto.';
  end if;
  delete from shopping_list_items where id = v_r3;

  -- 6. La sistemazione non tocca chi ha gia' un fornitore suo.
  v_r3 := add_shopping_list_item(v_ing, null, v_forn2, 2, 'kg'::unit_type, null);
  update shopping_list_items sli set supplier_id = i.supplier_id
    from ingredients i
   where i.id = sli.ingredient_id and sli.supplier_id is null
     and i.supplier_id is not null and sli.status = 'da_comprare';
  if (select supplier_id from shopping_list_items where id = v_r3) <> v_forn2 then
    raise exception 'La sistemazione ha sovrascritto una scelta gia'' fatta.';
  end if;
  delete from shopping_list_items where id = v_r3;

  perform set_config('request.jwt.claims', null, true);

  -- ---- Pulizia (§5 punto 8) ----------------------------------------
  delete from shopping_list_items where ingredient_id = v_ing;
  delete from price_history where ingredient_id = v_ing;
  delete from ingredients where id = v_ing;
  delete from suppliers where name like 'PROVA FORN%';

  select count(*) into n from ingredients where name like 'PROVA FORN%';
  if n <> 0 then raise exception 'La prova ha lasciato % ingredienti.', n; end if;

  raise notice 'Il fornitore del prodotto arriva fino alla riga della lista, e una scelta esplicita vince sempre.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260814000002', 'il_fornitore_del_prodotto')
on conflict (version) do nothing;

select count(*) filter (where supplier_id is not null) as con_fornitore,
       count(*)                                        as righe_da_comprare
  from shopping_list_items where status = 'da_comprare';
