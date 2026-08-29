-- =====================================================================
-- «NON LO SO» NON E' «E' DEL TURNO CENTRALE»
-- 29/08/2026 — difetto misurato da Alessio sulla pianta della sala
-- =====================================================================
-- 🔴 COSA HA VISTO, e l'ha visto DUE VOLTE: la prima con i servizi spenti,
-- la seconda — che e' quella che conta — con i servizi configurati bene, su
-- una prenotazione delle **19:29** mentre il locale apre alle **20:00**.
-- Quel tavolo si colorava del colore del turno centrale. Spostando la
-- prenotazione alle 20:00 diventava giallo come deve.
--
-- ⚠️ NON E' UN CASO DI COLLAUDO: succedera' a locale funzionante, ogni volta
-- che qualcuno prenota prima dell'orario di apertura — e succedera' mentre
-- Alessio e' in servizio.
--
-- 🔴 LA CAUSA, letta nel corpo vivo della funzione: quando nessun servizio
-- combacia con l'ora, tre valori restano vuoti insieme, e la scelta del
-- colore cadeva sull'ultimo ramo — lo stesso di un turno centrale vero.
-- Due fatti diversi con lo stesso identico valore: chi guarda non ha modo
-- di distinguerli. E' la regola «uno zero non e' una risposta» nella sua
-- forma piu' pura — qui non manca un numero, manca un'INFORMAZIONE, e il
-- gestionale la sostituiva con una plausibile.
--
-- ⚠️ IL DISCRIMINANTE E' IL SERVIZIO, NON L'ORA DEL PRIMO TURNO. Un servizio
-- che esiste ma non ha quell'ora e' il caso del PRANZO, dove la colonna e'
-- vuota apposta perche' quel servizio ha due fasce invece di tre (18/08).
-- La' «pieno» e' la risposta giusta e non un non-so: guardando la colonna
-- sbagliata si sarebbe marcato «ignota» ogni domenica.
--
-- ⚠️ E IL CORPO VIENE DAL DATABASE, non dal file che l'ha creato: fra i due
-- ci stanno tutte le migrazioni che l'hanno toccato dopo.

