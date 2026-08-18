-- ---------------------------------------------------------------------
-- Le tre fasce, e «da liberare entro le…»
-- ---------------------------------------------------------------------
-- Mandato «La sala e le prenotazioni», giro C: punti 3 e 4. Decisioni di
-- Alessio del 18/08/2026.
--
-- ⚠️ I DUE PUNTI NON SI SEPARANO: il 3 senza il 4 e' una regola che vale
-- solo sulla carta. Se si accetta gente alle 19:30 «purche' liberi per le
-- 22» e quella nota resta nella scheda della prenotazione, in servizio non
-- la vede nessuno — il tavolo non si libera e il secondo turno salta.
--
-- Idempotente (§7 punto 3). Si auto-registra (§7 punto 4).

-- =====================================================================
-- 1. L'ORA DEL PRIMO GIRO APPARTIENE AL SERVIZIO, NON AL LOCALE
-- =====================================================================
-- ⚠️ IL RILIEVO CHE HA CAMBIATO IL DISEGNO. Fino a oggi «l'ora del primo
-- giro» era UNA per tutto il locale (`service_settings.ora_primo_turno` =
-- 20:00). Con due colori andava; con tre no: la domenica e' PRANZO
-- (12:00 → 14:00), e tre fasce calcolate su un 20:00 buono per la cena
-- direbbero «puo' servire una seconda volta» a chiunque pranzi — anche a
-- chi si siede alle 13:45 e occupa fino alla chiusura.
--
-- Quindi l'ora del primo giro si sposta DOVE STA GIA' il suo gemello,
-- `ultimo_ingresso`: sulla riga del servizio. E si SPOSTA, non si copia —
-- due posti che dicono la stessa cosa e possono contraddirsi sono il
-- difetto che questo progetto passa le giornate a togliere.
alter table service_hours
  add column if not exists ora_primo_turno time;

comment on column service_hours.ora_primo_turno is
  'Fin quando un arrivo lascia al tavolo la possibilita'' di un secondo giro, PER QUESTO SERVIZIO. Vuoto = non deciso: quel servizio ha due fasce invece di tre, e nessuna prenotazione risulta «primo giro».';

-- SANATORIA, una volta sola, e dichiara quante righe tocca (regola del
-- 16/08). Il valore di Alessio (20:00) era stato deciso per la CENA — e
-- infatti la cena e' l'unico servizio attivo tutti i giorni tranne la
-- domenica. Sul pranzo NON si inventa niente: resta vuoto, che vuol dire
-- «non l'ha ancora detto nessuno» (lezione del 14/08).
do $sanatoria$
declare
  vecchia time;
  n       integer;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'service_settings'
       and column_name = 'ora_primo_turno'
  ) then
    raise notice 'L''ora del primo giro e'' gia'' sul servizio: nessuna sanatoria da fare.';
    return;
  end if;

  execute 'select ora_primo_turno from service_settings where id = 1' into vecchia;

  update service_hours set ora_primo_turno = vecchia
   where servizio = 'cena' and ora_primo_turno is null and vecchia is not null;
  get diagnostics n = row_count;

  raise notice 'Ora del primo giro portata sul servizio: % righe di cena messe a %. Il pranzo resta vuoto di proposito.', n, vecchia;

  -- ⚠️ E QUI SI TOGLIE LA VECCHIA. Lasciarla sarebbe un secondo posto dove
  -- vive lo stesso fatto: si contraddirebbero al primo cambiamento, e
  -- servirebbe una precedenza inventata da chi scrive il codice.
  alter table service_settings drop column ora_primo_turno;
end $sanatoria$;

-- =====================================================================
-- 2. QUANTO SERVE FRA UN TURNO E L'ALTRO — parametro suo, messo a zero
-- =====================================================================
-- ⚠️ ZERO E' LA SUA RISPOSTA, NON UNO ZERO NEL CODICE. Alessio:*«riapparecchiare
-- costa due o tre minuti, irrilevante»*. Ma il giorno che cambia idea deve
-- essere una casella in «Sala e orari», non una modifica al programma —
-- stessa forma della soglia dei 25 coperti.
alter table service_settings
  add column if not exists minuti_fra_turni integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'service_settings_minuti_turni_check') then
    alter table service_settings add constraint service_settings_minuti_turni_check
      check (minuti_fra_turni between 0 and 240);
  end if;
