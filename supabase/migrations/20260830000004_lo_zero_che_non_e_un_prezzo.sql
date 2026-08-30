-- =====================================================================
-- LO ZERO CHE NON E' UN PREZZO — 30/08/2026
-- =====================================================================
--
-- 🔴 IL PUNTO DI PARTENZA E' UNA COSA VISTA DA ALESSIO: nelle Produzioni,
-- «Busiate trafilate» dichiarava **costata 0,00 €**. Il mandato chiedeva di
-- MISURARE prima di correggere, e diceva due ipotesi: o la ricetta non ha
-- ingredienti prezzati, o il costo si perde per strada.
--
-- 🔴 MISURATO IL 30/08 SUL PROGETTO DI PROVA, E NON E' NESSUNA DELLE DUE.
--   · «Busiate trafilate» ha **2 righe di ricetta e tutte e due prezzate**
--     (farina 1,35 €/kg, sale 0,65 €/kg): la prima ipotesi cade.
--   · La produzione del 15/07 esiste e il suo costo e' **0,0034 €** — non
--     zero. Sono i 5,2 grammi di sale.
--   · Della farina sono usciti **405 grammi** e il costo registrato per
--     quella riga e' **0,0000**. A 1,35 €/kg sarebbero stati 0,55 €.
--   · Il perche': il lotto da cui e' uscita **non ha un prezzo d'acquisto**
--     (`stock_lots.unit_cost` vuoto), e tutti e due i punti che scaricano
--     scrivono `coalesce(unit_cost, 0)`.
--
-- 🔴 QUINDI I DIFETTI SONO DUE, E SONO DI NATURA DIVERSA.
--   (a) **Un dato che non si e' potuto leggere veniva mostrato come dato.**
--       Un lotto senza prezzo contava zero, e «e' costato zero» diventava
--       indistinguibile da «non so quanto e' costato». E' la famiglia che
--       questo progetto insegue dal 19/08 — *assenza di informazione contro
--       informazione di assenza* — nel punto in cui fa piu' male, perche' il
--       numero che ne esce e' **plausibile**: nessuno mette in dubbio un
--       costo un po' basso.
--   (b) **0,0034 € si scriveva «0,00 €»**, che si legge «gratis». Quello si
--       cura dove si scrivono gli importi, non qui.
--
-- ⚠️ QUANTO E' GRANDE, misurato e non stimato: **8 lotti su 500** non hanno
-- un prezzo, e **130 scarichi su 13.789** sono finiti a costo zero con una
-- quantita' maggiore di zero. Sul gestionale vero oggi non c'e' nessun
-- lotto — la misura viene dal progetto di prova, ed e' dichiarato.
--
-- ⚠️ E LE RISPOSTE SONO TRE, non due, in tutti e due i posti nuovi:
-- completo · parziale · **non lo so** (le righe scritte prima di stanotte).
-- Riempire le vecchie con «completo» sarebbe rispondere al posto di chi non
-- c'era, ed e' la trappola del 14/08.

-- ---------------------------------------------------------------------
-- 1. LE DUE COLONNE
-- ---------------------------------------------------------------------
alter table stock_consumptions
  add column if not exists quantita_senza_costo numeric;

comment on column stock_consumptions.quantita_senza_costo is
  'Quanta di questa quantita'' e'' uscita da lotti SENZA prezzo d''acquisto, quindi contata zero. Vuoto = riga scritta prima del 30/08/2026: non si sa.';

alter table produzioni
  add column if not exists costo_stato text;

do $vincoli$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'produzioni'::regclass
                    and conname = 'produzioni_costo_stato_check') then
    alter table produzioni add constraint produzioni_costo_stato_check
      check (costo_stato is null or costo_stato in ('completo', 'parziale'));
  end if;
end
$vincoli$;

comment on constraint produzioni_costo_stato_check on produzioni is
  'Il costo di una produzione puo'' essere «completo» o «parziale». Vuoto vuol dire che la produzione e'' stata registrata prima del 30/08/2026 e non si sa.';

