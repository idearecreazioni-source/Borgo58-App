-- ---------------------------------------------------------------------
-- Gli orari veri di Alessio, l'ora degli ultimi arrivi, e il passo
-- ---------------------------------------------------------------------
-- Coda del giro C, 18/08/2026. Tre cose che stanno insieme perche' le mani
-- sono gia' sugli orari: separarle vorrebbe dire riaprire lo stesso posto
-- fra due giorni.
--
-- Idempotente (§7 punto 3). Si auto-registra (§7 punto 4).

-- =====================================================================
-- 1. «DA CHE ORA E' ULTIMO ARRIVO» — e non chiude niente
-- =====================================================================
-- ⚠️ IL MALINTESO DA CUI NASCE, scritto perche' tornera'. `ultimo_ingresso`
-- faceva UN lavoro solo — *fin quando il sito offre orari* — e i numeri di
-- Alessio ne chiedono DUE: la cena e' prenotabile fino alle **22:30**, ma
-- il tavolo e' arancio gia' dalle **22:00** (22:00 · 22:15 · 22:30). Con
-- una casella sola bisognava scegliere fra offrire meno orari e colorare
-- meno tavoli.
--
-- ⚠️ E IL NOME DELLA COLONNA DEVE DIRE CHE NON CHIUDE NIENTE. Alle 22:30 si
-- prenota, si arriva e si viene serviti: quest'ora serve **solo a colorare
-- il tavolo sulla pianta**. Un nome che somigliasse a una chiusura
-- (`ora_limite`, `fine_servizio`) farebbe si' che fra tre mesi qualcuno la
-- usi per impedire qualcosa — ed e' la stessa forma del «verde avvisa, non
-- blocca» che questo mandato ripete da tre giri.
--
-- ⚠️ FACOLTATIVA, e vuota vuol dire «quanto l'ultimo orario prenotabile».
-- E' il caso del pranzo, dove i due numeri coincidono. Renderla
-- obbligatoria vorrebbe dire, nel caso normale, ripetere un altro campo —
-- cioe' il doppione che poi si contraddice.
alter table service_hours
  add column if not exists ora_ultimi_arrivi time;

comment on column service_hours.ora_ultimi_arrivi is
  'Da che ora un arrivo e'' «ultimo giro» (arancio sulla pianta). NON chiude niente: dopo quest''ora si prenota, si arriva e si viene serviti — serve solo a colorare il tavolo. Vuota = vale quanto ultimo_ingresso.';

-- =====================================================================
-- 2. IL PASSO DEGLI ORARI — un numero di Alessio nel posto giusto
-- =====================================================================
-- Era scritto dentro `public_reservation_options` (`interval '15 minutes'`).
-- E' un dato suo come la soglia dei 25 e le 5 del mattino: sta accanto a
-- loro. E serve anche alla difesa del punto 4, che senza non potrebbe
-- sapere quale griglia far rispettare.
alter table service_settings
  add column if not exists passo_prenotazioni_minuti integer not null default 15;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'service_settings_passo_check') then
    alter table service_settings add constraint service_settings_passo_check
      check (passo_prenotazioni_minuti between 5 and 120 and 60 % passo_prenotazioni_minuti = 0);
  end if;
end $$;

comment on column service_settings.passo_prenotazioni_minuti is
  'Ogni quanti minuti il sito propone un orario. Deve dividere l''ora esatta, altrimenti la griglia si sposterebbe di ora in ora.';

-- =====================================================================
-- 3. GLI ORARI VERI, dichiarati da Alessio il 18/08 — una volta sola
-- =====================================================================
-- ⚠️ SI APPLICA UNA VOLTA E BASTA, e la guardia e' il registro delle
-- migrazioni. Questi sono DATI SUOI: rieseguirli a ogni riapplicazione
-- riporterebbe indietro un orario che ha cambiato dalla schermata — cioe'
-- lo stesso difetto del giro A, dove una ricostruzione gli buttava via la
-- sala.
do $orari$
declare
  n_cena   integer;
  n_pranzo integer;
begin
  if exists (select 1 from applied_migrations where version = '20260818000006') then
    raise notice 'Gli orari veri sono gia'' stati messi: non si sovrascrive cio'' che Alessio ha cambiato dopo.';
    return;
  end if;

  update service_hours
     set apertura = '20:00', ultimo_ingresso = '22:30',
         ora_primo_turno = '20:00', ora_ultimi_arrivi = '22:00'
   where servizio = 'cena';
  get diagnostics n_cena = row_count;

  -- ⚠️ A pranzo i due numeri COINCIDONO, quindi `ora_ultimi_arrivi` resta
  -- vuota: non si scrive un valore che ripete quello accanto.
  update service_hours
     set apertura = '12:30', ultimo_ingresso = '14:00',
         ora_primo_turno = '12:30', ora_ultimi_arrivi = null
   where servizio = 'pranzo';
  get diagnostics n_pranzo = row_count;

  raise notice 'Orari veri: % righe di cena (20:00 → 22:30, primo giro 20:00, ultimi arrivi 22:00) e % di pranzo (12:30 → 14:00, primo giro 12:30).', n_cena, n_pranzo;
