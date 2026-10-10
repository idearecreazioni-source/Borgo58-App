-- =====================================================================
-- IL DOCUMENTO NATO DALLA POSTA TIENE LA SUA SOCIETA' — 21/09/2026
-- =====================================================================
--
-- 🔴 IL DIFETTO, MISURATO LEGGENDO IL CODICE E NON DEDOTTO DAI NOMI.
-- `esegui_azione_posta` chiamava `create_document(...)` **senza passare
-- `p_entity_id`**, e in `create_document` quel parametro ha `default null`.
-- Quindi **ogni** documento nato da una mail — una fattura, un DDT, un
-- contratto — nasceva senza societa'.
--
-- ⚠️ E LA CONSEGUENZA NON ERA UN ERRORE: ERA UN ELENCO VUOTO. Nella
-- schermata delle Fatture Fornitori i documenti offerti per il collegamento
-- sono quelli della **stessa societa' della fattura**
-- (`FattureFornitoriHome.jsx`, regola oggi in
-- `src/lib/calcoli/documentiCollegabili.js`). Un valore assente non combacia
-- mai con l'identificativo di una societa': **un DDT archiviato dalla posta
-- non compariva fra i collegabili per nessuna fattura, mai**, e la schermata
-- diceva con calma «Nessun documento libero di questa societa'
-- nell'Archivio: il DDT va prima archiviato li'» — cioe' mandava ad
-- archiviare una cosa che era gia' in archivio.
--
-- ⚠️ LA META' CHE FUNZIONAVA NON SI TOCCA. Un documento di cui NON si sa la
-- societa' deve continuare a **non** essere offerto: offrirlo «tanto poi si
-- vede» farebbe comparire sulle fatture della S.r.l.s. documenti che
-- potrebbero essere dell'azienda agricola. *Un'assenza di informazione non e'
-- un permesso.*
--
-- ---------------------------------------------------------------------
-- COSA CAMBIA, ED E' UNA RIGA
-- ---------------------------------------------------------------------
-- `create_document` riceve `p_entity_id => nullif(v_par->>'societa', '')`.
-- La societa' arriva dai parametri dell'azione, cioe' **da chi conferma**:
-- la schermata della Posta ha ora il campo «Societa'», con le stesse due
-- voci dell'Archivio a mano (la tasca non compare: e' il soggetto delle
-- spese senza documento, non intesta niente).
--
-- ⚠️ RESTA FACOLTATIVA, e non e' una mancanza. Il modello che legge la mail
-- non puo' sapere di chi sia una fattura, e nessuna regola la deduce: niente
-- «prima entita' trovata», niente S.r.l.s. per comodita'. Senza risposta il
-- documento nasce senza societa' **esattamente come prima**, e le Fatture
-- ora lo dicono invece di far credere che l'Archivio sia vuoto.
--
-- ⚠️ NESSUNA SANATORIA. I documenti gia' scritti non si toccano: la loro
-- societa' non si puo' ricavare da niente che il gestionale sappia, e
-- indovinarla vorrebbe dire intestare a una societa' documenti che
-- potrebbero essere dell'altra. Si correggono a mano, uno per uno, dalla
-- scheda del documento — dove il campo c'e' gia'. In produzione i documenti
-- sono comunque zero.
--
-- ---------------------------------------------------------------------
-- 🔴 PERCHE' C'E' UN GUARDIANO PRIMA DELLA RISCRITTURA
-- ---------------------------------------------------------------------
-- La regola di questo progetto e' che **una funzione si riscrive dal
-- DATABASE, mai dal file che l'ha creata** (18/08: fra i due ci stanno tutte
-- le migrazioni che l'hanno toccata). Qui il corpo vivo NON si e' potuto
-- leggere: il mandato che ha prodotto questa migrazione vieta ogni contatto
-- con il progetto di prova e con la produzione. Il corpo qui sotto viene
-- quindi dall'ultima migrazione del repository che definisce la funzione,
-- `20260813000003`.
--
-- ⚠️ Quel limite non si dichiara e basta: si trasforma in un ARRESTO. Il
-- blocco qui sotto legge il corpo vivo e si ferma se non riconosce le quattro
-- strade della funzione (archivio, promemoria multipli, carico, «da fare a
-- mano»), oppure se qualcuno ha gia' toccato la societa' in un modo diverso
-- dal nostro. Cosi' il caso «il corpo vivo era diverso» non produce una
-- riscrittura silenziosa — che e' precisamente il difetto del 18/08 — ma un
-- messaggio che dice di guardare `npm run funzione:viva` prima di insistere.
--
-- ⚠️ IL LIMITE DEL GUARDIANO, dichiarato: riconosce quattro impronte, non
-- confronta il corpo intero. Una modifica dentro una di quelle strade che
-- non tocchi l'impronta passerebbe. E' una rete, non una prova d'identita'.
--
-- ⚠️ E NON E' LA RETE PRINCIPALE, che esiste gia' ed e' migliore: applicando
-- con `npm run migra` o `npm run prova:migra`, `rete-guardie`
-- (`scripts/guardie.mjs`, 23/08) confronta le funzioni ridefinite col corpo
-- VIVO su cinque impronte e si ferma se il corpo nuovo ha perso qualcosa.
-- Questa migrazione **aggiunge** una riga e non ne toglie nessuna, quindi non
-- le serve nessuna riga `-- rete-guardie:`. Il guardiano qui sotto e' il
-- fondo di rete per chi applicasse il file per un'altra strada.
--
-- ⚠️ QUESTA MIGRAZIONE NON E' STATA APPLICATA DA NESSUNA PARTE — ne' alla
-- prova ne' alla produzione — perche' il mandato lo vieta. Non e' quindi
-- passata dal progetto di prova, che e' la condizione prima di ogni
-- applicazione in produzione.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Il guardiano: riconosco la funzione che sto per sostituire?
-- ---------------------------------------------------------------------
do $guardia$
declare
  v_corpo   text;
  v_impronte text[] := array[
    'p_file_name    => v_allegato.file_name',  -- la strada dell'archivio
    'scadenze',                                -- i promemoria multipli
    'trova_o_crea_ingrediente(',               -- il carico da fattura
    'passi'                                    -- il «da fare a mano»
  ];
  v_i text;
