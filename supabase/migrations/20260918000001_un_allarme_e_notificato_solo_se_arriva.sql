-- =====================================================================
-- UN ALLARME E' «NOTIFICATO» SOLO SE ARRIVA — 18/09/2026
-- =====================================================================
--
-- PERCHE' ESISTE. Il 17/09/2026 la migrazione 20260917000001 ha chiuso, per
-- i PROMEMORIA, il difetto piu' silenzioso che ci fosse: «inviato» voleva
-- dire soltanto «accodato». Quella correzione non ha toccato gli ALLARMI.
--
-- 🔴 E GLI ALLARMI SONO IL POSTO PEGGIORE IN CUI LASCIARLO. `segnala_allarme`
--    accodava con `net.http_post`, BUTTAVA VIA il numero della richiesta, e
--    subito dopo scriveva `notificato = true`. Fra gli allarmi che passano di
--    li' ci sono `promemoria_non_arrivati` e `notifiche_senza_chiavi`: cioe'
--    gli avvisi che dicono che i promemoria non partono. *Un registro che
--    dichiara consegnato l'avviso di un guasto, senza averne visto l'esito.*
--
-- 🔴 IL SECONDO DIFETTO, MISURATO. Due funzioni vive portavano ancora
--    l'indirizzo della produzione:
--      · `segnala_allarme` lo teneva come RIPIEGO (`coalesce(vault, '...')`);
--      · `notify_reservation_telegram` lo aveva SCRITTO FISSO, senza
--        nemmeno guardare il Vault.
--    La seconda e' la piu' grave: su Prova, una prenotazione dal form
--    pubblico bussa alla funzione della PRODUZIONE. Oggi la respinge una
--    parola d'ordine diversa — una difesa che vive in un valore, non in una
--    struttura. Il 17/09 il principio era gia' stato scritto: *«Nessun
--    ripiego: un segreto che manca e' un rifiuto, perche' il ripiego sarebbe
--    l'indirizzo della produzione»*. Qui lo si applica dove mancava.
--
-- ⚠️ E IL TERZO: UN GUASTO DI TELEGRAM NON PUO' DIPENDERE DA TELEGRAM PER
--    FARSI VEDERE. La riga in `allarmi` si scrive SEMPRE e PRIMA di
--    qualunque invio, e da oggi porta con se' `da_guardare`, che e' cio' che
--    la schermata legge. Non e' un secondo canale di rete — non se ne puo'
--    aggiungere uno senza un segreto nuovo — ma e' un secondo POSTO, dentro
--    il gestionale, che non passa da Telegram.

-- ---------------------------------------------------------------------
-- GUARDIE: si applica solo su un database che sta dove ci si aspetta
-- ---------------------------------------------------------------------
do $guardia$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'url_delle_funzioni') then
    raise exception 'GUARDIA: manca url_delle_funzioni(). Va applicata prima la 20260917000001.';
  end if;
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'invii_promemoria') then
    raise exception 'GUARDIA: manca il registro invii_promemoria. Va applicata prima la 20260917000001.';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'url_funzioni') then
    raise exception 'GUARDIA: nel Vault manca «url_funzioni». Senza, questo database non sa a quale progetto appartiene, e questa migrazione toglie ogni ripiego. Impostalo e riapplica.';
  end if;
end $guardia$;

-- ---------------------------------------------------------------------
-- 1. LA RIGA DELL'ALLARME SI VEDE ANCHE SE TELEGRAM TACE
-- ---------------------------------------------------------------------
alter table allarmi add column if not exists da_guardare boolean not null default true;

comment on column allarmi.da_guardare is
  'Questo allarme aspetta ancora un occhio. Non dipende da Telegram: e'' cio'' che la schermata legge quando il recapito non funziona — ed e'' l''unico posto che resta quando a rompersi e'' proprio il recapito.';

create index if not exists allarmi_da_guardare on allarmi (creato_il desc) where da_guardare;

-- ---------------------------------------------------------------------
-- 2. IL REGISTRO DEGLI INVII DEGLI ALLARMI
-- ---------------------------------------------------------------------
-- ⚠️ STESSA FORMA DI `invii_promemoria`, e non e' pigrizia: due registri che
--    dicono la stessa cosa in due modi diversi divergono. Gli esiti li
--    interpreta la STESSA funzione, `esito_di_un_invio`, gia' provata.
create table if not exists invii_allarmi (
  id           uuid primary key default gen_random_uuid(),
  allarme_id   uuid not null references allarmi(id) on delete cascade,
  chiave       text not null,
  richiesta_id bigint,
  tentativo    integer not null,
  chiesto_il   timestamptz not null default now(),
  esito        text not null default 'in_volo'
               constraint invii_allarmi_esito_check
               check (esito in ('in_volo', 'riuscito', 'fallito', 'senza_risposta', 'esito_ignoto')),
  codice       integer,
  motivo       text,
  deciso_il    timestamptz
);

