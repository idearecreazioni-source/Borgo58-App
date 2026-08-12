-- ---------------------------------------------------------------------
-- Ogni lavoro pianificato nasce col battito — e la sentinella li guarda tutti
-- ---------------------------------------------------------------------
-- Coda della consegna «posta viva», dal controllo del validatore del
-- 12/08/2026: dei quattro lavori notturni/periodici, `pulizia-richieste-
-- scadute` non scriveva il proprio battito. Nato nel Blocco 2 *prima* che
-- la sentinella esistesse, non è mai stato portato sotto il suo sguardo:
-- se morisse stanotte, le richieste scadute smetterebbero di cancellarsi
-- in silenzio — che per un obbligo di conservazione è il guasto peggiore.
--
-- Guardando per applicare la correzione è emerso che il buco era più
-- largo di così, e in un punto che nessuno aveva controllato:
--
--   la sentinella guardava UN SOLO lavoro, `promemoria_agenda`,
--   scritto a mano dentro il suo corpo.
--
-- `lettura_posta` e `pulizia_posta` il battito lo scrivevano — ma non lo
-- leggeva nessuno. Due lavori sorvegliati per finta: la riga si aggiorna,
-- il registro sembra sano, e se si fermassero il silenzio sarebbe identico
-- a quello di prima. Aggiungere il quarto battito e lasciare la sentinella
-- com'era avrebbe prodotto tre lavori sorvegliati per finta invece di due.
--
-- COSA CAMBIA
--
-- 1. **L'elenco dei lavori da sorvegliare è una tabella, non del codice**
--    (`lavori_sorvegliati`): nome, ogni quanto ci si aspetta un segno di
--    vita, e la frase che dice ad Alessio *cosa smette di funzionare*
--    quando quel lavoro si ferma — «non vengono più cancellate» dice
--    qualcosa, «pulizia_richieste ferma» no.
--
-- 2. **La sentinella fa anche il censimento, nei due versi**: un lavoro
--    pianificato che nessuno sorveglia è un allarme, e un lavoro
--    sorvegliato che non è più pianificato (o è stato disattivato) è un
--    altro allarme. È la lezione del validatore — *ogni lavoro pianificato
--    nasce col battito* — messa nel database invece che in un controllo di
--    routine da ricordarsi di fare: se domani si aggiunge un lavoro e ci
--    si dimentica il battito, lo dice il sistema entro un quarto d'ora.
--    (§5 di CLAUDE.md: preferire l'automazione alla disciplina.)
--
-- 3. **`pulisci_richieste_scadute()` scrive il battito** — la correzione
--    chiesta.
--
-- 4. **`chiedi_lettura_posta()` scrive il battito anche quando non c'è
--    niente da leggere.** Prima lo scriveva solo dopo aver chiamato l'AI:
--    significa «l'ultima volta che ho chiesto una lettura», non «l'ultima
--    volta che ho fatto il mio giro» — e sorvegliare quello avrebbe fatto
--    gridare la sentinella ogni notte tranquilla, cioè quasi sempre. Un
--    allarme che suona quando va tutto bene si impara a ignorare, ed è
--    peggio di nessun allarme. Resta fuori il solo caso della parola
--    d'ordine mancante: quello è un guasto vero, e non va marcato riuscito.
--
-- LA DECISIONE È SEPARATA DALL'INVIO, e non per eleganza: verificare una
-- sentinella significa metterla in condizione di gridare, e questa grida
-- su Telegram. `lavori_in_silenzio()` e `lavori_senza_sentinella()`
-- rispondono *chi* è fermo senza avvisare nessuno; `controlla_lavori_
-- pianificati()` le interroga e avvisa. Così la verifica qui sotto prova
-- la regola per intero **senza far suonare il telefono di Alessio** —
-- stessa scelta fatta l'11/08 per l'email di conferma, stesso motivo
-- (§8 di CLAUDE.md: il collaudo di una migrazione può far suonare il
-- telefono).
--
-- LIMITE DICHIARATO: la sentinella non può sorvegliare se stessa — un
-- testimone non testimonia della propria assenza. Se si ferma lei, tacciono
-- tutti gli allarmi dei lavori. Servirebbe un occhio fuori dal database
-- (oggi non c'è); per questo `sentinella-lavori` è esclusa dal censimento
-- invece di essere sorvegliata per finta.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. Chi va sorvegliato, e cosa smette quando si ferma
-- ---------------------------------------------------------------------
create table if not exists lavori_sorvegliati (
  nome_lavoro       text primary key,
  nome_cron         text not null unique,
  tolleranza_minuti integer not null check (tolleranza_minuti > 0),
  cosa_smette       text not null
);

comment on table lavori_sorvegliati is
  'I lavori pianificati che devono dare un segno di vita, e ogni quanto. Aggiungere un lavoro a cron.job senza aggiungerlo qui produce un allarme entro un quarto d''ora: e'' voluto.';
comment on column lavori_sorvegliati.nome_lavoro is
  'La chiave in stato_lavori — il nome con cui il lavoro scrive il proprio battito.';
comment on column lavori_sorvegliati.nome_cron is
  'Il nome in cron.job — serve al censimento nei due versi.';
comment on column lavori_sorvegliati.cosa_smette is
  'Cosa smette di funzionare, in italiano. Finisce nel messaggio su Telegram: e'' la parte che dice ad Alessio se deve alzarsi o no.';

alter table lavori_sorvegliati enable row level security;
drop policy if exists lavori_sorvegliati_titolare on lavori_sorvegliati;
create policy lavori_sorvegliati_titolare on lavori_sorvegliati
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

insert into lavori_sorvegliati (nome_lavoro, nome_cron, tolleranza_minuti, cosa_smette) values
  ('promemoria_agenda',  'send-due-task-reminders',   30,
   'Gli avvisi di scadenza dell''Agenda non stanno partendo.'),
  ('lettura_posta',      'lettura-posta',             45,
   'La posta in arrivo non viene piu'' letta: fatture e documenti restano fermi nella sala d''aspetto.'),
  ('pulizia_posta',      'pulizia-posta-scaduta',   1560,
   'La posta vecchia non viene piu'' cancellata: resta nel database oltre i mesi dichiarati.'),
  ('pulizia_richieste',  'pulizia-richieste-scadute', 1560,
   'Le richieste rifiutate non vengono piu'' cancellate: i dati dei clienti restano oltre il termine dichiarato nell''informativa.')
on conflict (nome_lavoro) do update
  set nome_cron         = excluded.nome_cron,
      tolleranza_minuti = excluded.tolleranza_minuti,
      cosa_smette       = excluded.cosa_smette;

-- I lavori quotidiani hanno 26 ore di tolleranza: 24 esatte farebbero
-- gridare la sentinella ogni notte per il minuto di scarto fra un giro e
-- l'altro.

-- Il battito di partenza per chi non ne ha mai avuto uno — la pulizia
-- della privacy, e su un database appena ricostruito anche i lavori che
-- non hanno ancora fatto il loro primo giro.
-- Sceglie `now()` di proposito: se uno di questi fosse gia' rotto oggi, il
-- primo allarme arriverebbe dopo la sua tolleranza invece che subito — ma
-- l'alternativa (nessun battito = allarme immediato) farebbe gridare la
-- sentinella per un guasto inventato dalla migrazione stessa.
insert into stato_lavori (nome, ultimo_successo)
select nome_lavoro, now() from lavori_sorvegliati
on conflict (nome) do nothing;

-- ---------------------------------------------------------------------
-- 2. La correzione chiesta: la pulizia della privacy scrive il battito
-- ---------------------------------------------------------------------
create or replace function pulisci_richieste_scadute()
returns table (richieste_cancellate integer, clienti_cancellati integer)
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_mesi     integer;
  v_limite   timestamptz;
  v_clienti  uuid[];
  v_richieste integer := 0;
  v_orfani    integer := 0;
begin
  select mesi_conservazione_richieste into v_mesi from service_settings where id = 1;
  v_mesi := coalesce(v_mesi, 6);
  v_limite := now() - make_interval(months => v_mesi);

  -- Solo rifiutate e annullate: una prenotazione confermata è la storia
  -- del locale (chi è venuto, quanti erano) e non si tocca qui.
  with tolte as (
    delete from reservations
     where status in ('rifiutata', 'annullata')
       and created_at < v_limite
    returning *
  ), registro as (
    -- Traccia sì, dato personale no: la riga entra nel registro con i
    -- campi che identificano la persona sostituiti da un segnaposto.
    insert into deleted_records (table_name, record_id, record)
    select 'reservations', t.id::text,
           to_jsonb(t)
             - 'customer_name' - 'customer_phone' - 'customer_email' - 'notes'
             || jsonb_build_object('rimosso_per_conservazione', 'dati personali rimossi alla scadenza della conservazione')
    from tolte t
  )
  select count(*)::integer, array_remove(array_agg(distinct customer_id), null)
    into v_richieste, v_clienti
  from tolte;

  if v_clienti is not null and array_length(v_clienti, 1) > 0 then
    with orfani as (
      delete from customers c
       where c.id = any (v_clienti)
         and not exists (select 1 from reservations r where r.customer_id = c.id)
         and not exists (select 1 from discounts_gifts d where d.customer_id = c.id)
      returning *
    ), registro_clienti as (
      insert into deleted_records (table_name, record_id, record)
      select 'customers', o.id::text,
             to_jsonb(o) - 'name' - 'phone' - 'email' - 'notes'
               || jsonb_build_object('rimosso_per_conservazione', 'dati personali rimossi alla scadenza della conservazione')
      from orfani o
    )
    select count(*)::integer into v_orfani from orfani;
  end if;

  insert into privacy_pulizie (mesi_conservazione, richieste_cancellate, clienti_cancellati)
  values (v_mesi, v_richieste, v_orfani);

  -- Il giro è arrivato in fondo. Senza questa riga, il giorno in cui non
  -- ci arriva più nessuno se ne accorge: non cancellare non produce
  -- nessun sintomo visibile, solo dati che restano dove non dovrebbero.
  insert into stato_lavori (nome, ultimo_successo)
  values ('pulizia_richieste', now())
  on conflict (nome) do update set ultimo_successo = excluded.ultimo_successo;

  return query select v_richieste, v_orfani;
end
$funzione$;

comment on function pulisci_richieste_scadute() is
  'Cancella richieste rifiutate/annullate più vecchie del limite in service_settings, e i contatti che restano senza alcuna storia. Chiamata ogni notte da pg_cron. Registra il proprio successo in stato_lavori.';

revoke all on function pulisci_richieste_scadute() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. La lettura della posta segna il giro, non la chiamata all'AI
-- ---------------------------------------------------------------------
create or replace function chiedi_lettura_posta()
returns boolean
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_firma text;
  v_anon  text;
  v_base  text;
  n       integer;
begin
  select count(*) into n from posta_ricevuta where stato = 'da_leggere';
  if n = 0 then
    -- Niente da leggere: nessuna chiamata, nessun costo — ma il giro c'è
    -- stato, e va scritto. È la giornata normale: sorvegliare solo i giri
    -- che chiamano l'AI significherebbe un allarme ogni notte tranquilla.
    insert into stato_lavori (nome, ultimo_successo)
    values ('lettura_posta', now())
    on conflict (nome) do update set ultimo_successo = excluded.ultimo_successo;
    return false;
  end if;

  select decrypted_secret into v_firma from vault.decrypted_secrets where name = 'notifiche_firma';
  select decrypted_secret into v_anon  from vault.decrypted_secrets where name = 'chiave_anon';
  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'url_funzioni'),
    'https://oudjuqbqszisdtwzbxdo.supabase.co/functions/v1'
  ) into v_base;

  -- Qui il battito NON si scrive: c'era posta da leggere e non è stata
  -- letta. È un guasto, e la sentinella deve vederlo.
  if v_firma is null or v_anon is null then
    raise warning 'Posta non letta: parola d''ordine assente dal Vault.';
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
$funzione$;

