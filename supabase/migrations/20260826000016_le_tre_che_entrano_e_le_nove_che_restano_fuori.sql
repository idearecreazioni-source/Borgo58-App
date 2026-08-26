-- ============================================================================
-- LE TRE CHE ENTRANO, E LE NOVE CHE RESTANO FUORI — 26/08/2026
-- ============================================================================
--
-- Alessio ha guardato le ventitre tabelle lasciate aperte dalla
-- `20260826000011` e ne ha decise dodici. Questa migrazione scrive le sue
-- decisioni e attacca il registro dove ha detto di attaccarlo.
--
-- ⚠️ NON DECIDE NIENTE DA SE'. Le undici rimaste restano vuote, e il
--    guardiano continua a elencarle: e' lo stato che il mandato chiede.
--
-- ----------------------------------------------------------------------------
-- LE TRE CHE ENTRANO
-- ----------------------------------------------------------------------------
--   · `orders`               — il conto del tavolo. Le sue righe e i suoi
--                              pagamenti erano dentro dall'08/08 e la
--                              testata no: e' quella che porta il
--                              riferimento allo scontrino emesso
--                              (`documento_fiscale`, `documento_numero`,
--                              `documento_emesso_il`), il prezzo del
--                              coperto fotografato e il mezzo di pagamento.
--   · `stock_consumptions`   — gli scarichi, con `costo` fotografato dai
--                              lotti: e' il food cost reale, che fra sei
--                              mesi non si ricostruisce.
--   · `rettifiche_giacenza`  — chi ha dichiarato quanto c'era davvero, coi
--                              tre numeri e il `valore` in euro.
--
-- 🔴 QUESTO ROVESCIA UNA RIGA CHE ERA SCRITTA DALL'08/08/2026. Vedi la
--    sezione in fondo: non e' una svista, e' una decisione sua.
--
-- ⚠️ Tutte e tre hanno la colonna `id` — guardata, non dedotta — quindi la
--    lapide nasce col riferimento che serve a ritrovare la riga. E' il
--    controllo che su `reservation_deposits` era fallito.
--
-- ⚠️ SULLA CASCATA, che va considerata prima e non dopo: cancellare un
--    conto porta via le sue righe, i suoi pagamenti e la sua segnalazione
--    fiscale, e tutte e tre sono gia' dentro. Da oggi quel gesto lascia
--    quindi PIU' di una lapide — la testata piu' i figli. Non e' un
--    doppione: sono fatti diversi, e prima mancava proprio quello che li
--    tiene insieme.
--
-- ----------------------------------------------------------------------------
-- LE NOVE CHE RESTANO FUORI, e perche' «fuori» non e' «non deciso»
-- ----------------------------------------------------------------------------
--   · `ordini_fornitore` + `ordini_fornitore_righe`
--   · `spesa_spicciola`
--   · `posta_ricevuta` + `posta_allegati` + `posta_azioni`
--   · `stock_lots` + `produzioni` + `trasformazioni_dichiarate`
--
-- ⚠️ Scriverle `false` invece di lasciarle vuote e' il punto del blocco:
--    **una decisione presa e una domanda aperta non si comportano uguale**,
--    e il guardiano deve poterle distinguere. Una `false` sparisce
--    dall'elenco delle aperte; una vuota resta li' a chiedere.
--
-- 🔴 UNA CORREZIONE ALLA RAGIONE, non alla decisione. Il mandato motiva il
--    «fuori» degli ordini ai fornitori con «nessun importo dentro». Aperte
--    le colonne, la testata non ha davvero nessun importo — ma
--    `ordini_fornitore_righe` ha **`prezzo_atteso`**. La decisione resta
--    quella di Alessio e regge sull'altra sua ragione, che e' quella vera:
--    un prezzo ATTESO e' una previsione scritta quando l'ordine parte, non
--    denaro che si e' mosso, e il documento che dice quanto si e' pagato
--    davvero — la fattura — e' dentro dall'08/08. La riga qui sotto lo dice
--    per intero, cosi' chi vorra' rovesciarla avra' il nome della colonna e
--    non una frase generica.
--
-- ⚠️ E `posta_*` e `stock_lots`/`produzioni`/`trasformazioni_dichiarate`
--    sono esplicitamente **«per ora»**: la ragione lo scrive, perche' un
--    «fuori» definitivo e un «fuori» in attesa di un lavoro sono due cose
--    diverse e fra sei mesi non si distinguerebbero piu'.
--
-- ----------------------------------------------------------------------------
-- COSA NON SI TOCCA, E PERCHE'
-- ----------------------------------------------------------------------------
-- `reservation_deposits` resta VUOTA: la sua classificazione dipende da una
-- misura che non era ancora stata fatta quando il mandato e' stato scritto
-- — se una caparra incassata generi o no un movimento di cassa. Deciderla
-- qui vorrebbe dire rispondere prima di aver guardato.
--
-- Restano vuote anche le altre dieci, `price_history` e
-- `storico_costi_ricetta` comprese: non sono magazzino — sono lo storico
-- dei prezzi d'acquisto e quello dei costi di ricetta — quindi «il resto
-- del magazzino» non le nomina, e attribuirgliele sarebbe decidere al posto
-- suo.
--
-- ----------------------------------------------------------------------------
-- COSA ABBIAMO ROVESCIATO
-- ----------------------------------------------------------------------------
-- · Cosa era stato deciso e quando: l'08/08/2026, costruendo il registro
--   delle cancellazioni, `orders` fu lasciata deliberatamente FUORI. La
--   riga sta scritta negli appunti del progetto: «`orders` NON e' fra
--   queste, e la distinzione conta quando una verifica deve ripulirsi».
-- · La ragione di allora: un conto e' un oggetto che nasce e muore in sala,
--   e le prove ne creano e ne cancellano di continuo — tracciarlo avrebbe
--   riempito di lapidi finte un registro che nessuno puo' ripulire dall'app.
-- · Cosa si decide adesso: `orders` entra nel perimetro.
-- · Perche' la ragione di allora non vale piu': l'08/08 il conto era
--   soltanto una testata con un totale. Da allora si e' preso addosso il
--   riferimento allo scontrino emesso, il prezzo del coperto fotografato e
--   il mezzo di pagamento — cioe' e' diventato **il documento che dice se un
--   incasso e' stato fiscalizzato**. E la comodita' delle prove non e' mai
--   stata un buon criterio per decidere cosa il gestionale conserva: il
--   modo giusto e' che le prove si ripuliscano, non che il registro sia piu'
--   corto.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Le tre che entrano
-- ----------------------------------------------------------------------------
-- ⚠️ `drop ... if exists` prima di ogni `create`: una migrazione si
--    riapplica, e `create trigger` da solo fallisce alla seconda.
drop trigger if exists trg_log_delete on orders;
create trigger trg_log_delete before delete on orders
  for each row execute function log_deleted_record();

