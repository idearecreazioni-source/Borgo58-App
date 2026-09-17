-- =====================================================================
-- Borgo 58 · Un promemoria risulta «inviato» solo se è arrivato
-- =====================================================================
-- 17/09/2026.
--
-- 🔴 TRE DIFETTI NELLA STESSA FUNZIONE — `send_due_task_reminders`, ultima
--    definizione in `20260810000005_allarmi.sql` righe 150-201 — e nessuno
--    dei tre dà un errore.
--
--    1. L'INDIRIZZO DELLA PRODUZIONE È SCRITTO FISSO (riga 184). È l'unica
--       funzione rimasta fuori dal meccanismo: le altre nove che bussano a
--       una funzione online leggono il segreto `url_funzioni` dal Vault.
--       ⚠️ Conseguenza: **su Borgo58-Prova i promemoria chiamano la funzione
--       della PRODUZIONE**. Oggi vengono respinti, perché la parola d'ordine
--       dei due progetti è diversa apposta — quindi quel percorso su Prova
--       **non è verificabile**, ed è il motivo di questo lavoro. 🔴 E il
--       giorno che le due parole d'ordine coincidessero per sbaglio, il
--       database di prova manderebbe Telegram veri dal bot vero.
--
--    2. «INVIATO» VUOL DIRE «ACCODATO». `net.http_post` mette la richiesta
--       in coda e restituisce un numero; quel numero veniva **buttato via**
--       (`perform`), e la riga subito dopo scriveva `reminder_sent_at =
--       now()`. Se Telegram non riceve niente — funzione online ferma,
--       parola d'ordine cambiata, rete caduta — il promemoria risulta
--       **mandato** e **non verrà mai più ritentato**. Il modo di fallire è
--       muto per costruzione: chi aspettava l'avviso se ne accorge il giorno
--       in cui serviva.
--
--    3. L'ESITO NON LO REGISTRA NIENTE. In tutto il gestionale non c'è una
--       riga che dica com'è finita una notifica: `net._http_response` non è
--       nominata da nessuna parte, e `stato_lavori` dice soltanto che il
--       GIRO è arrivato in fondo — non che un singolo avviso sia arrivato.
--
-- 🔴 E IL FALSO POSITIVO ERA PIÙ VICINO DI QUANTO SEMBRI. Costruire l'esito
--    sul CODICE DI STATO non basterebbe: `notify-telegram-reservation`
--    risponde **200 con `{"skipped": true}`** quando non compone nessun
--    messaggio, e **200 con `{"ok": true}`** quando l'ha mandato davvero —
--    *lo stesso codice per «mandato» e «non mandato»*. Il discriminante è
--    quindi il CORPO, non lo stato: altrimenti il difetto si sposterebbe di
--    un metro invece di chiudersi.
--    ⚠️ E LA FUNZIONE ONLINE NON SI TOCCA: quel `skipped` a 200 è **giusto**
--    per le prenotazioni inserite dallo staff, che non devono notificare.
--    Cambiarlo romperebbe un percorso sano per curarne un altro — e toglie
--    anche un passo di rilascio.
--
-- ⚠️ COSA NON CAMBIA, ed è la regola in vigore: un promemoria nasce solo se
--    qualcuno l'ha chiesto, nessun Telegram parte dalla sola dettatura, e un
--    avviso non chiesto non compare. Questa migrazione non tocca nessuna di
--    quelle strade — tocca soltanto che cosa si può **affermare** dopo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. LE TRE GUARDIE — questa migrazione si rifiuta invece di indovinare
-- ---------------------------------------------------------------------

