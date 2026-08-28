-- ============================================================================
-- 20260828000009 — la posta dice cosa sta succedendo
-- ============================================================================
--
-- Due cose, e tutt'e due nascono da una schermata APERTA e guardata il
-- 28/08/2026, non da una rilettura.
--
-- 1. UN CARICO SENZA FORNITORE NON ENTRA PIU'.
--    Misurato: la stessa dicitura, scritta una volta senza fornitore e una
--    volta con, produce DUE righe in `articoli_fornitore` — l'indice unico
--    ha per chiave (fornitore, dicitura). Quindi la memoria costruita da un
--    carico senza fornitore NON si ricongiunge mai con quella vera: lo
--    storico prezzi si spacca in due e la sorveglianza dei rincari resta
--    MUTA su quei prodotti. Nessun errore, solo un allarme che non suona.
--    ⚠️ Le conseguenze erano gia' SCRITTE nel commento della schermata da
--       una sessione precedente — scritte, e non impedite: l'opzione
--       «— nessuno —» restava scegliibile e «Conferma» funzionava. Un
--       difetto descritto non e' un difetto chiuso.
--    Si rifiuta DOVE NASCE il problema, dentro la funzione, e non nella
--    schermata: la schermata e' una porta sola, la funzione le copre tutte.
--
-- 2. IL TETTO DEI TENTATIVI DI LETTURA ESCE DAL CODICE.
--    Stava scritto `const MAX_TENTATIVI = 3` dentro la funzione online che
--    legge la posta, e la schermata non aveva modo di saperlo — quindi non
--    poteva distinguere una mail che sta per essere letta da una che non lo
--    sara' MAI PIU'. Da qui la frase falsa che si legge oggi a schermo:
--    «la lettura parte da sola entro un quarto d'ora», su una mail che il
--    lettore ha gia' abbandonato.
--    Adesso il numero vive in `service_settings`, cioe' nel posto dove
--    vivono i parametri che governa Alessio, e lo leggono tutti e due.
--
-- ⚠️ IL CORPO DELLA FUNZIONE E' PRESO DAL DATABASE, non dal file che l'ha
--    creata: fra i due ci stanno tutte le migrazioni che l'hanno toccata.
--    Controllato prima di copiarlo che produzione e prova avessero lo
--    stesso identico corpo (stessa impronta md5).
-- ⚠️ E I PERMESSI NON SI RISCRIVONO A MEMORIA: `create or replace` li
--    CONSERVA, quindi qui sotto non c'e' nessun `grant`. La verifica
--    controlla che siano rimasti quelli di prima
--    (`authenticated` puo' eseguire, e nessun altro).
-- ============================================================================

alter table service_settings
  add column if not exists max_tentativi_lettura_posta integer not null default 3;

do $vincolo$
begin
  if not exists (select 1 from pg_constraint where conname = 'service_settings_tentativi_posta_check') then
    alter table service_settings add constraint service_settings_tentativi_posta_check
      check (max_tentativi_lettura_posta between 1 and 10);
  end if;
end $vincolo$;

comment on constraint service_settings_tentativi_posta_check on service_settings is
  'Quante volte MEMO riprova a leggere una mail prima di fermarsi: almeno una, e non piu'' di dieci. Ogni tentativo si paga, e uno che riprova all''infinito e'' una spesa che cresce da sola.';

comment on column service_settings.max_tentativi_lettura_posta is
  'Dopo quanti tentativi falliti MEMO smette di riprovare a leggere una mail. '
  'Vive qui e non nel codice perche'' lo devono leggere in due: la funzione '
  'online che legge, e la schermata della Posta — che senza non puo'' '
  'distinguere «sta per essere letta» da «non lo sara'' mai piu''», ed e'' da '
  'li'' che nasceva la frase falsa a schermo.';

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
$function$

;

do $verifica$
declare
  v_foto   jsonb;
  v_tit    uuid;
  v_ente   uuid;
  v_forn   uuid;
  v_ing    uuid;
  v_posta  uuid;
  v_az_no  uuid;
  v_az_si  uuid;
  v_msg    text;
  v_ok     boolean := false;
  v_acl    text;
  v_tetto  integer;
begin
  v_foto := foto_righe();

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  if v_tit is null or v_ente is null then
    raise exception 'Verifica impossibile: manca un titolare o una societa';
  end if;

  -- ------------------------------------------------------------------
  -- 1. IL TETTO E' UN PARAMETRO, non un numero nel codice
  -- ------------------------------------------------------------------
  select max_tentativi_lettura_posta into v_tetto from service_settings limit 1;
  if v_tetto is null or v_tetto < 1 then
    raise exception 'Il tetto dei tentativi di lettura non e'' leggibile: %', v_tetto;
  end if;

  -- ------------------------------------------------------------------
  -- Si costruisce tutto, non si prende in prestito niente
  -- ------------------------------------------------------------------
  insert into suppliers (entity_id, name)
  values (v_ente, 'Fornitore di verifica 20260828000009') returning id into v_forn;

  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'Merce di verifica 20260828000009', 'altro', 'kg')
  returning id into v_ing;

  insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, testo, stato)
  values ('verifica-20260828000009', 'info@borgo58.it', 'fatture@verifica.it',
          'Fattura di verifica 20260828000009', 'corpo di verifica', 'proposta')
  returning id into v_posta;

  insert into posta_azioni (posta_id, tipo, titolo, descrizione, perche, parametri, stato)
  values (v_posta, 'carico_magazzino', 'Carico di verifica', 'una riga', 'verifica',
          jsonb_build_object(
            'documento', 'Fattura di verifica',
            'fornitore_id', null,
            'righe', jsonb_build_array(jsonb_build_object(
              'descrizione', 'MERCE DI VERIFICA 20260828000009',
              'ingrediente_id', v_ing, 'quantita', '2', 'fattore', '1',
              'costo_unitario', '10.00', 'ricorda', true))),
          'proposta')
  returning id into v_az_no;

  insert into posta_azioni (posta_id, tipo, titolo, descrizione, perche, parametri, stato)
  values (v_posta, 'carico_magazzino', 'Carico di verifica col fornitore', 'una riga', 'verifica',
          jsonb_build_object(
            'documento', 'Fattura di verifica',
            'fornitore_id', v_forn,
            'righe', jsonb_build_array(jsonb_build_object(
              'descrizione', 'MERCE DI VERIFICA 20260828000009',
              'ingrediente_id', v_ing, 'quantita', '2', 'fattore', '1',
              'costo_unitario', '10.00', 'ricorda', true))),
          'proposta')
  returning id into v_az_si;

  -- Dentro una migrazione is_titolare() e' FALSO: si gira come proprietari
  -- del database, non come una persona. Senza impersonare, questa verifica
  -- misurerebbe il portiere invece della regola.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- ------------------------------------------------------------------
  -- 2. SENZA FORNITORE: si rifiuta, e il messaggio DICE COSA FARE
  -- ------------------------------------------------------------------
  begin
    perform esegui_azione_posta(v_az_no, null);
    raise exception 'Un carico senza fornitore e'' stato accettato';
  exception
    when others then
      v_msg := sqlerrm;
      if v_msg = 'Un carico senza fornitore e'' stato accettato' then raise; end if;
      if position('fornitore' in lower(v_msg)) = 0 then
        raise exception 'Il rifiuto non nomina il fornitore: %', v_msg;
      end if;
  end;

  -- ------------------------------------------------------------------
  -- 3. E NON E' UN MURO: lo stesso carico CON il fornitore passa.
  --    Il lavoro vero si annulla da se': tutto quello che succede dentro
  --    questo blocco viene disfatto dall'eccezione, cosi' la verifica non
  --    lascia in giro lotti, diciture e storico prezzi che poi andrebbero
  --    rincorsi uno per uno.
  -- ------------------------------------------------------------------
  begin
    perform esegui_azione_posta(v_az_si, null);
    v_ok := true;
    raise exception 'ANNULLA_20260828000009';
  exception
    when others then
      if sqlerrm <> 'ANNULLA_20260828000009' then
        raise exception 'Il carico CON il fornitore e'' stato rifiutato: %', sqlerrm;
      end if;
  end;
  if not v_ok then
    raise exception 'Il carico col fornitore non e'' arrivato in fondo';
  end if;

  perform set_config('request.jwt.claims', null, true);

  -- ------------------------------------------------------------------
  -- 4. I PERMESSI NON SONO CAMBIATI: `create or replace` li conserva, e
  --    un `grant` ricopiato a memoria e' una porta aperta per sbaglio.
  -- ------------------------------------------------------------------
  select coalesce(array_to_string(proacl, ' '), '') into v_acl
    from pg_proc where proname = 'esegui_azione_posta' and pronamespace = 'public'::regnamespace;
  if position('authenticated=X' in v_acl) = 0 then
    raise exception 'Il corridoio non puo'' piu'' eseguire la funzione: %', v_acl;
  end if;
  if position('anon=X' in v_acl) > 0 then
    raise exception 'La funzione e'' diventata eseguibile da un anonimo: %', v_acl;
  end if;

  -- ------------------------------------------------------------------
  -- Si riporta via tutto, per identificativo
  -- ------------------------------------------------------------------
  delete from posta_azioni where id in (v_az_no, v_az_si);
  delete from posta_ricevuta where id = v_posta;
  delete from ingredients where id = v_ing;
  delete from suppliers where id = v_forn;
  delete from deleted_records
   where record_id = any(array[v_az_no, v_az_si, v_posta, v_ing, v_forn]::text[]);

  perform pretendi_nessun_residuo(v_foto, 'il carico senza fornitore');

  raise notice 'Un carico senza fornitore viene rifiutato con un messaggio che dice cosa fare, lo stesso carico col fornitore passa, e il tetto dei tentativi di lettura e'' un parametro invece di un numero nel codice.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260828000009', 'la_posta_dice_cosa_sta_succedendo')
on conflict (version) do nothing;
