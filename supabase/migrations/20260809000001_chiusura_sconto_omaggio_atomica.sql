-- ---------------------------------------------------------------------
-- Chiusura conto con sconto/omaggio: una sola operazione indivisibile
-- ---------------------------------------------------------------------
-- Prima erano due scritture separate guidate dal browser: prima la riga
-- nel registro sconti/omaggi, poi la chiusura del conto. Se la seconda
-- non partiva — connessione persa, tablet bloccato, pagina ricaricata —
-- restava un omaggio registrato in cassa per un tavolo ancora aperto.
-- Nessun errore evidente, e il registro degli omaggi e' quello su cui si
-- valuta l'obbligo di autofattura TD27.
--
-- Ora e' una funzione sola: o vengono scritte entrambe le cose, o non
-- viene scritto niente. Non e' una precauzione applicativa, e' il
-- comportamento del motore del database (docs/ARCHITETTURA.md §1).
--
-- Tre miglioramenti che arrivano insieme all'atomicita':
--
--  1. IL CONTO GIA' CHIUSO NON SI RICHIUDE. Prima nessuno lo impediva:
--     due tablet che chiudevano lo stesso tavolo producevano due righe nel
--     registro per lo stesso incasso.
--
--  2. L'IMPORTO LO CALCOLA IL DATABASE, non il browser. Il numero che
--     finisce in un registro fiscale non deve dipendere da cosa aveva in
--     memoria una schermata. Il totale mostrato viene comunque passato e
--     confrontato: se i due numeri non coincidono l'operazione si ferma
--     invece di scrivere il numero sbagliato.
--
--  3. L'ENTITA' FISCALE si legge dal conto, non si riceve dal client:
--     un parametro sbagliato attribuirebbe l'omaggio all'azienda agricola
--     invece che alla S.r.l.s.
--
-- Idempotente (§7 punto 3).

create or replace function close_order_as_discount_gift(
  p_order_id             uuid,
  p_is_gift              boolean,
  p_collected_amount     numeric default 0,
  p_expected_full_amount numeric default null,
  p_causale_id           uuid default null,
  p_causale_note         text default null,
  p_customer_id          uuid default null,
  p_device_id            uuid default null,
  p_note                 text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente        uuid := auth.uid();
  v_order         orders%rowtype;
  v_prezzo_coperto numeric(12,2);
  v_totale_righe  numeric(12,2);
  v_totale        numeric(12,2);
  v_incassato     numeric(12,2);
  v_dg_id         uuid;
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

  -- 5. LE DUE SCRITTURE — nella stessa transazione, per costruzione
  insert into discounts_gifts (
    entity_id, type, full_amount, collected_amount,
    causale_id, causale_note, customer_id, device_id, note, created_by
  ) values (
    v_order.entity_id,
    case when p_is_gift then 'omaggio' else 'sconto' end::discount_gift_type,
    v_totale,
    v_incassato,
    p_causale_id, p_causale_note, p_customer_id, p_device_id, p_note, v_utente
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
$$;

comment on function close_order_as_discount_gift is
  'Chiude un conto come sconto o omaggio in un''unica transazione: registro sconti/omaggi + stato del conto, o entrambi o nessuno. Calcola l''importo dal conto invece di riceverlo dal client, rifiuta un conto gia'' chiuso e blocca la riga per evitare due chiusure contemporanee da due tablet.';

revoke all on function close_order_as_discount_gift(uuid, boolean, numeric, numeric, uuid, text, uuid, uuid, text) from public;
grant execute on function close_order_as_discount_gift(uuid, boolean, numeric, numeric, uuid, text, uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica: si esegue davvero una chiusura, e si prova a romperla
-- ---------------------------------------------------------------------
-- La funzione viene eseguita impersonando un utente applicativo vero
-- (auth.uid() dentro una migrazione e' altrimenti nullo, e created_by non
-- ammette valori nulli). Tutto cio' che viene creato per la prova viene
-- rimosso subito dopo, registro delle cancellazioni compreso.
do $verifica$
declare
  v_utente   uuid;
  v_order    uuid;
  v_dg       uuid;
  v_stato    order_status;
  v_importo  numeric;
  v_respinto boolean := false;
begin
  select user_id into v_utente from user_roles order by created_at limit 1;
  if v_utente is null then
    raise exception 'Nessun utente in user_roles: impossibile verificare la funzione in modo realistico.';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_utente, 'role', 'authenticated')::text,
    true
  );

  -- Conto finto: 2 coperti + una riga da 10,00 -> totale atteso 10 + 2*prezzo
  insert into orders (table_label, coperti) values ('__prova_chiusura__', 2)
  returning id into v_order;

  insert into order_items (order_id, free_text_name, destination, quantity, unit_price, sent_at)
  values (v_order, 'Riga di prova', 'bar', 1, 10.00, now());

  v_dg := close_order_as_discount_gift(v_order, true, 0, null, null, null, null, null, 'prova atomicita');

  select status into v_stato from orders where id = v_order;
  select full_amount into v_importo from discounts_gifts where id = v_dg;

  if v_stato <> 'omaggiato' then
    raise exception 'Il conto non risulta omaggiato dopo la chiusura (stato: %).', v_stato;
  end if;

  if v_importo is null or v_importo <= 0 then
    raise exception 'L''importo registrato nel registro omaggi non e'' valido: %', v_importo;
  end if;

  if not exists (select 1 from orders where id = v_order and discount_gift_id = v_dg) then
    raise exception 'Il conto non e'' collegato alla riga del registro: le due scritture non sono legate.';
  end if;

  -- Seconda chiusura sullo stesso conto: deve essere respinta.
  begin
    perform close_order_as_discount_gift(v_order, true, 0, null, null, null, null, null, 'seconda prova');
  exception
    when others then v_respinto := true;
  end;

  if not v_respinto then
    raise exception 'Un conto gia'' chiuso e'' stato richiuso: il controllo non funziona.';
  end if;

  -- Pulizia completa, registro delle cancellazioni compreso.
  delete from order_items where order_id = v_order;
  update orders set discount_gift_id = null where id = v_order;
  delete from discounts_gifts where id = v_dg;
  delete from orders where id = v_order;
  delete from deleted_records where record_id in (v_dg::text, v_order::text);

  raise notice 'Verificato: chiusura registrata su entrambe le tabelle, importo calcolato dal database (%), seconda chiusura respinta, prova rimossa.', v_importo;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260809000001', 'chiusura_sconto_omaggio_atomica')
on conflict (version) do nothing;

-- Riepilogo: la funzione esiste, e non sono rimaste tracce della prova.
select
  (select count(*) from pg_proc where proname = 'close_order_as_discount_gift')            as funzione_creata,
  (select count(*) from orders where table_label = '__prova_chiusura__')                   as conti_di_prova_rimasti,
  (select count(*) from discounts_gifts where note = 'prova atomicita')                    as righe_di_prova_rimaste;