end $$;

-- =====================================================================
-- 2-bis. FIN QUANDO E' ANCORA IERI SERA — un numero, due lettori
-- =====================================================================
-- ⚠️ QUESTO E' IL PARAMETRO PIU' IMPORTANTE DEL GIRO, e non si vede.
-- Alessio: *«se voglio sapere quanto ho incassato ieri e un conto e' stato
-- emesso dopo la mezzanotte, non va conteggiato nel giorno dopo»* — e ha
-- fissato il confine alle **5 del mattino**.
--
-- ⚠️ E STA QUI, NON IN UN FILE JAVASCRIPT. Il giro C lo usa per decidere
-- quale sera mostrare in sala; il lavoro sugli **11 punti SQL** che oggi
-- scrivono col giorno di calendario userà **lo stesso numero**. Scriverlo
-- nel codice del sito e poi ricopiarlo in una funzione del database
-- darebbe **due orologi** che possono divergere — cioe' esattamente la
-- famiglia di difetti che questo mandato ha passato due giorni a togliere.
-- Un numero, due lettori.
--
-- Il valore predefinito non risponde al posto suo: **e'** la sua risposta.
alter table service_settings
  add column if not exists ora_fine_serata time not null default '05:00';

comment on column service_settings.ora_fine_serata is
  'Fino a che ora della notte «e'' ancora la sera prima». Decisione di Alessio del 18/08/2026: le 5. Lo leggono le schermate della sala e — quando saranno convertiti — gli 11 punti del database che oggi scrivono col giorno di calendario. Un numero solo, o sono due orologi.';

comment on column service_settings.minuti_fra_turni is
  'Quanto tempo serve fra chi se ne va e chi arriva, per sparecchiare e riapparecchiare. Zero = «da liberare entro le…» dice l''ora esatta della seconda prenotazione. E'' una decisione di Alessio, non un valore predefinito scritto da noi.';