drop trigger if exists trg_log_delete on stock_consumptions;
create trigger trg_log_delete before delete on stock_consumptions
  for each row execute function log_deleted_record();

drop trigger if exists trg_log_delete on rettifiche_giacenza;
create trigger trg_log_delete before delete on rettifiche_giacenza
  for each row execute function log_deleted_record();

-- ----------------------------------------------------------------------------
-- 2. Le classificazioni
-- ----------------------------------------------------------------------------
-- ⚠️ Qui si USA `on conflict do update`, al contrario della `…011` che
--    popola con `do nothing`. Non e' un'incoerenza: quella scriveva lo stato
--    di PARTENZA e non doveva ricoprire una scelta gia' fatta a mano;
--    questa scrive **le scelte di Alessio**, e devono vincere sul vuoto che
--    trovano. Le tabelle toccate sono nominate una per una: nessun
--    aggiornamento in blocco.
insert into perimetro_registro (tabella, dentro, ragione) values

-- --- DENTRO per decisione di Alessio del 26/08/2026 -------------------------
('orders', true,
 'Il conto del tavolo. DECISIONE DI ALESSIO DEL 26/08/2026, che rovescia la scelta dell''08/08 di lasciarlo fuori. Porta `documento_fiscale`, `documento_numero` e `documento_emesso_il`: e'' il posto dove si legge se un incasso e'' stato fiscalizzato. Porta anche `coperto_unit_price` fotografato e `payment_method`. Le righe e i pagamenti erano dentro dall''08/08 e la testata che li tiene insieme no.'),