comment on table invii_allarmi is
  'Un tentativo di far arrivare un allarme su Telegram, e com''e'' finito. Esiste perche'' fino al 18/09/2026 «notificato» voleva dire soltanto «accodato».';

create unique index if not exists invii_allarmi_una_in_volo
  on invii_allarmi (chiave) where esito = 'in_volo';
create index if not exists invii_allarmi_per_chiave on invii_allarmi (chiave);

alter table invii_allarmi enable row level security;
drop policy if exists invii_allarmi_titolare on invii_allarmi;
create policy invii_allarmi_titolare on invii_allarmi
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ⚠️ La chiave di consegna di un allarme e' l'allarme stesso: nasce una volta
--    sola e non si sposta. Non serve l'ora, come per un promemoria rimandato.
create or replace function chiave_di_allarme(p_allarme_id uuid)
returns text
language sql
immutable
set search_path = public
as $funzione$
  select case when p_allarme_id is null then null else 'allarme:' || p_allarme_id::text end;
$funzione$;

revoke all on function chiave_di_allarme(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. `segnala_allarme`: scrive, accoda, e NON dichiara niente
-- ---------------------------------------------------------------------
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
  v_id     uuid;
  v_firma  text;
  v_anon   text;
  v_base   text;
  v_chiave text;
  v_req    bigint;
  v_riga   uuid;
begin
  if allarme_frenato(p_tipo) then
    return false;
  end if;

  -- 🔴 LA RIGA PRIMA DI TUTTO. Qualunque cosa succeda al recapito, l'allarme
  --    esiste ed e' da guardare. E' la parte che non dipende da Telegram.
  insert into allarmi (tipo, messaggio, dettagli)
  values (p_tipo, p_messaggio, p_dettagli)
  returning id into v_id;

  select decrypted_secret into v_firma from vault.decrypted_secrets where name = 'notifiche_firma';
  select decrypted_secret into v_anon  from vault.decrypted_secrets where name = 'chiave_anon';

  if v_firma is null or v_anon is null then
    raise warning 'Allarme registrato ma non inviato: parola d''ordine o chiave assenti dal Vault.';
    return true;
  end if;

  -- 🔴 NESSUN RIPIEGO. Prima qui c'era `coalesce(vault, '<indirizzo della
  --    produzione>')`: un database senza «url_funzioni» bussava, in silenzio,
  --    alla porta del gestionale vero. Adesso un segreto che manca solleva.
  v_base := url_delle_funzioni();

  v_chiave := chiave_di_allarme(v_id);

  insert into invii_allarmi (allarme_id, chiave, tentativo)
  values (v_id, v_chiave,
          coalesce((select max(i.tentativo) from invii_allarmi i where i.chiave = v_chiave), 0) + 1)
  on conflict (chiave) where esito = 'in_volo' do nothing
  returning id into v_riga;

  if v_riga is null then
    return true;
  end if;

  select net.http_post(
    url := v_base || '/notify-telegram-reservation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'x-borgo58-firma', v_firma
    ),
    body := jsonb_build_object(
      'type', 'allarme',
      'chiave_consegna', v_chiave,
      'allarme', jsonb_build_object(
        'tipo', p_tipo,
        'messaggio', p_messaggio,
        'categoria', coalesce(nullif(p_categoria, ''), 'guasto'),
        'quando', now())
    )
  ) into v_req;

  update invii_allarmi set richiesta_id = v_req where id = v_riga;

  -- ⚠️ QUI NON SI SCRIVE `notificato`. Lo scrive raccogli_esiti_allarmi, e
  --    solo davanti a una risposta. E' tutta la correzione, in una riga che
  --    non c'e' piu'.
  return true;
end
$funzione$;

comment on function segnala_allarme(text, text, jsonb, text) is
  'Registra l''allarme (sempre, e per primo), poi ACCODA l''avviso portandosi dietro la chiave di consegna. Non dichiara piu'' notificato niente: quello lo fa raccogli_esiti_allarmi, e solo davanti a una risposta.';

