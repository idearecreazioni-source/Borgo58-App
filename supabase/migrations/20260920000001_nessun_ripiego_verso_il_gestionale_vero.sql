-- =====================================================================
-- Borgo 58 · Nessun ripiego verso il gestionale vero
-- =====================================================================
-- 20/09/2026.
--
-- 🔴 IL DIFETTO, MISURATO SU BORGO58-PROVA il 20/09. Cinque funzioni del
--    database potevano chiamare le funzioni online del LOCALE VERO:
--      · quattro leggevano l'indirizzo dal Vault e, se mancava, RIPIEGAVANO
--        sull'indirizzo di produzione scritto nel codice — `chiedi_lettura_posta`,
--        `invia_email_conferma`, `invia_preventivo_per_email`, `segnala_allarme`;
--      · una lo aveva scritto FISSO e non guardava nemmeno il Vault:
--        `notify_reservation_telegram`, il trigger delle prenotazioni dal sito.
--
-- ⚠️ E' LA FORMA CHE IL 17/09 ERA GIA' STATA NOMINATA e chiusa per i soli
--    promemoria: *«un guardiano che fallisce APERTO»*. Un ripiego non e' una
--    prudenza — e' la scelta, presa in anticipo e in silenzio, di chiamare il
--    gestionale vero il giorno in cui la configurazione di questo database
--    non c'e' piu'.
--
-- ⚠️ OGGI NON USCIVA NIENTE, e il perche' non cambia la cura: il Vault di
--    Prova ha il suo indirizzo, e la chiamata al progetto vero sarebbe stata
--    respinta dalla sua porta (chiave e parola d'ordine sono altre). Cioe':
--    la strada c'era, e a non farla percorrere era una coincidenza.
--
-- 🔴 E «FERMARSI» QUI NON VUOL DIRE FAR FALLIRE IL GESTO. Il commento dentro
--    `notify_reservation_telegram` dice una cosa decisa e ancora vera: *una
--    notifica mancata non deve MAI impedire a un ospite di prenotare*. Quindi
--    dove la notifica e' una CONSEGUENZA si continua a non mandare niente e a
--    dirlo (`raise warning`), e dove l'invio E' il gesto — mandare un
--    preventivo per mail — il rifiuto resta un errore vero.
--
-- ---------------------------------------------------------------------
-- CHE COSA SI TOGLIE APPOSTA, E PERCHE' — per la rete delle guardie
-- ---------------------------------------------------------------------
-- 🔴 LA RETE HA RAGIONE A CHIEDERLO, ed e' nata da quattro casi veri in
--    cui una riscrittura aveva annullato in silenzio qualcosa aggiunto dopo.
--    Qui ogni funzione perde due cose, e sono esattamente le due che questa
--    migrazione esiste per cambiare:
--      1. la vecchia frase di rifiuto — diceva solo «manca la parola
--         d'ordine», e adesso deve dire anche «manca l'indirizzo»;
--      2. la lettura diretta del segreto, che ora passa da
--         url_funzioni_configurato() — l'unico posto dove si decide che
--         senza indirizzo non si chiama nessuno.
-- ⚠️ Niente altro cambia: il resto dei corpi e' identico, riga per riga.
-- rete-guardie: chiedi_lettura_posta — frase di rifiuto piu' completa, e l'indirizzo lo da' url_funzioni_configurato()
-- rete-guardie: invia_email_conferma — frase di rifiuto piu' completa, e l'indirizzo lo da' url_funzioni_configurato()
-- rete-guardie: invia_preventivo_per_email — come sopra, e qui il rifiuto resta un errore vero perche' l'invio e' il gesto
-- rete-guardie: segnala_allarme — come sopra: l'allarme si scrive comunque, non si manda e si dice perche'
-- rete-guardie: notify_reservation_telegram — l'indirizzo era scritto fisso, ora viene dal Vault di questo database

-- ⚠️ I CORPI SONO STATI RIPRESI DAL DATABASE, non dai file che li avevano
--    creati (regola del 18/08), e l'unica cosa cambiata e' da dove viene
--    l'indirizzo. Tutto il resto e' identico, riga per riga.

-- ---------------------------------------------------------------------
-- L'indirizzo di QUESTO database, oppure niente
-- ---------------------------------------------------------------------
-- ⚠️ ACCANTO a `url_delle_funzioni()` (20260917000001) e non al posto suo:
--    quella SOLLEVA, ed e' giusto per un lavoro pianificato che deve gridare.
--    Questa risponde `null`, perche' i suoi cinque chiamanti devono poter
--    decidere da se' se fermarsi o proseguire senza notifica.
create or replace function url_funzioni_configurato()
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
  return nullif(rtrim(btrim(coalesce(v_url, '')), '/'), '');
end
$funzione$;

comment on function url_funzioni_configurato() is
  'L''indirizzo delle funzioni online di QUESTO progetto, dal Vault, oppure null. Nessun ripiego: un indirizzo che manca non diventa l''indirizzo di un altro progetto.';

revoke all on function url_funzioni_configurato() from public, anon, authenticated;

-- chiedi_lettura_posta — dal corpo vivo, con il ripiego tolto
CREATE OR REPLACE FUNCTION public.chiedi_lettura_posta()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma text;
  v_anon  text;
  v_base  text;
  n       integer;
begin
  -- IL PORTIERE E' `auth.uid() is not null`, NON `is_titolare()`.
  -- Questa funzione ha DUE chiamanti con due identita' diverse: il lavoro
  -- pianificato, che gira come proprietario del database e per cui
  -- `is_titolare()` e' FALSO, e il titolare che preme «Leggila adesso».
  if auth.uid() is not null and not is_titolare() then
    raise exception 'Solo il titolare puo'' chiedere a MEMO di leggere la posta adesso';
  end if;

  -- ⚠️ L'avviso delle mail illeggibili si guarda a OGNI giro, anche quando
  -- non c'e' niente da leggere: le mail su cui MEMO si e' arreso restano
  -- ferme proprio quando la coda e' vuota, ed e' li' che nessuno le
  -- guarderebbe piu'.
  perform avvisa_posta_illeggibile();

  select count(*) into n from posta_ricevuta where stato = 'da_leggere';
  if n = 0 then
    -- Niente da leggere: nessuna chiamata, nessun costo — ma il giro c'è
    -- stato, e va scritto.
    insert into stato_lavori (nome, ultimo_successo)
    values ('lettura_posta', now())
    on conflict (nome) do update set ultimo_successo = excluded.ultimo_successo;
    return false;
  end if;

  select decrypted_secret into v_firma from vault.decrypted_secrets where name = 'notifiche_firma';
  select decrypted_secret into v_anon  from vault.decrypted_secrets where name = 'chiave_anon';
  -- 🔴 NESSUN RIPIEGO: l'indirizzo e' quello di QUESTO database, o niente.
  select url_funzioni_configurato() into v_base;

  -- Qui il battito NON si scrive: c'era posta da leggere e non è stata
  -- letta. È un guasto, e la sentinella deve vederlo.
  if v_firma is null or v_anon is null or v_base is null then
    raise warning 'Posta non letta: nel Vault di questo database manca la parola d''ordine, la chiave pubblica o l''indirizzo delle funzioni (url_funzioni). Non chiamo un altro progetto al posto suo.';
    return false;
  end if;

  perform net.http_post(
    url := v_base || '/posta-leggi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'x-borgo58-firma', v_firma
    ),
    body := '{}'::jsonb
  );

  insert into stato_lavori (nome, ultimo_successo)
  values ('lettura_posta', now())
  on conflict (nome) do update set ultimo_successo = excluded.ultimo_successo;

  return true;
