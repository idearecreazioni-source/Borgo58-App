-- ============================================================================
-- QUANTO E' COSTATO DAVVERO, NON QUANTO COSTEREBBE RIFARLO OGGI — 25/08/2026
-- ============================================================================
--
-- Decisione di Alessio: **comanda il magazzino**. Il costo degli ingredienti
-- di un conto e' quello dei LOTTI da cui la merce e' uscita — fotografato al
-- momento in cui e' uscita — non il ricalcolo sui prezzi di listino di oggi.
--
-- 🔴 COSA C'ERA PRIMA. `costo_ingredienti_conto` leggeva
--    `v_recipe_costs.food_cost_portion`, che e' il costo di rifare quel
--    piatto ADESSO, coi prezzi correnti degli ingredienti. Misurato sul conto
--    T6 del 31 luglio: **5,11 dalla ricetta contro 3,45 dal magazzino**.
--
-- ⚠️ E I DUE NUMERI RESTANO ENTRAMBI, perche' rispondono a due domande
--    diverse: `v_recipe_costs` dice *quanto costa fare questo piatto*, ed e'
--    su quello che si decide un prezzo di menu; il magazzino dice *quanto e'
--    costato quel piatto quella sera*, ed e' su quello che si misura un
--    omaggio. Cambia solo **chi risponde alla seconda domanda**.
--
-- 🔴 L'ORDINE DEI PASSI ERA IL PUNTO. In `close_order_as_discount_gift` il
--    costo si leggeva PRIMA (riga 61 del corpo vivo) e il magazzino scendeva
--    DOPO (riga 101): leggendo dal magazzino in quel punto sarebbe venuto
--    **zero** — cioe' un omaggio che non e' costato niente. Adesso la merce
--    esce prima e il costo si legge dopo, nella stessa transazione.
--
-- ⚠️ NULL, NON ZERO, se il magazzino non e' sceso. «Non e' costato niente» e
--    «non lo so» sono due cose diverse, e la colonna `costo_ingredienti` e'
--    gia' `nullable` apposta. Uno zero al posto suo direbbe che gli omaggi
--    non pesano.
--
-- ⚠️ COSA CAMBIA DI SIGNIFICATO, dichiarato: `righe_valorizzate` contava le
--    righe la cui ricetta aveva tutti i prezzi noti; adesso conta le righe
--    che hanno **prodotto un fabbisogno**, cioe' quelle da cui e' uscito
--    qualcosa dalla cella. Le due domande si somigliano ma non coincidono: un
--    ingrediente che il magazzino non segue (`tenuto_in_magazzino` falso) ha
--    un prezzo e non produce scarico.
--
-- ⚠️ LIMITE DICHIARATO: `stock_consumptions` non porta l'identificativo della
--    riga del conto, quindi il costo dal magazzino e' del CONTO, non del
--    singolo piatto. E se un lotto non bastava, lo scarico e' parziale e il
--    costo e' piu' basso del vero — quel caso `anomalie_scarico` lo registra
--    gia' come «giacenza insufficiente», ma non lo si vede da questo numero.
--
-- ⚠️ E IL PASSATO NON SI RISCRIVE: le 11 righe gia' in `discounts_gifts`
--    hanno tutte `costo_ingredienti` **vuoto** (misurato), quindi non c'e'
--    nessuna popolazione mista da distinguere. Da qui in avanti il numero
--    viene dal magazzino.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Il costo di un conto, letto da dove la merce e' uscita davvero
-- ---------------------------------------------------------------------------
create or replace function costo_ingredienti_conto(p_order_id uuid)
returns table(costo numeric, valorizzate integer, senza_costo integer)
language sql
stable
security definer
set search_path = public
as $fn$
  with righe as (
    select oi.id
      from order_items oi
     where oi.order_id = p_order_id
       and oi.voided_at is null
  ),
  -- Le righe da cui e' uscito qualcosa dalla cella. Una voce libera o una
  -- ricetta vuota non compare qui: non si inventa uno scarico, si dichiara.
  uscite as (
    select distinct f.order_item_id
      from fabbisogno_conto(p_order_id) f
  ),
  sceso as (
    select sum(sc.costo) as costo, count(*)::integer as quante
      from stock_consumptions sc
     where sc.order_id = p_order_id
       and sc.costo is not null
  )
  select
    -- ⚠️ Vuoto finche' il magazzino non e' sceso: «non e' costato niente» e
    --    «non lo so ancora» non si scrivono allo stesso modo.
    (select case when s.quante > 0 then round(s.costo, 2) end from sceso s)::numeric(12,2),
    (select count(*) from righe r where exists (select 1 from uscite u where u.order_item_id = r.id))::integer,
    (select count(*) from righe r where not exists (select 1 from uscite u where u.order_item_id = r.id))::integer;
