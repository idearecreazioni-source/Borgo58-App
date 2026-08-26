-- ============================================================================
-- LA CAPARRA SI SCALA DAL CONTO — 26/08/2026
-- ============================================================================
--
-- La metà mancante: la caparra entra in cassa quando la ricevi
-- (`20260826000017`), e alla chiusura del conto **si propone e Alessio
-- conferma**. Mai scalata da sé in silenzio — decisione sua del 26/08.
--
-- ----------------------------------------------------------------------------
-- LA CAPARRA È UNA QUOTA DI PAGAMENTO, NON UNO SCONTO
-- ----------------------------------------------------------------------------
-- ⚠️ È la scelta che regge tutto il resto, e la ragione è aritmetica. Il conto
--    fa 300, la caparra 80, il cliente ne dà 220. Se la caparra fosse uno
--    sconto, i **ricavi** scenderebbero a 220 — e sarebbe falso: quel piatto
--    è stato venduto a 300. Come **quota di pagamento** i ricavi restano 300,
--    e cambia solo da dove sono arrivati i soldi.
--
-- Quindi `order_payments` accetta un terzo mezzo, `caparra`, e la quadratura
-- che regge la chiusura — «le quote devono fare il totale del conto» — non si
-- tocca: continua a tornare al centesimo.
--
-- 🔴 E I QUATTRO LETTORI DI `order_payments` SONO STATI GUARDATI UNO PER UNO,
--    non dedotti:
--   · `saldo_tesoreria` filtra `mezzo = 'contante'` → la caparra NON entra nel
--     cassetto teorico. **Ed è la cosa giusta**: quei contanti sono entrati
--     giorni fa e stanno già nel saldo di prima nota. Contarli qui li
--     conterebbe due volte, e ogni conteggio del cassetto mostrerebbe
--     un'eccedenza che nessuno sa spiegare.
--   · `pos_in_transito` filtra `mezzo = 'carta'` → esclusa. Giusto.
--   · `conti_senza_quadratura` somma TUTTE le quote → la caparra ci sta
--     dentro e il conto torna.
--   · `riflette_mezzo_pagamento` — è l'unico che va cambiato, e il perché è
--     sotto.
--
-- ----------------------------------------------------------------------------
-- IL RIFLESSO IGNORA LA CAPARRA, ED È UNA DECISIONE
-- ----------------------------------------------------------------------------
-- `orders.payment_method` è un riflesso (regola del 16/08): risponde a **come
-- ha pagato il cliente quella sera**. Un conto da 300 saldato con 80 di
-- caparra e 220 in contanti, senza questa correzione, si vedrebbe scritto
-- «misto» — che si legge «una parte in contanti e una con la carta», cioè una
-- cosa che non è successa. Il cliente ha pagato **in contanti**.
--
-- ⚠️ Prezzo dichiarato: un conto coperto INTERAMENTE dalla caparra resta
--    senza mezzo di pagamento (vuoto), perché quella sera il cliente non ha
--    pagato niente. È lo stesso stato di un conto da zero euro, ed è vero.
--
-- ⚠️ E il valore `caparra` NON entra nell'enum `order_payment_method`: se ci
--    entrasse, prima o poi qualcuno lo scriverebbe su un conto come se fosse
--    un modo di pagare in sala.
--
-- ----------------------------------------------------------------------------
-- DUE VOLTE NO: DOVE VIVE «GIÀ USATA»
-- ----------------------------------------------------------------------------
-- `cash_movements.caparra_usata_su_conto`, **sul movimento e non sulla
-- caparra**. La ragione è misurata e non teorica: la caparra sparisce a
-- cascata con la prenotazione quando la pulizia della privacy passa, il
-- movimento no. Uno stato scritto su una riga che può sparire è uno stato che
-- prima o poi non c'è più.
--
-- Da lì vengono tutt'e due i «no» chiesti:
--   · **lo stesso conto chiuso due volte** — `close_order_paid` rifiuta già la
--     seconda chiusura (`status <> 'aperto'`): non si costruisce niente, si
--     verifica che sia vero;
--   · **due conti diversi sulla stessa prenotazione** — il secondo trova la
--     caparra già segnata e non la propone. Questo È nuovo.
--
-- ----------------------------------------------------------------------------
-- LA CAPARRA PIÙ GRANDE DEL CONTO: SI RIFIUTA LO SCALO, NON LA CHIUSURA
-- ----------------------------------------------------------------------------
-- ⚠️ NON È UNA DECISIONE PRESA QUI, ed è scritto perché non lo sembri. Le
--    strade erano tre — rifiutare, usarne solo un pezzo, o restituire il
--    resto — e tutt'e tre decidono che fine fanno i soldi che avanzano. Non
--    tocca a chi scrive il codice.
--
-- Quello che questa migrazione fa è **non far sparire niente in silenzio**: lo
-- scalo viene rifiutato con i due numeri scritti, e il conto **si chiude lo
-- stesso senza scalare** — quindi non è un vicolo cieco in servizio. La
-- domanda va ad Alessio.
--
-- ----------------------------------------------------------------------------
-- PERCHÉ `close_order_paid` SI CANCELLA E SI RIFÀ
-- ----------------------------------------------------------------------------
-- ⚠️ In Postgres un parametro in più fa una funzione NUOVA, e due firme
--    sovrapposte rendono ambigua ogni chiamata per nome (42725, a tempo di
--    esecuzione, sul gesto più frequente della sala). Quindi `drop` e
--    `create`, e i permessi si rimettono **letti dal database** e non a
--    memoria: oggi `authenticated` può, `anon` e `public` no — misurato.
--
-- ----------------------------------------------------------------------------
-- COSA ABBIAMO ROVESCIATO
-- ----------------------------------------------------------------------------
-- · Cosa era stato deciso e quando: 16/08/2026, `orders.payment_method` è un
--   riflesso di `order_payments`, scritto da un trigger, e vale «un mezzo
--   solo → quello, più di uno → misto».
-- · La ragione di allora: due posti che dicono la stessa cosa e possono
--   contraddirsi sono un difetto; il riflesso lo scrive un trigger solo.
-- · Cosa si decide adesso: il riflesso **salta le quote di tipo `caparra`**.
-- · Perché la ragione di allora vale ancora, e questo è il prezzo: il riflesso
--   resta uno e scritto da un trigger solo — cambia cosa riflette, perché la
--   domanda a cui `payment_method` risponde («come ha pagato il cliente») non
--   comprende un denaro arrivato settimane prima.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Il terzo mezzo, e dove vive «già usata»
-- ----------------------------------------------------------------------------
alter table order_payments drop constraint if exists order_payments_mezzo_check;
alter table order_payments add constraint order_payments_mezzo_check
  check (mezzo in ('contante', 'carta', 'caparra'));
