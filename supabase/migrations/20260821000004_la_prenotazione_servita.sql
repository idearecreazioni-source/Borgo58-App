-- =====================================================================
-- LA PRENOTAZIONE SERVITA
-- 21/08/2026
-- =====================================================================
-- 🔴 DIFETTO TROVATO DA ALESSIO col tablet: chiudendo il conto di un tavolo
-- prenotato, il tavolo **torna «prenotato»** invece di liberarsi. Misurato:
-- gli stati erano quattro — `richiesta_in_attesa`, `confermata`,
-- `rifiutata`, `annullata` — e nessuno dice «è venuto, ha mangiato, se n'è
-- andato». Una prenotazione onorata restava `confermata` per sempre.
--
-- ⚠️ E MORDE DOVE FA PIÙ MALE: il «primo giro» esiste apposta perché il
-- tavolo possa servire **due volte**. Con la prenotazione delle 20:00 che
-- resta confermata all'infinito, quel tavolo non torna mai disponibile per
-- la sera — cioè si perde precisamente la cosa per cui le fasce sono state
-- costruite.
--
-- 🔴 LA REGOLA, DECISA DA ALESSIO E SCRITTA COME L'HA DETTA:
--
--     IL TAVOLO MOSTRA LA FASCIA CHE DEVE ANCORA ARRIVARE,
--     NON QUELLA GIÀ PASSATA.
--
-- ⚠️ È scritta così perché **copre anche i casi che non abbiamo nominato**.
-- I due nominati: a conto chiuso il tavolo torna libero; ma se su quel
-- tavolo c'è una SECONDA prenotazione, non torna bianco — perde il giallo
-- del primo giro e resta il rosso dell'ultimo turno. La regola li produce
-- entrambi senza doverli elencare.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1 · LO STATO NUOVO
-- ---------------------------------------------------------------------
-- ⚠️ SU UNA RIGA SUA, e non dentro il blocco che poi lo usa: un valore
-- aggiunto a un enum non è utilizzabile nella stessa TRANSAZIONE in cui
-- nasce. Applicato da `psql`, dove ogni istruzione si chiude da sé, questo
-- `alter` è già committato quando i blocchi sotto lo adoperano (misurato il
-- 19/08 in tutti e due i versi).
alter type reservation_status add value if not exists 'servita';


-- ---------------------------------------------------------------------
-- 2 · CHI CONTA I POSTI NON CONTA CHI SE N'È GIÀ ANDATO
-- ---------------------------------------------------------------------
-- 🔴 CONSEGUENZA DICHIARATA, e non è un dettaglio: da qui passa la spunta
-- «sala piena». Una prenotazione servita che smette di contare fa SCENDERE i
-- prenotati, quindi una sala che risultava piena può tornare non piena — e
-- **la spunta si spegne da sola**.
--
-- ⚠️ È corretto (quei posti si sono davvero liberati) e succede **senza che
-- nessuno lo chieda**, perché il trigger `trg_cena_cambiata` del 21/08
-- ricalcola quando cambia lo stato di una prenotazione. Ma va scritto: è il
-- genere di effetto che fra sei mesi sembra un guasto.
--
-- ⚠️ Riscritta dal corpo VIVO letto dal database, non dal file che l'ha
-- creata (regola del 18/08).
create or replace function capienza_della_sala(p_data date)
returns table(capienza integer, prenotati integer, piena boolean)
language sql
stable
security definer
set search_path = public
as $fn$
  with posti as (
    select sum(c.coperti)::integer as tot, count(*) as gruppi
      from coperti_del_giorno(p_data) c
  ),
  attesi as (
    select coalesce(sum(r.party_size), 0)::integer as tot
      from reservations r
     where r.reservation_date = p_data
       -- ⚠️ SOLO CHI DEVE ANCORA ARRIVARE. Le servite hanno liberato il
       -- posto: contarle terrebbe la sala piena per gente andata a casa.
       and r.status = 'confermata'
  )
  select case when posti.gruppi = 0 then null else posti.tot end,
         attesi.tot,
         case when posti.gruppi = 0 then null else attesi.tot >= posti.tot end
    from posti, attesi;
$fn$;

