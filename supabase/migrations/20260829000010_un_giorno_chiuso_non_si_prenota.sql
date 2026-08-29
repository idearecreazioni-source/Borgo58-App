-- =====================================================================
-- UN GIORNO CHIUSO NON SI PRENOTA — e le prenotazioni gia' prese restano
-- 29/08/2026 — Blocco 1 del mandato del 29/08 (sera)
-- =====================================================================
-- Decisione di Alessio, ed e' piu' semplice di quella che gli era stata
-- proposta: **il gestionale non decide**. Raccoglie, mostra, e decide lui.
--   (1a) in un giorno di chiusura non si prenota — e' certo, non e' un
--        calcolo;
--   (1b) le prenotazioni gia' prese in quel giorno NON spariscono: sono
--        clienti da chiamare;
--   (1c) niente blocco sugli orari: solo un avviso.
--
-- ---------------------------------------------------------------------
-- 🔴 IL DIFETTO, MISURATO PRIMA DI CORREGGERE
-- ---------------------------------------------------------------------
-- Il controllo della chiusura ESISTEVA gia' in tutte e due le funzioni
-- pubbliche — ma viveva **dentro** il ramo dell'interruttore
-- `prenotazioni_online_attive`. Misurato sul progetto di prova il 29/08,
-- creando una chiusura per il 2026-09-08 e chiamando le due funzioni:
--
--   · interruttore SPENTO
--       public_reservation_options -> {"orari": [], "attivo": false, "sold_out": false}
--       submit_public_reservation  -> 🔴 LA RICHIESTA E' ENTRATA
--   · interruttore ACCESO
--       public_reservation_options -> {"chiuso": true, "motivo": "…"}
--       submit_public_reservation  -> respinta, com'e' giusto
--
-- ⚠️ **L'interruttore governa un CALCOLO, non un fatto.** Spento, il modulo
-- torna alla richiesta a orario libero: e' una decisione del 10/08 e resta
-- intera. Ma «quel giorno siamo chiusi» non e' una disponibilita' calcolata
-- — e' una cosa che Alessio ha scritto lui, con la data davanti. Un fatto
-- certo non puo' dipendere da un interruttore che governa una stima.
--
-- ⚠️ **E il modo di fallire era il peggiore**: nessun errore, nessun avviso.
-- La richiesta entrava, e la si sarebbe scoperta solo aprendo la giornata.
--
-- ---------------------------------------------------------------------
-- COSA FA QUESTA MIGRAZIONE
-- ---------------------------------------------------------------------
--  1. `giorni_chiusi_prenotabili()` — le date chiuse dentro la finestra
--     prenotabile, **senza il motivo**, perche' il modulo pubblico possa
--     dirle PRIMA che qualcuno ne scelga una. ⚠️ Il motivo di una chiusura
--     lo scrive Alessio per se' («ferie del personale»): esce solo dalla
--     funzione che gia' lo mostrava, non da una porta nuova.
--  2. `perche_chiuso()` — chiuso si'/no **e perche'**, per la schermata
--     della giornata (1b). Distingue il riposo settimanale dalla chiusura
--     a date: sono due fatti diversi e la frase da leggere e' diversa.
--  3. sposta il controllo della chiusura FUORI dall'interruttore, in
--     tutt'e due le funzioni pubbliche, accanto al freno del «siamo al
--     completo» — che ha esattamente la stessa forma ed e' gia' fuori
--     dall'interruttore dal 14/08.
--
-- ⚠️ **NESSUNA prenotazione viene toccata, nascosta o cancellata.** E' il
-- punto 1b, ed e' la meta' che da sola non si vede: senza, si dimentica di
-- chiamare chi aveva gia' prenotato.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Le date chiuse della finestra prenotabile — per il modulo pubblico
-- ---------------------------------------------------------------------
-- ⚠️ Comprende il RIPOSO SETTIMANALE, non solo le chiusure a date: per chi
-- prenota sono la stessa cosa — quel giorno non si mangia qui. La regola
-- non e' riscritta: si chiede a `locale_aperto()`, che e' il posto dove
-- vive gia' da sola.
create or replace function giorni_chiusi_prenotabili()
returns setof date
language sql
stable
security definer
set search_path = public
as $corpo$
  select g::date
    from generate_series(
      (now() at time zone 'Europe/Rome')::date,
      (now() at time zone 'Europe/Rome')::date
        + coalesce((select giorni_prenotabili from service_settings where id = 1), 60),
      interval '1 day'
    ) g
   where not locale_aperto(g::date);