-- 🔴 UNA FUNZIONE SI RISCRIVE DAL CORPO VIVO, MAI DAL FILE CHE L'HA CREATA
--    (regola del 18/08/2026, nata da una perdita silenziosa: fra il file e
--    il database ci stanno tutte le migrazioni che l'hanno toccata).
-- ⚠️ Da dove questa migrazione è stata scritta il corpo vivo NON si poteva
--    leggere. Allora il controllo si rovescia: invece di fidarsi, la
--    migrazione **descrive il corpo che si aspetta di sostituire** e si
--    ferma se ne trova un altro. Non confronta il testo intero — spazi e a
--    capo cambiano da soli — ma i tre fatti su cui poggia la correzione.
do $guardia$
declare
  v_corpo text;
begin
  select pg_get_functiondef(p.oid) into v_corpo
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'send_due_task_reminders'
     and p.prokind = 'f';

  if v_corpo is null then
    raise exception 'GUARDIA: send_due_task_reminders non esiste in questo database.';
  end if;

  if position('oudjuqbqszisdtwzbxdo' in v_corpo) = 0 then
    raise exception 'GUARDIA: la funzione viva non contiene l''indirizzo scritto fisso che questa migrazione toglie. Qualcuno l''ha già cambiata: leggi il corpo vivo (npm run funzione:viva) e riscrivi questa migrazione da quello, invece di sovrascrivere un lavoro che non hai visto.';
  end if;

  if position('reminder_sent_at = now()' in v_corpo) = 0 then
    raise exception 'GUARDIA: la funzione viva non scrive più reminder_sent_at nel modo che questa migrazione si aspetta. Leggi il corpo vivo prima di applicare.';
  end if;

  if position('url_funzioni' in v_corpo) > 0 then
    raise exception 'GUARDIA: la funzione viva legge già url_funzioni — questa migrazione è già stata applicata, o superata da un''altra.';
  end if;
end $guardia$;

-- 🔴 SI PUÒ LEGGERE COM'È FINITA UNA RICHIESTA? Tutta la correzione poggia
--    su `net._http_response`, che è di pg_net e non nostra. Se domani
--    cambiasse forma, l'esito diventerebbe illeggibile — e un esito
--    illeggibile letto come «riuscito» sarebbe il difetto di oggi con un
--    altro nome. Quindi si guarda PRIMA, e si rifiuta.
do $guardia$
declare
  v_mancanti text[];
begin
  select coalesce(array_agg(c), '{}'::text[]) into v_mancanti
    from unnest(array['id', 'status_code', 'content', 'error_msg', 'created']) c
   where not exists (
     select 1 from information_schema.columns k
      where k.table_schema = 'net'
        and k.table_name = '_http_response'
        and k.column_name = c);

  if array_length(v_mancanti, 1) > 0 then
    raise exception 'GUARDIA: in net._http_response mancano le colonne %. Senza quelle non si può sapere com''è finita una richiesta, e un esito che non si può leggere non si può dichiarare.',
      array_to_string(v_mancanti, ', ');
  end if;
end $guardia$;

-- 🔴 E QUESTO DATABASE SA QUAL È IL PROPRIO INDIRIZZO? Da qui in avanti i
--    promemoria chiamano SOLO la funzione online del proprio progetto, senza
--    nessun ripiego sull'indirizzo della produzione.
-- ⚠️ IL RIPIEGO ERA IL DIFETTO, non una comodità: `coalesce(vault,
--    indirizzo-della-produzione)` vuol dire che un database che non si è
--    configurato chiama **il gestionale vero**. È un guardiano che fallisce
--    APERTO, ed è il contrario di quello che serve qui. Tolto il ripiego, un
--    segreto che manca deve fermare l'applicazione — non farla passare e
--    spegnere gli avvisi in silenzio.
do $guardia$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'url_funzioni') then
    raise exception 'GUARDIA: nel Vault di questo database manca il segreto «url_funzioni», e senza quello i promemoria non saprebbero a quale progetto appartengono. Impostalo (è l''indirizzo delle funzioni online di QUESTO progetto, quello che finisce con /functions/v1) e riapplica. Nessun valore va copiato da un altro progetto.';
  end if;
end $guardia$;

-- ---------------------------------------------------------------------
-- 1. L'indirizzo delle funzioni online di QUESTO database, in un posto solo
-- ---------------------------------------------------------------------
create or replace function url_delle_funzioni()
returns text
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_url text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'url_funzioni';
  v_url := nullif(btrim(coalesce(v_url, '')), '');
  if v_url is null then
    raise exception 'Nel Vault di questo database manca «url_funzioni»: non so a quale progetto appartengo, e non tiro a indovinare.';
  end if;
  -- La barra finale si toglie qui una volta sola: chi compone l'indirizzo
  -- aggiunge sempre «/nome-funzione», e due barre di fila danno un 404 che
  -- somiglia a una funzione non installata.
  return rtrim(v_url, '/');
end
$funzione$;

comment on function url_delle_funzioni() is
  'L''indirizzo delle funzioni online di QUESTO progetto, dal Vault. Nessun ripiego: un segreto che manca è un rifiuto, perché il ripiego sarebbe l''indirizzo della produzione.';

