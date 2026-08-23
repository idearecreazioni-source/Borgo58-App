-- =====================================================================
-- LE PULIZIE DIVENTANO LA LISTA DI OGGI
-- 24/08/2026 — blocco 5c del mandato delle correzioni del collaudo
-- =====================================================================
-- 🔴 COM'ERA, e perche' non funzionava. La schermata delle pulizie era un
-- elenco piatto in ordine alfabetico, con sotto ogni voce «Ultima:
-- 12/08/2026». Per sapere se si era in ritardo bisognava **contare a
-- mente**, voce per voce, tenendo a mente anche la frequenza: la
-- giornaliera fatta il 12 e' un guaio, la mensile fatta il 12 non e'
-- niente. Sette voci oggi; con venti, nessuno lo fa piu'.
--
-- ⚠️ E MISURATO: 7 attivita' attive e 199 spunte sul progetto di prova.
-- L'elenco delle spunte cresce di qualche riga al giorno e non si ferma
-- mai — dopo poche settimane la cronologia e' illeggibile per costruzione.
--
-- ---------------------------------------------------------------------
-- LA REGOLA, come l'ha data Alessio
-- ---------------------------------------------------------------------
-- Le giornaliere compaiono ogni giorno. Le settimanali e le mensili
-- compaiono quando scadono, **contando dall'ultima volta che sono state
-- spuntate** e non a giorno fisso: il locale puo' restare chiuso, e una
-- scadenza a calendario produrrebbe ritardi che non esistono. Quello che
-- non viene spuntato si ripresenta il giorno dopo, e ogni giorno, finche'
-- non viene fatto — e dice **da quanti giorni** e' in ritardo, perche'
-- scaduta da tre giorni e scaduta da uno non sono la stessa cosa.
--
-- ⚠️ IL GIORNO E' LA SERATA DI SERVIZIO, non il calendario, e la scelta ha
-- una ragione sola ma decisiva: **le pulizie di chiusura si fanno dopo
-- mezzanotte**. A calendario, la sanificazione del banco fatta all'una di
-- notte risulterebbe del giorno dopo, e la lista della sera prima
-- resterebbe «non fatta» per sempre — un ritardo inventato dal fuso, che
-- e' il difetto che questo progetto ha gia' incontrato cinque volte.
-- Si passa da `serata_di_servizio()`, che e' il posto unico dove quella
-- regola vive: scriverla qui sarebbe il dodicesimo orologio.
--
-- ⚠️ «ALTRO» NON HA UNA SCADENZA, E LO DICE. Quella frequenza significa
-- esattamente «una cadenza che il gestionale non conosce»: calcolarle una
-- scadenza vorrebbe dire inventarla. Compare sempre in fondo, marcata
-- «senza cadenza fissa» — visibile, mai in ritardo. *Assenza di
-- informazione non e' informazione di assenza.*
--
-- ⚠️ MAI FATTA NON E' UN RITARDO DI ZERO GIORNI: e' dovuta, e il numero di
-- giorni resta **vuoto**. Uno zero lì si leggerebbe «in pari».
--
-- ⚠️ IL MENSILE E' TRENTA GIORNI DALL'ULTIMA VOLTA, non «lo stesso giorno
-- del mese»: e' la richiesta, ed e' la stessa ragione del settimanale.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Ogni quanto torna una frequenza
-- ---------------------------------------------------------------------
create or replace function periodo_pulizia(p_frequenza text)
returns integer
language sql
immutable
as $$
  select case p_frequenza
           when 'giornaliera' then 1
           when 'settimanale' then 7
           when 'mensile'     then 30
           else null
         end;
$$;

comment on function periodo_pulizia(text) is
  'Ogni quanti giorni torna una pulizia. NULL per «altro», che vuol dire «cadenza che il gestionale non conosce»: per quelle non si calcola nessuna scadenza.';

