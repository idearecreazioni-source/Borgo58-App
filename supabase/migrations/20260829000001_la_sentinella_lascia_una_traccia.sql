-- =====================================================================
-- LA SORVEGLIANZA ESCE DA CIO' CHE SORVEGLIA
-- 29/08/2026
-- =====================================================================
-- 🔴 IL BUCO, misurato in produzione il 29/08. La sentinella sorveglia
-- cinque lavori pianificati e li copre bene. Ma **e' essa stessa un lavoro
-- pianificato**, e di se' non dice niente: `stato_lavori` ha cinque righe e
-- **nessuna e' la sua**. Quindi se `sentinella-lavori` si ferma, non esiste
-- da nessuna parte un dato da cui accorgersene — e con lei tacciono tutti e
-- cinque gli allarmi che dipendono da lei.
--
-- ⚠️ E NON E' UNA DIMENTICANZA: escluderla era voluto, ed e' scritto nel
-- corpo di `lavori_senza_sentinella()` — «non puo' essere testimone della
-- propria assenza». Vero. Il difetto e' che da quella frase giusta non e'
-- mai seguita la seconda meta': **se non puo' testimoniare lei, deve farlo
-- qualcun altro.**
--
-- ---------------------------------------------------------------------
-- CHI GUARDA, E PERCHE' PROPRIO LUI
-- ---------------------------------------------------------------------
-- Il testimone deve stare **fuori da pg_cron**, altrimenti un guasto che
-- ferma i lavori spegne anche il guardiano — che e' esattamente la forma
-- del difetto. Le strade erano tre:
--
--   (a) un servizio esterno che interroga il database → un'infrastruttura
--       nuova da mantenere, per un locale che non ha ancora aperto;
--   (b) un secondo lavoro pg_cron che sorveglia il primo → **non risolve
--       niente**: sta nello stesso posto che puo' fermarsi;
--   (c) **il gestionale stesso**, quando Alessio lo apre.
--
-- Si prende la (c). Gli avvisi della schermata iniziale li legge il
-- browser, che non e' pg_cron e non e' il database: se la sorveglianza e'
-- ferma da un'ora, la prima volta che apre il gestionale lo legge scritto.
--
-- ⚠️ IL PREZZO, dichiarato invece che nascosto: se Alessio non apre il
-- gestionale per due giorni, per due giorni nessuno guarda. E' un limite
-- vero — ed e' comunque tutta un'altra cosa rispetto a oggi, dove **non
-- guarda nessuno mai**. Il giorno che il locale sara' aperto e il
-- gestionale si aprira' tutti i giorni, il limite si stringe da solo.
--
-- ⚠️ E LA TOLLERANZA E' UN DATO, non un numero nel codice: sta in
-- `lavori_sorvegliati` come per gli altri cinque. Sessanta minuti su un
-- lavoro che gira ogni quindici: un ritardo occasionale non deve gridare,
-- perche' un guardiano che grida spesso si impara a spegnere.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LA SENTINELLA ENTRA FRA I SORVEGLIATI
-- ---------------------------------------------------------------------
-- ⚠️ Ci entra per DUE motivi, e il secondo non e' ovvio: cosi' la
-- tolleranza e la frase «cosa smette» vivono dove vivono quelle degli
-- altri, **e** `lavori_senza_sentinella()` smette di doverla escludere a
-- mano — l'eccezione scritta nel codice diventa un dato come gli altri.
insert into lavori_sorvegliati (nome_lavoro, nome_cron, tolleranza_minuti, cosa_smette)
values (
  'sentinella',
  'sentinella-lavori',
  60,
  -- ⚠️ La frase CONTINUA il titolo dell'avviso, non lo ripete: a schermo
  -- si legge «La sorveglianza dei lavori è ferma · Ferma da 180 minuti.
  -- Se un lavoro si fermasse…». Scritta come le altre cinque — che finiscono
  -- su Telegram, dove il titolo non c'è — diceva tre volte la stessa cosa.
  -- Visto a schermo il 29/08, non dedotto.
  'Se adesso un lavoro si fermasse, nessuno lo direbbe.'
)
on conflict (nome_lavoro) do update
  set nome_cron = excluded.nome_cron,
      tolleranza_minuti = excluded.tolleranza_minuti,
      cosa_smette = excluded.cosa_smette;

