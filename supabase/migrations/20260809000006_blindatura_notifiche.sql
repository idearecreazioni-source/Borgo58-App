-- ---------------------------------------------------------------------
-- PASSO 2 di 2 — Le notifiche Telegram non sono più azionabili da fuori
-- ---------------------------------------------------------------------
-- Il difetto (audit del 09/08/2026, proposta §5.1): la Edge Function
-- delle notifiche accettava chiunque presentasse la chiave anon — che è
-- PUBBLICA e si legge nel bundle del sito. Un estraneo poteva far
-- arrivare sul telefono di Alessio un messaggio identico a una vera
-- notifica del gestionale: una prenotazione inventata con un numero da
-- richiamare. Nessun dato usciva; un canale fidato diventava scrivibile
-- da fuori.
--
-- La cura: una parola d'ordine condivisa (header x-borgo58-firma) che
-- vive cifrata nel Vault del database e nelle variabili d'ambiente della
-- funzione — mai nel repository. La conoscono solo il trigger delle
-- prenotazioni e il job dei promemoria. La verifica JWT del gateway
-- resta attiva: due barriere, non una.
--
-- Nella stessa passata, due pulizie annunciate:
--  - la chiave pubblica non è più copiata dentro le funzioni ma letta dal
--    Vault: una rotazione si applica in un posto solo, invece di
--    spegnere prenotazioni e promemoria in silenzio (proposta §5.3);
--  - l'indirizzo chiamato passa da "bright-function" (nome generato a
--    caso, che rendeva impossibile verificare che il codice online fosse
--    quello del repository) a "notify-telegram-reservation", uguale alla
--    cartella nel repo — §8 del Contratto.
--
-- PREREQUISITI, in quest'ordine (senza, la verifica finale si ferma):
--   1. eseguito supabase/diagnostica/20260809_firma_notifiche_setup.sql
--   2. NOTIFICHE_FIRMA impostata nei Secrets della Edge Function
--   3. funzione distribuita col nome notify-telegram-reservation
--
-- Idempotente (§7 punto 3).

-- ---------------------------------------------------------------------
-- 1. Notifica delle prenotazioni dal form pubblico
-- ---------------------------------------------------------------------
create or replace function notify_reservation_telegram()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firma text;
  v_anon  text;
begin
  if new.source <> 'form_pubblico' then
    return new;
  end if;

  select decrypted_secret into v_firma from vault.decrypted_secrets where name = 'notifiche_firma';
  select decrypted_secret into v_anon  from vault.decrypted_secrets where name = 'chiave_anon';

  -- Una notifica mancata non deve MAI impedire a un ospite di prenotare:
  -- si segnala nei log del database e si prosegue. La richiesta resta
  -- salvata e visibile nel gestionale, che è la cosa che conta.
  if v_firma is null or v_anon is null then
    raise warning 'Notifica Telegram saltata: parola d''ordine o chiave assenti dal Vault.';
    return new;
  end if;

  perform net.http_post(
    url := 'https://oudjuqbqszisdtwzbxdo.supabase.co/functions/v1/notify-telegram-reservation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'x-borgo58-firma', v_firma
    ),
    body := jsonb_build_object('record', to_jsonb(new))
  );

  return new;
end;
$$;

comment on function notify_reservation_telegram is
  'Chiama la Edge Function di notifica a ogni richiesta dal form pubblico, allegando la parola d''ordine letta dal Vault. Se la parola d''ordine manca, salta la notifica con un warning: una prenotazione non deve mai fallire per colpa di un avviso.';

-- ---------------------------------------------------------------------
-- 2. Promemoria Agenda (job pg_cron ogni 5 minuti)
-- ---------------------------------------------------------------------
create or replace function send_due_task_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_firma text;
  v_anon  text;