revoke all on function segnala_allarme(text, text, jsonb, text) from public, anon, authenticated;
grant execute on function segnala_allarme(text, text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. CHI GUARDA COM'E' FINITA
-- ---------------------------------------------------------------------
create or replace function raccogli_esiti_allarmi()
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  i           record;
  v_stato     integer;
  v_contenuto text;
  v_errore    text;
  v_esito     record;
begin
  for i in select * from invii_allarmi where esito = 'in_volo' order by chiesto_il loop
    select r.status_code, r.content, r.error_msg
      into v_stato, v_contenuto, v_errore
      from net._http_response r
     where r.id = i.richiesta_id;

    if not found then
      if i.chiesto_il < now() - interval '2 hours' then
        update invii_allarmi
           set esito = 'senza_risposta', deciso_il = now(),
               motivo = 'Accodato, e nessuna risposta e'' mai tornata. Non si dichiara arrivato.'
         where id = i.id;
      end if;
      continue;
    end if;

    select * into v_esito from esito_di_un_invio(v_stato, v_contenuto, v_errore);

    if v_esito.esito = 'in_volo' then
      if i.chiesto_il < now() - interval '30 minutes' then
        update invii_allarmi
           set esito = 'senza_risposta', codice = v_stato, deciso_il = now(),
               motivo = 'Chi riceve dice che la stessa consegna era gia'' in corso, e da mezz''ora non cambia.'
         where id = i.id;
      end if;
      continue;
    end if;

    update invii_allarmi
       set esito = v_esito.esito, codice = v_stato, motivo = v_esito.motivo, deciso_il = now()
     where id = i.id;

    -- 🔴 L'UNICO POSTO IN CUI «notificato» DIVENTA VERO, e solo su «riuscito».
    if v_esito.esito = 'riuscito' then
      update allarmi set notificato = true where id = i.allarme_id;
    end if;
  end loop;

  insert into stato_lavori (nome, ultimo_successo) values ('esiti_allarmi', now())
  on conflict (nome) do update set ultimo_successo = excluded.ultimo_successo;
end
$funzione$;

comment on function raccogli_esiti_allarmi is
  'Chiamata da pg_cron ogni 5 minuti. Guarda com''e'' finita ogni richiesta di allarme e SOLO allora scrive notificato. ⚠️ Non richiama segnala_allarme quando qualcosa va storto: sarebbe un allarme che si allarma di se'' stesso. Il fatto resta scritto in invii_allarmi e la riga in allarmi resta da_guardare.';

revoke all on function raccogli_esiti_allarmi() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. LA PRENOTAZIONE NON BUSSA PIU' ALLA PORTA DELLA PRODUZIONE
-- ---------------------------------------------------------------------
create or replace function notify_reservation_telegram()
returns trigger
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_firma text;
  v_anon  text;
begin
  if new.source <> 'form_pubblico' then
    return new;
  end if;

  select decrypted_secret into v_firma from vault.decrypted_secrets where name = 'notifiche_firma';
  select decrypted_secret into v_anon  from vault.decrypted_secrets where name = 'chiave_anon';

  if v_firma is null or v_anon is null then
    raise warning 'Notifica Telegram saltata: parola d''ordine o chiave assenti dal Vault.';
    return new;
  end if;

  -- 🔴 PRIMA QUI C'ERA L'INDIRIZZO DELLA PRODUZIONE, SCRITTO A MANO.
  --    Su Prova, una prenotazione dal form pubblico bussava al gestionale
  --    vero. Adesso ogni database chiama le PROPRIE funzioni, e uno che non
  --    sa chi e' solleva invece di indovinare.
  perform net.http_post(
    url := url_delle_funzioni() || '/notify-telegram-reservation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'x-borgo58-firma', v_firma
    ),
    body := jsonb_build_object('record', to_jsonb(new))
  );

  return new;
end;
$funzione$;

comment on function notify_reservation_telegram is
  'Avvisa di una prenotazione arrivata dal form pubblico, chiamando le funzioni DI QUESTO progetto. Nessun indirizzo scritto fisso, nessun ripiego verso la produzione.';

-- ---------------------------------------------------------------------
-- 6. PIANIFICAZIONE E SORVEGLIANZA
-- ---------------------------------------------------------------------
select cron.schedule(
  'esiti-allarmi',
  '*/5 * * * *',
  $cron$select raccogli_esiti_allarmi();$cron$
);

insert into lavori_sorvegliati (nome_lavoro, nome_cron, tolleranza_minuti, cosa_smette) values
  ('esiti_allarmi', 'esiti-allarmi', 30,
   'Nessuno guarda piu'' se gli allarmi siano arrivati: resterebbero tutti in volo, e nessun allarme verrebbe mai dichiarato notificato.')
