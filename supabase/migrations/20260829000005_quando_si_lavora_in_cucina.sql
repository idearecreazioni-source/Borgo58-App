-- =====================================================================
-- «APERTO AL PUBBLICO» E «SI LAVORA IN CUCINA» SONO DUE COSE DIVERSE
-- 29/08/2026 — Blocco 1 del mandato del 29/08 (pomeriggio)
-- =====================================================================
-- Decisione di Alessio, esplicita: **due interruttori separati per ogni
-- giorno**, e non se ne fa uno solo. Il suo ragionamento: *il giorno di
-- chiusura e' spesso proprio quello delle preparazioni lunghe.* Se per un
-- giorno coincidono si spuntano tutti e due — ma il gestionale deve poterli
-- tenere distinti.
--
-- ---------------------------------------------------------------------
-- COSA C'ERA GIA', misurato in produzione prima di scrivere
-- ---------------------------------------------------------------------
-- ⚠️ Il calendario dell'APERTURA AL PUBBLICO **esiste**, e vive sotto nomi
-- inglesi — che e' probabilmente il motivo per cui cercandolo in italiano
-- sembra non esserci:
--
--   · `service_hours`   — 14 righe (7 giorni × pranzo/cena) con `attivo`.
--     Oggi: domenica a pranzo, martedi'-sabato a cena, lunedi' riposo.
--   · `service_closures` — chiusure a date (dal → al, col motivo).
--     **Zero righe**: la struttura c'e', i dati no.
--   · `service_settings` — le regole generali del servizio.
--
-- **Quello che non esiste affatto e' il lavoro in cucina.** Non c'e' nessuna
-- colonna, da nessuna parte, che dica se in un giorno si cucina.
--
-- ---------------------------------------------------------------------
-- 🔴 E UNO DEI TRE CHE DOVREBBERO SAPERLO LO STA INDOVINANDO
-- ---------------------------------------------------------------------
-- Misurato aprendo i corpi vivi delle funzioni che leggono gli orari:
--
--   · le PRENOTAZIONI pubbliche (`public_reservation_options`,
--     `submit_public_reservation`) leggono **orari E chiusure** — corrette;
--   · il CALENDARIO EVENTI visita qualunque data ed e' **voluto** cosi'
--     dal 18/08 (alle 00:30 si deve poter preparare il giorno dopo);
--   · 🔴 **`turni_del_giorno`** — i turni del personale — guarda **solo**
--     `service_hours.attivo` per il giorno della settimana, e **non guarda
--     mai `service_closures`**: in un giorno di ferie il servizio e la
--     fascia oraria di ogni prenotazione risultano VUOTI, e la schermata
--     non dice perche'.
--
-- 🔴 **E QUI LA CURA OVVIA ERA SBAGLIATA, provata e ritirata.** Avevo
-- riscritto quella funzione perche' non restituisse niente nei giorni di
-- chiusura, e la verifica l'ha bocciata: `turni_del_giorno` non elenca
-- turni di lavoro, elenca **le PRENOTAZIONI di quella data**. Farle sparire
-- il giorno in cui il locale chiude vuol dire nascondere **proprio i
-- clienti che bisogna avvisare** — un difetto peggiore di quello che
-- curava. *Una schermata vuota e' una rassicurazione falsa.*
--
-- ⚠️ Quindi qui si costruisce solo **la risposta** — `locale_aperto(data)` —
-- e la funzione dei turni **non viene toccata**. Cosa debba fare la
-- schermata quando quel giorno e' chiuso (dirlo in cima? segnare le
-- prenotazioni da avvisare?) e' una decisione di Alessio, non mia, ed e'
-- fra le domande del riepilogo.
--
-- ⚠️ **Oggi non morde perche' `service_closures` e' VUOTA** in produzione:
-- e' un difetto armato e muto, che si vedrebbe la prima volta che Alessio
-- scrive le sue ferie — cioe' esattamente quando conta.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LA SETTIMANA TIPO DELLA CUCINA
-- ---------------------------------------------------------------------
-- ⚠️ Sta in una tabella SUA e non in `service_hours`, e la ragione e' che
-- le due cose hanno una forma diversa: gli orari sono per **giorno ×
-- servizio** (pranzo, cena), il lavoro in cucina e' per **giorno**.
-- Mettendolo li' ogni giorno avrebbe due righe con lo stesso valore, che e'
-- un doppione capace di divergere — e la regola del progetto e' che due
-- posti che dicono la stessa cosa sono un difetto.
create table if not exists settimana_cucina (
  weekday    smallint primary key check (weekday between 0 and 6),
  si_lavora  boolean,
  aggiornato_il timestamptz not null default now()
);

