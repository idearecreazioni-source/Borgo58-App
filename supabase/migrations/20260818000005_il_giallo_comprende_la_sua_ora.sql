-- ---------------------------------------------------------------------
-- Il giallo comprende la propria ora
-- ---------------------------------------------------------------------
-- Precisazione di Alessio del 18/08/2026, arrivata dando gli orari veri:
-- il primo turno e' **fino all'ora del primo turno COMPRESA**.
--
-- ⚠️ PERCHE' CAMBIA QUALCOSA, e non e' un cavillo. Coi suoi orari il primo
-- slot prenotabile COINCIDE con l'ora del primo turno — cena dalle 20:00
-- con primo turno alle 20:00, pranzo dalle 12:30 con primo turno alle
-- 12:30. Con la regola stretta (`ora < primo_turno`) **il giallo non
-- toccherebbe mai nessuno**: la fascia esisterebbe nel codice e sarebbe
-- vuota per costruzione, che e' il modo peggiore di sbagliare — tutto
-- acceso, e muto.
-- Con `<=` il giallo vale per il primo slot ed e' esattamente quello che
-- lui ha confermato: *«il giallo vale solo per le 20:00 esatte»*.
--
-- Idempotente (§7 punto 3). Si auto-registra (§7 punto 4).

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
           when c.primo_turno is null then 'pieno'
           -- ⚠️ `<=` e non `<`: il primo turno COMPRENDE la propria ora.
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
-- VERIFICA
-- =====================================================================
-- ⚠️ Si prova IL BORDO, che e' il solo punto in cui questa migrazione
-- cambia qualcosa: un arrivo ESATTAMENTE all'ora del primo turno. Prima
-- era «pieno», adesso e' «presto». Provare un'ora qualsiasi non
-- distinguerebbe le due versioni — misurerebbe una coincidenza.
do $verifica$
declare
  d          date := date '1995-06-07';  -- mercoledi'
  cena_prima boolean;
  ora_prima  time;
  t1         uuid;
  r_bordo    uuid;
  r_dopo     uuid;
  v_fascia   text;
  n          integer;
begin
  select count(*) into n from reservations where reservation_date = d;
  if n <> 0 then raise exception 'La data di prova % non e'' libera.', d; end if;

  select attivo, ora_primo_turno into cena_prima, ora_prima
    from service_hours where weekday = 3 and servizio = 'cena';
  if cena_prima is null then raise exception 'Manca la riga di orario del mercoledi'' sera.'; end if;

  update service_hours set attivo = true, ora_primo_turno = '20:00'
   where weekday = 3 and servizio = 'cena';

  select id into t1 from dining_tables where tipo = 'tavolo' and active order by label limit 1;

  alter table reservations disable trigger trg_notify_reservation_telegram;

  insert into reservations (type, status, source, reservation_date, reservation_time, party_size, customer_name)
  values ('prenotazione', 'confermata', 'interno', d, '20:00', 2, 'VERIFICA bordo') returning id into r_bordo;
  insert into reservations (type, status, source, reservation_date, reservation_time, party_size, customer_name)
  values ('prenotazione', 'confermata', 'interno', d, '20:15', 2, 'VERIFICA dopo') returning id into r_dopo;
  insert into prenotazione_tavoli (reservation_id, dining_table_id, etichetta_al_momento)
  select r_bordo, t1, label from dining_tables where id = t1;

  select fascia into v_fascia from turni_del_giorno(d) where reservation_id = r_bordo;
  if v_fascia <> 'presto' then
    raise exception 'Un arrivo ALL''ORA del primo turno doveva essere «presto» (il giallo comprende la sua ora), ed e'' «%».', v_fascia;
  end if;

  -- ⚠️ E il minuto DOPO non deve esserlo: senza questa, un `<=` diventato
  -- per sbaglio un confronto sempre vero passerebbe la prova di sopra.
  select fascia into v_fascia from turni_del_giorno(d) where reservation_id = r_dopo;
  if v_fascia <> 'pieno' then
    raise exception 'Un arrivo un quarto d''ora DOPO il primo turno doveva essere «pieno», ed e'' «%».', v_fascia;
  end if;

  delete from reservations where reservation_date = d;
  update service_hours set attivo = cena_prima, ora_primo_turno = ora_prima
   where weekday = 3 and servizio = 'cena';

  alter table reservations enable trigger trg_notify_reservation_telegram;
  if (select tgenabled from pg_trigger t join pg_class c on c.oid = t.tgrelid
       where c.relname = 'reservations' and t.tgname = 'trg_notify_reservation_telegram') <> 'O' then
    raise exception 'Il trigger delle notifiche e'' rimasto spento.';
  end if;

  select count(*) into n from reservations where customer_name like 'VERIFICA%';
  if n <> 0 then raise exception 'Restano % prenotazioni di prova.', n; end if;

  raise notice 'Il giallo comprende la propria ora, e il quarto d''ora dopo no.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260818000005', 'il_giallo_comprende_la_sua_ora')
on conflict (version) do nothing;
