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
       and r.status in ('confermata', 'servita')
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
         s.id_dopo,
         c.status = 'servita'
    from con_servizio c
    join seguente s on s.id = c.id
   cross join impostazioni i
   order by c.ora;
$function$;