comment on table settimana_cucina is
  'Per ogni giorno della settimana: in cucina si lavora? E'' una domanda DIVERSA da «il locale e'' aperto», che vive in service_hours: il giorno di chiusura e'' spesso quello delle preparazioni lunghe.';
comment on column settimana_cucina.si_lavora is
  'Vuoto vuol dire «non l''ha ancora detto Alessio», e chi chiede riceve un non-so invece di un no: un no inventato spegnerebbe le preparazioni ricorrenti senza dirlo.';

alter table settimana_cucina enable row level security;

do $policy$
begin
  if not exists (select 1 from pg_policies where tablename = 'settimana_cucina' and policyname = 'settimana_cucina_lettura') then
    create policy settimana_cucina_lettura on settimana_cucina
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'settimana_cucina' and policyname = 'settimana_cucina_scrittura') then
    create policy settimana_cucina_scrittura on settimana_cucina
      for all to authenticated using ((select is_titolare())) with check ((select is_titolare()));
  end if;
end
$policy$;

-- 🔴 COME NASCONO LE SETTE RIGHE, ed e' la parte su cui si poteva sbagliare.
-- Un valore predefinito su una colonna nuova **risponde al posto di chi non
-- ha risposto** (trappola del 14/08), e qui le due risposte comode sono
-- entrambe sbagliate: tutto `false` spegnerebbe le preparazioni ricorrenti
-- senza dirlo, tutto `true` direbbe che si cucina anche la domenica sera.
--
-- Ma NON tutte le caselle sono incerte allo stesso modo:
--   · dove il locale e' APERTO, che in cucina si lavori non e' un'ipotesi —
--     e' una necessita': se si serve, si cucina. Quella casella si riempie;
--   · dove il locale e' CHIUSO, nessuno lo sa. Resta **vuota**, e la
--     decisione e' di Alessio.
-- Cosi' le caselle da compilare a mano sono quelle vere — oggi una sola, il
-- lunedi' — invece di sette.
insert into settimana_cucina (weekday, si_lavora)
select g.weekday,
       case when exists (select 1 from service_hours sh where sh.weekday = g.weekday and sh.attivo)
            then true else null end
  from generate_series(0, 6) as g(weekday)
on conflict (weekday) do nothing;

-- ---------------------------------------------------------------------
-- 2. E UNA CHIUSURA A DATE PUO' DIRE LA SUA
-- ---------------------------------------------------------------------
-- Il caso che Alessio ha nominato: *per un singolo giorno il locale e'
-- chiuso ma in cucina si lavora*. `service_closures` copre gia' le ferie e
-- le chiusure straordinarie (dal → al, col motivo); le manca solo la
-- seconda risposta.
-- ⚠️ Vuoto = «vale la settimana tipo», non «no»: durante due settimane di
-- ferie e' probabile che non si cucini, ma **e' lui a dirlo** — e un giorno
-- di chiusura tecnica con le preparazioni dentro e' proprio il caso per cui
-- questo blocco esiste.
alter table service_closures
  add column if not exists si_lavora_in_cucina boolean;

comment on column service_closures.si_lavora_in_cucina is
  'In questi giorni chiusi, in cucina si lavora? Vuoto = vale la settimana tipo. E'' la casella che distingue le ferie dal giorno di chiusura in cui si fanno le preparazioni lunghe.';

