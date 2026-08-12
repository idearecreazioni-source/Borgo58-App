-- =====================================================================
-- Un avviso si legge col telefono in mano, non si decifra
-- =====================================================================
-- Chiesto da Alessio il 13/08/2026 guardando i quattro avvisi arrivati:
-- «come mai tutti quegli zeri dopo i prezzi?»
--
--   Rincaro su Pomodoro ciliegino (...): da 3.9000 a 4.0500 (+3.8%),
--   +26.6% da quando lo compri
--
-- I numeri erano giusti: `3.9000` e' il modo in cui il database tiene un
-- prezzo, non un errore di calcolo. Ma un avviso che arriva sul telefono
-- durante un servizio si guarda per un secondo e mezzo, e in quel secondo
-- e mezzo «3.9000» costa piu' fatica di «3,90 €». Le cifre inutili non
-- sono un dettaglio estetico: sono rumore su un canale che deve restare
-- leggibile, ed e' lo stesso motivo per cui esiste il freno anti-tempesta.
--
-- Guardando la schermata dei messaggi ne sono usciti altri due, e il
-- secondo e' piu' grave degli zeri.
--
-- 1. `Tipo: rincaro_Pomodoro ciliegino · Pomodori ciliegini di Pachino
--    IGP, cassa da 6 kg · 4.0500` — roba interna finita sul telefono di
--    Alessio. Serve a me per diagnosticare un guasto, non a lui per
--    decidere se telefonare al fornitore.
--
-- 2. ⚠️ «Di questo avviso ne arriva uno solo all'ora, anche se il guasto
--    si ripete» — **da oggi e' FALSA per i rincari**: e' la frase che
--    descriveva esattamente il difetto tolto stanotte. Un messaggio che
--    spiega male come funziona il sistema e' peggio di un numero scritto
--    brutto: insegna ad aspettare un avviso gia' arrivato, o a non
--    aspettarne uno che arrivera'. E si crede alla frase, non al codice.
--
-- 3. E la terza, che nessuno aveva chiesto ma va detta: un rincaro
--    arrivava sotto il titolo «⚠️ QUALCOSA NON VA», lo stesso di un
--    guasto del sistema. Non e' la stessa cosa — un fornitore che alza i
--    prezzi e' il gestionale che **funziona** — e mettere le due cose
--    sotto lo stesso titolo insegna a leggere quel triangolo come
--    rumore. Il giorno in cui arriva un guasto vero, e' il costo di
--    averlo confuso.
--
-- ⚠️ COME SI DISTINGUONO I DUE TIPI DI AVVISO: la categoria la dichiara
-- il database, non la indovina la funzione dei messaggi guardando come
-- comincia il testo del tipo. Un controllo sul prefisso avrebbe legato
-- il modo di scrivere il titolo al modo di scrivere la chiave del freno:
-- due cose che oggi coincidono e domani no, senza che niente lo segnali.
--
-- ⚠️ `segnala_allarme` viene RICREATA, non affiancata: aggiungere un
-- parametro in piu' crea una funzione NUOVA, e due sovrapposte rendono
-- ambigua ogni chiamata per nome (42725, a tempo di esecuzione, sulla
-- prima chiamata vera). Stessa trappola di `register_stock_delivery` il
-- 12/08. Le chiamate a due e tre argomenti continuano a funzionare
-- grazie ai valori predefiniti. E dopo un `drop` i permessi tornano
-- quelli di partenza — cioe' eseguibile da chiunque abbia la chiave
-- pubblica — quindi la revoca qui sotto non e' una formalita'.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Numeri come li scrive una persona
-- ---------------------------------------------------------------------
create or replace function prezzo_leggibile(p_prezzo numeric)
returns text
language sql
immutable
set search_path = public
as $funzione$
  select replace(to_char(round(coalesce(p_prezzo, 0), 2), 'FM9999999990.00'), '.', ',') || ' €';
$funzione$;