-- =====================================================================
-- 3. LE FASCE E IL TURNO — un solo calcolo, per la pianta e per le comande
-- =====================================================================
-- ⚠️ «DA LIBERARE ENTRO LE…» E' UNA CONSEGUENZA, NON UN DATO. Si legge
-- dalla prenotazione successiva sullo stesso tavolo. Scriverla a mano
-- creerebbe un secondo posto dove vive lo stesso fatto: spostando la
-- seconda prenotazione la nota resterebbe indietro, e cancellandola
-- resterebbe a dichiarare un turno che non esiste. Cosi' invece
-- **sparisce da se'**, senza che nessuno debba ricordarsene.
--
-- ⚠️ E LA NOTA NON GUARDA LA FASCIA: e' un fatto, non un consiglio. Se
-- dopo di te c'e' qualcuno su quel tavolo, quel tavolo va liberato — che
-- tu sia giallo, verde o arancio. La fascia decide il COLORE; la nota
-- decide cosa deve sapere chi serve.
create or replace function turni_del_giorno(p_data date)
returns table (
  reservation_id   uuid,
  ora              time,
  servizio         text,
  fascia           text,
  tavoli           uuid[],
  etichette        text[],
  liberare_entro   time,
  turno_dopo_di    uuid
)
language sql
stable
set search_path = public
as $fn$
  with impostazioni as (
    select minuti_fra_turni from service_settings where id = 1
  ),
  prenotazioni as (
    select r.id, r.reservation_time as ora,
           coalesce(
             (select array_agg(pt.dining_table_id order by pt.dining_table_id)
                from prenotazione_tavoli pt where pt.reservation_id = r.id),
             '{}'::uuid[]
           ) as tavoli,
           coalesce(
             (select array_agg(pt.etichetta_al_momento order by pt.etichetta_al_momento)
                from prenotazione_tavoli pt where pt.reservation_id = r.id),
             '{}'::text[]
           ) as etichette
      from reservations r
     where r.reservation_date = p_data
       and r.status = 'confermata'
  ),
  -- ⚠️ IL SERVIZIO SI CERCA, NON SI ASSUME. Una domenica e' pranzo, e le
  -- fasce vanno calcolate sugli orari DI QUEL SERVIZIO: con gli orari
  -- della cena, ogni pranzo risulterebbe «primo giro».
  -- Si prende il servizio attivo di quel giorno la cui apertura precede
  -- l'ora; se nessuna la precede (arrivo prima dell'apertura), il primo.
  con_servizio as (
    select p.*,
           (select sh.servizio from service_hours sh
             where sh.weekday = extract(dow from p_data)::integer and sh.attivo
               and sh.apertura <= p.ora
             order by sh.apertura desc limit 1) as servizio_scelto,
           (select sh.ultimo_ingresso from service_hours sh
             where sh.weekday = extract(dow from p_data)::integer and sh.attivo
               and sh.apertura <= p.ora
             order by sh.apertura desc limit 1) as ultimo_ingresso,
           (select sh.ora_primo_turno from service_hours sh
             where sh.weekday = extract(dow from p_data)::integer and sh.attivo
               and sh.apertura <= p.ora
             order by sh.apertura desc limit 1) as primo_turno
      from prenotazioni p
  ),
  -- La prima prenotazione che viene DOPO, su un tavolo in comune.
  seguente as (
    select a.id,
           (select b.ora from con_servizio b
             where b.id <> a.id and b.ora > a.ora and b.tavoli && a.tavoli
             order by b.ora limit 1) as ora_dopo,
           (select b.id from con_servizio b
             where b.id <> a.id and b.ora > a.ora and b.tavoli && a.tavoli
             order by b.ora limit 1) as id_dopo
      from con_servizio a
  )
  select c.id,
         c.ora,
         c.servizio_scelto,
         case
           when c.ultimo_ingresso is not null and c.ora >= c.ultimo_ingresso then 'tardi'
           -- ⚠️ Senza l'ora del primo giro quel servizio ha DUE fasce, non
           -- tre: nessuno ha detto fin quando un arrivo lascia spazio a un
           -- secondo giro, e inventarlo sarebbe rispondere al posto suo.
           when c.primo_turno is null then 'pieno'
           when c.ora < c.primo_turno then 'presto'
           else 'pieno'
         end,
         c.tavoli,
         c.etichette,
         case when s.ora_dopo is null then null
              else s.ora_dopo - make_interval(mins => i.minuti_fra_turni) end,
         s.id_dopo
    from con_servizio c
    join seguente s on s.id = c.id
   cross join impostazioni i
   order by c.ora;
$fn$;

comment on function turni_del_giorno(date) is
  'Per ogni prenotazione confermata di una giornata: in che fascia cade (presto / pieno / tardi, calcolate sugli orari DI QUEL SERVIZIO) e, se su un suo tavolo c''e'' qualcuno dopo, entro che ora il tavolo va liberato. L''ora e'' una conseguenza della prenotazione successiva: se quella si sposta o sparisce, la nota la segue da se''.';

revoke all on function turni_del_giorno(date) from public, anon, authenticated;
grant execute on function turni_del_giorno(date) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  d_cena   date;
  d_pranzo date;
  t1       uuid;
  t2       uuid;
  r_presto uuid;
  r_tardi  uuid;
  r_pieno  uuid;
  v_fascia text;
  v_entro  time;
  v_serv   text;
  n        integer;
  cena_attiva   boolean;
  pranzo_attivo boolean;