revoke all on function url_delle_funzioni() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Il registro degli invii: è qui che un esito diventa leggibile
-- ---------------------------------------------------------------------
create table if not exists invii_promemoria (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references tasks(id) on delete cascade,
  richiesta_id bigint,
  tentativo    integer not null,
  chiesto_il   timestamptz not null default now(),
  esito        text not null default 'in_volo'
               constraint invii_promemoria_esito_check
               check (esito in ('in_volo', 'riuscito', 'fallito', 'senza_risposta')),
  codice       integer,
  motivo       text,
  deciso_il    timestamptz
);

comment on table invii_promemoria is
  'Un tentativo di mandare un promemoria su Telegram, e com''è finito. Esiste perché fino al 17/09/2026 «inviato» voleva dire soltanto «accodato»: nessuna riga diceva se l''avviso fosse arrivato.';
comment on column invii_promemoria.richiesta_id is
  'Il numero che pg_net restituisce accodando la richiesta. Prima veniva buttato via, ed è il motivo per cui l''esito non si poteva più ritrovare.';
comment on column invii_promemoria.esito is
  'in_volo = accodato, non si sa ancora · riuscito = la funzione online ha detto di aver mandato · fallito = non è arrivato, e il perché è in motivo · senza_risposta = nessuna risposta è mai tornata.';
comment on column invii_promemoria.motivo is
  'Perché non è arrivato, in italiano. È la parte che si legge quando qualcosa non torna.';
comment on constraint invii_promemoria_esito_check on invii_promemoria is
  'Un invio può essere solo in volo, riuscito, fallito o senza risposta: non esiste un quinto stato, e «probabilmente arrivato» non è un esito.';

-- 🔴 NIENTE DOPPIONI, E NON PER GENTILEZZA: il giro gira ogni cinque minuti,
--    e senza questo indice lo stesso promemoria verrebbe riaccodato a ogni
--    giro finché la risposta non torna — cioè Alessio riceverebbe lo stesso
--    avviso più volte. L'invariante sta nell'indice e non in un controllo
--    dentro la funzione, come ovunque in questo progetto.
create unique index if not exists invii_promemoria_uno_in_volo
  on invii_promemoria (task_id) where esito = 'in_volo';

create index if not exists invii_promemoria_per_task on invii_promemoria (task_id);

alter table invii_promemoria enable row level security;
drop policy if exists invii_promemoria_titolare on invii_promemoria;
create policy invii_promemoria_titolare on invii_promemoria
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ---------------------------------------------------------------------
-- 3. LA DECISIONE, SEPARATA DALL'INVIO
-- ---------------------------------------------------------------------
-- 🔴 STA IN UNA FUNZIONE SUA perché è l'unico modo di PROVARLA. Dentro il
--    giro che manda, l'unica maniera di metterla alla prova sarebbe far
--    partire richieste vere — cioè far suonare il telefono di Alessio per
--    collaudare un guardiano. È la stessa scelta dell'email di conferma
--    (11/08) e della sentinella (12/08), per la stessa ragione.
--
-- ⚠️ E IL DISCRIMINANTE È IL CORPO, NON IL CODICE DI STATO. La funzione
--    online risponde 200 in due casi opposti: `{"ok":true}` quando ha
--    mandato, `{"skipped":true}` quando non ha composto nessun messaggio.
--    Guardare lo stato direbbe «arrivato» in tutt'e due.
--
-- 🔴 E UN CORPO CHE NON SI RIESCE A LEGGERE NON È UN SUCCESSO. È la regola
--    del progetto: *«non vuol dire che è vuota, vuol dire che non lo so»* —
--    e qui «non lo so» deve comportarsi come «non è arrivato», altrimenti si
--    riapre esattamente il buco che questa migrazione chiude.
create or replace function esito_di_un_invio(p_stato integer, p_corpo text, p_errore text)
returns table (arrivato boolean, motivo text)
language plpgsql
immutable
set search_path = public
as $funzione$
declare
  v_corpo  jsonb;
  v_estratto text := left(coalesce(nullif(btrim(coalesce(p_corpo, '')), ''), '(nessuna risposta)'), 300);
