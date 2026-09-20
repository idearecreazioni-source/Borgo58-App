-- =====================================================================
-- Borgo 58 · Un mancato riscontro non è un «non arrivato»
-- =====================================================================
-- 20/09/2026.
--
-- 🔴 MISURATO SU BORGO58-PROVA IL 19/09. Il promemoria «TEST Telegram Prova»
--    è ARRIVATO su Telegram alle 18:05:07, e il gestionale l'ha registrato
--    «fallito» con la frase *«La richiesta non è arrivata alla funzione
--    online: Timeout of 5000 ms reached»*. Due cose sbagliate insieme:
--      1. l'attesa era il predefinito di pg_net — **5 secondi** — e nessuna
--         delle 13 migrazioni che usano `net.http_post` l'aveva mai scritto;
--      2. una risposta che non torna veniva dichiarata **non arrivata**.
--
-- ⚠️ IL DOPPIONE NON C'È MAI STATO, e questo chiude il caso sul rischio: il
--    tentativo successivo ha portato la stessa chiave, chi riceve ha risposto
--    «già consegnato» e il promemoria è diventato «riuscito» alle 18:20. Il
--    costo era un **avviso falso** su Telegram e un tentativo dei tre.
--
-- ⚠️ E L'ATTESA A FREDDO NON È UN CASO RARO: la prima chiamata dopo ogni
--    installazione della funzione online paga l'avvio. Misurato lo stesso
--    giorno: oltre 5 secondi a freddo, **68 millisecondi** a caldo.
--
-- ⚠️ I CORPI SONO RIPRESI DAL DATABASE (regola del 18/08): cambiano il tetto
--    dell'attesa e un ramo della decisione, il resto è identico.

-- send_due_task_reminders — dal corpo vivo, con il tetto dell'attesa
CREATE OR REPLACE FUNCTION public.send_due_task_reminders()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r        record;
  v_firma  text;
  v_anon   text;
  v_base   text;
  v_req    bigint;
  v_tent   integer;
  v_chiave text;
  v_riga   uuid;
  v_fermi  integer;