end
$function$;

-- invia_email_conferma — dal corpo vivo, con il ripiego tolto
CREATE OR REPLACE FUNCTION public.invia_email_conferma(p_reservation_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_riga  reservations%rowtype;
  v_firma text;
  v_anon  text;
  v_base  text;
begin
  if not email_conferma_dovuta(p_reservation_id) then
    return false;
  end if;

  select * into v_riga from reservations where id = p_reservation_id;

  select decrypted_secret into v_firma from vault.decrypted_secrets where name = 'notifiche_firma';
  select decrypted_secret into v_anon  from vault.decrypted_secrets where name = 'chiave_anon';
  -- 🔴 NESSUN RIPIEGO: l'indirizzo e' quello di QUESTO database, o niente.
  select url_funzioni_configurato() into v_base;

  if v_firma is null or v_anon is null or v_base is null then
    raise warning 'Email di conferma non inviata: nel Vault di questo database manca la parola d''ordine, la chiave pubblica o l''indirizzo delle funzioni (url_funzioni). Non chiamo un altro progetto al posto suo.';
    return false;
  end if;

  -- Il segno che l'email è partita si scrive PRIMA della chiamata: se la
  -- scrittura avvenisse dopo, un errore in mezzo lascerebbe il cliente
  -- senza email e il registro senza traccia — e al tentativo successivo
  -- nessuno saprebbe se era già stata mandata.
  insert into email_inviate (reservation_id, tipo)
  values (p_reservation_id, 'conferma')
  on conflict (reservation_id, tipo) do nothing;

  perform net.http_post(
    url := v_base || '/email-cliente',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'x-borgo58-firma', v_firma
    ),
    body := jsonb_build_object(
      'tipo', 'conferma',
      'prenotazione', jsonb_build_object(
        'id', v_riga.id,
        'nome', v_riga.customer_name,
        'email', v_riga.customer_email,
        'data', v_riga.reservation_date,
        'ora', v_riga.reservation_time,
        'coperti', v_riga.party_size
      )
    )
  );

  return true;
