-- ============================================================================
-- I TRE CAST CHE NOMINAVANO UN TIPO SPARITO — 27/08/2026
-- ============================================================================
--
-- 🔴 LA `20260827000026` HA TOLTO L'ENUM `ingredient_category`, e Postgres
--    l'ha lasciata fare: il tipo non era nella FIRMA di nessuna funzione
--    rimasta, quindi niente si è opposto. Ma **tre corpi lo nominavano per
--    un cast** — `registra_prodotto_letto`, `esegui_azione_posta`,
--    `fai_azione_dettata` — e un cast si risolve **quando si esegue**, non
--    quando la funzione si crea.
--
-- ⚠️ È ESATTAMENTE LA LEZIONE DEL 17/08: *«un corpo che si crea non è un
--    corpo che funziona»*. Dopo la `…026` quelle tre funzioni esistevano,
--    erano interrogabili nel catalogo, e si sarebbero fermate **al primo
--    prodotto creato da una foto, da una mail o da una frase detta a voce**.
--
-- ⚠️ E I CORPI SONO PRESI DAL PROGETTO DI PROVA, non dalla produzione. Il
--    comando `npm run funzione:viva` legge il gestionale VERO, e là
--    `registra_prodotto_letto` **non esiste ancora** (la `…020` aspetta il
--    push): ripartire da quel corpo vivo avrebbe annullato in silenzio il
--    lavoro di stanotte. È la precisazione scritta il 27/08 —
--    *«il corpo vivo non è uno solo: è quello del database che stai
--    guardando»* — e stavolta è stata usata invece di essere pagata.
--
-- ----------------------------------------------------------------------------
-- IL CATALOGO AL POSTO DEL CAST, e non è solo una traduzione
-- ----------------------------------------------------------------------------
-- Prima la validazione ERA il cast: una categoria che l'enum non conosceva
-- sollevava un'eccezione, e il codice ripiegava su «altro». Con le categorie
-- diventate dati, un testo qualunque non solleva niente: verrebbe scritto, e
-- lo respingerebbe la chiave esterna — rumorosamente, quindi non è un
-- disastro, ma il ripiego su «altro» sarebbe andato perso.
--
-- Quindi al posto del cast si CHIEDE a `valore_del_vocabolario()`, che dal
-- 27/08 sa leggere anche i cataloghi. Due conseguenze, entrambe volute:
--   · una categoria che **Alessio ha aggiunto** passa, senza che nessuno
--     tocchi queste tre funzioni;
--   · una categoria **inventata dal modello** ripiega su «altro», come prima.
--
-- ⚠️ E LA VERIFICA LE CHIAMA, non si limita a ricrearle: è il controllo che
--    il 17/08 mancava, e senza il quale «la funzione è stata riscritta» e
--    «la funzione risponde» restano due frasi diverse.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.registra_prodotto_letto(p_scheda jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ente        uuid;
  v_ingrediente text;
  v_prodotto    text;
  v_chiave      text;
  v_trovato     record;
  v_ing         uuid;
  v_indicato    uuid;
  v_ing_nuovo   boolean := false;
  v_art         uuid;
  v_art_nuovo   boolean := false;
  v_unita       unit_type;
  v_categoria   text;
  v_lettura     jsonb;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' registrare un prodotto letto da una foto.';
  end if;

  v_ingrediente := nullif(btrim(p_scheda->>'ingrediente'), '');
  v_prodotto    := nullif(btrim(p_scheda->>'prodotto'), '');

  begin
    v_indicato := nullif(btrim(p_scheda->>'ingredient_id'), '')::uuid;
  exception when others then
    raise exception 'L''ingrediente indicato non si capisce.';
  end;

  -- ------------------------------------------------------------------
  -- 1. L'ingrediente: indicato, oppure trovato/creato dal nome
  -- ------------------------------------------------------------------
  if v_indicato is not null then
    select id, name into v_ing, v_ingrediente from ingredients where id = v_indicato;
    if v_ing is null then
      -- ⚠️ RIFIUTA invece di ripiegare sul nome: un ripiego silenzioso
      --    farebbe nascere il secondo ingrediente che stiamo evitando.
      raise exception 'L''ingrediente a cui appendere il prodotto non esiste piu''.';
    end if;
  else
    if v_ingrediente is null then
      raise exception 'Non ho capito di quale ingrediente e'' un prodotto. Scrivilo tu nella scheda.';
    end if;

    select id into v_ente from entities order by created_at limit 1;
    if v_ente is null then
      raise exception 'Nessuna societa'' configurata: non so a chi intestare il prodotto.';
    end if;

    begin
      v_unita := coalesce(nullif(p_scheda->>'unita', ''), 'kg')::unit_type;
    exception when others then
      v_unita := 'kg'::unit_type;
    end;

    -- ⚠️ IL CATALOGO AL POSTO DEL CAST. Prima la validazione era il cast
    --    all'enum, che sollevava e faceva ripiegare su «altro». Ora le
    --    categorie sono dati, quindi si CHIEDE alla rete dei vocabolari: una
    --    categoria che Alessio ha aggiunto passa, una inventata dal modello
    --    ripiega su «altro» come prima.
    v_categoria := coalesce(
      valore_del_vocabolario('ingredients', 'category',
                             nullif(p_scheda->>'categoria', '')),
      'altro');

    select * into v_trovato from trova_o_crea_ingrediente(
      v_ente, v_ingrediente, v_unita, v_categoria,
      coalesce((p_scheda->>'alimentare')::boolean, true));
    v_ing := v_trovato.id;
    v_ing_nuovo := not v_trovato.era_gia_li;
  end if;

  -- ------------------------------------------------------------------
  -- 2. Il prodotto, appeso a lui
  -- ------------------------------------------------------------------
  if v_prodotto is null then
    v_prodotto := btrim(v_ingrediente || ' ' ||
                        coalesce(nullif(btrim(p_scheda->>'marca'), '') || ' ', '') ||
                        coalesce(nullif(btrim(p_scheda->>'formato'), ''), ''));
  end if;

  v_chiave := chiave_articolo(v_prodotto);

  select id into v_art
    from articoli_fornitore
   where supplier_id is null and chiave = v_chiave;

  if v_art is null then
    insert into articoli_fornitore (
      supplier_id, descrizione, chiave, ingredient_id,
      marca, formato, nome_esteso, unita_fattura, fattore)
    values (
      null, v_prodotto, v_chiave, v_ing,
      nullif(btrim(p_scheda->>'marca'), ''),
      nullif(btrim(p_scheda->>'formato'), ''),
      nullif(btrim(p_scheda->>'nome_esteso'), ''),
      nullif(btrim(p_scheda->>'unita_confezione'), ''),
      greatest(coalesce((p_scheda->>'quantita_confezione')::numeric, 1), 0.0001))
    returning id into v_art;
    v_art_nuovo := true;
  else
    -- ⚠️ Un prodotto che c'era gia'' NON cambia ingrediente: se qualcuno
    --    l'aveva collegato a mano, quella scelta vince su una lettura
    --    automatica — stessa regola degli allergeni «alessio».
    update articoli_fornitore
       set marca       = coalesce(marca, nullif(btrim(p_scheda->>'marca'), '')),
           formato     = coalesce(formato, nullif(btrim(p_scheda->>'formato'), '')),
           nome_esteso = coalesce(nome_esteso, nullif(btrim(p_scheda->>'nome_esteso'), '')),
           ingredient_id = coalesce(ingredient_id, v_ing),
           aggiornato_il = now()
     where id = v_art;
    select ingredient_id into v_ing from articoli_fornitore where id = v_art;
  end if;

  -- ------------------------------------------------------------------
  -- 3. I campi dell'etichetta sull'ingrediente
  -- ------------------------------------------------------------------
  v_lettura := applica_lettura_etichetta(v_ing, p_scheda);

  return jsonb_build_object(
    'ingredient_id',      v_ing,
    'articolo_id',        v_art,
    'ingrediente_nuovo',  v_ing_nuovo,
    'prodotto_nuovo',     v_art_nuovo,
    'nome_ingrediente',   v_ingrediente,
    'nome_prodotto',      v_prodotto,
    'scritti',            v_lettura->'scritti',
    'scartati',           v_lettura->'scartati',
    'allergeni_toccati',  v_lettura->'allergeni_toccati');
end;
$function$;

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

CREATE OR REPLACE FUNCTION public.fai_azione_dettata(p_tipo text, p_dati jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id     uuid;
  v_ent    uuid;
  v_lotto  uuid;
  v_pezzi  text;
begin
  case p_tipo

    when 'giacenza' then
      return allinea_giacenza(
        (p_dati->>'ingredient_id')::uuid,
        (p_dati->>'quanto_ce')::numeric,
        coalesce(nullif(p_dati->>'note', ''), 'Contato a voce'));

    when 'temperatura' then
      -- 🔴 Il frigo non si indovina MAI: quel registro va all'ASP.
      --    Il vincolo sulla riga lo impedisce gia', e qui si rifiuta con
      --    una frase leggibile invece che con un errore di vincolo.
      if nullif(p_dati->>'equipment_id', '') is null then
        raise exception 'Non hai detto quale frigo: una temperatura senza il suo frigo non si scrive nel registro.';
      end if;
      return registra_temperatura(
        (p_dati->>'equipment_id')::uuid,
        (p_dati->>'gradi')::numeric,
        nullif(p_dati->>'note', ''),
        null);

    when 'promemoria' then
      insert into tasks (title, description, due_date, priority, status, category, origine_modulo)
      values (
        left(coalesce(nullif(p_dati->>'titolo', ''), 'Promemoria dettato'), 200),
        nullif(p_dati->>'descrizione', ''),
        nullif(p_dati->>'data', '')::date,
        coalesce(nullif(p_dati->>'priorita', ''), 'media')::task_priority,
        'da_fare'::task_status,
        coalesce(nullif(p_dati->>'categoria', ''), 'altro'),
        'voce')
      returning id into v_id;
      return jsonb_build_object('task_id', v_id);

    when 'pulizia' then
      if nullif(p_dati->>'task_id', '') is null then
        raise exception 'Non ho capito quale pulizia: dimmi il nome di una di quelle previste nel piano.';
      end if;
      insert into haccp_cleaning_logs (task_id, note)
      values ((p_dati->>'task_id')::uuid, nullif(p_dati->>'note', ''))
      returning id into v_id;
      return jsonb_build_object('log_id', v_id);

    when 'lista_spesa' then
      -- ⚠️ Il nome libero e' ammesso apposta: «prendi la carta forno» non
      --    e' un prodotto del ricettario e non deve diventarlo. Aggiungere
      --    una riga alla lista non crea niente in magazzino.
      return jsonb_build_object('item', add_shopping_list_item(
        -- 🔴 SEMPRE NULL, ed e' la decisione del 27/08: la lista della
        --    spesa non accoppia mai col magazzino. Quello che si dice
        --    finisce in lista come si e' detto, e l'abbinamento si fa
        --    dopo, con la foto del documento quando la merce arriva.
        null,
        nullif(p_dati->>'nome_libero', ''),
        null,
        nullif(p_dati->>'quantita', '')::numeric,
        nullif(p_dati->>'unita', '')::unit_type,
        nullif(p_dati->>'note', '')));

    when 'merce_buttata' then
      -- 🔴 `record_stock_consumption` NON RESTITUISCE NIENTE (void), e
      --    quindi si chiama con `perform` e la risposta la si costruisce
      --    qui. Scrivendo `return` si otteneva «invalid input syntax for
      --    type json» — un errore che parla di JSON per una funzione che
      --    di JSON non ne ha mai visto.
      perform record_stock_consumption(
        (p_dati->>'ingredient_id')::uuid,
        (p_dati->>'quantita')::numeric,
        'spreco',
        coalesce(nullif(p_dati->>'note', ''), 'Buttata, detto a voce'));
      return jsonb_build_object(
        'ingredient_id', p_dati->>'ingredient_id',
        'quantita',      p_dati->>'quantita',
        'motivo',        'spreco');

    when 'nota_non_capita' then
      -- 🔴 LA MAGLIA LARGA: non ho capito, e NON INVENTO. Resta scritto
      --    quello che ho sentito, e Alessio lo vede in Dashboard.
      insert into tasks (title, description, priority, status, category, origine_modulo)
      values (
        'Da riguardare: una cosa detta a voce',
        p_dati->>'sentito',
        'media'::task_priority,
        'da_fare'::task_status,
        'altro',
        'voce')
      returning id into v_id;
      return jsonb_build_object('task_id', v_id);

    -- =====================================================================
    -- I QUATTRO CHE MANCAVANO — natura `creazione`, tutti dietro l'occhio
    -- =====================================================================

    when 'movimento_cassa' then
      -- 🔴 LA DATA E' LA SERATA. Un'uscita dettata all'una di notte
      --    appartiene alla sera prima, e `current_date` a quell'ora
      --    risponderebbe col giorno di Greenwich.
      select id into v_ent from entities where entity_type = 'srls' limit 1;
      insert into cash_movements (
        entity_id, direction, amount, movement_date, causale_id, mezzo,
        conto_id, tipo_documento, business_purpose, note)
      values (
        v_ent,
        (p_dati->>'verso')::cash_direction,
        (p_dati->>'importo')::numeric,
        coalesce(nullif(p_dati->>'data', '')::date, serata_di_servizio(now())),
        nullif(p_dati->>'causale_id', '')::uuid,
        coalesce(nullif(p_dati->>'mezzo', ''), 'cassa'),
        nullif(p_dati->>'conto_id', '')::uuid,
        coalesce(nullif(p_dati->>'documento', ''), 'non_documentato')::cash_document_type,
        -- ⚠️ Su `cash_movements` non c'e' nessuna colonna «fornitore»: il
        --    nome riconosciuto si scrive qui, in chiaro, invece di
        --    inventare un legame che lo schema non prevede.
        nullif(concat_ws(' · ',
          (select 'Fornitore: ' || s.name from suppliers s
            where s.id = nullif(p_dati->>'supplier_id', '')::uuid),
          nullif(p_dati->>'descrizione', '')), ''),
        coalesce(nullif(p_dati->>'note', ''), 'Registrato a voce'))
      returning id into v_id;
      return jsonb_build_object(
        'movimento_id',  v_id,
        'senza_causale', nullif(p_dati->>'causale_id', '') is null);

    when 'carico_merce' then
      if nullif(p_dati->>'ingredient_id', '') is null then
        raise exception 'Non ho capito quale prodotto e'' arrivato.';
      end if;
      v_lotto := register_stock_delivery(
        (p_dati->>'ingredient_id')::uuid,
        (p_dati->>'quantita')::numeric,
        nullif(p_dati->>'supplier_id', '')::uuid,
        nullif(p_dati->>'scadenza', '')::date,
        coalesce(nullif(p_dati->>'note', ''), 'Arrivato, detto a voce'),
        nullif(p_dati->>'costo_unitario', '')::numeric,
        nullif(p_dati->>'lotto', ''),
        null);
      return jsonb_build_object(
        'lotto_id',      v_lotto,
        'senza_scadenza', nullif(p_dati->>'scadenza', '') is null);

    when 'prodotto_nuovo' then
      -- 🔴 IL DOPPIONE SI RIFIUTA. Due prodotti con lo stesso nome sono due
      --    giacenze che si dividono la stessa merce e non si riuniscono
      --    piu': e' il difetto che il carico da fattura ha gia' imparato a
      --    evitare.
      if exists (select 1 from ingredients i
                  where lower(btrim(i.name)) = lower(btrim(p_dati->>'nome'))) then
        raise exception '«%» c''e'' gia'' fra i prodotti: non ne faccio un secondo. Se volevi caricarlo, dimmi che e'' arrivato.',
          btrim(p_dati->>'nome');
      end if;
      select id into v_ent from entities where entity_type = 'srls' limit 1;
      -- ⚠️ Il prezzo nasce a ZERO, che qui e' il predefinito dello schema e
      --    non una mia risposta: la scheda si compila dopo, e il primo
      --    carico con un costo lo aggiorna.
      -- ⚠️ `create_ingredient` restituisce la RIGA INTERA in jsonb, non
      --    l'identificativo: assegnandola a un uuid l'errore che si ottiene
      --    parla di «invalid input syntax for type uuid» e mostra tutta la
      --    riga — sembra un dato storto, ed e' solo il tipo di ritorno.
      v_id := (create_ingredient(
        v_ent,
        btrim(p_dati->>'nome'),
        -- ⚠️ Il catalogo al posto del cast all'enum (27/08/2026).
        coalesce(valore_del_vocabolario('ingredients', 'category',
                                        nullif(p_dati->>'categoria', '')), 'altro'),
        (p_dati->>'unita')::unit_type,
        0)->>'id')::uuid;
      return jsonb_build_object('ingredient_id', v_id, 'senza_scheda', true);

    when 'ricetta' then
      if exists (select 1 from recipes r
                  where lower(btrim(r.name)) = lower(btrim(p_dati->>'nome'))) then
        raise exception 'Una ricetta che si chiama «%» c''e'' gia''. Se la vuoi cambiare, aprila dal Ricettario.',
          btrim(p_dati->>'nome');
      end if;
      -- ⚠️ SOLO LO SCHELETRO, e il testo dettato per intero nelle note: gli
      --    ingredienti si mettono a mano. Una quantita' di riga sbagliata
      --    sposta il food cost in silenzio, ed e' precisamente l'errore che
      --    il criterio «la creazione passa dai tuoi occhi» esiste per
      --    evitare.
      v_pezzi := nullif(btrim(coalesce(p_dati->>'sentito', '')), '');
      insert into recipes (name, category, portions_yield, notes)
      values (
        btrim(p_dati->>'nome'),
        (p_dati->>'categoria')::recipe_category,
        greatest(coalesce(nullif(p_dati->>'porzioni', '')::integer, 1), 1),
        case when v_pezzi is null then null else 'Dettata a voce: ' || v_pezzi end)
      returning id into v_id;
      return jsonb_build_object('recipe_id', v_id, 'senza_ingredienti', true);

    else
      raise exception 'Questa cosa il gestionale non la sa ancora fare a voce (%). Si fa a mano come sempre.', p_tipo;
  end case;
end $function$;
-- ⚠️ Nessun `drop`, quindi i permessi restano quelli di prima. Si riscrivono
--    lo stesso: un `revoke`/`grant` dato per fatto è la stessa cosa di un
--    corpo dato per fatto (lezione del 24/08).
revoke all on function registra_prodotto_letto(jsonb) from public, anon, authenticated;
grant execute on function registra_prodotto_letto(jsonb) to authenticated;

-- ============================================================================
-- VERIFICA — le funzioni si CHIAMANO
-- ============================================================================
do $verifica$
declare
  v_foto     jsonb;
  v_tit      uuid;
  v_ente     uuid;
  v_r        jsonb;
  v_miei_ing uuid[] := '{}';
  v_miei_art uuid[] := '{}';
  v_miei_cat text[] := '{}';
  v_cat      text;
  v_n        integer;
begin
  v_foto := foto_righe();

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  if v_tit is null or v_ente is null then
    raise exception 'Verifica impossibile: manca il titolare o la societa''';
  end if;

  -- 1. Nessuna funzione nomina piu' il tipo sparito
  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and pg_get_functiondef(p.oid) like '%ingredient_category%';
  if v_n <> 0 then
    raise exception '% funzioni nominano ancora il tipo enum sparito', v_n;
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- 2. 🔴 LA FUNZIONE SI CHIAMA, con una categoria BUONA
  v_r := registra_prodotto_letto(jsonb_build_object(
    'ingrediente', 'Passata di verifica 20260827000027',
    'prodotto',    'Passata di verifica Marca Z 20260827000027',
    'marca',       'Marca Z',
    'unita',       'kg',
    'categoria',   'secco_dispensa'));
  v_miei_ing := v_miei_ing || (v_r->>'ingredient_id')::uuid;
  v_miei_art := v_miei_art || (v_r->>'articolo_id')::uuid;

  select category into v_cat from ingredients where id = (v_r->>'ingredient_id')::uuid;
  if v_cat is distinct from 'secco_dispensa' then
    raise exception 'La categoria buona non e'' arrivata: %', coalesce(v_cat, '(vuota)');
  end if;

  -- 3. UNA CATEGORIA INVENTATA ripiega su «altro», come faceva il cast
  v_r := registra_prodotto_letto(jsonb_build_object(
    'ingrediente', 'Inventata di verifica 20260827000027',
    'prodotto',    'Inventata di verifica Marca Y 20260827000027',
    'marca',       'Marca Y',
    'unita',       'kg',
    'categoria',   'categoria_che_non_esiste'));
  v_miei_ing := v_miei_ing || (v_r->>'ingredient_id')::uuid;
  v_miei_art := v_miei_art || (v_r->>'articolo_id')::uuid;

  select category into v_cat from ingredients where id = (v_r->>'ingredient_id')::uuid;
  if v_cat is distinct from 'altro' then
    raise exception 'Una categoria inventata non ha ripiegato su «altro»: %', coalesce(v_cat, '(vuota)');
  end if;

  -- 4. 🔴 UNA CATEGORIA AGGIUNTA DA ALESSIO PASSA, senza che nessuno tocchi
  --    queste funzioni: e' il guadagno vero del blocco.
  v_r := aggiungi_categoria_ingrediente('Conserve di verifica 20260827000027');
  v_miei_cat := v_miei_cat || (v_r->>'codice');

  v_r := registra_prodotto_letto(jsonb_build_object(
    'ingrediente', 'Conserva di verifica 20260827000027',
    'prodotto',    'Conserva di verifica Marca X 20260827000027',
    'marca',       'Marca X',
    'unita',       'kg',
    'categoria',   'conserve_di_verifica_20260827000027'));
  v_miei_ing := v_miei_ing || (v_r->>'ingredient_id')::uuid;
  v_miei_art := v_miei_art || (v_r->>'articolo_id')::uuid;

  select category into v_cat from ingredients where id = (v_r->>'ingredient_id')::uuid;
  if v_cat is distinct from 'conserve_di_verifica_20260827000027' then
    raise exception 'Una categoria aggiunta da Alessio non arriva: %', coalesce(v_cat, '(vuota)');
  end if;

  -- ------------------------------------------------------------------
  -- Si riporta via tutto, per identificativo
  -- ------------------------------------------------------------------
  perform set_config('request.jwt.claims', null, true);
  delete from allergeni_prodotto where ingredient_id = any(v_miei_ing);
  delete from articoli_fornitore where id = any(v_miei_art);
  delete from price_history where ingredient_id = any(v_miei_ing);
  delete from ingredients where id = any(v_miei_ing);
  delete from categorie_ingrediente where codice = any(v_miei_cat);
  delete from deleted_records where record_id = any((v_miei_ing || v_miei_art)::text[]);

  perform pretendi_nessun_residuo(v_foto, 'i tre cast che nominavano un tipo sparito');

  raise notice 'Le tre funzioni RISPONDONO: una categoria buona arriva, una inventata ripiega su «altro», e una aggiunta da Alessio passa senza che nessuno le tocchi.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000027', 'i_tre_cast_che_nominavano_un_tipo_sparito') on conflict (version) do nothing;