comment on constraint order_payments_mezzo_check on order_payments is
  'Come è stata saldata questa quota del conto: contante, carta, oppure una caparra ricevuta prima. La caparra è una quota di PAGAMENTO e non uno sconto — i ricavi del conto restano quelli, cambia solo da dove sono arrivati i soldi.';

alter table cash_movements
  add column if not exists caparra_usata_su_conto uuid references orders(id) on delete set null;
comment on column cash_movements.caparra_usata_su_conto is
  'Su quale conto questa caparra è stata scalata. Vive sul MOVIMENTO e non sulla caparra apposta: la caparra sparisce a cascata con la prenotazione quando passa la pulizia della privacy, il movimento no — e uno stato scritto su una riga che può sparire è uno stato che prima o poi non c''è più. `on delete set null`: cancellato il conto, la caparra torna disponibile.';

create index if not exists idx_cash_movements_caparra_usata
  on cash_movements (caparra_usata_su_conto) where caparra_usata_su_conto is not null;

-- ----------------------------------------------------------------------------
-- 2. Il riflesso salta la caparra
-- ----------------------------------------------------------------------------
-- ⚠️ Corpo ripreso DAL DATABASE (regola del 18/08) e cambiato in un punto
--    solo: il `where` che esclude le quote di tipo caparra.
create or replace function riflette_mezzo_pagamento()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_conto  uuid;
  v_mezzi  integer;
  v_unico  text;
begin
  v_conto := coalesce(new.order_id, old.order_id);

  select count(distinct mezzo), min(mezzo)
    into v_mezzi, v_unico
    from order_payments
   where order_id = v_conto
     and mezzo <> 'caparra';   -- «come ha pagato il cliente quella sera»

  update orders
     set payment_method = case
           when v_mezzi = 0 then null
           when v_mezzi = 1 then v_unico::order_payment_method
           else 'misto'::order_payment_method
         end
   where id = v_conto;

  return coalesce(new, old);
