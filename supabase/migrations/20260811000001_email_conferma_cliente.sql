-- ---------------------------------------------------------------------
-- L'email di conferma al cliente
-- ---------------------------------------------------------------------
-- Scelta di Alessio del 10/08/2026: quando lui conferma una richiesta
-- arrivata dal sito, il cliente deve ricevere un'email. Oggi non riceve
-- niente — ha scritto e resta in silenzio, e l'unico modo che ha di sapere
-- se il tavolo c'è è telefonare.
--
-- Tre cose non ovvie, decise qui:
--
-- 1. NASCE SPENTA (email_conferma_attiva = false). Un'email inviata da un
--    dominio non ancora verificato presso il servizio di invio finisce
--    nello spam, e ogni messaggio finito nello spam peggiora la
--    reputazione di TUTTI i successivi. Si accende quando il dominio è
--    verificato davvero. Stesso principio di prenotazioni_online_attive.
--
-- 2. IL REGISTRO DEGLI INVII NON CONTIENE L'INDIRIZZO. Sembra comodo
--    scriverci dentro a chi è stata mandata; sarebbe un errore. La pulizia
--    dei dati clienti (20260810000004) cancella le richieste dopo N mesi
--    proprio per non tenere i contatti: un registro parallelo con dentro
--    l'email sopravviverebbe alla cancellazione e la renderebbe finta.
--    Qui resta solo "a questa prenotazione è stata mandata la conferma",
--    e sparisce insieme alla prenotazione.
--
-- 3. LA DECISIONE È SEPARATA DALL'INVIO. `email_conferma_dovuta()` dice
--    soltanto se l'email ci vuole; il trigger la manda. Serve a poter
--    provare la regola — interruttore spento, niente indirizzo, doppione —
--    senza spedire niente a nessuno durante una migrazione.
--
-- Idempotente (§7 punto 3), con verifica finale che solleva eccezione.

-- ---------------------------------------------------------------------
-- 1. L'interruttore
-- ---------------------------------------------------------------------
alter table service_settings
  add column if not exists email_conferma_attiva boolean not null default false;

comment on column service_settings.email_conferma_attiva is
  'Spento finche'' il dominio non e'' verificato presso il servizio di invio: un''email da un mittente non verificato finisce nello spam e rovina la reputazione di quelle dopo. Lo accende Alessio.';

-- ---------------------------------------------------------------------
-- 2. Il registro degli invii — senza la persona dentro
-- ---------------------------------------------------------------------
create table if not exists email_inviate (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  tipo           text not null check (tipo in ('conferma')),
  inviata_il     timestamptz not null default now(),
  unique (reservation_id, tipo)
);

comment on table email_inviate is
  'Quali prenotazioni hanno gia'' ricevuto la loro email. NESSUN indirizzo qui dentro: la riga muore con la prenotazione (on delete cascade), altrimenti sopravvivrebbe alla pulizia dei dati clienti e la renderebbe finta.';

create index if not exists idx_email_inviate_reservation on email_inviate(reservation_id);

