-- 23/11/2026 — Revisione generale di work, punto 4: i buchi del «non far leggere all'AI» (documents.no_ai).
--
-- Il segno vale già per «Chiedi all'archivio», per la lettura dei documenti di MEMO, per l'elenco del Drive, per le
-- proposte della Scheda e per il confronto notturno. Restavano tre vie per cui il titolo, le controparti o la scadenza di un
-- documento riservato arrivavano comunque a MEMO:
--   1. le voci della Scheda nate da un documento (`scheda_voci.documento_id`) restavano nelle istruzioni di MEMO;
--   2. il promemoria «Scadenza documento: titolo» (collegato con `documents.task_id`) arrivava a MEMO dall'Agenda;
--   3. le risposte già date in una conversazione che aveva parlato di quel documento restavano nello storico
--      (questo si chiude in `memo-chat`, rilascio a parte: qui non c'è niente da fare nel database).
-- Oggi su work nessun documento ha il segno acceso e nessuna voce è collegata a un documento: nessun effetto per ora.
-- Si chiude PRIMA che Alessio cominci ad accenderlo.

-- ---------------------------------------------------------------------
-- 1. La Scheda
-- ---------------------------------------------------------------------
-- 🔴 Il testo composto serve a DUE cose, e vanno tenute separate:
--    · il LIMITE di 10.000 caratteri (il portiere `scheda_controlla_limiti`) conta TUTTE le voci attive: se ne contasse
--      meno, spegnere il segno su un documento potrebbe far sforare il limite dopo il fatto;
--    · il testo che va a MEMO (`scheda_per_memo`) non porta le voci di un documento riservato.
--    Per questo `scheda_compone_testo` prende un terzo parametro (spento di partenza: chi lo chiama come prima ottiene
--    lo stesso testo di prima) e solo `scheda_per_memo` lo accende.
drop function if exists scheda_compone_testo(uuid, scheda_voci);

create or replace function scheda_compone_testo(
  p_escludi uuid default null, p_includi scheda_voci default null, p_solo_leggibili boolean default false
) returns text language sql stable security definer set search_path = public as $funzione$
  with sezioni(posizione, sezione, titolo) as (
    values (1, 'titolare', 'Titolare'), (2, 'societa', 'Società'),
      (3, 'locale', 'Locale'), (4, 'concept', 'Concept'),
      (5, 'fornitori', 'Fornitori'), (6, 'consulenti', 'Consulenti'),
      (7, 'decisioni', 'Decisioni'), (8, 'come_rispondere', 'Come rispondere')
  ), voci as (
    select id, numero, sezione, fonte, valida_dal, verificata_il, testo, ordine
      from scheda_voci
     where attiva and (p_escludi is null or id is distinct from p_escludi)
       and (not p_solo_leggibili
            or not exists (select 1 from documents d where d.id = scheda_voci.documento_id and d.no_ai))
    union all
    select (p_includi).id, (p_includi).numero, (p_includi).sezione,
      (p_includi).fonte, (p_includi).valida_dal, (p_includi).verificata_il,
      (p_includi).testo, (p_includi).ordine
      where (p_includi).id is not null and (p_includi).attiva
  ), blocchi as (
    select s.posizione, s.titolo || E'\n' || string_agg(
      scheda_riga_per_memo(v.numero, v.sezione, v.fonte, v.valida_dal, v.verificata_il, v.testo),
      E'\n' order by v.ordine, v.numero
    ) as testo
    from sezioni s join voci v on v.sezione = s.sezione
    group by s.posizione, s.titolo
  )
  select coalesce(string_agg(testo, E'\n\n' order by posizione), '') from blocchi
$funzione$;

revoke all on function scheda_compone_testo(uuid, scheda_voci, boolean) from public, anon, authenticated;

-- La Scheda per MEMO: il testo senza le voci dei documenti riservati; i contatori (voci e caratteri, che la pagina
-- confronta col limite) restano quelli di TUTTE le voci attive. La «versione» (che MEMO usa per sapere se la Scheda è
-- cambiata) porta anche quante voci sono escluse: accendere o spegnere il segno su un documento cambia il testo e deve
-- cambiare la versione.
create or replace function scheda_per_memo()
returns jsonb language plpgsql stable security definer set search_path = public as $funzione$
declare v_voci integer; v_escluse integer; v_aggiornata timestamptz; v_testo text; v_pieno text;
begin
  if not is_titolare() then raise exception 'Solo il titolare può leggere la Scheda per MEMO.'; end if;
  select count(*) filter (where attiva), max(aggiornata_il) into v_voci, v_aggiornata from scheda_voci;
  select count(*) into v_escluse from scheda_voci v
   where v.attiva and exists (select 1 from documents d where d.id = v.documento_id and d.no_ai);
  v_pieno := scheda_compone_testo();
  v_testo := scheda_compone_testo(null, null, true);
  return jsonb_build_object(
    'versione', coalesce(to_char(v_aggiornata at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'vuota') || ':' || v_voci || ':' || v_escluse,
    'caratteri', char_length(v_pieno), 'voci', v_voci, 'testo', v_testo
  );
end;
$funzione$;

revoke all on function scheda_per_memo() from public, anon, authenticated;
grant execute on function scheda_per_memo() to authenticated;

-- ---------------------------------------------------------------------
-- 2. L'Agenda letta da MEMO
-- ---------------------------------------------------------------------
-- Stesso corpo vivo della 20261115000013, più un filtro: un promemoria collegato a un documento riservato
-- (`documents.task_id`) non va a MEMO. (Nell'Agenda della pagina resta: la pagina è di Alessio, non del modello.)
create or replace function memo_leggi_agenda(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with tutte as (
    select a.id as rid, a.title as titolo, a.due_date as scad, a.due_time as ora,
           jsonb_build_object('data', a.due_date, 'ora', a.due_time, 'corsia', a.corsia,
             'categoria', a.category, 'descrizione', a.description) as dettaglio,
           count(*) over () as n
      from agenda_corsie() a
     where (p_cerca is null or a.title ilike '%' || p_cerca || '%' or coalesce(a.description, '') ilike '%' || p_cerca || '%')
       and not exists (select 1 from documents d where d.task_id = a.id and d.no_ai)
  )
  select t.rid, t.titolo, t.dettaglio, t.n::integer, 0::numeric from tutte t
   order by t.scad nulls last, t.ora nulls last, t.rid limit 50;
end $fn$;

revoke all on function memo_leggi_agenda(text) from public, anon, authenticated;
grant execute on function memo_leggi_agenda(text) to authenticated;

-- 🔴 IL CONFRONTO NOTTURNO di MEMO (20261115000017) paragona `memo_leggi_agenda(null)` con `count(*) from agenda_corsie()`.
--    Ora la lettura di MEMO salta i promemoria dei documenti riservati: se il confronto li contasse, ogni documento
--    riservato con un promemoria farebbe scattare un allarme finto ogni notte. Si ripara il corpo VIVO della funzione
--    (cambia una sola riga, controllata: deve comparire una volta sola).
do $confronto$
declare
  v_vecchio constant text := 'select count(*)::integer into v_pc from agenda_corsie();';
  v_nuovo   constant text := 'select count(*)::integer into v_pc from agenda_corsie() a where not exists (select 1 from documents d where d.task_id = a.id and d.no_ai);';
  v_def     text;
  v_n       integer;
begin
  v_def := replace(pg_get_functiondef('public.memo_confronta_con_le_pagine()'::regprocedure), E'\r', '');
  if v_def like '%' || v_nuovo || '%' then return; end if;
  v_n := (length(v_def) - length(replace(v_def, v_vecchio, ''))) / length(v_vecchio);
  if v_n <> 1 then
    raise exception 'memo_confronta_con_le_pagine non ha una sola riga «%» (ne ha %): confronta il corpo vivo prima di applicare.', v_vecchio, v_n;
  end if;
  execute replace(v_def, v_vecchio, v_nuovo);
end $confronto$;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit uuid;
  v_doc uuid;
  v_task uuid;
  v_voce uuid;
  v_n integer;
  v_prima jsonb;
  v_dopo jsonb;
  v_dopo_riattivato jsonb;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'VERIFICA: nessun titolare.'; end if;

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
    set local role authenticated;

    insert into documents (title, doc_type, document_date) values ('ZZ Documento riservato prova', 'contratti', date '2026-10-01') returning id into v_doc;
    insert into tasks (title, due_date, category, origine_modulo) values ('ZZ Scadenza documento riservato prova', current_date + 5, 'Documenti', 'archivio_documenti') returning id into v_task;
    update documents set task_id = v_task where id = v_doc;
    insert into scheda_voci (sezione, chiave, testo, fonte, documento_id)
      values ('societa', 'societa:zz-riservato-prova', 'Voce ZZ nata da un documento riservato inventato.', 'documentato', v_doc)
      returning id into v_voce;

    -- (1) col segno SPENTO la voce e il promemoria arrivano a MEMO.
    v_prima := scheda_per_memo();
    if position('Voce ZZ nata da un documento riservato' in v_prima->>'testo') = 0 then
      raise exception 'VERIFICA (1a): col segno spento la voce non arriva a MEMO.';
    end if;
    select count(*) into v_n from memo_leggi_agenda('ZZ Scadenza documento riservato prova');
    if v_n <> 1 then raise exception 'VERIFICA (1b): col segno spento il promemoria non arriva a MEMO (%).', v_n; end if;

    -- (2) col segno ACCESO la voce e il promemoria NON arrivano a MEMO; i contatori restano quelli di tutte le voci.
    update documents set no_ai = true where id = v_doc;
    v_dopo := scheda_per_memo();
    if position('Voce ZZ nata da un documento riservato' in v_dopo->>'testo') > 0 then
      raise exception 'VERIFICA (2a): col segno acceso la voce arriva ancora a MEMO.';
    end if;
    select count(*) into v_n from memo_leggi_agenda('ZZ Scadenza documento riservato prova');
    if v_n <> 0 then raise exception 'VERIFICA (2b): col segno acceso il promemoria arriva ancora a MEMO (%).', v_n; end if;
    if (v_dopo->>'caratteri')::integer <> (v_prima->>'caratteri')::integer or (v_dopo->>'voci')::integer <> (v_prima->>'voci')::integer then
      raise exception 'VERIFICA (2c): i contatori contro il limite devono contare tutte le voci attive.';
    end if;
    if v_dopo->>'versione' = v_prima->>'versione' then
      raise exception 'VERIFICA (2d): la versione non cambia: MEMO terrebbe in cache il testo vecchio.';
    end if;

    -- (3) spento di nuovo, tutto torna com'era.
    update documents set no_ai = false where id = v_doc;
    v_dopo_riattivato := scheda_per_memo();
    if v_dopo_riattivato->>'testo' <> v_prima->>'testo' then
      raise exception 'VERIFICA (3): spento il segno, il testo per MEMO non torna quello di prima.';
    end if;
    select count(*) into v_n from memo_leggi_agenda('ZZ Scadenza documento riservato prova');
    if v_n <> 1 then raise exception 'VERIFICA (3b): spento il segno, il promemoria non torna a MEMO (%).', v_n; end if;

    reset role;
    raise exception 'ZZ_ANNULLA';
  exception when others then
    reset role;
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;
  perform set_config('request.jwt.claims', null, true);

  if exists (select 1 from documents where title like 'ZZ Documento riservato prova%')
     or exists (select 1 from tasks where title like 'ZZ Scadenza documento riservato prova%')
     or exists (select 1 from scheda_voci where chiave = 'societa:zz-riservato-prova') then
    raise exception 'VERIFICA (4): resta un residuo della verifica.';
  end if;
  if has_function_privilege('anon', 'scheda_per_memo()', 'execute')
     or has_function_privilege('anon', 'memo_leggi_agenda(text)', 'execute')
     or has_function_privilege('authenticated', 'scheda_compone_testo(uuid, scheda_voci, boolean)', 'execute') then
    raise exception 'VERIFICA (5): permessi sulle funzioni diversi da quelli dichiarati.';
  end if;

  if pg_get_functiondef('public.memo_confronta_con_le_pagine()'::regprocedure) not like '%d.task_id = a.id and d.no_ai%' then
    raise exception 'VERIFICA (6): il confronto notturno non salta i promemoria dei documenti riservati.';
  end if;

  raise notice 'Fatto: un documento con «non far leggere all''AI» non porta più a MEMO le sue voci della Scheda né il suo promemoria dell''Agenda; i contatori contro il limite contano tutto. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261123000002', 'no_ai_chiude_scheda_e_agenda')
on conflict (version) do nothing;
