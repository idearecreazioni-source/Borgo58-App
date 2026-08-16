-- =====================================================================
-- Un documento che ha generato un effetto non si cancella e basta
-- =====================================================================
-- Blocco 1 del mandato di correzione (16/08/2026). La revisione generale
-- ha trovato lo stesso difetto in tre esemplari identici:
--
--   1. Una fattura fornitore GIA' PAGATA si cancellava, e l'uscita in
--      prima nota restava senza piu' il documento che la giustificava.
--      `delete_supplier_invoice` (09/08) non sa niente del movimento che
--      `pay_supplier_invoice` (13/08) ha imparato a scrivere.
--   2. Una nota «di tasca mia» GIA' RIMBORSATA si cancellava dal browser
--      con un delete diretto, e il rimborso restava in cassa senza il
--      perche'.
--   3. Una cessione intercompany con COSTO AGGIORNATO si cancellava dal
--      browser, e l'ingrediente restava valorizzato al prezzo di
--      trasferimento, con la sua riga nello storico prezzi.
--
-- LA REGOLA, scritta una volta sola:
--
--   Un documento che ha generato un effetto altrove o e' RESPINTO, con
--   un messaggio che dice cosa lo impedisce e cosa fare prima, oppure
--   STORNA anche l'effetto nella stessa transazione. Non esiste il terzo
--   caso — il documento sparisce e l'effetto resta.
--
-- Quale delle due strade, caso per caso, e perche':
--
--   * FATTURA PAGATA -> RESPINGI. Il denaro e' uscito davvero. «Ho
--     sbagliato a registrare la fattura» e «ho sbagliato a segnarla
--     pagata» sono due decisioni diverse, e farle prendere insieme a un
--     pulsante «Rimuovi» significa cancellare un'uscita di cassa per
--     sbaglio. La via di ritorno c'e' ed e' esplicita:
--     `annulla_pagamento_fattura`.
--   * NOTA RIMBORSATA -> RESPINGI, per lo stesso motivo: il rimborso e'
--     denaro uscito dal cassetto. Via di ritorno:
--     `annulla_pareggio_anticipazione`.
--   * CESSIONE COL COSTO AGGIORNATO -> STORNA. Qui non si e' mosso
--     nessun euro: l'effetto e' un numero derivato (il costo
--     dell'ingrediente) piu' una riga di un registro append-only.
--     Respingere avrebbe creato un vicolo cieco senza gesto di uscita —
--     non esiste un «annulla l'aggiornamento del costo» — e l'unica
--     alternativa sarebbe stata chiedere ad Alessio di ridigitare a mano
--     il prezzo di prima, cioe' chiedergli di inventare un numero.
--
-- ⚠️ LO STORNO DELLA CESSIONE CANCELLA LA RIGA DELLO STORICO, non ne
-- aggiunge una di segno opposto, e non e' una scelta estetica: la
-- sorveglianza dei rincari confronta l'ultimo prezzo con il precedente.
-- Un prezzo di trasferimento lasciato in storico da una cessione che non
-- esiste piu' produrrebbe, al primo acquisto vero, un rincaro segnalato
-- che non e' mai avvenuto — cioe' un allarme che grida per una cosa
-- normale, che e' il modo in cui si smette di leggere gli allarmi.
--
-- ⚠️ E IL VERSO OPPOSTO, che la revisione non nominava ma e' la stessa
-- regola allo specchio: da Prima Nota si cancellava il MOVIMENTO,
-- lasciando la fattura che dichiara «pagata» senza un euro uscito, e il
-- saldo di tesoreria sbagliato. Ora un movimento a cui un documento
-- punta non si cancella: il trigger dice quale gesto usare al suo posto.
-- Sull'anticipazione quel rifiuto esisteva gia' — ma come violazione di
-- un vincolo `check`, cioe' un errore illeggibile per chi lo riceve.
--
-- Le tre funzioni sono `security definer` col controllo dentro, e si
-- chiamano dal corridoio (Contratto B4): non e' la schermata a decidere
-- se un documento e' cancellabile.
--
-- ⚠️ Stato di partenza VERO, letto col connettore in sola lettura prima
-- di scrivere (lezione del 12 e del 14/08): in produzione ci sono ZERO
-- cessioni, ZERO anticipazioni, ZERO fatture e ZERO movimenti di cassa.
-- Nessuna riga esistente cambia significato, e la colonna nuova
-- `price_history_id` non risponde al posto di nessuno. Per le righe che
-- dovessero arrivare da un ripristino vecchio, lo storno ha comunque una
-- strada di riserva che riconosce la riga di storico dalla sua firma.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Le reti nel database — prima dei messaggi
-- ---------------------------------------------------------------------
-- I due legami erano `on delete set null`: cancellare la fattura non
-- falliva, scollegava. Cioe' il difetto era scritto nello schema.
alter table cash_movements
  drop constraint if exists cash_movements_supplier_invoice_id_fkey;
alter table cash_movements
  add constraint cash_movements_supplier_invoice_id_fkey
  foreign key (supplier_invoice_id) references supplier_invoices(id) on delete restrict;

comment on constraint cash_movements_supplier_invoice_id_fkey on cash_movements is
  'RESTRICT e non SET NULL (16/08/2026): scollegare un''uscita dalla fattura che la giustifica e'' esattamente il difetto — un movimento di cassa senza documento. Per togliere la fattura si annulla prima il pagamento.';

alter table anticipazioni_socio
  drop constraint if exists anticipazioni_socio_supplier_invoice_id_fkey;
alter table anticipazioni_socio
  add constraint anticipazioni_socio_supplier_invoice_id_fkey
  foreign key (supplier_invoice_id) references supplier_invoices(id) on delete restrict;

comment on constraint anticipazioni_socio_supplier_invoice_id_fkey on anticipazioni_socio is
  'RESTRICT e non SET NULL (16/08/2026): senza il collegamento la nota smette di essere «solo un debito» e diventa da sola un costo — la spesa risulterebbe contata due volte, in silenzio.';

-- ---------------------------------------------------------------------
-- 2. La regola allo specchio: un movimento a cui punta un documento
-- ---------------------------------------------------------------------
create or replace function vieta_delete_movimento_con_documento()
returns trigger
language plpgsql
security definer
set search_path = public
as $trigger$
declare
  v_num text;
begin
  -- Il pagamento di una fattura.
  if old.supplier_invoice_id is not null then
    select coalesce(nullif(invoice_number, ''), 'senza numero')
      into v_num from supplier_invoices where id = old.supplier_invoice_id;
    raise exception
      'Questa uscita e'' il pagamento della fattura % : togliendola, la fattura resterebbe segnata pagata senza che sia uscito un euro. Per disfare, usa «Annulla il pagamento» sulla fattura.',
      coalesce(v_num, 'collegata');
  end if;

  -- Il rimborso di una nota «di tasca mia». Il vincolo `check` gia' lo
  -- impediva, ma con un errore illeggibile: qui la frase dice cosa fare.
  if exists (select 1 from anticipazioni_socio where movimento_id = old.id) then
    raise exception
      'Questa uscita e'' il rimborso di una nota «ho messo di tasca mia»: togliendola, la nota resterebbe pareggiata senza che i soldi siano usciti. Per disfare, usa «Annulla il rimborso» sulla nota.';
  end if;

  return old;
end;
$trigger$;

comment on function vieta_delete_movimento_con_documento is
  'La regola del Blocco 1 allo specchio (16/08/2026): non solo il documento non sparisce lasciando l''effetto, ma nemmeno l''effetto sparisce lasciando il documento a dichiarare qualcosa che non e'' avvenuto. I gesti di storno scollegano PRIMA e cancellano DOPO, quindi passano.';

revoke all on function vieta_delete_movimento_con_documento() from public, anon, authenticated;

drop trigger if exists trg_movimento_con_documento on cash_movements;
create trigger trg_movimento_con_documento
  before delete on cash_movements
  for each row execute function vieta_delete_movimento_con_documento();

-- ---------------------------------------------------------------------
-- 3. Fattura fornitore: respingere, e la via di ritorno
-- ---------------------------------------------------------------------
create or replace function delete_supplier_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_inv    supplier_invoices%rowtype;
  v_mov    cash_movements%rowtype;
  v_note   integer;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' eliminare una fattura';
  end if;

  select * into v_inv from supplier_invoices where id = p_invoice_id for update;
  if v_inv.id is null then
    raise exception 'Fattura non trovata';
  end if;

  -- L'EFFETTO 1: l'uscita in prima nota. Il messaggio porta l'importo e
  -- la data, perche' «questa fattura ha un movimento» non dice a chi
  -- legge quanto denaro rimarrebbe senza giustificazione.
  select * into v_mov from cash_movements where supplier_invoice_id = p_invoice_id;
  if v_mov.id is not null then
    raise exception
      'Questa fattura risulta pagata: in prima nota c''e'' un''uscita di % euro del %. Cancellandola resterebbero soldi usciti senza il documento che li giustifica. Annulla prima il pagamento, poi la fattura si puo'' togliere.',
      to_char(v_mov.amount, 'FM999999990.00'),
      to_char(v_mov.movement_date, 'DD/MM/YYYY');
  end if;

  -- L'EFFETTO 2: una nota «di tasca mia» collegata. Finche' punta alla
  -- fattura, quella nota vale come debito verso il titolare e NON come
  -- costo: scollegandola diventerebbe anche un costo, e la stessa spesa
  -- sarebbe contata due volte senza che niente lo segnali.
  select count(*) into v_note from anticipazioni_socio where supplier_invoice_id = p_invoice_id;
  if v_note > 0 then
    raise exception
      'Questa fattura e'' collegata a % nota «ho messo di tasca mia»: senza la fattura quella nota diventerebbe da sola un costo, e la stessa spesa risulterebbe contata due volte. Togli prima il collegamento.',
      v_note;
  end if;

  if v_inv.task_id is not null then
    update tasks set status = 'completato' where id = v_inv.task_id;
  end if;

  delete from supplier_invoices where id = p_invoice_id;
end;
$funzione$;

comment on function delete_supplier_invoice is
  'Cancella la fattura e chiude il promemoria collegato — MA RESPINGE se la fattura ha gia'' generato un effetto altrove (16/08/2026, Blocco 1 del mandato di correzione): un''uscita in prima nota o una nota «di tasca mia» che senza di lei diventerebbe un costo doppio. Il controllo e'' qui, non nella schermata.';

revoke all on function delete_supplier_invoice(uuid) from public, anon, authenticated;
grant execute on function delete_supplier_invoice(uuid) to authenticated;

-- La via di ritorno. Senza, il rifiuto di sopra sarebbe un vicolo cieco.
create or replace function annulla_pagamento_fattura(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_inv supplier_invoices%rowtype;
  v_mov uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' annullare un pagamento';
  end if;

  select * into v_inv from supplier_invoices where id = p_invoice_id for update;
  if v_inv.id is null then
    raise exception 'Fattura non trovata';
  end if;
  if v_inv.status <> 'pagata' then
    raise exception 'Questa fattura non risulta pagata: non c''e'' nessun pagamento da annullare.';
  end if;

  update supplier_invoices
     set status = 'da_pagare', paid_at = null, payment_method = null
   where id = p_invoice_id;

  -- Il promemoria torna da fare: la fattura e' di nuovo da pagare, e un
  -- promemoria chiuso su un debito riaperto e' un debito che si dimentica.
  if v_inv.task_id is not null then
    update tasks set status = 'da_fare' where id = v_inv.task_id;
  end if;

  select id into v_mov from cash_movements where supplier_invoice_id = p_invoice_id;
  if v_mov is not null then
    -- Si SCOLLEGA prima e si cancella dopo: il trigger del punto 2
    -- rifiuta la cancellazione di un movimento a cui un documento punta,
    -- e questo e' l'unico gesto che ha il diritto di toglierlo.
    update cash_movements set supplier_invoice_id = null where id = v_mov;
    delete from cash_movements where id = v_mov;
  end if;

  return p_invoice_id;
end;
$funzione$;

comment on function annulla_pagamento_fattura is
  'Riporta la fattura a «da pagare», riapre il promemoria e toglie l''uscita dalla prima nota, in una transazione (16/08/2026). E'' la via di ritorno che rende il rifiuto di delete_supplier_invoice una porta e non un muro. Il movimento cancellato resta in deleted_records.';

revoke all on function annulla_pagamento_fattura(uuid) from public, anon, authenticated;
grant execute on function annulla_pagamento_fattura(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. «Ho messo di tasca mia»: respingere, e la via di ritorno
-- ---------------------------------------------------------------------
create or replace function delete_anticipazione(p_anticipazione_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  a anticipazioni_socio%rowtype;
  v_importo numeric;
begin
  if not is_titolare() then
    raise exception 'Le anticipazioni del titolare sono riservate al titolare.';
  end if;

  select * into a from anticipazioni_socio where id = p_anticipazione_id for update;
  if a.id is null then
    raise exception 'Questa nota non esiste.';
  end if;

  if a.pareggiata_il is not null then
    select amount into v_importo from cash_movements where id = a.movimento_id;
    raise exception
      'Questa nota e'' gia'' stata rimborsata il %: in prima nota c''e'' un''uscita di % euro. Cancellandola resterebbero soldi usciti dal cassetto senza il perche''. Annulla prima il rimborso.',
      to_char(a.pareggiata_il, 'DD/MM/YYYY'),
      to_char(coalesce(v_importo, a.importo), 'FM999999990.00');
  end if;

  delete from anticipazioni_socio where id = p_anticipazione_id;
end;
$funzione$;

comment on function delete_anticipazione is
  'Cancella una nota «ho messo di tasca mia», ma RESPINGE se e'' gia'' stata rimborsata (16/08/2026, Blocco 1). Prima era un delete diretto dal browser: il rimborso restava in cassa senza il documento che lo giustificava.';

revoke all on function delete_anticipazione(uuid) from public, anon, authenticated;
grant execute on function delete_anticipazione(uuid) to authenticated;

create or replace function annulla_pareggio_anticipazione(p_anticipazione_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  a anticipazioni_socio%rowtype;
  v_mov uuid;
begin
  if not is_titolare() then
    raise exception 'Le anticipazioni del titolare sono riservate al titolare.';
  end if;

  select * into a from anticipazioni_socio where id = p_anticipazione_id for update;
  if a.id is null then
    raise exception 'Questa nota non esiste.';
  end if;
  if a.pareggiata_il is null then
    raise exception 'Questa nota non e'' ancora stata rimborsata: non c''e'' niente da annullare.';
  end if;

  v_mov := a.movimento_id;

  -- ⚠️ L'ORDINE NON E' INDIFFERENTE, ed e' costretto da due vincoli che
  -- tirano in direzioni opposte: il `check` della tabella pretende che
  -- `pareggiata_il` e `movimento_id` nascano e muoiano insieme, e il
  -- trigger del punto 2 rifiuta di cancellare un movimento a cui la nota
  -- punta ancora. Quindi: prima si riapre la nota, poi si toglie l'uscita.
  update anticipazioni_socio
     set pareggiata_il = null, movimento_id = null
   where id = p_anticipazione_id;

  if v_mov is not null then
    delete from cash_movements where id = v_mov;
  end if;

  return p_anticipazione_id;
end;
$funzione$;

comment on function annulla_pareggio_anticipazione is
  'Riapre la nota e toglie il rimborso dalla prima nota, in una transazione (16/08/2026). Via di ritorno del rifiuto di delete_anticipazione. Il movimento cancellato resta in deleted_records.';

revoke all on function annulla_pareggio_anticipazione(uuid) from public, anon, authenticated;
grant execute on function annulla_pareggio_anticipazione(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Cessione intercompany: stornare
-- ---------------------------------------------------------------------
-- Per stornare bisogna sapere QUALE riga dello storico ha scritto questa
-- cessione. Nasce `null` perche' «non lo so» e' una risposta vera per le
-- righe di prima, non il valore piu' comodo (lezione del 14/08); in
-- produzione di righe di prima non ce n'e' nessuna.
alter table intercompany_cessions
  add column if not exists price_history_id uuid references price_history(id) on delete set null;

comment on column intercompany_cessions.price_history_id is
  'La riga dello storico prezzi che questa cessione ha scritto, quando ha aggiornato il costo dell''ingrediente. Serve a stornare l''effetto se la cessione viene cancellata. NULL = il costo non e'' stato aggiornato, oppure la cessione e'' anteriore al 16/08/2026 (in produzione: nessuna).';

create or replace function create_intercompany_cession(
  p_seller_entity_id       uuid,
  p_buyer_entity_id        uuid,
  p_product_description    text,
  p_quantity               numeric,
  p_unit                   unit_type,
  p_unit_price             numeric,
  p_cession_date           date,
  p_ingredient_id          uuid default null,
  p_vat_rate               numeric default null,
  p_fiscal_document_type   text default null,
  p_invoice_reference      text default null,
  p_notes                  text default null,
  p_update_ingredient_cost boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_id uuid;
  v_ph uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' registrare una cessione fra le due aziende';
  end if;

  if p_product_description is null or btrim(p_product_description) = '' then
    raise exception 'Serve la descrizione del prodotto ceduto';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La quantita'' deve essere maggiore di zero';
  end if;
  if p_unit_price is null or p_unit_price < 0 then
    raise exception 'Il prezzo unitario non puo'' essere negativo o mancante';
  end if;
  if p_cession_date is null then
    raise exception 'Serve la data della cessione';
  end if;
  if p_seller_entity_id = p_buyer_entity_id then
    raise exception 'Le due aziende della cessione devono essere diverse';
  end if;

  insert into intercompany_cessions (
    seller_entity_id, buyer_entity_id, ingredient_id, product_description,
    quantity, unit, unit_price, vat_rate, total_amount, cession_date,
    fiscal_document_type, invoice_reference, notes
  ) values (
    p_seller_entity_id, p_buyer_entity_id, p_ingredient_id,
    btrim(p_product_description), p_quantity, p_unit, p_unit_price,
    p_vat_rate, round(p_quantity * p_unit_price, 2), p_cession_date,
    p_fiscal_document_type, p_invoice_reference, p_notes
  )
  returning id into v_id;

  if p_update_ingredient_cost and p_ingredient_id is not null then
    perform update_ingredient_price(
      p_ingredient_id, p_unit_price, 'cessione_interna',
      'Cessione intercompany del ' || p_cession_date::text, null
    );

    -- La riga appena scritta. `update_ingredient_price` restituisce void
    -- e resta l'unico posto che scrive un prezzo (regola 6 del mandato:
    -- niente secondo posto dove si calcola la stessa cosa), quindi la si
    -- rilegge invece di duplicarne la insert.
    --
    -- ⚠️ NON basta prendere «l'ultima riga di questo ingrediente», ed e'
    -- la prova sul progetto di prova ad averlo dimostrato: `recorded_at`
    -- vale `now()`, che dentro una transazione e' UNO SOLO. Due righe
    -- scritte nello stesso momento pareggiano, l'ordinamento ne sceglie
    -- una a caso, e lo storno avrebbe cancellato la riga sbagliata
    -- lasciando in piedi il prezzo di trasferimento — cioe' il difetto
    -- che questa migrazione chiude. Si riconosce dalla firma esatta.
    select ph.id into v_ph
      from price_history ph
     where ph.ingredient_id = p_ingredient_id
       and ph.source = 'cessione_interna'
       and ph.price = p_unit_price
       and ph.note = 'Cessione intercompany del ' || p_cession_date::text
     order by ph.recorded_at desc, ph.id desc
     limit 1;

    update intercompany_cessions set price_history_id = v_ph where id = v_id;
  end if;

  return v_id;
end;
$funzione$;

comment on function create_intercompany_cession is
  'Registra una cessione agricola->S.r.l.s. e (se richiesto) aggiorna il costo dell''ingrediente nella stessa transazione, ANNOTANDO quale riga dello storico ha scritto — senza quel filo, cancellare la cessione lascerebbe il costo al prezzo di trasferimento. Totale calcolato dal database. Solo titolare.';

revoke all on function create_intercompany_cession(uuid, uuid, text, numeric, unit_type, numeric, date, uuid, numeric, text, text, text, boolean) from public, anon, authenticated;
grant execute on function create_intercompany_cession(uuid, uuid, text, numeric, unit_type, numeric, date, uuid, numeric, text, text, text, boolean) to authenticated;

create or replace function delete_intercompany_cession(p_cession_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  c        intercompany_cessions%rowtype;
  v_ph     uuid;
  v_prezzo numeric;
  v_nome   text;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' eliminare una cessione fra le due aziende';
  end if;

  select * into c from intercompany_cessions where id = p_cession_id for update;
  if c.id is null then
    raise exception 'Cessione non trovata';
  end if;

  v_ph := c.price_history_id;

  -- Strada di riserva per le cessioni anteriori a questa migrazione (in
  -- produzione: nessuna) — la riga si riconosce dalla firma che
  -- `create_intercompany_cession` le ha sempre messo. Se non si trova,
  -- non c'e' nessun effetto da stornare e la cessione si cancella e basta.
  if v_ph is null and c.ingredient_id is not null then
    select ph.id into v_ph
      from price_history ph
     where ph.ingredient_id = c.ingredient_id
       and ph.source = 'cessione_interna'
       and ph.note = 'Cessione intercompany del ' || c.cession_date::text
       and ph.price = c.unit_price
     order by ph.recorded_at desc, ph.id desc
     limit 1;
  end if;

  if v_ph is not null then
    delete from price_history where id = v_ph;

    -- Il costo torna a essere l'ULTIMA RIGA RIMASTA nello storico, e la
    -- regola vale in tutti e due i casi senza distinguerli: se dopo la
    -- cessione era arrivato un acquisto vero, quell'acquisto e' ancora
    -- l'ultima riga e il costo non si muove; se non era arrivato niente,
    -- si torna al prezzo di prima.
    select ph.price into v_prezzo
      from price_history ph
     where ph.ingredient_id = c.ingredient_id
     order by ph.recorded_at desc, ph.id desc
     limit 1;

    if v_prezzo is null then
      -- ⚠️ Nessuno ha mai dichiarato un prezzo per questo ingrediente
      -- fuori da questa cessione. Mettere zero direbbe «gratis», e uno
      -- zero al posto di un buco e' il difetto che questo progetto passa
      -- il tempo a togliere. Si respinge dicendo cosa fare.
      select name into v_nome from ingredients where id = c.ingredient_id;
      raise exception
        'Questa cessione e'' l''unica cosa che abbia mai detto quanto costa «%»: togliendola, il gestionale non saprebbe piu'' valorizzarlo. Scrivi prima tu il prezzo dalla scheda dell''ingrediente.',
        coalesce(v_nome, 'l''ingrediente collegato');
    end if;

    update ingredients
       set current_price = v_prezzo, updated_at = now()
     where id = c.ingredient_id;
  end if;

  delete from intercompany_cessions where id = p_cession_id;
end;
$funzione$;

comment on function delete_intercompany_cession is
  'Cancella una cessione STORNANDO nella stessa transazione il costo che aveva aggiornato: via la riga dello storico, e il costo dell''ingrediente torna all''ultima riga rimasta (16/08/2026, Blocco 1). Prima era un delete diretto dal browser, e l''ingrediente restava valorizzato al prezzo di trasferimento. La riga dello storico si CANCELLA e non si compensa: lasciarla farebbe segnalare, al primo acquisto vero, un rincaro mai avvenuto.';

revoke all on function delete_intercompany_cession(uuid) from public, anon, authenticated;
grant execute on function delete_intercompany_cession(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Verifica sul campo (§5 punti 1-3)
-- ---------------------------------------------------------------------
-- ⚠️ Nessun gestore d'eccezione sul blocco esterno: uno intorno a tutto
-- inghiottirebbe anche il fallimento delle proprie assertion, e la
-- migrazione passerebbe verde con la verifica rotta (lezione del 15/08).
-- Ogni rifiuto atteso si prova col suo `begin…exception` annidato.
--
-- ⚠️ Il perimetro e' fatto SOLO di roba che la verifica ha creato —
-- ingrediente compreso, non «uno qualunque se ce n'e' uno» (lezione del
-- 16/08: FEFO prese dal lotto vero e la giacenza vera resto' corta).
do $verifica$
declare
  v_titolare uuid;
  e_ven uuid; e_com uuid;
  v_forn uuid; v_task uuid; v_inv uuid; v_mov uuid;
  v_tag uuid; v_ant uuid; v_movr uuid; v_entrata uuid;
  v_ingr uuid; v_cess uuid; v_ph uuid;
  v_stato text; v_tstato task_status;
  v_prezzo numeric; v_causale uuid;
  respinto boolean;
  n integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into e_com from entities order by created_at limit 1;
  select id into e_ven from entities where id <> e_com order by created_at limit 1;
  -- Le due entita' sono seminate da `20260730000001` e il vincolo
  -- `cession_distinct_entities` pretende che siano diverse: senza la
  -- seconda, il caso 3 non e' provabile e tacere sarebbe peggio.
  if e_ven is null then
    raise exception 'In anagrafica c''e'' una sola entita'': la cessione intercompany non e'' verificabile.';
  end if;

  -- =========================================================
  -- CASO 1 — la fattura pagata
  -- =========================================================
  insert into suppliers (entity_id, name)
  values (e_com, '__Prova B1 fornitore__') returning id into v_forn;

  v_inv := create_supplier_invoice(
    p_entity_id => e_com, p_supplier_id => v_forn,
    p_invoice_date => current_date, p_amount => 123.45,
    p_invoice_number => '__PROVA-B1__', p_due_date => current_date + 30);
  select task_id into v_task from supplier_invoices where id = v_inv;

  perform pay_supplier_invoice(v_inv, 'bonifico');
  select id into v_mov from cash_movements where supplier_invoice_id = v_inv;
  if v_mov is null then
    raise exception 'Il pagamento non ha scritto il movimento: verifica impossibile.';
  end if;

  -- 1a. Cancellarla ora deve essere RESPINTO.
  respinto := false;
  begin
    perform delete_supplier_invoice(v_inv);
  exception when sqlstate 'P0001' then
    respinto := true;
  end;
  if not respinto then
    raise exception 'Una fattura pagata si e'' lasciata cancellare: il difetto n.10 e'' vivo.';
  end if;
  if not exists (select 1 from cash_movements where id = v_mov) then
    raise exception 'Il rifiuto ha comunque toccato il movimento.';
  end if;

  -- 1b. E il movimento, dal verso opposto, non si cancella da solo.
  respinto := false;
  begin
    delete from cash_movements where id = v_mov;
  exception when sqlstate 'P0001' then
    respinto := true;
  end;
  if not respinto then
    raise exception 'Il movimento di una fattura pagata si e'' lasciato cancellare da Prima Nota.';
  end if;

  -- 1c. La via di ritorno: annulla il pagamento.
  perform annulla_pagamento_fattura(v_inv);
  select status into v_stato from supplier_invoices where id = v_inv;
  if v_stato is distinct from 'da_pagare' then
    raise exception 'Dopo l''annullamento la fattura risulta «%».', v_stato;
  end if;
  if exists (select 1 from cash_movements where id = v_mov) then
    raise exception 'L''annullamento non ha tolto l''uscita dalla prima nota.';
  end if;
  if v_task is not null then
    select status into v_tstato from tasks where id = v_task;
    if v_tstato is distinct from 'da_fare' then
      raise exception 'Il promemoria non e'' tornato da fare: %.', v_tstato;
    end if;
  end if;
  if not exists (select 1 from deleted_records
                  where table_name = 'cash_movements' and record_id = v_mov::text) then
    raise exception 'Il movimento annullato non e'' finito nel registro delle cancellazioni.';
  end if;

  -- 1d. Ora la fattura si cancella davvero.
  perform delete_supplier_invoice(v_inv);
  if exists (select 1 from supplier_invoices where id = v_inv) then
    raise exception 'La fattura non pagata non si e'' lasciata cancellare.';
  end if;

  -- =========================================================
  -- CASO 2 — la nota «di tasca mia» rimborsata
  -- =========================================================
  insert into tag_anticipazioni (etichetta)
  values ('__Prova B1 tag__') returning id into v_tag;

  -- Serve contante nel cassetto: `pareggia_anticipazione` rifiuta di
  -- rimborsare piu' di quello che c'e'. Questa entrata e' del perimetro
  -- della prova e viene tolta alla fine.
  insert into cash_movements (entity_id, direction, amount, movement_date, mezzo, business_purpose)
  values (e_com, 'entrata', 5000, current_date, 'cassa', '__PROVA B1 fondo cassa__')
  returning id into v_entrata;

  insert into anticipazioni_socio (entity_id, importo, pagata_il, tag_id, nota)
  values (e_com, 42.00, current_date, v_tag, '__PROVA B1__')
  returning id into v_ant;

  perform pareggia_anticipazione(v_ant, current_date);
  select movimento_id into v_movr from anticipazioni_socio where id = v_ant;
  if v_movr is null then
    raise exception 'Il pareggio non ha scritto il movimento: verifica impossibile.';
  end if;

  -- 2a. Cancellarla ora deve essere RESPINTO.
  respinto := false;
  begin
    perform delete_anticipazione(v_ant);
  exception when sqlstate 'P0001' then
    respinto := true;
  end;
  if not respinto then
    raise exception 'Una nota gia'' rimborsata si e'' lasciata cancellare.';
  end if;

  -- 2b. E il rimborso non si cancella da Prima Nota — con un messaggio
  -- nostro, non con la violazione grezza del vincolo `check`.
  respinto := false;
  begin
    delete from cash_movements where id = v_movr;
  exception when sqlstate 'P0001' then
    respinto := true;
  end;
  if not respinto then
    raise exception 'Il rimborso si e'' lasciato cancellare da Prima Nota.';
  end if;

  -- 2c. La via di ritorno.
  perform annulla_pareggio_anticipazione(v_ant);
  if (select pareggiata_il from anticipazioni_socio where id = v_ant) is not null then
    raise exception 'La nota non e'' tornata aperta.';
  end if;
  if exists (select 1 from cash_movements where id = v_movr) then
    raise exception 'L''annullamento del rimborso non ha tolto l''uscita.';
  end if;

  -- 2d. Ora si cancella.
  perform delete_anticipazione(v_ant);
  if exists (select 1 from anticipazioni_socio where id = v_ant) then
    raise exception 'La nota aperta non si e'' lasciata cancellare.';
  end if;

  -- =========================================================
  -- CASO 3 — la cessione che ha aggiornato il costo
  -- =========================================================
  -- L'ingrediente e' della prova, e nasce col suo prezzo: cosi' lo storno
  -- ha un «prima» a cui tornare che nessun altro ha scritto.
  -- `create_ingredient` restituisce la riga intera come jsonb, non l'id.
  v_ingr := (create_ingredient(
    p_entity_id => e_com, p_name => '__Prova B1 ingrediente__',
    p_category => (enum_range(null::ingredient_category))[1],
    p_unit => (enum_range(null::unit_type))[1],
    p_current_price => 2.00) ->> 'id')::uuid;

  -- ⚠️ Il prezzo iniziale viene datato indietro a mano. Nella vita vera i
  -- prezzi arrivano in transazioni diverse e si ordinano da soli; qui la
  -- prova sta tutta dentro una transazione, dove `now()` e' un istante
  -- unico e le righe pareggerebbero. Senza questo, non e' lo storno a
  -- essere provato ma il caso in cui l'ordinamento indovina.
  update price_history set recorded_at = now() - interval '10 days'
   where ingredient_id = v_ingr;

  v_cess := create_intercompany_cession(
    p_seller_entity_id => e_ven, p_buyer_entity_id => e_com,
    p_product_description => '__Prova B1 cessione__',
    p_quantity => 1, p_unit => (enum_range(null::unit_type))[1],
    p_unit_price => 9.00, p_cession_date => current_date,
    p_ingredient_id => v_ingr, p_update_ingredient_cost => true);

  select price_history_id into v_ph from intercompany_cessions where id = v_cess;
  if v_ph is null then
    raise exception 'La cessione non ha annotato quale riga dello storico ha scritto.';
  end if;
  select current_price into v_prezzo from ingredients where id = v_ingr;
  if v_prezzo <> 9.00 then
    raise exception 'La cessione non ha aggiornato il costo: % invece di 9.', v_prezzo;
  end if;

  -- 3a. Cancellando, il costo TORNA INDIETRO e la riga sparisce.
  perform delete_intercompany_cession(v_cess);
  if exists (select 1 from intercompany_cessions where id = v_cess) then
    raise exception 'La cessione non e'' stata cancellata.';
  end if;
  if exists (select 1 from price_history where id = v_ph) then
    raise exception 'La riga dello storico prezzi e'' sopravvissuta alla cessione.';
  end if;
  select current_price into v_prezzo from ingredients where id = v_ingr;
  if v_prezzo <> 2.00 then
    raise exception 'Il costo non e'' tornato al prezzo di prima: % invece di 2.', v_prezzo;
  end if;

  -- 3b. Un acquisto arrivato DOPO la cessione vince sullo storno: il
  -- costo non si muove. E' il caso in cui uno storno ingenuo farebbe
  -- danno, ed e' quello che nessuno noterebbe.
  v_cess := create_intercompany_cession(
    p_seller_entity_id => e_ven, p_buyer_entity_id => e_com,
    p_product_description => '__Prova B1 cessione 2__',
    p_quantity => 1, p_unit => (enum_range(null::unit_type))[1],
    p_unit_price => 9.00, p_cession_date => current_date,
    p_ingredient_id => v_ingr, p_update_ingredient_cost => true);
  -- La cessione va datata indietro rispetto all'acquisto che arriva dopo:
  -- stesso motivo di sopra, dentro una transazione i due istanti sono lo
  -- stesso e «dopo» non esisterebbe.
  update price_history set recorded_at = now() - interval '1 day'
   where id = (select price_history_id from intercompany_cessions where id = v_cess);
  perform update_ingredient_price(v_ingr, 3.30, 'fattura', '__PROVA B1 acquisto dopo__', null);
  perform delete_intercompany_cession(v_cess);
  select current_price into v_prezzo from ingredients where id = v_ingr;
  if v_prezzo <> 3.30 then
    raise exception 'Lo storno ha calpestato un acquisto piu'' recente: % invece di 3.30.', v_prezzo;
  end if;

  -- =========================================================
  -- PULIZIA — il perimetro e' tutto roba della prova
  -- =========================================================
  delete from price_history where ingredient_id = v_ingr;
  delete from ingredients where id = v_ingr;
  delete from anticipazioni_socio where tag_id = v_tag;
  delete from tag_anticipazioni where id = v_tag;
  delete from cash_movements where id = v_entrata;
  delete from tasks where id = v_task;
  delete from suppliers where id = v_forn;
  -- Il registro delle cancellazioni non e' ripulibile da nessuno
  -- dall'app, ed e' giusto: qui si gira come proprietari, e le righe
  -- della prova non devono restare a sporcarlo. Le cessioni si
  -- riconoscono dal contenuto perche' i loro identificativi sono due e
  -- la variabile ne tiene uno solo — ricordarseli a mano e' il modo in
  -- cui se ne dimentica uno.
  delete from deleted_records
   where record_id in (v_mov::text, v_movr::text, v_entrata::text, v_inv::text);
  delete from deleted_records
   where table_name = 'intercompany_cessions'
     and record->>'product_description' like '\_\_Prova B1%';
  delete from deleted_records
   where table_name = 'supplier_invoices'
     and record->>'invoice_number' = '__PROVA-B1__';

  select count(*) into n from suppliers where name = '__Prova B1 fornitore__';
  if n <> 0 then raise exception 'La verifica ha lasciato % fornitori.', n; end if;
  select count(*) into n from ingredients where name = '__Prova B1 ingrediente__';
  if n <> 0 then raise exception 'La verifica ha lasciato % ingredienti.', n; end if;
  -- ⚠️ In LIKE il trattino basso e' un jolly: senza escape, '__Prova'
  -- vorrebbe dire «due caratteri qualunque». Qui cambierebbe poco, ma e'
  -- il tipo di svista che altrove fa passare un controllo per niente.
  select count(*) into n from intercompany_cessions where product_description like '\_\_Prova B1%';
  if n <> 0 then raise exception 'La verifica ha lasciato % cessioni.', n; end if;
  select count(*) into n from cash_movements
   where business_purpose = '__PROVA B1 fondo cassa__' or supplier_invoice_id = v_inv;
  if n <> 0 then raise exception 'La verifica ha lasciato % movimenti.', n; end if;
  select count(*) into n from tag_anticipazioni where etichetta = '__Prova B1 tag__';
  if n <> 0 then raise exception 'La verifica ha lasciato % tag.', n; end if;
  select count(*) into n from price_history where note = '__PROVA B1 acquisto dopo__';
  if n <> 0 then raise exception 'La verifica ha lasciato % righe di storico prezzi.', n; end if;
  select count(*) into n from deleted_records
   where record_id in (v_mov::text, v_movr::text, v_entrata::text, v_inv::text)
      or (table_name = 'intercompany_cessions' and record->>'product_description' like '\_\_Prova B1%');
  if n <> 0 then raise exception 'La verifica ha lasciato % righe nel registro delle cancellazioni.', n; end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Blocco 1: un documento che ha generato un effetto o e'' respinto o storna. Nessun terzo caso.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260816000005', 'un_documento_che_ha_generato_un_effetto')
on conflict (version) do nothing;

select
  (select confdeltype from pg_constraint where conname = 'cash_movements_supplier_invoice_id_fkey')          as fk_movimento_fattura,
  (select count(*) from pg_trigger where tgname = 'trg_movimento_con_documento' and not tgisinternal)        as trigger_movimenti,
  (select count(*) from intercompany_cessions where price_history_id is not null)                            as cessioni_con_filo,
  (select count(*) from cash_movements where supplier_invoice_id is not null)                                as uscite_da_fattura;