-- 🔴 NESSUN `grant`, E CI È VOLUTA UNA PROVA ROSSA PER ACCORGERSENE.
-- Riscrivendola avevo aggiunto `grant execute … to authenticated`, dando per
-- scontato che servisse. **In produzione quella funzione non è eseguibile da
-- nessuno**: la chiamano solo altre funzioni, dall'interno. Il mio `grant`
-- l'avrebbe aperta allo staff — cioè avrebbe fatto vedere a chi sta in sala
-- quanti posti restano, che è una decisione che nessuno ha preso.
--
-- ⚠️ L'ha trovato `tests/app/permessi.test.js`, che elenca per nome le
-- funzioni che scavalcano la RLS senza chiedere chi sei: `capienza_della_sala`
-- è comparsa in quell'elenco e la prova è diventata rossa. **È esattamente il
-- lavoro per cui quella rete è stata scritta il 19/08.**
revoke all on function capienza_della_sala(date) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 3 · LA SERATA PORTA ANCHE CHI È GIÀ STATO SERVITO, E LO DICE
-- ---------------------------------------------------------------------
-- ⚠️ NON si tolgono dall'elenco: chi sta in sala deve poter vedere che quel
-- tavolo ha già avuto il suo primo giro — è la storia della serata, e
-- toglierla farebbe sembrare che nessuno sia mai venuto.
--
-- ⚠️ Quello che cambia è che **portano un segno**, e chi disegna la sala usa
-- quello per applicare la regola di Alessio. La regola sta in
-- `src/lib/calcoli/ritardo.js`, non qui: il database dice cosa è successo,
-- la schermata decide cosa mostrare.
-- ⚠️ SI CANCELLA E SI RICREA, non basta `create or replace`: una colonna in
-- più nel risultato è un TIPO DI RITORNO diverso, e Postgres lo rifiuta
-- («cannot change return type of existing function»).
--
-- ⚠️ E DOPO UN `drop` I PERMESSI TORNANO APERTI AL MONDO — è la trappola
-- dell'11/08: una funzione appena creata è eseguibile da chiunque abbia la
-- chiave anonima, che è pubblica. Il `revoke` qui sotto non è una formalità,
-- e la verifica lo controlla invece di darlo per fatto.
drop function if exists turni_del_giorno(date);

create function turni_del_giorno(p_data date)
returns table(
  reservation_id uuid,
  ora time without time zone,
  servizio text,
  fascia text,
  tavoli uuid[],
  etichette text[],
  liberare_entro time without time zone,
  turno_dopo_di uuid,
  servita boolean
)
language sql
stable
set search_path = public
as $fn$
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
$fn$;

revoke all on function turni_del_giorno(date) from public, anon, authenticated;
grant execute on function turni_del_giorno(date) to authenticated;


-- ---------------------------------------------------------------------
-- 4 · CHIUDERE UN CONTO SEGNA SERVITA LA SUA PRENOTAZIONE
-- ---------------------------------------------------------------------
-- ⚠️ IL LEGAME ESISTE GIÀ dal giro D1 (18/08) e vale per TUTTE le
-- prenotazioni, non solo per quelle nate da un preventivo: `apri_conto`
-- aggancia la confermata di quella serata con l'ora più vicina. Qui non si
-- costruisce nessun legame nuovo — si usa quello.
--
-- ⚠️ Il trigger sta su `orders` e guarda il passaggio a `chiuso`, così vale
-- per **tutte** le strade che chiudono un conto — incassato, scontato,
-- omaggiato — senza doverle elencare. Elencarle vorrebbe dire dimenticarne
-- una il giorno che se ne aggiunge la quarta.
--
-- ⚠️ E un conto ANNULLATO non serve niente: per tutto il resto del
-- gestionale è un conto che non è mai esistito (regola del giro D2).
create or replace function conto_chiuso_prenotazione_servita()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.status = 'chiuso'
     and old.status is distinct from 'chiuso'
     and new.reservation_id is not null then
    update reservations
       set status = 'servita'
     where id = new.reservation_id
       and status = 'confermata';
  end if;
  return new;
end;
$fn$;

revoke all on function conto_chiuso_prenotazione_servita() from public, anon, authenticated;

drop trigger if exists trg_conto_chiuso_servita on orders;
create trigger trg_conto_chiuso_servita
  after update on orders
  for each row execute function conto_chiuso_prenotazione_servita();


