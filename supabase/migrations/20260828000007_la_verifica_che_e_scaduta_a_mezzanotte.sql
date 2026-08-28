-- ============================================================================
-- 20260828000007 — la verifica che e' scaduta a mezzanotte
-- ============================================================================
--
-- COSA E' SUCCESSO, misurato il 28/08/2026 sul gestionale vero.
--
-- La migrazione 20260827000018 e' in produzione con TUTTI e tredici i suoi
-- oggetti, e in applied_migrations non c'e'. Il registro diceva 289, il
-- catalogo diceva un'altra cosa, e nessuno dei due lo dichiarava.
--
-- Le due cause, tutt'e due misurate e nessuna dedotta:
--
-- 1. LA VERIFICA DELLA …018 E' SCADUTA. Al passo 4 scrive due lotti con un
--    istante SCRITTO A MANO — il 27 agosto alle 9 del mattino — e li mette a
--    confronto con altri due scritti a now() meno un giorno. Il 27 agosto
--    quell'ora era la piu' recente e la verifica passava. Dalle 9 del mattino
--    del 28 agosto now() meno un giorno la scavalca, e la verifica pretende
--    21,00 dove il gestionale risponde — giustamente — 12,00.
--    ATTENZIONE: NON e' una differenza fra il gestionale vero e il progetto
--    di prova. Lo stesso blocco, lanciato oggi sulla prova, fallisce
--    identico. E' il calendario. E' una DATA diventata falsa da sola, cioe'
--    la stessa famiglia delle frasi diventate false che questo progetto
--    insegue da settimane — stavolta dentro un controllo, dove nessuno la
--    cercava.
--
-- 2. LO STRUMENTO NON POTEVA DIRLO. npm run migra applicava con psql -f e
--    basta: senza --single-transaction psql chiude una transazione per ogni
--    istruzione, quindi le DDL restano committate e la registrazione — che
--    e' l'ULTIMA riga del file — non viene mai raggiunta. Sopra, lo
--    strumento stampava «una migrazione che fallisce non lascia niente a
--    meta'». Corretto oggi in scripts/comune.mjs, in un posto solo per
--    tutt'e quattro i comandi che applicano migrazioni.
--
-- PERCHE' QUESTA MIGRAZIONE ESISTE, invece di correggere la …018.
-- Le migrazioni applicate non si riscrivono: la …018 e' registrata sul
-- progetto di prova dal 27/08, quindi e' applicata. Si fa come la …023 con
-- la …012 e la …032 con la …030: si RIFA' il controllo con roba propria, e
-- si registra cio' che risulta gia' applicato.
--
-- CONSEGUENZA DA RICORDARE, e non e' un dettaglio: la 20260827000018 VA
-- SALTATA PER SEMPRE, anche in una ricostruzione da zero. La sua verifica
-- non tornera' mai piu' vera, perche' la data che contiene non torna piu'.
-- Come la …030 e la …033:
--     npm run migra -- --salta 20260827000018 --conferma
--
-- COSA CONTROLLA QUESTA, e come e' scritta perche' non scada a sua volta:
-- nessun istante assoluto. Gli istanti sono TUTTI relativi a now(), e il
-- pareggio — che e' il punto del progressivo — si costruisce mettendo due
-- lotti sullo STESSO istante preso da una variabile, invece di sperare che
-- una data scritta a mano resti la piu' recente.
-- ============================================================================

do $verifica$
declare
  v_foto     jsonb;
  v_ente     uuid;
  v_ing      uuid;
  v_ing2     uuid;
  v_forn     uuid;
  v_art_a    uuid;
  v_art_b    uuid;
  v_lotto    uuid;
  v_stesso   timestamptz;
  v_miei_ing uuid[] := '{}';
  v_miei_art uuid[] := '{}';
  v_miei_lot uuid[] := '{}';
  v_miei_for uuid[] := '{}';
  v_prezzo   numeric;
  v_da       text;
  v_tit      uuid;
  v_mancanti text[] := '{}';
  v_n        integer;