('stock_consumptions', true,
 'Gli scarichi di magazzino, con `costo` fotografato dai lotti: e'' il food cost reale della serata, e fra sei mesi non si ricostruisce. Decisione di Alessio del 26/08/2026.'),
('rettifiche_giacenza', true,
 'Chi ha dichiarato quanto c''era davvero, coi tre numeri fotografati e `valore` in euro. Decisione di Alessio del 26/08/2026.'),

-- --- FUORI per decisione di Alessio del 26/08/2026 --------------------------
('ordini_fornitore', false,
 'Un ordine mandato a un fornitore. FUORI per decisione di Alessio del 26/08/2026: la testata non ha nessuna colonna di importo — guardata, non dedotta — e il documento che dice quanto si e'' pagato davvero e'' la fattura, dentro dall''08/08.'),
('ordini_fornitore_righe', false,
 '⚠️ Le righe di un ordine. FUORI con la testata, per decisione di Alessio del 26/08/2026 — ma la ragione va detta giusta: qui UN IMPORTO C''E'', si chiama `prezzo_atteso`. E'' un prezzo ATTESO, cioe'' una previsione scritta quando l''ordine parte, non denaro che si e'' mosso: quanto si e'' pagato lo dice la fattura, che e'' tracciata. Se un giorno quella colonna smettesse di essere una previsione, questa riga va rovesciata.'),
('spesa_spicciola', false,
 'La lista di cosa prendere al supermercato. FUORI per decisione di Alessio del 26/08/2026: aperte le colonne — articolo, categoria, nota, nel_carrello, preso_il — non c''e'' NESSUN importo. Non tiene soldi, quindi non e'' nel criterio dell''08/08.'),
('posta_ricevuta', false,
 '⚠️ FUORI PER ORA, non per sempre: decisione di Alessio del 26/08/2026, da riguardare quando la posta sara'' davvero collegata all''archivio. Da tenere presente quel giorno: la tabella ha `proposta_importo`, che e'' un importo LETTO dall''assistente da una mail e non un movimento; e dentro ci sono messaggi di persone, quindi la privacy tira dalla parte opposta al registro.'),
('posta_allegati', false,
 'Gli allegati della posta. FUORI PER ORA con `posta_ricevuta`, stessa decisione del 26/08/2026 e stessa scadenza.'),
('posta_azioni', false,
 'Cosa l''assistente propone di fare con una mail. FUORI PER ORA con `posta_ricevuta`, stessa decisione del 26/08/2026 e stessa scadenza.'),
('stock_lots', false,
 '⚠️ Le partite in magazzino, col loro costo e la tracciabilita'' HACCP. FUORI PER ORA per decisione di Alessio del 26/08/2026 — «scarichi e rettifiche dentro, il resto del magazzino fuori per ora». Da tenere presente il giorno che si riguarda: un lotto cancellato porta via il numero di lotto del fornitore, che e'' cio'' che serve in un richiamo merce.'),
('produzioni', false,
 'Ogni semilavorato fatto in cucina, col costo congelato del giorno. FUORI PER ORA, stessa decisione del 26/08/2026 sul resto del magazzino.'),
('trasformazioni_dichiarate', false,
 'Una partita trasformata e non ancora registrata come produzione. FUORI PER ORA, stessa decisione del 26/08/2026 sul resto del magazzino.')