end $orari$;

-- =====================================================================
-- 4. LE FASCE LEGGONO L'ORA DEGLI ULTIMI ARRIVI
-- =====================================================================
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
         case
           when c.inizio_ultimi is not null and c.ora >= c.inizio_ultimi then 'tardi'
           when c.primo_turno is null then 'pieno'
           when c.ora <= c.primo_turno then 'presto'
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

revoke all on function turni_del_giorno(date) from public, anon, authenticated;
grant execute on function turni_del_giorno(date) to authenticated;

-- =====================================================================
-- 5. IL SITO PROPONE GLI ORARI COL PASSO DI ALESSIO
-- =====================================================================
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

  if not coalesce(v_attivo, false) then
    return jsonb_build_object('attivo', false, 'sold_out', false, 'orari', v_orari);
  end if;

  if p_date is null or p_date < v_oggi or p_date > v_oggi + v_giorni then
    return jsonb_build_object('attivo', true, 'chiuso', true, 'sold_out', false,
      'motivo', 'Per questa data non prendiamo ancora prenotazioni online.', 'orari', v_orari);
  end if;

  select motivo into v_motivo from service_closures
   where p_date between dal and al
   order by dal limit 1;
  if found then
    return jsonb_build_object('attivo', true, 'chiuso', true, 'sold_out', false,
      'motivo', coalesce(nullif(trim(v_motivo), ''), 'Quel giorno siamo chiusi.'), 'orari', v_orari);
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

-- =====================================================================
-- 6. IL BUCO DELLE 20:07 — la griglia difesa dove si entra da fuori
-- =====================================================================
-- ⚠️ IL RILIEVO. La finestra oraria era difesa nel database
-- (`submit_public_reservation` controlla apertura → ultimo ingresso), ma
-- **il passo no**: chi inviava a mano le 20:07 passava. E' la stessa forma
-- del vocabolario chiuso in tre posti — la schermata offre un elenco, e
-- chi non passa dalla schermata non e' tenuto a rispettarlo.
--
-- ⚠️ VALE SOLO PER IL VARCO PUBBLICO, ed e' voluto: dalla pianta Alessio
-- deve poter scrivere le 20:07 se un cliente arriva alle 20:07. Il freno
-- sta dove sta il rischio — su un indirizzo pubblico l'invio automatico e'
-- la norma, non l'eccezione (§6 del CLAUDE.md).
--
-- ⚠️ Ed e' un TRIGGER e non un controllo dentro la funzione: difende la
-- TABELLA, quindi vale anche per una funzione futura che dimenticasse il
-- controllo.
create or replace function vieta_orario_fuori_griglia()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_passo integer;
begin
  if new.source <> 'form_pubblico' then
    return new;
  end if;
  select passo_prenotazioni_minuti into v_passo from service_settings where id = 1;
  if v_passo is null then return new; end if;

  if extract(second from new.reservation_time) <> 0
     or (extract(hour from new.reservation_time)::integer * 60
         + extract(minute from new.reservation_time)::integer) % v_passo <> 0 then
    raise exception 'Quell''orario non e'' fra quelli che proponiamo. Scegline uno dall''elenco, oppure chiamaci.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_orario_sulla_griglia on reservations;
create trigger trg_orario_sulla_griglia
  before insert or update of reservation_time on reservations
  for each row execute function vieta_orario_fuori_griglia();

revoke all on function vieta_orario_fuori_griglia() from public, anon, authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  d          date := date '1995-06-07';  -- mercoledi'
  cena_prima record;
  t1         uuid;
  r_off      uuid;
  r_ultimo   uuid;
  v_fascia   text;
  v_orari    jsonb;
  n          integer;
  rifiutato  boolean := false;