-- ---------------------------------------------------------------------
-- 3. LE DUE DOMANDE SECCHE
-- ---------------------------------------------------------------------
-- Il mandato lo chiede per nome: *non un'agenda, un calendario che risponda
-- a due domande*. Sono due funzioni e basta, e chi le chiama non deve sapere
-- niente di come sono fatte le tabelle sotto.
create or replace function locale_aperto(p_data date)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (select 1 from service_hours sh
                  where sh.weekday = extract(dow from p_data)::integer and sh.attivo)
     and not exists (select 1 from service_closures c
                      where p_data between c.dal and c.al);
$fn$;

revoke all on function locale_aperto(date) from public, anon, authenticated;
grant execute on function locale_aperto(date) to authenticated;

comment on function locale_aperto(date) is
  'Il tal giorno il locale e'' aperto al pubblico? Guarda la settimana tipo E le chiusure a date: sono due condizioni, e chi ne guarda una sola sbaglia sui giorni di ferie.';

-- ⚠️ RESTITUISCE booleano che puo' essere VUOTO, e non e' una svista: le
-- risposte sono TRE — si', no, e «non l'ha ancora detto nessuno». Chi
-- riceve vuoto non deve comportarsi come se fosse no: deve dirlo.
create or replace function si_lavora_in_cucina(p_data date)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  -- Una chiusura che si e' pronunciata vince sulla settimana tipo: e' lo
  -- scostamento di quel giorno preciso.
  select coalesce(
    (select c.si_lavora_in_cucina from service_closures c
      where p_data between c.dal and c.al and c.si_lavora_in_cucina is not null
      order by c.dal desc limit 1),
    (select s.si_lavora from settimana_cucina s
      where s.weekday = extract(dow from p_data)::integer)
  );
$fn$;

revoke all on function si_lavora_in_cucina(date) from public, anon, authenticated;
grant execute on function si_lavora_in_cucina(date) to authenticated;

comment on function si_lavora_in_cucina(date) is
  'Il tal giorno si lavora in cucina? VUOTO vuol dire «non l''ha ancora detto Alessio» ed e'' una risposta diversa da no: chi la riceve lo dichiara invece di dare per scontato che non si lavori.';

-- =====================================================================
-- VERIFICA
-- =====================================================================
-- =====================================================================
-- VERIFICA
-- =====================================================================
-- ⚠️ LA VERIFICA SI COSTRUISCE IL PROPRIO GIORNO, non lo cerca fra i dati
-- di Alessio: sul progetto di prova i quattordici servizi sono TUTTI spenti
-- e nessuna di queste prove sarebbe girata — cioe' avrebbero girato solo in
-- produzione, che e' il posto dove servono di meno.
-- Tutto cio' che tocca viene salvato come RIGA INTERA e rimesso intero
-- (regola del 14/08: rimettere le colonne che ci si ricorda invecchia alla
-- prima colonna nuova).
do $verifica$
declare
  v_tit uuid;
  v_foto jsonb;
  v_righe integer;
  v_vuote integer;
  v_attese integer;
  v_giorno date;
  v_dow integer;
  v_orario jsonb;
  v_cucina jsonb;
  v_id uuid;
