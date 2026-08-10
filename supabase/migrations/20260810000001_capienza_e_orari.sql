-- ---------------------------------------------------------------------
-- Posti liberi in tempo reale sul form pubblico
-- ---------------------------------------------------------------------
-- Deciso da Alessio il 10/08/2026: il cliente, prima di mandare la
-- richiesta, deve vedere solo gli orari in cui c'è davvero posto. Con due
-- scelte precise:
--   - ORARIO LIBERO ogni 15 minuti fino a un ultimo ingresso, non turni fissi;
--   - CONFERMA SEMPRE SUA: la richiesta tiene il posto da parte, ma è lui
--     che decide. Nessuna prenotazione si conferma da sola.
--
-- Perché la richiesta in attesa occupa: se non occupasse, due clienti
-- vedrebbero lo stesso ultimo tavolo libero e lo chiederebbero entrambi.
-- Meglio tenerlo bloccato finché Alessio non risponde (e se rifiuta, il
-- posto torna disponibile da solo).
--
-- Cosa mancava al database per poterlo fare: NON sapeva quanti posti ha il
-- locale (i tavoli non hanno coperti), né quando è aperto. Sono dati suoi,
-- che cambiano nel tempo: vivono in tabelle che modifica dalla schermata
-- "Sala e orari", non nel codice.
--
-- INTERRUTTORE GENERALE: prenotazioni_online_attive parte SPENTO. Finché è
-- spento il form si comporta come prima (richiesta libera, decide Alessio).
-- Così il sito non racconta ai clienti disponibilità sbagliate nel tempo
-- che passa fra questa migrazione e la compilazione dei numeri veri.
--
-- Idempotente (§7 punto 3).

-- ---------------------------------------------------------------------
-- 1. Quanti posti ha ogni tavolo
-- ---------------------------------------------------------------------
alter table dining_tables
  add column if not exists seats integer not null default 2;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dining_tables_seats_check') then
    alter table dining_tables add constraint dining_tables_seats_check
      check (seats between 1 and 30);
  end if;
end $$;

comment on column dining_tables.seats is
  'Coperti del tavolo. Alimenta la capienza vista dal form pubblico: il valore di partenza (2) è un segnaposto, i numeri veri li mette Alessio da "Sala e orari".';

-- ---------------------------------------------------------------------
-- 2. Quando il locale è aperto
-- ---------------------------------------------------------------------
-- Un record per giorno della settimana e servizio. weekday segue la
-- convenzione di Postgres e di JavaScript: 0 = domenica.
create table if not exists service_hours (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6),
  servizio text not null check (servizio in ('pranzo', 'cena')),
  apertura time not null,
  ultimo_ingresso time not null,
  attivo boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (weekday, servizio),
  check (ultimo_ingresso > apertura)
);

comment on table service_hours is
  'Orari di servizio per giorno della settimana. "ultimo_ingresso" è l''ora oltre la quale non si accettano arrivi, non l''ora di chiusura.';

-- Le 14 righe (7 giorni × 2 servizi) esistono sempre: la schermata mostra
-- interruttori da accendere, non un elenco vuoto da costruire.
insert into service_hours (weekday, servizio, apertura, ultimo_ingresso, attivo)
select g.weekday, s.servizio, s.apertura, s.ultimo_ingresso, false
from generate_series(0, 6) as g(weekday)
cross join (values
  ('pranzo'::text, '12:00'::time, '14:00'::time),
  ('cena'::text,   '19:00'::time, '22:00'::time)
) as s(servizio, apertura, ultimo_ingresso)
on conflict (weekday, servizio) do nothing;

-- ---------------------------------------------------------------------
-- 3. Chiusure straordinarie (ferie, giorni singoli)
-- ---------------------------------------------------------------------
create table if not exists service_closures (
  id uuid primary key default gen_random_uuid(),
  dal date not null,
  al date not null,
  motivo text,
  created_at timestamptz not null default now(),
  check (al >= dal)
);

create index if not exists idx_service_closures_periodo on service_closures (dal, al);

comment on table service_closures is
  'Chiusure straordinarie. Il form pubblico non propone orari nei giorni compresi, e mostra il motivo se scritto.';