revoke all on function periodo_pulizia(text) from public, anon;
grant execute on function periodo_pulizia(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2 · La lista di oggi
-- ---------------------------------------------------------------------
-- ⚠️ `security invoker`, di proposito: `haccp_cleaning_tasks` e
-- `haccp_cleaning_logs` sono leggibili da tutto lo staff e questa
-- funzione non aggiunge niente che loro non vedano gia'. Una seconda
-- serratura da tenere allineata alla prima e' un posto in piu' dove
-- possono divergere.
create or replace function pulizie_di_oggi(p_quando timestamptz default now())
returns table (
  task_id          uuid,
  nome             text,
  area             text,
  frequenza        text,
  ogni_giorni      integer,
  ultima_volta     date,
  mai_fatta        boolean,
  dovuta           boolean,
  giorni_ritardo   integer,
  fatta_oggi       boolean
)
language sql
stable
set search_path = public
as $$
  with serata as (
    select serata_di_servizio(p_quando) as oggi
  ),
  ultime as (
    select t.id,
           t.name,
           t.area,
           t.frequency,
           periodo_pulizia(t.frequency) as ogni,
           (select max(serata_di_servizio(l.completed_at))
              from haccp_cleaning_logs l
             where l.task_id = t.id) as ultima
      from haccp_cleaning_tasks t
     where t.active
  )
  select u.id,
         u.name,
         u.area,
         u.frequency,
         u.ogni,
         u.ultima,
         u.ultima is null,
         -- Dovuta: mai fatta, oppure la scadenza e' arrivata. Senza
         -- periodo («altro») non e' mai dovuta, perche' non si sa quando.
         case
           when u.ogni is null then false
           when u.ultima is null then true
           else (select oggi from serata) >= u.ultima + u.ogni
         end,
         -- Da quanti giorni. Vuoto quando non si sa: mai fatta, o senza
         -- cadenza. ⚠️ Mai uno zero al posto di «non lo so».
         case
           when u.ogni is null or u.ultima is null then null
           else greatest(((select oggi from serata) - (u.ultima + u.ogni))::integer, 0)
         end,
         u.ultima is not null and u.ultima = (select oggi from serata)
    from ultime u
   order by
     -- Prima le scadute, dalla piu' vecchia; poi quelle da fare oggi;
     -- poi il resto. Un elenco alfabetico mette la voce scaduta da una
     -- settimana in mezzo a quelle in pari.
     case
       when u.ogni is null then 3
       when u.ultima is null then 0
       when (select oggi from serata) >= u.ultima + u.ogni then 0
       else 2
     end,
     coalesce(((select oggi from serata) - (u.ultima + u.ogni))::integer, 9999) desc,
     u.name;
$$;

comment on function pulizie_di_oggi(timestamptz) is
  'La lista delle pulizie dovute in questa SERATA di servizio, col ritardo in giorni contato dall''ultima spunta. «Altro» non ha scadenza e non risulta mai dovuta.';

revoke all on function pulizie_di_oggi(timestamptz) from public, anon;
grant execute on function pulizie_di_oggi(timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- 3 · L'archivio di un mese
-- ---------------------------------------------------------------------
-- ⚠️ SI CHIEDE AL DATABASE, non si legge tutto e si filtra nel browser:
-- l'elenco delle spunte cresce ogni giorno, e una lettura senza limite
-- torna al massimo di mille righe **senza dirlo** (§8). Qui il perimetro
-- e' un mese, quindi il caso non si presenta per costruzione.
create or replace function pulizie_del_mese(p_anno integer, p_mese integer)
returns table (
  giorno     date,
  task_id    uuid,
  nome       text,
  area       text,
  frequenza  text,
  quando     timestamptz,
  nota       text,
  quante     bigint
)
language sql
stable
set search_path = public
as $$
  select serata_di_servizio(l.completed_at) as giorno,
         t.id, t.name, t.area, t.frequency,
         l.completed_at, l.note,
         count(*) over (partition by t.id) as quante
    from haccp_cleaning_logs l
    join haccp_cleaning_tasks t on t.id = l.task_id
   where serata_di_servizio(l.completed_at)
           between make_date(p_anno, p_mese, 1)
               and (make_date(p_anno, p_mese, 1) + interval '1 month - 1 day')::date
   order by serata_di_servizio(l.completed_at) desc, t.name;
$$;

comment on function pulizie_del_mese(integer, integer) is
  'Le pulizie spuntate in un mese, per serata di servizio. «quante» e'' il totale di quella attivita'' nel mese.';

revoke all on function pulizie_del_mese(integer, integer) from public, anon;
grant execute on function pulizie_del_mese(integer, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 4 · Quali mesi hanno qualcosa da mostrare
-- ---------------------------------------------------------------------
create or replace function pulizie_mesi_con_dati()
returns table (anno integer, mese integer, quante bigint)
language sql
stable
set search_path = public
as $$
  select extract(year from serata_di_servizio(l.completed_at))::integer,
         extract(month from serata_di_servizio(l.completed_at))::integer,
         count(*)
    from haccp_cleaning_logs l
   group by 1, 2
   order by 1 desc, 2 desc;
$$;

revoke all on function pulizie_mesi_con_dati() from public, anon;
grant execute on function pulizie_mesi_con_dati() to authenticated;

-- ---------------------------------------------------------------------
-- 5 · Verifica — la regola DISCRIMINA, provata su roba creata qui
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_g          uuid;
  v_s          uuid;
  v_a          uuid;
  v_oggi       date;
  r            record;
  v_lapidi_p   bigint;
  v_lapidi_d   bigint;
  v_att_prima  bigint;
  v_log_prima  bigint;
begin
  select count(*) into v_lapidi_p from deleted_records;
  select count(*) into v_att_prima from haccp_cleaning_tasks;
  select count(*) into v_log_prima from haccp_cleaning_logs;

  v_oggi := serata_di_servizio(now());

  -- ⚠️ Il perimetro e' fatto di roba che questa verifica ha creato: mai
  -- un'attivita' vera (regola del 16/08). Gli identificativi se li segna,
  -- e ripulisce solo quelli.
  insert into haccp_cleaning_tasks (name, area, frequency)
  values ('VERIFICA 824 giornaliera', 'prova', 'giornaliera') returning id into v_g;
  insert into haccp_cleaning_tasks (name, area, frequency)
  values ('VERIFICA 824 settimanale', 'prova', 'settimanale') returning id into v_s;
  insert into haccp_cleaning_tasks (name, area, frequency)
  values ('VERIFICA 824 altro', 'prova', 'altro') returning id into v_a;

  -- (a) Mai fatta: dovuta, e i giorni restano VUOTI — non zero.
  select * into r from pulizie_di_oggi() where task_id = v_g;
  if not r.dovuta then raise exception 'Una giornaliera mai fatta deve risultare dovuta.'; end if;
  if not r.mai_fatta then raise exception 'Una giornaliera mai fatta deve dirlo.'; end if;
  if r.giorni_ritardo is not null then
    raise exception 'Mai fatta ha dato % giorni di ritardo: doveva restare vuoto.', r.giorni_ritardo;
  end if;

  -- (b) «Altro» non ha scadenza e non risulta mai dovuta.
  select * into r from pulizie_di_oggi() where task_id = v_a;
  if r.dovuta then raise exception 'Una pulizia senza cadenza non puo'' risultare dovuta.'; end if;
  if r.ogni_giorni is not null then raise exception 'Una pulizia «altro» non ha un periodo.'; end if;

  -- (c) Fatta oggi: non dovuta. ⚠️ L'istante e' `now()`: la sua serata
  --     E' quella di oggi per definizione, a qualunque ora giri la
  --     migrazione. Costruirlo da una data piu' un'ora fissa avrebbe
  --     scritto una spunta nel FUTURO girando di pomeriggio.
  insert into haccp_cleaning_logs (task_id, completed_at) values (v_g, now());
  select * into r from pulizie_di_oggi() where task_id = v_g;
  if r.dovuta then raise exception 'Una giornaliera fatta stasera non e'' ancora dovuta.'; end if;
  if not r.fatta_oggi then raise exception 'Una giornaliera fatta stasera deve risultare fatta oggi.'; end if;

  -- (d) Fatta tre giorni fa: dovuta, e in ritardo di DUE giorni.
  --     ⚠️ Tre e non uno: con un giorno solo, «ritardo 0» e «ritardo 1»
  --     e «nessun ritardo» darebbero quasi lo stesso numero, e la prova
  --     passerebbe anche con l'aritmetica sbagliata di un'unita'.
  delete from haccp_cleaning_logs where task_id = v_g;
  insert into haccp_cleaning_logs (task_id, completed_at)
  values (v_g, now() - interval '3 days');
  select * into r from pulizie_di_oggi() where task_id = v_g;
  if not r.dovuta then raise exception 'Una giornaliera di tre giorni fa e'' dovuta.'; end if;
  if r.giorni_ritardo <> 2 then
    raise exception 'Ritardo atteso 2 giorni, calcolato %.', r.giorni_ritardo;
  end if;

  -- (e) La settimanale fatta tre giorni fa NON e' dovuta; a otto si'.
  --     E' il confronto che dimostra che la frequenza conta davvero:
  --     stesso giorno, risposta diversa.
  insert into haccp_cleaning_logs (task_id, completed_at)
  values (v_s, now() - interval '3 days');
  select * into r from pulizie_di_oggi() where task_id = v_s;
  if r.dovuta then raise exception 'Una settimanale di tre giorni fa non e'' ancora dovuta.'; end if;

  delete from haccp_cleaning_logs where task_id = v_s;
  insert into haccp_cleaning_logs (task_id, completed_at)
  values (v_s, now() - interval '8 days');
  select * into r from pulizie_di_oggi() where task_id = v_s;
  if not r.dovuta then raise exception 'Una settimanale di otto giorni fa e'' dovuta.'; end if;
  if r.giorni_ritardo <> 1 then
    raise exception 'Ritardo atteso 1 giorno sulla settimanale, calcolato %.', r.giorni_ritardo;
  end if;

  -- (f) L'archivio del mese vede la spunta di oggi.
  insert into haccp_cleaning_logs (task_id, completed_at) values (v_g, now());
  if not exists (
    select 1 from pulizie_del_mese(
      extract(year from v_oggi)::integer, extract(month from v_oggi)::integer)
     where task_id = v_g
  ) then
    raise exception 'L''archivio del mese non vede una spunta di oggi.';
  end if;

  -- --- Pulizia: solo le righe di questa verifica, e in ordine.
  delete from haccp_cleaning_logs where task_id in (v_g, v_s, v_a);
  delete from haccp_cleaning_tasks where id in (v_g, v_s, v_a);

  if (select count(*) from haccp_cleaning_tasks) <> v_att_prima then
    raise exception 'Le attivita'' di pulizia non sono tornate a %.', v_att_prima;
  end if;
  if (select count(*) from haccp_cleaning_logs) <> v_log_prima then
    raise exception 'Le spunte non sono tornate a %.', v_log_prima;
  end if;

  select count(*) into v_lapidi_d from deleted_records;
  if v_lapidi_d <> v_lapidi_p then
    raise exception 'Il registro delle cancellazioni e'' passato da % a %.', v_lapidi_p, v_lapidi_d;
  end if;

  raise notice 'Lista delle pulizie: verificata. % attivita'' attive, % spunte, nessun residuo.',
    v_att_prima, v_log_prima;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000003', 'la_lista_delle_pulizie_di_oggi') on conflict (version) do nothing;