comment on function chiedi_lettura_posta() is
  'Chiamata da pg_cron ogni quarto d''ora. Se c''è posta da leggere chiama posta-leggi. Registra il proprio successo in stato_lavori anche quando non c''è niente da leggere: il giro è avvenuto lo stesso.';

revoke all on function chiedi_lettura_posta() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. La decisione: chi è fermo, chi non è sorvegliato — senza avvisare
-- ---------------------------------------------------------------------
create or replace function lavori_in_silenzio()
returns table (
  nome_lavoro text,
  nome_cron   text,
  minuti      integer,
  cosa_smette text
)
language sql
stable
security definer
set search_path = public
as $funzione$
  select l.nome_lavoro,
         l.nome_cron,
         coalesce(extract(epoch from (now() - s.ultimo_successo)) / 60, -1)::integer,
         l.cosa_smette
    from lavori_sorvegliati l
    left join stato_lavori s on s.nome = l.nome_lavoro
   where s.ultimo_successo is null
      or s.ultimo_successo < now() - make_interval(mins => l.tolleranza_minuti);
$funzione$;

comment on function lavori_in_silenzio() is
  'Quali lavori sorvegliati non danno segno di vita da troppo tempo. Decide e basta: non avvisa nessuno, così la si può provare senza far squillare Telegram.';

