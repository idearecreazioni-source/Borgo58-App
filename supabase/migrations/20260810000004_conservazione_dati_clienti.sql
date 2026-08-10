-- =====================================================================
-- I dati di chi non è mai venuto non restano per sempre
-- =====================================================================
-- Blocco 2 del Mandato strutturale (privacy dei clienti), parte database.
--
-- Il fatto: il form pubblico raccoglie nome, telefono ed email di persone
-- reali. Le richieste RIFIUTATE o ANNULLATE — quelle di chi non ha mai
-- messo piede nel locale — restavano a tempo indeterminato. Tenere dati
-- personali oltre il tempo necessario non è una svista tecnica: è
-- esattamente ciò che il GDPR chiama conservazione illimitata.
--
-- La regola, decisa da Alessio il 10/08/2026: **sei mesi**. Vive in
-- `service_settings`, non nel codice: è un dato del locale, e Alessio
-- deve poterlo cambiare senza toccare una riga di programma (stesso
-- principio di capienza, orari e prezzo del coperto).
--
-- DUE SCELTE CHE VANNO MOTIVATE, perché non sono ovvie:
--
-- 1. **Nel registro delle cancellazioni finisce la riga, non la persona.**
--    Il mandato chiede che ogni eliminazione passi dal registro, come
--    tutte le altre. Copiarci dentro la riga intera però svuoterebbe
--    l'operazione: `deleted_records` conserva una copia jsonb completa, e
--    cancellare una prenotazione per motivi di privacy depositandone la
--    fotocopia integrale nel registro significa non aver cancellato
--    niente. Quindi: **una riga di registro per ogni eliminazione** — c'è
--    traccia di cosa è stato tolto e quando — ma con nome, telefono,
--    email e note **sostituiti da un segnaposto**. Resta l'audit, se ne
--    va il dato personale. In più `privacy_pulizie` tiene il conto delle
--    esecuzioni: la prova che la regola gira davvero.
--
-- 2. **Sparisce anche il cliente rimasto orfano.** Un trigger crea una
--    riga in `customers` a ogni richiesta con un telefono. Cancellare la
--    richiesta e lasciare la persona in rubrica sarebbe una cancellazione
--    finta. Vengono però toccati SOLO i clienti che restano orfani per
--    effetto di questa pulizia — e solo se non hanno nessun'altra traccia
--    (nessuna prenotazione, nessuno sconto/omaggio). Chi ha una storia
--    nel locale non viene mai toccato.

-- ---------------------------------------------------------------------
-- 1. Quanto si conserva: un dato, non una costante nel codice
-- ---------------------------------------------------------------------
alter table service_settings
  add column if not exists mesi_conservazione_richieste integer not null default 6;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'service_settings_conservazione_check') then
    alter table service_settings add constraint service_settings_conservazione_check
      check (mesi_conservazione_richieste between 1 and 120);
  end if;
end $$;

comment on column service_settings.mesi_conservazione_richieste is
  'Dopo quanti mesi le richieste rifiutate o annullate vengono cancellate insieme ai contatti rimasti senza storia. Deciso da Alessio: 6. Si cambia da qui, non nel codice.';

-- ---------------------------------------------------------------------
-- 2. Il registro delle pulizie: quante righe, quando. Nessun dato personale
-- ---------------------------------------------------------------------
create table if not exists privacy_pulizie (
  id                    uuid primary key default gen_random_uuid(),
  eseguita_il           timestamptz not null default now(),
  mesi_conservazione    integer not null,
  richieste_cancellate  integer not null,
  clienti_cancellati    integer not null
);

comment on table privacy_pulizie is
  'Traccia delle pulizie automatiche dei dati dei clienti: quante righe e quando, mai quali. Serve a dimostrare che la regola di conservazione gira davvero.';

alter table privacy_pulizie enable row level security;
drop policy if exists privacy_pulizie_titolare on privacy_pulizie;
create policy privacy_pulizie_titolare on privacy_pulizie
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ---------------------------------------------------------------------
-- 3. La pulizia
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

  return query select v_richieste, v_orfani;
end
$funzione$;

comment on function pulisci_richieste_scadute() is
  'Cancella richieste rifiutate/annullate più vecchie del limite in service_settings, e i contatti che restano senza alcuna storia. Chiamata ogni notte da pg_cron.';

-- Nessuno la esegue dall''app: gira da sola, o la lancia Alessio dall'SQL
-- Editor. Un pulsante che cancella dati non sta in una schermata di sala.
revoke all on function pulisci_richieste_scadute() from public;
revoke all on function pulisci_richieste_scadute() from anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Ogni notte alle 4:30 (fuori servizio, anche dopo una chiusura tardi)
-- ---------------------------------------------------------------------
select cron.schedule(
  'pulizia-richieste-scadute',
  '30 4 * * *',
  $cron$select pulisci_richieste_scadute();$cron$
);

-- ---------------------------------------------------------------------
-- 5. Verifica (§7 punti 1-3): la scena vera, poi tutto com'era
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_mesi      integer;
  v_vecchio   uuid;
  v_recente   uuid;
  v_confermata uuid;
  v_cli_a     uuid;
  v_cli_b     uuid;
  v_esito     record;
  n           integer;