begin
  begin
    v_corpo := nullif(btrim(coalesce(p_corpo, '')), '')::jsonb;
  exception when others then
    v_corpo := null;
  end;

  if nullif(btrim(coalesce(p_errore, '')), '') is not null then
    return query select false,
      ('La richiesta non è arrivata alla funzione online: ' || p_errore)::text;
    return;
  end if;

  if p_stato is null then
    return query select false,
      'Nessuna risposta: non si può dire se l''avviso sia arrivato, quindi si dichiara non arrivato.'::text;
    return;
  end if;

  if p_stato between 200 and 299 and coalesce((v_corpo->>'ok')::boolean, false) then
    return query select true, null::text;
    return;
  end if;

  if p_stato between 200 and 299 and coalesce(v_corpo->>'skipped', '') = 'true' then
    return query select false,
      'La funzione online ha risposto «va bene» ma NON ha mandato niente: non ha riconosciuto questo promemoria.'::text;
    return;
  end if;

  if p_stato between 200 and 299 then
    return query select false,
      ('La funzione online ha risposto ' || p_stato || ' senza dire di aver mandato: ' || v_estratto)::text;
    return;
  end if;

  return query select false,
    ('La funzione online ha risposto ' || p_stato || ': ' || v_estratto)::text;
end
$funzione$;

comment on function esito_di_un_invio(integer, text, text) is
  'Questa risposta vuol dire che l''avviso è ARRIVATO? Decide e basta: non manda niente e non scrive niente, così si può provare su risposte inventate senza far partire un Telegram. Il discriminante è il corpo («ok»), non il codice di stato: la funzione online risponde 200 sia quando ha mandato sia quando non ha mandato niente.';

revoke all on function esito_di_un_invio(integer, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Il giro che manda — accoda, e NON dichiara più niente
-- ---------------------------------------------------------------------
create or replace function send_due_task_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  r       record;
  v_firma text;
  v_anon  text;
  v_base  text;
  v_req   bigint;
  v_tent  integer;
  v_fermi integer;
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
  --    Prima era l'indirizzo della produzione, scritto fisso: su Prova questo
  --    giro bussava al gestionale vero.
  v_base := url_delle_funzioni();

  for r in
    select t.*
      from tasks t
     where t.remind_at is not null
       and t.remind_at <= now()
       and t.reminder_sent_at is null
       and t.status <> 'completato'
       -- Uno alla volta: finché una richiesta è in volo non se ne accoda
       -- un'altra per lo stesso impegno.
       and not exists (
         select 1 from invii_promemoria i where i.task_id = t.id and i.esito = 'in_volo')
       -- ⚠️ UN TETTO AI TENTATIVI, ed è la lezione del 12/08: un lavoro che
       --    ritenta all'infinito chiede all'infinito. Dopo tre volte non si
       --    riprova più — ma il promemoria **resta lì**, con
       --    `reminder_sent_at` vuoto, e l'allarme qui sotto lo dice.
       and (select count(*) from invii_promemoria i where i.task_id = t.id) < 3
  loop
    select coalesce(max(i.tentativo), 0) + 1 into v_tent
      from invii_promemoria i where i.task_id = r.id;

    -- 🔴 IL NUMERO DELLA RICHIESTA SI CONSERVA. Prima si chiamava con
    --    `perform` e quel numero andava perso: senza, com'è finita non si può
    --    più ritrovare, per nessuno.
    select net.http_post(
      url := v_base || '/notify-telegram-reservation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon,
        'x-borgo58-firma', v_firma
      ),
      body := jsonb_build_object('type', 'task_reminder', 'task', to_jsonb(r))
    ) into v_req;

    insert into invii_promemoria (task_id, richiesta_id, tentativo)
    values (r.id, v_req, v_tent);

    -- 🔴 QUI NON SI SCRIVE PIÙ `reminder_sent_at`, ED È TUTTA LA CORREZIONE.
    --    La richiesta è soltanto ACCODATA: pg_net la manda dopo, fuori da
    --    questa transazione. Dichiarare adesso che l'avviso è stato mandato
    --    vuol dire dichiarare una cosa che nessuno ha ancora visto — e, se
    --    non arriva, il promemoria è perso in silenzio. Lo scrive
    --    `raccogli_esiti_promemoria`, e solo davanti a una risposta.
  end loop;

  -- ⚠️ CHI HA ESAURITO I TENTATIVI NON SPARISCE E NON TACE.
  select count(*) into v_fermi
    from tasks t
   where t.remind_at is not null
     and t.remind_at <= now()
     and t.reminder_sent_at is null
     and t.status <> 'completato'
     and (select count(*) from invii_promemoria i where i.task_id = t.id) >= 3;

  if v_fermi > 0 then
    perform segnala_allarme(
      'promemoria_senza_recapito',
      'Ci sono ' || v_fermi || ' avvisi dell''Agenda che non sono riusciti a partire dopo tre tentativi. Non sono stati persi: restano da mandare, e il perché è scritto nel registro degli invii.',
      jsonb_build_object('quanti', v_fermi));
  end if;

  -- Il giro è arrivato in fondo: è questa riga che permette di accorgersi,
  -- fra mezz'ora, che il giro NON è più arrivato in fondo.
  insert into stato_lavori (nome, ultimo_successo) values ('promemoria_agenda', now())
  on conflict (nome) do update set ultimo_successo = excluded.ultimo_successo;
