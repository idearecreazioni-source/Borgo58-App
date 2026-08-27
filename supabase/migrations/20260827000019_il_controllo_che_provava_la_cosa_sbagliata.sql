-- ============================================================================
-- IL CONTROLLO CHE PROVAVA LA COSA SBAGLIATA — 27/08/2026
-- ============================================================================
--
-- La `20260827000018` ha un controllo intitolato «un lotto senza costo non
-- azzera il prezzo». Rompendo il riflesso apposta — `coalesce(v_prezzo, 0)`
-- al posto della guardia — **la verifica è rimasta VERDE**.
--
-- ----------------------------------------------------------------------------
-- PERCHÉ NON DISCRIMINAVA
-- ----------------------------------------------------------------------------
-- Quel controllo faceva entrare un lotto senza costo su un ingrediente che
-- **aveva già due lotti con un prezzo**. Ma `prezzo_ultima_versione` filtra
-- `unit_cost is not null`: quindi un prezzo c'era ancora, la guardia non
-- veniva mai raggiunta, e il controllo stava provando **il filtro dentro la
-- funzione**, non la guardia dentro il trigger.
--
-- 🔴 IL CASO VERO E' UN ALTRO, ed è quello che fa male: un ingrediente col
--    SOLO prezzo scritto a mano — cioè uno dei 133 di oggi, e ogni
--    ingrediente caricato prima dei suoi prodotti (decisione del 25/08) — su
--    cui **lo staff registra una consegna senza poterne scrivere il costo**.
--    Quella strada esiste ed è voluta: `register_stock_delivery` rifiuta il
--    costo a chi non è il titolare.
--
-- ⚠️ MISURATO col riflesso rotto, non dedotto: un prezzo a mano di 7,50
--    diventa **0,0000** e la colonna dichiara di venire **da un prodotto**.
--    Cioè l'ingrediente diventa **gratis in ogni ricetta che lo usa**, e il
--    gestionale afferma che quel numero l'ha misurato. Col riflesso buono
--    resta 7,50 e «a_mano».
--
-- ⚠️ E il danno è peggiore dello zero: uno zero si potrebbe notare, ma
--    `prezzo_da = 'prodotto'` **rassicura** — dice che qualcuno l'ha
--    misurato. E' la forma del 19/08: *una risposta più corta che ha l'aria
--    di essere intera.*
--
-- ----------------------------------------------------------------------------
-- LA LEZIONE, PERCHE' TORNERA'
-- ----------------------------------------------------------------------------
-- *Una rottura sola dice che UN guardiano funziona, non che funziona quello
-- che volevi provare* — regola del 18/08, e qui si è presentata in una forma
-- nuova: **il controllo non era raggiunto perché lo stato di partenza che
-- gli avevo apparecchiato lo rendeva impossibile.** E' la trappola del caso
-- vuoto (17/08) letta allo specchio: là il controllo girava su dati che non
-- avevano niente da fare, qui girava su dati che avevano **troppo** da fare.
--
-- ⚠️ E la `…018` NON SI RISCRIVE (regola del 23/08): il suo file racconta
--    cosa è stato fatto quel giorno, buco compreso. Il controllo che mancava
--    sta qui, con roba propria.
-- ============================================================================

do $verifica$
declare
  v_foto     jsonb;
  v_ente     uuid;
  v_ing      uuid;
  v_lotto    uuid;
  v_miei_ing uuid[] := '{}';
  v_miei_lot uuid[] := '{}';
  v_prezzo   numeric;
  v_da       text;
begin
  v_foto := foto_righe();

  select id into v_ente from entities order by created_at limit 1;
  if v_ente is null then
    raise exception 'Verifica impossibile: nessuna societa'' configurata';
  end if;

  -- ------------------------------------------------------------------
  -- Si COSTRUISCE lo stato di partenza che rende il controllo
  -- raggiungibile: un ingrediente col SOLO prezzo a mano, nessun lotto.
  -- ⚠️ Costruito, non preso in prestito: gira su un gestionale vuoto.
  -- ------------------------------------------------------------------
  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'Ingrediente a mano 20260827000019', 'altro', 'kg')
  returning id into v_ing;
  v_miei_ing := v_miei_ing || v_ing;

  perform update_ingredient_price(v_ing, 7.50, 'manuale', 'verifica: solo a mano');

  select current_price, prezzo_da into v_prezzo, v_da from ingredients where id = v_ing;
  if v_prezzo <> 7.50 or v_da is distinct from 'a_mano' then
    raise exception 'Lo stato di partenza non e'' quello voluto: % / %', v_prezzo, v_da;
  end if;

  -- ------------------------------------------------------------------
  -- IL CONTROLLO CHE MANCAVA: entra una consegna SENZA costo, come la
  -- registra lo staff. Il prezzo a mano deve restare, e deve continuare
  -- a dire di essere a mano.
  -- ------------------------------------------------------------------
  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost)
  values (v_ing, 5, 5, null)
  returning id into v_lotto;
  v_miei_lot := v_miei_lot || v_lotto;

  select current_price, prezzo_da into v_prezzo, v_da from ingredients where id = v_ing;
  if v_prezzo <> 7.50 then
    raise exception 'Una consegna senza costo ha cambiato il prezzo: % invece di 7,50 — l''ingrediente diventa gratis in ogni ricetta che lo usa', v_prezzo;
  end if;
  if v_da is distinct from 'a_mano' then
    raise exception 'Una consegna senza costo si spaccia per un prezzo misurato: la provenienza dice «%» invece di «a_mano»', v_da;
  end if;

  -- ------------------------------------------------------------------
  -- E allo specchio: appena arriva un costo, il riflesso comanda.
  -- Senza questo, un controllo che pretende «non cambiare mai» passerebbe
  -- anche su un riflesso completamente spento.
  -- ------------------------------------------------------------------
  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost)
  values (v_ing, 2, 2, 9.90)
  returning id into v_lotto;
  v_miei_lot := v_miei_lot || v_lotto;

  select current_price, prezzo_da into v_prezzo, v_da from ingredients where id = v_ing;
  if v_prezzo <> 9.90 or v_da is distinct from 'prodotto' then
    raise exception 'Il riflesso non comanda quando un costo arriva: % / %', v_prezzo, v_da;
  end if;

  -- ------------------------------------------------------------------
  -- Si riporta via tutto, per identificativo
  -- ------------------------------------------------------------------
  delete from stock_lots where id = any(v_miei_lot);
  delete from price_history where ingredient_id = any(v_miei_ing);
  delete from ingredients where id = any(v_miei_ing);
  delete from deleted_records where record_id = any((v_miei_ing || v_miei_lot)::text[]);

  perform pretendi_nessun_residuo(v_foto, 'il controllo che provava la cosa sbagliata');

  raise notice 'Il controllo che mancava c''e'': una consegna senza costo non azzera un prezzo scritto a mano, e non si spaccia per misurata.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000019', 'il_controllo_che_provava_la_cosa_sbagliata') on conflict (version) do nothing;