begin
  select pg_get_functiondef(p.oid) into v_corpo
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'esegui_azione_posta'
     -- ⚠️ `identity_arguments` dà i soli TIPI («uuid, jsonb»): i nomi dei
     --    parametri stanno in `pg_get_function_arguments`, che è un'altra
     --    funzione. Confrontare qui la forma coi nomi non troverebbe mai
     --    niente, e il guardiano direbbe «non esiste» su una funzione che
     --    esiste — cioè fallirebbe nel verso che sembra prudente.
     and pg_get_function_identity_arguments(p.oid) = 'uuid, jsonb';

  if v_corpo is null then
    -- ⚠️ IL NOME SI SCRIVE SENZA PARENTESI, e non è una finezza di stile:
    --    la rete `tests/app/migrazioni-senza-portieri.test.js` riconosce una
    --    chiamata dal ritratto «nome(», e questo blocco NON ha i claims —
    --    giustamente, perché non chiama niente, legge solo il catalogo.
    --    Scritto «esegui_azione_posta(uuid, jsonb)» il guardiano vedeva una
    --    chiamata dentro una frase e si fermava. ⚠️ La cura giusta è questa,
    --    non una dichiarazione `rete-portieri:`: quella zittirebbe la coppia
    --    file↔funzione **anche** per la chiamata vera che sta più sotto, e
    --    nasconderebbe un errore futuro in questo stesso file.
    raise exception 'La funzione esegui_azione_posta, nella forma uuid + jsonb, non esiste: questa migrazione la sostituisce, non la crea.';
  end if;

  -- Gia' applicata: il nostro marcatore c'e'. Si riscrive lo stesso corpo.
  if position('societa-dalla-posta: 20260921000001' in v_corpo) > 0 then
    raise notice 'La societa'' dalla posta c''e'' gia'': riscrivo lo stesso corpo.';
  elsif position('p_entity_id' in v_corpo) > 0 then
    raise exception 'La funzione viva passa gia'' una societa'' a create_document, ma non e'' questa correzione. Guarda il corpo vivo (npm run funzione:viva esegui_azione_posta) prima di sovrascriverlo.';
  else
    foreach v_i in array v_impronte loop
      if position(v_i in v_corpo) = 0 then
        raise exception 'Il corpo vivo di esegui_azione_posta non contiene «%»: e'' cambiato rispetto a 20260813000003, su cui questa migrazione e'' costruita. Riscriverlo adesso annullerebbe quelle modifiche in silenzio. Guarda il corpo vivo prima di insistere.', v_i;
      end if;
    end loop;
  end if;
end $guardia$;

-- ---------------------------------------------------------------------
-- 2. La funzione, con la sola riga aggiunta (cercare il marcatore)
-- ---------------------------------------------------------------------

create or replace function esegui_azione_posta(
  p_azione_id uuid,
  p_parametri jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
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
      -- 🔴 societa-dalla-posta: 20260921000001 — LA SOCIETA' ARRIVA DA CHI
      --    CONFERMA, e resta vuota se nessuno l'ha detta. Prima questa riga
      --    non c'era: ogni documento nato da una mail restava senza societa',
      --    e nelle Fatture i documenti collegabili sono quelli della stessa
      --    societa' della fattura — quindi non compariva mai, senza errori.
      --    ⚠️ Non si indovina: niente prima entita' trovata, niente S.r.l.s.
      --    per comodita'. Un documento intestato alla societa' sbagliata e'
      --    peggio di un documento senza societa', perche' sembra a posto.
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
          coalesce(nullif(v_nuovo->>'categoria', '')::ingredient_category, 'altro'),
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
        p_supplier_batch_number => nullif(v_riga->>'lotto', '')
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
$funzione$;


revoke all on function esegui_azione_posta(uuid, jsonb) from public, anon;
grant execute on function esegui_azione_posta(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Verifica — in una sotto-transazione che viene ANNULLATA
-- ---------------------------------------------------------------------
-- ⚠️ `documents` e `posta_ricevuta` sono tabelle vere: una verifica che ci
--    scrivesse e poi cancellasse lascerebbe righe nel registro delle
--    cancellazioni, che nessuno puo' ripulire dall'app. Quindi tutto quello
--    che segue vive dentro un blocco che si chiude con un'eccezione
--    apposta: niente resta scritto, e il registro non si accorge di niente.
--    E' la stessa forma della verifica della tasca (30/08).
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

  begin  -- <<< la sotto-transazione che verra' annullata

    insert into posta_ricevuta (messaggio_id, casella, oggetto, testo, stato)
    values ('zz-verifica-societa-20260921', 'zz@verifica', 'ZZ verifica', 'ZZ corpo', 'proposta')
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
    -- ⚠️ `is distinct from null` e non `<> null`: un confronto con un valore
    --    che puo' essere vuoto non scatta mai, e la verifica approverebbe
    --    proprio il caso che deve prendere (trappola del 27/08).
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

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  raise notice 'Verifica passata: la societa'' dichiarata si conserva, quella assente non si inventa. Niente e'' rimasto scritto.';
end $verifica$;

-- ---------------------------------------------------------------------
-- 4. La migrazione si registra da sé
-- ---------------------------------------------------------------------
insert into applied_migrations (version, name)
values ('20260921000001', 'il_documento_dalla_posta_tiene_la_societa')
on conflict (version) do nothing;