begin
  select decrypted_secret into v_firma from vault.decrypted_secrets where name = 'notifiche_firma';
  select decrypted_secret into v_anon  from vault.decrypted_secrets where name = 'chiave_anon';

  -- Se non si può notificare, NON si marca niente come inviato — altrimenti
  -- sparirebbe senza essere mai arrivato. E non si segna il giro come
  -- riuscito: questo è un guasto, e la sentinella deve vederlo.
  if v_firma is null or v_anon is null then
    raise warning 'Promemoria Telegram saltati: parola d''ordine o chiave assenti dal Vault.';
    perform segnala_allarme(
      'notifiche_senza_chiavi',
      'I promemoria non partono: manca la parola d''ordine nel Vault del database.'
    );
    return;
  end if;

  -- 🔴 L'INDIRIZZO È QUELLO DI QUESTO DATABASE, e se manca ci si ferma qui.
  v_base := url_delle_funzioni();

  for r in
    select t.*, chiave_di_consegna(t.id, t.remind_at) as chiave_consegna
      from tasks t
     where t.remind_at is not null
       and t.remind_at <= now()
       and t.reminder_sent_at is null
       and t.status <> 'completato'
       -- Uno alla volta per consegna: finché una richiesta è in volo non se
       -- ne accoda un'altra per lo stesso avviso.
       and not exists (
         select 1 from invii_promemoria i
          where i.chiave = chiave_di_consegna(t.id, t.remind_at) and i.esito = 'in_volo')
       -- 🔴 DA «NON LO SAPRÒ MAI» NON SI RIPROVA. Riprovare potrebbe mandare
       --    un secondo Telegram, e questo giro non lo fa mai. La riga resta
       --    con reminder_sent_at vuoto, visibile e allarmata.
       and not exists (
         select 1 from invii_promemoria i
          where i.chiave = chiave_di_consegna(t.id, t.remind_at) and i.esito = 'esito_ignoto')
       -- ⚠️ UN TETTO AI TENTATIVI, ed è la lezione del 12/08: un lavoro che
       --    ritenta all'infinito chiede all'infinito. Il conto è PER
       --    CONSEGNA, non per impegno: un avviso spostato riparte da capo,
       --    ed è giusto — è un'altra consegna.
       and (select count(*) from invii_promemoria i
             where i.chiave = chiave_di_consegna(t.id, t.remind_at)) < 3
  loop
    -- ⚠️ OGNI AVVISO IN UN BLOCCO SUO: senza, un solo inciampo — una corsa
    --    persa sull'indice, un errore di rete — annullerebbe il giro INTERO
    --    e con esso gli avvisi già presi in carico.
    begin
      v_chiave := r.chiave_consegna;
      if v_chiave is null then
        continue;
      end if;

      select coalesce(max(i.tentativo), 0) + 1 into v_tent
        from invii_promemoria i where i.chiave = v_chiave;

      -- 🔴 IL POSSESSO PRIMA DELLA RICHIESTA, ED È UNA SCRITTURA. Se un
      --    altro giro ha già preso questo avviso, qui non si scrive niente
      --    e `v_riga` resta vuota: **non si accoda**. Prima la richiesta
      --    partiva e la riga si scriveva dopo, quindi due giri sovrapposti
      --    potevano accodarne due.
      insert into invii_promemoria (task_id, chiave, tentativo)
      values (r.id, v_chiave, v_tent)
      on conflict (chiave) where esito = 'in_volo' do nothing
      returning id into v_riga;

      if v_riga is null then
        continue;
      end if;

      -- 🔴 LA CHIAVE VIAGGIA CON LA RICHIESTA: è ciò che permette a chi
      --    riceve di riconoscere un ritentativo invece di mandare un
      --    secondo Telegram.
      select net.http_post(
        url := v_base || '/notify-telegram-reservation',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon,
          'x-borgo58-firma', v_firma
        ),
        body := jsonb_build_object(
          'type', 'task_reminder',
          'chiave_consegna', v_chiave,
          'task', to_jsonb(r) - 'chiave_consegna'),
        -- 🔴 TRENTA SECONDI, E NON E' UN NUMERO A CASO (20/09/2026). Il
        --    predefinito di pg_net e' 5.000 ms e nessuna migrazione lo aveva
        --    mai scritto. Misurato su Prova: una chiamata a freddo — la prima
        --    dopo l'installazione della funzione online — ha impiegato **piu'
        --    di 5 secondi** e ha prodotto un falso «non arrivato»; la stessa
        --    chiamata a funzione calda, **68 millisecondi**.
        -- ⚠️ Il tetto resta, e basso: un'attesa senza tetto tiene occupato il
        --    lavoratore di pg_net e sposta il problema invece di toglierlo.
        timeout_milliseconds := 30000
      ) into v_req;

      update invii_promemoria set richiesta_id = v_req where id = v_riga;

      -- 🔴 QUI NON SI SCRIVE `reminder_sent_at`, ED È METÀ DELLA CORREZIONE.
      --    La richiesta è soltanto ACCODATA. Lo scrive
      --    `raccogli_esiti_promemoria`, e solo davanti a una risposta.
    exception when others then
      raise warning 'Promemoria %: % ', r.id, sqlerrm;
    end;
  end loop;

  -- ⚠️ CHI NON PUÒ PIÙ PARTIRE NON SPARISCE E NON TACE: né chi ha esaurito
  --    i tentativi, né chi è finito in «non lo saprò mai».
  select count(*) into v_fermi
    from tasks t
   where t.remind_at is not null
     and t.remind_at <= now()
     and t.reminder_sent_at is null
     and t.status <> 'completato'
     and (
       exists (select 1 from invii_promemoria i
                where i.chiave = chiave_di_consegna(t.id, t.remind_at)
                  and i.esito = 'esito_ignoto')
       or (select count(*) from invii_promemoria i
            where i.chiave = chiave_di_consegna(t.id, t.remind_at)) >= 3
     );

  if v_fermi > 0 then
    perform segnala_allarme(
      'promemoria_senza_recapito',
      'Ci sono ' || v_fermi || ' avvisi dell''Agenda che non riescono a partire. Non sono stati persi: restano scritti, e il perché è nel registro degli invii. Alcuni potrebbero essere arrivati senza che si sia potuto confermarlo — in quel caso non vengono rimandati, per non mandarli due volte.',
      jsonb_build_object('quanti', v_fermi));
  end if;

  -- Il giro è arrivato in fondo: è questa riga che permette di accorgersi,
  -- fra mezz'ora, che il giro NON è più arrivato in fondo.
  insert into stato_lavori (nome, ultimo_successo) values ('promemoria_agenda', now())
  on conflict (nome) do update set ultimo_successo = excluded.ultimo_successo;