begin
  v_foto := foto_righe();
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Verifica impossibile: nessun titolare.'; end if;

  -- (1) Sette righe, una per giorno della settimana.
  select count(*), count(*) filter (where si_lavora is null) into v_righe, v_vuote
    from settimana_cucina;
  if v_righe <> 7 then
    raise exception 'La settimana della cucina ha % giorni invece di 7.', v_righe;
  end if;

  -- (2) 🔴 LE CASELLE VUOTE SONO ESATTAMENTE I GIORNI IN CUI IL LOCALE E'
  --     CHIUSO: ne' una di piu' (qualcuno avrebbe risposto al posto di
  --     Alessio) ne' una di meno (la semina non avrebbe fatto niente).
  select count(*) into v_attese from generate_series(0,6) g(d)
   where not exists (select 1 from service_hours sh where sh.weekday = g.d and sh.attivo);
  if v_vuote <> v_attese then
    raise exception 'Caselle da decidere: % , giorni di chiusura: %. Non corrispondono.',
      v_vuote, v_attese;
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- Si apparecchia un giorno TUTTO NOSTRO: domani, senza chiusure sopra.
  select (current_date + g)::date into v_giorno
    from generate_series(1, 30) g
   where not exists (select 1 from service_closures c where (current_date + g) between c.dal and c.al)
   limit 1;
  if v_giorno is null then
    raise exception 'Verifica impossibile: nessun giorno libero da chiusure nel mese prossimo.';
  end if;
  v_dow := extract(dow from v_giorno)::integer;

  select to_jsonb(sh) into v_orario from service_hours sh
   where sh.weekday = v_dow and sh.servizio = 'cena';
  select to_jsonb(sc) into v_cucina from settimana_cucina sc where sc.weekday = v_dow;
  if v_orario is null or v_cucina is null then
    raise exception 'Verifica impossibile: manca la riga della cena o della cucina per il giorno %.', v_dow;
  end if;

  update service_hours set attivo = true where weekday = v_dow and servizio = 'cena';
  update settimana_cucina set si_lavora = true where weekday = v_dow;

  -- (3) Un giorno di apertura: aperto, e in cucina si lavora.
  if not locale_aperto(v_giorno) then
    raise exception 'Il % dovrebbe risultare aperto e non lo e''.', v_giorno;
  end if;
  if si_lavora_in_cucina(v_giorno) is not true then
    raise exception 'In un giorno di apertura la cucina non risulta al lavoro.';
  end if;

  -- (4) Una chiusura a date chiude davvero: e' la seconda meta' della
  --     domanda, quella che chi guardava solo il giorno della settimana
  --     non vedeva.
  --     ⚠️ NON si controlla che i turni spariscano: farli sparire sarebbe
  --     nascondere le prenotazioni da avvisare. Si controlla che la
  --     RISPOSTA sia giusta; cosa farne lo decide Alessio.
  insert into service_closures (dal, al, motivo)
  values (v_giorno, v_giorno, 'VERIFICA-29AGO chiusura')
  returning id into v_id;

  if locale_aperto(v_giorno) then
    raise exception 'Con una chiusura a date, il locale risulta ancora aperto.';
  end if;

  -- (5) …e la cucina puo' lavorare LO STESSO. E' il caso per cui i due
  --     interruttori sono separati, ed e' la decisione di Alessio.
  if si_lavora_in_cucina(v_giorno) is not true then
    raise exception 'Chiudere al pubblico ha spento anche la cucina: i due interruttori non sono separati.';
  end if;

  -- (6) E la chiusura puo' dire la sua, vincendo sulla settimana tipo.
  update service_closures set si_lavora_in_cucina = false where id = v_id;
  if si_lavora_in_cucina(v_giorno) is not false then
    raise exception 'La chiusura dice che in cucina non si lavora, e la risposta non cambia.';
  end if;

  -- (7) 🔴 IL TERZO STATO ESISTE: un giorno che nessuno ha deciso risponde
  --     VUOTO, non «no». Un no inventato spegnerebbe le preparazioni
  --     ricorrenti in silenzio, che e' il modo peggiore di spegnerle.
  delete from service_closures where id = v_id;
  update settimana_cucina set si_lavora = null where weekday = v_dow;
  if si_lavora_in_cucina(v_giorno) is not null then
    raise exception 'Un giorno che nessuno ha deciso risponde «%» invece di «non lo so».',
      si_lavora_in_cucina(v_giorno);
  end if;

  -- Si rimette tutto com'era, riga intera.
  update service_hours sh set
    attivo = (v_orario ->> 'attivo')::boolean
   where sh.weekday = v_dow and sh.servizio = 'cena';
  update settimana_cucina sc set
    si_lavora = (v_cucina ->> 'si_lavora')::boolean
   where sc.weekday = v_dow;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica del calendario della cucina');
  raise notice 'Aperto al pubblico e lavoro in cucina sono due domande separate, e una chiusura a date le distingue; % caselle restano da decidere ad Alessio. I turni NON sono stati toccati: vedi la premessa.', v_vuote;
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000005', 'quando_si_lavora_in_cucina') on conflict (version) do nothing;
