-- =====================================================================
-- Il sistema avvisa quando si rompe, invece di aspettare che si veda
-- =====================================================================
-- Blocco 3 del Mandato strutturale.
--
-- Il buco: un guasto al corridoio delle operazioni o ai promemoria oggi si
-- scopre dal sintomo — un conto che non si chiude, un adempimento che non
-- è mai arrivato — cioè quando ha già fatto danno. Peggio ancora per i
-- promemoria: se il giro non parte più, il silenzio è identico a "non
-- c'era niente da ricordare". **L'assenza di un'esecuzione non può
-- segnalarsi da sola**: serve qualcuno che si accorga che l'ultima
-- riuscita è troppo vecchia.
--
-- Tre pezzi:
--   1. `allarmi`      — dove restano scritti, leggibili dal solo titolare
--   2. `segnala_allarme()` — con il freno anti-tempesta: **mai più di un
--      avviso per tipo di guasto in un'ora**. Durante un servizio, cento
--      messaggi identici sul telefono non sono cento informazioni: sono
--      zero informazioni e un telefono inutilizzabile.
--   3. `controlla_lavori_pianificati()` — la sentinella dei promemoria,
--      chiamata ogni quarto d'ora da pg_cron.
--
-- Cosa NON è un guasto: i rifiuti previsti. «Non c'è più posto», «solo il
-- titolare può farlo», «questo conto è già chiuso» sono il sistema che
-- funziona. Se facessero rumore, il rumore diventerebbe normale e il
-- primo guasto vero passerebbe inosservato. La distinzione vive nel
-- corridoio (`supabase/functions/operazioni-atomiche/index.ts`), che
-- chiama questa funzione solo per gli errori che non sa spiegare.

-- ---------------------------------------------------------------------
-- 1. Dove restano scritti
-- ---------------------------------------------------------------------
create table if not exists allarmi (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null,
  messaggio   text not null,
  dettagli    jsonb,
  creato_il   timestamptz not null default now(),
  notificato  boolean not null default false
);

comment on table allarmi is
  'Guasti veri del sistema (non i rifiuti previsti). Uno per tipo per ora: il resto viene inghiottito di proposito.';

create index if not exists idx_allarmi_tipo_data on allarmi (tipo, creato_il desc);

alter table allarmi enable row level security;
drop policy if exists allarmi_titolare on allarmi;
create policy allarmi_titolare on allarmi
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ---------------------------------------------------------------------
-- 2. Il registro dei lavori pianificati: quando è andata bene l'ultima volta
-- ---------------------------------------------------------------------
create table if not exists stato_lavori (
  nome            text primary key,
  ultimo_successo timestamptz not null default now()
);

comment on table stato_lavori is
  'Ultima esecuzione riuscita di ogni lavoro pianificato. È ciò che permette di accorgersi che un lavoro NON è partito: il silenzio, da solo, non si segnala.';

alter table stato_lavori enable row level security;
drop policy if exists stato_lavori_titolare on stato_lavori;
create policy stato_lavori_titolare on stato_lavori
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

insert into stato_lavori (nome, ultimo_successo)
values ('promemoria_agenda', now())
on conflict (nome) do nothing;

-- ---------------------------------------------------------------------
-- 3. Segnalare un guasto — con il freno
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
  if exists (
    select 1 from allarmi
     where tipo = p_tipo
       and creato_il > now() - interval '1 hour'
  ) then
    return false;
  end if;

  insert into allarmi (tipo, messaggio, dettagli)
  values (p_tipo, p_messaggio, p_dettagli)
  returning id into v_id;

  select decrypted_secret into v_firma from vault.decrypted_secrets where name = 'notifiche_firma';
  select decrypted_secret into v_anon  from vault.decrypted_secrets where name = 'chiave_anon';
  -- L'indirizzo delle funzioni online sta nel Vault se qualcuno ce l'ha
  -- messo (così un secondo progetto non chiama quello vero); altrimenti
  -- resta quello di sempre.
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
  'Registra un guasto vero e lo manda su Telegram. Mai più di uno per tipo in un''ora. Restituisce false se il freno ha fermato l''avviso.';

