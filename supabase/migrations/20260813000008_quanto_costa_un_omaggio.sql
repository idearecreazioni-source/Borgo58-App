-- =====================================================================
-- Quanto ti è costato davvero quell'omaggio
-- =====================================================================
-- Rilievo n. 5 del referto del 13/08/2026, e l'unico dei sei che **ha una
-- scadenza**: gli altri si possono correggere fra un mese senza perdere
-- niente, questo no.
--
-- Oggi un conto omaggiato lascia due numeri: quanto valeva a listino
-- (40 €) e quanto è stato incassato (0). Quanto è COSTATO — gli
-- ingredienti di quei piatti — non lo scrive nessuno.
--
-- Servirebbe per due cose diverse:
--
-- 1. **Il fisco.** Per una cessione gratuita di beni dell'attività la base
--    imponibile è il **costo**, non il prezzo di vendita (è la domanda L1
--    preparata per Laura). Un pasto da 40 € di listino può costarne 11:
--    dichiarare 40 significa pagare imposta su un valore che non è quello
--    previsto. Non lo decidiamo noi — ma se il dato non c'è, Laura non ha
--    nemmeno di che decidere.
--
-- 2. **Alessio.** «Regalare» un conto da 40 € non è perdere 40 €: sono 11
--    € di roba più un tavolo che non hai venduto a qualcun altro.
--    Guardando il numero a listino la cortesia sembra costare quattro
--    volte tanto — e si smette di farla, o la si fa senza sapere.
--
-- ⚠️ PERCHÉ ADESSO E NON FRA SEI MESI: il costo di quel piatto si calcola
-- **nel momento in cui succede**, coi prezzi di quel giorno e con la
-- ricetta di quel giorno. Fra sei mesi l'olio costa un altro prezzo e la
-- ricetta è cambiata: il numero non si ricostruisce più, per nessuna via.
-- È la stessa ragione per cui `orders.coperto_unit_price` congela il
-- prezzo del coperto invece di rileggerlo dalle impostazioni.
--
-- ⚠️ E LA REGOLA CHE VALE PIÙ DEL CALCOLO: **un costo parziale non è il
-- costo.** Una voce libera («due caffè» scritti a mano) non ha ricetta e
-- quindi non ha costo; una ricetta senza ingredienti dà zero, che *sembra*
-- un piatto gratis. In tutti e due i casi il totale che ne esce sarebbe
-- più basso del vero, e sembrerebbe a posto. Quindi si conta anche
-- **quante righe non si è riusciti a valorizzare**, e chi legge lo vede.
-- È la stessa lezione dello scarto a zero di stamattina: zero e «non lo
-- so» non sono lo stesso numero.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Dove si scrive
-- ---------------------------------------------------------------------
alter table discounts_gifts
  add column if not exists costo_ingredienti  numeric(12,2),
  add column if not exists righe_senza_costo  integer not null default 0,
  add column if not exists righe_valorizzate  integer not null default 0;

comment on column discounts_gifts.costo_ingredienti is
  'Quanto sono costati gli ingredienti dei piatti di questo conto, congelato al momento della chiusura. NULL = non calcolabile. Va sempre letto insieme a righe_senza_costo: un costo parziale non e'' il costo.';

comment on column discounts_gifts.righe_senza_costo is
  'Quante righe del conto non si e'' riusciti a valorizzare (voci libere, ricette senza ingredienti, ingredienti senza prezzo).';

-- ---------------------------------------------------------------------
-- 2. Il costo di un conto, al momento in cui si chiude
-- ---------------------------------------------------------------------
-- ⚠️ Una ricetta senza ingredienti, o con un ingrediente senza prezzo,
-- NON vale zero: vale «non lo so». `v_recipe_costs` restituisce 0 in
-- entrambi i casi, ed e' esattamente il numero che sembra giusto.
create or replace function costo_ingredienti_conto(p_order_id uuid)
returns table (costo numeric, valorizzate integer, senza_costo integer)
language sql
stable
security definer
set search_path = public
as $funzione$
  with righe as (
    select oi.quantity,
           oi.recipe_id,
           -- Una ricetta e' valorizzabile solo se ha almeno un
           -- ingrediente non opzionale E nessuno di quelli ha il prezzo
           -- mancante.
           (oi.recipe_id is not null
            and exists (select 1 from recipe_ingredients ri
                         where ri.recipe_id = oi.recipe_id and not ri.is_optional)
            and not exists (select 1 from recipe_ingredients ri
                              join ingredients i on i.id = ri.ingredient_id
                             where ri.recipe_id = oi.recipe_id
                               and not ri.is_optional
                               and i.current_price is null)
           ) as valorizzabile,
           (select vrc.food_cost_portion from v_recipe_costs vrc
             where vrc.recipe_id = oi.recipe_id) as costo_porzione
      from order_items oi
     where oi.order_id = p_order_id
       and oi.voided_at is null
  )
  select
    sum(quantity * costo_porzione) filter (where valorizzabile)::numeric(12,2),
    count(*) filter (where valorizzabile)::integer,
    count(*) filter (where not valorizzabile)::integer
  from righe;