-- ---------------------------------------------------------------------
-- 2. LA SENTINELLA SCRIVE IL PROPRIO BATTITO
-- ---------------------------------------------------------------------
-- Corpo ripreso dal database vivo il 29/08 (regola del 18/08: mai dal file
-- che l'ha creata). Cambia solo la coda.
create or replace function controlla_lavori_pianificati()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r record;
begin
  for r in select * from lavori_in_silenzio() loop
    -- Un tipo di allarme per lavoro: il freno anti-tempesta è per tipo,
    -- e con un tipo solo il secondo lavoro rotto resterebbe muto per un'ora.
    perform segnala_allarme(
      'lavoro_fermo_' || r.nome_lavoro,
      'Il lavoro «' || r.nome_cron || '» non arriva in fondo da ' ||
        greatest(r.minuti, 0) || ' minuti. ' || r.cosa_smette,
      jsonb_build_object('lavoro', r.nome_lavoro, 'minuti', r.minuti)
    );
  end loop;

  for r in select * from lavori_senza_sentinella() loop
    if r.verso = 'non_sorvegliato' then
      perform segnala_allarme(
        'lavoro_non_sorvegliato',
        'Il lavoro pianificato «' || r.nome_cron || '» non è sorvegliato da nessuno: ' ||
        'se smettesse di girare, non se ne accorgerebbe nessuno.',
        jsonb_build_object('lavoro', r.nome_cron)
      );
    else
      perform segnala_allarme(
        'lavoro_sparito',
        'Il lavoro «' || r.nome_cron || '» risulta sorvegliato ma non è più pianificato, o è stato disattivato.',
        jsonb_build_object('lavoro', r.nome_cron)
      );
    end if;
  end loop;

  -- 🔴 IL BATTITO PROPRIO, ed e' la meta' che mancava dal 10/08. Si scrive
  -- IN FONDO e non in cima: in cima direbbe «sono partita», qui dice «sono
  -- arrivata in fondo», che e' la sola cosa che interessa a chi guarda.
  insert into stato_lavori (nome, ultimo_successo)
  values ('sentinella', now())
  on conflict (nome) do update set ultimo_successo = excluded.ultimo_successo;
end
$fn$;

-- ---------------------------------------------------------------------
-- 3. LA SENTINELLA NON SI SEGNALA DA SE'
-- ---------------------------------------------------------------------
-- ⚠️ Ora che ha una riga fra i sorvegliati, `lavori_in_silenzio()` la
-- includerebbe — e sarebbe **sorvegliarla per finta**: se e' ferma non
-- gira, quindi non puo' segnalare niente, e se gira il ritardo non c'e'.
-- L'esclusione e' la stessa frase di prima, spostata dove serve adesso.
create or replace function lavori_in_silenzio()
returns table(nome_lavoro text, nome_cron text, minuti integer, cosa_smette text)
language sql
stable
security definer
set search_path = public
as $fn$
  select l.nome_lavoro,
         l.nome_cron,
         coalesce(extract(epoch from (now() - s.ultimo_successo)) / 60, -1)::integer,
         l.cosa_smette
    from lavori_sorvegliati l
    left join stato_lavori s on s.nome = l.nome_lavoro
   where l.nome_lavoro <> 'sentinella'
     and (s.ultimo_successo is null
          or s.ultimo_successo < now() - make_interval(mins => l.tolleranza_minuti));
$fn$;

-- ⚠️ E l'eccezione scritta a mano in `lavori_senza_sentinella()` esce: la
-- sentinella e' fra i sorvegliati come gli altri, quindi il ramo «non
-- sorvegliato da nessuno» non la nomina piu' da solo. Resta il ramo
-- opposto, che ora la copre: se il suo lavoro sparisse o venisse
-- disattivato, lo direbbe.
create or replace function lavori_senza_sentinella()
returns table(nome_cron text, verso text)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;

  return query
    select j.jobname::text, 'non_sorvegliato'::text
      from cron.job j
     where not exists (select 1 from lavori_sorvegliati l where l.nome_cron = j.jobname);

  -- E il verso opposto: sorvegliamo un lavoro che non gira più. Senza
  -- questo, cancellare il lavoro spegnerebbe anche il suo allarme —
  -- il battito resta fermo all'ultimo giro e nessuno lo sa.
  return query
    select l.nome_cron, 'sparito'::text
      from lavori_sorvegliati l
     where not exists (
       select 1 from cron.job j where j.jobname = l.nome_cron and j.active
     );
end
$fn$;

-- ---------------------------------------------------------------------
-- 4. LA DOMANDA, IN UN POSTO SOLO
-- ---------------------------------------------------------------------
-- «Da quanto tace la sorveglianza?» si chiede qui, non si ricalcola dove
-- serve: un criterio scritto in due posti diverge, e a divergere sarebbe
-- quello guardato meno spesso.
-- ⚠️ IL PORTIERE C'E', ed e' un RIFIUTO e non un filtro nella `where`
-- (lezione del 27/08): chi non deve vedere riceve un errore, non un elenco
-- vuoto che si legge «va tutto bene». E' anche la ragione per cui questa e'
-- plpgsql e non SQL: una funzione SQL non puo' rifiutare.
create or replace function sorveglianza_ferma()
returns table(ferma boolean, minuti integer, tolleranza integer, cosa_smette text)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not is_titolare() then
    raise exception 'Lo stato della sorveglianza e'' riservato al titolare.';
  end if;
  return query
  select
    -- ⚠️ Mai battuto vale «ferma» quanto un battito vecchio: prima del
    -- primo giro non si sa niente, e non sapere non e' una rassicurazione.
    (s.ultimo_successo is null
     or s.ultimo_successo < now() - make_interval(mins => l.tolleranza_minuti)),
    coalesce(round(extract(epoch from (now() - s.ultimo_successo)) / 60), -1)::integer,
    l.tolleranza_minuti,
    l.cosa_smette
  from lavori_sorvegliati l
  left join stato_lavori s on s.nome = l.nome_lavoro
  where l.nome_lavoro = 'sentinella';
end
$fn$;

revoke all on function sorveglianza_ferma() from public, anon, authenticated;
grant execute on function sorveglianza_ferma() to authenticated;

comment on function sorveglianza_ferma() is
  'Da quanto tace la sorveglianza dei lavori automatici. La guarda il gestionale all''apertura, che e'' fuori da pg_cron: se fosse un lavoro pianificato, lo stesso guasto spegnerebbe guardiano e sorvegliato.';

-- ---------------------------------------------------------------------
-- 5. E IL GESTIONALE LO DICE APRENDOSI
-- ---------------------------------------------------------------------
-- Corpo ripreso dal database vivo il 29/08: cambia solo la fonte (f) in
-- fondo. ⚠️ La gravita' e' ALTA e non dipende da un conteggio, come per le
-- non conformita': non e' una quantita' di problemi, e' che da quel momento
-- il gestionale ha smesso di sorvegliarsi.
create or replace function avvisi_del_gestionale()
returns table(chiave text, titolo text, dettaglio text, quanti integer, dove text, gravita text, rimandato_a date)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_oggi date := oggi_a_roma();
begin
  if not is_titolare() then
    raise exception 'Gli avvisi del gestionale sono riservati al titolare.';
  end if;

  return query
  with fonti as (
    -- (a) LE SCADENZE — la stessa regola del messaggio delle 10:00, e la
    -- stessa funzione: se la riscrivessimo qui, un giorno schermata e
    -- telefono direbbero due cose diverse (successo coi rincari il 12/08).
    select 'scadenze'::text as k,
           'Prodotti scaduti o in scadenza'::text as t,
           (select count(*)::integer from partite_in_scadenza() where da_segnalare) as q,
           '/magazzino/scadenze'::text as d,
           'alta'::text as g,
           (select string_agg(x.ingrediente, ', ')
              from (select p.ingrediente
                      from partite_in_scadenza() p
                     where p.da_segnalare
                     order by p.giorni_mancanti, p.ingrediente
                     limit 3) x) as esempi

    union all
    -- (c) LE NON CONFORMITA' HACCP APERTE. ⚠️ Qui la gravita' e' sempre
    -- alta e non dipende da quante sono: una sola non conformita' aperta
    -- e' un problema di sicurezza alimentare, e il registro si esibisce.
    select 'non_conformita',
           'Non conformità aperte in HACCP',
           (select count(*)::integer from haccp_non_conformities where not resolved),
           '/haccp/non-conformita',
           'alta',
           (select string_agg(x.description, ', ')
              from (select nc.description from haccp_non_conformities nc
                     where not nc.resolved order by nc.detected_at limit 3) x)

    union all
    -- (d) GLI INCASSI SENZA SCONTRINO. ⚠️ Si somma su TUTTE le entita'
    -- invece di indovinare quale sia il ristorante: il giorno che
    -- l'azienda agricola incassera' qualcosa, questo avviso la vede da
    -- solo. `conti_da_fiscalizzare` vuole l'entita', quindi la si chiama
    -- una volta per ognuna.
    select 'da_fiscalizzare',
           'Incassi senza documento fiscale',
           (select coalesce(sum(c.quanti), 0)::integer
              from (select (select count(*) from conti_da_fiscalizzare(e.id)) as quanti
                      from entities e) c),
           '/cassa/scontrinato',
           'alta',
           null

    union all
    -- (e) I PAGAMENTI CHE NON QUADRANO — soldi, quindi entra anche
    -- quando e' zero per costruzione: oggi lo e', e va bene cosi'.
    select 'quadratura',
           'Pagamenti che non quadrano',
           (select count(*)::integer from quadratura_pagamenti()),
           '/cassa/prima-nota',
           'alta',
           (select string_agg(x.descrizione, ', ')
              from (select qp.descrizione from quadratura_pagamenti() qp limit 3) x)

    union all
    -- (f) 🔴 LA SORVEGLIANZA FERMA (29/08). Questo avviso e' diverso da
    -- tutti gli altri: gli altri dicono che c'e' un problema, questo dice
    -- che **il gestionale ha smesso di poter vedere i problemi**. Per
    -- questo sta qui e non fra gli allarmi su Telegram: gli allarmi li
    -- manda la sentinella, e una sentinella ferma non manda niente.
    select 'sorveglianza',
           'La sorveglianza dei lavori è ferma',
           (select case when sf.ferma then 1 else 0 end from sorveglianza_ferma() sf),
           '/dashboard',
           'alta',
           (select case
                     when sf.minuti < 0 then 'Non ha mai dato segno di sé.'
                     else 'Ferma da ' || sf.minuti || ' minuti. ' || sf.cosa_smette
                   end
              from sorveglianza_ferma() sf)
  )
  select f.k,
         f.t,
         case
           when f.esempi is null then null
           else f.esempi || case when f.q > 3 then ' e altri ' || (f.q - 3) else '' end
         end,
         f.q,
         f.d,
         f.g,
         r.fino_al
    from fonti f
    left join avvisi_rimandati r on r.chiave = f.k and r.fino_al > v_oggi
   where f.q > 0
   order by case f.g when 'alta' then 0 else 1 end, f.t;
end
$fn$;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_ferma boolean;
  v_minuti integer;
  v_prima timestamptz;
  v_dopo timestamptz;
  v_quanti integer;
  v_lapidi_prima integer;
  v_lapidi_dopo integer;
  v_tit uuid;
  v_staff uuid;
  v_ok boolean;
begin
  select count(*) into v_lapidi_prima from deleted_records;
  select user_id into v_tit   from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role <> 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Verifica impossibile: nessun titolare configurato';
  end if;

  -- (1) La sentinella e' fra i sorvegliati, con la sua tolleranza.
  if not exists (select 1 from lavori_sorvegliati where nome_lavoro = 'sentinella'
                   and nome_cron = 'sentinella-lavori' and tolleranza_minuti = 60) then
    raise exception 'La sentinella non e'' entrata fra i lavori sorvegliati.';
  end if;

  -- (2) …e NON si segnala da se': se lo facesse, sarebbe sorvegliata per finta.
  if exists (select 1 from lavori_in_silenzio() where nome_lavoro = 'sentinella') then
    raise exception 'La sentinella si sorveglia da se'': lavori_in_silenzio() la nomina.';
  end if;

  -- ⚠️ Da qui in avanti si parla come TITOLARE: una migrazione gira come
  -- proprietaria del database, quindi `auth.uid()` e' vuoto e `is_titolare()`
  -- e' FALSO — le funzioni con portiere rifiuterebbero (trappola del 16/08).
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- (3) PRIMA: nessun battito, quindi la sorveglianza risulta ferma.
  --     ⚠️ Il caso «mai battuto» e' quello vero del 29/08, non un caso
  --     di scuola: `stato_lavori` non aveva nessuna riga della sentinella.
  delete from stato_lavori where nome = 'sentinella';
  select sf.ferma, sf.minuti into v_ferma, v_minuti from sorveglianza_ferma() sf;
  if not v_ferma or v_minuti <> -1 then
    raise exception 'Senza nessun battito la sorveglianza doveva risultare ferma (ferma=%, minuti=%).',
      v_ferma, v_minuti;
  end if;

  -- (4) La sentinella gira e lascia la traccia.
  select ultimo_successo into v_prima from stato_lavori where nome = 'sentinella';
  perform controlla_lavori_pianificati();
  select ultimo_successo into v_dopo from stato_lavori where nome = 'sentinella';
  if v_dopo is null then
    raise exception 'La sentinella ha girato e non ha lasciato nessun battito.';
  end if;
  if v_prima is not null then
    raise exception 'Il battito esisteva gia'': la prova del punto 3 non provava niente.';
  end if;

  -- (5) DOPO: con un battito fresco non e' piu' ferma.
  select sf.ferma into v_ferma from sorveglianza_ferma() sf;
  if v_ferma then
    raise exception 'Appena girata, la sorveglianza risulta ancora ferma.';
  end if;

  -- (6) 🔴 LA PROVA CHE CONTA: si riproduce lo stato vero — la sentinella
  --     ferma da due ore — e si pretende che il gestionale LO DICA.
  --     Senza questo controllo, tutto il resto sarebbe un dato che nessuno
  --     guarda, cioe' il difetto del 28/08 in una forma nuova.
  update stato_lavori set ultimo_successo = now() - interval '2 hours' where nome = 'sentinella';
  select a.quanti into v_quanti from avvisi_del_gestionale() a where a.chiave = 'sorveglianza';
  if coalesce(v_quanti, 0) <> 1 then
    raise exception 'Sorveglianza ferma da due ore e il gestionale non lo dice (quanti=%).',
      coalesce(v_quanti, -1);
  end if;

  -- (7) …e allo specchio: appena torna a battere, l'avviso sparisce. Un
  --     avviso che resta acceso dopo che il problema e' passato si impara
  --     a ignorare.
  update stato_lavori set ultimo_successo = now() where nome = 'sentinella';
  if exists (select 1 from avvisi_del_gestionale() a where a.chiave = 'sorveglianza') then
    raise exception 'La sorveglianza ha ripreso a battere e l''avviso resta acceso.';
  end if;

  -- (8) E LO STAFF RICEVE UN RIFIUTO, non un elenco vuoto: sapere che la
  --     sorveglianza e' ferma e' roba del titolare, e una risposta vuota
  --     si legge «va tutto bene» — che qui e' la bugia peggiore possibile.
  perform set_config('request.jwt.claims', null, true);
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_ok := false;
    begin
      perform * from sorveglianza_ferma();
      v_ok := true;
    exception when others then null;
    end;
    perform set_config('request.jwt.claims', null, true);
    if v_ok then
      raise exception 'Lo staff riesce a leggere lo stato della sorveglianza.';
    end if;
  end if;
  perform set_config('request.jwt.claims', null, true);

  -- ⚠️ NON si ripulisce il battito: e' un dato vero e legittimo, scritto
  -- dalla sentinella che ha girato davvero al punto (4). Cancellarlo
  -- farebbe risultare la sorveglianza ferma fino al giro successivo.
  select count(*) into v_lapidi_dopo from deleted_records;
  if v_lapidi_dopo <> v_lapidi_prima then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.',
      v_lapidi_dopo - v_lapidi_prima;
  end if;

  raise notice 'La sentinella lascia il proprio battito, non si sorveglia da se'', e il gestionale dice quando la sorveglianza e'' ferma.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000001', 'la_sentinella_lascia_una_traccia') on conflict (version) do nothing;