on conflict (tabella) do update
  set dentro = excluded.dentro,
      ragione = excluded.ragione,
      classificata_il = now();

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- 🔴 SI GIUDICA DAI FALLIMENTI, E I FALLIMENTI SONO DUE, NON UNO:
--    (a) su ognuna delle tre che entrano la lapide DEVE esserci **e avere
--        il riferimento**: contare che il numero sia salito non basta — la
--        lapide senza `record_id` e' precisamente il difetto che ha tenuto
--        fuori le caparre;
--    (b) su una delle decise FUORI la lapide NON deve comparire — senza
--        questo controllo un trigger finito addosso a tutto passerebbe
--        inosservato, perche' il primo controllo sarebbe verde lo stesso.
--
-- ⚠️ Il perimetro della verifica e' fatto di roba che la verifica ha creato
--    — ingrediente compreso — e gli identificativi stanno in un ARRAY, mai
--    in una variabile riusata.
--
-- ⚠️ E le lapidi che questa verifica produce se le porta via lei: il
--    registro non si puo' ripulire dall'app, e tre righe finte li' dentro
--    sarebbero dati di prova in mezzo ai dati veri.
do $verifica$
declare
  v_foto   jsonb;
  v_ent    uuid;
  v_ingr   uuid;
  v_ord    uuid;
  v_scar   uuid;
  v_rett   uuid;
  v_spesa  uuid;
  v_lap0   integer;
  v_lap1   integer;
  v_lap2   integer;
  v_miei   uuid[] := '{}';
  v_rif    text;
  v_n      integer;