revoke all on function lavori_in_silenzio() from public, anon, authenticated;

create or replace function lavori_senza_sentinella()
returns table (nome_cron text, verso text)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;

  -- Un lavoro pianificato che nessuno guarda. La sentinella è esclusa:
  -- non può essere testimone della propria assenza.
  return query
    select j.jobname::text, 'non_sorvegliato'::text
      from cron.job j
     where j.jobname <> 'sentinella-lavori'
       and not exists (select 1 from lavori_sorvegliati l where l.nome_cron = j.jobname);

  -- E il verso opposto: sorvegliamo un lavoro che non gira più. Senza
  -- questo, cancellare il lavoro spegnerebbe anche il suo allarme —
  -- il battito resta fermo all'ultimo giro e nessuno lo sa.
  return query
    select l.nome_cron, 'sparito'::text
      from lavori_sorvegliati l
     where not exists (
       select 1 from cron.job j where j.jobname = l.nome_cron and j.active
     );
end
$funzione$;

comment on function lavori_senza_sentinella() is
  'Censimento nei due versi fra cron.job e lavori_sorvegliati. Decide e basta, come lavori_in_silenzio().';

revoke all on function lavori_senza_sentinella() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. La sentinella: interroga le due decisioni e avvisa
-- ---------------------------------------------------------------------
create or replace function controlla_lavori_pianificati()
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  r record;
begin
  for r in select * from lavori_in_silenzio() loop
    -- Un tipo di allarme per lavoro: il freno anti-tempesta è per tipo,
    -- e con un tipo solo il secondo lavoro rotto resterebbe muto per un'ora.
    perform segnala_allarme(
      'lavoro_fermo_' || r.nome_lavoro,
      'Il lavoro «' || r.nome_cron || '» non arriva in fondo da ' ||
        greatest(r.minuti, 0) || ' minuti. ' || r.cosa_smette,
      jsonb_build_object('lavoro', r.nome_lavoro, 'minuti', r.minuti)
    );
  end loop;

  for r in select * from lavori_senza_sentinella() loop
    if r.verso = 'non_sorvegliato' then
      perform segnala_allarme(
        'lavoro_non_sorvegliato',
        'Il lavoro pianificato «' || r.nome_cron || '» non è sorvegliato da nessuno: ' ||
        'se smettesse di girare, non se ne accorgerebbe nessuno.',
        jsonb_build_object('lavoro', r.nome_cron)
      );
    else
      perform segnala_allarme(
        'lavoro_sparito',
        'Il lavoro «' || r.nome_cron || '» risulta sorvegliato ma non è più pianificato, o è stato disattivato.',
        jsonb_build_object('lavoro', r.nome_cron)
      );
    end if;
  end loop;