end;
$funzione$;

comment on function send_due_task_reminders is
  'Chiamata da pg_cron ogni 5 minuti. ACCODA i promemoria scaduti e ne conserva il numero di richiesta: non dichiara più che siano stati inviati — quello lo fa raccogli_esiti_promemoria, e solo davanti a una risposta. Chiama la funzione online di QUESTO progetto, letta dal Vault.';

-- ---------------------------------------------------------------------
-- 5. Il giro che guarda com'è finita
-- ---------------------------------------------------------------------
-- ⚠️ IL VERSO È LO STESSO DELLA SENTINELLA (10/08): una risposta che non
--    arriva non può segnalarsi da sola, quindi qualcuno deve andare a
--    guardare. Qui si guarda `net._http_response`, che pg_net riempie quando
--    la richiesta torna.
create or replace function raccogli_esiti_promemoria()
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  i          record;
  v_stato    integer;
  v_contenuto text;
  v_errore   text;
  v_esito    record;
  v_falliti  integer := 0;
begin
  for i in select * from invii_promemoria where esito = 'in_volo' order by chiesto_il loop
    select r.status_code, r.content, r.error_msg
      into v_stato, v_contenuto, v_errore
      from net._http_response r
     where r.id = i.richiesta_id;

    if not found then
      -- 🔴 «SPARITA» NON È «RIUSCITA». pg_net conserva le risposte per poche
      --    ore e poi le toglie: passato quel termine la riga non c'è più, e
      --    l'unica cosa onesta da dire è che non si sa. Si dichiara **non
      --    arrivato**, così il promemoria resta vivo invece di risultare
      --    mandato per il fatto che nessuno ha guardato in tempo.
      if i.chiesto_il < now() - interval '2 hours' then
        update invii_promemoria
           set esito = 'senza_risposta',
               deciso_il = now(),
               motivo = 'La richiesta è stata accodata e nessuna risposta è mai tornata: non si può dire se l''avviso sia arrivato, quindi si dichiara non arrivato.'
         where id = i.id;
        v_falliti := v_falliti + 1;
      end if;
      continue;
    end if;

    select * into v_esito from esito_di_un_invio(v_stato, v_contenuto, v_errore);

    if v_esito.arrivato then
      update invii_promemoria
         set esito = 'riuscito', codice = v_stato, deciso_il = now()
       where id = i.id;
      -- 🔴 È L'UNICO POSTO IN TUTTO IL GESTIONALE CHE SCRIVE QUESTA COLONNA,
      --    ed è davanti a una risposta che dice «mandato».
      update tasks
         set reminder_sent_at = now()
       where id = i.task_id and reminder_sent_at is null;
    else
      update invii_promemoria
         set esito = 'fallito', codice = v_stato, motivo = v_esito.motivo, deciso_il = now()
       where id = i.id;
      v_falliti := v_falliti + 1;
    end if;
  end loop;

  -- ⚠️ L'ANOMALIA RESTA LEGGIBILE, e il promemoria non sparisce: essendo
  --    `reminder_sent_at` ancora vuoto, il giro che manda lo riprenderà —
  --    fino al tetto dei tre tentativi, e poi lo dirà.
  if v_falliti > 0 then
    perform segnala_allarme(
      'promemoria_non_arrivati',
      'Alcuni avvisi dell''Agenda non sono arrivati su Telegram. Non sono stati persi: restano da mandare, e il perché è scritto nel registro degli invii.',
      jsonb_build_object('quanti', v_falliti));
  end if;

  insert into stato_lavori (nome, ultimo_successo) values ('esiti_promemoria', now())
  on conflict (nome) do update set ultimo_successo = excluded.ultimo_successo;