$corpo$;

comment on function giorni_chiusi_prenotabili() is
  'Le date della finestra prenotabile in cui il locale e'' chiuso, riposo settimanale compreso. Senza il motivo: quello e'' un appunto interno di Alessio.';

revoke all on function giorni_chiusi_prenotabili() from public, anon, authenticated;
grant execute on function giorni_chiusi_prenotabili() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Perche' un giorno e' chiuso — per la schermata della giornata (1b)
-- ---------------------------------------------------------------------
-- ⚠️ NON e' concessa ad anon: qui esce il motivo scritto da Alessio.
create or replace function perche_chiuso(p_data date)
returns jsonb
language sql
stable
set search_path = public
as $corpo$
  select jsonb_build_object(
    'chiuso', not locale_aperto(p_data),
    -- Riposo settimanale e chiusura a date sono due fatti distinti, e la
    -- frase da leggere e' diversa: «di lunedi' siamo chiusi» non e' «siamo
    -- in ferie». Possono valere tutti e due nello stesso giorno.
    'riposo', not exists (
      select 1 from service_hours sh
       where sh.weekday = extract(dow from p_data)::integer and sh.attivo
    ),
    'chiusura_a_date', exists (
      select 1 from service_closures c where p_data between c.dal and c.al
    ),
    'motivo', (
      select nullif(trim(c.motivo), '')
        from service_closures c
       where p_data between c.dal and c.al
       order by c.dal
       limit 1
    )
  );
$corpo$;

comment on function perche_chiuso(date) is
  'Se in quel giorno il locale e'' chiuso, e perche'': riposo settimanale, chiusura a date, o tutt''e due. Le prenotazioni gia'' prese NON spariscono: sono clienti da chiamare.';

