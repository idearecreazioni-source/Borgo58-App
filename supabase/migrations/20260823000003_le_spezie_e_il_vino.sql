-- =====================================================================
-- LE SPEZIE ESCONO DAL MAGAZZINO, E IL VINO DALL'ELENCO
-- 23/08/2026
-- =====================================================================
-- Blocco 2 del mandato del 23/08. Due decisioni di Alessio:
--
--   · *«le spezie a pizzico escono dal magazzino: possiamo anche
--      trascurare roba del genere che ha costi irrilevanti. La cannella
--      comprata resta comprata, e la lista della spesa non la chiede»*;
--   · *«il vino esce dall'elenco delle cose non scese: 1.844 righe tutte
--      uguali seppelliscono le venti che contano»*.
--
-- ---------------------------------------------------------------------
-- 🔴 LA MISURA HA CAMBIATO IL PERIMETRO, e questa e' la parte che conta
-- ---------------------------------------------------------------------
-- Il mandato chiedeva di verificare che le spezie pesassero meno dell'1%
-- sul food cost. Misurato sul ricettario vero (110 prodotti, 116 ricette):
-- **0,73%**. La decisione di Alessio regge.
--
-- ⚠️ MA «LE SPEZIE» NON SONO LA CATEGORIA `spezie_aromi`, e prenderla per
-- tale sarebbe stato un errore grosso: in quella categoria ci sono
-- **basilico, prezzemolo, sale, menta**, che scendono benissimo — misurate
-- **804 righe di consumo** gia' scritte. Su una busiata il basilico vale
-- 0,17 €, il 14% del costo di quel piatto.
--
-- I prodotti che il magazzino **non sa** scaricare sono **quattro**, e non
-- si riconoscono dalla categoria ma dal fatto che in almeno un piatto la
-- loro quantita' arrotonda a zero sui quattro decimali della colonna:
--
--   Cannella in stecche  6 piatti, 5 sotto soglia, max 0,0015 €/porzione
--   Alloro               5 piatti, 2 sotto soglia, max 0,0152 €/porzione
--   Pepe nero in grani   2 piatti, 2 sotto soglia, max 0,0009 €/porzione
--   Zafferano            1 piatto, 1 sotto soglia, max 0,0160 €/porzione
--
-- ⚠️ QUINDI L'INTERRUTTORE STA SUL PRODOTTO, e la sanatoria lo spegne solo
-- dove il gestionale **e' gia' cieco** — una proprieta' che si rimisura,
-- non un elenco di nomi scritto a mano che invecchia al primo prodotto
-- nuovo.
--
-- ⚠️ E IL PREZZO SI DICHIARA: alloro e cannella smetteranno di scendere
-- anche nei **quattro** impieghi in cui oggi scendono. Sono centesimi, ed
-- e' la ragione per cui la scelta e' accettabile — ma non e' zero.
--
-- ---------------------------------------------------------------------
-- IL VINO: perche' `destination`, e non il nome
-- ---------------------------------------------------------------------
-- Misurato: **non esiste un listino bevande**. Ogni bevanda entra in
-- comanda come testo libero, ed e' quello che fa la sala. Ma tutte le
-- righe senza ricetta hanno `destination = 'bar'` — quindi il criterio e'
-- un **dato del gestionale**, non un'euristica sul nome del prodotto.
--
-- ⚠️ Una voce libera in **cucina** resta dichiarata: quella e' un piatto
-- scritto a mano, ed e' un buco vero del magazzino.
--
-- ⚠️ E IL TAGLIO SI DICHIARA A SCHERMO, non si nasconde: «le bevande non
-- compaiono qui». Un elenco che tace su cio' che esclude e' la stessa
-- famiglia della risposta piu' corta che ha l'aria di essere intera.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. L'interruttore
-- ---------------------------------------------------------------------
-- ⚠️ `default true` e non `null`: qui il default **non risponde al posto
-- di nessuno** (trappola del 14/08). Non esiste un terzo stato — o il
-- magazzino segue un prodotto o non lo segue — e «lo segue» e' cio' che il
-- gestionale ha sempre fatto per tutti. La sanatoria qui sotto e' l'unica
-- cosa che cambia una risposta, e dichiara quante righe tocca.
alter table ingredients
  add column if not exists tenuto_in_magazzino boolean not null default true;

