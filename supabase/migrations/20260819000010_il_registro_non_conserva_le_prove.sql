-- =====================================================================
-- IL REGISTRO DELLE CANCELLAZIONI NON CONSERVA LE PROVE
-- 19/08/2026
-- =====================================================================
-- 🔴 TROVATO APPLICANDO, non rileggendo. Dopo aver applicato in produzione
-- le otto migrazioni del 19/08, le lapidi in `deleted_records` sono passate
-- da 26 a 31: cinque righe finte, lasciate dalle verifiche di
-- `20260819000003`, `…004` e `…005`. Quelle verifiche cancellano da se' i
-- movimenti di prova che si erano costruite — e cancellandoli fanno
-- scattare il trigger che ne conserva una copia nel registro.
--
-- ⚠️ NON E' UN FASTIDIO D'ORDINE, ed e' il motivo per cui si corregge
-- subito. `deleted_records` e' un registro **esibibile**: conserva una
-- copia integrale di ogni riga cancellata dalle tabelle di soldi, fisco,
-- lavoro e documenti, e nessuno lo puo' ripulire dall'app (giustamente).
-- Righe finte li' dentro sono la stessa cosa di dati di prova in mezzo ai
-- dati veri — la regola di Alessio del 12/08: *da quando entra roba vera,
-- una riga finta indistinguibile da una vera toglie fiducia a tutto quello
-- che il gestionale dice.*
--
-- ⚠️ E ROMPE UN GUARDIANO. Dal 16/08 le migrazioni si difendono con una
-- proprieta': «le lapidi prima e dopo devono essere le stesse». Il 17/08
-- quel guardiano ha funzionato — quelle verifiche ripulivano le proprie
-- lapidi. Se il registro cresce ogni volta che si applica una migrazione,
-- quella proprieta' smette di poter essere affermata da chiunque.
--
-- ⚠️ IL PERIMETRO E' STRETTO E DICHIARATO: si tolgono **solo** le lapidi
-- di `cash_movements` la cui causale d'uso comincia con «Spesa: VERIFICA»,
-- che e' la firma che quelle tre verifiche si sono date. Nessun'altra riga
-- viene toccata, e il blocco di verifica lo controlla nei due versi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · La domanda vive in un posto solo
-- ---------------------------------------------------------------------
-- 🔴 PERCHE' UNA FUNZIONE E NON UNA QUERY NELLA PROVA. La prima stesura
-- della prova automatica leggeva TUTTE le lapidi dal client e cercava la
-- parola fra quelle — e non e' diventata rossa quando le ho messo davanti
-- una lapide finta apposta. Il motivo, misurato: **PostgREST restituisce al
-- massimo mille righe**, e sul progetto di prova le lapidi sono ben oltre. Il
-- controllo guardava una parte del registro credendo di guardarlo tutto.
--
-- ⚠️ E' la famiglia dell'avvertenza dell'08/08 sui `.limit()` nelle liste
-- HACCP e di prima nota: *un documento che sembra completo senza esserlo*.
-- Li' il limite era scritto da noi, qui e' il predefinito del gateway — che
-- e' peggio, perche' non si vede leggendo il codice.
--
-- La domanda si fa quindi al database, che le righe le ha tutte, e la
-- risposta e' la stessa che usa la pulizia qui sotto: un posto solo.
-- Il tipo del risultato non si può cambiare con un `create or replace`, e
-- questa funzione oggi nasce: si toglie prima, così la migrazione resta
-- rieseguibile (§7 punto 3). ⚠️ Dopo un `drop` i permessi tornano aperti al
-- mondo — è il motivo per cui il `revoke` qui sotto non è facoltativo.
drop function if exists lapidi_di_prova();

create or replace function lapidi_di_prova()
returns table (id bigint, tabella text, firma text)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not is_titolare() then
    raise exception 'Il registro delle cancellazioni e'' riservato al titolare.';
  end if;

  return query
  select d.id, d.table_name::text,
         left(coalesce(d.record->>'business_purpose', d.record->>'invoice_number',
                       d.record->>'note', d.record::text), 60)
    from deleted_records d
   where d.record::text ilike '%verifica%'
   order by d.deleted_at;
end;
$function$;

comment on function lapidi_di_prova() is
  'Le righe del registro delle cancellazioni che nominano una verifica, cioe'' i residui di una migrazione. Deve restituire zero righe: la prova che lo controlla e'' in tests/app/registri-esibibili.test.js.';

revoke all on function lapidi_di_prova() from public, anon, authenticated;
grant execute on function lapidi_di_prova() to authenticated;


-- ---------------------------------------------------------------------
-- 2 · La pulizia
-- ---------------------------------------------------------------------
do $pulizia$
declare
  v_prima   integer;
  v_sporche integer;
  v_pulite  integer;
  v_dopo    integer;
  v_altre   integer;
begin
  select count(*) into v_prima from deleted_records;
  select count(*) into v_sporche
    from deleted_records
   where table_name = 'cash_movements'
     and record->>'business_purpose' like 'Spesa: VERIFICA%';
  v_pulite := v_prima - v_sporche;

  -- ⚠️ Il perimetro si CONTROLLA prima di cancellare: se la firma
  -- prendesse anche una tabella diversa da `cash_movements`, vorrebbe dire
  -- che si e' allargata da sola e non si tocca niente.
  select count(*) into v_altre
    from deleted_records
   where table_name <> 'cash_movements'
     and record::text like '%Spesa: VERIFICA%';
  if v_altre <> 0 then
    raise exception 'La firma delle verifiche compare anche su % righe di altre tabelle: perimetro da rifare.', v_altre;
  end if;

  delete from deleted_records
   where table_name = 'cash_movements'
     and record->>'business_purpose' like 'Spesa: VERIFICA%';

  -- ⚠️ SI DICHIARA QUANTE RIGHE HA TOCCATO, anche quando sono zero (regola
  -- del 16/08): uno zero non e' un errore — vuol dire «gia' fatto», o
  -- «questo database non le aveva» — ma il silenzio ha gia' ingannato
  -- quattro volte.
  raise notice 'Lapidi di prova tolte: % (prima: %, restano: %).', v_sporche, v_prima, v_pulite;

  -- =========== LA PROPRIETA', non il numero ===========
  -- «Le cancellazioni autentiche prima e dopo devono essere le stesse»:
  -- e' vera su tutti e due i database e resta vera domani, mentre un
  -- numero letto oggi in produzione sarebbe un fossile (16/08).
  select count(*) into v_dopo from deleted_records;
  if v_dopo <> v_pulite then
    raise exception 'Il registro e'' passato da % a % invece che a %: si e'' portato via righe autentiche.',
      v_prima, v_dopo, v_pulite;
  end if;

  -- ⚠️ E la si chiede alla FUNZIONE, la stessa che usa la prova: se un
  -- giorno la firma cambiasse, cambierebbe in un posto solo.
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select user_id from user_roles where role = 'titolare' limit 1),
                      'role', 'authenticated')::text, true);
  select count(*) into v_altre from lapidi_di_prova();
  perform set_config('request.jwt.claims', null, true);
  if v_altre <> 0 then
    raise exception 'Restano % lapidi che nominano una verifica.', v_altre;
  end if;
end $pulizia$;

insert into applied_migrations (version, name)
values ('20260819000010', 'il_registro_non_conserva_le_prove')
on conflict (version) do nothing;