begin
  select decrypted_secret into v_firma from vault.decrypted_secrets where name = 'notifiche_firma';
  select decrypted_secret into v_anon  from vault.decrypted_secrets where name = 'chiave_anon';

  -- Qui invece ci si ferma: se non si può notificare, NON si marcano i
  -- promemoria come inviati — altrimenti sparirebbero senza essere mai
  -- arrivati. Al giro successivo (5 minuti) si riprova.
  if v_firma is null or v_anon is null then
    raise warning 'Promemoria Telegram saltati: parola d''ordine o chiave assenti dal Vault.';
    return;
  end if;

  for r in
    select * from tasks
    where remind_at is not null
      and remind_at <= now()
      and reminder_sent_at is null
      and status <> 'completato'
  loop
    perform net.http_post(
      url := 'https://oudjuqbqszisdtwzbxdo.supabase.co/functions/v1/notify-telegram-reservation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon,
        'x-borgo58-firma', v_firma
      ),
      body := jsonb_build_object('type', 'task_reminder', 'task', to_jsonb(r))
    );

    update tasks set reminder_sent_at = now() where id = r.id;
  end loop;
end;
$$;

comment on function send_due_task_reminders is
  'Chiamata da pg_cron ogni 5 minuti. Invia i promemoria scaduti allegando la parola d''ordine dal Vault. Se la parola d''ordine manca NON marca nulla come inviato: al giro dopo si riprova.';

-- ---------------------------------------------------------------------
-- 3. Verifica (§7 punti 2-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_firma text;
  v_anon  text;
  v_nome  text;
  v_src   text;
  n integer;
begin
  -- Prerequisito 1: i due valori nel Vault
  select decrypted_secret into v_firma from vault.decrypted_secrets where name = 'notifiche_firma';
  if v_firma is null or length(v_firma) < 32 then
    raise exception 'Parola d''ordine assente o troppo corta nel Vault: eseguire prima supabase/diagnostica/20260809_firma_notifiche_setup.sql';
  end if;
  select decrypted_secret into v_anon from vault.decrypted_secrets where name = 'chiave_anon';
  if v_anon is null then
    raise exception 'Chiave pubblica assente dal Vault: eseguire prima lo script di setup.';
  end if;

  -- Le due funzioni allegano la parola d'ordine e puntano al nome giusto
  foreach v_nome in array array['notify_reservation_telegram', 'send_due_task_reminders'] loop
    select p.prosrc into v_src from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname = v_nome;
    if v_src is null then
      raise exception 'Funzione di notifica % mancante dopo la migrazione.', v_nome;
    end if;
    if position('x-borgo58-firma' in v_src) = 0 then
      raise exception '% non allega la parola d''ordine.', v_nome;
    end if;
    if position('bright-function' in v_src) > 0 then
      raise exception '% punta ancora al vecchio nome bright-function.', v_nome;
    end if;
    if position('notify-telegram-reservation' in v_src) = 0 then
      raise exception '% non punta al nome allineato al repository.', v_nome;
    end if;
    -- La chiave pubblica non è più incisa nel codice della funzione
    if position('eyJhbGciOi' in v_src) > 0 then
      raise exception '% contiene ancora la chiave copiata a mano.', v_nome;
    end if;
  end loop;

  -- Il trigger e il job devono essere ancora al loro posto
  select count(*) into n from pg_trigger
   where tgname = 'trg_notify_reservation_telegram' and not tgisinternal;
  if n <> 1 then
    raise exception 'Il trigger delle prenotazioni non è più attivo.';
  end if;
  select count(*) into n from cron.job where jobname = 'send-due-task-reminders';
  if n <> 1 then
    raise exception 'Il job dei promemoria non è più schedulato.';
  end if;

  raise notice 'Notifiche blindate: parola d''ordine dal Vault, chiave pubblica non più incisa nel codice, indirizzo allineato al repository, trigger e job al loro posto.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260809000006', 'blindatura_notifiche')
on conflict (version) do nothing;

-- Riepilogo: tutto deve essere 1, tranne dove indicato.
select
  (select count(*) from vault.secrets where name = 'notifiche_firma')                      as parola_ordine_nel_vault,
  (select count(*) from vault.secrets where name = 'chiave_anon')                          as chiave_nel_vault,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('notify_reservation_telegram','send_due_task_reminders')
      and position('x-borgo58-firma' in p.prosrc) > 0)                                     as funzioni_blindate_su_2,
  (select count(*) from cron.job where jobname = 'send-due-task-reminders')                as job_promemoria;