end
$funzione$;

comment on function controlla_lavori_pianificati is
  'Sentinella, ogni quarto d''ora: avvisa per ogni lavoro fermo e per ogni scarto fra cron.job e lavori_sorvegliati. Il verso è questo perché un''esecuzione che non avviene non può segnalarsi da sola. Non sorveglia se stessa: limite dichiarato.';

-- Nessuno la chiama dall'app: la chiama pg_cron, come `postgres`. Il
-- permesso a `authenticated` era un residuo — un utente qualunque poteva
-- far partire il giro degli allarmi.
revoke all on function controlla_lavori_pianificati() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Verifica (§7 punti 1-3) — senza mandare un solo avviso
-- ---------------------------------------------------------------------
do $verifica$
declare
  r          record;
  v_salvati  jsonb := '{}'::jsonb;
  n          integer;
  v_allarmi_prima integer;
  v_allarmi_dopo  integer;
begin
  -- Si mette da parte lo stato vero dei battiti: alla fine torna com'era.
  for r in select nome, ultimo_successo from stato_lavori loop
    v_salvati := v_salvati || jsonb_build_object(r.nome, r.ultimo_successo);
  end loop;

  select count(*) into v_allarmi_prima from allarmi;

  -- 1. Tutti e quattro i lavori sono sorvegliati davvero.
  select count(*) into n from lavori_sorvegliati;
  if n <> 4 then
    raise exception 'Attesi 4 lavori sorvegliati, trovati %.', n;
  end if;

  -- 2. Con i battiti freschi, nessuno risulta fermo.
  update stato_lavori set ultimo_successo = now()
   where nome in (select nome_lavoro from lavori_sorvegliati);

  select count(*) into n from lavori_in_silenzio();
  if n <> 0 then
    raise exception 'Con tutti i battiti freschi risultano % lavori fermi.', n;
  end if;

  -- 3. Uno per uno: se tace oltre la sua tolleranza, viene visto.
  --    Compresa la pulizia della privacy, che è il motivo di questa migrazione.
  for r in select nome_lavoro, tolleranza_minuti from lavori_sorvegliati loop
    update stato_lavori
       set ultimo_successo = now() - make_interval(mins => r.tolleranza_minuti + 10)
     where nome = r.nome_lavoro;

    select count(*) into n from lavori_in_silenzio() where nome_lavoro = r.nome_lavoro;
    if n <> 1 then
      raise exception 'Il lavoro % tace da oltre la sua tolleranza e la sentinella non lo vede.', r.nome_lavoro;
    end if;

    update stato_lavori set ultimo_successo = now() where nome = r.nome_lavoro;
  end loop;

  -- 4. Un battito che non è mai stato scritto vale come silenzio.
  delete from stato_lavori where nome = 'pulizia_richieste';
  select count(*) into n from lavori_in_silenzio() where nome_lavoro = 'pulizia_richieste';
  if n <> 1 then
    raise exception 'Un lavoro senza nessun battito non viene contato come fermo.';
  end if;
  insert into stato_lavori (nome, ultimo_successo) values ('pulizia_richieste', now());

  -- 5. Il censimento: oggi non deve avere niente da dire...
  select count(*) into n from lavori_senza_sentinella();
  if n <> 0 then
    raise exception 'Il censimento segnala % scarti fra i lavori pianificati e quelli sorvegliati.', n;
  end if;

  -- ...e si accorge di un lavoro pianificato che nessuno guarda.
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    delete from lavori_sorvegliati where nome_lavoro = 'pulizia_posta';

    select count(*) into n from lavori_senza_sentinella()
     where nome_cron = 'pulizia-posta-scaduta' and verso = 'non_sorvegliato';
    if n <> 1 then
      raise exception 'Un lavoro pianificato senza sorveglianza non viene notato.';
    end if;

    insert into lavori_sorvegliati (nome_lavoro, nome_cron, tolleranza_minuti, cosa_smette)
    values ('pulizia_posta', 'pulizia-posta-scaduta', 1560,
            'La posta vecchia non viene piu'' cancellata: resta nel database oltre i mesi dichiarati.');

    -- ...e del verso opposto: sorvegliato, ma non più pianificato.
    insert into lavori_sorvegliati (nome_lavoro, nome_cron, tolleranza_minuti, cosa_smette)
    values ('__prova_lavoro__', '__lavoro-che-non-esiste__', 60, 'Niente: è una prova.');

    select count(*) into n from lavori_senza_sentinella()
     where nome_cron = '__lavoro-che-non-esiste__' and verso = 'sparito';
    if n <> 1 then
      raise exception 'Un lavoro sorvegliato ma non più pianificato non viene notato.';
    end if;

    delete from lavori_sorvegliati where nome_lavoro = '__prova_lavoro__';
  end if;

  -- 6. Tutto com'era: i battiti veri tornano al loro valore.
  for r in select nome, ultimo_successo from stato_lavori loop
    if v_salvati ? r.nome then
      update stato_lavori
         set ultimo_successo = (v_salvati ->> r.nome)::timestamptz
       where nome = r.nome;
    end if;
  end loop;

  -- 7. La prova non ha avvisato nessuno: nessun allarme nuovo, nessun
  --    messaggio su Telegram. È il motivo per cui la decisione è separata
  --    dall'invio.
  select count(*) into v_allarmi_dopo from allarmi;
  if v_allarmi_dopo <> v_allarmi_prima then
    raise exception 'La prova ha prodotto % allarmi: doveva non mandarne nessuno.',
      v_allarmi_dopo - v_allarmi_prima;
  end if;

  -- 8. Nessun residuo di prova.
  select count(*) into n from lavori_sorvegliati where nome_lavoro like '\_\_%';
  if n <> 0 then
    raise exception 'La prova ha lasciato % righe nei lavori sorvegliati.', n;
  end if;
  select count(*) into n from lavori_sorvegliati;
  if n <> 4 then
    raise exception 'I lavori sorvegliati sono % invece di 4 dopo la prova.', n;
  end if;

  raise notice 'Sentinella: 4 lavori sorvegliati, censimento nei due versi, zero avvisi mandati dalla prova.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260812000008', 'ogni_lavoro_col_battito')
on conflict (version) do nothing;

select l.nome_lavoro,
       l.nome_cron,
       l.tolleranza_minuti,
       s.ultimo_successo,
       (now() - s.ultimo_successo) as silenzio
  from lavori_sorvegliati l
  left join stato_lavori s on s.nome = l.nome_lavoro
 order by l.nome_lavoro;