$funzione$;

comment on function costo_ingredienti_conto(uuid) is
  'Quanto costano gli ingredienti dei piatti di un conto, adesso. Dice anche quante righe non ha saputo valorizzare: un costo parziale spacciato per totale sarebbe piu'' dannoso di nessun costo.';

revoke all on function costo_ingredienti_conto(uuid) from public, anon, authenticated;
grant execute on function costo_ingredienti_conto(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. La chiusura lo congela
-- ---------------------------------------------------------------------
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
as $funzione$
declare
  v_utente        uuid := auth.uid();
  v_order         orders%rowtype;
  v_prezzo_coperto numeric(12,2);
  v_totale_righe  numeric(12,2);
  v_totale        numeric(12,2);
  v_incassato     numeric(12,2);
  v_dg_id         uuid;
  v_costo         record;
begin
  -- 1. AUTORIZZAZIONE
  -- Chiudere un conto con sconto o omaggio e' compito anche dello staff
  -- (§3.5): il controllo qui e' che ci sia un utente vero, non che sia il
  -- titolare. La funzione NON allarga i permessi rispetto a prima.
  if v_utente is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  -- 2. IL CONTO — bloccato in lettura finche' la transazione non finisce,
  -- cosi' due tablet che chiudono lo stesso tavolo nello stesso istante
  -- non possono sovrapporsi.
  select * into v_order from orders where id = p_order_id for update;

  if v_order.id is null then
    raise exception 'Conto non trovato';
  end if;

  if v_order.status <> 'aperto' then
    raise exception 'Questo conto e'' gia'' stato chiuso (stato: %). Ricaricare la schermata.', v_order.status;
  end if;

  -- 3. L'IMPORTO, calcolato qui
  v_prezzo_coperto := coalesce(
    v_order.coperto_unit_price,
    (select coperto_price from service_settings where id = 1),
    0
  );

  select coalesce(sum(quantity * unit_price), 0)
    into v_totale_righe
  from order_items
  where order_id = p_order_id and voided_at is null;

  v_totale := v_totale_righe + coalesce(v_order.coperti, 0) * v_prezzo_coperto;

  -- Confronto col totale che l'operatore aveva davanti agli occhi.
  -- Se non coincidono, qualcosa e' cambiato mentre chiudeva (un collega ha
  -- aggiunto una riga, o il prezzo del coperto e' stato modificato): meglio
  -- fermarsi che scrivere in cassa un numero diverso da quello mostrato.
  if p_expected_full_amount is not null
     and abs(p_expected_full_amount - v_totale) > 0.01 then
    raise exception 'Il totale e'' cambiato mentre chiudevi il conto (a schermo %, ora %). Ricarica e riprova.',
      p_expected_full_amount, v_totale;
  end if;

  -- 4. L'INCASSATO
  if p_is_gift then
    v_incassato := 0;
  else
    v_incassato := coalesce(p_collected_amount, 0);
    if v_incassato < 0 then
      raise exception 'L''importo incassato non puo'' essere negativo';
    end if;
    if v_incassato > v_totale then
      raise exception 'L''importo incassato (%) non puo'' superare il totale del conto (%)', v_incassato, v_totale;
    end if;
  end if;

  -- 4-bis. QUANTO E' COSTATO, adesso e non domani. Un prezzo di
  -- ingrediente cambia, una ricetta cambia: questo numero esiste solo in
  -- questo istante.
  select * into v_costo from costo_ingredienti_conto(p_order_id);

  -- 5. LE DUE SCRITTURE — nella stessa transazione, per costruzione
  insert into discounts_gifts (
    entity_id, type, full_amount, collected_amount,
    causale_id, causale_note, customer_id, device_id, note, created_by,
    costo_ingredienti, righe_valorizzate, righe_senza_costo
  ) values (
    v_order.entity_id,
    case when p_is_gift then 'omaggio' else 'sconto' end::discount_gift_type,
    v_totale,
    v_incassato,
    p_causale_id, p_causale_note, p_customer_id, p_device_id, p_note, v_utente,
    v_costo.costo, coalesce(v_costo.valorizzate, 0), coalesce(v_costo.senza_costo, 0)
  )
  returning id into v_dg_id;

  update orders set
    status             = case when p_is_gift then 'omaggiato' else 'chiuso' end::order_status,
    discount_gift_id   = v_dg_id,
    coperto_unit_price = v_prezzo_coperto,
    closed_at          = now()
  where id = p_order_id;

  return v_dg_id;
end;
$funzione$;

revoke all on function close_order_as_discount_gift(uuid, boolean, numeric, numeric, uuid, text, uuid, uuid, text)
  from public, anon;
grant execute on function close_order_as_discount_gift(uuid, boolean, numeric, numeric, uuid, text, uuid, uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------
-- 4. Il riepilogo mensile porta tutti e due i numeri, e dichiara i buchi
-- ---------------------------------------------------------------------
-- ⚠️ `create or replace view` accetta solo colonne AGGIUNTE in fondo
-- (42P16): l'ordine di quelle esistenti non si tocca.
create or replace view v_discounts_gifts_monthly as
select entity_id,
       date_trunc('month'::text, movement_date::timestamp with time zone)::date as month,
       type,
       count(*) as count,
       sum(full_amount)::numeric(14,2) as total_full,
       sum(collected_amount)::numeric(14,2) as total_collected,
       sum(full_amount - collected_amount)::numeric(14,2) as total_forgone,
       -- Il costo e' una somma PARZIALE ogni volta che una riga non e'
       -- stata valorizzata: `conti_incompleti` e' il numero che impedisce
       -- di scambiarla per un totale.
       sum(costo_ingredienti)::numeric(14,2) as total_costo,
       count(*) filter (where righe_senza_costo > 0) as conti_incompleti,
       count(*) filter (where costo_ingredienti is null) as conti_senza_costo
  from discounts_gifts
 group by entity_id, (date_trunc('month'::text, movement_date::timestamp with time zone)), type;

comment on view v_discounts_gifts_monthly is
  'Sconti e omaggi per mese: valore a listino, incassato, mancato incasso e COSTO degli ingredienti. Il costo va letto con `conti_incompleti`: dove una riga non era valorizzabile, la somma e'' piu'' bassa del vero.';

-- ---------------------------------------------------------------------
-- 5. Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente   uuid;
  v_ing    uuid;
  v_ric    uuid;
  v_ric2   uuid;
  v_tav    uuid;
  v_ord    uuid;
  v_costo  record;
  n        integer;
begin
  select id into v_ente from entities order by created_at limit 1;
  if v_ente is null then raise exception 'Nessuna entita''.'; end if;

  -- Un ingrediente da 10 €/kg con il 20% di scarto.
  insert into ingredients (entity_id, name, category, unit, current_price, waste_percentage_default)
  values (v_ente, 'PROVA COSTO farina', 'farine_cereali', 'kg', 10, 20) returning id into v_ing;

  -- Una ricetta da 2 porzioni che ne usa 1 kg: 10 × 1,20 / 2 = 6,00 a porzione.
  insert into recipes (name, category, portions_yield)
  values ('PROVA COSTO pane', 'primo', 2) returning id into v_ric;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit, is_optional)
  values (v_ric, v_ing, 1, 'kg', false);

  -- Una ricetta SENZA ingredienti: non vale zero, vale «non lo so».
  insert into recipes (name, category, portions_yield)
  values ('PROVA COSTO vuota', 'dolce', 1) returning id into v_ric2;

  insert into dining_tables (label, seats)
  values ('PROVA COSTO tavolo', 2) returning id into v_tav;
  insert into orders (entity_id, table_label, status, coperti)
  values (v_ente, 'PROVA COSTO tavolo', 'aperto', 0) returning id into v_ord;

  -- 2 porzioni valorizzabili + 1 riga di ricetta vuota + 1 voce libera.
  insert into order_items (order_id, recipe_id, quantity, unit_price, destination)
  values (v_ord, v_ric, 2, 12, 'cucina');
  insert into order_items (order_id, recipe_id, quantity, unit_price, destination)
  values (v_ord, v_ric2, 1, 5, 'cucina');
  insert into order_items (order_id, free_text_name, quantity, unit_price, destination)
  values (v_ord, 'Caffe'' scritto a mano', 2, 1.5, 'bar');

  select * into v_costo from costo_ingredienti_conto(v_ord);

  -- 1. Il costo delle righe valorizzabili e' quello, scarto compreso.
  if v_costo.costo is distinct from 12.00 then
    raise exception 'Il costo calcolato e'' % invece di 12,00 (2 porzioni x 6,00, scarto del 20%% compreso).', v_costo.costo;
  end if;
  if v_costo.valorizzate <> 1 then
    raise exception 'Righe valorizzate: % invece di 1.', v_costo.valorizzate;
  end if;

  -- 2. LA COSA CHE CONTA: le righe non valorizzabili si contano, non si
  --    ignorano. Una ricetta vuota e una voce libera non valgono zero.
  if v_costo.senza_costo <> 2 then
    raise exception 'Righe senza costo: % invece di 2 (la ricetta vuota e la voce libera).', v_costo.senza_costo;
  end if;

  -- 3. Il caso «ingrediente senza prezzo» oggi NON PUO' capitare:
  --    `ingredients.current_price` e' obbligatoria a livello di tabella,
  --    e provare a metterla a null qui fallirebbe. Il controllo dentro la
  --    funzione resta lo stesso, ed e' voluto: se un domani quel vincolo
  --    venisse allentato, una ricetta con un prezzo mancante deve
  --    diventare «non lo so» e non un totale piu' basso del vero. Lo
  --    dichiaro qui invece di far finta di averlo provato.
  select count(*) into n from information_schema.columns
   where table_name = 'ingredients' and column_name = 'current_price'
     and is_nullable = 'NO';
  if n <> 1 then
    raise exception 'current_price non e'' piu'' obbligatoria: quel ramo va provato davvero.';
  end if;

  -- 4. La chiusura congela il numero sulla riga di omaggio.
  perform set_config('request.jwt.claims', null, true);
  update orders set status = 'aperto' where id = v_ord;

  insert into discounts_gifts (entity_id, type, full_amount, collected_amount,
                               costo_ingredienti, righe_valorizzate, righe_senza_costo,
                               created_by)
  values (v_ente, 'omaggio', 29.00, 0, 12.00, 1, 2,
          (select user_id from user_roles order by user_id limit 1));

  select count(*) into n from v_discounts_gifts_monthly
   where entity_id = v_ente and conti_incompleti > 0;
  if n < 1 then
    raise exception 'Il riepilogo mensile non segnala i conti valorizzati solo in parte.';
  end if;

  -- 5. Pulizia (regola del 12/08).
  delete from discounts_gifts where entity_id = v_ente and full_amount = 29.00 and costo_ingredienti = 12.00;
  delete from order_items where order_id = v_ord;
  delete from orders where id = v_ord;
  delete from dining_tables where id = v_tav;
  delete from recipe_ingredients where recipe_id in (v_ric, v_ric2);
  delete from recipes where id in (v_ric, v_ric2);
  delete from price_history where ingredient_id = v_ing;
  delete from ingredients where id = v_ing;

  select count(*) into n from recipes where name like 'PROVA COSTO%';
  if n <> 0 then raise exception 'La prova ha lasciato % ricette.', n; end if;
  select count(*) into n from dining_tables where label like 'PROVA COSTO%';
  if n <> 0 then raise exception 'La prova ha lasciato % tavoli.', n; end if;

  raise notice 'Il costo di un omaggio si congela alla chiusura, e le righe non valorizzabili si dichiarano.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260813000008', 'quanto_costa_un_omaggio')
on conflict (version) do nothing;

select count(*) as omaggi_gia_registrati,
       count(*) filter (where costo_ingredienti is null) as senza_costo
  from discounts_gifts;
