-- ============================================================================
-- LA CAPARRA CHE AVANZA TORNA AL CLIENTE — 27/08/2026
-- ============================================================================
--
-- Decisione di Alessio del 27/08: **la caparra più grande del conto si
-- restituisce in contanti**, ed è un'uscita di cassa con una causale sua. La
-- stessa regola vale per **la caparra su un conto omaggiato**. Una regola
-- sola per due casi rari.
--
-- ⚠️ ROVESCIA IL RIFIUTO DI IERI, ed era un rifiuto dichiarato provvisorio: la
--    `20260826000018` scriveva «il gestionale non decide da sé che fine fanno
--    — chiudi il conto senza scalarla e sistemala a mano». Adesso lo decide
--    lui, e il gestionale lo fa.
--
-- ----------------------------------------------------------------------------
-- 🔴 IL PUNTO CHE DECIDE SE IL PEZZO È FATTO BENE
-- ----------------------------------------------------------------------------
-- **Quei soldi devono restare rintracciabili in ogni strada.** Un conto
-- omaggiato incassa zero, ma il cliente ha versato davvero: se la caparra non
-- finisce da nessuna parte, la cassa del giorno ha un avanzo che nessuno sa
-- spiegare — ed è la stessa forma dell'ammanco delle mance su carta.
--
-- Quindi in tutte e tre le strade il denaro va da qualche parte, e ognuna si
-- legge nel saldo:
--
--   · **scalata**    — quota `caparra` sul conto. Il saldo di cassa NON si
--                      muove: quei contanti erano già entrati quando la
--                      caparra è stata presa;
--   · **restituita** — quota per la parte che ci sta + **uscita di cassa**
--                      per il resto. Il saldo scende di quello che torna in
--                      mano al cliente;
--   · **omaggiata**  — nessuna quota (un omaggio incassa zero) e **uscita di
--                      cassa per l'intera caparra**. Il saldo scende di
--                      tutto.
--
-- ----------------------------------------------------------------------------
-- UNA REGOLA SOLA, IN UNA FUNZIONE SOLA
-- ----------------------------------------------------------------------------
-- `sistema_caparra_del_conto(conto, incassato)` fa tutto e la chiamano in due.
-- Scritta due volte, fra sei mesi il conto omaggiato e il conto pagato
-- restituirebbero cifre diverse per la stessa ragione.
--
-- ⚠️ E L'USCITA PORTA ADDOSSO DA DOVE VIENE: `reservation_id` e
--    `caparra_evento_il`, esattamente come l'entrata. Così anche dopo che la
--    pulizia della privacy ha portato via la prenotazione, la riga in prima
--    nota continua a dire di che evento era — senza nessun nome.
--
-- ⚠️ SUL CONTO OMAGGIATO NON SI SCRIVE NESSUNA QUOTA, e non è una
--    dimenticanza: le chiusure per sconto e omaggio non scrivono quote di
--    pagamento — non l'hanno mai fatto — e aggiungerne una sola per la
--    caparra farebbe comparire quel conto fra quelli che non quadrano. La
--    verifica lo controlla invece di sperarlo.
--
-- ----------------------------------------------------------------------------
-- COSA ABBIAMO ROVESCIATO
-- ----------------------------------------------------------------------------
-- · Cosa era stato deciso e quando: ieri, 26/08/2026 — una caparra più grande
--   del conto fa RIFIUTARE lo scalo, e il conto si chiude senza scalarla.
-- · La ragione di allora: le tre strade possibili decidevano tutte che fine
--   fanno i soldi che avanzano, e quella non era una decisione da prendere
--   scrivendo codice. Il rifiuto era dichiarato provvisorio nel corpo della
--   migrazione stessa.
-- · Cosa si decide adesso: si restituiscono in contanti, con una causale sua.
-- · Perché la ragione di allora non vale più: **l'ha decisa Alessio**. Non è
--   cambiato il ragionamento, è arrivata la risposta che mancava.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. La causale, distinguibile da un'uscita qualunque
-- ----------------------------------------------------------------------------
insert into cash_causali (label, kind, active, di_sistema)
select 'Caparra restituita', 'uscita', true, true
 where not exists (select 1 from cash_causali where label = 'Caparra restituita');

