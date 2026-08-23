-- =====================================================================
-- LA SPUNTA CHE SI VEDEVA E NON ARRIVAVA
-- 23/08/2026
-- =====================================================================
-- 🔴 DIFETTO TROVATO MISURANDO, e non era in nessun elenco. Il mandato
-- diceva che i non alimenti nascono con la spunta «e' un alimento» accesa —
-- detergente, sgrassatore, carta forno, sacchetti sottovuoto. Ma il comando
-- che costruisce lo scenario passa `alimentare: categoria !== 'altro'`, e
-- quei quattro hanno categoria «altro». Avrebbero dovuto nascere spenti.
--
-- Misurato: **4 su 4 sono accesi**. E la causa non e' lo scenario:
--
--     `create_ingredient` NON HA MAI AVUTO IL PARAMETRO `alimentare`.
--
-- ⚠️ Quindi la casella «E' un alimento» **si vede sulla scheda, si toglie,
-- si salva senza errore, e non arriva al database**: in creazione il valore
-- viene ignorato in silenzio e l'ingrediente nasce alimentare. (In modifica
-- funziona: quella passa da un `update` diretto.)
--
-- 🔴 **E' LA TRAPPOLA DEL 16/08 ALLA TERZA RICOMPARSA** — *«un valore che si
-- vede nella schermata non e' un valore che arriva al database»*, quella
-- delle mance su carta che finivano nel contante. Nella sua forma peggiore:
-- il campo esiste, il gesto riesce, e sbaglia **in silenzio**.
--
-- ⚠️ E stamattina, senza questa correzione, `tenuto_in_magazzino` avrebbe
-- avuto lo stesso destino: la spunta «il magazzino lo segue» sarebbe stata
-- ignorata su ogni prodotto nuovo.
--
-- ⚠️ Un parametro in piu' fa una funzione **nuova**: due sovrapposte
-- rendono ambigua ogni chiamata per nome (42725, a tempo di esecuzione, sul
-- gesto che oggi funziona). Quindi `drop` e ricreazione — e dopo un `drop`
-- i permessi tornano aperti al mondo, per cui si richiudono a mano.
-- =====================================================================

drop function if exists create_ingredient(uuid, text, ingredient_category, unit_type, numeric, ingredient_source, uuid, uuid, allergen[], month_code[], storage_type, integer, numeric, text, text, numeric);

create or replace function create_ingredient(
  p_entity_id                uuid,
  p_name                     text,
  p_category                 ingredient_category,
  p_unit                     unit_type,
  p_current_price            numeric,
  p_source_type              ingredient_source default 'fornitore_esterno',
  p_supplier_id              uuid default null,
  p_producer_entity_id       uuid default null,
  p_allergens                allergen[] default '{}',
  p_seasonality              month_code[] default '{}',
  p_storage_type             storage_type default null,
  p_shelf_life_days          integer default null,
  p_waste_percentage_default numeric default 0,
  p_haccp_receiving_temp     text default null,
  p_haccp_notes              text default null,
  p_stock_minimum_threshold  numeric default null,
  p_alimentare               boolean default true,
  p_tenuto_in_magazzino      boolean default true
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
    shelf_life_days, waste_percentage_default, temperatura_attesa, haccp_notes,
    stock_minimum_threshold, alimentare, tenuto_in_magazzino
  ) values (
    p_entity_id, btrim(p_name), p_category, p_unit, p_current_price,
    coalesce(p_source_type, 'fornitore_esterno'), p_supplier_id,
    p_producer_entity_id, coalesce(p_allergens, '{}'),
    coalesce(p_seasonality, '{}'), p_storage_type, p_shelf_life_days,
    coalesce(p_waste_percentage_default, 0), p_haccp_receiving_temp, p_haccp_notes,
    p_stock_minimum_threshold,
    -- ⚠️ `coalesce` e non il valore secco: chi non passa niente ottiene il
    -- predefinito di sempre, e nessuna chiamata gia' scritta cambia
    -- comportamento.
    coalesce(p_alimentare, true), coalesce(p_tenuto_in_magazzino, true)
  )
  returning * into v_row;

  -- Lo storico parte SEMPRE dal prezzo iniziale, nella stessa transazione.
  insert into price_history (ingredient_id, price, supplier_id, source, note)
  values (v_row.id, p_current_price, p_supplier_id, 'manuale', 'Prezzo iniziale');

  return to_jsonb(v_row);