revoke all on function perche_chiuso(date) from public, anon, authenticated;
grant execute on function perche_chiuso(date) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Gli orari proposti: la chiusura si dice SEMPRE
-- ---------------------------------------------------------------------
-- Corpo ripreso dal database vivo del progetto di prova — che con cinque
-- migrazioni in attesa di push e' l'unico allineato al repository — e
-- cambiato in un punto solo: il blocco della chiusura sale sopra il ramo
-- dell'interruttore.
create or replace function public_reservation_options(p_date date, p_party_size integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_attivo    boolean;
  v_giorni    integer;
  v_preavviso integer;
  v_passo     integer;
  v_oggi      date      := (now() at time zone 'Europe/Rome')::date;
  v_adesso    timestamp := (now() at time zone 'Europe/Rome');
  v_motivo    text;
  v_orari     jsonb := '[]'::jsonb;
  r           record;
  v_slot      timestamp;
  v_fine      timestamp;
  v_servizi   integer := 0;
begin
  select prenotazioni_online_attive, giorni_prenotabili, preavviso_minuti, passo_prenotazioni_minuti
    into v_attivo, v_giorni, v_preavviso, v_passo
  from service_settings where id = 1;

  if exists (select 1 from giornate_sold_out where data = p_date) then
    return jsonb_build_object('attivo', coalesce(v_attivo, false), 'chiuso', true, 'sold_out', true,
      'motivo', 'Per quella sera siamo al completo. Prova un''altra data, oppure chiamaci: a volte si libera qualcosa.',
      'orari', v_orari);
  end if;

  -- 🔴 LA CHIUSURA SI DICE SEMPRE, anche a interruttore spento (29/08).
  -- Stava piu' in basso, dentro il ramo `if v_attivo`: spento, questa
  -- funzione rispondeva `{"attivo": false}` e basta, e il modulo tornava
  -- all'orario libero senza sapere che quel giorno il locale e' chiuso.
  -- ⚠️ Sta accanto al «siamo al completo» perche' e' la stessa cosa: un
  -- fatto che Alessio ha scritto lui, non una disponibilita' calcolata.
  if p_date is not null then
    select motivo into v_motivo from service_closures
     where p_date between dal and al
     order by dal limit 1;
    if found then
      return jsonb_build_object('attivo', coalesce(v_attivo, false), 'chiuso', true, 'sold_out', false,
        'motivo', coalesce(nullif(trim(v_motivo), ''), 'Quel giorno siamo chiusi.'), 'orari', v_orari);
    end if;
    -- E il riposo settimanale e' una chiusura come le altre per chi
    -- prenota: quel giorno non si mangia qui. A interruttore acceso questo
    -- caso lo copriva gia' il conteggio dei servizi in fondo; spento, no.
    if not exists (
      select 1 from service_hours sh
       where sh.weekday = extract(dow from p_date)::integer and sh.attivo
    ) then
      return jsonb_build_object('attivo', coalesce(v_attivo, false), 'chiuso', true, 'sold_out', false,
        'motivo', 'Quel giorno siamo chiusi.', 'orari', v_orari);
    end if;
  end if;

  if not coalesce(v_attivo, false) then
    return jsonb_build_object('attivo', false, 'sold_out', false, 'orari', v_orari);
  end if;

  if p_date is null or p_date < v_oggi or p_date > v_oggi + v_giorni then
    return jsonb_build_object('attivo', true, 'chiuso', true, 'sold_out', false,
      'motivo', 'Per questa data non prendiamo ancora prenotazioni online.', 'orari', v_orari);
  end if;

  for r in
    select apertura, ultimo_ingresso
    from service_hours
    where attivo and weekday = extract(dow from p_date)::smallint
    order by apertura
  loop
    v_servizi := v_servizi + 1;
    v_slot := p_date + r.apertura;
    v_fine := p_date + r.ultimo_ingresso;
    while v_slot <= v_fine loop
      if v_slot >= v_adesso + make_interval(mins => v_preavviso) then
        v_orari := v_orari || to_jsonb(to_char(v_slot, 'HH24:MI'));
      end if;
      -- ⚠️ Il passo viene dalle impostazioni, non piu' da un `interval
      -- '15 minutes'` scritto qui dentro: e' un numero di Alessio.
      v_slot := v_slot + make_interval(mins => v_passo);
    end loop;
  end loop;

  return jsonb_build_object(
    'attivo', true,
    'sold_out', false,
    'chiuso', jsonb_array_length(v_orari) = 0,
    'motivo', case
      when v_servizi = 0 then 'Quel giorno siamo chiusi.'
      when jsonb_array_length(v_orari) = 0 then
        'Per oggi non prendiamo piu'' prenotazioni online. Chiamaci pure: se c''e'' posto te lo diciamo subito.'
    end,
    'orari', v_orari
  );
end;
$function$;

revoke all on function public_reservation_options(date, integer) from public, anon, authenticated;
grant execute on function public_reservation_options(date, integer) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. La richiesta pubblica: la chiusura respinge SEMPRE
-- ---------------------------------------------------------------------
-- Corpo ripreso dal database vivo del progetto di prova. Cambia un punto
-- solo: il controllo della chiusura esce dal ramo `if v_attivo` e sale
-- accanto al freno del «siamo al completo».
create or replace function submit_public_reservation(
  p_reservation_date date,
  p_reservation_time time without time zone,
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
as $function$
declare
  tel    text := nullif(trim(p_customer_phone), '');
  mail   text := nullif(trim(p_customer_email), '');
  quante integer;
  v_attivo boolean;
  v_aperto boolean;
begin
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
  -- IL FRENO DELLA GIORNATA PIENA, prima di tutti gli altri controlli e
  -- indipendente dall'interruttore: se il locale è al completo, la
  -- richiesta non deve nemmeno essere registrata.
  if exists (select 1 from giornate_sold_out where data = p_reservation_date) then
    raise exception 'Per quella sera siamo al completo. Scegli un''altra data, oppure chiamaci: a volte si libera qualcosa.';
  end if;
  -- 🔴 E IL GIORNO DI CHIUSURA, per la stessa ragione (29/08). Stava piu'
  -- in basso, dentro `if v_attivo`: a interruttore spento la richiesta
  -- entrava — misurato, non dedotto.
  if exists (select 1 from service_closures where p_reservation_date between dal and al) then
    raise exception 'Quel giorno siamo chiusi. Scegli un''altra data, oppure chiamaci.';
  end if;
  -- I freni anti-abuso del Contratto §4 RESTANO: il sold out non li
  -- sostituisce. Un indirizzo pubblico riceve invii automatici come
  -- norma, non come eccezione.
  select count(*) into quante
  from reservations
  where source = 'form_pubblico' and created_at > now() - interval '1 hour';
  if quante >= 40 then
    raise exception 'Stiamo ricevendo molte richieste in questo momento. Riprova fra qualche minuto, oppure chiamaci: ti rispondiamo subito.';
  end if;
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
  -- A interruttore acceso resta il controllo che E' un calcolo: l'orario di
  -- servizio. Il giorno di chiusura e' salito sopra, perche' non lo e'.
  --
  -- ⚠️ È sparito il terzo, «mentre compilavi quel posto è stato preso»:
  -- una richiesta non occupa più niente. La decisione del 10/08 — la
  -- richiesta in attesa tiene il posto — decade insieme al calcolo che la
  -- rendeva necessaria, ed è stata ratificata da Alessio il 14/08.
  select prenotazioni_online_attive into v_attivo from service_settings where id = 1;
  if coalesce(v_attivo, false) then
    select exists (
      select 1 from service_hours
      where attivo
        and weekday = extract(dow from p_reservation_date)::smallint
        and p_reservation_time between apertura and ultimo_ingresso
    ) into v_aperto;
    if not v_aperto then
      raise exception 'A quell''ora non siamo in servizio. Scegli uno degli orari proposti, oppure chiamaci.';
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
$function$;

revoke all on function submit_public_reservation(date, time without time zone, integer, text, text, text, text)
  from public, anon, authenticated;
grant execute on function submit_public_reservation(date, time without time zone, integer, text, text, text, text)
  to anon;

-- =====================================================================
-- =====================================================================
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_giorno   date;
  v_dow      integer;
  v_id       uuid;
  v_prima    boolean;
  v_orari    jsonb;
  v_opz      jsonb;
  v_entrata  boolean;
  v_chiusi   integer;
  v_res      jsonb;
  v_miei     uuid[] := array[]::uuid[];
  v_pren     uuid;
  v_tel      text;
begin
  -- ⚠️ IL PERIMETRO SE LO COSTRUISCE QUESTA VERIFICA, non lo prende in
  -- prestito dai dati di Alessio. La prima stesura cercava «un giorno in
  -- cui il locale e' aperto» e si e' fermata sul progetto di prova, dove
  -- **tutti e quattordici** i servizi sono spenti: la verifica non era
  -- sbagliata, era appoggiata a una riga che non e' sua.
  -- Quindi: si sceglie un giorno che nessuna chiusura copre, e si accende
  -- la cena di quel giorno della settimana per il tempo della prova.
  select g::date into v_giorno
    from generate_series(
      (now() at time zone 'Europe/Rome')::date + 3,
      (now() at time zone 'Europe/Rome')::date + 40,
      interval '1 day') g
   where not exists (select 1 from service_closures c where g::date between c.dal and c.al)
     and not exists (select 1 from giornate_sold_out s where s.data = g::date)
   limit 1;
  if v_giorno is null then
    raise exception 'Nei prossimi 40 giorni ogni data e'' gia'' chiusa o al completo: la verifica non ha un perimetro suo.';
  end if;
  v_dow := extract(dow from v_giorno)::integer;

  -- (0) LA SOSTITUZIONE HA ATTECCHITO? Se un `create or replace` non fosse
  --     passato, tutto il resto proverebbe il codice vecchio e passerebbe
  --     verde su meta' dei controlli. Si guarda il CORPO VIVO.
  if pg_get_functiondef('public_reservation_options(date,integer)'::regprocedure)
       not like '%LA CHIUSURA SI DICE SEMPRE%' then
    raise exception 'public_reservation_options non e'' stata riscritta: il corpo vivo non porta il segno della correzione.';
  end if;
  if pg_get_functiondef(
       'submit_public_reservation(date,time without time zone,integer,text,text,text,text)'::regprocedure)
       not like '%E IL GIORNO DI CHIUSURA%' then
    raise exception 'submit_public_reservation non e'' stata riscritta: il corpo vivo non porta il segno della correzione.';
  end if;

  -- ⚠️ L'avviso su Telegram si spegne: una richiesta finta non deve far
  -- suonare il telefono di Alessio (§8, successo davvero l'11/08). E il
  -- collegamento automatico al cliente pure, altrimenti ogni richiesta di
  -- prova lascia dietro di se' un cliente inventato.
  alter table reservations disable trigger trg_notify_reservation_telegram;
  alter table reservations disable trigger trg_link_reservation_customer;

  -- Lo stato di partenza si salva INTERO, non i campi che mi ricordo.
  select prenotazioni_online_attive into v_prima from service_settings where id = 1;
  select coalesce(jsonb_agg(to_jsonb(sh)), '[]'::jsonb) into v_orari
    from service_hours sh where sh.weekday = v_dow;

  update service_hours set attivo = true, apertura = '19:00', ultimo_ingresso = '22:00'
   where weekday = v_dow and servizio = 'cena';

  if not locale_aperto(v_giorno) then
    raise exception 'Il giorno costruito dalla verifica non risulta aperto: il perimetro non regge.';
  end if;

  -- (1) IL CASO POSITIVO, PRIMA DI TUTTO. Senza, un rifiuto piu' avanti
  --     non dimostra che la causa e' la chiusura: potrebbe essere
  --     qualunque altro controllo della funzione.
  update service_settings set prenotazioni_online_attive = true where id = 1;
  v_tel := '3339999901';
  perform submit_public_reservation(v_giorno, '20:00'::time, 2, 'VERIFICA-29AGO aperto', v_tel, null, null);
  select id into v_pren from reservations where customer_phone = v_tel;
  if v_pren is null then
    raise exception 'Il giorno aperto non accetta la richiesta: la verifica sta misurando un''altra cosa.';
  end if;
  v_miei := v_miei || v_pren;
  delete from reservations where id = v_pren;
  v_miei := array_remove(v_miei, v_pren);

  -- (2) L'INTERRUTTORE SPENTO — il caso che il 29/08 lasciava passare.
  update service_settings set prenotazioni_online_attive = false where id = 1;

  insert into service_closures (dal, al, motivo)
  values (v_giorno, v_giorno, 'VERIFICA-29AGO giorno chiuso')
  returning id into v_id;

  v_opz := public_reservation_options(v_giorno, 2);
  if (v_opz ->> 'chiuso') is distinct from 'true' then
    raise exception 'A interruttore spento gli orari non dichiarano la chiusura: %', v_opz;
  end if;

  v_entrata := true;
  v_tel := '3339999902';
  begin
    perform submit_public_reservation(v_giorno, '20:00'::time, 2, 'VERIFICA-29AGO spento', v_tel, null, null);
  exception when sqlstate 'P0001' then
    v_entrata := false;
  end;
  if v_entrata then
    -- Se e' entrata lo stesso la riga esiste: va tolta prima di gridare,
    -- altrimenti la rottura lascia dietro di se' un cliente inventato.
    delete from reservations where customer_phone = v_tel;
    raise exception 'A interruttore spento una richiesta e'' entrata in un giorno chiuso: la correzione non ha preso.';
  end if;

  -- (3) L'INTERRUTTORE ACCESO — deve continuare a respingere come prima.
  update service_settings set prenotazioni_online_attive = true where id = 1;
  v_entrata := true;
  v_tel := '3339999903';
  begin
    perform submit_public_reservation(v_giorno, '20:00'::time, 2, 'VERIFICA-29AGO acceso', v_tel, null, null);
  exception when sqlstate 'P0001' then
    v_entrata := false;
  end;
  if v_entrata then
    delete from reservations where customer_phone = v_tel;
    raise exception 'A interruttore acceso una richiesta e'' entrata in un giorno chiuso.';
  end if;

  -- (4) LA CHIUSURA COMPARE FRA I GIORNI CHIUSI PRENOTABILI.
  select count(*) into v_chiusi from giorni_chiusi_prenotabili() g where g = v_giorno;
  if v_chiusi <> 1 then
    raise exception 'Il giorno chiuso non compare fra i giorni chiusi prenotabili (trovato % volte).', v_chiusi;
  end if;

  -- (5) PERCHE' E' CHIUSO: chiusura a date, e NON riposo settimanale —
  --     due fatti distinti, e la frase da leggere e' diversa.
  v_res := perche_chiuso(v_giorno);
  if (v_res ->> 'chiuso') is distinct from 'true'
     or (v_res ->> 'chiusura_a_date') is distinct from 'true'
     or (v_res ->> 'riposo') is distinct from 'false'
     or (v_res ->> 'motivo') is distinct from 'VERIFICA-29AGO giorno chiuso' then
    raise exception 'perche_chiuso non racconta la chiusura come dovrebbe: %', v_res;
  end if;

  -- (6) 🔴 LE PRENOTAZIONI GIA' PRESE RESTANO. E' il punto 1b, ed e' il
  --     solo controllo che protegge una decisione invece di un calcolo:
  --     chiudere un giorno non deve far sparire i clienti da chiamare.
  insert into reservations (type, status, source, reservation_date, reservation_time,
                            party_size, customer_name, customer_phone)
  values ('prenotazione', 'confermata', 'interno', v_giorno, '20:30', 4,
          'VERIFICA-29AGO gia prenotato', '3339999904')
  returning id into v_pren;
  v_miei := v_miei || v_pren;

  if not exists (select 1 from reservations where id = v_pren) then
    raise exception 'La prenotazione gia'' presa e'' sparita chiudendo il giorno.';
  end if;
  if (select count(*) from reservations
       where reservation_date = v_giorno and status = 'confermata') < 1 then
    raise exception 'In un giorno chiuso le prenotazioni confermate non si vedono piu''.';
  end if;

  -- Si rimette tutto com'era: le righe INTERE, non i campi che mi ricordo.
  delete from reservations where id = any(v_miei);
  delete from service_closures where id = v_id;
  update service_settings set prenotazioni_online_attive = v_prima where id = 1;
  update service_hours sh set
      attivo          = (o ->> 'attivo')::boolean,
      apertura        = (o ->> 'apertura')::time,
      ultimo_ingresso = (o ->> 'ultimo_ingresso')::time
    from jsonb_array_elements(v_orari) o
   where sh.id = (o ->> 'id')::uuid;

  alter table reservations enable trigger trg_notify_reservation_telegram;
  alter table reservations enable trigger trg_link_reservation_customer;

  -- ⚠️ Riaccenderli va CONTROLLATO: lasciarli spenti vuol dire richieste
  -- dei clienti che non arrivano piu', in silenzio.
  if (select count(*) from pg_trigger
       where tgrelid = 'reservations'::regclass
         and tgname in ('trg_notify_reservation_telegram', 'trg_link_reservation_customer')
         and tgenabled = 'D') > 0 then
    raise exception 'Un trigger di reservations e'' rimasto spento.';
  end if;

  perform pretendi_nessun_residuo(v_foto, 'la verifica del giorno chiuso');
  raise notice 'Un giorno chiuso respinge le prenotazioni con l''interruttore acceso E spento, e le prenotazioni gia'' prese restano. Giorno usato: %', v_giorno;
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000010', 'un_giorno_chiuso_non_si_prenota') on conflict (version) do nothing;