-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit uuid; v_ente uuid; v_t uuid; v_r1 uuid; v_r2 uuid; v_o uuid;
  d date; v_cap integer; v_pren integer; v_n integer;
  v_lap_p integer; v_lap_d integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_lap_p from deleted_records;
  select id into v_ente from entities order by created_at limit 1;
  select id into v_t from dining_tables where tipo = 'tavolo' order by label limit 1;
  d := oggi_a_roma() + 320;

  -- ====== A · UNA PRENOTAZIONE CONFERMATA CONTA ======
  insert into reservations (type, status, source, reservation_date, reservation_time,
                            party_size, customer_name)
  values ('prenotazione','confermata','interno', d, '20:00', 4, '__VERIFICA__ servita')
  returning id into v_r1;
  insert into prenotazione_tavoli (reservation_id, dining_table_id, etichetta_al_momento)
  values (v_r1, v_t, 'X');

  select prenotati into v_pren from capienza_della_sala(d);
  if v_pren <> 4 then
    raise exception 'A · i prenotati dovrebbero essere 4, sono %.', v_pren;
  end if;

  -- ====== B · CHIUDENDO IL CONTO DIVENTA SERVITA ======
  insert into orders (entity_id, status, table_label, reservation_id)
  values (v_ente, 'aperto', 'X', v_r1) returning id into v_o;
  update orders set status = 'chiuso', closed_at = now() where id = v_o;

  if (select status from reservations where id = v_r1) <> 'servita' then
    raise exception 'B · chiuso il conto, la prenotazione risulta ancora %.',
      (select status from reservations where id = v_r1);
  end if;

  -- ====== C · E SMETTE DI CONTARE: la sala si libera ======
  -- 🔴 È l'effetto che il difetto di Alessio rendeva impossibile.
  select prenotati into v_pren from capienza_della_sala(d);
  if v_pren <> 0 then
    raise exception 'C · servita, i prenotati dovrebbero essere 0, sono %.', v_pren;
  end if;

  -- ====== D · MA RESTA NELL'ELENCO DELLA SERATA, MARCATA ======
  -- ⚠️ Toglierla farebbe sembrare che nessuno sia mai venuto.
  select count(*) into v_n from turni_del_giorno(d) where reservation_id = v_r1;
  if v_n <> 1 then
    raise exception 'D · la servita è sparita dall''elenco della serata.';
  end if;
  if not (select servita from turni_del_giorno(d) where reservation_id = v_r1) then
    raise exception 'D · la servita non è marcata come tale.';
  end if;

  -- ====== E · UN CONTO ANNULLATO NON SERVE NIENTE ======
  insert into reservations (type, status, source, reservation_date, reservation_time,
                            party_size, customer_name)
  values ('prenotazione','confermata','interno', d, '22:15', 2, '__VERIFICA__ annullato')
  returning id into v_r2;
  insert into orders (entity_id, status, table_label, reservation_id)
  values (v_ente, 'aperto', 'X', v_r2) returning id into v_o;
  update orders set status = 'annullato' where id = v_o;
  if (select status from reservations where id = v_r2) <> 'confermata' then
    raise exception 'E · un conto ANNULLATO ha segnato servita la prenotazione.';
  end if;

  -- ====== F · E UNA GIÀ SERVITA NON TORNA INDIETRO ======
  -- Il filtro `and status = 'confermata'` nell'update esiste per questo.
  update reservations set status = 'servita' where id = v_r2;
  insert into orders (entity_id, status, table_label, reservation_id)
  values (v_ente, 'aperto', 'X', v_r2) returning id into v_o;
  update orders set status = 'chiuso', closed_at = now() where id = v_o;
  if (select status from reservations where id = v_r2) <> 'servita' then
    raise exception 'F · lo stato è cambiato su una prenotazione già servita.';
  end if;

  -- ====== G · I PERMESSI DOPO IL `drop`, che è la trappola dell'11/08 ======
  if has_function_privilege('anon', 'turni_del_giorno(date)', 'execute') then
    raise exception 'G · turni_del_giorno è rimasta aperta al ruolo anonimo dopo il drop.';
  end if;
  if not has_function_privilege('authenticated', 'turni_del_giorno(date)', 'execute') then
    raise exception 'G · turni_del_giorno non è più eseguibile da chi usa il gestionale.';
  end if;

  -- =========== PULIZIA ===========
  delete from orders where reservation_id in (v_r1, v_r2);
  delete from prenotazione_tavoli where reservation_id in (v_r1, v_r2);
  delete from reservations where customer_name like '__VERIFICA__%';
  if exists (select 1 from reservations where customer_name like '__VERIFICA__%') then
    raise exception 'La verifica ha lasciato delle righe finte.';
  end if;
  select count(*) into v_lap_d from deleted_records;
  if v_lap_d <> v_lap_p then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lap_d - v_lap_p;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'A conto chiuso la prenotazione è servita, smette di contare, e resta nell''elenco.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260821000004', 'la_prenotazione_servita')
on conflict (version) do nothing;