end
$function$;

-- invia_preventivo_per_email — dal corpo vivo, con il ripiego tolto
CREATE OR REPLACE FUNCTION public.invia_preventivo_per_email(p_preventivo_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_p         preventivi%rowtype;
  v_contenuto jsonb;
  v_firma     text;
  v_anon      text;
  v_base      text;
begin
  if not is_titolare() then
    raise exception 'I preventivi sono riservati al titolare.';
  end if;
  select * into v_p from preventivi where id = p_preventivo_id;
  if not found then raise exception 'Questo preventivo non esiste.'; end if;

  -- ⚠️ Il rifiuto viene PRIMA di tutto il resto: senza indirizzo non si manda
  -- niente, e non si scrive nemmeno una fotografia che direbbe il falso.
  if coalesce(btrim(v_p.cliente_email), '') = '' then
    raise exception 'Di questo cliente non hai l''email. Scrivila sul preventivo, oppure mandaglielo su WhatsApp.';
  end if;

  select decrypted_secret into v_firma from vault.decrypted_secrets where name = 'notifiche_firma';
  select decrypted_secret into v_anon  from vault.decrypted_secrets where name = 'chiave_anon';
  -- 🔴 NESSUN RIPIEGO: l'indirizzo e' quello di QUESTO database, o niente.
  select url_funzioni_configurato() into v_base;

  if v_firma is null or v_anon is null or v_base is null then
    raise exception 'Non posso mandare la mail: nel Vault di questo database manca la parola d''ordine, la chiave pubblica o l''indirizzo delle funzioni (url_funzioni). Non mando la mail da un altro progetto.';
  end if;

  -- La fotografia si scrive PRIMA della chiamata, come per l'email di
  -- conferma: meglio una traccia di un invio che poi fallisce, che un invio
  -- riuscito di cui non resta niente.
  v_contenuto := registra_foglio_preventivo(p_preventivo_id, 'mail', v_p.cliente_email);

  perform net.http_post(
    url := v_base || '/email-cliente',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'x-borgo58-firma', v_firma
    ),
    body := jsonb_build_object(
      'tipo', 'preventivo',
      'preventivo', v_contenuto || jsonb_build_object('email', v_p.cliente_email)
    )
  );

  return v_contenuto;
end;
$function$;