begin
  v_foto := foto_righe();

  -- ------------------------------------------------------------------
  -- A. E' COMPLETA? I tredici oggetti della …018, chiesti al catalogo.
  --    Non si deduce da «la migrazione e' girata»: si guarda.
  -- ------------------------------------------------------------------
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'articoli_fornitore'
                    and column_name = 'marca')
    then v_mancanti := v_mancanti || 'articoli_fornitore.marca'::text; end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'articoli_fornitore'
                    and column_name = 'nome_esteso')
    then v_mancanti := v_mancanti || 'articoli_fornitore.nome_esteso'::text; end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'articoli_fornitore'
                    and column_name = 'formato')
    then v_mancanti := v_mancanti || 'articoli_fornitore.formato'::text; end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'stock_lots'
                    and column_name = 'articolo_id')
    then v_mancanti := v_mancanti || 'stock_lots.articolo_id'::text; end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'stock_lots'
                    and column_name = 'progressivo' and is_identity = 'YES')
    then v_mancanti := v_mancanti || 'stock_lots.progressivo (che cresce da se)'::text; end if;
  if not exists (select 1 from pg_indexes
                  where schemaname = 'public' and indexname = 'idx_stock_lots_articolo')
    then v_mancanti := v_mancanti || 'idx_stock_lots_articolo'::text; end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'ingredients'
                    and column_name = 'prezzo_da')
    then v_mancanti := v_mancanti || 'ingredients.prezzo_da'::text; end if;
  if not exists (select 1 from pg_constraint where conname = 'ingredients_prezzo_da_check')
    then v_mancanti := v_mancanti || 'ingredients_prezzo_da_check'::text; end if;
  if to_regprocedure('public.prezzo_ultima_versione(uuid)') is null
    then v_mancanti := v_mancanti || 'prezzo_ultima_versione'::text; end if;
  if to_regprocedure('public.rispecchia_prezzo_ingrediente()') is null
    then v_mancanti := v_mancanti || 'rispecchia_prezzo_ingrediente'::text; end if;
  if not exists (select 1 from pg_trigger
                  where tgname = 'trg_rispecchia_prezzo' and not tgisinternal)
    then v_mancanti := v_mancanti || 'trg_rispecchia_prezzo'::text; end if;
  if to_regprocedure('public.andamento_prezzo(uuid,uuid)') is null
    then v_mancanti := v_mancanti || 'andamento_prezzo'::text; end if;
  if to_regprocedure('public.update_ingredient_price(uuid,numeric,price_source,text,uuid,uuid)') is null
    then v_mancanti := v_mancanti || 'update_ingredient_price'::text; end if;

  if array_length(v_mancanti, 1) is not null then
    raise exception 'La 20260827000018 e in produzione solo a meta. Manca: %',
      array_to_string(v_mancanti, ', ');
  end if;

  -- ------------------------------------------------------------------
  -- B. FUNZIONA? Si costruisce tutto, non si prende in prestito niente.
  -- ------------------------------------------------------------------
  select id into v_ente from entities order by created_at limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_ente is null then
    raise exception 'Verifica impossibile: nessuna societa configurata';
  end if;

  insert into suppliers (entity_id, name)
  values (v_ente, 'Fornitore di verifica 20260828000007') returning id into v_forn;
  v_miei_for := v_miei_for || v_forn;

  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'Olio di verifica 20260828000007', 'olio_condimenti', 'l')
  returning id into v_ing;
  v_miei_ing := v_miei_ing || v_ing;

  insert into articoli_fornitore (supplier_id, descrizione, chiave, ingredient_id,
                                  marca, formato, unita_fattura, fattore)
  values (v_forn, 'OLIO EVO LATTINA 5 L 20260828000007',
          'olio evo lattina 5 l 20260828000007', v_ing,
          'Marca di verifica', 'lattina da 5 L', 'lattina', 5)
  returning id into v_art_a;
  v_miei_art := v_miei_art || v_art_a;

  insert into articoli_fornitore (supplier_id, descrizione, chiave, ingredient_id,
                                  marca, formato, unita_fattura, fattore)
  values (v_forn, 'OLIO EVO BOTTIGLIA 1 L 20260828000007',
          'olio evo bottiglia 1 l 20260828000007', v_ing,
          'Marca di nicchia', 'bottiglia da 1 L', 'bottiglia', 1)
  returning id into v_art_b;
  v_miei_art := v_miei_art || v_art_b;

  -- 1. il prezzo a mano DICE di essere a mano
  perform update_ingredient_price(v_ing, 9.80, 'manuale', 'verifica 20260828000007');
  select current_price, prezzo_da into v_prezzo, v_da from ingredients where id = v_ing;
  if v_prezzo <> 9.80 or v_da is distinct from 'a_mano' then
    raise exception 'Il prezzo a mano non si registra come tale: % / %', v_prezzo, v_da;
  end if;

  -- 2. un carico a un prezzo diverso muove il food cost, e lo DICHIARA
  insert into stock_lots (ingredient_id, supplier_id, articolo_id, quantity_received,
                          quantity_remaining, unit_cost, received_at)
  values (v_ing, v_forn, v_art_a, 10, 10, 8.50, now() - interval '2 days')
  returning id into v_lotto;
  v_miei_lot := v_miei_lot || v_lotto;

  select current_price, prezzo_da into v_prezzo, v_da from ingredients where id = v_ing;
  if v_prezzo <> 8.50 or v_da is distinct from 'prodotto' then
    raise exception 'Il carico non ha mosso il prezzo: % / %', v_prezzo, v_da;
  end if;

  -- 3. comanda l ULTIMA ENTRATA: non la media (10,25) e non la minima (8,50)
  insert into stock_lots (ingredient_id, supplier_id, articolo_id, quantity_received,
                          quantity_remaining, unit_cost, received_at)
  values (v_ing, v_forn, v_art_b, 6, 6, 12.00, now() - interval '1 day')
  returning id into v_lotto;
  v_miei_lot := v_miei_lot || v_lotto;

  select current_price into v_prezzo from ingredients where id = v_ing;
  if v_prezzo <> 12.00 then
    raise exception 'Non comanda l ultima versione entrata: % (media 10,25, minima 8,50)', v_prezzo;
  end if;

  -- 4. IL PAREGGIO DI ISTANTE non sceglie a caso.
  --    QUI STAVA IL DIFETTO DELLA …018: l istante era scritto a mano, e il
  --    giorno dopo non era piu il piu recente. Adesso viene da una
  --    variabile, quindi e il piu recente per costruzione — oggi, e fra un
  --    anno. I due lotti hanno lo STESSO istante: a distinguerli resta solo
  --    il progressivo, che e precisamente cio che si prova.
  --    Le risposte sbagliate danno numeri DIVERSI fra loro: 20,00 se
  --    l ordinamento sceglie a caso, 12,00 se il pareggio non e rotto
  --    affatto. Nessuna delle due somiglia a 21,00.
  v_stesso := now();

  insert into stock_lots (ingredient_id, articolo_id, quantity_received,
                          quantity_remaining, unit_cost, received_at)
  values (v_ing, v_art_a, 1, 1, 20.00, v_stesso) returning id into v_lotto;
  v_miei_lot := v_miei_lot || v_lotto;

  insert into stock_lots (ingredient_id, articolo_id, quantity_received,
                          quantity_remaining, unit_cost, received_at)
  values (v_ing, v_art_b, 1, 1, 21.00, v_stesso) returning id into v_lotto;
  v_miei_lot := v_miei_lot || v_lotto;

  select current_price into v_prezzo from ingredients where id = v_ing;
  if v_prezzo <> 21.00 then
    raise exception 'Il pareggio di istante sceglie a caso: % invece di 21,00 (20,00 = ordine casuale, 12,00 = pareggio non rotto)', v_prezzo;
  end if;

  -- 5. un lotto SENZA costo non azzera il prezzo, nemmeno se e l ultimo
  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining,
                          unit_cost, received_at)
  values (v_ing, 3, 3, null, now() + interval '1 minute') returning id into v_lotto;
  v_miei_lot := v_miei_lot || v_lotto;

  select current_price into v_prezzo from ingredients where id = v_ing;
  if v_prezzo <> 21.00 then
    raise exception 'Un lotto senza costo ha spostato il prezzo: %', v_prezzo;
  end if;

  -- 6. senza nessun prezzo non si dice ZERO: si dice VUOTO
  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'Ingrediente muto 20260828000007', 'altro', 'kg')
  returning id into v_ing2;
  v_miei_ing := v_miei_ing || v_ing2;

  if prezzo_ultima_versione(v_ing2) is not null then
    raise exception 'Senza lotti il prezzo dell ultima versione dovrebbe essere vuoto';
  end if;
  select prezzo_da into v_da from ingredients where id = v_ing2;
  if v_da is not null then
    raise exception 'Un ingrediente appena nato dichiara una provenienza del prezzo: %', v_da;
  end if;

  -- 7. senza storico l andamento restituisce ZERO RIGHE, non righe di zeri.
  --    ATTENZIONE: dentro una migrazione is_titolare() e FALSO — si gira
  --    come proprietari del database, non come una persona. Dalla …023 in
  --    poi andamento_prezzo ha un portiere, quindi qui va impersonato un
  --    titolare vero, altrimenti questo controllo misura il portiere invece
  --    della funzione. Trovato provando sul progetto di prova, dove la …023
  --    e gia applicata: in produzione oggi il portiere non c e ancora, e
  --    senza impersonare sarebbe passato qui e fallito domani.
  if v_tit is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
    select count(*) into v_n from andamento_prezzo(v_ing2, null);
    perform set_config('request.jwt.claims', null, true);
    if v_n <> 0 then
      raise exception 'Senza storico l andamento deve restituire zero righe: %', v_n;
    end if;
  end if;

  -- ------------------------------------------------------------------
  -- Si riporta via tutto, per identificativo e mai «la riga piu recente»
  -- ------------------------------------------------------------------
  delete from stock_lots where id = any(v_miei_lot);
  delete from articoli_fornitore where id = any(v_miei_art);
  delete from price_history where ingredient_id = any(v_miei_ing);
  delete from ingredients where id = any(v_miei_ing);
  delete from suppliers where id = any(v_miei_for);
  -- record_id e TESTO, non uuid: il cast e obbligatorio.
  delete from deleted_records
   where record_id = any((v_miei_ing || v_miei_art || v_miei_lot || v_miei_for)::text[]);

  perform pretendi_nessun_residuo(v_foto, 'la verifica scaduta della 20260827000018');

  raise notice 'La 20260827000018 e in produzione per intero e si comporta bene: il prezzo a mano lo dichiara, il carico lo muove, il pareggio di istante lo rompe il progressivo, un lotto senza costo non azzera niente, e senza storico non si inventano zeri.';
end $verifica$;

-- ============================================================================
-- Si registra cio che risulta gia applicato, e poi questa.
-- ============================================================================
insert into applied_migrations (version, name)
values ('20260827000018', 'il_prodotto_e_una_cosa_l_ingrediente_un_altra')
on conflict (version) do nothing;

insert into applied_migrations (version, name)
values ('20260828000007', 'la_verifica_che_e_scaduta_a_mezzanotte')
on conflict (version) do nothing;