alter table email_inviate enable row level security;
drop policy if exists email_inviate_titolare on email_inviate;
create policy email_inviate_titolare on email_inviate
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ---------------------------------------------------------------------
-- 3. Ci vuole l'email? — solo la decisione, nessun invio
-- ---------------------------------------------------------------------
create or replace function email_conferma_dovuta(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_riga    reservations%rowtype;
  v_accesa  boolean;
begin
  select * into v_riga from reservations where id = p_reservation_id;
  if not found then
    return false;
  end if;

  select coalesce(email_conferma_attiva, false) into v_accesa
    from service_settings where id = 1;
  if not coalesce(v_accesa, false) then
    return false;
  end if;

  -- Senza indirizzo non c'è niente da mandare. Le prenotazioni prese al
  -- telefono spesso non ne hanno: non è un errore, è il caso normale.
  if v_riga.customer_email is null or btrim(v_riga.customer_email) = '' then
    return false;
  end if;

  if v_riga.status <> 'confermata' then
    return false;
  end if;

  -- Mai due volte la stessa email: una conferma ricevuta due volte fa
  -- dubitare il cliente di avere due tavoli.
  if exists (
    select 1 from email_inviate
     where reservation_id = p_reservation_id and tipo = 'conferma'
  ) then
    return false;
  end if;

  return true;
end
$funzione$;

comment on function email_conferma_dovuta(uuid) is
  'Dice soltanto SE la conferma va mandata (interruttore, indirizzo, stato, doppione). Separata dall''invio per poter essere provata senza spedire niente.';

-- Nessuno la chiama da fuori: la usa solo invia_email_conferma(), che
-- essendo SECURITY DEFINER gira come proprietario e non passa da questi
-- permessi. Senza revoca, il default di Postgres la lascerebbe eseguibile
-- via PostgREST da chiunque abbia la chiave anon — che è pubblica — e
-- direbbe a un estraneo se una certa prenotazione esiste.
revoke all on function email_conferma_dovuta(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. L'invio — dal database alla funzione online
-- ---------------------------------------------------------------------
-- Perché passa da una Edge Function: la chiave del servizio di invio è un
-- segreto (condizione B2 del contratto) e non può stare né nel sito né
-- nel database in chiaro.
create or replace function invia_email_conferma(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $funzione$
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
  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'url_funzioni'),
    'https://oudjuqbqszisdtwzbxdo.supabase.co/functions/v1'
  ) into v_base;

  if v_firma is null or v_anon is null then
    raise warning 'Email di conferma non inviata: parola d''ordine assente dal Vault.';
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
$funzione$;

comment on function invia_email_conferma(uuid) is
  'Manda la conferma al cliente attraverso la Edge Function email-cliente. Registra l''invio PRIMA di chiamare: meglio un doppione mancato che una conferma mandata due volte. Chiamabile SOLO dal trigger: nessun ruolo applicativo ha il permesso di eseguirla.';

-- ---------------------------------------------------------------------
-- CHI PUÒ CHIAMARLA: soltanto il trigger. Nessuno.
-- ---------------------------------------------------------------------
-- Trovato dal validatore il 11/08/2026. Il default di Postgres concede
-- l'esecuzione a `public`, e Supabase espone via PostgREST tutto ciò che
-- `anon` e `authenticated` possono eseguire: senza questa revoca,
-- chiunque abbia la chiave anon — che è **pubblica**, sta nel bundle del
-- sito — poteva far partire un'email a nome del locale, e con essa una
-- spesa e una riga nel registro degli invii.
--
-- La revoca non rompe niente perché il percorso vero non passa da questi
-- permessi: il trigger è SECURITY DEFINER, gira come proprietario, e il
-- proprietario può sempre eseguire le proprie funzioni.
--
-- Domanda del validatore — «e se domani serve una schermata *Reinvia*?»:
-- non servirà un permesso qui. Una schermata di reinvio è una scrittura
-- con conseguenze, quindi per il contratto (regola B4) passa dal
-- corridoio `operazioni-atomiche`, che chiama una funzione dedicata; il
-- permesso si concede allora a quella, non a questa. Aprire adesso in
-- previsione di un domani è il modo classico di lasciare una porta
-- aperta per una stanza che non verrà mai costruita.
revoke all on function invia_email_conferma(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Il momento in cui parte: quando Alessio conferma
-- ---------------------------------------------------------------------
create or replace function trg_email_conferma_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $funzione$
begin
  if old.status is distinct from new.status and new.status = 'confermata' then
    perform invia_email_conferma(new.id);
  end if;
  return new;
end
$funzione$;

-- Per uniformità: una funzione trigger non è comunque esposta da
-- PostgREST (restituisce `trigger`, non un tipo chiamabile), ma lasciarla
-- con i permessi di default costringerebbe chi controlla a ricordarsi
-- l'eccezione. Meglio una regola sola: nessuna funzione di questa
-- migrazione è eseguibile dai ruoli applicativi.
revoke all on function trg_email_conferma_cliente() from public, anon, authenticated;

drop trigger if exists trg_reservations_email_conferma on reservations;
create trigger trg_reservations_email_conferma
  after update on reservations
  for each row execute function trg_email_conferma_cliente();

-- ---------------------------------------------------------------------
-- 6. Verifica — la regola, provata senza spedire niente
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_id       uuid;
  v_prima    boolean;
  v_dovuta   boolean;
  v_nome     text;
  n          integer;
begin
  select coalesce(email_conferma_attiva, false) into v_prima
    from service_settings where id = 1;

  -- ⚠️ Il collaudo non deve far suonare il telefono di Alessio. Inserire
  -- una prenotazione finta con provenienza "form_pubblico" fa scattare la
  -- notifica Telegram delle richieste vere: successo davvero l'11/08/2026,
  -- e per un attimo è sembrata una prenotazione di un cliente.
  --
  -- Si spegne SOLO quel trigger, non tutti (`session_replication_role =
  -- replica` li fermerebbe tutti, compreso quello che questa migrazione
  -- deve provare: la verifica passerebbe senza aver verificato niente).
  alter table reservations disable trigger trg_notify_reservation_telegram;

  -- Una richiesta finta, con indirizzo, in attesa.
  insert into reservations (type, status, source, reservation_date, reservation_time,
                            party_size, customer_name, customer_email)
  values ('prenotazione', 'richiesta_in_attesa', 'form_pubblico',
          current_date + 30, '20:00', 2, 'PROVA EMAIL', 'prova@example.invalid')
  returning id into v_id;

  -- a) interruttore SPENTO: la conferma non è dovuta, qualunque cosa accada.
  update service_settings set email_conferma_attiva = false where id = 1;
  update reservations set status = 'confermata' where id = v_id;

  select count(*) into n from email_inviate where reservation_id = v_id;
  if n <> 0 then
    raise exception 'Con l''interruttore spento è partita un''email: %.', n;
  end if;

  -- b) interruttore ACCESO: ora è dovuta. Chiamiamo solo la decisione,
  --    non l'invio: la prova non deve spedire niente a nessuno.
  update service_settings set email_conferma_attiva = true where id = 1;
  select email_conferma_dovuta(v_id) into v_dovuta;
  if not v_dovuta then
    raise exception 'Con l''interruttore acceso la conferma non risulta dovuta.';
  end if;

  -- c) senza indirizzo non è dovuta.
  update reservations set customer_email = null where id = v_id;
  if email_conferma_dovuta(v_id) then
    raise exception 'Risulta dovuta un''email verso una prenotazione senza indirizzo.';
  end if;
  update reservations set customer_email = 'prova@example.invalid' where id = v_id;

  -- d) già mandata: non si manda due volte.
  insert into email_inviate (reservation_id, tipo) values (v_id, 'conferma');
  if email_conferma_dovuta(v_id) then
    raise exception 'Risulta dovuta una seconda copia della stessa conferma.';
  end if;

  -- e) il registro muore con la prenotazione (altrimenti sopravvivrebbe
  --    alla pulizia dei dati clienti).
  delete from reservations where id = v_id;
  select count(*) into n from email_inviate where reservation_id = v_id;
  if n <> 0 then
    raise exception 'Cancellata la prenotazione, il registro degli invii è rimasto: % righe.', n;
  end if;

  -- Ripristino: interruttore com'era, e notifiche Telegram riaccese.
  update service_settings set email_conferma_attiva = coalesce(v_prima, false) where id = 1;
  alter table reservations enable trigger trg_notify_reservation_telegram;

  -- Il trigger esiste davvero.
  select count(*) into n from pg_trigger
   where tgname = 'trg_reservations_email_conferma' and not tgisinternal;
  if n <> 1 then
    raise exception 'Il trigger dell''email di conferma non risulta installato.';
  end if;

  -- E le notifiche Telegram sono tornate accese: lasciarle spente
  -- significherebbe che le richieste dei clienti smettono di arrivare sul
  -- telefono, in silenzio. È il guasto peggiore che questa migrazione
  -- possa lasciarsi dietro.
  select count(*) into n from pg_trigger
   where tgname = 'trg_notify_reservation_telegram' and tgenabled = 'O';
  if n <> 1 then
    raise exception 'Le notifiche Telegram delle richieste sono rimaste spente.';
  end if;

  -- Nessun ruolo applicativo può eseguire queste funzioni. È il difetto
  -- trovato dal validatore: senza revoca, chiunque abbia la chiave anon
  -- (pubblica) poteva far partire un'email a nome del locale.
  for v_nome in
    select unnest(array['email_conferma_dovuta(uuid)',
                        'invia_email_conferma(uuid)',
                        'trg_email_conferma_cliente()'])
  loop
    if has_function_privilege('anon', v_nome, 'execute') then
      raise exception 'Il ruolo anonimo può ancora eseguire %.', v_nome;
    end if;
    if has_function_privilege('authenticated', v_nome, 'execute') then
      raise exception 'Un utente qualsiasi del gestionale può ancora eseguire %.', v_nome;
    end if;
  end loop;

  -- Nessuna funzione security definer senza search_path (regola di §6).
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('email_conferma_dovuta', 'invia_email_conferma', 'trg_email_conferma_cliente')
     and p.prosecdef
     and not exists (
       select 1 from unnest(coalesce(p.proconfig, '{}')) as c where c like 'search_path=%'
     );
  if n <> 0 then
    raise exception '% funzioni dell''email non hanno search_path fissato.', n;
  end if;

  select count(*) into n from reservations where customer_name = 'PROVA EMAIL';
  if n <> 0 then
    raise exception 'La prova ha lasciato % prenotazioni nel database.', n;
  end if;

  raise notice 'Email di conferma: regola provata, interruttore %, nessun invio effettuato.',
    case when coalesce(v_prima, false) then 'acceso' else 'spento' end;
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260811000001', 'email_conferma_cliente')
on conflict (version) do nothing;

-- Riepilogo.
select
  (select email_conferma_attiva from service_settings where id = 1)                as email_conferma_attiva,
  (select count(*) from email_inviate)                                            as email_gia_inviate,
  (select count(*) from reservations
    where status = 'confermata' and customer_email is not null)                    as confermate_con_indirizzo;