end;
$function$;

-- esito_di_un_invio — dal corpo vivo, con il ramo dell'attesa scaduta
CREATE OR REPLACE FUNCTION public.esito_di_un_invio(p_stato integer, p_corpo text, p_errore text)
 RETURNS TABLE(esito text, motivo text)
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare
  v_corpo    jsonb;
  v_estratto text := left(coalesce(nullif(btrim(coalesce(p_corpo, '')), ''), '(nessuna risposta)'), 300);
begin
  begin
    v_corpo := nullif(btrim(coalesce(p_corpo, '')), '')::jsonb;
  exception when others then
    v_corpo := null;
  end;

  -- 🔴 «NON LO SAPRÒ MAI» È UN ESITO A SÉ, e viene prima di tutto: chi
  --    riceve lo dichiara quando ha preso in carico la consegna e non l'ha
  --    mai confermata. Da lì non si riprova, o si rischia il doppione.
  if coalesce(v_corpo->>'esito', '') = 'ignoto' then
    return query select 'esito_ignoto',
      ('Chi riceve aveva già preso in carico questo avviso e non ha mai confermato: non si può sapere se sia arrivato, e riprovare rischierebbe di mandarlo due volte. ' || v_estratto)::text;
    return;
  end if;

  -- Un altro giro la sta mandando adesso: non è un guasto, si riguarda dopo.
  if coalesce(v_corpo->>'esito', '') = 'in_corso' then
    return query select 'in_volo', null::text;
    return;
  end if;

  -- 🔴 UN MANCATO RISCONTRO NON E' UN «NON ARRIVATO» (20/09/2026). Se la
  --    risposta non torna entro il tempo, quello che si sa e' **che non si
  --    sa**: la richiesta puo' essere arrivata benissimo. Dirlo «fallito»
  --    e' un'informazione di assenza spacciata per assenza di informazione,
  --    ed e' la regola del 19/08 («non vuol dire che e' vuota: vuol dire che
  --    non lo so»).
  -- ⚠️ E RIPROVARE RESTA SICURO, ed e' il motivo per cui questo esito non e'
  --    un problema: il tentativo successivo porta LA STESSA CHIAVE, quindi se
  --    l'avviso era gia' arrivato chi riceve risponde «gia' consegnato»
  --    invece di mandarne un secondo.
  if p_errore ilike '%timeout%' then
    return query select 'senza_risposta',
      ('Nessun riscontro entro il tempo: non si sa se l''avviso sia arrivato, quindi si riprova con la stessa chiave. ' || p_errore)::text;
    return;
  end if;

  -- Un errore che NON e' un'attesa scaduta e' un fatto certo: la richiesta
  -- non e' arrivata alla funzione online.
  if nullif(btrim(coalesce(p_errore, '')), '') is not null then
    return query select 'fallito',
      ('La richiesta non è arrivata alla funzione online: ' || p_errore)::text;
    return;
  end if;

  if p_stato is null then
    return query select 'senza_risposta',
      'Nessuna risposta: non si può dire se l''avviso sia arrivato, quindi si dichiara non arrivato.'::text;
    return;
  end if;

  -- ⚠️ `gia_consegnato` è un SUCCESSO, ed è la chiave di volta del
  --    ritentativo: vuol dire «l'avevo già mandato io». Senza questo ramo,
  --    un avviso davvero arrivato resterebbe per sempre «non arrivato».
  if p_stato between 200 and 299 and coalesce((v_corpo->>'ok')::boolean, false) then
    return query select 'riuscito', null::text;
    return;
  end if;

  if p_stato between 200 and 299 and coalesce(v_corpo->>'skipped', '') = 'true' then
    return query select 'fallito',
      'La funzione online ha risposto «va bene» ma NON ha mandato niente: non ha riconosciuto questo promemoria.'::text;
    return;
  end if;

  if p_stato between 200 and 299 then
    return query select 'fallito',
      ('La funzione online ha risposto ' || p_stato || ' senza dire di aver mandato: ' || v_estratto)::text;
    return;
  end if;

  return query select 'fallito',
    ('La funzione online ha risposto ' || p_stato || ': ' || v_estratto)::text;