begin
  v_foto := foto_righe();

  select id into v_ent from entities where entity_type = 'srls' limit 1;
  if v_ent is null then
    raise exception 'Non c''e'' la S.r.l.s.: questa verifica non puo'' girare.';
  end if;

  -- ------------------------------------------------------------------
  -- (0) Il perimetro deve tornare gia' adesso.
  -- ------------------------------------------------------------------
  select count(*) into v_n from perimetro_da_sistemare();
  if v_n > 0 then
    raise exception 'Il perimetro non torna su % voci: %', v_n,
      (select string_agg(tabella || ' (' || problema || ')', ' · ') from perimetro_da_sistemare());
  end if;

  -- ------------------------------------------------------------------
  -- (1) Roba propria, creata adesso e segnata in un elenco.
  -- ------------------------------------------------------------------
  insert into ingredients (entity_id, name, category, unit)
  values (v_ent, 'VERIFICA perimetro 26/08', 'altro', 'kg')
  returning id into v_ingr;
  v_miei := v_miei || v_ingr;

  insert into orders (entity_id, table_label, coperti, documento_fiscale, documento_numero, documento_emesso_il)
  values (v_ent, '__VERIFICA__ perimetro', 2, 'scontrino', '1-0001', current_date)
  returning id into v_ord;

  insert into stock_consumptions (ingredient_id, quantity, reason, costo, note)
  values (v_ingr, 1.5, 'spreco', 4.20, 'VERIFICA perimetro 26/08')
  returning id into v_scar;

  insert into rettifiche_giacenza (ingredient_id, atteso, dichiarato, differenza, valore, note)
  values (v_ingr, 10, 8, -2, -5.60, 'VERIFICA perimetro 26/08')
  returning id into v_rett;

  insert into spesa_spicciola (articolo, categoria, nota)
  values ('VERIFICA perimetro 26/08', 'altro', 'la decisa FUORI')
  returning id into v_spesa;

  select count(*) into v_lap0 from deleted_records;

  -- ------------------------------------------------------------------
  -- (2) LE TRE CHE ENTRANO: lapide presente E col riferimento.
  -- ------------------------------------------------------------------
  delete from orders where id = v_ord;
  select record_id into v_rif from deleted_records
   where table_name = 'orders' and record_id = v_ord::text;
  if v_rif is null then
    raise exception 'Cancellato un conto e la sua lapide non c''e'' (o e'' senza riferimento).';
  end if;
  if (select record ->> 'documento_numero' from deleted_records
       where record_id = v_ord::text) is distinct from '1-0001' then
    raise exception 'La lapide del conto non conserva il numero del documento fiscale.';
  end if;

  delete from stock_consumptions where id = v_scar;
  if not exists (select 1 from deleted_records
                  where table_name = 'stock_consumptions' and record_id = v_scar::text) then
    raise exception 'Cancellato uno scarico e la sua lapide non c''e'' (o e'' senza riferimento).';
  end if;
  if (select (record ->> 'costo')::numeric from deleted_records
       where record_id = v_scar::text) is distinct from 4.20 then
    raise exception 'La lapide dello scarico non conserva il costo fotografato.';
  end if;

  delete from rettifiche_giacenza where id = v_rett;
  if not exists (select 1 from deleted_records
                  where table_name = 'rettifiche_giacenza' and record_id = v_rett::text) then
    raise exception 'Cancellata una rettifica di giacenza e la sua lapide non c''e'' (o e'' senza riferimento).';
  end if;
  if (select (record ->> 'valore')::numeric from deleted_records
       where record_id = v_rett::text) is distinct from -5.60 then
    raise exception 'La lapide della rettifica non conserva il valore in euro.';
  end if;

  select count(*) into v_lap1 from deleted_records;
  if v_lap1 <> v_lap0 + 3 then
    raise exception 'Tre cancellazioni e % lapidi invece di 3 (da % a %).',
      v_lap1 - v_lap0, v_lap0, v_lap1;
  end if;
  raise notice 'le tre che entrano: lapidi % -> %, tutte col riferimento', v_lap0, v_lap1;

  -- ------------------------------------------------------------------
  -- (3) LA DECISA FUORI: la lapide NON deve comparire.
  --     Senza questo, un trigger finito addosso a tutto passerebbe.
  -- ------------------------------------------------------------------
  delete from spesa_spicciola where id = v_spesa;
  select count(*) into v_lap2 from deleted_records;
  if v_lap2 <> v_lap1 then
    raise exception 'Cancellata una riga di `spesa_spicciola`, che e'' decisa FUORI, e il registro l''ha scritta lo stesso (% -> %).',
      v_lap1, v_lap2;
  end if;
  raise notice 'spesa_spicciola resta fuori: lapidi % prima, % dopo', v_lap1, v_lap2;

  -- ------------------------------------------------------------------
  -- (4) Le classificazioni sono quelle scritte, e le caparre no.
  -- ------------------------------------------------------------------
  if exists (select 1 from perimetro_registro
              where tabella in ('orders','stock_consumptions','rettifiche_giacenza')
                and dentro is distinct from true) then
    raise exception 'Una delle tre che entrano non risulta classificata dentro.';
  end if;
  if exists (select 1 from perimetro_registro
              where tabella in ('ordini_fornitore','ordini_fornitore_righe','spesa_spicciola',
                                'posta_ricevuta','posta_allegati','posta_azioni',
                                'stock_lots','produzioni','trasformazioni_dichiarate')
                and dentro is distinct from false) then
    raise exception 'Una delle nove decise FUORI non risulta classificata fuori.';
  end if;
  if (select dentro from perimetro_registro where tabella = 'reservation_deposits') is not null then
    raise exception 'Le caparre sono state decise da questa migrazione, e non dovevano esserlo.';
  end if;

  select count(*) into v_n from perimetro_da_decidere();
  raise notice 'restano da decidere: % tabelle', v_n;

  -- ------------------------------------------------------------------
  -- (5) Il perimetro torna anche dopo.
  -- ------------------------------------------------------------------
  select count(*) into v_n from perimetro_da_sistemare();
  if v_n > 0 then
    raise exception 'Dopo le classificazioni il perimetro non torna su % voci: %', v_n,
      (select string_agg(tabella || ' (' || problema || ')', ' · ') from perimetro_da_sistemare());
  end if;

  -- ------------------------------------------------------------------
  -- (6) Pulizia: prima le tre lapidi finte, poi la roba propria.
  -- ------------------------------------------------------------------
  delete from deleted_records
   where record_id in (v_ord::text, v_scar::text, v_rett::text);
  select count(*) into v_lap2 from deleted_records;
  if v_lap2 <> v_lap0 then
    raise exception 'Le lapidi di questa verifica non sono state tolte tutte (% invece di %).',
      v_lap2, v_lap0;
  end if;

  delete from ingredients where id = any(v_miei);

  perform pretendi_nessun_residuo(v_foto, 'la verifica delle tre che entrano');
  raise notice 'verifica: nessun residuo, lapidi tornate a %', v_lap0;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260826000016', 'le_tre_che_entrano_e_le_nove_che_restano_fuori')
on conflict (version) do nothing;