begin
  select count(*) into n from reservations where reservation_date = d;
  if n <> 0 then raise exception 'La data di prova % non e'' libera.', d; end if;

  select attivo, apertura, ultimo_ingresso, ora_primo_turno, ora_ultimi_arrivi
    into cena_prima from service_hours where weekday = 3 and servizio = 'cena';
  if cena_prima is null then raise exception 'Manca la riga del mercoledi'' sera.'; end if;

  update service_hours
     set attivo = true, apertura = '20:00', ultimo_ingresso = '22:30',
         ora_primo_turno = '20:00', ora_ultimi_arrivi = '22:00'
   where weekday = 3 and servizio = 'cena';

  select id into t1 from dining_tables where tipo = 'tavolo' and active order by label limit 1;

  alter table reservations disable trigger trg_notify_reservation_telegram;

  -- --- L'arancio comincia PRIMA dell'ultimo orario prenotabile ---
  -- ⚠️ E' il caso per cui esiste questa migrazione: le 22:00 devono essere
  -- «tardi» anche se si prenota fino alle 22:30. Con una casella sola
  -- questa prova sarebbe impossibile da far passare senza togliere le
  -- 22:15 e le 22:30 dal sito.
  insert into reservations (type, status, source, reservation_date, reservation_time, party_size, customer_name)
  values ('prenotazione', 'confermata', 'interno', d, '22:00', 2, 'VERIFICA ultimi') returning id into r_off;
  insert into reservations (type, status, source, reservation_date, reservation_time, party_size, customer_name)
  values ('prenotazione', 'confermata', 'interno', d, '21:45', 2, 'VERIFICA prima') returning id into r_ultimo;

  select fascia into v_fascia from turni_del_giorno(d) where reservation_id = r_off;
  if v_fascia <> 'tardi' then
    raise exception 'Le 22:00 dovevano essere «tardi» (ultimi arrivi), e sono «%».', v_fascia;
  end if;
  select fascia into v_fascia from turni_del_giorno(d) where reservation_id = r_ultimo;
  if v_fascia <> 'pieno' then
    raise exception 'Le 21:45, prima degli ultimi arrivi, dovevano essere «pieno», e sono «%».', v_fascia;
  end if;

  -- --- Il sito propone col passo delle impostazioni ---
  -- ⚠️ Si prova cambiando il passo e guardando se l'elenco cambia: con un
  -- passo solo non si distinguerebbe un numero letto da uno scritto dentro.
  update service_settings set passo_prenotazioni_minuti = 30 where id = 1;
  v_orari := public_reservation_options(d, 2) -> 'orari';
  if v_orari @> '["20:15"]'::jsonb then
    raise exception 'Col passo a 30 minuti il sito propone ancora le 20:15: il passo non viene dalle impostazioni.';
  end if;
  update service_settings set passo_prenotazioni_minuti = 15 where id = 1;

  -- --- E la griglia e' difesa dove si entra da fuori ---
  begin
    insert into reservations (type, status, source, reservation_date, reservation_time, party_size, customer_name)
    values ('prenotazione', 'richiesta_in_attesa', 'form_pubblico', d, '20:07', 2, 'VERIFICA fuori griglia');
  exception when sqlstate 'P0001' then
    rifiutato := true;
  end;
  if not rifiutato then
    raise exception 'Un orario fuori griglia inviato dal varco pubblico e'' stato accettato.';
  end if;

  -- ⚠️ E dalla pianta le 20:07 devono ancora passare: il freno sta dove
  -- sta il rischio, non addosso a chi risponde al telefono.
  insert into reservations (type, status, source, reservation_date, reservation_time, party_size, customer_name)
  values ('prenotazione', 'confermata', 'interno', d, '20:07', 2, 'VERIFICA interna fuori griglia');

  -- --- Pulizia e perimetro ---
  delete from reservations where reservation_date = d;
  update service_hours
     set attivo = cena_prima.attivo, apertura = cena_prima.apertura,
         ultimo_ingresso = cena_prima.ultimo_ingresso,
         ora_primo_turno = cena_prima.ora_primo_turno,
         ora_ultimi_arrivi = cena_prima.ora_ultimi_arrivi
   where weekday = 3 and servizio = 'cena';

  alter table reservations enable trigger trg_notify_reservation_telegram;
  if (select tgenabled from pg_trigger t join pg_class c on c.oid = t.tgrelid
       where c.relname = 'reservations' and t.tgname = 'trg_notify_reservation_telegram') <> 'O' then
    raise exception 'Il trigger delle notifiche e'' rimasto spento.';
  end if;

  select count(*) into n from reservations where customer_name like 'VERIFICA%';
  if n <> 0 then raise exception 'Restano % prenotazioni di prova.', n; end if;
  if (select passo_prenotazioni_minuti from service_settings where id = 1) <> 15 then
    raise exception 'Il passo non e'' tornato a 15.';
  end if;

  raise notice 'Ultimi arrivi separati dall''ultimo orario prenotabile, passo dalle impostazioni, griglia difesa sul varco pubblico.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260818000006', 'gli_orari_veri_e_il_passo')
on conflict (version) do nothing;