comment on column ingredients.tenuto_in_magazzino is
  'Falso quando il magazzino non segue questo prodotto: non si scarica chiudendo un conto, non entra da solo in lista della spesa, non compare nello scadenziario, e la sua giacenza non viene mostrata come un dato. Serve per le spezie a pizzico, che il gestionale non sa scaricare (quantita'' sotto il decimo di grammo) — decisione di Alessio del 23/08/2026. Il costo resta: si compra, e la fattura lo registra.';


-- ---------------------------------------------------------------------
-- 2. Chi sono i candidati — una proprieta', non un elenco
-- ---------------------------------------------------------------------
-- Esiste per una ragione precisa: il giorno che Alessio scrivera' una
-- ricetta nuova con dentro un pizzico, quel prodotto sara' **cieco senza
-- che nessuno lo sappia** — non fallisce piu' niente (blocco 1) e la
-- giacenza semplicemente non scende. Senza questo elenco, la decisione di
-- spegnere l'interruttore non la prenderebbe mai nessuno.
create or replace function prodotti_troppo_piccoli()
returns table (
  ingredient_id  uuid,
  nome           text,
  in_piatti      integer,
  impieghi_ciechi integer,
  max_euro_porzione numeric
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' vedere quali prodotti il magazzino non riesce a seguire';
  end if;

  return query
  with recursive esploso as (
    select r.id as piatto, ri.ingredient_id, ri.component_recipe_id,
           ri.quantity / nullif(r.portions_yield, 0) as mult,
           coalesce(ri.waste_percentage, 0) as scarto, ri.is_optional, 1 as d
      from recipes r
      join recipe_ingredients ri on ri.recipe_id = r.id
     where r.recipe_type in ('piatto_finito', 'finger')
    union all
    select e.piatto, ri2.ingredient_id, ri2.component_recipe_id,
           e.mult * ri2.quantity / nullif(c.yield_quantity, 0),
           coalesce(ri2.waste_percentage, 0), (e.is_optional or ri2.is_optional), e.d + 1
      from esploso e
      join recipes c on c.id = e.component_recipe_id
      join recipe_ingredients ri2 on ri2.recipe_id = e.component_recipe_id
     where e.component_recipe_id is not null and e.d < 10
  ),
  voci as (
    select e.piatto, e.ingredient_id,
           e.mult * (1 + e.scarto / 100.0) as kg,
           e.mult * (1 + e.scarto / 100.0) * coalesce(i.current_price, 0) as euro
      from esploso e
      join ingredients i on i.id = e.ingredient_id
     where e.ingredient_id is not null and not e.is_optional
  )
  select i.id, i.name,
         count(*)::integer,
         count(*) filter (where pizzico_trascurabile(v.kg))::integer,
         round(max(v.euro), 4)
    from voci v
    join ingredients i on i.id = v.ingredient_id
   where i.tenuto_in_magazzino
   group by i.id, i.name
  having count(*) filter (where pizzico_trascurabile(v.kg)) > 0
   order by count(*) filter (where pizzico_trascurabile(v.kg)) desc, i.name;
end;
$funzione$;

comment on function prodotti_troppo_piccoli() is
  'I prodotti che il magazzino non riesce a seguire: in almeno un piatto la loro quantita'' e'' sotto il decimo di grammo che la colonna sa tenere, quindi la giacenza non scende e non scendera'' mai. Non e'' un guasto — e'' la taglia delle colonne — ma senza questo elenco sarebbe silenzioso.';

revoke all on function prodotti_troppo_piccoli() from public, anon, authenticated;
grant execute on function prodotti_troppo_piccoli() to authenticated;


-- ---------------------------------------------------------------------
-- 3. Lo scarico salta i prodotti fuori magazzino, e le bevande non si
--    dichiarano piu'
-- ---------------------------------------------------------------------
-- ⚠️ Corpo preso da quello VIVO nel database.
create or replace function scarica_magazzino_conto(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_order        orders%rowtype;
  v_riga         record;
  v_lotto        record;
  v_da_togliere  numeric;
  v_tolto        numeric;
  v_costo        numeric;
  v_quota        numeric;
  v_errore       text;
  v_falliti      integer := 0;
begin
  select * into v_order from orders where id = p_order_id for update;
  if v_order.id is null then return; end if;
  if v_order.magazzino_scaricato_il is not null then return; end if;
  if v_order.status = 'annullato' then return; end if;

  begin
    -- a. Le voci libere: non hanno ricetta, quindi non si sa cosa
    --    togliere. Non si inventa: si dichiara.
    --    🔴 MENO LE BEVANDE (23/08): una riga destinata al bar non e' un
    --    buco del magazzino, e' come si ordina da bere. Misurate 1.840
    --    righe tutte uguali, che seppellivano le venti che contano — e un
    --    guardiano che grida sempre si impara a spegnere. Il taglio e'
    --    dichiarato nella schermata, non nascosto.
    insert into anomalie_scarico (order_id, order_item_id, tipo, descrizione)
    select p_order_id, oi.id, 'voce_libera',
           coalesce(nullif(trim(oi.free_text_name), ''), 'voce senza nome')
             || ' x' || oi.quantity
      from order_items oi
     where oi.order_id = p_order_id
       and oi.voided_at is null
       and oi.recipe_id is null
       and oi.destination <> 'bar';

    -- b. Le ricette che non dicono cosa togliere.
    insert into anomalie_scarico (order_id, order_item_id, tipo, descrizione)
    select p_order_id, oi.id, 'ricetta_incompleta',
           coalesce(r.name, 'ricetta senza nome')
             || ': nessun ingrediente da scaricare (ricetta vuota, soli ingredienti facoltativi, o porzioni non indicate)'
      from order_items oi
      left join recipes r on r.id = oi.recipe_id
     where oi.order_id = p_order_id
       and oi.voided_at is null
       and oi.recipe_id is not null
       and not exists (
         select 1 from fabbisogno_conto(p_order_id) f where f.order_item_id = oi.id
       );
  exception when others then
    v_errore  := sqlerrm;
    v_falliti := v_falliti + 1;
  end;

  begin
    -- c. Lo scarico, un ingrediente per volta, dai lotti che scadono
    --    prima (FEFO). Ognuno nel suo blocco: un guasto su uno non porta
    --    via gli altri (23/08).
    --    🔴 E i prodotti che il magazzino non segue non entrano nemmeno
    --    nel giro: niente scarico, niente anomalia, niente rumore.
    for v_riga in
      select f.ingredient_id, sum(f.quantita) as quantita
        from fabbisogno_conto(p_order_id) f
        join ingredients i on i.id = f.ingredient_id
       where i.tenuto_in_magazzino
       group by f.ingredient_id
    loop
      begin
        v_da_togliere := v_riga.quantita;
        v_tolto       := 0;
        v_costo       := 0;

        for v_lotto in
          select id, quantity_remaining, unit_cost
            from stock_lots
           where ingredient_id = v_riga.ingredient_id
             and quantity_remaining > 0
           order by expiry_date asc nulls last, received_at asc
           for update
        loop
          exit when v_da_togliere <= 0;
          v_quota := least(v_lotto.quantity_remaining, v_da_togliere);
          update stock_lots
             set quantity_remaining = quantity_remaining - v_quota
           where id = v_lotto.id;
          v_tolto       := v_tolto + v_quota;
          v_costo       := v_costo + v_quota * coalesce(v_lotto.unit_cost, 0);
          v_da_togliere := v_da_togliere - v_quota;
        end loop;

        -- Sotto il decimo di grammo la colonna non sa tenere il numero:
        -- non e' una scrittura persa, e' una scrittura impossibile.
        if not pizzico_trascurabile(v_tolto) then
          insert into stock_consumptions
            (ingredient_id, quantity, reason, note, order_id, quantita_richiesta, costo)
          values
            (v_riga.ingredient_id, round(v_tolto, 4), 'consumo',
             'Conto ' || coalesce(v_order.table_label, '?'),
             p_order_id, v_riga.quantita, round(v_costo, 4));
        end if;

        if not pizzico_trascurabile(v_da_togliere) then
          insert into anomalie_scarico
            (order_id, ingredient_id, tipo, descrizione, quantita_mancante)
          values
            (p_order_id, v_riga.ingredient_id, 'giacenza_insufficiente',
             (select name from ingredients where id = v_riga.ingredient_id),
             round(v_da_togliere, 4));
        end if;

      exception when others then
        v_falliti := v_falliti + 1;
        v_errore  := sqlerrm;
        begin
          insert into anomalie_scarico (order_id, ingredient_id, tipo, descrizione)
          values (p_order_id, v_riga.ingredient_id, 'errore',
                  coalesce((select name from ingredients where id = v_riga.ingredient_id),
                           'ingrediente sconosciuto')
                    || ': ' || sqlerrm);
        exception when others then
          null;
        end;
      end;
    end loop;

    update orders set magazzino_scaricato_il = now() where id = p_order_id;

  exception when others then
    v_errore  := sqlerrm;
    v_falliti := v_falliti + 1;
    begin
      insert into anomalie_scarico (order_id, tipo, descrizione)
      values (p_order_id, 'errore', v_errore);
    exception when others then
      null;
    end;
  end;

  if v_falliti > 0 then
    begin
      perform segnala_allarme(
        'scarico_magazzino',
        'Il magazzino e'' sceso solo in parte alla chiusura di un conto ('
          || v_falliti || ' non scesi): ' || coalesce(v_errore, '?'),
        jsonb_build_object('conto', p_order_id, 'non_scesi', v_falliti),
        'guasto');
    exception when others then
      null;
    end;
  end if;
end;
$funzione$;


-- ---------------------------------------------------------------------
-- 4. Le produzioni saltano gli stessi prodotti
-- ---------------------------------------------------------------------
-- Una riga sola dentro il ciclo: se il magazzino non segue quel prodotto,
-- non lo tocca nemmeno qui — altrimenti un ragu' scaricherebbe la cannella
-- che la sala non scarica, e i due posti direbbero due cose diverse.
create or replace function fabbisogno_preparazione_seguito(p_recipe_id uuid, p_dosi numeric)
returns table (ingredient_id uuid, quantita numeric)
language sql
stable
security definer
set search_path = public
as $funzione$
  select f.ingredient_id, f.quantita
    from fabbisogno_preparazione(p_recipe_id, p_dosi) f
    join ingredients i on i.id = f.ingredient_id
   where i.tenuto_in_magazzino;
$funzione$;

revoke all on function fabbisogno_preparazione_seguito(uuid, numeric) from public, anon, authenticated;

do $riscrivi$
declare
  v_def text;
begin
  -- ⚠️ Si riscrive il corpo VIVO, non quello del file che l'ha creata: fra
  -- i due ci stanno tutte le migrazioni che l'hanno toccata dopo (regola
  -- del 18/08, nata da due cose annullate in silenzio).
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'registra_produzione';

  if v_def is null then
    raise exception 'registra_produzione non esiste: non posso riscriverla.';
  end if;

  -- Gia' fatto: premere Run due volte e' normale (§7 punto 3).
  if position('fabbisogno_preparazione_seguito(p_recipe_id, p_dosi)' in v_def) > 0 then
    raise notice 'registra_produzione gia'' passa dal fabbisogno che salta i prodotti fuori magazzino.';
  elsif position('fabbisogno_preparazione(p_recipe_id, p_dosi)' in v_def) = 0 then
    -- ⚠️ Non si riscrive alla cieca una funzione che non si e' riconosciuta:
    -- e' esattamente il modo in cui il 18/08 sono sparite in silenzio una
    -- colonna e il battito di una sentinella.
    raise exception 'registra_produzione non chiama fabbisogno_preparazione come mi aspettavo: mi fermo invece di riscrivere alla cieca.';
  else
    v_def := replace(v_def,
      'fabbisogno_preparazione(p_recipe_id, p_dosi)',
      'fabbisogno_preparazione_seguito(p_recipe_id, p_dosi)');
    execute v_def;
  end if;
end $riscrivi$;

revoke all on function registra_produzione(uuid, numeric, numeric, date, text) from public, anon, authenticated;
grant execute on function registra_produzione(uuid, numeric, numeric, date, text) to authenticated;


-- ---------------------------------------------------------------------
-- 5. La lista della spesa non li chiede, lo scadenziario non li mostra
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
    i.supplier_id
  from v_stock_levels v
  join ingredients i on i.id = v.ingredient_id
  where v.below_threshold
    -- 🔴 Il magazzino non segue questo prodotto, quindi la sua giacenza
    -- non scende mai: sotto soglia ci finirebbe una volta e resterebbe li'
    -- per sempre. Decisione di Alessio: «la lista della spesa non la
    -- chiede».
    and i.tenuto_in_magazzino
    and not exists (
      select 1 from shopping_list_items sli
      where sli.ingredient_id = v.ingredient_id and sli.status <> 'acquistato'
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$funzione$;

revoke all on function add_below_threshold_items() from public, anon, authenticated;
grant execute on function add_below_threshold_items() to authenticated;

-- La vista delle giacenze porta l'interruttore, cosi' la schermata puo'
-- smettere di raccontare un numero che sa essere fermo.
-- ⚠️ La colonna si aggiunge IN FONDO: `create or replace view` non sa
-- infilarne una in mezzo (42P16).
create or replace view v_stock_levels as
select i.id as ingredient_id,
       i.name as ingredient_name,
       i.unit,
       i.stock_minimum_threshold,
       coalesce(sum(sl.quantity_remaining), 0::numeric)::numeric(12,4) as current_quantity,
       i.stock_minimum_threshold is not null
         and coalesce(sum(sl.quantity_remaining), 0::numeric) < i.stock_minimum_threshold as below_threshold,
       min(sl.expiry_date) filter (where sl.quantity_remaining > 0::numeric) as nearest_expiry,
       i.tenuto_in_magazzino
  from ingredients i
  left join stock_lots sl on sl.ingredient_id = i.id
 where i.active
 group by i.id, i.name, i.unit, i.stock_minimum_threshold, i.tenuto_in_magazzino;


-- ---------------------------------------------------------------------
-- 6. La sanatoria: si spegne dove il gestionale e' gia' cieco
-- ---------------------------------------------------------------------
-- ⚠️ Non un elenco di nomi — quello invecchierebbe al primo prodotto nuovo
-- — ma la stessa proprieta' che `prodotti_troppo_piccoli()` rimisura ogni
-- volta. In produzione il Ricettario e' vuoto: qui non tocchera' niente, e
-- va bene cosi'.
--
-- ⚠️ E DICHIARA QUANTE RIGHE TOCCA (regola del 16/08): uno zero non e' un
-- errore, ma il silenzio ha gia' ingannato quattro volte.
do $sanatoria$
declare
  v_quanti integer;
  v_nomi   text;
  v_tit    uuid;
begin
  -- ⚠️ La funzione ha un portiere e una migrazione non ha un utente: si
  -- impersona il titolare (trappola del 16/08). E si chiama LEI invece di
  -- ricopiarne la query: due posti che calcolano la stessa proprieta'
  -- finirebbero per dire due cose diverse, e a divergere sarebbe quello
  -- che nessuno rilegge.
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: non posso leggere i candidati.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  select count(*), string_agg(nome, ', ' order by nome)
    into v_quanti, v_nomi
    from prodotti_troppo_piccoli();

  update ingredients set tenuto_in_magazzino = false
   where id in (select ingredient_id from prodotti_troppo_piccoli());

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Fuori dal magazzino: % prodotti (%)', v_quanti, coalesce(v_nomi, 'nessuno');
end $sanatoria$;


-- ---------------------------------------------------------------------
-- 6-bis. Le bevande gia' dichiarate escono dall'elenco
-- ---------------------------------------------------------------------
-- ⚠️ Non e' una comodita': senza, lo stesso elenco direbbe due cose
-- diverse sullo stesso fatto a seconda della data — le bevande di ieri
-- dentro, quelle di domani fuori — e chi guarda non avrebbe modo di
-- sapere quale delle due regole sta leggendo.
--
-- Perimetro stretto e verificabile: **solo** le righe `voce_libera` la cui
-- riga di comanda era destinata al bar. `anomalie_scarico` non e' fra le
-- tabelle tracciate (controllato, non dedotto), quindi non lascia lapidi.
--
-- ⚠️ E DICHIARA QUANTE RIGHE TOCCA. In produzione oggi sono zero: non c'e'
-- nessun conto chiuso.
do $pulizia$
declare
  v_quante integer;
  v_lapidi integer;
  v_lapidi_2 integer;
begin
  select count(*) into v_lapidi from deleted_records;

  delete from anomalie_scarico a
   using order_items oi
   where oi.id = a.order_item_id
     and a.tipo = 'voce_libera'
     and oi.destination = 'bar';
  get diagnostics v_quante = row_count;

  select count(*) into v_lapidi_2 from deleted_records;
  if v_lapidi_2 <> v_lapidi then
    raise exception 'La pulizia ha lasciato % lapidi: anomalie_scarico non era la tabella che credevo.',
      v_lapidi_2 - v_lapidi;
  end if;

  raise notice 'Bevande tolte dall''elenco di cio'' che non e'' sceso: % righe', v_quante;
end $pulizia$;


-- ---------------------------------------------------------------------
-- 7. Verifica — con dati propri, cancellati alla fine
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente     uuid;
  v_normale  uuid;
  v_fuori    uuid;
  v_ric      uuid;
  v_conto    uuid;
  v_righe    integer;
  v_q        numeric;
  v_rimasto  numeric;
  v_lapidi   integer;
  v_lapidi_2 integer;
  v_tit      uuid;
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_ente from entities order by created_at limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;

  insert into ingredients (name, unit, category, entity_id, alimentare)
  values ('ZZ verifica pesce 2', 'kg', 'pesce', v_ente, true) returning id into v_normale;
  -- Un prodotto TENUTO IN MAGAZZINO ma fuori: la quantita' e' grande, cosi'
  -- se scendesse si vedrebbe. ⚠️ Non un pizzico: altrimenti la prova non
  -- distinguerebbe «non scende perche' e' fuori magazzino» da «non scende
  -- perche' e' troppo piccolo», e passerebbe verde per la ragione
  -- sbagliata.
  insert into ingredients (name, unit, category, entity_id, alimentare, tenuto_in_magazzino)
  values ('ZZ verifica spezia 2', 'kg', 'spezie_aromi', v_ente, true, false) returning id into v_fuori;

  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost)
  values (v_normale, 10, 10, 20), (v_fuori, 5, 5, 30);

  insert into recipes (name, category, recipe_type, portions_yield)
  values ('ZZ verifica piatto 2', 'secondo', 'piatto_finito', 1) returning id into v_ric;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_ric, v_normale, 0.5, 'kg'),
         (v_ric, v_fuori, 0.2, 'kg');   -- 200 grammi: si vedrebbero benissimo

  insert into orders (table_label, status, opened_at)
  values ('ZZ verifica 2', 'aperto', now()) returning id into v_conto;
  insert into order_items (order_id, recipe_id, destination, quantity, unit_price, sent_at)
  values (v_conto, v_ric, 'cucina', 1, 20, now());
  -- Una bevanda e un piatto scritto a mano: la prima non si dichiara piu',
  -- il secondo si'.
  insert into order_items (order_id, free_text_name, destination, quantity, unit_price, sent_at)
  values (v_conto, 'ZZ Grillo calice', 'bar', 1, 5, now()),
         (v_conto, 'ZZ piatto del giorno', 'cucina', 1, 12, now());

  perform scarica_magazzino_conto(v_conto);

  -- 1. Il prodotto seguito scende.
  select quantity into v_q from stock_consumptions
   where order_id = v_conto and ingredient_id = v_normale;
  if v_q is null or v_q <> 0.5000 then
    raise exception 'Il prodotto seguito non e'' sceso: %.', v_q;
  end if;

  -- 2. Quello fuori magazzino no, e non lascia nessuna anomalia.
  select count(*) into v_righe from stock_consumptions
   where order_id = v_conto and ingredient_id = v_fuori;
  if v_righe <> 0 then
    raise exception 'Un prodotto fuori magazzino ha scritto % righe di consumo.', v_righe;
  end if;
  select quantity_remaining into v_rimasto from stock_lots where ingredient_id = v_fuori;
  if v_rimasto <> 5 then
    raise exception 'Il lotto di un prodotto fuori magazzino si e'' mosso: %.', v_rimasto;
  end if;
  select count(*) into v_righe from anomalie_scarico
   where order_id = v_conto and ingredient_id = v_fuori;
  if v_righe <> 0 then
    raise exception 'Un prodotto fuori magazzino ha lasciato % anomalie: doveva essere silenzioso.', v_righe;
  end if;

  -- 3. LA BEVANDA NON SI DICHIARA PIU', il piatto a mano si'.
  select count(*) into v_righe from anomalie_scarico
   where order_id = v_conto and tipo = 'voce_libera' and descrizione like 'ZZ Grillo%';
  if v_righe <> 0 then
    raise exception 'La bevanda compare ancora fra le cose non scese.';
  end if;
  select count(*) into v_righe from anomalie_scarico
   where order_id = v_conto and tipo = 'voce_libera' and descrizione like 'ZZ piatto del giorno%';
  if v_righe <> 1 then
    raise exception 'Il piatto scritto a mano NON e'' stato dichiarato (% righe): quello e'' un buco vero.', v_righe;
  end if;

  -- 4. La lista della spesa non lo chiede.
  update ingredients set stock_minimum_threshold = 100 where id = v_fuori;
  perform add_below_threshold_items();
  select count(*) into v_righe from shopping_list_items where ingredient_id = v_fuori;
  if v_righe <> 0 then
    raise exception 'La lista della spesa chiede un prodotto che il magazzino non segue.';
  end if;
  -- E la controprova: quello seguito, sotto soglia, ci finisce.
  update ingredients set stock_minimum_threshold = 100 where id = v_normale;
  perform add_below_threshold_items();
  select count(*) into v_righe from shopping_list_items where ingredient_id = v_normale;
  if v_righe <> 1 then
    raise exception 'La lista non chiede un prodotto seguito e sotto soglia (% righe): il filtro taglia troppo.', v_righe;
  end if;

  -- 5. L'elenco dei candidati risponde, e non comprende chi e' gia' fuori.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_righe from prodotti_troppo_piccoli() where ingredient_id = v_fuori;
  if v_righe <> 0 then
    raise exception 'L''elenco dei candidati comprende chi e'' gia'' fuori dal magazzino.';
  end if;
  perform set_config('request.jwt.claims', null, true);

  -- pulizia
  alter table order_items disable trigger trg_riga_servita;
  alter table order_items disable trigger trg_log_delete;
  delete from shopping_list_items where ingredient_id in (v_normale, v_fuori);
  delete from stock_consumptions where order_id = v_conto;
  delete from anomalie_scarico where order_id = v_conto;
  delete from order_items where order_id = v_conto;
  delete from orders where id = v_conto;
  delete from recipe_ingredients where recipe_id = v_ric;
  delete from recipes where id = v_ric;
  delete from stock_lots where ingredient_id in (v_normale, v_fuori);
  delete from ingredients where id in (v_normale, v_fuori);
  alter table order_items enable trigger trg_riga_servita;
  alter table order_items enable trigger trg_log_delete;
  if (select count(*) from pg_trigger
       where tgrelid = 'order_items'::regclass and tgenabled = 'D') > 0 then
    raise exception 'Un guardiano delle righe e'' rimasto spento.';
  end if;

  select count(*) into v_lapidi_2 from deleted_records;
  if v_lapidi_2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.', v_lapidi_2 - v_lapidi;
  end if;

  raise notice 'Verifica passata: il prodotto fuori magazzino non scende e non fa rumore, la bevanda esce dall''elenco, il piatto scritto a mano ci resta.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260823000003', 'le_spezie_e_il_vino') on conflict (version) do nothing;