end;
$funzione$;

-- ----------------------------------------------------------------------------
-- 3. La proposta: cosa c'è da scalare su questo conto
-- ----------------------------------------------------------------------------
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
  if v_res is null then
    return;   -- nessuna prenotazione: non c'è niente da proporre, e il silenzio è la risposta giusta
  end if;

  select m.id, m.amount, m.caparra_evento_il, m.caparra_usata_su_conto
    into v_mov, v_imp, v_ev, v_usata
    from cash_movements m
   where m.reservation_id = v_res
   order by m.created_at
   limit 1;

  if v_mov is null then return; end if;

  v_inc := incasso_conto(p_order_id);

  if v_usata is not null and v_usata <> p_order_id then
    return query select v_imp, v_ev, v_inc, false,
      'gia_usata'::text,
      'Questa caparra di ' || euro(v_imp) || ' è già stata scalata su un altro conto.';
  elsif v_usata = p_order_id then
    return query select v_imp, v_ev, v_inc, false,
      'gia_scalata_qui'::text,
      'Su questo conto la caparra di ' || euro(v_imp) || ' è già stata scalata.';
  elsif v_imp > v_inc then
    return query select v_imp, v_ev, v_inc, false,
      'piu_grande_del_conto'::text,
      'La caparra è di ' || euro(v_imp) || ' e il conto fa ' || euro(v_inc) ||
      ': avanzerebbero ' || euro(v_imp - v_inc) ||
      '. Il gestionale non decide da sé che fine fanno — chiudi il conto senza scalarla e sistemala a mano.';
  else
    return query select v_imp, v_ev, v_inc, true,
      null::text,
      'Questo cliente ha già versato ' || euro(v_imp) || ' di caparra il ' ||
      to_char(v_ev, 'DD/MM/YYYY') || '. Il conto fa ' || euro(v_inc) ||
      ': da incassare adesso ' || euro(v_inc - v_imp) || '.';
  end if;
end;
$funzione$;

comment on function caparra_del_conto(uuid) is
  'La caparra da proporre alla chiusura di questo conto, con la frase da mostrare in sala. Non scala niente: PROPONE, e conferma Alessio (decisione sua del 26/08/2026). Non restituisce nessuna riga quando non c''è niente da proporre — il silenzio è la risposta giusta, non un riquadro vuoto.';

