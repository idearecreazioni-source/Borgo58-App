-- ---------------------------------------------------------------------
-- Un omaggio ha un perché — la causale diventa obbligatoria
-- ---------------------------------------------------------------------
-- Deciso da Alessio il 14/08/2026, dopo aver chiesto quali causali fossero
-- previste per sconti e omaggi. Le quattro c'erano dal 02/08 (Cortesia,
-- Cliente ricorrente, Recupero disservizio, Altro) e lui le tiene così —
-- le cambia da «Cassa → Causali» quando gli serve. Quello che mancava era
-- che **si potesse chiudere un tavolo in omaggio senza dire perché**.
--
-- PERCHÉ NON È UNA FORMALITÀ. Il budget degli omaggi della Proiezione
-- economico-fiscale (Blocco 3) si legge da qui: «cortesia» è un
-- investimento che Alessio decide, «recupero disservizio» è un costo che
-- dice che qualcosa non ha funzionato in cucina. Senza causale restano lo
-- stesso numero, e fra un anno c'è un totale che nessuno sa spiegare.
--
-- ⚠️ TROVATO PRIMA DI ROMPERLO, ed è il motivo per cui questa migrazione
-- non è di due righe: **«alla romana» non passava nessuna causale.**
-- L'arrotondamento per difetto si chiude come sconto (decisione del
-- 09/08), e il client mandava solo la nota «Alla romana: 2 × 12,00». Reso
-- obbligatorio il campo, quel gesto — che è il più frequente dei tre — si
-- sarebbe rotto al primo tentativo, in sala, davanti a un cliente che
-- aspetta. La schermata ora chiede la causale anche lì.
--
-- ⚠️ E NON BASTA IL CONTROLLO NELLA FUNZIONE: `discounts_gifts` si scrive
-- anche direttamente dal browser (registro manuale in Cassa → Sconti e
-- omaggi, categoria A del Contratto: una tabella sola). La garanzia è il
-- `not null` sulla colonna; la frase leggibile la mette la funzione, per
-- chi sta chiudendo un tavolo e non deve leggere un codice Postgres.
--
-- Idempotente (§7 punto 3).

-- =====================================================================
-- 1. Sanatoria: le righe senza causale, se ce ne sono
-- =====================================================================
-- In produzione sono zero (letto dal connettore prima di scrivere). Sul
-- progetto di prova possono essercene di lasciate dai collaudi. Vanno
-- collocate prima del vincolo, e in «Altro» — che è la casella onesta:
-- **non si indovina** una causale su un omaggio fatto da qualcun altro
-- mesi fa. È la stessa regola delle categorie dell'Agenda del 14/08.
do $sanatoria$
declare
  v_altro uuid;
  n       integer;
begin
  select count(*) into n from discounts_gifts where causale_id is null;
  if n = 0 then
    raise notice 'Nessuno sconto o omaggio senza causale: niente da sistemare.';
    return;
  end if;

  select id into v_altro from cash_causali
   where kind = 'sconto_omaggio' and active and label = 'Altro' limit 1;

  if v_altro is null then
    insert into cash_causali (label, kind, active) values ('Altro', 'sconto_omaggio', true)
    returning id into v_altro;
  end if;

  update discounts_gifts set causale_id = v_altro where causale_id is null;
  raise notice 'Collocati in «Altro» % sconti/omaggi che non avevano causale.', n;
end $sanatoria$;

-- =====================================================================
-- 2. Il vincolo — la garanzia sta qui, non nella schermata
-- =====================================================================
alter table discounts_gifts alter column causale_id set not null;

comment on column discounts_gifts.causale_id is
  'Perché è stato fatto. Obbligatoria dal 14/08/2026: senza, il budget degli omaggi sarebbe un totale che nessuno sa spiegare. Le causali le gestisce Alessio da Cassa → Causali.';

-- =====================================================================
-- 3. La frase per chi è in sala
-- =====================================================================
-- Il `not null` respinge con un 23502, che il corridoio non traduce (non è
-- fra i rifiuti previsti) e che chi sta chiudendo un tavolo non deve
-- leggere. Il controllo esplicito arriva prima e dice una cosa
-- comprensibile; il vincolo resta la garanzia vera.
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
as $function$
declare
  v_utente         uuid := auth.uid();
  v_order          orders%rowtype;
  v_prezzo_coperto numeric(12,2);
  v_totale_righe   numeric(12,2);
  v_totale         numeric(12,2);
  v_incassato      numeric(12,2);
  v_dg_id          uuid;
  v_costo          record;
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
  -- esiste, poi se i dati sono completi. Messo davanti a tutto, un conto
  -- inesistente rispondeva «scegli perché» — una diagnosi che manda a
  -- cercare nel posto sbagliato. Se n'è accorta una prova automatica
  -- scritta mesi fa per un altro motivo.
  if p_causale_id is null then
    raise exception 'Scegli perché: uno sconto o un omaggio senza causale, fra un anno, è un numero che nessuno sa spiegare.';
  end if;
  if not exists (select 1 from cash_causali
                  where id = p_causale_id and kind = 'sconto_omaggio' and active) then
    raise exception 'Quella causale non è più fra quelle degli sconti e omaggi: ricarica la schermata.';
  end if;

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

  if p_expected_full_amount is not null
     and abs(p_expected_full_amount - v_totale) > 0.01 then
    raise exception 'Il totale e'' cambiato mentre chiudevi il conto (a schermo %, ora %). Ricarica e riprova.',
      p_expected_full_amount, v_totale;
  end if;

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

  -- Quanto e' costato, adesso e non domani.
  select * into v_costo from costo_ingredienti_conto(p_order_id);

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

  -- La merce e' uscita dalla cella anche se il conto non ha incassato.
  perform scarica_magazzino_conto(p_order_id);

  return v_dg_id;