end;
$funzione$;

revoke all on function create_ingredient(uuid, text, ingredient_category, unit_type, numeric, ingredient_source, uuid, uuid, allergen[], month_code[], storage_type, integer, numeric, text, text, numeric, boolean, boolean) from public, anon, authenticated;
grant execute on function create_ingredient(uuid, text, ingredient_category, unit_type, numeric, ingredient_source, uuid, uuid, allergen[], month_code[], storage_type, integer, numeric, text, text, numeric, boolean, boolean) to authenticated;


-- ---------------------------------------------------------------------
-- I quattro dello scenario
-- ---------------------------------------------------------------------
-- ⚠️ Perimetro dichiarato e stretto: **solo** i prodotti di categoria
-- «altro» che il comando dello scenario aveva chiesto di creare spenti.
-- Non si tocca nessun prodotto vero — in produzione questa riga non trova
-- niente, perche' li' non c'e' nessun prodotto di categoria «altro».
--
-- ⚠️ E dichiara quante righe tocca (regola del 16/08): uno zero non e' un
-- errore, ma il silenzio ha gia' ingannato quattro volte.
do $sanatoria$
declare
  v_quanti integer;
begin
  update ingredients set alimentare = false
   where category = 'altro' and alimentare
     and name in ('Detergente per superfici', 'Sgrassatore per cucina',
                  'Sacchetti sottovuoto', 'Carta forno');
  get diagnostics v_quanti = row_count;
  raise notice 'Non alimenti rimessi a posto: %', v_quanti;
end $sanatoria$;


-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente     uuid;
  v_tit      uuid;
  v_r        jsonb;
  v_id       uuid;
  v_lapidi   integer;
  v_lapidi_2 integer;
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_ente from entities order by created_at limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- 1. Le due caselle NELLO STATO NON PREDEFINITO. ⚠️ Provarle a `true`
  --    non proverebbe niente: e' il valore che uscirebbe comunque, ed e'
  --    esattamente il modo in cui questo difetto e' rimasto invisibile.
  v_r := create_ingredient(
    p_entity_id => v_ente,
    p_name => 'ZZ non alimento',
    p_category => 'altro',
    p_unit => 'pz',
    p_current_price => 1,
    p_alimentare => false,
    p_tenuto_in_magazzino => false);
  v_id := (v_r->>'id')::uuid;

  if (select alimentare from ingredients where id = v_id) then
    raise exception 'La spunta «e'' un alimento» non arriva al database: si vede, si toglie, e non fa niente.';
  end if;
  if (select tenuto_in_magazzino from ingredients where id = v_id) then
    raise exception 'La spunta «il magazzino lo segue» non arriva al database.';
  end if;

  -- 2. E chi non passa niente ottiene il predefinito di sempre: nessuna
  --    chiamata gia' scritta cambia comportamento.
  delete from ingredients where id = v_id;
  v_r := create_ingredient(
    p_entity_id => v_ente,
    p_name => 'ZZ predefinito',
    p_category => 'altro',
    p_unit => 'pz',
    p_current_price => 1);
  v_id := (v_r->>'id')::uuid;
  if not (select alimentare from ingredients where id = v_id)
     or not (select tenuto_in_magazzino from ingredients where id = v_id) then
    raise exception 'Chi non passa le spunte non ottiene piu'' i predefiniti.';
  end if;

  -- 3. Una sola funzione con quel nome: due sovrapposte renderebbero
  --    ambigua ogni chiamata, e l'errore arriverebbe a tempo di esecuzione.
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'create_ingredient') <> 1 then
    raise exception 'Ci sono due create_ingredient: le chiamate per nome diventano ambigue.';
  end if;

  perform set_config('request.jwt.claims', null, true);

  delete from price_history where ingredient_id = v_id;
  delete from ingredients where id = v_id;
  select count(*) into v_lapidi_2 from deleted_records;
  if v_lapidi_2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi.', v_lapidi_2 - v_lapidi;
  end if;

  raise notice 'Verifica passata: le due spunte arrivano al database, e chi non le passa ottiene i predefiniti.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260823000008', 'la_spunta_che_non_arrivava') on conflict (version) do nothing;