revoke all on function caparra_del_conto(uuid) from public, anon, authenticated;
grant execute on function caparra_del_conto(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. La chiusura, con lo scalo confermato
-- ----------------------------------------------------------------------------
-- ⚠️ SI TOLGONO TUTT'E DUE LE FIRME, e non è pignoleria: la prima stesura di
--    questa migrazione si è fermata DOPO aver creato quella nuova, e al
--    rilancio il `drop` della vecchia non trovava niente mentre il `create`
--    inciampava su quella che c'era già. *Una migrazione che fallisce dopo una
--    DDL lascia il lavoro a metà, e la volta dopo deve trovarlo.*
drop function if exists close_order_paid(uuid, text, numeric, jsonb);
drop function if exists close_order_paid(uuid, text, numeric, jsonb, boolean);

create function close_order_paid(
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
  v_order    orders%rowtype;
  v_prezzo   numeric(12,2);
  v_incasso  numeric(12,2);
  v_somma    numeric(12,2);
  v_caparra  numeric(12,2) := 0;
  v_mov      uuid;
  v_da_pagare numeric(12,2);
  v_p        record;
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

  -- L'incassato si legge DOPO aver fissato il prezzo del coperto: prima
  -- sarebbe il totale calcolato col listino di oggi invece che con quello
  -- fotografato sul conto.
  v_incasso := incasso_conto(p_order_id);

  -- ------------------------------------------------------------------
  -- LO SCALO DELLA CAPARRA, solo se qualcuno l'ha confermato.
  -- ⚠️ Il valore predefinito è `false`: chi chiama senza dire niente
  --    NON scala, e questo è il punto della decisione di Alessio.
  -- ------------------------------------------------------------------
  if p_scala_caparra then
    select * into v_p from caparra_del_conto(p_order_id);
    if v_p is null then
      raise exception 'Su questo conto non c''e'' nessuna caparra da scalare.';
    end if;
    if not v_p.si_puo_scalare then
      raise exception '%', v_p.frase;
    end if;

    select m.id into v_mov
      from cash_movements m
     where m.reservation_id = v_order.reservation_id
     order by m.created_at limit 1;

    v_caparra := v_p.importo;
    update cash_movements set caparra_usata_su_conto = p_order_id where id = v_mov;
    insert into order_payments (order_id, mezzo, importo)
    values (p_order_id, 'caparra', v_caparra);
  end if;

  -- Quello che il cliente paga ADESSO: il conto meno la caparra già versata.
  v_da_pagare := v_incasso - v_caparra;

  if p_pagamenti is null then
    -- Il caso di sempre: un mezzo solo, una quota sola. Non e' un caso
    -- speciale — e' il caso con una quota.
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

    -- ⚠️ IL CONTROLLO CHE REGGE TUTTO. Una divisione che non fa il totale
    -- crea un conto che dice 40 e ne registra 35: i ricavi restano giusti
    -- (si leggono dal conto), ma la cassa e la banca non torneranno mai
    -- piu', e la differenza non avrebbe nessun posto dove comparire.
    -- ⚠️ Dal 26/08 la somma comprende ANCHE la quota di caparra, ed è
    -- giusto: quella parte del conto è stata saldata davvero, solo prima.
    -- Un centesimo di tolleranza perche' dividere per tre non da' un
    -- numero tondo; oltre, si rifiuta.
    if abs(v_somma - v_incasso) > 0.01 then
      raise exception
        'Le quote fanno %, il conto ne fa %: la divisione deve tornare al centesimo.',
        euro(v_somma), euro(v_incasso);
    end if;
  end if;

  perform scarica_magazzino_conto(p_order_id);
end;
$funzione$;

comment on function close_order_paid(uuid, text, numeric, jsonb, boolean) is
  'Chiude un conto pagato. Dal 26/08/2026 accetta `p_scala_caparra`: la caparra si scala SOLO se qualcuno l''ha confermato, mai da sé (decisione di Alessio). La caparra entra come QUOTA di pagamento, non come sconto: i ricavi del conto restano quelli.';

revoke all on function close_order_paid(uuid, text, numeric, jsonb, boolean) from public, anon, authenticated;
grant execute on function close_order_paid(uuid, text, numeric, jsonb, boolean) to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- 🔴 I QUATTRO CASI CHIESTI DAL MANDATO, e si guardano fallire:
--    (a) conto senza caparra → non compare nulla;
--    (b) caparra più grande del conto → lo scalo è rifiutato, e il conto si
--        chiude lo stesso senza scalare;
--    (c) lo stesso conto chiuso due volte → la seconda non scala niente;
--    (d) due conti sulla stessa prenotazione → la caparra non si scala due
--        volte.
do $verifica$
declare
  v_foto   jsonb;
  v_ent    uuid;
  v_tit    uuid;
  v_res    uuid;
  v_c1     uuid;
  v_c2     uuid;
  v_c3     uuid;
  v_mov    uuid;
  v_r      jsonb;
  v_p      record;
  v_movs   text[] := '{}';
  v_conti  text[] := '{}';
  v_lap0   integer;
  v_n      integer;

begin
  v_foto := foto_righe();
  select id into v_ent from entities where entity_type = 'srls' limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);
  select count(*) into v_lap0 from deleted_records;

  -- ---- (a) UN CONTO SENZA CAPARRA: non compare nulla ---------------------
  insert into orders (entity_id, table_label, coperti) values (v_ent, '__VERIFICA__ senza', 2)
    returning id into v_c1;
  v_conti := v_conti || v_c1::text;
  select count(*) into v_n from caparra_del_conto(v_c1);
  if v_n <> 0 then
    raise exception 'Un conto senza prenotazione propone una caparra: % righe.', v_n;
  end if;
  raise notice '(a) conto senza caparra: la proposta non restituisce nessuna riga';

  -- ---- il perimetro: prenotazione e caparra proprie ----------------------
  insert into reservations (customer_name, reservation_date, reservation_time, party_size, status, source)
  values ('VERIFICA scalo 26/08', oggi_a_roma(), '20:30', 4, 'confermata', 'interno')
  returning id into v_res;

  v_r := registra_caparra(v_res, 200);
  v_mov := (v_r ->> 'movimento_id')::uuid;
  v_movs := v_movs || v_mov::text;

  -- ---- (b) CAPARRA PIÙ GRANDE DEL CONTO ----------------------------------
  -- Un conto con soli coperti: 2 × prezzo del coperto, sicuramente < 200.
  insert into orders (entity_id, table_label, coperti, reservation_id, coperto_unit_price)
  values (v_ent, '__VERIFICA__ piccolo', 2, v_res, 5) returning id into v_c2;
  v_conti := v_conti || v_c2::text;

  select * into v_p from caparra_del_conto(v_c2);
  if v_p.si_puo_scalare then
    raise exception 'Una caparra di 200 su un conto da % risulta scalabile.', euro(v_p.incasso);
  end if;
  if v_p.perche_no <> 'piu_grande_del_conto' then
    raise exception 'La ragione del rifiuto e'' «%» invece di «piu_grande_del_conto».', v_p.perche_no;
  end if;

  begin
    perform close_order_paid(v_c2, 'contante', null, null, true);
    raise exception 'Lo scalo di una caparra piu'' grande del conto e'' passato.';
  exception when others then
    if sqlerrm not like '%avanzerebbero%' then raise; end if;
  end;

  -- ⚠️ E IL CONTO SI CHIUDE LO STESSO SENZA SCALARE: il rifiuto non è un
  --    vicolo cieco in servizio. È la metà che rende accettabile l'altra.
  perform close_order_paid(v_c2, 'contante');
  if (select status from orders where id = v_c2) <> 'chiuso' then
    raise exception 'Rifiutato lo scalo, il conto non si e'' potuto chiudere: e'' un vicolo cieco.';
  end if;
  if exists (select 1 from order_payments where order_id = v_c2 and mezzo = 'caparra') then
    raise exception 'Chiuso senza scalare, e la quota di caparra c''e'' lo stesso.';
  end if;
  raise notice '(b) caparra 200,00 su un conto da %: scalo rifiutato, conto chiuso lo stesso',
    euro((select coalesce(sum(importo),0) from order_payments where order_id = v_c2));

  -- ---- (c) e (d): un conto abbastanza grande -----------------------------
  insert into orders (entity_id, table_label, coperti, reservation_id, coperto_unit_price)
  values (v_ent, '__VERIFICA__ grande', 4, v_res, 5) returning id into v_c3;
  v_conti := v_conti || v_c3::text;
  -- ⚠️ Una VOCE LIBERA e non una ricetta, apposta: una ricetta farebbe
  --    scaricare il magazzino alla chiusura, e questa verifica si porterebbe
  --    via giacenze vere per provare una cosa che col magazzino non c'entra.
  insert into order_items (order_id, free_text_name, destination, quantity, unit_price, sent_at)
  values (v_c3, 'VERIFICA voce', 'cucina', 1, 500, now());

  select * into v_p from caparra_del_conto(v_c3);
  if not v_p.si_puo_scalare then
    raise exception 'La caparra non risulta scalabile su un conto da %: «%»', euro(v_p.incasso), v_p.frase;
  end if;
  raise notice '(proposta) %', v_p.frase;

  perform close_order_paid(v_c3, 'contante', null, null, true);

  -- la quota di caparra c'è, e le quote fanno il totale
  if (select importo from order_payments where order_id = v_c3 and mezzo = 'caparra') <> 200 then
    raise exception 'La quota di caparra non e'' di 200.';
  end if;
  if abs((select sum(importo) from order_payments where order_id = v_c3) - incasso_conto(v_c3)) > 0.01 then
    raise exception 'Con la caparra dentro, le quote non fanno piu'' il totale del conto.';
  end if;
  -- il riflesso dice «contante», non «misto»: il cliente ha pagato in contanti
  if (select payment_method from orders where id = v_c3) <> 'contante' then
    raise exception 'Il conto risulta pagato «%» invece che in contanti.',
      (select payment_method from orders where id = v_c3);
  end if;
  raise notice '(c/d) conto da %: quota caparra 200,00 + contante %, mezzo di pagamento «contante»',
    euro(incasso_conto(v_c3)),
    euro((select importo from order_payments where order_id = v_c3 and mezzo = 'contante'));

  -- ---- (c) lo stesso conto chiuso due volte ------------------------------
  begin
    perform close_order_paid(v_c3, 'contante', null, null, true);
    raise exception 'Lo stesso conto e'' stato chiuso due volte.';
  exception when others then
    if sqlerrm not like '%gia%chiuso%' then raise; end if;
  end;
  if (select count(*) from order_payments where order_id = v_c3 and mezzo = 'caparra') <> 1 then
    raise exception 'La seconda chiusura ha aggiunto una seconda quota di caparra.';
  end if;
  raise notice '(c) stesso conto chiuso due volte: la seconda e'' respinta, la quota resta una';

  -- ---- (d) un secondo conto sulla stessa prenotazione ---------------------
  insert into orders (entity_id, table_label, coperti, reservation_id, coperto_unit_price)
  values (v_ent, '__VERIFICA__ secondo', 2, v_res, 5) returning id into v_c1;
  v_conti := v_conti || v_c1::text;
  select * into v_p from caparra_del_conto(v_c1);
  if v_p.si_puo_scalare then
    raise exception 'La stessa caparra risulta scalabile su un secondo conto.';
  end if;
  if v_p.perche_no <> 'gia_usata' then
    raise exception 'La ragione e'' «%» invece di «gia_usata».', v_p.perche_no;
  end if;
  begin
    perform close_order_paid(v_c1, 'contante', null, null, true);
    raise exception 'La stessa caparra e'' stata scalata su due conti diversi.';
  exception when others then
    if sqlerrm not like '%stata scalata su un altro conto%' then raise; end if;
  end;
  raise notice '(d) secondo conto sulla stessa prenotazione: «%»', v_p.frase;

  -- ---- pulizia ------------------------------------------------------------
  -- ⚠️ SI SPEGNE UN GUARDIANO PER PULIRE, E LO SI RIACCENDE CONTROLLANDO.
  --    `trg_riga_servita` impedisce di togliere una riga da un conto già
  --    chiuso — è la regola del 16/08 che protegge il totale su cui si è
  --    incassato, e ha ragione a scattare anche qui. Lasciarlo spento
  --    vorrebbe dire togliere quella protezione in sala, in silenzio: per
  --    questo sotto c'è il controllo che sia tornato acceso.
  alter table order_items disable trigger trg_riga_servita;

  delete from anomalie_scarico where order_id::text = any(v_conti);
  delete from stock_consumptions where order_id::text = any(v_conti);
  delete from order_items where order_id::text = any(v_conti);
  delete from order_payments where order_id::text = any(v_conti);
  delete from orders where id::text = any(v_conti);
  -- ⚠️ L'ORDINE NON È LIBERO: `reservation_deposits.movimento_id` è
  --    `restrict`, quindi la caparra va tolta PRIMA del suo movimento. È il
  --    vincolo scritto ieri che fa il suo lavoro — nemmeno l'effetto sparisce
  --    lasciando il documento a dichiarare qualcosa che non è avvenuto.
  delete from reservation_deposits where reservation_id = v_res;
  delete from cash_movements where id::text = any(v_movs);
  delete from reservations where id = v_res;
  -- ⚠️ `orders`, `order_items`, `order_payments` e `cash_movements` sono
  --    tutte tabelle tracciate dal 26/08: le lapidi di questa verifica se le
  --    porta via lei, per identificativo.
  delete from deleted_records where record_id = any(v_conti) or record_id = any(v_movs);
  delete from deleted_records where (record ->> 'order_id') = any(v_conti);

  alter table order_items enable trigger trg_riga_servita;
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
     where c.relname = 'order_items' and t.tgname = 'trg_riga_servita' and t.tgenabled = 'O'
  ) then
    raise exception 'Il guardiano `trg_riga_servita` e'' rimasto SPENTO: in sala si potrebbe togliere una riga da un conto gia'' chiuso.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dello scalo della caparra');
  raise notice 'verifica: nessun residuo, lapidi tornate a %', v_lap0;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260826000018', 'la_caparra_si_scala_dal_conto')
on conflict (version) do nothing;