on conflict (nome_lavoro) do update
  set nome_cron         = excluded.nome_cron,
      tolleranza_minuti = excluded.tolleranza_minuti,
      cosa_smette       = excluded.cosa_smette;

insert into stato_lavori (nome, ultimo_successo) values ('esiti_allarmi', now())
on conflict (nome) do nothing;

-- ---------------------------------------------------------------------
-- 7. VERIFICA — si prova qui, non dal telefono
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_corpo text;
begin
  -- nessun indirizzo scritto fisso resta nei due percorsi corretti
  foreach v_corpo in array array[
    pg_get_functiondef('segnala_allarme(text,text,jsonb,text)'::regprocedure),
    pg_get_functiondef('notify_reservation_telegram()'::regprocedure)
  ] loop
    if position('.supabase.co' in v_corpo) > 0 then
      raise exception 'VERIFICA: un indirizzo scritto fisso e'' rimasto in uno dei due percorsi Telegram.';
    end if;
    if position('url_delle_funzioni' in v_corpo) = 0 then
      raise exception 'VERIFICA: un percorso Telegram non legge l''indirizzo di questo database.';
    end if;
  end loop;

  -- l'accodamento non dichiara piu' niente
  if position('notificato = true' in pg_get_functiondef('segnala_allarme(text,text,jsonb,text)'::regprocedure)) > 0 then
    raise exception 'VERIFICA: segnala_allarme dichiara ancora notificato sull''accodamento. E'' il difetto che questa migrazione esiste per chiudere.';
  end if;
  if position('notificato = true' in pg_get_functiondef('raccogli_esiti_allarmi()'::regprocedure)) = 0 then
    raise exception 'VERIFICA: nessuno scrive notificato dopo aver guardato la risposta.';
  end if;

  -- la riga si scrive PRIMA di accodare
  if position('insert into allarmi' in pg_get_functiondef('segnala_allarme(text,text,jsonb,text)'::regprocedure))
     > position('net.http_post' in pg_get_functiondef('segnala_allarme(text,text,jsonb,text)'::regprocedure)) then
    raise exception 'VERIFICA: l''allarme viene accodato PRIMA di essere scritto. Se l''invio solleva, non resta traccia.';
  end if;

  -- la chiave di consegna viaggia col messaggio
  if position('chiave_consegna' in pg_get_functiondef('segnala_allarme(text,text,jsonb,text)'::regprocedure)) = 0 then
    raise exception 'VERIFICA: l''allarme non porta con se'' la chiave di consegna: la deduplica non entrerebbe in funzione.';
  end if;

  -- la chiave e' stabile e diversa per allarmi diversi
  if chiave_di_allarme('00000000-0000-0000-0000-0000000000aa'::uuid)
     is distinct from chiave_di_allarme('00000000-0000-0000-0000-0000000000aa'::uuid) then
    raise exception 'VERIFICA: la chiave di un allarme non e'' stabile.';
  end if;
  if chiave_di_allarme('00000000-0000-0000-0000-0000000000aa'::uuid)
     = chiave_di_allarme('00000000-0000-0000-0000-0000000000bb'::uuid) then
    raise exception 'VERIFICA: due allarmi diversi hanno la stessa chiave.';
  end if;
  if chiave_di_allarme(null) is not null then
    raise exception 'VERIFICA: una chiave si compone anche senza allarme.';
  end if;

  -- i permessi
  if has_function_privilege('authenticated', 'raccogli_esiti_allarmi()', 'execute') then
    raise exception 'VERIFICA: raccogli_esiti_allarmi e'' eseguibile da chi ha fatto il login.';
  end if;

  -- la pianificazione e la sentinella
  if not exists (select 1 from cron.job where jobname = 'esiti-allarmi') then
    raise exception 'VERIFICA: il lavoro «esiti-allarmi» non e'' pianificato.';
  end if;
  if not exists (select 1 from lavori_sorvegliati where nome_cron = 'esiti-allarmi') then
    raise exception 'VERIFICA: il lavoro «esiti-allarmi» non e'' iscritto alla sentinella.';
  end if;

  -- il posto che non dipende da Telegram
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'allarmi' and column_name = 'da_guardare') then
    raise exception 'VERIFICA: manca la colonna che rende visibile un allarme quando il recapito non funziona.';
  end if;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260918000001', 'un_allarme_e_notificato_solo_se_arriva') on conflict (version) do nothing;
