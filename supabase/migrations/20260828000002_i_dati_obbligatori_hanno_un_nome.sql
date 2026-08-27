-- ============================================================================
-- I DATI OBBLIGATORI HANNO UN NOME — 28/08/2026
-- ============================================================================
--
-- La `20260828000001` ha insegnato al gestionale a riconoscere la quinta forma
-- di rifiuto — «manca un dato obbligatorio» — e a dirla in italiano. Ma la
-- frase e' buona quanto il nome che ci mette dentro, e senza un commento sulla
-- colonna quel nome resta quello tecnico.
--
-- 🔴 MISURATO GUARDANDOLO, non dedotto. Il rifiuto vero che arriva a schermo
--    provando a salvare un tavolo senza nome, letto dal collegamento dell'app
--    il 28/08:
--
--      «Manca un dato che il gestionale considera obbligatorio: «label».»
--
--    Meglio dell'inglese, e ancora mezzo muto: `label` non e' una parola che
--    qualcuno usa in sala.
--
-- ----------------------------------------------------------------------------
-- IL PERIMETRO, e perche' non sono tutte
-- ----------------------------------------------------------------------------
--    Le colonne obbligatorie senza valore predefinito sono **341, su 116
--    tabelle**, e ne hanno un commento **32**. Scriverne 341 stanotte vorrebbe
--    dire scriverne la maggior parte senza sapere davvero cosa contengono —
--    cioe' produrre frasi plausibili, che e' peggio di nessuna frase.
--
-- ⚠️ Quindi si fa il taglio che si puo' difendere: le **38 colonne
--    obbligatorie senza nome delle quindici tabelle su cui si scrive tutti i
--    giorni** — sala, cassa, conti, magazzino, fatture, personale, HACCP.
--    Sono quelle su cui un dato mancante puo' capitare **in servizio**, cioe'
--    dove la differenza fra «label» e «il nome del tavolo» si paga in secondi.
--
-- ⚠️ NESSUNA RETE PRETENDE LE ALTRE 303, ed e' una scelta: un guardiano che
--    chiedesse trecento frasi verrebbe spento il primo giorno. Il debito e'
--    dichiarato qui e nel riepilogo, non sorvegliato.
--
-- ----------------------------------------------------------------------------
-- COSA CAMBIA PER IL LOCALE
-- ----------------------------------------------------------------------------
--    Niente, finche' tutto va bene. Quando un salvataggio si rifiuta perche'
--    un pezzo non e' arrivato, la frase dice **quale pezzo** con una parola
--    che si capisce, invece del nome di una colonna di database.
-- ============================================================================

-- --- La sala ---------------------------------------------------------
comment on column dining_tables.label is
  'il nome del tavolo (e'' quello che finisce sul biglietto della cucina e sul preconto)';

comment on column orders.table_label is
  'il nome del tavolo, o dei tavoli accostati, com''era quando il conto e'' stato aperto';

comment on column order_items.order_id is 'il conto a cui appartiene questa riga';
comment on column order_items.destination is 'il reparto a cui va questa riga (cucina o bar)';
comment on column order_items.unit_price is 'il prezzo di una porzione';

comment on column reservations.reservation_date is 'il giorno della prenotazione';
comment on column reservations.reservation_time is 'l''ora della prenotazione';
comment on column reservations.party_size is 'quante persone';
comment on column reservations.customer_name is 'il nome di chi ha prenotato';

-- --- La cassa --------------------------------------------------------
comment on column cash_movements.entity_id is 'la societa'' a cui appartiene il movimento';
comment on column cash_movements.direction is 'se sono soldi che entrano o che escono';
comment on column cash_movements.amount is 'l''importo del movimento';
comment on column cash_movements.movement_date is 'la giornata a cui appartiene il movimento (la serata di servizio, non il calendario)';

comment on column tips_collected.entity_id is 'la societa'' a cui appartengono le mance raccolte';
comment on column tips_collected.amount is 'quante mance sono state raccolte';
comment on column tips_collected.collected_date is 'la serata in cui sono state raccolte';

comment on column discounts_gifts.entity_id is 'la societa'' a cui appartiene lo sconto o l''omaggio';
comment on column discounts_gifts.type is 'se e'' uno sconto o un omaggio';
comment on column discounts_gifts.full_amount is 'quanto sarebbe costato per intero';
comment on column discounts_gifts.movement_date is 'la serata dello sconto o dell''omaggio';

-- --- Il magazzino e le fatture ---------------------------------------
comment on column stock_lots.ingredient_id is 'di quale prodotto e'' questa partita';
comment on column stock_lots.quantity_received is 'quanta merce e'' entrata';
comment on column stock_lots.quantity_remaining is 'quanta ne resta';