-- Il corridoio la chiama col token dell'utente vero: deve poterla eseguire
-- chiunque sia autenticato. Non espone nulla — scrive soltanto.
revoke all on function segnala_allarme(text, text, jsonb) from public, anon;
grant execute on function segnala_allarme(text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 4. I promemoria segnano quando il giro è andato bene
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

  -- Se non si può notificare, NON si marcano i promemoria come inviati —
  -- altrimenti sparirebbero senza essere mai arrivati. E non si segna il
  -- giro come riuscito: questo è un guasto, e la sentinella deve vederlo.
  if v_firma is null or v_anon is null then
    raise warning 'Promemoria Telegram saltati: parola d''ordine o chiave assenti dal Vault.';
    perform segnala_allarme(
      'notifiche_senza_chiavi',
      'I promemoria non partono: manca la parola d''ordine nel Vault del database.'
    );
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

  -- Il giro è arrivato in fondo: è questa riga che permette di accorgersi,
  -- fra mezz'ora, che il giro NON è più arrivato in fondo.
  insert into stato_lavori (nome, ultimo_successo) values ('promemoria_agenda', now())
  on conflict (nome) do update set ultimo_successo = excluded.ultimo_successo;
end;
$$;

comment on function send_due_task_reminders is
  'Chiamata da pg_cron ogni 5 minuti. Invia i promemoria scaduti e registra il proprio successo in stato_lavori. Se la parola d''ordine manca NON marca nulla come inviato e segnala un allarme.';

-- ---------------------------------------------------------------------
-- 5. La sentinella: si accorge del silenzio
-- ---------------------------------------------------------------------
create or replace function controlla_lavori_pianificati()
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_ultimo timestamptz;
  v_minuti integer;
begin
  select ultimo_successo into v_ultimo from stato_lavori where nome = 'promemoria_agenda';

  -- Il giro gira ogni 5 minuti: mezz'ora di silenzio non è un ritardo,
  -- sono sei giri saltati.
  if v_ultimo is null or v_ultimo < now() - interval '30 minutes' then
    v_minuti := coalesce(extract(epoch from (now() - v_ultimo)) / 60, -1)::integer;
    perform segnala_allarme(
      'promemoria_fermi',
      'I promemoria dell''Agenda non girano da ' || greatest(v_minuti, 0) || ' minuti. Gli avvisi di scadenza non stanno partendo.',
      jsonb_build_object('ultimo_successo', v_ultimo)
    );
  end if;
end
$funzione$;

comment on function controlla_lavori_pianificati is
  'Sentinella: se l''ultimo giro riuscito dei promemoria è più vecchio di mezz''ora, segnala. Il verso è questo perché un''esecuzione che non avviene non può segnalarsi da sola.';

select cron.schedule(
  'sentinella-lavori',
  '*/15 * * * *',
  $cron$select controlla_lavori_pianificati();$cron$
);

-- ---------------------------------------------------------------------
-- 6. Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_prima  timestamptz;
  v_primo  boolean;
  v_secondo boolean;
  n        integer;
begin
  -- Si parte pulito su questo tipo, altrimenti il freno falserebbe la prova.
  delete from allarmi where tipo = '__prova_allarme__';

  -- 1. Il primo avviso passa, il secondo identico NO (freno anti-tempesta).
  v_primo   := segnala_allarme('__prova_allarme__', 'primo');
  v_secondo := segnala_allarme('__prova_allarme__', 'secondo, non deve passare');

  if not v_primo then
    raise exception 'Il primo avviso non è stato registrato.';
  end if;
  if v_secondo then
    raise exception 'Il freno anti-tempesta non ha fermato il secondo avviso nella stessa ora.';
  end if;
  select count(*) into n from allarmi where tipo = '__prova_allarme__';
  if n <> 1 then
    raise exception 'Attesa una sola riga di allarme, trovate %.', n;
  end if;

  -- 2. La sentinella tace quando il giro è recente...
  select ultimo_successo into v_prima from stato_lavori where nome = 'promemoria_agenda';
  update stato_lavori set ultimo_successo = now() where nome = 'promemoria_agenda';
  delete from allarmi where tipo = 'promemoria_fermi';

  perform controlla_lavori_pianificati();
  select count(*) into n from allarmi where tipo = 'promemoria_fermi';
  if n <> 0 then
    raise exception 'La sentinella ha gridato al lupo con i promemoria in perfetta salute.';
  end if;

  -- ...e parla quando l'ultimo giro riuscito è troppo vecchio.
  update stato_lavori set ultimo_successo = now() - interval '2 hours'
   where nome = 'promemoria_agenda';

  perform controlla_lavori_pianificati();
  select count(*) into n from allarmi where tipo = 'promemoria_fermi';
  if n <> 1 then
    raise exception 'La sentinella non si è accorta che i promemoria sono fermi da due ore.';
  end if;

  -- 3. Tutto com'era: lo stato del lavoro e gli allarmi di prova via.
  update stato_lavori set ultimo_successo = coalesce(v_prima, now())
   where nome = 'promemoria_agenda';
  delete from allarmi where tipo in ('__prova_allarme__', 'promemoria_fermi');

  select count(*) into n from allarmi where tipo in ('__prova_allarme__', 'promemoria_fermi');
  if n <> 0 then
    raise exception 'La prova ha lasciato % allarmi nel database.', n;
  end if;

  -- 4. La sentinella è programmata davvero
  select count(*) into n from cron.job where jobname = 'sentinella-lavori';
  if n <> 1 then
    raise exception 'La sentinella non risulta programmata in pg_cron.';
  end if;

  raise notice 'Allarmi attivi: uno per tipo all''ora, sentinella dei promemoria ogni quarto d''ora.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260810000005', 'allarmi')
on conflict (version) do nothing;

-- Riepilogo.
select
  (select count(*) from cron.job where jobname = 'sentinella-lavori')                as sentinella_programmata,
  (select ultimo_successo from stato_lavori where nome = 'promemoria_agenda')        as ultimo_giro_promemoria,
  (select count(*) from allarmi)                                                     as allarmi_presenti,
  (select count(*) from allarmi where creato_il > now() - interval '24 hours')       as allarmi_ultime_24h;