comment on column produzioni.costo_stato is
  'Se il costo comprende tutto («completo») o se una parte della merce e'' uscita da lotti senza prezzo («parziale»). Vuoto = registrata prima del 30/08/2026: non lo so.';

-- ---------------------------------------------------------------------
-- 2. I DUE PUNTI CHE SCARICANO, RIPRESI DAL CORPO VIVO
-- ---------------------------------------------------------------------
-- ⚠️ Corpi presi con `npm run funzione:viva --prova`, non dai file che le
--    hanno create: fra i due ci stanno tutte le migrazioni che le hanno
--    toccate. E dal progetto di PROVA e non dalla produzione, perche'
--    stanotte ci sono migrazioni in attesa e la produzione e' indietro.
-- ⚠️ CAMBIA POCO E IN DUE PUNTI IDENTICI in tutte e due: si conta quanta
--    merce esce da un lotto senza prezzo, e la si scrive accanto al costo.
--    Il costo NON cambia di un centesimo: cambia che adesso dice se e'
--    intero.

CREATE OR REPLACE FUNCTION public.scarica_magazzino_conto(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order        orders%rowtype;
  v_riga         record;
  v_lotto        record;
  v_da_togliere  numeric;
  v_tolto        numeric;
  v_costo        numeric;
  v_quota        numeric;
  v_senza        numeric;   -- quanto e' uscito da lotti SENZA prezzo d'acquisto
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

    -- b-bis. 🔴 LE PREPARAZIONI CHE IL MAGAZZINO NON SEGUE (25/08/2026).
    --    Il filtro del ciclo qui sotto tace su tutto cio' che ha
    --    `tenuto_in_magazzino = false`, e per i prodotti ordinari e'
    --    voluto. Ma una preparazione CON DELLE PARTITE IN CELLA il
    --    magazzino la segue di fatto: c'e' merce che entra e non esce
    --    piu'. Quel silenzio non e' una scelta, e' un buco.
    --    ⚠️ Si dichiara e basta: NON si scarica. Forzare lo scarico
    --    scavalcherebbe una scelta scritta sulla scheda del prodotto.
    --    ⚠️ E la descrizione e' SOLO IL NOME: il motivo lo scrive la
    --    schermata, come per le altre righe dell'elenco.
    insert into anomalie_scarico
      (order_id, ingredient_id, tipo, descrizione, quantita_mancante)
    select p_order_id, f.ingredient_id, 'preparazione_non_seguita', i.name,
           case when pizzico_trascurabile(sum(f.quantita)) then null
                else round(sum(f.quantita), 4) end
      from fabbisogno_conto(p_order_id) f
      join ingredients i on i.id = f.ingredient_id
     where not i.tenuto_in_magazzino
       and i.preparazione_id is not null
       and exists (select 1 from stock_lots sl where sl.ingredient_id = i.id)
     group by f.ingredient_id, i.name;
  exception when others then
    v_errore  := sqlerrm;
    v_falliti := v_falliti + 1;
  end;

  begin
    -- c. Lo scarico, un ingrediente per volta, dai lotti che scadono
    --    prima (FEFO). Ognuno nel suo blocco: un guasto su uno non porta
    --    via gli altri (23/08).
    --    🔴 E i prodotti che il magazzino non segue non entrano nemmeno
    --    nel giro: niente scarico. Il silenzio pero' non e' piu' totale —
    --    le preparazioni con partite in cella sono dichiarate sopra.
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
        -- 🔴 QUANTO E' USCITO DA LOTTI CHE NON HANNO UN PREZZO (30/08).
        --    Prima `coalesce(unit_cost, 0)` faceva contare zero e nessuno
        --    poteva distinguere «e' costato zero» da «non si sa quanto e'
        --    costato». Misurato: 8 lotti su 500 senza prezzo e 130 scarichi
        --    finiti a zero senza dirlo.
        v_senza       := 0;

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
          if v_lotto.unit_cost is null then v_senza := v_senza + v_quota; end if;
          v_da_togliere := v_da_togliere - v_quota;
        end loop;

        -- Sotto il decimo di grammo la colonna non sa tenere il numero:
        -- non e' una scrittura persa, e' una scrittura impossibile.
        if not pizzico_trascurabile(v_tolto) then
          insert into stock_consumptions
            (ingredient_id, quantity, reason, note, order_id, quantita_richiesta, costo,
             quantita_senza_costo)
          values
            (v_riga.ingredient_id, round(v_tolto, 4), 'consumo',
             'Conto ' || coalesce(v_order.table_label, '?'),
             p_order_id, v_riga.quantita, round(v_costo, 4),
             round(v_senza, 4));
        end if;

        if scarto_da_dire(v_da_togliere, v_riga.quantita) then
          insert into anomalie_scarico
            (order_id, ingredient_id, tipo, descrizione, quantita_mancante, quantita_richiesta)
          values
            (p_order_id, v_riga.ingredient_id, 'giacenza_insufficiente',
             (select name from ingredients where id = v_riga.ingredient_id),
             round(v_da_togliere, 4), v_riga.quantita);
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
$function$;


CREATE OR REPLACE FUNCTION public.registra_produzione(p_recipe_id uuid, p_dosi numeric, p_quantita_ottenuta numeric, p_scadenza date DEFAULT NULL::date, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ric        recipes%rowtype;
  v_ingr       uuid;
  v_prod       uuid;
  v_lotto      uuid;
  v_riga       record;
  v_lot        record;
  v_da         numeric;
  v_tolto      numeric;
  v_costo      numeric := 0;   -- il totale della produzione
  v_costo_riga numeric;        -- quanto e' costato QUESTO ingrediente
  v_senza      numeric;        -- quanto e' uscito da lotti SENZA prezzo
  v_senza_tot  numeric := 0;   -- lo stesso, su tutta la produzione
  v_quota      numeric;
  v_mancanti   integer := 0;
  v_scadenza   date;           -- calcolata dalla durata della ricetta
begin
  -- Registrare una produzione e' compito della cucina: il controllo e'
  -- che ci sia un utente vero, non che sia il titolare. Il COSTO pero'
  -- non torna indietro da qui — vive sul lotto, che lo staff non legge.
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_ric from recipes where id = p_recipe_id;
  if v_ric.id is null then raise exception 'Preparazione non trovata'; end if;
  if p_dosi is null or p_dosi <= 0 then
    raise exception 'Quante dosi hai fatto? Il numero serve: senza, un calo e mezza dose sono la stessa cosa';
  end if;
  if p_quantita_ottenuta is null or p_quantita_ottenuta <= 0 then
    raise exception 'Quanto ne e'' uscito? Serve il peso vero, non quello della ricetta';
  end if;

  -- 🔴 LA DURATA VIVE SULLA RICETTA, LA SCADENZA NASCE QUI (28/08/2026).
  --    Decisione di Alessio: la durata si scrive UNA VOLTA sulla ricetta
  --    («questo ragu' dura 5 giorni») e ogni produzione calcola da se' la
  --    propria scadenza — cosi' quando etichetta i barattoli se la ritrova
  --    pronta, invece di rifare il conto a ogni vasetto.
  --
  -- ⚠️ UNA DATA PASSATA A MANO VINCE SEMPRE, e non e' una seconda verita':
  --    e' lo stesso campo, scritto apertamente da chi sa qualcosa che la
  --    ricetta non sa (una dose andata storta, un frigo che ha fatto le bizze).
  --    Quello che sparisce e' l'OBBLIGO di scriverla ogni volta.
  --
  -- ⚠️ E IL GIORNO E' QUELLO DEL CALENDARIO ITALIANO — non `current_date`,
  --    che e' Greenwich e alle 01:30 risponde ieri, e non la serata di
  --    servizio: una data stampata su un'etichetta e' un fatto del
  --    calendario, come la raccolta o una scadenza fiscale.
  if p_scadenza is not null then
    v_scadenza := p_scadenza;
  elsif v_ric.durata_giorni is not null then
    v_scadenza := (now() at time zone 'Europe/Rome')::date + v_ric.durata_giorni;
  else
    v_scadenza := null;
  end if;

  v_ingr := ingrediente_di_preparazione(p_recipe_id);

  insert into produzioni (
    recipe_id, ingredient_id, dosi, quantita_ottenuta, unita,
    resa_attesa, scadenza, note, creato_da
  ) values (
    p_recipe_id, v_ingr, p_dosi, p_quantita_ottenuta,
    coalesce(v_ric.yield_unit::text, 'kg'),
    case when v_ric.yield_quantity is not null then v_ric.yield_quantity * p_dosi end,
    v_scadenza, p_note, auth.uid()
  )
  returning id into v_prod;

  -- 🔴 LE PREPARAZIONI CHE IL MAGAZZINO NON SEGUE (25/08/2026), stessa
  --    regola della sala: `fabbisogno_preparazione_seguito` taglia via
  --    tutto cio' che ha `tenuto_in_magazzino = false`, e per i prodotti
  --    ordinari e' voluto. Un semilavorato CON DELLE PARTITE IN CELLA no:
  --    li' il silenzio nasconde merce che entra e non esce.
  --    ⚠️ Descrizione = SOLO IL NOME: il motivo lo scrive la schermata.
  insert into anomalie_scarico
    (produzione_id, ingredient_id, tipo, descrizione, quantita_mancante)
  select v_prod, f.ingredient_id, 'preparazione_non_seguita', i.name,
         case when pizzico_trascurabile(sum(f.quantita)) then null
              else round(sum(f.quantita), 4) end
    from fabbisogno_preparazione(p_recipe_id, p_dosi) f
    join ingredients i on i.id = f.ingredient_id
   where not i.tenuto_in_magazzino
     and i.preparazione_id is not null
     and exists (select 1 from stock_lots sl where sl.ingredient_id = i.id)
   group by f.ingredient_id, i.name;

  -- ⚠️ E il conteggio che torna alla schermata le comprende: sono righe
  --    non scaricate a tutti gli effetti, e lasciarle fuori direbbe
  --    «e' sceso tutto» proprio nel caso in cui non e' vero.
  get diagnostics v_mancanti = row_count;

  -- Lo scarico, dai lotti che scadono prima (FEFO).
  -- ⚠️ Dal fabbisogno che salta i prodotti fuori magazzino (23/08): senza,
  -- un ragu' scaricherebbe la cannella che la sala non scarica, e i due
  -- posti direbbero due cose diverse.
  for v_riga in
    select f.ingredient_id, f.quantita from fabbisogno_preparazione_seguito(p_recipe_id, p_dosi) f
  loop
    v_da := v_riga.quantita;
    v_tolto := 0;
    v_costo_riga := 0;
    -- 🔴 QUANTO E' USCITO DA LOTTI SENZA PREZZO (30/08). Vedi il gemello in
    --    `scarica_magazzino_conto`: senza questo, «costata 0,00» non si
    --    distingue da «non so quanto e' costata».
    v_senza := 0;

    for v_lot in
      select id, quantity_remaining, unit_cost
        from stock_lots
       where ingredient_id = v_riga.ingredient_id and quantity_remaining > 0
       order by expiry_date asc nulls last, received_at asc
       for update
    loop
      exit when v_da <= 0;
      v_quota := least(v_lot.quantity_remaining, v_da);
      update stock_lots set quantity_remaining = quantity_remaining - v_quota where id = v_lot.id;
      v_tolto      := v_tolto + v_quota;
      v_costo_riga := v_costo_riga + v_quota * coalesce(v_lot.unit_cost, 0);
      if v_lot.unit_cost is null then v_senza := v_senza + v_quota; end if;
      v_da         := v_da - v_quota;
    end loop;

    v_costo := v_costo + v_costo_riga;
    v_senza_tot := v_senza_tot + v_senza;

    -- 🔴 Come nello scarico di un conto: sotto il decimo di grammo non
    -- c'e' nessun numero da scrivere (23/08).
    if not pizzico_trascurabile(v_tolto) then
      insert into stock_consumptions
        (ingredient_id, quantity, reason, note, produzione_id, quantita_richiesta, costo,
         quantita_senza_costo)
      values
        (v_riga.ingredient_id, round(v_tolto, 4), 'consumo',
         'Produzione: ' || v_ric.name, v_prod, v_riga.quantita,
         round(v_costo_riga, 4), round(v_senza, 4));
    end if;

    -- Non si inventa e non si blocca: il semilavorato e' gia' fatto.
    if scarto_da_dire(v_da, v_riga.quantita) then
      v_mancanti := v_mancanti + 1;
      insert into anomalie_scarico
        (produzione_id, ingredient_id, tipo, descrizione, quantita_mancante, quantita_richiesta)
      values
        (v_prod, v_riga.ingredient_id, 'giacenza_insufficiente',
         (select name from ingredients where id = v_riga.ingredient_id),
         round(v_da, 4), v_riga.quantita);
    end if;
  end loop;

  -- Il lotto del semilavorato, col costo di oggi.
  insert into stock_lots (
    ingredient_id, quantity_received, quantity_remaining, unit_cost, expiry_date, note
  ) values (
    v_ingr, p_quantita_ottenuta, p_quantita_ottenuta,
    round(v_costo / p_quantita_ottenuta, 4), v_scadenza,
    'Produzione del ' || to_char((now() at time zone 'Europe/Rome')::date, 'DD/MM/YYYY')
  )
  returning id into v_lotto;

  -- 🔴 E LA PRODUZIONE DICHIARA SE IL SUO COSTO E' INTERO. Le risposte
  --    sono TRE: 'completo', 'parziale' e — per le produzioni scritte prima
  --    del 30/08 — la colonna VUOTA, che vuol dire «non lo so». Riempirle
  --    con 'completo' sarebbe rispondere al posto di chi non c'era.
  update produzioni
     set lotto_id = v_lotto,
         costo = round(v_costo, 4),
         costo_stato = case when v_senza_tot > 0 then 'parziale' else 'completo' end
   where id = v_prod;

  -- Niente costi nella risposta: la chiama anche la cucina.
  -- ⚠️ I NOMI DEI CAMPI SONO UN PATTO CON LA SCHERMATA: `Produzioni.jsx`
  -- legge `righe_non_scaricate`, e rinominarlo non da' nessun errore —
  -- l'avviso direbbe zero per sempre.
  return jsonb_build_object(
    'produzione_id', v_prod,
    'lotto_id', v_lotto,
    'quantita', p_quantita_ottenuta,
    'righe_non_scaricate', v_mancanti
  );
end;
$function$;

-- ---------------------------------------------------------------------
-- 3. LA VERIFICA
-- ---------------------------------------------------------------------
-- ⚠️ I PERMESSI NON SI RISCRIVONO A MEMORIA (trappole del 24 e del 27/08).
--    Qui non c'e' nessun `grant`: tutt'e due le funzioni sono state rifatte
--    con `create or replace` e la stessa firma, e in Postgres questo
--    CONSERVA i permessi — un `drop` li avrebbe azzerati. La verifica non
--    si fida di questa frase: li MISURA, e i valori attesi sono quelli
--    letti dal database il 30/08 prima di toccare niente.
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_ent      uuid;
  v_ric      uuid;
  v_ing      uuid;
  v_l_caro   uuid;
  v_l_muto   uuid;
  v_prod     uuid;
  v_stato    text;
  v_costo    numeric;
  v_senza    numeric;
  v_n        integer;
  v_tit      uuid;
  v_miei     uuid[] := '{}';
begin
  select id into v_ent from entities order by created_at limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_ent is null or v_tit is null then
    raise exception 'Manca la societa'' o il titolare: impossibile verificare.';
  end if;

  -- ⚠️ `registra_produzione` pretende un utente autenticato, e dentro una
  --    migrazione non ce n'e' nessuno: si impersona il titolare, come fanno
  --    le altre verifiche di questo progetto. E si rimette a posto in fondo.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- (1) I PERMESSI SONO RIMASTI QUELLI DI PRIMA.
  if has_function_privilege('authenticated', 'registra_produzione(uuid,numeric,numeric,date,text)', 'execute') is distinct from true then
    raise exception 'registra_produzione non e'' piu'' eseguibile da chi usa il gestionale: il replace ha azzerato i permessi.';
  end if;
  if has_function_privilege('anon', 'registra_produzione(uuid,numeric,numeric,date,text)', 'execute') then
    raise exception 'registra_produzione e'' diventata eseguibile con la chiave pubblica.';
  end if;
  if has_function_privilege('authenticated', 'scarica_magazzino_conto(uuid)', 'execute') then
    raise exception 'scarica_magazzino_conto si e'' aperta: era chiusa a tutti.';
  end if;

  -- (2) L'ESEMPIO SI COSTRUISCE. Una preparazione mia, due lotti miei: uno
  --     col prezzo e uno SENZA. E' l'unico modo per far comparire il caso.
  insert into ingredients (name, category, unit, current_price, entity_id,
                           alimentare, tenuto_in_magazzino)
  values ('ZZ farina di prova', 'farine_cereali', 'kg', 2, v_ent, true, true)
  returning id into v_ing;
  v_miei := v_miei || v_ing;

  insert into recipes (name, category, recipe_type, portions_yield, yield_quantity, yield_unit)
  values ('ZZ preparazione di prova', 'primo', 'preparazione', 1, 1, 'kg')
  returning id into v_ric;
  v_miei := v_miei || v_ric;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_ric, v_ing, 2, 'kg');

  -- Il lotto col prezzo scade PRIMA, quindi FEFO lo prende per primo:
  -- 1 kg a 2 euro. Poi il lotto muto copre il chilo che resta.
  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, expiry_date)
  values (v_ing, 1, 1, 2, current_date + 10) returning id into v_l_caro;
  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, expiry_date)
  values (v_ing, 5, 5, null, current_date + 90) returning id into v_l_muto;
  v_miei := v_miei || v_l_caro || v_l_muto;

  -- (3) LA PRODUZIONE. Due chili chiesti, uno prezzato e uno muto.
  --     ⚠️ I NUMERI SONO SCELTI PERCHE' LE RISPOSTE SBAGLIATE SI VEDANO:
  --        costo 2,00 e non 4,00 (il secondo chilo non ha prezzo) e
  --        «senza costo» 1 e non 0. Con un lotto solo le due risposte
  --        coinciderebbero e la prova non proverebbe niente.
  -- ⚠️ La funzione restituisce un oggetto, non un identificativo: si
  --    prende il campo. Trovato APPLICANDO, non rileggendo.
  v_prod := (registra_produzione(v_ric, 1, 1, null, 'ZZ verifica') ->> 'produzione_id')::uuid;
  v_miei := v_miei || v_prod;

  select costo, costo_stato into v_costo, v_stato from produzioni where id = v_prod;
  if v_costo is distinct from 2.0000 then
    raise exception 'Il costo della produzione e'' % invece di 2,0000.', coalesce(v_costo::text, '(vuoto)');
  end if;
  if v_stato is distinct from 'parziale' then
    raise exception 'La produzione dichiara il costo «%» invece di «parziale»: uno zero non e'' un prezzo.',
      coalesce(v_stato, '(vuoto)');
  end if;

  select quantita_senza_costo into v_senza
    from stock_consumptions where produzione_id = v_prod and ingredient_id = v_ing;
  if v_senza is distinct from 1.0000 then
    raise exception 'La quantita'' uscita da lotti senza prezzo e'' % invece di 1,0000.',
      coalesce(v_senza::text, '(vuoto)');
  end if;

  -- (4) E IL VERSO OPPOSTO: dove i lotti hanno tutti un prezzo, la
  --     produzione dev'essere «completo». Un controllo che dicesse sempre
  --     «parziale» passerebbe il controllo (3) senza distinguere niente.
  update stock_lots set unit_cost = 3 where id = v_l_muto;
  update stock_lots set quantity_remaining = 1 where id = v_l_caro;

  v_prod := (registra_produzione(v_ric, 1, 1, null, 'ZZ verifica completa') ->> 'produzione_id')::uuid;
  v_miei := v_miei || v_prod;

  select costo_stato into v_stato from produzioni where id = v_prod;
  if v_stato is distinct from 'completo' then
    raise exception 'Con tutti i lotti prezzati la produzione dichiara «%» invece di «completo».',
      coalesce(v_stato, '(vuoto)');
  end if;

  -- (5) LE PRODUZIONI VECCHIE RESTANO VUOTE, e non si riempiono di
  --     «completo». Sono state registrate quando nessuno contava: dire che
  --     il loro costo e' intero sarebbe rispondere al posto di chi non c'era.
  select count(*) into v_n from produzioni
   where costo_stato is null and id <> all(v_miei);
  raise notice 'Produzioni registrate prima di stanotte, che restano senza risposta: %.', v_n;

  -- ------------------------------------------------------------------
  -- LA PULIZIA. Solo roba mia, per identificativo, tenuta in un ARRAY e
  -- non in una variabile riusata (trappola del 26/08).
  -- ------------------------------------------------------------------
  -- ⚠️ DUE registri, non uno. `storico_costi_ricetta` l'ho scoperto
  --    APPLICANDO: non lo cancello io, ci arriva a CASCATA dalla ricetta,
  --    e tre lapidi sono comparse senza che nessuna mia riga le nominasse.
  --    Contare le lapidi le ha prese; rileggere il codice no.
  alter table stock_consumptions    disable trigger trg_log_delete;
  alter table storico_costi_ricetta disable trigger trg_log_delete;

  delete from anomalie_scarico   where produzione_id = any(v_miei);
  delete from stock_consumptions where produzione_id = any(v_miei);
  delete from stock_lots         where id in (select lotto_id from produzioni where id = any(v_miei));
  delete from produzioni         where id = any(v_miei);
  delete from stock_lots         where ingredient_id = v_ing;
  delete from recipe_ingredients where recipe_id = v_ric;
  -- ⚠️ OGNI PRODUZIONE FA NASCERE UN PRODOTTO SUO (regola del 14/08: e' il
  --    posto dove mettere i lotti del semilavorato). Va tolto anche quello,
  --    coi suoi lotti e col suo storico prezzi, o la ricetta non si cancella.
  --    Trovato applicando: la chiave esterna lo ha detto.
  delete from price_history where ingredient_id in (select id from ingredients where preparazione_id = v_ric);
  delete from stock_lots    where ingredient_id in (select id from ingredients where preparazione_id = v_ric);
  delete from ingredients   where preparazione_id = v_ric;
  delete from recipes            where id = v_ric;
  delete from price_history      where ingredient_id = v_ing;
  delete from ingredients        where id = v_ing;

  alter table stock_consumptions    enable trigger trg_log_delete;
  alter table storico_costi_ricetta enable trigger trg_log_delete;

  select count(*) into v_n from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where t.tgname = 'trg_log_delete'
     and c.relname in ('stock_consumptions', 'storico_costi_ricetta')
     and t.tgenabled = 'D';
  if v_n > 0 then
    raise exception '% dei due registri delle cancellazioni e'' rimasto spento.', v_n;
  end if;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dello zero che non e'' un prezzo');
  raise notice 'Fatto: una produzione con un lotto senza prezzo costa 2,00 e dichiara «parziale»; con tutti prezzati dichiara «completo».';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260830000004', 'lo_zero_che_non_e_un_prezzo') on conflict (version) do nothing;