begin
  select mesi_conservazione_richieste into v_mesi from service_settings where id = 1;
  if v_mesi is null then
    raise exception 'La regola di conservazione non è stata scritta nelle impostazioni.';
  end if;

  -- I trigger restano fermi per la durata della prova: inserire una
  -- prenotazione finta non deve far partire una notifica sul telefono di
  -- Alessio, e il collegamento automatico al cliente qui lo facciamo a
  -- mano per poterlo verificare. `set local` sparisce da solo a fine
  -- transazione, anche se qualcosa va storto.
  set local session_replication_role = replica;

  insert into customers (phone, name) values ('3990000901', 'PROVA PRIVACY A')
  returning id into v_cli_a;
  insert into customers (phone, name) values ('3990000902', 'PROVA PRIVACY B')
  returning id into v_cli_b;

  -- Vecchia e rifiutata: deve sparire, insieme al suo contatto.
  insert into reservations (type, status, source, reservation_date, reservation_time,
                            party_size, customer_name, customer_phone, customer_id, created_at)
  values ('prenotazione', 'rifiutata', 'form_pubblico', current_date - 200, '20:00', 2,
          'PROVA PRIVACY A', '3990000901', v_cli_a,
          now() - make_interval(months => v_mesi + 1))
  returning id into v_vecchio;

  -- Rifiutata ma recente: deve restare (e tenere in vita il suo contatto).
  insert into reservations (type, status, source, reservation_date, reservation_time,
                            party_size, customer_name, customer_phone, customer_id, created_at)
  values ('prenotazione', 'rifiutata', 'form_pubblico', current_date - 1, '20:00', 2,
          'PROVA PRIVACY B', '3990000902', v_cli_b, now())
  returning id into v_recente;

  -- Vecchia ma CONFERMATA: è storia del locale, non si tocca.
  insert into reservations (type, status, source, reservation_date, reservation_time,
                            party_size, customer_name, customer_phone, customer_id, created_at)
  values ('prenotazione', 'confermata', 'form_pubblico', current_date - 200, '21:00', 2,
          'PROVA PRIVACY A', '3990000901', null,
          now() - make_interval(months => v_mesi + 1))
  returning id into v_confermata;

  select * into v_esito from pulisci_richieste_scadute();

  if exists (select 1 from reservations where id = v_vecchio) then
    raise exception 'La richiesta rifiutata e scaduta è ancora lì: la regola non ha effetto.';
  end if;
  if not exists (select 1 from reservations where id = v_recente) then
    raise exception 'È stata cancellata una richiesta ancora dentro i % mesi.', v_mesi;
  end if;
  if not exists (select 1 from reservations where id = v_confermata) then
    raise exception 'È stata cancellata una prenotazione CONFERMATA: la storia del locale non si tocca.';
  end if;
  if exists (select 1 from customers where id = v_cli_a) then
    raise exception 'Il contatto rimasto senza nessuna richiesta è ancora in rubrica.';
  end if;
  if not exists (select 1 from customers where id = v_cli_b) then
    raise exception 'È stato cancellato un contatto che ha ancora una richiesta valida.';
  end if;
  if v_esito.richieste_cancellate < 1 or v_esito.clienti_cancellati < 1 then
    raise exception 'Il conteggio restituito non corrisponde a quanto cancellato (% e %).',
      v_esito.richieste_cancellate, v_esito.clienti_cancellati;
  end if;

  -- La traccia c'è...
  if not exists (
    select 1 from deleted_records
     where table_name = 'reservations' and record_id = v_vecchio::text
  ) then
    raise exception 'La cancellazione non è finita nel registro delle cancellazioni.';
  end if;
  -- ...ma senza la persona dentro.
  if exists (
    select 1 from deleted_records
     where table_name in ('reservations', 'customers')
       and record_id in (v_vecchio::text, v_cli_a::text)
       and (record ? 'customer_name' or record ? 'customer_phone'
            or record ? 'customer_email' or record ? 'phone' or record ? 'name')
  ) then
    raise exception 'Il registro delle cancellazioni ha conservato i dati personali: la cancellazione sarebbe finta.';
  end if;

  -- Pulizia: la prova non lascia niente, nemmeno la riga di registro che
  -- ha appena prodotto (falserebbe le statistiche delle pulizie vere).
  delete from reservations where id in (v_recente, v_confermata);
  delete from customers where id = v_cli_b;
  delete from deleted_records
   where record_id in (v_vecchio::text, v_recente::text, v_confermata::text,
                       v_cli_a::text, v_cli_b::text);
  delete from privacy_pulizie
   where eseguita_il >= now() - interval '1 minute'
     and richieste_cancellate = v_esito.richieste_cancellate
     and clienti_cancellati = v_esito.clienti_cancellati;

  set local session_replication_role = origin;

  select count(*) into n from reservations where customer_name like 'PROVA PRIVACY%';
  if n <> 0 then
    raise exception 'La prova ha lasciato % prenotazioni nel database.', n;
  end if;
  select count(*) into n from customers where phone in ('3990000901', '3990000902');
  if n <> 0 then
    raise exception 'La prova ha lasciato % contatti nel database.', n;
  end if;

  -- Il lavoro notturno esiste davvero
  select count(*) into n from cron.job where jobname = 'pulizia-richieste-scadute';
  if n <> 1 then
    raise exception 'Il lavoro notturno di pulizia non risulta programmato.';
  end if;

  raise notice 'Conservazione dati clienti: % mesi, pulizia notturna programmata, confermate intatte.', v_mesi;
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260810000004', 'conservazione_dati_clienti')
on conflict (version) do nothing;

-- Riepilogo.
select
  (select mesi_conservazione_richieste from service_settings where id = 1)                   as mesi_di_conservazione,
  (select count(*) from cron.job where jobname = 'pulizia-richieste-scadute')                as lavoro_notturno,
  (select count(*) from reservations where status in ('rifiutata','annullata'))              as richieste_non_accolte_presenti,
  (select count(*) from reservations
    where status in ('rifiutata','annullata')
      and created_at < now() - make_interval(months =>
          (select mesi_conservazione_richieste from service_settings where id = 1)))         as gia_oltre_il_limite;