$fn$;

comment on function costo_ingredienti_conto(uuid) is
  'Quanto e'' costato un conto secondo il MAGAZZINO: la somma dei costi fotografati sui lotti da cui la merce e'' uscita. Vuoto finche'' il magazzino non e'' sceso. Il costo di rifare lo stesso piatto oggi e'' un''altra domanda, e la risponde v_recipe_costs.';

revoke all on function costo_ingredienti_conto(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. La chiusura come sconto o omaggio: prima esce la merce, poi si conta
--    ⚠️ Corpo ripreso VIVO dal database: fra la migrazione che l'ha creata e
--       oggi ci sono tutte quelle che l'hanno toccata.
-- ---------------------------------------------------------------------------
create or replace function close_order_as_discount_gift(
  p_order_id uuid,
  p_is_gift boolean,
  p_collected_amount numeric default 0,
  p_expected_full_amount numeric default null,
  p_causale_id uuid default null,
  p_causale_note text default null,
  p_customer_id uuid default null,
  p_device_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_utente    uuid := auth.uid();
  v_order     orders%rowtype;
  v_conto     record;
  v_incassato numeric(12,2);
  v_dg_id     uuid;
  v_costo     record;
begin
  if v_utente is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_order from orders where id = p_order_id for update;

  if v_order.id is null then
    raise exception 'Conto non trovato';
  end if;

  if v_order.status <> 'aperto' then
    raise exception 'Questo conto e'' gia'' stato chiuso (stato: %). Ricaricare la schermata.', v_order.status;
  end if;

  -- ⚠️ La causale si controlla QUI, dopo il conto e prima di scrivere.
  -- L'ordine non è indifferente: prima si dice se la cosa di cui si parla
  -- esiste, poi se i dati sono completi (14/08/2026).
  if p_causale_id is null then
    raise exception 'Scegli perché: uno sconto o un omaggio senza causale, fra un anno, è un numero che nessuno sa spiegare.';
  end if;
  if not exists (select 1 from cash_causali
                  where id = p_causale_id and kind = 'sconto_omaggio' and active) then
    raise exception 'Quella causale non è più fra quelle degli sconti e omaggi: ricarica la schermata.';
  end if;

  select * into v_conto from totale_conto(p_order_id);

  if p_expected_full_amount is not null
     and abs(p_expected_full_amount - v_conto.totale) > 0.01 then
    raise exception 'Il totale e'' cambiato mentre chiudevi il conto (a schermo %, ora %). Ricarica e riprova.',
      p_expected_full_amount, v_conto.totale;
  end if;

  if p_is_gift then
    v_incassato := 0;
  else
    v_incassato := coalesce(p_collected_amount, 0);
    if v_incassato < 0 then
      raise exception 'L''importo incassato non puo'' essere negativo';
    end if;
    if v_incassato > v_conto.totale then
      raise exception 'L''importo incassato (%) non puo'' superare il totale del conto (%)', v_incassato, v_conto.totale;
    end if;
  end if;

  -- 🔴 LA MERCE ESCE PRIMA, E POI SI CONTA QUANTO E' COSTATA (25/08/2026).
  --    Prima era l'inverso, e con il costo letto dal magazzino sarebbe venuto
  --    zero: un omaggio che non pesa niente. Lo scarico non blocca mai la
  --    chiusura — se qualcosa va storto lascia un'anomalia e va avanti — e
  --    resta vero anche stando qui sopra.
  --    ⚠️ `closed_at` e' ancora vuoto a questo punto, quindi
  --    `fabbisogno_conto` prende `now()` come istante del conto: dentro una
  --    transazione e' lo stesso istante che fra poco finisce in `closed_at`.
  perform scarica_magazzino_conto(p_order_id);

  -- Quanto e' costato davvero: dai lotti da cui la merce e' appena uscita.
  select * into v_costo from costo_ingredienti_conto(p_order_id);

  -- 🔴 LA DATA SI PASSA, e prima non si passava: questa riga si appoggiava
  -- al predefinito della colonna, che dal 19/08 non c'e' piu'.
  --
  -- ⚠️ E LA DATA GIUSTA E' LA SERATA, non il giorno di calendario: uno
  -- sconto o un omaggio e' la traccia economica di un CONTO, e il giorno di
  -- un conto e' la sua serata dappertutto — conti_da_fiscalizzare,
  -- quadratura_fiscale, misure_del_mese e ricavi_non_fiscalizzati leggono
  -- tutte serata_di_servizio(closed_at). Datandolo a calendario, un omaggio
  -- dell'una di notte finirebbe su un giorno diverso dal conto che l'ha
  -- generato — e l'ultima notte del mese, su un MESE diverso: il budget
  -- degli omaggi e i ricavi direbbero due cose sullo stesso fatto.
  --
  -- ⚠️ E i due non possono divergere: dentro una transazione now() e' un
  -- istante solo, quindi serata_di_servizio() qui e closed_at = now() qui
  -- sotto parlano dello stesso momento.
  insert into discounts_gifts (
    entity_id, type, full_amount, collected_amount, movement_date,
    causale_id, causale_note, customer_id, device_id, note, created_by,
    costo_ingredienti, righe_valorizzate, righe_senza_costo
  ) values (
    v_order.entity_id,
    case when p_is_gift then 'omaggio' else 'sconto' end::discount_gift_type,
    v_conto.totale,
    v_incassato,
    serata_di_servizio(),
    p_causale_id, p_causale_note, p_customer_id, p_device_id, p_note, v_utente,
    v_costo.costo, coalesce(v_costo.valorizzate, 0), coalesce(v_costo.senza_costo, 0)
  )
  returning id into v_dg_id;

  update orders set
    status             = case when p_is_gift then 'omaggiato' else 'chiuso' end::order_status,
    discount_gift_id   = v_dg_id,
    coperto_unit_price = v_conto.prezzo_coperto,
    closed_at          = now()
  where id = p_order_id;

  return v_dg_id;
end;
$fn$;

revoke all on function close_order_as_discount_gift(uuid, boolean, numeric, numeric, uuid, text, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function close_order_as_discount_gift(uuid, boolean, numeric, numeric, uuid, text, uuid, uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3. La verifica — e discrimina perche' i due numeri sono DIVERSI
--    ⚠️ Il lotto costa 10,00 al kg e il listino dell'ingrediente dice 40,00:
--       se il costo venisse ancora dalla ricetta la verifica lo direbbe.
-- ---------------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_ent      uuid;
  v_causale  uuid;
  v_ingr     uuid;
  v_ric      uuid;
  v_lotto    uuid;
  v_conto    uuid;
  v_riga     uuid;
  v_dg       uuid;
  v_costo    numeric;
  v_val      integer;
  v_senza    integer;
  v_lapidi_pre  integer;
  v_lapidi_post integer;
begin
  select count(*) into v_lapidi_pre from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into v_ent from entities order by created_at limit 1;
  select id into v_causale from cash_causali
   where kind = 'sconto_omaggio' and active limit 1;
  if v_ent is null or v_causale is null then
    raise exception 'Manca l''entita'' o una causale di sconto/omaggio: la verifica non puo'' costruire il caso.';
  end if;

  -- Un ingrediente tutto nostro: listino 40,00 al kg, lotto pagato 10,00.
  insert into ingredients (entity_id, name, category, unit, tenuto_in_magazzino, current_price)
  values (v_ent, 'ZZ prova cipolla del food cost', 'verdura', 'kg', true, 40.00)
  returning id into v_ingr;

  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at)
  values (v_ingr, 50, 50, 10.00, now() - interval '10 days')
  returning id into v_lotto;

  -- Un piatto: 10 porzioni, 1 kg in tutto -> 0,1 kg a porzione.
  insert into recipes (name, category, recipe_type, portions_yield)
  values ('ZZ prova piatto del food cost', 'primo', 'piatto_finito', 10)
  returning id into v_ric;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit, waste_percentage)
  values (v_ric, v_ingr, 1, 'kg', 0);

  insert into orders (entity_id, table_label, status)
  values (v_ent, 'ZZ prova food cost', 'aperto')
  returning id into v_conto;

  -- 3 porzioni -> 0,300 kg. Dal lotto: 3,00. Dal listino sarebbe 12,00.
  insert into order_items (order_id, recipe_id, destination, quantity, unit_price, sent_at)
  values (v_conto, v_ric, 'cucina', 3, 15.00, now())
  returning id into v_riga;

  -- Piu' una voce libera, che non ha ricetta e non deve valorizzare niente.
  insert into order_items (order_id, free_text_name, destination, quantity, unit_price, sent_at)
  values (v_conto, 'ZZ voce libera di prova', 'cucina', 1, 4.00, now());

  v_dg := close_order_as_discount_gift(
    p_order_id => v_conto,
    p_is_gift  => true,
    p_causale_id => v_causale
  );

  select costo_ingredienti, righe_valorizzate, righe_senza_costo
    into v_costo, v_val, v_senza
    from discounts_gifts where id = v_dg;

  if v_costo is null then
    raise exception 'Il costo e'' rimasto vuoto: la merce non e'' uscita prima di contarla';
  end if;
  if round(v_costo, 2) <> 3.00 then
    raise exception 'Costo sbagliato: % invece di 3,00. Dal listino sarebbero 12,00 — se e'' quello, legge ancora la ricetta.', v_costo;
  end if;
  if v_val <> 1 then
    raise exception 'Righe valorizzate: % invece di 1', v_val;
  end if;
  if v_senza <> 1 then
    raise exception 'Righe senza costo: % invece di 1 (la voce libera)', v_senza;
  end if;

  -- E il lotto e' sceso davvero: 50 - 0,3
  if (select round(quantity_remaining, 4) from stock_lots where id = v_lotto) <> 49.7000 then
    raise exception 'Il lotto non e'' sceso di 0,300: %',
      (select quantity_remaining from stock_lots where id = v_lotto);
  end if;

  -- ------------------------------------------------------------------
  -- Pulizia: solo cio' che questa verifica ha creato, per identificativo.
  -- ------------------------------------------------------------------
  alter table order_items disable trigger trg_log_delete;
  alter table order_items disable trigger trg_riga_servita;
  alter table order_items disable trigger trg_riga_su_conto_non_aperto;
  alter table discounts_gifts disable trigger trg_log_delete;

  update orders set discount_gift_id = null, status = 'aperto' where id = v_conto;
  delete from discounts_gifts    where id = v_dg;
  delete from stock_consumptions where order_id = v_conto;
  delete from anomalie_scarico   where order_id = v_conto;
  delete from order_items        where order_id = v_conto;
  delete from orders             where id = v_conto;
  delete from stock_lots         where id = v_lotto;
  delete from recipe_ingredients where recipe_id = v_ric;
  delete from recipes            where id = v_ric;
  delete from ingredients        where id = v_ingr;

  alter table order_items enable trigger trg_log_delete;
  alter table order_items enable trigger trg_riga_servita;
  alter table order_items enable trigger trg_riga_su_conto_non_aperto;
  alter table discounts_gifts enable trigger trg_log_delete;

  if exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
     where c.relname in ('order_items', 'discounts_gifts')
       and not t.tgisinternal and t.tgenabled = 'D'
  ) then
    raise exception 'Sono rimasti trigger spenti dopo la pulizia';
  end if;

  select count(*) into v_lapidi_post from deleted_records;
  if v_lapidi_post <> v_lapidi_pre then
    raise exception 'La verifica ha lasciato % lapidi nel registro', v_lapidi_post - v_lapidi_pre;
  end if;

  raise notice 'Il food cost di un conto viene dal magazzino: 3,00 dal lotto invece di 12,00 dal listino, con una voce libera dichiarata non valorizzata.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260825000006', 'il_food_cost_di_un_conto_viene_dal_magazzino')
on conflict (version) do nothing;
