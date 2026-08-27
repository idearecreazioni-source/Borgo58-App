-- ============================================================================
-- IL REGALO VALE ZERO PER QUELLA VOLTA, NON PER SEMPRE — 27/08/2026
-- ============================================================================
--
-- 🔴 IL RIFLESSO DELLA `20260827000018` CONTRADDICEVA UNA DECISIONE IN
--    VIGORE, e a trovarlo è stata una prova scritta il 17/08 — non una
--    rilettura.
--
-- La decisione (mandato del 17/08/2026, «la lista non scrive uscite»):
--
--   «Un regalo non deve far scendere a zero il prezzo dell'ingrediente: il
--    LOTTO costa zero — ed è vero — ma `price_history` e `current_price` non
--    si toccano, altrimenti il food cost di ogni ricetta che lo usa risulta
--    più basso del vero, ed è da lì che Alessio decide i prezzi del menu.
--    *Il regalo vale zero per quella volta, non per sempre.*»
--
-- `prezzo_ultima_versione` scartava i lotti **senza** costo e prendeva quelli
-- **a costo zero**. Quindi una cassa di verdure regalata dal contadino, o una
-- raccolta propria, portava `current_price` a **0,00** — e da lì il food cost
-- di ogni piatto che usa quell'ingrediente.
--
-- ⚠️ E IL DANNO NON SI VEDEVA COME UN GUASTO: un food cost più basso si
--    legge «quel piatto rende più di quanto pensavo», ed è il numero su cui
--    si decide un prezzo di menu. La stessa forma dello scarto a zero.
--
-- ⚠️ VALE ANCHE PER L'ERBA SPONTANEA: `foraged_items` produce lotti a costo
--    zero legittimi. Il criterio non è «è un regalo», è **un costo di zero
--    non è una misura del valore di quell'ingrediente**.
--
-- ----------------------------------------------------------------------------
-- COME È STATO TROVATO, perché è la parte che vale
-- ----------------------------------------------------------------------------
-- `tests/app/tre-esiti-lista.test.js` pretende che dopo «avuto gratis» il
-- prezzo resti 4,00 e lo storico resti vuoto. Ha risposto **0**. Nessuna
-- rilettura del riflesso l'aveva visto, e la verifica della `…018` era verde
-- perché costruiva i propri lotti **sempre con un costo maggiore di zero**.
-- *Un esempio costruito prova solo i casi che gli hai messo dentro.*
-- ============================================================================

create or replace function prezzo_ultima_versione(p_ingredient_id uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  -- L'ULTIMA versione entrata, non la media e non la minima: e'' la
  -- decisione del 25/08/2026 sul food cost. `progressivo` rompe il pareggio
  -- di istante invece di lasciarlo all'`id`, che e'' casuale.
  --
  -- ⚠️ `unit_cost > 0` e non `is not null`: un lotto a costo ZERO e'' un
  --    regalo o una raccolta propria, e non e'' una misura del valore di
  --    quell'ingrediente (decisione del 17/08/2026). Il regalo vale zero per
  --    quella volta, non per sempre.
  select l.unit_cost
    from stock_lots l
   where l.ingredient_id = p_ingredient_id
     and l.unit_cost is not null
     and l.unit_cost > 0
   order by l.received_at desc, l.progressivo desc
   limit 1;
$$;

comment on function prezzo_ultima_versione(uuid) is
  'Il prezzo dell''ULTIMA versione entrata in magazzino per questo '
  'ingrediente, fra quelle che sono state PAGATE. Vuoto se nessun lotto porta '
  'un costo maggiore di zero — e vuoto NON e'' zero: uno zero si leggerebbe '
  '«questo ingrediente e'' gratis». I lotti a costo zero (regali, raccolta '
  'propria) sono esclusi apposta: decisione del 17/08/2026.';

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- ⚠️ Costruisce tutto quello che le serve: gira su un gestionale vuoto.
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

  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'Verdura di verifica 20260827000021', 'verdura', 'kg')
  returning id into v_ing;
  v_miei_ing := v_miei_ing || v_ing;

  -- Una partita comprata: il prezzo lo detta lei
  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining,
                          unit_cost, received_at)
  values (v_ing, 10, 10, 4.00, now() - interval '2 days')
  returning id into v_lotto;
  v_miei_lot := v_miei_lot || v_lotto;

  select current_price, prezzo_da into v_prezzo, v_da from ingredients where id = v_ing;
  if v_prezzo <> 4.00 or v_da is distinct from 'prodotto' then
    raise exception 'Lo stato di partenza non e'' quello voluto: % / %', v_prezzo, v_da;
  end if;

  -- ------------------------------------------------------------------
  -- IL CONTROLLO: una cassa REGALATA entra dopo, a costo zero.
  -- Il prezzo dell'ingrediente NON deve muoversi.
  -- ------------------------------------------------------------------
  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining,
                          unit_cost, received_at, note)
  values (v_ing, 6, 6, 0, now(), 'regalo del contadino')
  returning id into v_lotto;
  v_miei_lot := v_miei_lot || v_lotto;

  select current_price into v_prezzo from ingredients where id = v_ing;
  if v_prezzo <> 4.00 then
    raise exception 'Un regalo ha fatto scendere il prezzo a %: il food cost di ogni piatto che usa questo ingrediente risulterebbe piu'' basso del vero', v_prezzo;
  end if;

  -- ------------------------------------------------------------------
  -- E allo specchio: un ingrediente che ha SOLO lotti regalati non ha
  -- un prezzo misurato. Vuoto, non zero.
  -- ------------------------------------------------------------------
  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'Erba spontanea di verifica 20260827000021', 'verdura', 'kg')
  returning id into v_ing;
  v_miei_ing := v_miei_ing || v_ing;

  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost)
  values (v_ing, 2, 2, 0)
  returning id into v_lotto;
  v_miei_lot := v_miei_lot || v_lotto;

  if prezzo_ultima_versione(v_ing) is not null then
    raise exception 'Un ingrediente con soli lotti a costo zero dichiara un prezzo misurato di %', prezzo_ultima_versione(v_ing);
  end if;
  select prezzo_da into v_da from ingredients where id = v_ing;
  if v_da is not null then
    raise exception 'Un ingrediente con soli lotti regalati dichiara una provenienza del prezzo: %', v_da;
  end if;

  -- ------------------------------------------------------------------
  -- Si riporta via tutto, per identificativo
  -- ------------------------------------------------------------------
  delete from stock_lots where id = any(v_miei_lot);
  delete from price_history where ingredient_id = any(v_miei_ing);
  delete from ingredients where id = any(v_miei_ing);
  delete from deleted_records where record_id = any((v_miei_ing || v_miei_lot)::text[]);

  perform pretendi_nessun_residuo(v_foto, 'il regalo vale zero per quella volta');

  raise notice 'Il regalo vale zero per quella volta e non per sempre: una partita regalata non muove il prezzo, e un ingrediente con soli lotti a costo zero non ne dichiara nessuno.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000021', 'il_regalo_vale_zero_per_quella_volta') on conflict (version) do nothing;