-- segnala_allarme — dal corpo vivo, con il ripiego tolto
CREATE OR REPLACE FUNCTION public.segnala_allarme(p_tipo text, p_messaggio text, p_dettagli jsonb DEFAULT NULL::jsonb, p_categoria text DEFAULT 'guasto'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- 🔴 NESSUN RIPIEGO: l'indirizzo e' quello di QUESTO database, o niente.
  select url_funzioni_configurato() into v_base;

  if v_firma is null or v_anon is null or v_base is null then
    raise warning 'Allarme registrato ma non inviato: nel Vault di questo database manca la parola d''ordine, la chiave pubblica o l''indirizzo delle funzioni (url_funzioni). Non chiamo un altro progetto al posto suo.';
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
$function$;

-- notify_reservation_telegram — dal corpo vivo, con l'indirizzo fisso tolto
CREATE OR REPLACE FUNCTION public.notify_reservation_telegram()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma text;
  v_anon  text;
  v_base  text;
begin
  if new.source <> 'form_pubblico' then
    return new;
  end if;

  select decrypted_secret into v_firma from vault.decrypted_secrets where name = 'notifiche_firma';
  select decrypted_secret into v_anon  from vault.decrypted_secrets where name = 'chiave_anon';
  -- 🔴 NESSUN RIPIEGO: l'indirizzo e' quello di QUESTO database, o niente.
  select url_funzioni_configurato() into v_base;

  -- Una notifica mancata non deve MAI impedire a un ospite di prenotare:
  -- si segnala nei log del database e si prosegue. La richiesta resta
  -- salvata e visibile nel gestionale, che è la cosa che conta.
  if v_firma is null or v_anon is null or v_base is null then
    raise warning 'Notifica Telegram saltata: nel Vault di questo database manca la parola d''ordine, la chiave pubblica o l''indirizzo delle funzioni (url_funzioni). Non chiamo un altro progetto al posto suo.';
    return new;
  end if;

  perform net.http_post(
    url := v_base || '/notify-telegram-reservation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'x-borgo58-firma', v_firma
    ),
    body := jsonb_build_object('record', to_jsonb(new))
  );

  return new;
end;
$function$;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_restanti text[];
  v_senza    text[];
begin
  -- 1. LA PROPRIETA', non il conteggio: nessuna funzione di questo database
  --    nomina piu' il progetto del locale vero.
  select coalesce(array_agg(p.proname order by p.proname), '{}'::text[]) into v_restanti
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and pg_get_functiondef(p.oid) like '%oudjuqbqszisdtwzbxdo%';
  if array_length(v_restanti, 1) > 0 then
    raise exception 'VERIFICA: queste funzioni nominano ancora il gestionale vero: %', array_to_string(v_restanti, ', ');
  end if;

  -- 2. E le cinque chiedono l'indirizzo a questo database.
  select coalesce(array_agg(nome order by nome), '{}'::text[]) into v_senza
    from unnest(array['chiedi_lettura_posta', 'invia_email_conferma', 'invia_preventivo_per_email',
                      'notify_reservation_telegram', 'segnala_allarme']) nome
   where pg_get_functiondef(('public.' || nome)::regproc) not like '%url_funzioni_configurato()%';
  if array_length(v_senza, 1) > 0 then
    raise exception 'VERIFICA: queste non leggono l''indirizzo di questo database: %', array_to_string(v_senza, ', ');
  end if;

  -- 3. 🔴 UN CORPO CHE SI CREA NON E' UN CORPO CHE FUNZIONA (17/08): le
  --    funzioni si CHIAMANO, nei casi in cui non mandano niente.
  --    ⚠️ `invia_email_conferma` su una prenotazione che non esiste esce
  --    subito da `email_conferma_dovuta`, quindi non manda e non scrive.
  if invia_email_conferma('00000000-0000-0000-0000-000000000000'::uuid) then
    raise exception 'VERIFICA: ha dichiarato di aver mandato un''email per una prenotazione che non esiste.';
  end if;
  if url_funzioni_configurato() is null then
    raise exception 'VERIFICA: questo database non sa qual e'' il proprio indirizzo (url_funzioni nel Vault).';
  end if;

  perform pretendi_nessun_residuo(v_foto, 'la verifica della 20260920000001');
  raise notice 'Verifica passata: nessun ripiego verso il gestionale vero.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260920000001', 'nessun_ripiego_verso_il_gestionale_vero') on conflict (version) do nothing;