end
$function$;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto  jsonb := foto_righe();
  v_e     record;
begin
  -- 1. Il tetto dell'attesa è scritto nel corpo vivo del giro che manda.
  if pg_get_functiondef('public.send_due_task_reminders'::regproc) not like '%timeout_milliseconds := 30000%' then
    raise exception 'VERIFICA: il giro dei promemoria non dichiara l''attesa di 30 secondi.';
  end if;

  -- 2. 🔴 UN CORPO CHE SI CREA NON È UN CORPO CHE FUNZIONA: la decisione si
  --    CHIAMA, su risposte inventate, senza mandare niente a nessuno.
  select * into v_e from esito_di_un_invio(null, null, 'Timeout of 30000 ms reached. Total time: 30001 ms');
  if v_e.esito <> 'senza_risposta' then
    raise exception 'VERIFICA: un''attesa scaduta è stata dichiarata «%», non «senza_risposta».', v_e.esito;
  end if;
  if v_e.motivo not like '%non si sa%' then
    raise exception 'VERIFICA: il motivo di un''attesa scaduta non dice che non si sa: %', v_e.motivo;
  end if;

  -- 3. E ALLO SPECCHIO — un errore che non è un'attesa resta un «non
  --    arrivato»: senza questo, il ramo nuovo avrebbe inghiottito anche i
  --    guasti veri, che è il difetto di oggi rovesciato.
  select * into v_e from esito_di_un_invio(null, null, 'Connection refused');
  if v_e.esito <> 'fallito' then
    raise exception 'VERIFICA: un guasto di rete è stato dichiarato «%», non «fallito».', v_e.esito;
  end if;

  -- 4. E i casi che non cambiano continuano a non cambiare.
  select * into v_e from esito_di_un_invio(200, '{"ok":true}', null);
  if v_e.esito <> 'riuscito' then
    raise exception 'VERIFICA: un invio riuscito è stato dichiarato «%».', v_e.esito;
  end if;
  select * into v_e from esito_di_un_invio(200, '{"skipped":true}', null);
  if v_e.esito <> 'fallito' then
    raise exception 'VERIFICA: un «non ho mandato niente» è stato dichiarato «%».', v_e.esito;
  end if;

  perform pretendi_nessun_residuo(v_foto, 'la verifica della 20260920000002');
  raise notice 'Verifica passata: attesa a 30 secondi, mancato riscontro «da verificare».';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260920000002', 'un_mancato_riscontro_non_e_un_non_arrivato') on conflict (version) do nothing;