end;
$funzione$;

comment on function raccogli_esiti_promemoria is
  'Chiamata da pg_cron ogni 5 minuti. Guarda com''è finita ogni richiesta accodata e SOLO allora scrive reminder_sent_at. Una risposta che non si riesce a leggere, o che non torna affatto, vale come «non arrivato».';

revoke all on function raccogli_esiti_promemoria() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Il lavoro pianificato, e la sua iscrizione alla sentinella
-- ---------------------------------------------------------------------
-- 🔴 LE DUE COSE VANNO INSIEME, SEMPRE. La sentinella fa il censimento nei
--    due versi: un lavoro in `cron.job` che non è in `lavori_sorvegliati` è
--    un allarme, e uno iscritto che non è più pianificato è un altro
--    allarme. Aggiungere il lavoro e dimenticare la riga farebbe suonare il
--    telefono di Alessio ogni quarto d'ora.
select cron.schedule(
  'esiti-promemoria',
  '*/5 * * * *',
  $cron$select raccogli_esiti_promemoria();$cron$
);

insert into lavori_sorvegliati (nome_lavoro, nome_cron, tolleranza_minuti, cosa_smette) values
  ('esiti_promemoria', 'esiti-promemoria', 30,
   'Nessuno guarda più se gli avvisi dell''Agenda siano arrivati davvero: risulterebbero tutti ancora in volo, e nessun promemoria verrebbe mai dichiarato mandato.')
on conflict (nome_lavoro) do update
  set nome_cron         = excluded.nome_cron,
      tolleranza_minuti = excluded.tolleranza_minuti,
      cosa_smette       = excluded.cosa_smette;

-- ⚠️ Il battito di partenza, con la stessa scelta del 12/08: senza, la
--    sentinella griderebbe per un guasto inventato da questa migrazione.
insert into stato_lavori (nome, ultimo_successo) values ('esiti_promemoria', now())
on conflict (nome) do nothing;

-- ---------------------------------------------------------------------
-- 7. Verifica
-- ---------------------------------------------------------------------
-- ⚠️ NON PARTE NESSUNA RICHIESTA E NON SI TOCCA NESSUN IMPEGNO: si prova la
--    DECISIONE su risposte inventate. È per questo che la decisione vive in
--    una funzione sua — provarla dentro il giro che manda vorrebbe dire
--    mandare Telegram veri per collaudare un guardiano.
do $verifica$
declare
  v record;