comment on column supplier_invoices.entity_id is 'la societa'' che ha ricevuto la fattura';
comment on column supplier_invoices.supplier_id is 'il fornitore che ha emesso la fattura';
comment on column supplier_invoices.invoice_date is 'la data della fattura';
comment on column supplier_invoices.amount is 'l''importo della fattura';

comment on column ingredients.name is 'il nome del prodotto';
comment on column ingredients.category is 'la categoria del prodotto';
comment on column ingredients.unit is 'l''unita'' di misura del prodotto (chili, litri, pezzi...)';

-- --- Il ricettario ---------------------------------------------------
comment on column recipes.name is 'il nome della ricetta';
comment on column recipes.category is 'la categoria della ricetta';

-- --- Il personale ----------------------------------------------------
comment on column employees.entity_id is 'la societa'' che ha assunto la persona';
comment on column employees.first_name is 'il nome della persona';
comment on column employees.last_name is 'il cognome della persona';

-- --- L'HACCP e i documenti -------------------------------------------
comment on column haccp_temperature_logs.equipment_id is 'quale frigo o congelatore e'' stato misurato';
comment on column haccp_temperature_logs.recorded_temp_c is 'la temperatura letta, in gradi';

comment on column documents.title is 'il titolo del documento';

-- ---------------------------------------------------------------------
-- Verifica — provata ROMPENDOLA in due modi diversi
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_lapidi   bigint;
  v_lapidi2  bigint;
  v_senza    integer;
  v_frase    text;
  v_tabelle  text[] := array[
    'dining_tables','cash_movements','orders','order_items','reservations',
    'stock_lots','supplier_invoices','ingredients','recipes','employees',
    'haccp_temperature_logs','tips_collected','discounts_gifts','documents',
    'shopping_list_items'
  ];
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Serve un titolare per verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select count(*) into v_lapidi from deleted_records;

  -- (a) LA PROPRIETA', non il numero: nelle quindici tabelle di tutti i
  --     giorni non resta nessun dato obbligatorio senza nome. ⚠️ Scritta
  --     cosi' resta vera anche il giorno che una di quelle tabelle riceve
  --     una colonna obbligatoria nuova — e allora diventa rossa, che e'
  --     esattamente quello che deve fare.
  select count(*) into v_senza
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
   where n.nspname = 'public' and c.relkind = 'r' and a.attnotnull
     and not exists (select 1 from pg_attrdef d where d.adrelid = c.oid and d.adnum = a.attnum)
     and col_description(c.oid, a.attnum) is null
     and c.relname = any(v_tabelle);
  if v_senza > 0 then
    raise exception 'Restano % dati obbligatori senza nome nelle tabelle di tutti i giorni.', v_senza;
  end if;

  -- (b) E LA PORTA VERA RISPONDE. ⚠️ Guardare il catalogo e guardare cosa
  --     risponde `spiega_campo_obbligatorio` sono due cose diverse: la
  --     schermata passa di li', e un difetto che vivesse solo dentro quella
  --     funzione sarebbe invisibile a un controllo fatto sul catalogo.
  v_frase := spiega_campo_obbligatorio('dining_tables', 'label');
  if v_frase is null or v_frase not like '%nome del tavolo%' then
    raise exception 'La porta vera non restituisce il nome della colonna: %', coalesce(v_frase, '<vuoto>');
  end if;

  -- (c) ROTTURA 1 — una colonna che NON esiste non deve inventare niente.
  if spiega_campo_obbligatorio('dining_tables', 'colonna_che_non_esiste') is not null then
    raise exception 'Una colonna inesistente riceve una spiegazione.';
  end if;

  -- (d) ROTTURA 2 — e nemmeno una TABELLA che non esiste. ⚠️ Serve oltre a
  --     (c): la ricerca incrocia due nomi, e sbagliando il legame fra i due
  --     si potrebbe rispondere col commento di una colonna omonima di
  --     un'altra tabella — cioe' dire a chi lavora il nome di un dato che
  --     non c'entra niente.
  if spiega_campo_obbligatorio('tabella_che_non_esiste', 'label') is not null then
    raise exception 'Una tabella inesistente riceve la spiegazione di una colonna omonima.';
  end if;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Trentotto dati obbligatori hanno un nome italiano; restano senza le colonne fuori dalle quindici tabelle di tutti i giorni.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260828000002', 'i_dati_obbligatori_hanno_un_nome') on conflict (version) do nothing;