CREATE OR REPLACE FUNCTION public.turni_del_giorno(p_data date)
 RETURNS TABLE(reservation_id uuid, ora time without time zone, servizio text, fascia text, tavoli uuid[], etichette text[], liberare_entro time without time zone, turno_dopo_di uuid, servita boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
with impostazioni as (
    select minuti_fra_turni from service_settings where id = 1
  ),
  prenotazioni as (
    select r.id, r.reservation_time as ora, r.status,
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
       -- 🔴 «non_presentata» AGGIUNTA IL 22/08: la serata si vede per
       -- intero, comprese le sedie rimaste vuote. Farla sparire vorrebbe
       -- dire che a fine servizio non si capisce piu' cosa e' successo a
       -- quel tavolo — ed e' proprio l'informazione da conservare.
       and r.status in ('confermata', 'servita', 'non_presentata')
  ),
  con_servizio as (
    select p.*,
           (select sh.servizio from service_hours sh
             where sh.weekday = extract(dow from p_data)::integer and sh.attivo
               and sh.apertura <= p.ora
             order by sh.apertura desc limit 1) as servizio_scelto,
           -- ⚠️ L'arancio comincia dagli ULTIMI ARRIVI, che possono venire
           -- prima dell'ultimo orario prenotabile. Dove non e' scritta,
           -- vale l'ultimo orario prenotabile: un solo numero, come prima.
           (select coalesce(sh.ora_ultimi_arrivi, sh.ultimo_ingresso) from service_hours sh
             where sh.weekday = extract(dow from p_data)::integer and sh.attivo
               and sh.apertura <= p.ora
             order by sh.apertura desc limit 1) as inizio_ultimi,
           (select sh.ora_primo_turno from service_hours sh
             where sh.weekday = extract(dow from p_data)::integer and sh.attivo
               and sh.apertura <= p.ora
             order by sh.apertura desc limit 1) as primo_turno
      from prenotazioni p
  ),
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
         -- 🔴 «NON LO SO» NON E' «E' DEL TURNO CENTRALE» — 29/08/2026,
         --    difetto misurato da Alessio su una prenotazione delle 19:29
         --    con il locale che apre alle 20:00.
         --
         --    Quando nessun servizio combacia con l'ora della prenotazione,
         --    il servizio scelto, l'ora degli ultimi arrivi e quella del
         --    primo turno restano TUTTI vuoti — e prima di stanotte quel
         --    caso cadeva su «pieno», cioe' sullo stesso identico colore
         --    del turno centrale vero. Chi guardava la pianta non aveva
         --    modo di distinguere le due cose, e succedera' a locale
         --    funzionante ogni volta che qualcuno prenota prima
         --    dell'orario di apertura.
         --
         --    ⚠️ IL DISCRIMINANTE E' IL SERVIZIO, NON L'ORA DEL PRIMO
         --    TURNO: un servizio che esiste ma non ha quell'ora e' il caso
         --    del PRANZO, dove la colonna e' vuota APPOSTA perche' quel
         --    servizio ha due fasce invece di tre (18/08). La', «pieno» e'
         --    la risposta giusta e non un non-so — e distinguerli guardando
         --    la colonna sbagliata avrebbe marcato «ignota» ogni domenica.
         case
           when c.servizio_scelto is null then 'ignota'
           when c.inizio_ultimi is not null and c.ora >= c.inizio_ultimi then 'tardi'
           when c.primo_turno is null then 'pieno'
           when c.ora <= c.primo_turno then 'presto'
           else 'pieno'
         end,
         c.tavoli,
         c.etichette,
         case when s.ora_dopo is null then null
              else s.ora_dopo - make_interval(mins => i.minuti_fra_turni) end,
         s.id_dopo,
         -- 🔴 QUESTO CAMPO VUOL DIRE «NON L'ASPETTIAMO PIU'», ed e'
         -- sempre stato il suo senso: governa il colore del tavolo, le
         -- persone attese e il ritardo. Una non presentata non deve tenere
         -- il tavolo colorato ne' risultare **in ritardo per sempre**, che
         -- e' come si comportava restando «confermata».
         -- ⚠️ Per il CLIENTE «servita» e «non presentata» sono due fatti
         -- opposti; per la SALA sono la stessa cosa, ed e' la sala che
         -- questo campo governa.
         c.status in ('servita', 'non_presentata')
    from con_servizio c
    join seguente s on s.id = c.id
   cross join impostazioni i
   order by c.ora;
$function$;


-- =====================================================================
-- VERIFICA
-- =====================================================================
-- ⚠️ L'esempio si COSTRUISCE: un giorno di servizio apposta, e due
-- prenotazioni che differiscono per una cosa sola — l'ora. Prendere in
-- prestito una prenotazione vera direbbe solo che quel giorno andava bene.
do $verifica$
declare
  v_foto     jsonb;
  v_tit      uuid;
  v_giorno   date;
  v_dow      integer;
  v_prima    uuid;
  v_dentro   uuid;
  v_tavolo   uuid;
  v_avevo    record;
  v_ceHore   boolean;
  v_fascia   text;
  v_miei     uuid[] := '{}';
begin
  v_foto := foto_righe();

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Verifica impossibile: nessun titolare in user_roles.';
  end if;

  select id into v_tavolo from dining_tables order by created_at limit 1;
  if v_tavolo is null then
    raise exception 'Verifica impossibile: nessun tavolo in sala.';
  end if;

  -- Un giorno lontano, cosi' non incrocia niente di vero.
  v_giorno := date '2026-12-15';
  v_dow := extract(dow from v_giorno)::integer;

  -- ⚠️ L'orario di quel giorno si SALVA INTERO e si rimette intero: la
  --    regola del 14/08 — quello che ci si ricorda a mano si dimentica a
  --    meta'. Se non c'e' proprio, alla fine si toglie la riga creata qui.
  select * into v_avevo from service_hours where weekday = v_dow and servizio = 'cena';
  v_ceHore := found;

  if v_ceHore then
    update service_hours
       set attivo = true, apertura = time '20:00', ultimo_ingresso = time '22:30',
           ora_primo_turno = time '20:00', ora_ultimi_arrivi = time '22:00'
     where weekday = v_dow and servizio = 'cena';
  else
    insert into service_hours (weekday, servizio, attivo, apertura, ultimo_ingresso,
                               ora_primo_turno, ora_ultimi_arrivi)
    values (v_dow, 'cena', true, time '20:00', time '22:30', time '20:00', time '22:00');
  end if;

  -- Le due prenotazioni: una PRIMA dell'apertura, una dentro il servizio.
  insert into reservations (customer_name, type, reservation_date, reservation_time,
                            party_size, status, source)
  values ('VERIFICA fascia ignota', 'prenotazione', v_giorno, time '19:29', 2, 'confermata', 'interno')
  returning id into v_prima;
  insert into reservations (customer_name, type, reservation_date, reservation_time,
                            party_size, status, source)
  values ('VERIFICA fascia piena', 'prenotazione', v_giorno, time '21:00', 2, 'confermata', 'interno')
  returning id into v_dentro;
  v_miei := v_miei || v_prima || v_dentro;

  insert into prenotazione_tavoli (reservation_id, dining_table_id, etichetta_al_momento)
  values (v_prima, v_tavolo, 'X'), (v_dentro, v_tavolo, 'X');

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- (1) 🔴 LA PRENOTAZIONE FUORI SERVIZIO DICE «NON LO SO».
  select t.fascia into v_fascia from turni_del_giorno(v_giorno) t where t.reservation_id = v_prima;
  if v_fascia is distinct from 'ignota' then
    raise exception 'Una prenotazione delle 19:29 con apertura alle 20:00 risulta «%» invece di «ignota»: e'' il difetto che questa migrazione chiude.', coalesce(v_fascia, 'vuota');
  end if;

  -- (2) E QUELLA DENTRO IL SERVIZIO CONTINUA A DIRE «PIENO». Senza questo
  --     controllo, un discriminante troppo largo marcherebbe «ignota» tutto
  --     — cioe' spegnerebbe i colori invece di aggiungerne uno.
  select t.fascia into v_fascia from turni_del_giorno(v_giorno) t where t.reservation_id = v_dentro;
  if v_fascia is distinct from 'pieno' then
    raise exception 'Una prenotazione delle 21:00 dentro il servizio risulta «%» invece di «pieno».', coalesce(v_fascia, 'vuota');
  end if;

  -- (3) E LE DUE COSE SI DISTINGUONO DAVVERO. È il controllo che dice il
  --     senso di tutto il resto: prima di stanotte questo confronto era
  --     VERO — le due fasce erano la stessa stringa.
  if (select count(distinct t.fascia) from turni_del_giorno(v_giorno) t
       where t.reservation_id in (v_prima, v_dentro)) <> 2 then
    raise exception 'Le due prenotazioni portano ancora la stessa fascia: «non lo so» e «turno centrale» non si distinguono.';
  end if;

  perform set_config('request.jwt.claims', null, true);

  -- --- si rimette tutto com'era ----------------------------------------
  delete from prenotazione_tavoli where reservation_id = any(v_miei);
  delete from reservations where id = any(v_miei);
  if v_ceHore then
    update service_hours
       set attivo = v_avevo.attivo, apertura = v_avevo.apertura,
           ultimo_ingresso = v_avevo.ultimo_ingresso,
           ora_primo_turno = v_avevo.ora_primo_turno,
           ora_ultimi_arrivi = v_avevo.ora_ultimi_arrivi
     where weekday = v_dow and servizio = 'cena';
  else
    delete from service_hours where weekday = v_dow and servizio = 'cena';
  end if;
  delete from deleted_records where record_id = any(v_miei::text[]);

  perform pretendi_nessun_residuo(v_foto, 'la verifica della fascia ignota');
  raise notice 'Una prenotazione fuori dagli orari del servizio dice «non lo so» invece di travestirsi da turno centrale.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000026', 'non_lo_so_non_e_il_turno_centrale') on conflict (version) do nothing;