-- ---------------------------------------------------------------------
-- 4. Le regole di prenotazione (una riga sola, come il coperto)
-- ---------------------------------------------------------------------
alter table service_settings
  add column if not exists durata_tavolo_minuti integer not null default 120,
  add column if not exists max_coperti_contemporanei integer,
  add column if not exists giorni_prenotabili integer not null default 60,
  add column if not exists preavviso_minuti integer not null default 120,
  add column if not exists prenotazioni_online_attive boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'service_settings_regole_check') then
    alter table service_settings add constraint service_settings_regole_check check (
      durata_tavolo_minuti between 30 and 480
      and giorni_prenotabili between 1 and 365
      and preavviso_minuti between 0 and 10080
      and (max_coperti_contemporanei is null or max_coperti_contemporanei between 1 and 500)
    );
  end if;
end $$;

comment on column service_settings.durata_tavolo_minuti is
  'Per quanto tempo un tavolo resta occupato da una prenotazione. Serve a capire se due prenotazioni si pestano i piedi.';
comment on column service_settings.max_coperti_contemporanei is
  'Tetto di coperti serviti nello stesso momento, se la cucina regge meno della sala. Vuoto = vale la somma dei tavoli.';
comment on column service_settings.preavviso_minuti is
  'Quanto prima si deve prenotare: sotto questa soglia gli orari non compaiono più.';
comment on column service_settings.prenotazioni_online_attive is
  'Interruttore generale. Spento: il form accetta qualunque richiesta come prima. Acceso: propone solo gli orari con posto e rifiuta il resto.';

-- ---------------------------------------------------------------------
-- 5. Permessi (§6: il permesso vive nel database)
-- ---------------------------------------------------------------------
alter table service_hours enable row level security;
alter table service_closures enable row level security;

