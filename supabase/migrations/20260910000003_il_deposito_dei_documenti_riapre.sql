-- =====================================================================
-- IL DEPOSITO DEI DOCUMENTI RIAPRE AL TITOLARE — 10/09/2026
-- =====================================================================
-- 🔴 IL FATTO, dal collaudo di Alessio sul progetto di prova: la lettura
--    automatica di un documento funzionava, e premendo «Salva nell'Archivio»
--    compariva «new row violates row-level security policy».
--
-- 🔴 DOVE SI FERMAVA, MISURATO E NON DEDOTTO: al PRIMO passo del
--    salvataggio, il caricamento del file (`uploadDocumentFile` in
--    `src/lib/api/documents.js`), che dal 20/08 viene prima della scheda.
--    Riprodotto col titolare di prova: il deposito dei file risponde con lo
--    stesso identico messaggio. `create_document` non veniva nemmeno
--    raggiunta — la sua tabella ha la sua regola, e c'è.
--
-- 🔴 LA CAUSA: su `storage.objects` del progetto di prova le regole di
--    accesso erano ZERO. In produzione sono quattro, quelle scritte dalla
--    `20260802000014` (lettura, caricamento, modifica e cancellazione nel
--    cassetto `documents`, solo al titolare). Sul progetto di prova quella
--    migrazione risulta registrata il 21/08/2026, il cassetto c'è, e le
--    quattro regole no. Con la RLS accesa e nessuna regola, il deposito
--    rifiuta tutto a tutti.
--    ⚠️ PERCHÉ manchino non è misurato, e non si scrive.
--
-- ⚠️ IL MINIMO NECESSARIO: le stesse quattro regole, con lo stesso testo
--    della `…014`, create SOLO SE MANCANO. Niente di più largo: il cassetto
--    resta del solo titolare come in produzione, e lo staff continua a non
--    leggere e non caricare niente. In produzione le quattro regole ci sono
--    già, quindi lì questa migrazione non crea niente: fa la verifica.
--
-- ⚠️ LA VERIFICA SI ANNULLA DA SOLA. Dal deposito non si cancella via SQL
--    (`storage.protect_delete`: «Use the Storage API instead»), quindi la
--    prova del caricamento sta in un blocco che finisce con un errore suo,
--    catturato PER CODICE: tutto ciò che ha scritto torna indietro, e non
--    resta né un file né una scheda né una lapide. ⚠️ Il gestore cattura
--    SOLO quel codice (P0B58): un controllo che fallisce solleva P0001 e
--    ferma la migrazione, invece di essere inghiottito (trappola del 15/08).
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'storage' and tablename = 'objects'
                    and policyname = 'documents_select_titolare') then
    create policy "documents_select_titolare" on storage.objects
      for select to authenticated
      using (bucket_id = 'documents' and (select is_titolare()));
  end if;

  if not exists (select 1 from pg_policies
                  where schemaname = 'storage' and tablename = 'objects'
                    and policyname = 'documents_insert_titolare') then
    create policy "documents_insert_titolare" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'documents' and (select is_titolare()));
  end if;

  if not exists (select 1 from pg_policies
                  where schemaname = 'storage' and tablename = 'objects'
                    and policyname = 'documents_update_titolare') then
    create policy "documents_update_titolare" on storage.objects
      for update to authenticated
      using (bucket_id = 'documents' and (select is_titolare()))
      with check (bucket_id = 'documents' and (select is_titolare()));
  end if;

  if not exists (select 1 from pg_policies
                  where schemaname = 'storage' and tablename = 'objects'
                    and policyname = 'documents_delete_titolare') then
    create policy "documents_delete_titolare" on storage.objects
      for delete to authenticated
      using (bucket_id = 'documents' and (select is_titolare()));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