comment on function prezzo_leggibile(numeric) is
  'Un prezzo come si scrive su un foglio: 3,90 €. Il database ne tiene quattro decimali, chi legge ne vuole due.';

create or replace function percentuale_leggibile(p_valore numeric)
returns text
language sql
immutable
set search_path = public
as $funzione$
  select case when coalesce(p_valore, 0) > 0 then '+' else '' end
      || replace(to_char(round(coalesce(p_valore, 0), 1), 'FM99999990.0'), '.', ',')
      || '%';
$funzione$;

comment on function percentuale_leggibile(numeric) is
  'Una variazione come si legge: +3,8%. Il segno c''e'' sempre quando sale, perche'' e'' l''unica cosa che conta al primo sguardo.';

revoke all on function prezzo_leggibile(numeric) from public, anon, authenticated;
revoke all on function percentuale_leggibile(numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Il testo dell'avviso, in un posto solo e verificabile
-- ---------------------------------------------------------------------
create or replace function messaggio_rincaro(p_rincaro jsonb, p_documento text default null)
returns text
language sql
immutable
set search_path = public
as $funzione$
  select 'Rincaro su ' || (p_rincaro->>'ingrediente')
      || ' (' || (p_rincaro->>'versione') || '): da '
      || prezzo_leggibile((p_rincaro->>'prima')::numeric)
      || ' a ' || prezzo_leggibile((p_rincaro->>'adesso')::numeric)
      || ' (' || percentuale_leggibile((p_rincaro->>'variazione')::numeric) || ')'
      || coalesce(', ' || percentuale_leggibile((p_rincaro->>'variazione_totale')::numeric)
                       || ' da quando lo compri', '')
      || coalesce(' — ' || nullif(p_documento, ''), '');
$funzione$;

comment on function messaggio_rincaro(jsonb, text) is
  'Il testo di un avviso di rincaro. In un posto solo perche'' si possa provare che si legge, invece di scoprirlo dal telefono.';

revoke all on function messaggio_rincaro(jsonb, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. L'avviso dichiara di che tipo di cosa sta parlando
-- ---------------------------------------------------------------------
drop function if exists segnala_allarme(text, text, jsonb);

create or replace function segnala_allarme(
  p_tipo      text,
  p_messaggio text,
  p_dettagli  jsonb default null,
  p_categoria text default 'guasto'
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
      'allarme', jsonb_build_object(
        'tipo', p_tipo,
        'messaggio', p_messaggio,
        'categoria', coalesce(nullif(p_categoria, ''), 'guasto'),
        'quando', now())
    )
  );

  update allarmi set notificato = true where id = v_id;
  return true;
end
$funzione$;

comment on function segnala_allarme(text, text, jsonb, text) is
  'Registra un avviso e lo manda su Telegram. Mai piu'' di uno per tipo in un''ora (`allarme_frenato`). La categoria — «guasto» o «rincaro» — decide come viene presentato a chi lo riceve, e la dichiara chi lo segnala: non si indovina dal testo del tipo.';

revoke all on function segnala_allarme(text, text, jsonb, text) from public, anon, authenticated;
grant execute on function segnala_allarme(text, text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Il carico scrive un avviso che si legge, e dice che e' un rincaro
--    (sole righe cambiate rispetto a `20260813000001`)
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
-- 5. Verifica (§7 punti 1-3) — e non parte nemmeno un messaggio
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_riga   jsonb;
  v_testo  text;
  v_atteso text;
  n        integer;
begin
  -- 1. I numeri si leggono.
  if prezzo_leggibile(3.9000) is distinct from '3,90 €' then
    raise exception 'Un prezzo esce come %, atteso 3,90 €.', prezzo_leggibile(3.9000);
  end if;
  if prezzo_leggibile(13.2) is distinct from '13,20 €' then
    raise exception 'Un prezzo esce come %, atteso 13,20 €.', prezzo_leggibile(13.2);
  end if;
  if percentuale_leggibile(3.8) is distinct from '+3,8%' then
    raise exception 'Una variazione esce come %, attesa +3,8%%.', percentuale_leggibile(3.8);
  end if;
  -- Un calo non prende il segno + (oggi non produce avvisi, ma la
  -- funzione non deve mentire se un domani lo facesse).
  if percentuale_leggibile(-2.5) is distinct from '-2,5%' then
    raise exception 'Un calo esce come %, atteso -2,5%%.', percentuale_leggibile(-2.5);
  end if;

  -- 2. Il testo intero, con i numeri veri del collaudo di stanotte.
  v_riga := jsonb_build_object(
    'ingrediente',       'Pomodoro ciliegino',
    'versione',          'Pomodori ciliegini di Pachino IGP, cassa da 6 kg',
    'prima',             3.9000,
    'adesso',            4.0500,
    'variazione',        3.8,
    'variazione_totale', 26.6);

  v_atteso := 'Rincaro su Pomodoro ciliegino (Pomodori ciliegini di Pachino IGP, cassa da 6 kg): '
           || 'da 3,90 € a 4,05 € (+3,8%), +26,6% da quando lo compri — FT 2026/PROVA-4';
  v_testo := messaggio_rincaro(v_riga, 'FT 2026/PROVA-4');
  if v_testo is distinct from v_atteso then
    raise exception 'L''avviso esce «%» invece che «%».', v_testo, v_atteso;
  end if;

  -- 3. Nessuno zero di troppo rimasto in giro.
  if v_testo like '%0000%' or v_testo like '%.%' then
    raise exception 'Nell''avviso c''e'' ancora un numero scritto come lo scrive il database: %', v_testo;
  end if;

  -- 4. Senza documento non resta un trattino appeso.
  if messaggio_rincaro(v_riga, null) like '%—%' then
    raise exception 'Senza il numero del documento resta un trattino senza niente dopo.';
  end if;

  -- 5. Il carico usa davvero il testo nuovo e dichiara la categoria.
  --    Senza questo si puo' correggere l'aiuto e lasciare il chiamante
  --    com'era: e' cosi' che nascono i difetti che sembrano corretti.
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'esegui_azione_posta'
     and pg_get_functiondef(p.oid) like '%messaggio_rincaro%'
     and pg_get_functiondef(p.oid) like '%''rincaro''%';
  if n <> 1 then
    raise exception 'Il carico non usa il testo nuovo o non dichiara la categoria.';
  end if;

  -- 6. Di `segnala_allarme` ce n'e' UNA sola: due sovrapposte renderebbero
  --    ambigua ogni chiamata per nome, a tempo di esecuzione (42725).
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'segnala_allarme';
  if n <> 1 then
    raise exception 'Esistono % versioni di segnala_allarme: le chiamate diventerebbero ambigue.', n;
  end if;

  -- 7. Il `drop` ha rimesso i permessi di partenza? La revoca deve aver
  --    richiuso la porta.
  if has_function_privilege('anon', 'public.segnala_allarme(text,text,jsonb,text)', 'execute') then
    raise exception 'Dopo il drop, segnala_allarme e'' eseguibile con la chiave pubblica del sito.';
  end if;

  -- 8. E l'elenco di chi puo' bussare da fuori e' rimasto quello.
  select count(*) into n from funzioni_aperte_ad_anon();
  if n <> 12 then
    raise exception 'Le funzioni aperte da fuori sono %, attese 12.', n;
  end if;

  raise notice 'Gli avvisi si leggono: 3,90 €, +3,8%%, e il rincaro dice di essere un rincaro.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260813000003', 'un_avviso_si_legge_al_volo')
on conflict (version) do nothing;

select messaggio_rincaro(dettagli, null) as come_si_leggerebbe_oggi
  from allarmi
 where dettagli ? 'ingrediente'
 order by creato_il desc
 limit 3;