begin
  -- ⚠️ LA VERIFICA SI COSTRUISCE IL PROPRIO PERIMETRO, e non si salta se
  -- non lo trova. Gli orari di servizio sono **dati di Alessio**: in
  -- produzione la cena e' attiva cinque giorni su sette e la domenica c'e'
  -- il pranzo, ma sul progetto di prova — che nasce dalle migrazioni —
  -- **non c'e' nessun servizio attivo**. Saltare sarebbe la quinta
  -- ricomparsa della trappola: il controllo piu' importante girerebbe per
  -- la prima volta sui dati veri.
  -- Quindi si accendono due servizi ricordando com'erano, e alla fine si
  -- rimette quello che c'era — non «quello giusto» (lezione del 14/08).
  -- In produzione questi due sono gia' accesi, quindi non cambia niente.
  d_cena   := date '1995-06-07';  -- mercoledi'
  d_pranzo := date '1995-06-04';  -- domenica

  select attivo into cena_attiva   from service_hours where weekday = 3 and servizio = 'cena';
  select attivo into pranzo_attivo from service_hours where weekday = 0 and servizio = 'pranzo';
  if cena_attiva is null or pranzo_attivo is null then
    raise exception 'Mancano le righe di orario per il mercoledi'' sera o la domenica a pranzo: la verifica non ha su cosa girare.';
  end if;

  update service_hours set attivo = true where weekday = 3 and servizio = 'cena';
  update service_hours set attivo = true where weekday = 0 and servizio = 'pranzo';

  select count(*) into n from reservations where reservation_date in (d_cena, d_pranzo);
  if n <> 0 then raise exception 'Le date di prova non sono libere (% prenotazioni).', n; end if;

  select id into t1 from dining_tables where tipo = 'tavolo' and active order by label limit 1;
  select id into t2 from dining_tables where tipo = 'tavolo' and active and id <> t1 order by label limit 1;

  alter table reservations disable trigger trg_notify_reservation_telegram;

  -- --- Le tre fasce, su un servizio di CENA ---
  insert into reservations (type, status, source, reservation_date, reservation_time, party_size, customer_name)
  values ('prenotazione', 'confermata', 'interno', d_cena, '19:30', 2, 'VERIFICA presto') returning id into r_presto;
  insert into reservations (type, status, source, reservation_date, reservation_time, party_size, customer_name)
  values ('prenotazione', 'confermata', 'interno', d_cena, '20:30', 2, 'VERIFICA pieno') returning id into r_pieno;
  insert into reservations (type, status, source, reservation_date, reservation_time, party_size, customer_name)
  values ('prenotazione', 'confermata', 'interno', d_cena, '22:30', 2, 'VERIFICA tardi') returning id into r_tardi;

  insert into prenotazione_tavoli (reservation_id, dining_table_id, etichetta_al_momento)
  select r_presto, t1, label from dining_tables where id = t1;
  insert into prenotazione_tavoli (reservation_id, dining_table_id, etichetta_al_momento)
  select r_tardi, t1, label from dining_tables where id = t1;
  insert into prenotazione_tavoli (reservation_id, dining_table_id, etichetta_al_momento)
  select r_pieno, t2, label from dining_tables where id = t2;

  select fascia into v_fascia from turni_del_giorno(d_cena) where reservation_id = r_presto;
  if v_fascia <> 'presto' then raise exception 'Le 19:30 dovevano essere «presto», sono «%».', v_fascia; end if;
  select fascia into v_fascia from turni_del_giorno(d_cena) where reservation_id = r_pieno;
  if v_fascia <> 'pieno' then raise exception 'Le 20:30 dovevano essere «pieno», sono «%».', v_fascia; end if;
  select fascia into v_fascia from turni_del_giorno(d_cena) where reservation_id = r_tardi;
  if v_fascia <> 'tardi' then raise exception 'Le 22:30 dovevano essere «tardi», sono «%».', v_fascia; end if;

  -- --- «Da liberare entro le…» c'e' dove c'e' un turno dopo, e SOLO li' ---
  select liberare_entro into v_entro from turni_del_giorno(d_cena) where reservation_id = r_presto;
  if v_entro is null then raise exception 'Chi arriva alle 19:30 su un tavolo prenotato alle 22:30 deve sapere entro quando liberarlo.'; end if;
  select liberare_entro into v_entro from turni_del_giorno(d_cena) where reservation_id = r_pieno;
  if v_entro is not null then raise exception 'Su un tavolo senza un turno dopo non deve comparire nessuna ora da liberare (letto %).', v_entro; end if;
  select liberare_entro into v_entro from turni_del_giorno(d_cena) where reservation_id = r_tardi;
  if v_entro is not null then raise exception 'L''ultimo turno di un tavolo non deve liberarlo per nessuno (letto %).', v_entro; end if;

  -- --- La nota SEGUE la sua causa: spostata la seconda, si sposta ---
  update reservations set reservation_time = '23:00' where id = r_tardi;
  select liberare_entro into v_entro from turni_del_giorno(d_cena) where reservation_id = r_presto;
  if v_entro <> time '23:00' - make_interval(mins => (select minuti_fra_turni from service_settings where id = 1)) then
    raise exception 'Spostata la seconda prenotazione, l''ora da liberare non l''ha seguita (letto %).', v_entro;
  end if;

  -- --- E SPARISCE con la sua causa ---
  -- ⚠️ Il caso da non dimenticare: una nota che sopravvive alla propria
  -- causa e' come una che non segue lo spostamento.
  delete from reservations where id = r_tardi;
  select liberare_entro into v_entro from turni_del_giorno(d_cena) where reservation_id = r_presto;
  if v_entro is not null then
    raise exception 'Cancellata la seconda prenotazione, la nota e'' rimasta a dichiarare un turno che non esiste (letto %).', v_entro;
  end if;

  -- --- IL PRANZO: le fasce si leggono sugli orari di QUEL servizio ---
  if true then
    insert into reservations (type, status, source, reservation_date, reservation_time, party_size, customer_name)
    values ('prenotazione', 'confermata', 'interno', d_pranzo, '13:00', 2, 'VERIFICA pranzo') returning id into r_pieno;
    insert into reservations (type, status, source, reservation_date, reservation_time, party_size, customer_name)
    values ('prenotazione', 'confermata', 'interno', d_pranzo, '14:30', 2, 'VERIFICA dopo pranzo') returning id into r_tardi;

    select servizio, fascia into v_serv, v_fascia from turni_del_giorno(d_pranzo) where reservation_id = r_pieno;
    if v_serv <> 'pranzo' then
      raise exception 'Un arrivo alle 13:00 di domenica e'' stato attribuito al servizio «%» invece che al pranzo.', v_serv;
    end if;
    -- ⚠️ Il pranzo non ha un'ora del primo giro (nessuno l'ha decisa):
    -- quel servizio ha DUE fasce, e nessuno risulta «presto». Con la
    -- vecchia ora unica del locale, le 13:00 sarebbero state «presto».
    if v_fascia <> 'pieno' then
      raise exception 'Senza un''ora del primo giro il pranzo deve avere due fasce: le 13:00 dovevano essere «pieno», sono «%».', v_fascia;
    end if;
    select fascia into v_fascia from turni_del_giorno(d_pranzo) where reservation_id = r_tardi;
    if v_fascia <> 'tardi' then
      raise exception 'Le 14:30, dopo l''ultimo ingresso del pranzo, dovevano essere «tardi»: sono «%».', v_fascia;
    end if;
  end if;

  -- --- Pulizia e perimetro ---
  delete from reservations where reservation_date in (d_cena, d_pranzo);
  update service_hours set attivo = cena_attiva   where weekday = 3 and servizio = 'cena';
  update service_hours set attivo = pranzo_attivo where weekday = 0 and servizio = 'pranzo';
  alter table reservations enable trigger trg_notify_reservation_telegram;
  if (select tgenabled from pg_trigger t join pg_class c on c.oid = t.tgrelid
       where c.relname = 'reservations' and t.tgname = 'trg_notify_reservation_telegram') <> 'O' then
    raise exception 'Il trigger delle notifiche e'' rimasto spento: le richieste dei clienti non arriverebbero piu''.';
  end if;

  select count(*) into n from reservations where customer_name like 'VERIFICA%';
  if n <> 0 then raise exception 'Restano % prenotazioni di prova.', n; end if;

  -- La vecchia ora unica non deve essere sopravvissuta allo spostamento.
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'service_settings' and column_name = 'ora_primo_turno'
  ) then
    raise exception 'L''ora del primo giro esiste ancora sul locale E sul servizio: due posti per lo stesso fatto.';
  end if;

  raise notice 'Tre fasce lette sul servizio giusto, e la nota del turno segue e sparisce con la sua causa.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260818000004', 'le_tre_fasce_e_il_turno')
on conflict (version) do nothing;