begin
  -- 1. Il caso buono: ha risposto che ha mandato.
  select * into v from esito_di_un_invio(200, '{"ok":true}', null);
  if not v.arrivato then
    raise exception 'VERIFICA: una risposta «ok» non viene riconosciuta come arrivata.';
  end if;

  -- 🔴 2. IL FALSO POSITIVO, ed è il controllo che vale più di tutti: stesso
  --    codice 200, ma la funzione online non ha mandato niente. Guardando lo
  --    stato, questo passerebbe per «inviato» — cioè il difetto di oggi.
  select * into v from esito_di_un_invio(200, '{"skipped":true}', null);
  if v.arrivato then
    raise exception 'VERIFICA: una risposta 200 «skipped» viene contata come inviata. È il falso positivo che questa migrazione esiste per chiudere.';
  end if;
  if v.motivo not like '%NON ha mandato%' then
    raise exception 'VERIFICA: il motivo di uno «skipped» non dice che non è stato mandato niente. Trovato: %', v.motivo;
  end if;

  -- 3. Telegram ha rifiutato: la funzione online risponde 502.
  select * into v from esito_di_un_invio(502, '{"error":"Invio Telegram fallito"}', null);
  if v.arrivato then
    raise exception 'VERIFICA: un 502 viene contato come inviato.';
  end if;

  -- 4. Parola d'ordine sbagliata: 401. È il caso che si vedrebbe su
  --    Borgo58-Prova se chiamasse la funzione della produzione.
  select * into v from esito_di_un_invio(401, '{"error":"Chiamante non riconosciuto"}', null);
  if v.arrivato then
    raise exception 'VERIFICA: un 401 viene contato come inviato.';
  end if;

  -- 5. Non è mai arrivata alla funzione online.
  select * into v from esito_di_un_invio(null, null, 'connection refused');
  if v.arrivato then
    raise exception 'VERIFICA: una richiesta mai arrivata viene contata come inviata.';
  end if;

  -- 🔴 6. UN CORPO CHE NON SI RIESCE A LEGGERE NON È UN SUCCESSO. Se lo
  --    fosse, basterebbe una risposta storta per far sparire un avviso.
  select * into v from esito_di_un_invio(200, 'questa non è una risposta leggibile', null);
  if v.arrivato then
    raise exception 'VERIFICA: una risposta illeggibile viene contata come inviata.';
  end if;

  -- 7. E nemmeno una risposta vuota con stato buono.
  select * into v from esito_di_un_invio(200, null, null);
  if v.arrivato then
    raise exception 'VERIFICA: una risposta vuota viene contata come inviata.';
  end if;

  -- 8. L'indirizzo non è più quello della produzione scritto fisso.
  if position('oudjuqbqszisdtwzbxdo' in pg_get_functiondef('send_due_task_reminders()'::regprocedure)) > 0 then
    raise exception 'VERIFICA: send_due_task_reminders contiene ancora un indirizzo scritto fisso.';
  end if;
  if position('url_delle_funzioni' in pg_get_functiondef('send_due_task_reminders()'::regprocedure)) = 0 then
    raise exception 'VERIFICA: send_due_task_reminders non legge l''indirizzo di questo database.';
  end if;

  -- 🔴 9. E NON DICHIARA PIÙ NIENTE: la colonna che significa «mandato» non
  --    si scrive più nel giro che accoda. È il controllo che impedisce alla
  --    correzione di essere annullata da una riga rimessa per comodità.
  if position('reminder_sent_at = now()' in pg_get_functiondef('send_due_task_reminders()'::regprocedure)) > 0 then
    raise exception 'VERIFICA: il giro che accoda scrive ancora reminder_sent_at. È esattamente il difetto che si stava chiudendo.';
  end if;
  if position('reminder_sent_at = now()' in pg_get_functiondef('raccogli_esiti_promemoria()'::regprocedure)) = 0 then
    raise exception 'VERIFICA: nessuno scrive reminder_sent_at dopo aver guardato la risposta.';
  end if;

  -- 10. Il lavoro nuovo è pianificato E iscritto alla sentinella: se una
  --     delle due mancasse, la sentinella griderebbe ogni quarto d'ora.
  if not exists (select 1 from cron.job where jobname = 'esiti-promemoria') then
    raise exception 'VERIFICA: il lavoro «esiti-promemoria» non è pianificato.';
  end if;
  if not exists (select 1 from lavori_sorvegliati where nome_cron = 'esiti-promemoria') then
    raise exception 'VERIFICA: il lavoro «esiti-promemoria» non è iscritto alla sentinella.';
  end if;

  -- 🔴 11. LE FUNZIONI NUOVE NON SONO RAGGIUNGIBILI DA CHI HA FATTO IL LOGIN.
  --     Non è una formalità: in questo progetto una funzione nasce eseguibile
  --     da chiunque abbia la chiave pubblica — che è PUBBLICA, sta nel
  --     pacchetto del sito — e c'è una rete che conta le `security definer`
  --     raggiungibili senza portiere. Scritto qui, diventa una proprietà
  --     controllata nel momento in cui la migrazione entra, invece di una
  --     cosa che si scopre quando quella rete diventa rossa due giorni dopo.
  if has_function_privilege('authenticated', 'url_delle_funzioni()', 'execute') then
    raise exception 'VERIFICA: url_delle_funzioni è eseguibile da chi ha fatto il login. Non deve esserlo: dice come è configurato il database.';
  end if;
  if has_function_privilege('authenticated', 'raccogli_esiti_promemoria()', 'execute') then
    raise exception 'VERIFICA: raccogli_esiti_promemoria è eseguibile da chi ha fatto il login. La chiama pg_cron, nessun altro.';
  end if;
  if has_function_privilege('anon', 'esito_di_un_invio(integer,text,text)', 'execute') then
    raise exception 'VERIFICA: esito_di_un_invio è eseguibile con la chiave pubblica.';
  end if;

  -- 12. Nessun residuo: questa verifica non ha creato niente.
  if exists (select 1 from invii_promemoria) then
    raise notice 'Nel registro degli invii ci sono già delle righe: non le ha scritte questa verifica.';
  end if;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260917000001', 'un_promemoria_e_inviato_solo_se_arriva') on conflict (version) do nothing;