-- Lettura allo staff (serve in sala per sapere fin quando si accettano
-- arrivi), scrittura al solo titolare. Il ruolo anonimo NON legge queste
-- tabelle: passa dalla funzione del punto 6, che espone solo orari.
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'service_hours' and policyname = 'service_hours_select') then
    create policy service_hours_select on service_hours for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'service_hours' and policyname = 'service_hours_insert') then
    create policy service_hours_insert on service_hours for insert to authenticated with check ((select is_titolare()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'service_hours' and policyname = 'service_hours_update') then
    create policy service_hours_update on service_hours for update to authenticated using ((select is_titolare())) with check ((select is_titolare()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'service_hours' and policyname = 'service_hours_delete') then
    create policy service_hours_delete on service_hours for delete to authenticated using ((select is_titolare()));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'service_closures' and policyname = 'service_closures_select') then
    create policy service_closures_select on service_closures for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'service_closures' and policyname = 'service_closures_insert') then
    create policy service_closures_insert on service_closures for insert to authenticated with check ((select is_titolare()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'service_closures' and policyname = 'service_closures_update') then
    create policy service_closures_update on service_closures for update to authenticated using ((select is_titolare())) with check ((select is_titolare()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'service_closures' and policyname = 'service_closures_delete') then
    create policy service_closures_delete on service_closures for delete to authenticated using ((select is_titolare()));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6. La capienza libera, in un posto solo
-- ---------------------------------------------------------------------
-- Usata sia dal form pubblico (per mostrare gli orari) sia dal controllo
-- che precede l'inserimento: un solo calcolo, così schermata e database
-- non possono dire due cose diverse (stesso principio di orderTotals()).
--
-- Lavora su TIMESTAMP e non su TIME per non sbagliare a cavallo della
-- mezzanotte: una prenotazione delle 23:30 che tiene il tavolo due ore
-- finisce all'01:30 del giorno dopo, e con i soli orari il confronto
-- "23:30 + 2h > 01:00" darebbe l'esito sbagliato.
create or replace function posti_liberi(p_quando timestamp)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_durata   integer;
  v_capienza integer;
  v_occupati integer;
begin
  select durata_tavolo_minuti,
         least(
           coalesce((select sum(seats) from dining_tables where active), 0),
           coalesce(max_coperti_contemporanei, 2147483647)
         )
    into v_durata, v_capienza
  from service_settings where id = 1;

  if v_capienza is null or v_capienza = 0 then
    return 0;
  end if;

  -- Occupano il posto sia le confermate sia le richieste in attesa: una
  -- richiesta tiene il tavolo finché Alessio non risponde (decisione del
  -- 10/08). Rifiutate e annullate liberano da sole.
  select coalesce(sum(r.party_size), 0)
    into v_occupati
  from reservations r
  where r.status in ('richiesta_in_attesa', 'confermata')
    -- la finestra precedente serve per le prenotazioni che scavallano
    and r.reservation_date between (p_quando::date - 1) and (p_quando::date + 1)
    and (r.reservation_date + r.reservation_time) < (p_quando + make_interval(mins => v_durata))
    and (r.reservation_date + r.reservation_time + make_interval(mins => v_durata)) > p_quando;

  return v_capienza - v_occupati;
end;
$$;

comment on function posti_liberi is
  'Coperti ancora liberi in un dato momento. Un solo calcolo per schermata pubblica e controllo di inserimento.';

-- Quanto è pieno il locale è un dato di casa: il ruolo anonimo non lo
-- chiede mai da solo, lo usa solo di rimbalzo dentro la funzione del
-- punto 7, che restituisce orari e non numeri.
revoke all on function posti_liberi(timestamp) from public;
grant execute on function posti_liberi(timestamp) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Cosa vede il cliente prima di scrivere il suo nome
-- ---------------------------------------------------------------------
-- Una sola chiamata restituisce tutto: se il servizio è attivo, se quel
-- giorno è chiuso (e perché), quali orari hanno posto per quel numero di
-- persone. Espone SOLO orari: nessun dato di altri clienti, nessun numero
-- che riveli quanto è pieno il locale.
create or replace function public_reservation_options(p_date date, p_party_size integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_attivo    boolean;
  v_giorni    integer;
  v_preavviso integer;
  v_oggi      date := (now() at time zone 'Europe/Rome')::date;
  v_adesso    timestamp := (now() at time zone 'Europe/Rome');
  v_motivo    text;
  v_max_tavolo integer;
  v_orari     jsonb := '[]'::jsonb;
  r           record;
  v_slot      timestamp;
  v_fine      timestamp;
begin
  select prenotazioni_online_attive, giorni_prenotabili, preavviso_minuti
    into v_attivo, v_giorni, v_preavviso
  from service_settings where id = 1;

  -- Interruttore spento: il form torna a essere una richiesta libera.
  if not coalesce(v_attivo, false) then
    return jsonb_build_object('attivo', false, 'orari', v_orari);
  end if;

  if p_party_size is null or p_party_size < 1 or p_party_size > 30 then
    return jsonb_build_object('attivo', true, 'chiuso', true,
      'motivo', 'Per gruppi così numerosi chiamaci: troviamo la sistemazione giusta.', 'orari', v_orari);
  end if;

  if p_date is null or p_date < v_oggi or p_date > v_oggi + v_giorni then
    return jsonb_build_object('attivo', true, 'chiuso', true,
      'motivo', 'Per questa data non prendiamo ancora prenotazioni online.', 'orari', v_orari);
  end if;

  select motivo into v_motivo from service_closures
   where p_date between dal and al
   order by dal limit 1;
  if found then
    return jsonb_build_object('attivo', true, 'chiuso', true,
      'motivo', coalesce(nullif(trim(v_motivo), ''), 'Quel giorno siamo chiusi.'), 'orari', v_orari);
  end if;

  select max(seats) into v_max_tavolo from dining_tables where active;

  for r in
    select apertura, ultimo_ingresso
    from service_hours
    where attivo and weekday = extract(dow from p_date)::smallint
    order by apertura
  loop
    v_slot := p_date + r.apertura;
    v_fine := p_date + r.ultimo_ingresso;
    while v_slot <= v_fine loop
      if v_slot >= v_adesso + make_interval(mins => v_preavviso)
         and posti_liberi(v_slot) >= p_party_size then
        v_orari := v_orari || to_jsonb(to_char(v_slot, 'HH24:MI'));
      end if;
      v_slot := v_slot + interval '15 minutes';
    end loop;
  end loop;

  return jsonb_build_object(
    'attivo', true,
    'chiuso', jsonb_array_length(v_orari) = 0,
    'motivo', case when jsonb_array_length(v_orari) = 0
                then 'Per questa data non abbiamo più posto. Prova un altro giorno, oppure chiamaci: a volte si libera qualcosa.'
              end,
    -- Oltre il tavolo più grande servono tavoli uniti: si può chiedere lo
    -- stesso, ma il cliente sa già che lo richiamiamo.
    'gruppo_grande', p_party_size > coalesce(v_max_tavolo, 0),
    'orari', v_orari
  );
end;
$$;

comment on function public_reservation_options is
  'Ciò che il form pubblico mostra prima dell''invio: se il servizio è attivo, se il giorno è chiuso, quali orari hanno ancora posto. Non espone dati di altri clienti.';

revoke all on function public_reservation_options(date, integer) from public;
grant execute on function public_reservation_options(date, integer) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. Il controllo vero sta qui, non nella schermata
-- ---------------------------------------------------------------------
-- La schermata mostra gli orari liberi, ma fra il momento in cui il
-- cliente li vede e quello in cui preme Invia possono passare minuti: due
-- clienti possono avere davanti lo stesso ultimo posto. L'ultima parola
-- è del database, che rifiuta con una frase leggibile dall'ospite.
create or replace function submit_public_reservation(
  p_reservation_date date,
  p_reservation_time time,
  p_party_size integer,
  p_customer_name text,
  p_customer_phone text default null,
  p_customer_email text default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tel    text := nullif(trim(p_customer_phone), '');
  mail   text := nullif(trim(p_customer_email), '');
  quante integer;
  v_attivo boolean;
  v_aperto boolean;
begin
  -- Validazioni già esistenti, invariate.
  if p_party_size is null or p_party_size < 1 or p_party_size > 200 then
    raise exception 'Numero di coperti non valido';
  end if;
  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'Nome obbligatorio';
  end if;
  -- Data locale, non UTC: fino alle 02:00 "current_date" è ancora ieri e
  -- accetterebbe una prenotazione per un giorno già passato (§8).
  if p_reservation_date is null
     or p_reservation_date < (now() at time zone 'Europe/Rome')::date then
    raise exception 'Data non valida';
  end if;
  if p_reservation_time is null then
    raise exception 'Orario obbligatorio';
  end if;
  if tel is null and mail is null then
    raise exception 'Serve almeno un contatto (telefono o email)';
  end if;

  -- Limite 3: tetto complessivo, contro l'invio automatico.
  select count(*) into quante
  from reservations
  where source = 'form_pubblico' and created_at > now() - interval '1 hour';

  if quante >= 40 then
    raise exception 'Stiamo ricevendo molte richieste in questo momento. Riprova fra qualche minuto, oppure chiamaci: ti rispondiamo subito.';
  end if;

  -- Limite 1: stesso contatto, ultime 24 ore.
  select count(*) into quante
  from reservations
  where source = 'form_pubblico'
    and created_at > now() - interval '24 hours'
    and (
      (tel is not null and customer_phone = tel) or
      (mail is not null and customer_email = mail)
    );

  if quante >= 3 then
    raise exception 'Abbiamo già ricevuto le tue richieste e le stiamo guardando: ti ricontattiamo noi. Per modificarne una, chiamaci pure.';
  end if;

  -- Limite 2: richiesta identica già in attesa.
  select count(*) into quante
  from reservations
  where source = 'form_pubblico'
    and status = 'richiesta_in_attesa'
    and reservation_date = p_reservation_date
    and reservation_time = p_reservation_time
    and (
      (tel is not null and customer_phone = tel) or
      (mail is not null and customer_email = mail)
    );

  if quante > 0 then
    raise exception 'Questa richiesta l''abbiamo già ricevuta: è in attesa di conferma, non serve rimandarla.';
  end if;

  -- Capienza: solo a interruttore acceso. Da spento il form resta la
  -- richiesta libera di prima e nulla cambia per chi ha già il link.
  select prenotazioni_online_attive into v_attivo from service_settings where id = 1;

  if coalesce(v_attivo, false) then
    if exists (select 1 from service_closures where p_reservation_date between dal and al) then
      raise exception 'Quel giorno siamo chiusi. Scegli un''altra data, oppure chiamaci.';
    end if;

    select exists (
      select 1 from service_hours
      where attivo
        and weekday = extract(dow from p_reservation_date)::smallint
        and p_reservation_time between apertura and ultimo_ingresso
    ) into v_aperto;

    if not v_aperto then
      raise exception 'A quell''ora non siamo in servizio. Scegli uno degli orari proposti, oppure chiamaci.';
    end if;

    if posti_liberi(p_reservation_date + p_reservation_time) < p_party_size then
      raise exception 'Mentre compilavi, quel posto è stato preso. Scegli un altro orario, oppure chiamaci: a volte si libera qualcosa.';
    end if;
  end if;

  insert into reservations (
    type, status, source,
    reservation_date, reservation_time, party_size,
    customer_name, customer_phone, customer_email, notes,
    privacy_consent_at
  ) values (
    'prenotazione', 'richiesta_in_attesa', 'form_pubblico',
    p_reservation_date, p_reservation_time, p_party_size,
    trim(p_customer_name), tel, mail, nullif(trim(p_notes), ''),
    now()
  );
end;
$$;

-- Il varco pubblico resta l'unica porta del ruolo anonimo: nessun altro
-- ruolo la esegue (vedi tests/app/prenotazione-pubblica.test.js).
revoke all on function submit_public_reservation(date, time, integer, text, text, text, text) from public;
grant execute on function submit_public_reservation(date, time, integer, text, text, text, text) to anon;

-- ---------------------------------------------------------------------
-- 9. Verifica (§7 punti 1-3): la prova gira sui dati veri e si ripulisce
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_data      date := (now() at time zone 'Europe/Rome')::date + 30;
  v_dow       smallint;
  v_attivo_pre boolean;
  v_ore_pre   boolean;
  v_liberi    integer;
  v_esito     jsonb;
  v_ora_piena text;
  v_slot      timestamp;
  v_id        uuid;
  v_messaggio text;
  v_accettato boolean := false;
  v_tavolo_finto uuid;
  n           integer;
begin
  -- PRIMA DI TUTTO: lo stato di partenza, per restituirlo intatto. Questa
  -- migrazione si può rilanciare, e un secondo Run non deve spegnere le
  -- prenotazioni online se nel frattempo Alessio le ha accese.
  select prenotazioni_online_attive into v_attivo_pre from service_settings where id = 1;
  v_dow := extract(dow from v_data)::smallint;
  select attivo into v_ore_pre from service_hours where weekday = v_dow and servizio = 'cena';

  -- Struttura
  if not exists (select 1 from information_schema.columns
                  where table_name = 'dining_tables' and column_name = 'seats') then
    raise exception 'Manca la colonna dei coperti sui tavoli.';
  end if;
  select count(*) into n from service_hours;
  if n <> 14 then
    raise exception 'Attesi 14 orari di servizio (7 giorni x 2), trovati %.', n;
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                  where ns.nspname = 'public' and p.proname = 'public_reservation_options'
                    and p.prosecdef and 'search_path=public' = any(p.proconfig)) then
    raise exception 'La funzione pubblica non è security definer con search_path fissato.';
  end if;
  if not has_function_privilege('anon', 'public_reservation_options(date, integer)', 'execute') then
    raise exception 'Il ruolo anonimo non può leggere gli orari liberi.';
  end if;
  if has_function_privilege('authenticated', 'submit_public_reservation(date, time, integer, text, text, text, text)', 'execute') then
    raise exception 'Il varco pubblico è stato allargato oltre il ruolo anonimo.';
  end if;

  -- A interruttore spento non deve trapelare nulla
  update service_settings set prenotazioni_online_attive = false where id = 1;
  v_esito := public_reservation_options(v_data, 2);
  if (v_esito ->> 'attivo')::boolean then
    raise exception 'Con l''interruttore spento la funzione si comporta come se fosse acceso.';
  end if;

  -- Su un database appena ricostruito da zero (il progetto di prova) i
  -- tavoli non esistono ancora: sono dati del locale, non struttura, e
  -- nessuna migrazione li crea. Con zero coperti la prova viva qui sotto
  -- non avrebbe nessun orario da controllare e si fermerebbe dando la
  -- colpa al calcolo. In quel caso — e solo in quello — la verifica si
  -- crea il proprio tavolo e lo toglie alla fine. Dove i tavoli veri
  -- esistono (produzione) questo ramo non viene mai percorso.
  if coalesce((select sum(seats) from dining_tables where active), 0) = 0 then
    insert into dining_tables (label, seats, active)
    values ('__prova_capienza__', 20, true)
    on conflict (label) do update set seats = 20, active = true
    returning id into v_tavolo_finto;
  end if;

  -- Prova viva: accendo, apro il giorno, controllo che gli orari escano,
  -- riempio un orario e controllo che sparisca.
  update service_hours set attivo = true where weekday = v_dow and servizio = 'cena';
  update service_settings set prenotazioni_online_attive = true where id = 1;

  v_esito := public_reservation_options(v_data, 2);
  if jsonb_array_length(v_esito -> 'orari') = 0 then
    raise exception 'Con il servizio aperto e la sala vuota non è uscito nessun orario.';
  end if;

  -- Riempio il primo orario proposto fino all'orlo. Occupo esattamente i
  -- posti ANCORA liberi, non la capienza totale: su quella data potrebbe
  -- esserci già qualcosa, e sottrarre alla cieca darebbe un numero
  -- negativo e una prova che fallisce senza motivo.
  v_ora_piena := v_esito -> 'orari' ->> 0;
  v_slot := v_data + (v_ora_piena || ':00')::time;
  v_liberi := posti_liberi(v_slot);

  insert into reservations (type, status, source, reservation_date, reservation_time,
                            party_size, customer_name, privacy_consent_at)
  values ('prenotazione', 'richiesta_in_attesa', 'interno', v_data,
          v_ora_piena::time, v_liberi, 'VERIFICA MIGRAZIONE', now())
  returning id into v_id;

  if posti_liberi(v_slot) <> 0 then
    raise exception 'Il locale risulta ancora libero dopo averlo riempito: il calcolo dei posti è sbagliato.';
  end if;

  v_esito := public_reservation_options(v_data, 2);
  if v_esito -> 'orari' @> to_jsonb(v_ora_piena) then
    raise exception 'Un orario pieno viene ancora proposto al cliente.';
  end if;

  -- E il database rifiuta comunque, anche se la schermata sbagliasse.
  -- L'esito si segna in una variabile: un raise dentro il blocco finirebbe
  -- nelle mani del suo stesso gestore di eccezioni.
  begin
    perform submit_public_reservation(v_data, v_ora_piena::time, 2,
                                      'VERIFICA MIGRAZIONE', '3990000000', null, null);
    v_accettato := true;
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics v_messaggio = message_text;
      if v_messaggio not like '%posto%' and v_messaggio not like '%servizio%' then
        raise exception 'Rifiuto avvenuto ma con un messaggio inatteso: %', v_messaggio;
      end if;
  end;
  if v_accettato then
    raise exception 'Il database ha accettato una prenotazione in un orario già pieno.';
  end if;

  -- Pulizia: si torna esattamente com'era
  delete from reservations where id = v_id;
  delete from dining_tables where id = v_tavolo_finto;
  update service_hours set attivo = v_ore_pre where weekday = v_dow and servizio = 'cena';
  update service_settings set prenotazioni_online_attive = coalesce(v_attivo_pre, false) where id = 1;

  select count(*) into n from reservations where customer_name = 'VERIFICA MIGRAZIONE';
  if n <> 0 then
    raise exception 'La prova ha lasciato % righe nel database.', n;
  end if;

  raise notice 'Capienza e orari installati: gli orari pieni spariscono dal form e il database rifiuta comunque. Interruttore riportato com''era: %.', coalesce(v_attivo_pre, false);
end $verifica$;

insert into applied_migrations (version, name)
values ('20260810000001', 'capienza_e_orari')
on conflict (version) do nothing;

-- Riepilogo.
select
  (select count(*) from service_hours)                                              as orari_di_servizio,
  (select count(*) from dining_tables where active)                                 as tavoli_attivi,
  (select coalesce(sum(seats), 0) from dining_tables where active)                  as coperti_totali_da_rivedere,
  (select prenotazioni_online_attive from service_settings where id = 1)            as prenotazioni_online_attive;