end;
$function$;

comment on function close_order_as_discount_gift is
  'Chiude un conto come sconto o omaggio in un''unica transazione: registro sconti/omaggi + stato del conto + scarico del magazzino. La causale è obbligatoria (14/08/2026): il vincolo è sulla colonna, qui c''è la frase per chi è in sala.';

revoke all on function close_order_as_discount_gift(uuid, boolean, numeric, numeric, uuid, text, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function close_order_as_discount_gift(uuid, boolean, numeric, numeric, uuid, text, uuid, uuid, text)
  to authenticated;

-- =====================================================================
-- 4. Verifica (§7 punti 1-3)
-- =====================================================================
do $verifica$
declare
  v_titolare uuid;
  v_staff    uuid;
  v_ente     uuid;
  v_causale  uuid;
  v_conto    uuid;
  v_msg      text;
  respinto   boolean;
  n          integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  select id into v_ente from entities where entity_type = 'srls';
  if v_titolare is null or v_staff is null or v_ente is null then
    raise exception 'Servono entità, titolare e staff per questa verifica.';
  end if;

  -- Struttura: la colonna non ammette più il vuoto.
  if (select is_nullable from information_schema.columns
       where table_name = 'discounts_gifts' and column_name = 'causale_id') <> 'NO' then
    raise exception 'La causale è ancora facoltativa: il vincolo non c''è.';
  end if;
  select count(*) into n from discounts_gifts where causale_id is null;
  if n > 0 then
    raise exception 'Restano % sconti/omaggi senza causale.', n;
  end if;

  -- Le quattro causali di sconto/omaggio ci sono ancora: sono i dati di
  -- Alessio, e questa migrazione non deve toccarli.
  select count(*) into n from cash_causali where kind = 'sconto_omaggio' and active;
  if n < 1 then
    raise exception 'Non c''è nessuna causale di sconto/omaggio: la schermata non avrebbe niente da proporre.';
  end if;
  select id into v_causale from cash_causali
   where kind = 'sconto_omaggio' and active order by label limit 1;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);

  -- ⚠️ IL RIFIUTO, VISTO RESPINGERE DAVVERO (§7 punto 2). Un conto vero,
  -- chiuso senza causale: deve fermarsi con una frase leggibile, e il
  -- conto deve restare APERTO — un rifiuto che chiude comunque il tavolo
  -- sarebbe peggio del difetto.
  insert into orders (entity_id, table_label, status, coperti)
  values (v_ente, '__PROVA CAUSALE__', 'aperto', 2)
  returning id into v_conto;

  respinto := false;
  begin
    perform close_order_as_discount_gift(v_conto, true, 0, null, null, null, null, null, null);
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%perché%' then
      raise exception 'Rifiuto avvenuto ma con un messaggio inatteso: %', v_msg;
    end if;
    respinto := true;
  end;
  if not respinto then
    raise exception 'Un omaggio senza causale è stato accettato.';
  end if;
  if (select status from orders where id = v_conto) <> 'aperto' then
    raise exception 'Il rifiuto ha comunque chiuso il conto.';
  end if;

  -- Una causale inventata (o spenta) non passa.
  respinto := false;
  begin
    perform close_order_as_discount_gift(v_conto, true, 0, null, gen_random_uuid(), null, null, null, null);
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then
    raise exception 'Una causale inesistente è stata accettata.';
  end if;

  -- E con la causale giusta passa, e scrive tutto.
  perform close_order_as_discount_gift(v_conto, true, 0, null, v_causale, 'prova causale', null, null, null);
  select count(*) into n from discounts_gifts
   where causale_id = v_causale and causale_note = 'prova causale';
  if n <> 1 then
    raise exception 'Con la causale giusta la chiusura non ha registrato lo sconto/omaggio.';
  end if;
  if (select status from orders where id = v_conto) <> 'omaggiato' then
    raise exception 'Il conto non risulta omaggiato.';
  end if;

  -- ⚠️ E il varco diretto dal browser? `discounts_gifts` si scrive anche
  -- senza passare dalla funzione: il vincolo deve reggere anche lì.
  respinto := false;
  begin
    insert into discounts_gifts (entity_id, type, full_amount, collected_amount, created_by)
    values (v_ente, 'omaggio', 10, 0, v_staff);
  exception when not_null_violation then respinto := true;
  end;
  if not respinto then
    raise exception 'Scrivendo direttamente in tabella si può ancora omettere la causale.';
  end if;

  -- Pulizia
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  delete from discounts_gifts where causale_note = 'prova causale';
  delete from stock_consumptions where order_id = v_conto;
  delete from anomalie_scarico where order_id = v_conto;
  delete from order_items where order_id = v_conto;
  delete from orders where id = v_conto;

  select count(*) into n from orders where table_label = '__PROVA CAUSALE__';
  if n <> 0 then
    raise exception 'La prova ha lasciato % conti nel database.', n;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'La causale è obbligatoria: rifiutata se manca, rifiutata se inventata, e il conto resta aperto quando il rifiuto scatta.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260814000012', 'un_omaggio_ha_un_perche')
on conflict (version) do nothing;

select
  (select count(*) from cash_causali where kind = 'sconto_omaggio' and active) as causali_disponibili,
  (select string_agg(label, ', ' order by label) from cash_causali
    where kind = 'sconto_omaggio' and active)                                  as elenco,
  (select count(*) from discounts_gifts)                                       as sconti_e_omaggi,
  (select count(*) from discounts_gifts where causale_id is null)              as senza_causale;