-- ----------------------------------------------------------------------------
-- 2. La regola, in un posto solo
-- ----------------------------------------------------------------------------
create or replace function sistema_caparra_del_conto(
  p_order_id  uuid,
  p_incassato numeric
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_order    orders%rowtype;
  v_mov      cash_movements%rowtype;
  v_quota    numeric(12,2);
  v_resto    numeric(12,2);
  v_caus     uuid;
  v_uscita   uuid;
begin
  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Conto non trovato';
  end if;
  if v_order.reservation_id is null then
    raise exception 'Su questo conto non c''e'' nessuna caparra da sistemare: non nasce da una prenotazione.';
  end if;

  select * into v_mov from cash_movements
   where reservation_id = v_order.reservation_id
     and causale_id = (select id from cash_causali where label = 'Caparra ricevuta')
   order by created_at limit 1;

  if v_mov.id is null then
    raise exception 'Su questa prenotazione non c''e'' nessuna caparra da sistemare.';
  end if;
  if v_mov.caparra_usata_su_conto is not null and v_mov.caparra_usata_su_conto <> p_order_id then
    raise exception 'Questa caparra di % e'' gia'' stata scalata su un altro conto.', euro(v_mov.amount);
  end if;
  if v_mov.caparra_usata_su_conto = p_order_id then
    raise exception 'Su questo conto la caparra di % e'' gia'' stata sistemata.', euro(v_mov.amount);
  end if;

  v_quota := least(v_mov.amount, greatest(coalesce(p_incassato, 0), 0));
  v_resto := v_mov.amount - v_quota;

  -- La parte che copre il conto: una quota di pagamento, non uno sconto.
  if v_quota > 0 then
    insert into order_payments (order_id, mezzo, importo)
    values (p_order_id, 'caparra', v_quota);
  end if;

  -- ⚠️ QUELLO CHE AVANZA ESCE DAVVERO DAL CASSETTO, e la riga lo dice.
  --    Senza, la cassa del giorno avrebbe un avanzo senza spiegazione — e
  --    l'avanzo di cassa è precisamente ciò che nessuno sa più ricostruire
  --    tre giorni dopo.
  if v_resto > 0 then
    select id into v_caus from cash_causali where label = 'Caparra restituita';
    insert into cash_movements (
      entity_id, direction, amount, movement_date, causale_id, mezzo,
      note, reservation_id, caparra_evento_il
    ) values (
      v_order.entity_id, 'uscita', v_resto, serata_di_servizio(), v_caus, 'cassa',
      'Caparra restituita al cliente, conto ' || coalesce(v_order.table_label, '(senza tavolo)'),
      v_order.reservation_id, v_mov.caparra_evento_il
    ) returning id into v_uscita;
  end if;

  update cash_movements set caparra_usata_su_conto = p_order_id where id = v_mov.id;

  return jsonb_build_object(
    'caparra', v_mov.amount,
    'quota', v_quota,
    'restituito', v_resto,
    'uscita_id', v_uscita,
    'messaggio', case
      when v_resto = 0 then
        'Caparra di ' || euro(v_quota) || ' scalata dal conto.'
      when v_quota = 0 then
        'Caparra di ' || euro(v_mov.amount) || ' restituita per intero al cliente, in contanti.'
      else
        'Caparra di ' || euro(v_mov.amount) || ': ' || euro(v_quota) ||
        ' scalati dal conto e ' || euro(v_resto) || ' restituiti in contanti.'
    end);
end;
$funzione$;

comment on function sistema_caparra_del_conto(uuid, numeric) is
  'Che fine fa la caparra alla chiusura di un conto: la parte che ci sta diventa una quota di pagamento, quello che avanza ESCE dalla cassa con la causale «Caparra restituita». Decisione di Alessio del 27/08/2026. Sta in un posto solo perché la chiamano in due — la chiusura pagata e quella per omaggio — e scritta due volte darebbe due cifre diverse per la stessa ragione.';

revoke all on function sistema_caparra_del_conto(uuid, numeric) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. La proposta non rifiuta più: dice cosa succederà
-- ----------------------------------------------------------------------------
-- rete-guardie: caparra_del_conto — la ragione di rifiuto `piu_grande_del_conto` sparisce APPOSTA: da oggi quel caso non e' piu' un rifiuto. Ieri il gestionale si fermava perche' nessuno aveva deciso che fine facessero i soldi che avanzano; il 27/08 l'ha deciso Alessio (si restituiscono in contanti), quindi la proposta dice cosa succedera' invece di dire di no.
create or replace function caparra_del_conto(p_order_id uuid)
returns table(
  importo        numeric,
  evento_il      date,
  incasso        numeric,
  si_puo_scalare boolean,
  perche_no      text,
  frase          text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $funzione$
declare
  v_res   uuid;
  v_mov   uuid;
  v_imp   numeric;
  v_ev    date;
  v_usata uuid;
  v_inc   numeric;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select o.reservation_id into v_res from orders o where o.id = p_order_id;
  if v_res is null then return; end if;

  select m.id, m.amount, m.caparra_evento_il, m.caparra_usata_su_conto
    into v_mov, v_imp, v_ev, v_usata
    from cash_movements m
   where m.reservation_id = v_res
     and m.causale_id = (select id from cash_causali where label = 'Caparra ricevuta')
   order by m.created_at
   limit 1;

  if v_mov is null then return; end if;

  v_inc := incasso_conto(p_order_id);

  if v_usata is not null and v_usata <> p_order_id then
    return query select v_imp, v_ev, v_inc, false, 'gia_usata'::text,
      'Questa caparra di ' || euro(v_imp) || ' è già stata scalata su un altro conto.';
  elsif v_usata = p_order_id then
    return query select v_imp, v_ev, v_inc, false, 'gia_scalata_qui'::text,
      'Su questo conto la caparra di ' || euro(v_imp) || ' è già stata sistemata.';
  elsif v_imp > v_inc then
    -- ⚠️ NON È PIÙ UN RIFIUTO: si dice cosa succederà, perché la decisione
    --    che mancava ieri l'ha presa Alessio il 27/08.
    return query select v_imp, v_ev, v_inc, true, null::text,
      'Questo cliente ha versato ' || euro(v_imp) || ' di caparra e il conto fa ' ||
      euro(v_inc) || ': ' || euro(v_inc) || ' vanno sul conto e ' || euro(v_imp - v_inc) ||
      ' tornano a lui in contanti, dalla cassa.';
  else
    return query select v_imp, v_ev, v_inc, true, null::text,
      'Questo cliente ha già versato ' || euro(v_imp) || ' di caparra il ' ||
      to_char(v_ev, 'DD/MM/YYYY') || '. Il conto fa ' || euro(v_inc) ||
      ': da incassare adesso ' || euro(v_inc - v_imp) || '.';
  end if;
end;
$funzione$;

revoke all on function caparra_del_conto(uuid) from public, anon, authenticated;
grant execute on function caparra_del_conto(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. La chiusura pagata usa la regola unica
-- ----------------------------------------------------------------------------
-- rete-guardie: close_order_paid — i rifiuti sulla caparra («non c'e' nessuna caparra da scalare», «e' gia' stata scalata») escono di qui APPOSTA: si spostano dentro `sistema_caparra_del_conto`, che e' l'unico posto dove la caparra si sistema e che chiamano in due — la chiusura pagata e quella per omaggio. Lasciarli anche qui vorrebbe dire due posti che rifiutano la stessa cosa con due frasi che fra sei mesi divergono.
create or replace function close_order_paid(
  p_order_id           uuid,
  p_payment_method     text default null,
  p_coperto_unit_price numeric default null,
  p_pagamenti          jsonb default null,
  p_scala_caparra      boolean default false
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_order     orders%rowtype;
  v_prezzo    numeric(12,2);
  v_incasso   numeric(12,2);
  v_somma     numeric(12,2);
  v_quota     numeric(12,2) := 0;
  v_da_pagare numeric(12,2);
  v_esito     jsonb;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Conto non trovato';
  end if;
  if v_order.status <> 'aperto' then
    raise exception 'Questo conto e'' gia'' stato chiuso (stato: %). Ricaricare la schermata.', v_order.status;
  end if;

  v_prezzo := coalesce(
    p_coperto_unit_price,
    v_order.coperto_unit_price,
    (select coperto_price from service_settings where id = 1),
    0
  );

  update orders set
    status             = 'chiuso',
    coperto_unit_price = v_prezzo,
    closed_at          = now()
  where id = p_order_id;

  v_incasso := incasso_conto(p_order_id);

  if p_scala_caparra then
    v_esito := sistema_caparra_del_conto(p_order_id, v_incasso);
    v_quota := (v_esito ->> 'quota')::numeric;
  end if;

  v_da_pagare := v_incasso - v_quota;

  if p_pagamenti is null then
    if p_payment_method is null or p_payment_method not in ('contante', 'carta') then
      raise exception 'Metodo di pagamento non valido: %', coalesce(p_payment_method, '(vuoto)');
    end if;
    if v_da_pagare > 0 then
      insert into order_payments (order_id, mezzo, importo)
      values (p_order_id, p_payment_method, v_da_pagare);
    end if;
  else
    if jsonb_typeof(p_pagamenti) <> 'array' or jsonb_array_length(p_pagamenti) = 0 then
      raise exception 'La divisione del pagamento non contiene nessuna quota.';
    end if;

    insert into order_payments (order_id, mezzo, importo)
    select p_order_id, q->>'mezzo', (q->>'importo')::numeric
      from jsonb_array_elements(p_pagamenti) as q
     where (q->>'importo')::numeric > 0;

    select coalesce(sum(importo), 0) into v_somma
      from order_payments where order_id = p_order_id;

    -- ⚠️ IL CONTROLLO CHE REGGE TUTTO: le quote devono fare il totale del
    -- conto al centesimo, la quota di caparra compresa.
    if abs(v_somma - v_incasso) > 0.01 then
      raise exception
        'Le quote fanno %, il conto ne fa %: la divisione deve tornare al centesimo.',
        euro(v_somma), euro(v_incasso);
    end if;
  end if;

  perform scarica_magazzino_conto(p_order_id);
end;
$funzione$;

revoke all on function close_order_paid(uuid, text, numeric, jsonb, boolean) from public, anon, authenticated;
grant execute on function close_order_paid(uuid, text, numeric, jsonb, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. E l'omaggio: la caparra torna INTERA
-- ----------------------------------------------------------------------------
-- ⚠️ Un parametro in più fa una funzione nuova: si toglie la vecchia firma e
--    la nuova, per la ragione scritta ieri — una migrazione che si ferma dopo
--    una DDL lascia il lavoro a metà, e la volta dopo deve trovarlo.
drop function if exists close_order_as_discount_gift(uuid, boolean, numeric, numeric, uuid, text, uuid, uuid, text);
drop function if exists close_order_as_discount_gift(uuid, boolean, numeric, numeric, uuid, text, uuid, uuid, text, boolean);

create function close_order_as_discount_gift(
  p_order_id uuid,
  p_is_gift boolean,
  p_collected_amount numeric default 0,
  p_expected_full_amount numeric default null,
  p_causale_id uuid default null,
  p_causale_note text default null,
  p_customer_id uuid default null,
  p_device_id uuid default null,
  p_note text default null,
  p_scala_caparra boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $funzione$
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

  -- 🔴 LA CAPARRA SU UN CONTO OMAGGIATO TORNA INTERA AL CLIENTE (27/08/2026,
  --    decisione di Alessio, stessa regola del conto più piccolo della
  --    caparra). Un omaggio incassa zero, ma quei soldi il cliente li ha
  --    versati davvero: senza questa riga la cassa del giorno avrebbe un
  --    avanzo che nessuno sa spiegare.
  -- ⚠️ Si passa ZERO come incassato, quindi non nasce nessuna quota di
  --    pagamento — le chiusure per sconto e omaggio non ne hanno mai scritte,
  --    e aggiungerne una farebbe comparire il conto fra quelli che non
  --    quadrano.
  if p_scala_caparra then
    perform sistema_caparra_del_conto(p_order_id, 0);
  end if;

  -- 🔴 LA MERCE ESCE PRIMA, E POI SI CONTA QUANTO E' COSTATA (25/08/2026).
  perform scarica_magazzino_conto(p_order_id);

  select * into v_costo from costo_ingredienti_conto(p_order_id);

  -- ⚠️ La data giusta è la SERATA, non il giorno di calendario: uno sconto o
  -- un omaggio è la traccia economica di un CONTO.
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
$funzione$;

revoke all on function close_order_as_discount_gift(uuid, boolean, numeric, numeric, uuid, text, uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function close_order_as_discount_gift(uuid, boolean, numeric, numeric, uuid, text, uuid, uuid, text, boolean) to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- 🔴 IL SALDO DI CASSA PRIMA E DOPO, IN TUTTE E TRE LE STRADE. È la cosa che
--    il mandato chiede di mostrare, ed è quella che dice se i soldi restano
--    rintracciabili: scalata (il saldo non si muove), restituita (scende del
--    resto), omaggiata (scende di tutto).
do $verifica$
declare
  v_foto   jsonb;
  v_ent    uuid;
  v_tit    uuid;
  v_res    uuid;
  v_c      uuid;
  v_r      jsonb;
  v_e      jsonb;
  v_movs   text[] := '{}';
  v_conti  text[] := '{}';
  v_s0     numeric;
  v_s1     numeric;
  v_q0     integer;
  v_q1     integer;
  v_caus   uuid;
  v_dg     text[] := '{}';
begin
  v_foto := foto_righe();
  select id into v_ent from entities where entity_type = 'srls' limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  select count(*) into v_q0 from conti_senza_quadratura(v_ent);

  -- il saldo di cassa di partenza, letto una volta
  select coalesce(balance, 0) into v_s0 from v_cash_balance where entity_id = v_ent;

  -- =================== (1) SCALATA: il saldo NON si muove ==================
  insert into reservations (customer_name, reservation_date, reservation_time, party_size, status, source)
  values ('VERIFICA caparra scalata', oggi_a_roma(), '20:30', 4, 'confermata', 'interno')
  returning id into v_res;
  v_r := registra_caparra(v_res, 50);
  v_movs := v_movs || (v_r ->> 'movimento_id');

  insert into orders (entity_id, table_label, coperti, reservation_id, coperto_unit_price)
  values (v_ent, '__VERIFICA__ scalata', 4, v_res, 25) returning id into v_c;
  v_conti := v_conti || v_c::text;

  select coalesce(balance, 0) into v_s1 from v_cash_balance where entity_id = v_ent;
  perform close_order_paid(v_c, 'contante', null, null, true);
  raise notice '(1) SCALATA — conto %, caparra 50,00: saldo cassa % -> % (non si muove, i contanti erano gia'' entrati)',
    euro(incasso_conto(v_c)), euro(v_s1),
    euro((select coalesce(balance, 0) from v_cash_balance where entity_id = v_ent));
  if (select coalesce(balance, 0) from v_cash_balance where entity_id = v_ent) <> v_s1 then
    raise exception 'Scalando una caparra il saldo di cassa si e'' mosso, e non doveva.';
  end if;
  if (select importo from order_payments where order_id = v_c and mezzo = 'caparra') <> 50 then
    raise exception 'La quota di caparra non c''e'' o non e'' di 50.';
  end if;

  -- =================== (2) RESTITUITA: il saldo scende del resto ===========
  insert into reservations (customer_name, reservation_date, reservation_time, party_size, status, source)
  values ('VERIFICA caparra restituita', oggi_a_roma(), '20:30', 2, 'confermata', 'interno')
  returning id into v_res;
  v_r := registra_caparra(v_res, 200);
  v_movs := v_movs || (v_r ->> 'movimento_id');

  insert into orders (entity_id, table_label, coperti, reservation_id, coperto_unit_price)
  values (v_ent, '__VERIFICA__ restituita', 2, v_res, 5) returning id into v_c;
  v_conti := v_conti || v_c::text;

  select coalesce(balance, 0) into v_s1 from v_cash_balance where entity_id = v_ent;
  perform close_order_paid(v_c, 'contante', null, null, true);

  if (select importo from order_payments where order_id = v_c and mezzo = 'caparra') <> 10 then
    raise exception 'Sul conto da 10,00 la quota di caparra non e'' di 10.';
  end if;
  if (select coalesce(balance, 0) from v_cash_balance where entity_id = v_ent) <> v_s1 - 190 then
    raise exception 'Restituiti 190,00 e il saldo di cassa non e'' sceso di 190 (% -> %).',
      euro(v_s1), euro((select coalesce(balance, 0) from v_cash_balance where entity_id = v_ent));
  end if;
  -- l'uscita porta addosso da dove viene
  select id into v_caus from cash_causali where label = 'Caparra restituita';
  if not exists (
    select 1 from cash_movements
     where causale_id = v_caus and reservation_id = v_res
       and direction = 'uscita' and amount = 190 and caparra_evento_il is not null
  ) then
    raise exception 'L''uscita della caparra restituita non esiste, o non dice da dove viene.';
  end if;
  v_movs := v_movs || (select id::text from cash_movements where causale_id = v_caus and reservation_id = v_res);
  raise notice '(2) RESTITUITA — conto 10,00, caparra 200,00: 10,00 sul conto, 190,00 fuori. Saldo cassa % -> %',
    euro(v_s1), euro((select coalesce(balance, 0) from v_cash_balance where entity_id = v_ent));

  -- =================== (3) OMAGGIATA: il saldo scende di tutto =============
  insert into reservations (customer_name, reservation_date, reservation_time, party_size, status, source)
  values ('VERIFICA caparra omaggiata', oggi_a_roma(), '20:30', 2, 'confermata', 'interno')
  returning id into v_res;
  v_r := registra_caparra(v_res, 60);
  v_movs := v_movs || (v_r ->> 'movimento_id');

  insert into orders (entity_id, table_label, coperti, reservation_id, coperto_unit_price)
  values (v_ent, '__VERIFICA__ omaggiata', 2, v_res, 5) returning id into v_c;
  v_conti := v_conti || v_c::text;

  select coalesce(balance, 0) into v_s1 from v_cash_balance where entity_id = v_ent;
  perform close_order_as_discount_gift(
    v_c, true, 0, null,
    (select id from cash_causali where kind = 'sconto_omaggio' and active limit 1),
    'VERIFICA', null, null, null, true);

  if (select status from orders where id = v_c) <> 'omaggiato' then
    raise exception 'Il conto non risulta omaggiato.';
  end if;
  if exists (select 1 from order_payments where order_id = v_c) then
    raise exception 'Su un conto omaggiato e'' comparsa una quota di pagamento: comparirebbe fra quelli che non quadrano.';
  end if;
  if (select coalesce(balance, 0) from v_cash_balance where entity_id = v_ent) <> v_s1 - 60 then
    raise exception 'Omaggiato il conto, la caparra di 60,00 non e'' uscita dalla cassa (% -> %).',
      euro(v_s1), euro((select coalesce(balance, 0) from v_cash_balance where entity_id = v_ent));
  end if;
  v_movs := v_movs || (select id::text from cash_movements where causale_id = v_caus and reservation_id = v_res);
  raise notice '(3) OMAGGIATA — caparra 60,00 restituita per intero. Saldo cassa % -> %',
    euro(v_s1), euro((select coalesce(balance, 0) from v_cash_balance where entity_id = v_ent));

  -- =================== nessun conto ha smesso di quadrare ==================
  select count(*) into v_q1 from conti_senza_quadratura(v_ent);
  if v_q1 <> v_q0 then
    raise exception 'I conti che non quadrano sono passati da % a %.', v_q0, v_q1;
  end if;
  raise notice 'conti che non quadrano: % prima, % dopo', v_q0, v_q1;

  -- =================== pulizia ============================================
  alter table order_items disable trigger trg_riga_servita;
  delete from anomalie_scarico where order_id::text = any(v_conti);
  delete from stock_consumptions where order_id::text = any(v_conti);
  delete from order_items where order_id::text = any(v_conti);
  delete from order_payments where order_id::text = any(v_conti);
  -- ⚠️  E' UNA TABELLA TRACCIATA: la sua lapide se la porta
  --    via questa verifica, per identificativo. A prenderlo e' stato il
  --    guardiano dei residui, non una rilettura.
  select array_agg(discount_gift_id::text) into v_dg
    from orders where id::text = any(v_conti) and discount_gift_id is not null;
  delete from discounts_gifts where id::text = any(coalesce(v_dg, '{}'));
  update orders set discount_gift_id = null where id::text = any(v_conti);
  delete from orders where id::text = any(v_conti);
  delete from reservation_deposits where reservation_id in
    (select reservation_id from cash_movements where id::text = any(v_movs) and reservation_id is not null);
  delete from cash_movements where id::text = any(v_movs);
  delete from reservations where customer_name like 'VERIFICA caparra %';
  delete from deleted_records where record_id = any(v_conti) or record_id = any(v_movs)
     or record_id = any(coalesce(v_dg, '{}'));
  delete from deleted_records where (record ->> 'order_id') = any(v_conti);
  alter table order_items enable trigger trg_riga_servita;
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
     where c.relname = 'order_items' and t.tgname = 'trg_riga_servita' and t.tgenabled = 'O'
  ) then
    raise exception 'Il guardiano `trg_riga_servita` e'' rimasto SPENTO.';
  end if;

  if (select coalesce(balance, 0) from v_cash_balance where entity_id = v_ent) <> v_s0 then
    raise exception 'Il saldo di cassa non e'' tornato a quello di partenza (% invece di %).',
      euro((select coalesce(balance, 0) from v_cash_balance where entity_id = v_ent)), euro(v_s0);
  end if;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della caparra che avanza');
  raise notice 'verifica: nessun residuo, saldo di cassa tornato a %', euro(v_s0);
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000001', 'la_caparra_che_avanza_torna_al_cliente')
on conflict (version) do nothing;
