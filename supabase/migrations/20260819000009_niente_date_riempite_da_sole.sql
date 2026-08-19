-- =====================================================================
-- NIENTE DATE RIEMPITE DA SOLE — gli otto predefiniti si tolgono
-- 19/08/2026
-- =====================================================================
-- 🔴 DECISIONE DI ALESSIO, che ha scartato l'alternativa: «togliamole per
-- ora». La domanda era se allineare alla serata il predefinito di
-- `cash_movements.movement_date`, ora che la schermata propone la serata.
-- La sua risposta vale come criterio, e va oltre questa colonna:
--
--   allineare il predefinito lo renderebbe MENO SBAGLIATO, ma resterebbe
--   una seconda regola che decide una giornata al posto suo, in silenzio.
--
-- E' la famiglia dei 33 posti silenziosi del 17/08: un predefinito e' una
-- risposta data da chi ha scritto la migrazione al posto di chi usa il
-- gestionale, e non lascia nessuna traccia. Sarebbe stata anche la TERZA
-- copia della stessa regola — la funzione del database, la schermata, e
-- il predefinito.
--
-- Tolto il predefinito, e le colonne restano `not null`: chi scrive senza
-- la data ottiene un ERRORE invece di una data inventata. **E' il punto.**
--
-- ⚠️ MISURATO PRIMA DI TOGLIERE, una colonna per volta — funzioni SQL,
-- schermate, prove, comandi di servizio ed Edge Function. Sette colonne su
-- otto: chi le scrive passa sempre una data esplicita, quindi il
-- predefinito era gia' morto e va via.
--
-- 🔴 L'OTTAVA NO, e l'ha detta la misura: `close_order_as_discount_gift` —
-- la chiusura di un conto come sconto o omaggio, cioe' il gesto piu'
-- frequente della sala fra quelli che toccano questa tabella — inseriva in
-- `discounts_gifts` SENZA nominare `movement_date`. Togliere il predefinito
-- e basta avrebbe rotto quella chiusura in sala, in servizio. Quindi
-- prima si passa la data li' dentro, poi si toglie: l'ordine e' la
-- richiesta di Alessio, ed e' l'unico che non lascia un buco in mezzo.
--
-- ⚠️ Il Contratto NON cambia, ed e' stato constatato prima di scrivere:
-- non nomina i predefiniti di colonna in nessun punto, e la §4 (contratto
-- RLS/Postgres) elenca RLS, portieri, viste `_display`, verifica delle
-- migrazioni e registro delle cancellazioni. `discounts_gifts` compare
-- solo nella regola B4 (atomicita'), che questa migrazione rispetta:
-- la scrittura resta dentro l'unica funzione Postgres di sempre.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Prima la data esplicita dove qualcosa si appoggiava al predefinito
-- ---------------------------------------------------------------------
-- Corpo ripreso dal DATABASE VIVO (`npm run funzione:viva`, regola del
-- 18/08): cambia solo la riga dell'insert.
CREATE OR REPLACE FUNCTION public.close_order_as_discount_gift(p_order_id uuid, p_is_gift boolean, p_collected_amount numeric DEFAULT 0, p_expected_full_amount numeric DEFAULT NULL::numeric, p_causale_id uuid DEFAULT NULL::uuid, p_causale_note text DEFAULT NULL::text, p_customer_id uuid DEFAULT NULL::uuid, p_device_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Quanto e' costato, adesso e non domani.
  select * into v_costo from costo_ingredienti_conto(p_order_id);

  -- 🔴 LA DATA SI PASSA, e prima non si passava: questa riga si appoggiava
  -- al predefinito della colonna, che dal 19/08 non c''e'' piu''.
  --
  -- ⚠️ E LA DATA GIUSTA E' LA SERATA, non il giorno di calendario: uno
  -- sconto o un omaggio e' la traccia economica di un CONTO, e il giorno di
  -- un conto e' la sua serata dappertutto — conti_da_fiscalizzare,
  -- quadratura_fiscale, misure_del_mese e ricavi_non_fiscalizzati leggono
  -- tutte serata_di_servizio(closed_at). Datandolo a calendario, un omaggio
  -- dell''una di notte finirebbe su un giorno diverso dal conto che l''ha
  -- generato — e l''ultima notte del mese, su un MESE diverso: il budget
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

  -- La merce e' uscita dalla cella anche se il conto non ha incassato.
  perform scarica_magazzino_conto(p_order_id);

  return v_dg_id;
end;
$function$;


-- ---------------------------------------------------------------------
-- 2 · Poi si tolgono gli otto predefiniti
-- ---------------------------------------------------------------------
-- ⚠️ `drop default` e' idempotente per costruzione: rieseguirlo su una
-- colonna che il predefinito non ce l'ha piu' non fa niente e non protesta.
alter table anticipazioni_socio alter column pagata_il      drop default;
alter table cash_movements      alter column movement_date  drop default;
alter table conteggi_cassa      alter column contato_il     drop default;
alter table daily_menus         alter column service_date   drop default;
alter table deductible_expenses alter column expense_date   drop default;
alter table discounts_gifts     alter column movement_date  drop default;
alter table foraged_items       alter column harvest_date   drop default;
alter table tips_collected      alter column collected_date drop default;


-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit     uuid;
  v_ente    uuid;
  v_causale uuid;
  v_tavolo  uuid;
  v_conto   uuid;
  v_dg      uuid;
  v_data    date;
  v_lap_p   integer;
  v_lap_d   integer;
  v_n       integer;
  v_col     text;
  v_stato   text;
  v_nomi    text;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  select id into v_ente from entities order by created_at limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  select count(*) into v_lap_p from deleted_records;

  -- =========== 1 · IL CATALOGO: nessuna delle otto ha piu' un predefinito,
  --                  e tutte e otto sono ancora obbligatorie ===========
  -- ⚠️ La seconda meta' non e' un di piu': se una colonna diventasse
  -- nullabile, togliere il predefinito smetterebbe di dare errore e
  -- scriverebbe un NULL in silenzio — cioe' il contrario di quello che
  -- questa migrazione vuole ottenere.
  select count(*), string_agg(table_name || '.' || column_name, ', ')
    into v_n, v_nomi
    from information_schema.columns
   where table_schema = 'public'
     and (table_name, column_name) in (
       ('anticipazioni_socio','pagata_il'), ('cash_movements','movement_date'),
       ('conteggi_cassa','contato_il'), ('daily_menus','service_date'),
       ('deductible_expenses','expense_date'), ('discounts_gifts','movement_date'),
       ('foraged_items','harvest_date'), ('tips_collected','collected_date'))
     and (column_default is not null or is_nullable = 'YES');
  if v_n <> 0 then
    raise exception 'Restano % colonne con un predefinito o diventate facoltative: %.', v_n, v_nomi;
  end if;

  -- =========== 2 · IL COMPORTAMENTO: senza data, ERRORE ===========
  -- ⚠️ Non basta guardare il catalogo: si prova a scrivere davvero, e si
  -- pretende l'errore GIUSTO — `not_null_violation` sulla colonna
  -- attesa, non un errore qualunque. Un vincolo diverso che scattasse
  -- prima farebbe passare la prova senza aver provato niente.
  -- ⚠️ E queste scritture non lasciano niente dietro di se' per
  -- costruzione: sono tutte destinate a fallire.
  v_col := null;
  begin
    insert into anticipazioni_socio (entity_id, importo, tag_id)
      values (v_ente, 1, gen_random_uuid());
  exception when not_null_violation then
    get stacked diagnostics v_col = column_name;
  end;
  if v_col is distinct from 'pagata_il' then
    raise exception 'anticipazioni_socio: senza data non ha dato l''errore atteso (colonna: %).', coalesce(v_col, 'nessun errore');
  end if;

  v_col := null;
  begin
    insert into cash_movements (entity_id, direction, amount)
      values (v_ente, 'uscita', 1);
  exception when not_null_violation then
    get stacked diagnostics v_col = column_name;
  end;
  if v_col is distinct from 'movement_date' then
    raise exception 'cash_movements: senza data non ha dato l''errore atteso (colonna: %).', coalesce(v_col, 'nessun errore');
  end if;

  v_col := null;
  begin
    insert into conteggi_cassa (entity_id, teorico, contato, differenza)
      values (v_ente, 0, 0, 0);
  exception when not_null_violation then
    get stacked diagnostics v_col = column_name;
  end;
  if v_col is distinct from 'contato_il' then
    raise exception 'conteggi_cassa: senza data non ha dato l''errore atteso (colonna: %).', coalesce(v_col, 'nessun errore');
  end if;

  v_col := null;
  begin
    insert into daily_menus (title) values ('__VERIFICA__ predefiniti');
  exception when not_null_violation then
    get stacked diagnostics v_col = column_name;
  end;
  if v_col is distinct from 'service_date' then
    raise exception 'daily_menus: senza data non ha dato l''errore atteso (colonna: %).', coalesce(v_col, 'nessun errore');
  end if;

  v_col := null;
  begin
    insert into deductible_expenses (entity_id, description, amount, payment_method)
      values (v_ente, '__VERIFICA__ predefiniti', 1, 'contante');
  exception when not_null_violation then
    get stacked diagnostics v_col = column_name;
  end;
  if v_col is distinct from 'expense_date' then
    raise exception 'deductible_expenses: senza data non ha dato l''errore atteso (colonna: %).', coalesce(v_col, 'nessun errore');
  end if;

  select id into v_causale from cash_causali
   where kind = 'sconto_omaggio' and active order by label limit 1;
  if v_causale is null then
    raise exception 'Nessuna causale di sconto/omaggio: la verifica non potrebbe discriminare.';
  end if;
  v_col := null;
  begin
    insert into discounts_gifts (entity_id, type, full_amount, causale_id)
      values (v_ente, 'omaggio', 0, v_causale);
  exception when not_null_violation then
    get stacked diagnostics v_col = column_name;
  end;
  if v_col is distinct from 'movement_date' then
    raise exception 'discounts_gifts: senza data non ha dato l''errore atteso (colonna: %).', coalesce(v_col, 'nessun errore');
  end if;

  v_col := null;
  begin
    insert into foraged_items (species) values ('__VERIFICA__ predefiniti');
  exception when not_null_violation then
    get stacked diagnostics v_col = column_name;
  end;
  if v_col is distinct from 'harvest_date' then
    raise exception 'foraged_items: senza data non ha dato l''errore atteso (colonna: %).', coalesce(v_col, 'nessun errore');
  end if;

  v_col := null;
  begin
    insert into tips_collected (entity_id, amount) values (v_ente, 1);
  exception when not_null_violation then
    get stacked diagnostics v_col = column_name;
  end;
  if v_col is distinct from 'collected_date' then
    raise exception 'tips_collected: senza data non ha dato l''errore atteso (colonna: %).', coalesce(v_col, 'nessun errore');
  end if;

  -- =========== 3 · LA CHIUSURA IN SALA CONTINUA A FUNZIONARE ===========
  -- ⚠️ E' la meta' che conta davvero: le otto prove qui sopra dimostrano
  -- che un inserimento senza data si ferma; questa dimostra che il gesto
  -- vero NON si e' fermato insieme a loro. Senza, la migrazione avrebbe
  -- chiuso una porta e rotto la stanza.
  select t.id into v_tavolo
    from dining_tables t
   where t.tipo = 'tavolo' and t.active
     and not exists (select 1 from order_tables ot
                      where ot.dining_table_id = t.id and ot.conto_aperto)
   order by t.label limit 1;
  if v_tavolo is null then
    raise exception 'Nessun tavolo libero: la chiusura in sala non si puo'' provare.';
  end if;

  v_conto := (apri_conto(array[v_tavolo], null, '__VERIFICA__ predefiniti', serata_di_servizio())->>'order_id')::uuid;
  v_dg := close_order_as_discount_gift(
    p_order_id => v_conto, p_is_gift => true, p_causale_id => v_causale,
    p_note => '__VERIFICA__ predefiniti');

  select movement_date into v_data from discounts_gifts where id = v_dg;
  if v_data is distinct from serata_di_servizio() then
    raise exception 'L''omaggio e'' stato datato % invece della serata %.', v_data, serata_di_servizio();
  end if;
  select status into v_stato from orders where id = v_conto;
  if v_stato <> 'omaggiato' then
    raise exception 'Il conto non risulta omaggiato (stato: %).', v_stato;
  end if;

  -- =========== PULIZIA, e il guardiano delle lapidi ===========
  -- ⚠️ Si scollega prima e si cancella dopo: il conto punta all'omaggio.
  update orders set discount_gift_id = null, status = 'annullato' where id = v_conto;
  delete from discounts_gifts where id = v_dg;
  delete from order_tables where order_id = v_conto;
  delete from orders where id = v_conto;
  delete from deleted_records where record::text like '%__VERIFICA__ predefiniti%';

  select count(*) into v_lap_d from deleted_records;
  if v_lap_d <> v_lap_p then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.', v_lap_d - v_lap_p;
  end if;
  select count(*) into v_n from orders where note = '__VERIFICA__ predefiniti';
  if v_n <> 0 then
    raise exception 'La verifica ha lasciato % conti finti.', v_n;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Nessuna data si riempie piu'' da sola: otto predefiniti tolti, e la chiusura in sala passa la serata.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260819000009', 'niente_date_riempite_da_sole')
on conflict (version) do nothing;
