-- =====================================================================
-- LA CAPIENZA SI RICONTA — strada 2
-- 21/08/2026
-- =====================================================================
-- 🔴 DIFETTO TROVATO DALLE MANI DI ALESSIO al collaudo, e misurato prima di
-- curarlo ([referto](docs/referti/20260821_la_capienza_si_conta_una_volta_sola.md)):
-- il conto dei posti si faceva **una volta sola**, dentro
-- `accetta_preventivo`, e non si rifaceva mai piu'. Misurato su una sala da
-- 34: l'evento che si rimpicciolisce a 2 persone lasciava la spunta accesa —
-- una serata bloccata per niente — e l'evento spostato di un giorno lasciava
-- la spunta sul giorno **vecchio** e non la metteva sul **nuovo**, cioe' si
-- prendevano prenotazioni per una sera gia' piena.
--
-- ⚠️ STRADA 2, decisa da Alessio: si riconta quando cambia una cena **nata da
-- un preventivo**. Le prenotazioni normali restano come oggi.
--
-- **La ragione della scelta, perche' resti scritta.** La strada 1 — ricontare
-- a ogni prenotazione — non e' una correzione: e' **il cambio della regola
-- del 14/08 travestito da correzione** (*«il sistema non decide piu' se un
-- gruppo entra: lo decide Alessio»*), e quella decisione si riapre per i suoi
-- motivi e da svegli, non dentro una toppa notturna. La strada 3 — dirlo e
-- basta — poggia su chi legge l'avviso, che e' la forma smontata questa
-- sera. **La 2 non introduce nessun comportamento nuovo**: il conto per gli
-- eventi era gia' deciso, il difetto era che si faceva una volta sola.
--
-- 🔴 IL LIMITE, DICHIARATO QUI E NON NASCOSTO: se a riempire la sala sono le
-- prenotazioni **normali**, la spunta non si accende lo stesso. E' voluto
-- oggi, ed e' la domanda separata che Alessio si e' tenuto.
--
-- ⚠️ E LA CAPIENZA CONTINUA A CONTARSI IN UN POSTO SOLO: `capienza_della_sala`.
-- Qui non nasce nessun secondo conto — nasce **un solo posto dove si decide
-- cosa fare del risultato**, che prima era scritto dentro l'accettazione.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1 · L'UNICO POSTO DOVE LA SPUNTA SI ACCENDE E SI SPEGNE
-- ---------------------------------------------------------------------
-- Prima questa decisione viveva dentro `accetta_preventivo`, e per questo si
-- prendeva una volta sola. Ora e' una funzione, e la chiamano tutti quelli
-- che possono cambiare il conto.
--
-- ⚠️ SPEGNE SOLO LA SPUNTA DEL GESTIONALE. Quella con `preventivo_id` vuoto
-- l'ha messa Alessio a mano, e nessun ricalcolo la tocca: e' la stessa regola
-- gia' scritta nel trigger dell'annullamento il 20/08, e la ragione e' che
-- *una sala che si sblocca in silenzio gli fa scoprire il buco troppo tardi*.
--
-- ⚠️ E SE LA SALA NON SI PUO' CONTARE non tocca niente: «non lo so» non e'
-- «non e' piena» (regola del 19/08). Meglio una spunta vecchia di una spunta
-- tolta su un conto che nessuno ha potuto fare.
create or replace function sincronizza_spunta_sala(p_data date, p_preventivo_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_piena boolean;
  v_gia   uuid;
  v_ce    boolean;
begin
  if p_data is null then return 'nessuna data'; end if;

  select c.piena into v_piena from capienza_della_sala(p_data) c;
  if v_piena is null then
    return 'non ho potuto contare i posti: la spunta non l''ho toccata';
  end if;

  select preventivo_id, true into v_gia, v_ce
    from giornate_sold_out where data = p_data;

  if v_piena then
    if v_ce then return 'era gia' || ' segnata'; end if;
    insert into giornate_sold_out (data, preventivo_id) values (p_data, p_preventivo_id);
    return 'segnata come piena';
  end if;

  -- Non e' piena.
  if not coalesce(v_ce, false) then return 'niente da fare'; end if;
  if v_gia is null then
    -- 🔴 LA SPUNTA E' DI ALESSIO: non si tocca, e si dice perche'.
    return 'la sala resta segnata piena: quella spunta l''hai messa tu';
  end if;
  delete from giornate_sold_out where data = p_data;
  return 'la sala e'' tornata libera';
end;
$fn$;

comment on function sincronizza_spunta_sala(date, uuid) is
  'L''unico posto dove la spunta «sala piena» si accende e si spegne. Prima questa decisione stava dentro `accetta_preventivo`, ed e'' il motivo per cui il conto si faceva una volta sola.';

-- ⚠️ Nessun `grant`: la chiamano solo funzioni e trigger `security definer`.
revoke all on function sincronizza_spunta_sala(date, uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 2 · IL RICALCOLO QUANDO UNA CENA CAMBIA
-- ---------------------------------------------------------------------
-- ⚠️ SOLO le cene nate da un preventivo (strada 2): se la riga non e'
-- nominata da nessun preventivo, il trigger esce subito e non tocca niente.
--
-- ⚠️ E la DATA ha due versi, che e' il caso che il referto ha misurato come
-- peggiore: spostando l'evento si spegne sul giorno **vecchio** (se la spunta
-- e' del gestionale) e si riconta sul **nuovo**. Facendone uno solo, si
-- prenderebbero prenotazioni per una sera gia' piena.
create or replace function cena_cambiata_riconta_la_sala()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare v_prev uuid;
begin
  -- Niente e' cambiato di cio' che conta.
  if new.party_size is not distinct from old.party_size
     and new.reservation_date is not distinct from old.reservation_date
     and new.status is not distinct from old.status then
    return new;
  end if;

  select id into v_prev from preventivi
   where reservation_id = new.id
   order by accettato_il desc nulls last limit 1;
  if v_prev is null then
    -- Prenotazione normale: si comporta come prima (strada 2).
    return new;
  end if;

  if new.reservation_date is distinct from old.reservation_date then
    perform sincronizza_spunta_sala(old.reservation_date, v_prev);
  end if;
  perform sincronizza_spunta_sala(new.reservation_date, v_prev);
  return new;
end;
$fn$;

revoke all on function cena_cambiata_riconta_la_sala() from public, anon, authenticated;

drop trigger if exists trg_cena_cambiata on reservations;
-- ⚠️ Dopo `trg_evento_annullato` in ordine alfabetico non conta: quello
-- decide dell'avviso e dello stato del preventivo, questo del conto dei
-- posti, e i due non si pestano — anzi, dall'annullamento la spunta ora se
-- ne va **da qui**, perche' una cena annullata non risulta piu' fra le
-- confermate e la sala torna non piena. Una regola sola.
create trigger trg_cena_cambiata
  after update on reservations
  for each row execute function cena_cambiata_riconta_la_sala();


-- ---------------------------------------------------------------------
-- 3 · LE TRE FUNZIONI CHE ADESSO PASSANO DALLA REGOLA UNICA
-- ---------------------------------------------------------------------
-- ⚠️ Riscritte dal corpo VIVO letto dal database, non dai file che le
-- avevano create (regola del 18/08).

-- accetta_preventivo
CREATE OR REPLACE FUNCTION public.accetta_preventivo(p_preventivo_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_p          preventivi%rowtype;
  v_res        uuid;
  v_capienza   integer;
  v_prenotati  integer;
  v_piena      boolean;
  v_spunta     boolean := false;
  v_esito_spunta text;
  v_avvertenze text[] := '{}';
begin
  if not is_titolare() then
    raise exception 'I preventivi sono riservati al titolare.';
  end if;

  select * into v_p from preventivi where id = p_preventivo_id;
  if not found then
    raise exception 'Questo preventivo non esiste piu''.';
  end if;
  if v_p.stato = 'accettato' then
    raise exception 'Questo preventivo e'' gia'' accettato. Per cambiare qualcosa se ne fa una versione nuova.';
  end if;
  if v_p.stato in ('rifiutato', 'annullato') then
    raise exception 'Questo preventivo risulta %: fanne una versione nuova prima di accettarlo.', v_p.stato;
  end if;
  if v_p.ora_evento is null then
    raise exception 'Scrivi l''ora dell''evento prima di accettarlo: in sala serve a sapere quando arrivano.';
  end if;

  -- La prenotazione di un antenato accettato, se c'e'.
  with recursive catena as (
    select id, versione_di, reservation_id from preventivi where id = p_preventivo_id
    union all
    select p.id, p.versione_di, p.reservation_id
      from preventivi p join catena c on p.id = c.versione_di
  )
  select c.reservation_id into v_res
    from catena c where c.reservation_id is not null limit 1;

  if v_res is null then
    insert into reservations (type, status, source, reservation_date, reservation_time,
                              party_size, customer_name, customer_phone, customer_email,
                              customer_id)
    values ('evento', 'confermata', 'interno', v_p.data_evento, v_p.ora_evento,
            v_p.persone, v_p.cliente_nome, v_p.cliente_telefono, v_p.cliente_email,
            v_p.customer_id)
    returning id into v_res;
  else
    update reservations
       set reservation_date = v_p.data_evento,
           reservation_time = v_p.ora_evento,
           party_size       = v_p.persone,
           customer_name    = v_p.cliente_nome,
           customer_phone   = v_p.cliente_telefono,
           customer_email   = v_p.cliente_email,
           status           = 'confermata'
     where id = v_res;
    v_avvertenze := array_append(v_avvertenze,
      'Questa versione aggiorna l''evento gia'' in calendario: non ne nasce un secondo.');
  end if;

  update preventivi
     set stato          = 'accettato',
         reservation_id = v_res,
         accettato_il   = now(),
         accettato_da   = auth.uid()
   where id = p_preventivo_id;

  -- ⚠️ Il conto si fa DOPO aver messo l'evento in calendario: cosi' l'evento
  -- e' una prenotazione come le altre e non c'e' nessun caso speciale.
  -- ⚠️ QUI STAVA LA DECISIONE SULLA SPUNTA, ed e' il motivo per cui il conto
  -- si faceva una volta sola: viveva dentro l'accettazione. Adesso e' una
  -- funzione, e la chiamano anche il trigger e la correzione del preventivo.
  select c.capienza, c.prenotati, c.piena
    into v_capienza, v_prenotati, v_piena
    from capienza_della_sala(v_p.data_evento) c;
  v_esito_spunta := sincronizza_spunta_sala(v_p.data_evento, p_preventivo_id);
  v_spunta := exists (select 1 from giornate_sold_out where data = v_p.data_evento);

  if v_piena is null then
    v_avvertenze := array_append(v_avvertenze,
      'Non sono riuscito a contare i posti di quella sera: la spunta «sala piena» non l''ho toccata. Guardala tu.');
  end if;

  if v_p.valido_fino_al is not null and v_p.valido_fino_al < oggi_a_roma() then
    v_avvertenze := array_append(v_avvertenze,
      format('Questo preventivo era scaduto il %s: il prezzo che hai promesso e'' quello di allora.',
                to_char(v_p.valido_fino_al, 'DD/MM/YYYY')));
  end if;

  return jsonb_build_object(
    'reservation_id', v_res,
    'sala_piena',     v_spunta,
    'capienza',       v_capienza,
    'prenotati',      v_prenotati,
    'avvertenze',     to_jsonb(v_avvertenze)
  );
end;
$function$;

-- evento_annullato_libera_la_sala
CREATE OR REPLACE FUNCTION public.evento_annullato_libera_la_sala()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_prev   uuid;
  v_tolte  integer := 0;
begin
  if new.status not in ('annullata', 'rifiutata') or old.status = new.status then
    return new;
  end if;

  select id into v_prev
    from preventivi
   where reservation_id = new.id and stato = 'accettato'
   order by accettato_il desc nulls last
   limit 1;
  if v_prev is null then
    return new;
  end if;

  -- ⚠️ Si spegne SOLO la spunta che ha acceso questo preventivo. Quella messa
  -- a mano da Alessio ha `preventivo_id` vuoto e resta dov'e'.
  -- ⚠️ ANCHE QUI SI PASSA DALLA REGOLA UNICA: prima c'era un `delete` suo, e
  -- due posti che decidono della stessa spunta prima o poi la decidono
  -- diversamente. Il risultato non cambia — una cena annullata non risulta
  -- piu' fra le confermate, quindi la sala torna non piena e la spunta del
  -- gestionale se ne va — ma la regola ora e' scritta una volta sola.
  if sincronizza_spunta_sala(new.reservation_date, v_prev) = 'la sala e'' tornata libera' then
    v_tolte := 1;
  else
    v_tolte := 0;
  end if;

  update preventivi set stato = 'annullato'
   where reservation_id = new.id and stato = 'accettato';

  -- ⚠️ Il tipo dell'avviso porta dentro l'evento, altrimenti il freno
  -- anti-tempesta (uno per tipo all'ora) zittirebbe il secondo evento
  -- annullato nella stessa ora. E' la lezione del 13/08 sui rincari: un
  -- freno va tarato su cio' che l'avviso identifica.
  perform segnala_allarme(
    'evento_annullato_' || new.id::text,
    testo_evento_annullato(new.id, v_tolte > 0),
    jsonb_build_object('reservation_id', new.id,
                       'preventivo_id', v_prev,
                       'sala_liberata', v_tolte > 0),
    'evento'
  );

  return new;
end;
$function$;

-- salva_preventivo
CREATE OR REPLACE FUNCTION public.salva_preventivo(p_preventivo_id uuid, p_testata jsonb, p_righe jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id   uuid := p_preventivo_id;
  v_riga jsonb;
  v_i    integer := 0;
  v_gg   integer;
begin
  if not is_titolare() then
    raise exception 'I preventivi sono riservati al titolare.';
  end if;

  if v_id is null then
    select giorni_validita_preventivo into v_gg from service_settings where id = 1;

    insert into preventivi (
      entity_id, versione_di, customer_id, cliente_nome, cliente_telefono,
      cliente_email, data_evento, ora_evento, persone, stato,
      food_cost_obiettivo_percento, prezzo_a_persona_scavalcato, note,
      valido_fino_al
    ) values (
      (p_testata->>'entity_id')::uuid,
      nullif(p_testata->>'versione_di','')::uuid,
      nullif(p_testata->>'customer_id','')::uuid,
      p_testata->>'cliente_nome',
      nullif(p_testata->>'cliente_telefono',''),
      nullif(p_testata->>'cliente_email',''),
      (p_testata->>'data_evento')::date,
      nullif(p_testata->>'ora_evento','')::time,
      (p_testata->>'persone')::integer,
      coalesce(nullif(p_testata->>'stato',''), 'bozza'),
      coalesce(nullif(p_testata->>'food_cost_obiettivo_percento','')::numeric,
               (select s.food_cost_obiettivo_percento from service_settings s where s.id = 1)),
      nullif(p_testata->>'prezzo_a_persona_scavalcato','')::numeric,
      nullif(p_testata->>'note',''),
      coalesce(
        nullif(p_testata->>'valido_fino_al','')::date,
        case when v_gg is not null then oggi_a_roma() + v_gg else null end
      )
    ) returning id into v_id;
  else
    update preventivi set
      customer_id      = nullif(p_testata->>'customer_id','')::uuid,
      cliente_nome     = p_testata->>'cliente_nome',
      cliente_telefono = nullif(p_testata->>'cliente_telefono',''),
      cliente_email    = nullif(p_testata->>'cliente_email',''),
      data_evento      = (p_testata->>'data_evento')::date,
      ora_evento       = nullif(p_testata->>'ora_evento','')::time,
      persone          = (p_testata->>'persone')::integer,
      stato            = coalesce(nullif(p_testata->>'stato',''), stato),
      prezzo_a_persona_scavalcato = nullif(p_testata->>'prezzo_a_persona_scavalcato','')::numeric,
      note             = nullif(p_testata->>'note',''),
      -- ⚠️ In correzione la scadenza si tocca solo se chi chiama la nomina:
      -- una chiave assente vuol dire «non l'ho toccata», non «cancellala».
      valido_fino_al   = case when p_testata ? 'valido_fino_al'
                              then nullif(p_testata->>'valido_fino_al','')::date
                              else valido_fino_al end
     where id = v_id;
    if not found then raise exception 'Questo preventivo non esiste piu''.'; end if;
    delete from preventivo_righe where preventivo_id = v_id;
  end if;

  for v_riga in select * from jsonb_array_elements(coalesce(p_righe, '[]'::jsonb)) loop
    insert into preventivo_righe
      (preventivo_id, natura, recipe_id, descrizione, porzioni_per_persona, quantita, prezzo, posizione)
    values (
      v_id,
      v_riga->>'natura',
      nullif(v_riga->>'recipe_id','')::uuid,
      nullif(v_riga->>'descrizione',''),
      coalesce(nullif(v_riga->>'porzioni_per_persona','')::numeric, 1),
      nullif(v_riga->>'quantita','')::numeric,
      nullif(v_riga->>'prezzo','')::numeric,
      v_i
    );
    v_i := v_i + 1;
  end loop;

  update preventivi
     set costo_cibo = costo_cibo_preventivo(v_id),
         costo_rilevato_il = now()
   where id = v_id;

  -- 🔴 IL QUARTO CASO, uscito dalla misura del 21/08: correggere le persone o
  -- la data su un preventivo GIA' ACCETTATO non arrivava alla cena. Il
  -- preventivo diceva 34 e la sala ne aspettava 10, **senza che niente lo
  -- segnalasse** — e la spunta restava quella del conto vecchio.
  --
  -- ⚠️ La cena si aggiorna solo se il preventivo e' accettato e ne ha una: su
  -- una bozza non c'e' niente da aggiornare. E il conto dei posti si rifa' da
  -- se', perche' il trigger su `reservations` vede la modifica.
  update reservations r
     set party_size       = p.persone,
         reservation_date = p.data_evento,
         reservation_time = coalesce(p.ora_evento, r.reservation_time),
         customer_name    = p.cliente_nome,
         customer_phone   = p.cliente_telefono,
         customer_email   = p.cliente_email
    from preventivi p
   where p.id = v_id and p.stato = 'accettato' and r.id = p.reservation_id;

  return v_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- VERIFICA — i quattro casi del referto, tutti e quattro
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit  uuid; v_ente uuid; v_p uuid; v_res uuid; v_r jsonb;
  v_cap  integer; d1 date; d2 date; d3 date;
  v_lap_p integer; v_lap_d integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_lap_p from deleted_records;
  select id into v_ente from entities order by created_at limit 1;

  -- Tre giorni lontani e distinti: i casi non si devono influenzare fra loro.
  -- E la capienza si CHIEDE, invece di scriverla qui: un numero copiato in una
  -- verifica e' una fotografia travestita da regola (lezione del 16/08).
  d1 := oggi_a_roma() + 300;  d2 := oggi_a_roma() + 301;  d3 := oggi_a_roma() + 302;
  select capienza into v_cap from capienza_della_sala(d1);
  if v_cap is null or v_cap < 4 then
    raise exception 'La sala non si e'' potuta contare: questa verifica non distinguerebbe niente.';
  end if;

  -- ============ A · ACCETTANDO, LA SALA SI SEGNA PIENA ============
  v_p := salva_preventivo(null, jsonb_build_object('entity_id', v_ente,
    'cliente_nome', '__VERIFICA__ riconta', 'data_evento', d1::text,
    'ora_evento', '20:00', 'persone', v_cap), '[]'::jsonb);
  v_r := accetta_preventivo(v_p);
  v_res := (v_r->>'reservation_id')::uuid;
  if not exists (select 1 from giornate_sold_out where data = d1) then
    raise exception 'A · accettato un evento che riempie la sala, la spunta non c''e''.';
  end if;
  if (v_r->>'sala_piena')::boolean is not true then
    raise exception 'A · l''accettazione non dichiara la sala piena.';
  end if;

  -- ============ B · L'EVENTO SI RIMPICCIOLISCE → LA SPUNTA SI SPEGNE ====
  -- 🔴 Prima restava accesa: una serata bloccata per una cena di due persone.
  update reservations set party_size = 2 where id = v_res;
  if exists (select 1 from giornate_sold_out where data = d1) then
    raise exception 'B · l''evento e'' sceso a 2 persone e la sala risulta ancora piena.';
  end if;

  -- ============ C · L'EVENTO SI SPOSTA → DUE VERSI =====================
  update reservations set party_size = v_cap where id = v_res;
  if not exists (select 1 from giornate_sold_out where data = d1) then
    raise exception 'C · tornato pieno, la spunta non e'' ricomparsa.';
  end if;
  update reservations set reservation_date = d2 where id = v_res;
  if exists (select 1 from giornate_sold_out where data = d1) then
    raise exception 'C · spostato di giorno, la spunta e'' rimasta sul giorno VECCHIO.';
  end if;
  -- 🔴 IL VERSO PEGGIORE: senza questo si prendono prenotazioni per una sera
  --    che e' gia' piena.
  if not exists (select 1 from giornate_sold_out where data = d2) then
    raise exception 'C · spostato di giorno, la spunta non e'' comparsa sul giorno NUOVO.';
  end if;

  -- ============ D · CORREGGERE IL PREVENTIVO ARRIVA ALLA CENA ==========
  -- 🔴 Il quarto caso, uscito dalla misura: prima non ci arrivava affatto.
  perform salva_preventivo(v_p, jsonb_build_object('entity_id', v_ente,
    'cliente_nome', '__VERIFICA__ riconta', 'data_evento', d3::text,
    'ora_evento', '21:00', 'persone', 2), '[]'::jsonb);
  if (select party_size from reservations where id = v_res) <> 2 then
    raise exception 'D · corretto il preventivo a 2 persone, la cena ne dice ancora %.',
      (select party_size from reservations where id = v_res);
  end if;
  if (select reservation_date from reservations where id = v_res) <> d3 then
    raise exception 'D · corretta la data sul preventivo, la cena e'' rimasta al giorno vecchio.';
  end if;
  -- ...e il conto si e' rifatto da se': d2 era pieno, adesso non piu'.
  if exists (select 1 from giornate_sold_out where data = d2) then
    raise exception 'D · la cena si e'' spostata ma la sala del giorno vecchio e'' rimasta piena.';
  end if;

  -- ============ E · LA SPUNTA DI ALESSIO NON SI TOCCA MAI ==============
  -- ⚠️ Regola del 20/08, e qui va RIPROVATA: adesso a spegnere e' un trigger,
  --    quindi puo' scattare su gesti che prima non la toccavano.
  insert into giornate_sold_out (data) values (d1);
  perform salva_preventivo(v_p, jsonb_build_object('entity_id', v_ente,
    'cliente_nome', '__VERIFICA__ riconta', 'data_evento', d1::text,
    'ora_evento', '21:00', 'persone', 2), '[]'::jsonb);
  if not exists (select 1 from giornate_sold_out where data = d1 and preventivo_id is null) then
    raise exception 'E · e'' sparita la spunta che aveva messo Alessio a mano.';
  end if;

  -- ============ F · UNA PRENOTAZIONE NORMALE NON TOCCA NIENTE =========
  -- ⚠️ E' IL LIMITE DELLA STRADA 2, e va provato: se non fosse cosi', avremmo
  --    fatto la strada 1 senza dirlo.
  insert into reservations (type, status, source, reservation_date, reservation_time,
                            party_size, customer_name)
  values ('prenotazione', 'confermata', 'interno', d2, '20:00', v_cap, '__VERIFICA__ normale');
  update reservations set party_size = v_cap where customer_name = '__VERIFICA__ normale';
  if exists (select 1 from giornate_sold_out where data = d2) then
    raise exception 'F · una prenotazione NORMALE ha acceso la spunta: questa e'' la strada 1.';
  end if;

  -- =========== PULIZIA ===========
  update preventivi set reservation_id = null where cliente_nome like '__VERIFICA__%';
  delete from giornate_sold_out where data in (d1, d2, d3);
  delete from preventivo_fogli where preventivo_id in
    (select id from preventivi where cliente_nome like '__VERIFICA__%');
  delete from preventivo_righe where preventivo_id in
    (select id from preventivi where cliente_nome like '__VERIFICA__%');
  delete from preventivi where cliente_nome like '__VERIFICA__%';
  delete from reservations where customer_name like '__VERIFICA__%';

  if exists (select 1 from preventivi where cliente_nome like '__VERIFICA__%')
     or exists (select 1 from reservations where customer_name like '__VERIFICA__%') then
    raise exception 'La verifica ha lasciato delle righe finte.';
  end if;
  select count(*) into v_lap_d from deleted_records;
  if v_lap_d <> v_lap_p then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lap_d - v_lap_p;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'La capienza si riconta: persone, giorno, e la correzione del preventivo arriva alla cena.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260821000002', 'la_capienza_si_riconta')
on conflict (version) do nothing;