-- Il flusso del «Salva» come lo fa la schermata, coi ruoli veri:
-- il titolare carica il file, lo rilegge, la scheda nasce col percorso del
-- file e riceve il testo letto; lo staff non vede quel file e non ne
-- carica uno suo. ⚠️ La regola restrittiva si prova su un file CHE C'È
-- (§5 punto 2): su un cassetto vuoto «lo staff non vede niente» passerebbe
-- anche senza nessuna regola.
do $verifica$
declare
  v_foto      jsonb;
  v_lap0      integer;
  v_lap1      integer;
  v_tit       uuid;
  v_staff     uuid;
  v_nome      text := 'verifica-20260910000003-' || gen_random_uuid()::text || '.txt';
  v_n         integer;
  v_doc       uuid;
  v_percorso  text;
  v_sezione   text;
  v_attesa    text;
  v_rifiutato boolean;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_tit is null or v_staff is null then
    raise exception 'Servono un titolare e uno staff per provare questa migrazione.';
  end if;
  v_foto := foto_righe();
  select count(*) into v_lap0 from deleted_records;

  -- -------------------------------------------------------------------
  -- 1. LE QUATTRO REGOLE CI SONO, e dicono ESATTAMENTE la cosa giusta
  -- -------------------------------------------------------------------
  -- Operazione giusta, al solo `authenticated`, e con la condizione
  -- IDENTICA a quella della `…014`. ⚠️ Non basta cercarci dentro
  -- «is_titolare()» e «documents»: una regola con lo stesso nome e un
  -- «… OR auth.uid() = <qualcun altro>» li contiene tutti e due, e aprirebbe
  -- il cassetto a una persona che la prova con lo staff non vede.
  -- ⚠️ Il testo atteso lo scrive IL MOTORE STESSO, con la stessa regola su
  --    una tabella di passaggio: così il confronto regge a un cambio di
  --    versione di Postgres, che può cambiare il modo in cui la riscrive.
  create temp table riferimento_deposito (bucket_id text) on commit drop;
  create policy riferimento on riferimento_deposito
    using (bucket_id = 'documents' and (select is_titolare()));
  select qual into v_attesa from pg_policies
   where tablename = 'riferimento_deposito' and policyname = 'riferimento';
  drop table riferimento_deposito;
  if v_attesa is null then
    raise exception 'VERIFICA: non sono riuscito a scrivere la regola di riferimento.';
  end if;

  select count(*) into v_n
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and roles = '{authenticated}' and permissive = 'PERMISSIVE'
     and (   (policyname = 'documents_select_titolare' and cmd = 'SELECT'
              and qual = v_attesa and with_check is null)
          or (policyname = 'documents_insert_titolare' and cmd = 'INSERT'
              and qual is null and with_check = v_attesa)
          or (policyname = 'documents_update_titolare' and cmd = 'UPDATE'
              and qual = v_attesa and with_check = v_attesa)
          or (policyname = 'documents_delete_titolare' and cmd = 'DELETE'
              and qual = v_attesa and with_check is null));
  if v_n <> 4 then
    raise exception 'VERIFICA: delle quattro regole del deposito dei documenti ne risultano % identiche a quella attesa.', v_n;
  end if;

  -- E nessun'altra regola nomina il cassetto dei documenti: le regole si
  -- sommano, quindi una quinta lo aprirebbe accanto alle quattro giuste.
  -- ⚠️ Il limite, dichiarato: una regola che apre TUTTI i cassetti senza
  --    nominarli non si trova così — la prende la prova con lo staff qui
  --    sotto, che la vedrebbe passare. Una che apre tutto a UN solo altro
  --    utente non la prende nessuna delle due.
  select count(*) into v_n
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname not in ('documents_select_titolare', 'documents_insert_titolare',
                            'documents_update_titolare', 'documents_delete_titolare')
     and coalesce(qual, '') || coalesce(with_check, '') like '%''documents''%';
  if v_n <> 0 then
    raise exception 'VERIFICA: altre % regole nominano il cassetto dei documenti.', v_n;
  end if;

  begin
    -- -----------------------------------------------------------------
    -- 2. IL TITOLARE: il file entra, si rilegge, la scheda lo nomina
    -- -----------------------------------------------------------------
    perform set_config('request.jwt.claims',
                       json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    -- È la riga che il servizio dei file scrive quando la schermata carica:
    -- è QUESTO inserimento che rispondeva «new row violates row-level
    -- security policy».
    insert into storage.objects (bucket_id, name) values ('documents', v_nome);

    select count(*) into v_n from storage.objects where bucket_id = 'documents' and name = v_nome;
    if v_n <> 1 then
      raise exception 'VERIFICA: il titolare non rilegge il file che ha appena caricato.';
    end if;

    -- La scheda, dalla stessa funzione che chiama il corridoio.
    -- ⚠️ Con sezione e data: `documents_ha_identita` le pretende tutte e due,
    --    e la sezione è una chiave esterna verso `sezioni_archivio`. La
    --    prima stesura di questa verifica passava due vuoti e si fermava lì —
    --    cioè provava il vincolo, non il deposito.
    select codice into v_sezione from sezioni_archivio order by codice limit 1;
    if v_sezione is null then
      raise exception 'Serve almeno una sezione dell''Archivio per provare questa migrazione.';
    end if;
    v_doc := create_document('VERIFICA-10SET documento', null, v_sezione,
                             (now() at time zone 'Europe/Rome')::date, null, null, null,
                             null, v_nome, 'verifica.txt');
    select storage_path into v_percorso from documents where id = v_doc;
    if v_percorso is distinct from v_nome then
      raise exception 'VERIFICA: la scheda non nomina il file caricato (%).', v_percorso;
    end if;

    -- Il testo già letto si conserva dopo, come fa la schermata.
    update documents set testo = 'VERIFICA testo letto' where id = v_doc;
    get diagnostics v_n = row_count;
    if v_n <> 1 then
      raise exception 'VERIFICA: il titolare non riesce a conservare il testo letto sulla scheda.';
    end if;

    -- -----------------------------------------------------------------
    -- 3. LO STAFF: non vede quel file, e non ne carica uno suo
    -- -----------------------------------------------------------------
    perform set_config('request.jwt.claims',
                       json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);

    select count(*) into v_n from storage.objects where bucket_id = 'documents' and name = v_nome;
    if v_n <> 0 then
      raise exception 'VERIFICA: lo staff vede il file del titolare nel deposito dei documenti.';
    end if;

    v_rifiutato := false;
    begin
      insert into storage.objects (bucket_id, name) values ('documents', v_nome || '-staff');
    exception when insufficient_privilege then
      v_rifiutato := true;
    end;
    if not v_rifiutato then
      raise exception 'VERIFICA: lo staff ha caricato un file nel deposito dei documenti.';
    end if;

    -- Fine della prova: tutto quello che ha scritto torna indietro.
    raise exception using errcode = 'P0B58', message = 'fine della prova del deposito';
  exception when sqlstate 'P0B58' then
    null;
  end;

  -- -------------------------------------------------------------------
  -- 4. NON È RIMASTO NIENTE
  -- -------------------------------------------------------------------
  select count(*) into v_n from storage.objects where name like 'verifica-20260910000003-%';
  if v_n <> 0 then
    raise exception 'VERIFICA: nel deposito sono rimasti % file della verifica.', v_n;
  end if;
  select count(*) into v_lap1 from deleted_records;
  if v_lap1 <> v_lap0 then
    raise exception 'VERIFICA: il registro delle cancellazioni è passato da % a %.', v_lap0, v_lap1;
  end if;
  perform pretendi_nessun_residuo(v_foto, 'la verifica del deposito dei documenti');

  raise notice 'Il deposito dei documenti: il titolare carica, rilegge e archivia; lo staff non vede e non carica.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260910000003', 'il_deposito_dei_documenti_riapre') on conflict (version) do nothing;
