-- «NON SI È PRESENTATO» DIVENTA UNO STATO — 22/08/2026.
--
-- 🔴 IL DIFETTO, trovato costruendo i due mesi finti: il database rifiuta
-- `no_show`, e gli stati erano cinque — `richiesta_in_attesa`, `confermata`,
-- `servita`, `rifiutata`, `annullata`. Chi si presenta diventa **servita**
-- da sé quando il conto si chiude (21/08); **chi non si presenta resta
-- «confermata» per sempre**, e il gestionale non sa distinguerlo da un conto
-- che qualcuno si è dimenticato di chiudere.
--
-- ⚠️ E le due cose portano a gesti opposti: uno è un cliente che non è
-- venuto (e domani vale la pena saperlo, quando ci saranno le note sui
-- clienti che Alessio ha chiesto), l'altro è un conto da sistemare in Cassa.
-- Confonderli non è impreciso: è **non poter più separare due fatti**.
--
-- ⚠️ QUI SI COSTRUISCE SOLO LO STATO. Le note sui clienti — dove chi non si
-- presenta finirà — sono un lavoro a sé, e il mandato dice esplicitamente
-- di non farle adesso.

-- ---------------------------------------------------------------------
-- 1. Il valore nuovo
--
-- ⚠️ `alter type` STA SU UNA RIGA SUA e fuori da qualunque blocco, ed è la
-- lezione misurata il 19/08 nei due versi: dentro un `do $$` fallirebbe con
-- *«new enum values must be committed before they can be used»*, ma in un
-- file applicato da psql — dove ogni istruzione si chiude da sé — è già
-- committato quando il blocco successivo lo adopera. **Una migrazione sola
-- basta**, purché l'`alter type` non stia dentro lo stesso blocco che poi
-- lo usa.
-- ---------------------------------------------------------------------
alter type reservation_status add value if not exists 'non_presentata';

-- ---------------------------------------------------------------------
-- 2. Chi ha smesso di aspettare non occupa più un posto
--
-- ⚠️ `capienza_della_sala` conta gli attesi con `status = 'confermata'`, e
-- questo BASTA: una «non presentata» esce dal conteggio **da sé**, senza che
-- si tocchi niente. È la stessa proprietà per cui una servita non conta.
--
-- 🔴 E LA SPUNTA «SALA PIENA» SEGUE, misurato e non dedotto: il trigger
-- `trg_cena_cambiata` scatta anche sul cambio di `status`, rilegge la
-- capienza e chiama `sincronizza_spunta_sala` — che è l'unico posto dove
-- quella spunta si accende e si spegne. Segnando «non presentata» una cena
-- da preventivo, se la sala non è più piena la spunta **si spegne da sola**.
-- ⚠️ Per le prenotazioni normali quella sincronizzazione non c'è mai stata,
-- ed è una scelta del 21/08 che questo blocco non tocca.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 3. La serata continua a vedersi per intero
--
-- ⚠️ IL CORPO QUI SOTTO E' STATO PRESO DAL DATABASE (`npm run funzione:viva`)
-- e modificato in DUE RIGHE, non riscritto dal file che l'aveva creata: fra
-- i due ci stanno tutte le migrazioni che l'hanno toccata dopo. Riscrivendola
-- dalla migrazione del 21/08 avrei annullato in silenzio le colonne
-- `servizio` e `turno_dopo_di`, che li' non c'erano — e infatti il primo
-- tentativo si e' fermato con «cannot change return type of existing
-- function». E' la regola del 18/08, e stavolta se n'e' accorto Postgres.
-- ---------------------------------------------------------------------
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

revoke all on function turni_del_giorno(date) from public, anon;
grant execute on function turni_del_giorno(date) to authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $$
declare
  d        date := current_date + 210;   -- lontano da qualunque dato vero
  v_r      uuid;
  v_attesi integer;
  v_prima  integer;
  v_serv   boolean;
begin
  -- A · una prenotazione confermata conta fra gli attesi.
  insert into reservations (status, source, reservation_date, reservation_time, party_size, customer_name)
  values ('confermata','interno', d, '20:00', 4, '__VERIFICA__ no show')
  returning id into v_r;

  select prenotati into v_prima from capienza_della_sala(d);
  if coalesce(v_prima, 0) < 4 then
    raise exception 'A · una confermata da 4 non risulta fra gli attesi (sono %).', v_prima;
  end if;

  -- B · segnata «non presentata», SMETTE di occupare posti.
  update reservations set status = 'non_presentata' where id = v_r;
  select prenotati into v_attesi from capienza_della_sala(d);
  if v_attesi <> v_prima - 4 then
    raise exception 'B · una non presentata occupa ancora il posto: attesi prima %, dopo %.', v_prima, v_attesi;
  end if;

  -- C · ma resta VISIBILE nella serata, e marcata «non più attesa».
  if not exists (select 1 from turni_del_giorno(d) where reservation_id = v_r) then
    raise exception 'C · la non presentata e'' sparita dall''elenco della serata.';
  end if;
  select servita into v_serv from turni_del_giorno(d) where reservation_id = v_r;
  if not v_serv then
    raise exception 'C · la non presentata risulta ancora attesa: terrebbe il tavolo colorato e il ritardo acceso.';
  end if;

  -- D · ⚠️ LA CONTROPROVA CHE DISCRIMINA: una CONFERMATA deve restare
  --     attesa. Senza, un campo che dicesse sempre «vero» passerebbe C.
  update reservations set status = 'confermata' where id = v_r;
  select servita into v_serv from turni_del_giorno(d) where reservation_id = v_r;
  if v_serv then
    raise exception 'D · una confermata risulta «non piu'' attesa»: il campo non distingue niente.';
  end if;

  -- E · e il trigger che marca «servita» alla chiusura di un conto NON
  --     riprende una non presentata: guarda solo le confermate, e va bene
  --     cosi' — chi non e' venuto non puo' aver mangiato.
  update reservations set status = 'non_presentata' where id = v_r;

  delete from reservations where id = v_r;
  raise notice 'Verifica passata: la non presentata non occupa posti, resta visibile, e una confermata continua a essere attesa.';
end $$;

insert into applied_migrations (version, name)
values ('20260822000004', 'non_si_e_presentato') on conflict (version) do nothing;
