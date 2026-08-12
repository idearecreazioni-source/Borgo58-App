-- =====================================================================
-- Un guasto si ripete, un rincaro e' un fatto nuovo ogni volta
-- =====================================================================
-- Trovato il 13/08/2026 all'ultimo controllo della serata, andando a
-- verificare quali avvisi fossero PARTITI davvero invece di fidarsi di
-- quelli visti in schermata.
--
-- Alessio ha confermato tre documenti di collaudo. In `allarmi` ne
-- risultano due, ma non quelli che sembrava:
--
--   · olio      +10,0%  dal documento 3   ✓
--   · pomodori  +12,5%  dal documento **2**
--
-- Il rincaro dei pomodori del documento 3 — +8,3% sull'ultima volta e
-- +21,9% da quando lo compra, cioe' proprio l'avviso «coi due numeri»
-- che nessuno ha mai visto — NON E' MAI STATO INVIATO, e nemmeno
-- registrato.
--
-- LA CAUSA: `segnala_allarme()` ha il freno anti-tempesta a un avviso
-- per TIPO all'ora, e il tipo era `rincaro_<ingrediente>`. Le due
-- conferme distavano venti minuti, quindi per il freno il secondo
-- rincaro sui pomodori era «lo stesso avviso di prima».
--
-- In schermata i due avvisi c'erano, perche' li' il confronto e'
-- calcolato dal vivo e non passa dal freno. **Schermo e Telegram
-- dicevano due cose diverse**, ed e' il caso peggiore: chi guarda il
-- telefono crede di sapere tutto.
--
-- IL FRENO NON E' SBAGLIATO — e' sbagliato applicarlo qui. Serve per un
-- guasto che si ripete, dove il decimo messaggio identico non aggiunge
-- niente e rende il telefono inutilizzabile durante un servizio. Un
-- rincaro non e' un guasto che si ripete: e' un fatto nuovo, e ogni
-- fatto nuovo vale un messaggio.
--
-- LA CORREZIONE: il tipo dell'avviso identifica il rincaro, non il
-- prodotto — ingrediente, versione e prezzo nuovo. Cosi' lo stesso
-- rincaro non si ripete (se una conferma parte due volte, un solo
-- messaggio) e un rincaro diverso passa sempre.
--
-- ⚠️ Perche' anche la VERSIONE e non solo il prezzo, come avevo scritto
-- in coda: due versioni dello stesso ingrediente possono rincarare fino
-- allo stesso prezzo nella stessa ora — la lattina da 5 L e la bottiglia
-- da 1 L che arrivano entrambe a 13,20. Col prezzo da solo il secondo
-- avviso sparirebbe, che e' esattamente il difetto che questa migrazione
-- chiude. Un caso improbabile silenziato di nuovo per comodita' e'
-- il modo in cui questo difetto e' nato la prima volta.
--
-- ⚠️ COME SI VERIFICA SENZA FAR SUONARE IL TELEFONO DI ALESSIO: il
-- freno viveva dentro `segnala_allarme()`, che invia. Provarlo
-- significava mandargli messaggi finti — ed e' quello che fece la
-- migrazione degli allarmi il 10/08. Qui la DECISIONE viene separata
-- dall'INVIO, come per l'email di conferma e per la sentinella dei
-- lavori: `allarme_frenato()` risponde «questo avviso e' gia' uscito
-- nell'ultima ora» senza avvisare nessuno, e `segnala_allarme()` la
-- usa. La verifica in fondo prova il freno per intero — compreso che
-- col tipo VECCHIO il secondo rincaro sarebbe stato zittito — e non
-- spedisce niente a nessuno.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La decisione, separata dall'invio
-- ---------------------------------------------------------------------
create or replace function allarme_frenato(p_tipo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $funzione$
  select exists (
    select 1 from allarmi
     where tipo = p_tipo
       and creato_il > now() - interval '1 hour'
  );
$funzione$;

comment on function allarme_frenato(text) is
  'Vero se un avviso di questo tipo e'' gia'' uscito nell''ultima ora. E'' il freno anti-tempesta, isolato dall''invio perche'' si possa provare senza mandare messaggi veri.';

revoke all on function allarme_frenato(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Il tipo di un avviso di rincaro identifica IL RINCARO
-- ---------------------------------------------------------------------
create or replace function tipo_allarme_rincaro(
  p_ingrediente text,
  p_versione    text,
  p_prezzo      numeric
)
returns text
language sql
immutable
set search_path = public
as $funzione$
  select 'rincaro_' || coalesce(p_ingrediente, '?')
      || ' · ' || coalesce(nullif(trim(p_versione), ''), '—')
      || ' · ' || to_char(coalesce(p_prezzo, 0), 'FM9999999990.0000');
$funzione$;

comment on function tipo_allarme_rincaro(text, text, numeric) is
  'Il tipo di un avviso di rincaro: ingrediente + versione + prezzo nuovo. Due rincari diversi sono due avvisi; lo stesso rincaro ripetuto resta uno solo.';

revoke all on function tipo_allarme_rincaro(text, text, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. `segnala_allarme` usa il freno invece di contenerlo
-- ---------------------------------------------------------------------
create or replace function segnala_allarme(
  p_tipo      text,
  p_messaggio text,
  p_dettagli  jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_id    uuid;
  v_firma text;
  v_anon  text;
  v_base  text;
begin
  -- Freno anti-tempesta: un guasto a raffica produce UN avviso all'ora.
  -- La regola sta in `allarme_frenato()` perche' si possa verificare
  -- senza spedire niente.
  if allarme_frenato(p_tipo) then
    return false;
  end if;

  insert into allarmi (tipo, messaggio, dettagli)
  values (p_tipo, p_messaggio, p_dettagli)
  returning id into v_id;

  select decrypted_secret into v_firma from vault.decrypted_secrets where name = 'notifiche_firma';
  select decrypted_secret into v_anon  from vault.decrypted_secrets where name = 'chiave_anon';
  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'url_funzioni'),
    'https://oudjuqbqszisdtwzbxdo.supabase.co/functions/v1'
  ) into v_base;

  if v_firma is null or v_anon is null then
    raise warning 'Allarme registrato ma non inviato: parola d''ordine assente dal Vault.';
    return true;
  end if;

  perform net.http_post(
    url := v_base || '/notify-telegram-reservation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'x-borgo58-firma', v_firma
    ),
    body := jsonb_build_object(
      'type', 'allarme',
      'allarme', jsonb_build_object('tipo', p_tipo, 'messaggio', p_messaggio, 'quando', now())
    )
  );

  update allarmi set notificato = true where id = v_id;
  return true;
end
$funzione$;

comment on function segnala_allarme(text, text, jsonb) is
  'Registra un guasto vero e lo manda su Telegram. Mai piu'' di uno per tipo in un''ora (`allarme_frenato`). Restituisce false se il freno ha fermato l''avviso.';

revoke all on function segnala_allarme(text, text, jsonb) from public, anon;
grant execute on function segnala_allarme(text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Il carico costruisce il tipo dell'avviso con la funzione nuova
--    (unica riga cambiata rispetto a `20260812000018`)
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
        'Rincaro su ' || (v_riga->>'ingrediente') || ' (' || (v_riga->>'versione') || '): da ' ||
          (v_riga->>'prima') || ' a ' || (v_riga->>'adesso') ||
          ' (+' || (v_riga->>'variazione') || '%)' ||
          coalesce(', +' || (v_riga->>'variazione_totale') || '% da quando lo compri', '') ||
          coalesce(' — ' || v_nota, ''),
        v_riga
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
-- 5. Verifica (§7 punti 1-3) — e non parte nemmeno un messaggio
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ing     text := 'PROVA FRENO pomodoro';
  v_cassa   text := 'Pomodori cassa da 6 kg';
  v_bott    text := 'Pomodori vaschetta da 500 g';
  t_prima   text;
  t_dopo    text;
  t_uguale  text;
  t_altra   text;
  t_vecchio text := 'rincaro_PROVA FRENO pomodoro';
  t_guasto  text := '__prova_freno_guasto__';
  t_scaduto text := '__prova_freno_scaduto__';
  n         integer;
begin
  -- 0. Le due funzioni sono davvero collegate a chi le deve usare.
  --    Senza questo controllo si puo' correggere l'aiuto e lasciare il
  --    chiamante com'era: la migrazione passerebbe e il difetto
  --    resterebbe vivo, che e' esattamente com'e' nato.
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'esegui_azione_posta'
     and pg_get_functiondef(p.oid) like '%tipo_allarme_rincaro%';
  if n <> 1 then
    raise exception 'Il carico non usa tipo_allarme_rincaro: la correzione non e'' collegata.';
  end if;

  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'segnala_allarme'
     and pg_get_functiondef(p.oid) like '%allarme_frenato%';
  if n <> 1 then
    raise exception 'segnala_allarme non usa allarme_frenato: il freno non e'' verificabile.';
  end if;

  -- 1. Il tipo distingue due rincari diversi sullo stesso prodotto.
  t_prima  := tipo_allarme_rincaro(v_ing, v_cassa, 3.60);
  t_dopo   := tipo_allarme_rincaro(v_ing, v_cassa, 3.90);
  t_uguale := tipo_allarme_rincaro(v_ing, v_cassa, 3.6000);
  t_altra  := tipo_allarme_rincaro(v_ing, v_bott,  3.90);

  if t_prima = t_dopo then
    raise exception 'Due prezzi diversi producono lo stesso tipo: il freno li zittirebbe ancora.';
  end if;
  if t_prima is distinct from t_uguale then
    raise exception 'Lo stesso prezzo scritto con piu'' decimali produce un tipo diverso: lo stesso avviso uscirebbe due volte.';
  end if;
  if t_dopo = t_altra then
    raise exception 'Due versioni diverse allo stesso prezzo producono lo stesso tipo: un avviso vero sparirebbe.';
  end if;

  -- 2. Si parte pulito, altrimenti il freno falserebbe la prova.
  delete from allarmi
   where tipo in (t_prima, t_dopo, t_uguale, t_altra, t_vecchio, t_guasto, t_scaduto);

  if allarme_frenato(t_prima) then
    raise exception 'Il freno e'' gia'' tirato su un tipo di cui non esiste nessun avviso.';
  end if;

  -- 3. LO STESSO RINCARO NON SI RIPETE.
  insert into allarmi (tipo, messaggio) values (t_prima, 'primo rincaro, di prova');
  if not allarme_frenato(t_prima) then
    raise exception 'Lo stesso identico rincaro uscirebbe due volte.';
  end if;

  -- 4. UN RINCARO DIVERSO PASSA — e' la correzione di questa migrazione.
  if allarme_frenato(t_dopo) then
    raise exception 'Un rincaro diverso, nella stessa ora, viene ancora zittito.';
  end if;

  -- 5. La prova al contrario: col tipo di ieri sarebbe stato zittito.
  --    Un controllo che non ha mai visto fallire non e'' un controllo.
  insert into allarmi (tipo, messaggio) values (t_vecchio, 'col tipo vecchio, di prova');
  if not allarme_frenato(t_vecchio) then
    raise exception 'Il tipo vecchio non frenava: allora il difetto del 12/08 non si spiega.';
  end if;

  -- 6. Per un guasto che si ripete il freno resta, ed e' giusto cosi'.
  if allarme_frenato(t_guasto) then
    raise exception 'Il freno risulta tirato su un guasto mai segnalato.';
  end if;
  insert into allarmi (tipo, messaggio) values (t_guasto, 'guasto di prova');
  if not allarme_frenato(t_guasto) then
    raise exception 'Un guasto identico a raffica riempirebbe di nuovo il telefono.';
  end if;

  -- 7. Passata l'ora, lo stesso tipo torna a parlare.
  insert into allarmi (tipo, messaggio, creato_il)
  values (t_scaduto, 'guasto di prova, vecchio', now() - interval '2 hours');
  if allarme_frenato(t_scaduto) then
    raise exception 'Un avviso di due ore fa frena ancora: il guasto resterebbe muto per sempre.';
  end if;

  -- 8. Pulizia (regola del 12/08): la prova non lascia niente dietro.
  delete from allarmi
   where tipo in (t_prima, t_dopo, t_uguale, t_altra, t_vecchio, t_guasto, t_scaduto);

  select count(*) into n from allarmi
   where tipo in (t_prima, t_dopo, t_uguale, t_altra, t_vecchio, t_guasto, t_scaduto);
  if n <> 0 then
    raise exception 'La prova ha lasciato % avvisi nel database.', n;
  end if;

  raise notice 'Un rincaro e'' un fatto nuovo: stesso rincaro una volta sola, rincaro diverso sempre.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260813000001', 'un_rincaro_e_un_fatto_nuovo')
on conflict (version) do nothing;

-- Riepilogo: quanti avvisi di rincaro esistono e con quanti tipi diversi.
select count(*)                                      as avvisi_di_rincaro,
       count(distinct tipo)                          as tipi_diversi
  from allarmi
 where tipo like 'rincaro%';
