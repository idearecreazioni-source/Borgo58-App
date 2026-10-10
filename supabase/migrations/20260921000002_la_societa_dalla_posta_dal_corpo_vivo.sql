-- =====================================================================
-- IL DOCUMENTO DALLA POSTA TIENE LA SUA SOCIETA' — dal corpo VIVO
-- 21/09/2026 — sostituisce `20260921000001`
-- =====================================================================
--
-- 🔴 PERCHE' ESISTE QUESTA E NON BASTAVA LA PRECEDENTE. La `20260921000001`
-- fa la stessa identica cosa — passare la societa' a `create_document` — ma
-- il corpo della funzione l'aveva preso dall'ULTIMA MIGRAZIONE DEL
-- REPOSITORY che sembrava definirla, `20260813000003`. Sembrava: la ricerca
-- che ha prodotto quella conclusione cercava `create or replace function
-- esegui_azione_posta`, e quando una funzione si riprende dal database
-- Postgres la riscrive **col nome dello schema** —
-- `CREATE OR REPLACE FUNCTION public.esegui_azione_posta(...)`. Le due
-- ridefinizioni vere piu' recenti, `20260819000002` e `20260827000027`, sono
-- scritte cosi' e quella ricerca non poteva vederle.
--
-- 🔴 A PRENDERLO NON E' STATO NESSUN RAGIONAMENTO: E' STATA LA RETE.
-- `rete-guardie` (`scripts/guardie.mjs`) confronta col corpo VIVO invece che
-- col file, e applicando la `…0001` sul progetto di prova si e' fermata
-- nominando quattro cose che si sarebbero perse:
--
--     · il messaggio «Questo carico non dice da chi arriva la merce…»
--     · le parole `ingredients`, `category`, `riga_lista`
--     · la chiamata a `valore_del_vocabolario`
--
-- Niente e' stato applicato: la rete si ferma PRIMA di toccare il database.
-- ⚠️ E' la quinta volta che questo progetto incontra la stessa famiglia, e la
-- prima in cui il guardiano l'ha presa da solo invece che qualcuno a valle.
--
-- ---------------------------------------------------------------------
-- DA DOVE VIENE IL CORPO DI QUESTA
-- ---------------------------------------------------------------------
-- Dal corpo VIVO su Borgo58-Prova, letto con
-- `npm run funzione:viva -- esegui_azione_posta --prova`, e incollato qui
-- **senza toccare una riga** tranne quella che segue. Le quattro cose
-- nominate qui sopra ci sono tutte, e ci sono perche' non sono mai state
-- tolte — non perche' siano state rimesse a mano.
--
-- ⚠️ LA VECCHIA NON SI RISCRIVE E NON SI CANCELLA (regola del 23/08): quel
-- file racconta cosa e' stato tentato quel giorno, e correggerlo lo
-- renderebbe una bugia per chi ricostruisse da zero fra un anno. Si dichiara
-- SUPERATA in fondo a questa, col meccanismo gia' usato dalla
-- `20260825000012`: la sua versione si registra **solo dopo** che i controlli
-- di questa sono passati.
--
-- ---------------------------------------------------------------------
-- COSA CAMBIA, ED E' UNA RIGA
-- ---------------------------------------------------------------------
-- `create_document` riceve `p_entity_id => nullif(v_par->>'societa', '')`.
-- La societa' arriva dai parametri dell'azione, cioe' **da chi conferma**: la
-- schermata della Posta ha il campo «Societa'» dalla proposta #119, con le
-- stesse due voci dell'Archivio a mano.
--
-- ⚠️ RESTA FACOLTATIVA, e non e' una mancanza: il modello che legge la mail
-- non puo' sapere di chi sia una fattura, e un documento intestato alla
-- societa' sbagliata e' peggio di uno senza societa', perche' sembra a posto.
-- Senza risposta il documento nasce senza societa' esattamente come prima.
--
-- ⚠️ NESSUNA SANATORIA: i documenti gia' scritti non si toccano.
--
-- ---------------------------------------------------------------------
-- ⚠️ PERCHE' QUI NON CI SONO `revoke` E `grant`
-- ---------------------------------------------------------------------
-- Perche' `create or replace function` **conserva** proprietario e permessi:
-- non li azzera, come farebbe un `drop` seguito da un `create`. Riscriverli
-- qui vorrebbe dire dichiarare a memoria dei permessi che non ho letto — ed
-- e' esattamente la trappola del 24/08, quando un `grant` ricopiato dal
-- modello di una funzione vicina ha aperto su `fabbisogno_conto` una porta
-- che prima non c'era. Quello che c'e' resta.
--
-- ⚠️ QUESTA MIGRAZIONE NON E' STATA APPLICATA DA NESSUNA PARTE — ne' alla
-- prova ne' alla produzione — perche' il mandato che l'ha prodotta lo vieta.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La funzione, dal corpo vivo, con la sola riga aggiunta
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.esegui_azione_posta(p_azione_id uuid, p_parametri jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_azione   posta_azioni%rowtype;
  v_par      jsonb;
  v_allegato posta_allegati%rowtype;
  v_posta    posta_ricevuta%rowtype;
  v_doc      uuid;
  v_task     uuid;
  v_riga     jsonb;
  v_elenco   text := '';
  n_aperte   integer;
  v_forn     uuid;
  v_ingr     uuid;
  v_qta      numeric;
  v_lotti    integer := 0;
  v_haccp    integer := 0;
  v_saltate  integer := 0;
  v_creati   integer := 0;
  v_nota     text;
  v_esito    jsonb;
  v_nuovo    jsonb;
  v_ente     uuid;
  v_fatt     numeric;
  v_prezzo   numeric;
  v_chiave   text;
  v_art      uuid;
  v_var      record;
  v_trovato  record;
  v_rincari  jsonb := '[]'::jsonb;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' decidere sulla posta';
  end if;

  select * into v_azione from posta_azioni where id = p_azione_id for update;
  if not found then
    raise exception 'Questa proposta non esiste piu''';
  end if;

  if v_azione.stato = 'fatta' then
    return jsonb_build_object('gia_fatta', true,
      'documento_id', v_azione.documento_id, 'task_id', v_azione.task_id);
  end if;

  v_par := coalesce(p_parametri, v_azione.parametri);
  select * into v_posta from posta_ricevuta where id = v_azione.posta_id;

  if v_azione.tipo in ('archivia_documento', 'archivia_testo') then
    if v_azione.tipo = 'archivia_documento' then
      select * into v_allegato from posta_allegati
       where id = nullif(v_par->>'allegato_id', '')::uuid;
    end if;

    v_doc := create_document(
      p_title          => coalesce(nullif(v_par->>'titolo', ''), v_azione.titolo),
      -- 🔴 LA SOCIETA' ARRIVA DA CHI CONFERMA, e resta vuota se nessuno
      --    l'ha detta. Prima questa riga non c'era: ogni documento nato da
      --    una mail restava senza societa', e nelle Fatture i documenti
      --    collegabili sono quelli della stessa societa' della fattura —
      --    quindi non compariva mai, senza nessun errore.
      --    ⚠️ Non si indovina: niente prima entita' trovata, niente S.r.l.s.
      --    per comodita'. Un documento intestato alla societa' sbagliata e'
      --    peggio di uno senza societa', perche' sembra a posto.
      p_entity_id      => nullif(v_par->>'societa', '')::uuid,
      p_doc_type       => nullif(v_par->>'tipo', ''),
      p_document_date  => nullif(v_par->>'data', '')::date,
      p_counterparties => nullif(v_par->>'controparte', ''),
      p_amount         => nullif(v_par->>'importo', '')::numeric,
      p_expiry_date    => nullif(v_par->>'scadenza', '')::date,
      p_note           => nullif(v_par->>'note', ''),
      p_storage_path   => v_allegato.storage_path,
      p_file_name      => v_allegato.file_name
    );

    update documents
       set testo = coalesce(nullif(v_par->>'contenuto', ''), v_posta.testo)
     where id = v_doc;

  elsif v_azione.tipo = 'promemoria' then
    insert into tasks (title, description, due_date, category, origine_modulo)
    values (coalesce(nullif(v_par->>'titolo', ''), v_azione.titolo),
            nullif(v_par->>'note', ''), nullif(v_par->>'data', '')::date,
            'amministrativo', 'posta')
    returning id into v_task;

  elsif v_azione.tipo = 'promemoria_multipli' then
    for v_riga in select * from jsonb_array_elements(coalesce(v_par->'scadenze', '[]'::jsonb))
    loop
      if nullif(v_riga->>'data', '') is not null then
        insert into tasks (title, description, due_date, category, origine_modulo)
        values (coalesce(nullif(v_riga->>'titolo', ''), v_azione.titolo),
                nullif(v_riga->>'note', ''), (v_riga->>'data')::date,
                'amministrativo', 'posta')
        returning id into v_task;
      end if;
    end loop;

  elsif v_azione.tipo = 'carico_magazzino' then
    v_forn := nullif(v_par->>'fornitore_id', '')::uuid;
    v_nota := nullif(v_par->>'documento', '');

    -- UN CARICO SENZA FORNITORE NON ENTRA (28/08/2026).
    -- Misurato: la stessa dicitura, una volta senza fornitore e una con,
    -- produce DUE righe in articoli_fornitore — l'indice unico ha per
    -- chiave (fornitore, dicitura). Quindi la memoria costruita adesso
    -- non si ricongiunge mai con quella vera, lo storico prezzi si
    -- spacca in due, e la sorveglianza dei rincari resta MUTA su quei
    -- prodotti: nessun errore, solo un allarme che non suona.
    -- E gli ingredienti nuovi finirebbero intestati alla PRIMA societa
    -- trovata, che e' il vincolo portante del progetto.
    -- Si rifiuta DOVE NASCE il problema, e il messaggio dice cosa fare.
    if v_forn is null then
      raise exception 'Questo carico non dice da chi arriva la merce. Scegli il fornitore, o creane uno nuovo, e riprova: senza, il gestionale non saprebbe piu'' riconoscere gli stessi prodotti la prossima volta e smetterebbe di avvisarti sui rincari.';
    end if;

    for v_riga in select * from jsonb_array_elements(coalesce(v_par->'righe', '[]'::jsonb))
    loop
      v_chiave := chiave_articolo(v_riga->>'descrizione');

      if coalesce((v_riga->>'ignora')::boolean, false) then
        if v_chiave is not null then
          insert into articoli_fornitore (supplier_id, descrizione, chiave, ingredient_id, ignora)
          values (v_forn, v_riga->>'descrizione', v_chiave, null, true)
          on conflict (coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid), chiave)
          do update set ingredient_id = null, ignora = true, aggiornato_il = now();
        end if;
        v_saltate := v_saltate + 1;
        continue;
      end if;

      v_ingr := nullif(v_riga->>'ingrediente_id', '')::uuid;
      v_qta  := nullif(v_riga->>'quantita', '')::numeric;
      v_nuovo := v_riga->'nuovo_ingrediente';

      if v_ingr is null
         and v_nuovo is not null
         and nullif(v_nuovo->>'nome', '') is not null
         and not coalesce((v_riga->>'salta')::boolean, false) then
        select entity_id into v_ente from suppliers where id = v_forn;
        if v_ente is null then
          select id into v_ente from entities order by created_at limit 1;
        end if;
        if v_ente is null then
          raise exception 'Non esiste nessuna entita'' a cui intestare l''ingrediente nuovo';
        end if;

        -- ⚠️ Non `insert` diretto: se un ingrediente con quel nome c'e'
        -- gia', ci si aggancia. La schermata dovrebbe averlo gia' evitato,
        -- ma un difetto che produce dati sbagliati che SEMBRANO giusti
        -- merita due difese.
        select * into v_trovato from trova_o_crea_ingrediente(
          v_ente,
          v_nuovo->>'nome',
          coalesce(nullif(v_nuovo->>'unita', '')::unit_type, 'kg'),
          -- ⚠️ Il catalogo al posto del cast all'enum (27/08/2026).
          coalesce(valore_del_vocabolario('ingredients', 'category',
                                          nullif(v_nuovo->>'categoria', '')), 'altro'),
          coalesce((v_nuovo->>'alimentare')::boolean, true)
        );
        v_ingr := v_trovato.id;
        if not v_trovato.era_gia_li then
          v_creati := v_creati + 1;
        end if;
      end if;

      if coalesce((v_riga->>'salta')::boolean, false)
         or v_ingr is null or v_qta is null or v_qta <= 0 then
        v_saltate := v_saltate + 1;
        continue;
      end if;

      v_fatt := coalesce(nullif(v_riga->>'fattore', '')::numeric, 1);
      if v_fatt is null or v_fatt <= 0 then v_fatt := 1; end if;
      v_prezzo := nullif(v_riga->>'costo_unitario', '')::numeric;
      if v_prezzo is not null then v_prezzo := v_prezzo / v_fatt; end if;

      v_art := null;
      if coalesce((v_riga->>'ricorda')::boolean, true) and v_chiave is not null then
        insert into articoli_fornitore (
          supplier_id, descrizione, chiave, ingredient_id, unita_fattura, fattore, ignora
        )
        values (
          v_forn, v_riga->>'descrizione', v_chiave, v_ingr,
          nullif(v_riga->>'unita_fattura', ''), v_fatt, false
        )
        on conflict (coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid), chiave)
        do update set ingredient_id = excluded.ingredient_id,
                      unita_fattura = excluded.unita_fattura,
                      fattore       = excluded.fattore,
                      ignora        = false,
                      aggiornato_il = now()
        returning id into v_art;
      end if;

      if v_prezzo is not null and v_art is not null then
        select * into v_var from variazione_prezzo(v_art, v_prezzo);
        if found and v_var.da_segnalare then
          v_rincari := v_rincari || jsonb_build_array(jsonb_build_object(
            'ingrediente',       (select name from ingredients where id = v_ingr),
            'versione',          v_riga->>'descrizione',
            'prima',             v_var.prezzo_precedente,
            'adesso',            round(v_prezzo, 4),
            'variazione',        v_var.variazione,
            'primo',             v_var.prezzo_primo,
            'variazione_totale', v_var.variazione_totale));
        end if;
      end if;

      perform register_stock_delivery(
        p_ingredient_id         => v_ingr,
        p_quantity              => v_qta * v_fatt,
        p_supplier_id           => v_forn,
        p_expiry_date           => nullif(v_riga->>'scadenza', '')::date,
        p_note                  => v_nota,
        p_unit_cost             => v_prezzo,
        p_supplier_batch_number => nullif(v_riga->>'lotto', ''),
        -- ⚠️ SU QUALE RIGA DELLA LISTA DELLA SPESA va questo arrivo. Vuoto
        -- = la piu' vecchia aperta, che e' il predefinito; la schermata
        -- lo dice e lo fa cambiare PRIMA di confermare (Alessio, 19/08).
        p_riga_lista            => nullif(v_riga->>'riga_lista', '')::uuid
      );
      v_lotti := v_lotti + 1;

      if v_prezzo is not null then
        perform update_ingredient_price(v_ingr, v_prezzo, 'fattura', v_nota, v_forn, v_art);
      end if;

      if (v_par->>'registra_haccp')::boolean is true then
        insert into haccp_goods_receiving (
          supplier_id, product_description, temperature_c,
          packaging_ok, conformity, note
        )
        values (
          v_forn,
          coalesce(nullif(v_riga->>'descrizione', ''),
                   (select name from ingredients where id = v_ingr)),
          nullif(v_par->>'temperatura', '')::numeric,
          coalesce((v_par->>'imballo_integro')::boolean, true),
          coalesce((v_par->>'conformita')::boolean, true),
          nullif(concat_ws(' — ', v_nota, nullif(v_riga->>'lotto', '')), '')
        );
        v_haccp := v_haccp + 1;
      end if;
    end loop;

    if v_lotti = 0 then
      raise exception 'Nessuna riga da caricare: scegli almeno un ingrediente e una quantità';
    end if;

    for v_riga in select * from jsonb_array_elements(v_rincari)
    loop
      perform segnala_allarme(
        tipo_allarme_rincaro((v_riga->>'ingrediente'),
                             (v_riga->>'versione'),
                             (v_riga->>'adesso')::numeric),
        messaggio_rincaro(v_riga, v_nota),
        v_riga,
        'rincaro'
      );
    end loop;

    v_esito := jsonb_build_object('lotti', v_lotti, 'haccp', v_haccp,
                                  'saltate', v_saltate, 'creati', v_creati,
                                  'rincari', v_rincari);

  elsif v_azione.tipo = 'da_fare_a_mano' then
    for v_riga in select * from jsonb_array_elements(coalesce(v_par->'passi', '[]'::jsonb))
    loop
      v_elenco := v_elenco || '· ' || coalesce(v_riga #>> '{}', '') || E'\n';
    end loop;

    insert into tasks (title, description, due_date, category, origine_modulo)
    values (coalesce(nullif(v_par->>'titolo', ''), v_azione.titolo),
            nullif(coalesce(nullif(v_elenco, ''), nullif(v_par->>'note', '')), ''),
            nullif(v_par->>'data', '')::date,
            'amministrativo', 'posta')
    returning id into v_task;

  elsif v_azione.tipo = 'nessuna' then
    null;
  end if;

  update posta_azioni
     set stato = 'fatta', decisa_il = now(),
         parametri = v_par, documento_id = v_doc, task_id = v_task
   where id = p_azione_id;

  select count(*) into n_aperte
    from posta_azioni where posta_id = v_azione.posta_id and stato = 'proposta';
  if n_aperte = 0 then
    update posta_ricevuta
       set stato = case
             when exists (select 1 from posta_azioni
                           where posta_id = v_azione.posta_id
                             and stato = 'fatta' and tipo <> 'nessuna')
             then 'archiviata'::stato_posta else 'scartata'::stato_posta end,
           documento_id = coalesce(documento_id, v_doc)
     where id = v_azione.posta_id;
  end if;

  return coalesce(v_esito, '{}'::jsonb)
         || jsonb_build_object('documento_id', v_doc, 'task_id', v_task);
end
$function$;

-- ---------------------------------------------------------------------
-- 2. Verifica — in una sotto-transazione che viene ANNULLATA
-- ---------------------------------------------------------------------
-- ⚠️ `documents` e `posta_ricevuta` sono tabelle vere: una verifica che ci
--    scrivesse e poi cancellasse lascerebbe righe nel registro delle
--    cancellazioni, che nessuno puo' ripulire dall'app. Quindi tutto quello
--    che segue vive dentro un blocco che si chiude con un'eccezione
--    apposta: niente resta scritto. Stessa forma della verifica della tasca
--    (30/08), e come la `20260825000012` si conta il registro prima e dopo
--    invece di sperarlo.
--
-- ⚠️ E si impersona il titolare: una migrazione gira come proprietaria del
--    database, dove `is_titolare()` e' FALSO — la funzione rifiuterebbe.
do $verifica$
declare
  v_srls   uuid;
  v_tit    uuid;
  v_posta  uuid;
  v_az1    uuid;
  v_az2    uuid;
  v_doc    uuid;
  v_ente   uuid;
  v_sez    text;
  v_pre    integer;
  v_post   integer;
  v_docs   integer;
  v_docs2  integer;
begin
  select id into v_srls from entities where entity_type = 'srls';
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_srls is null or v_tit is null then
    raise exception 'Manca la societa'' o il titolare: impossibile verificare.';
  end if;

  select codice into v_sez from sezioni_archivio where attiva order by ordine limit 1;
  if v_sez is null then
    raise exception 'Serve almeno una sezione dell''archivio accesa per provare l''archiviazione.';
  end if;

  select count(*) into v_pre  from deleted_records;
  select count(*) into v_docs from documents;

  begin  -- <<< la sotto-transazione che verra' annullata

    insert into posta_ricevuta (messaggio_id, casella, oggetto, testo, stato)
    values ('zz-verifica-societa-20260921000002', 'zz@verifica', 'ZZ verifica', 'ZZ corpo', 'proposta')
    returning id into v_posta;

    -- (1) CON LA SOCIETA' DICHIARATA, il documento la conserva.
    insert into posta_azioni (posta_id, tipo, titolo, descrizione, parametri, stato)
    values (v_posta, 'archivia_testo', 'ZZ con societa', 'ZZ',
            jsonb_build_object('tipo', v_sez, 'data', current_date::text,
                               'societa', v_srls::text),
            'proposta')
    returning id into v_az1;

    perform set_config('request.jwt.claims',
      json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
    v_doc := (esegui_azione_posta(v_az1, null)->>'documento_id')::uuid;
    perform set_config('request.jwt.claims', null, true);

    if v_doc is null then
      raise exception 'L''azione non ha prodotto nessun documento.';
    end if;
    select entity_id into v_ente from documents where id = v_doc;
    if v_ente is distinct from v_srls then
      raise exception 'Il documento e'' nato con societa'' % invece di %.', v_ente, v_srls;
    end if;

    -- (2) SENZA SOCIETA', il documento nasce senza — e nessuno la inventa.
    insert into posta_azioni (posta_id, tipo, titolo, descrizione, parametri, stato)
    values (v_posta, 'archivia_testo', 'ZZ senza societa', 'ZZ',
            jsonb_build_object('tipo', v_sez, 'data', current_date::text),
            'proposta')
    returning id into v_az2;

    perform set_config('request.jwt.claims',
      json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
    v_doc := (esegui_azione_posta(v_az2, null)->>'documento_id')::uuid;
    perform set_config('request.jwt.claims', null, true);

    select entity_id into v_ente from documents where id = v_doc;
    -- ⚠️ `is not null` e non `<> null`: un confronto con un valore che puo'
    --    essere vuoto non scatta mai, e la verifica approverebbe proprio il
    --    caso che deve prendere (trappola del 27/08).
    if v_ente is not null then
      raise exception 'Senza societa'' dichiarata il documento ne ha presa una: %.', v_ente;
    end if;

    -- (3) UNA STRINGA VUOTA NON E' UNA SOCIETA'. E' il caso che arriva dalla
    --     schermata quando si apre il menu e si torna su «Non lo so».
    update posta_azioni set stato = 'proposta' where id = v_az2;
    update posta_azioni
       set parametri = parametri || jsonb_build_object('societa', '')
     where id = v_az2;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
    v_doc := (esegui_azione_posta(v_az2, null)->>'documento_id')::uuid;
    perform set_config('request.jwt.claims', null, true);
    select entity_id into v_ente from documents where id = v_doc;
    if v_ente is not null then
      raise exception 'Una societa'' vuota e'' stata scambiata per una societa'': %.', v_ente;
    end if;

    -- (4) LE QUATTRO COSE CHE LA `…0001` PERDEVA SONO ANCORA NEL CORPO VIVO.
    --     ⚠️ Si guarda la funzione APPENA SCRITTA, non il file: e' l'unico
    --     modo di dire che questa migrazione non ha ripetuto l'errore che
    --     dichiara di correggere.
    if (select pg_get_functiondef(p.oid)
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'esegui_azione_posta'
           and pg_get_function_identity_arguments(p.oid) = 'uuid, jsonb')
       not like '%Questo carico non dice da chi arriva la merce%' then
      raise exception 'Riscrivendo la funzione si e'' perso il messaggio sul fornitore mancante.';
    end if;
    if (select pg_get_functiondef(p.oid)
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'esegui_azione_posta'
           and pg_get_function_identity_arguments(p.oid) = 'uuid, jsonb')
       not like '%valore_del_vocabolario%' then
      raise exception 'Riscrivendo la funzione si e'' persa la chiamata a valore_del_vocabolario.';
    end if;
    if (select pg_get_functiondef(p.oid)
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'esegui_azione_posta'
           and pg_get_function_identity_arguments(p.oid) = 'uuid, jsonb')
       not like '%riga_lista%' then
      raise exception 'Riscrivendo la funzione si e'' persa la riga della lista della spesa.';
    end if;

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  -- ⚠️ La prova che l'annullamento ha davvero annullato: i documenti sono
  --    quelli di prima e il registro delle cancellazioni non si e' mosso.
  select count(*) into v_post  from deleted_records;
  select count(*) into v_docs2 from documents;
  if v_post <> v_pre then
    raise exception 'La verifica ha lasciato % righe nel registro delle cancellazioni', v_post - v_pre;
  end if;
  if v_docs2 <> v_docs then
    raise exception 'La verifica ha lasciato % documenti', v_docs2 - v_docs;
  end if;

  raise notice 'Verifica passata: la societa'' dichiarata si conserva, quella assente non si inventa, e le parti del corpo vivo sono tutte al loro posto. Niente e'' rimasto scritto.';
end $verifica$;

-- ---------------------------------------------------------------------
-- 3. La vecchia si dichiara SUPERATA, e questa si registra
-- ---------------------------------------------------------------------
-- ⚠️ SOLO ORA, cioe' DOPO che la verifica qui sopra e' passata: se si fosse
--    fermata, queste righe non verrebbero scritte. E' il meccanismo della
--    `20260825000012` — registrare una migrazione il cui controllo non e'
--    stato fatto sarebbe scrivere nel registro una cosa non vera.
--
-- 🔴 COSA VUOL DIRE «SUPERATA», in concreto e in modo controllabile:
--    · `20260921000001` risulta **applicata**, quindi `npm run prova:migra`
--      e `npm run migra` non la propongono piu' fra quelle che mancano —
--      non resta pendente;
--    · e se qualcuno la nominasse esplicitamente, `rete-guardie` la
--      **rifiuta**, perche' il suo corpo perde quattro cose rispetto a
--      quello vivo che questa migrazione ha appena scritto. Le due cose
--      insieme sono la dichiarazione: non e' in coda, e non puo' passare.
--
-- ⚠️ Il suo EFFETTO non viene perso: e' dentro questa, sulla stessa riga —
--    `create_document` riceve la societa'. Registrarla senza averlo fatto
--    sarebbe la bugia che questo blocco evita.
insert into applied_migrations (version, name)
values ('20260921000001', 'il_documento_dalla_posta_tiene_la_societa')
on conflict (version) do nothing;

insert into applied_migrations (version, name)
values ('20260921000002', 'la_societa_dalla_posta_dal_corpo_vivo')
on conflict (version) do nothing;
