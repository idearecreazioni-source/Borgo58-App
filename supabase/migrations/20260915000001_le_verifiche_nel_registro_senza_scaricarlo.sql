-- =====================================================================
-- LE VERIFICHE NEL REGISTRO, SENZA SCARICARLO TUTTO
-- 15/09/2026
-- =====================================================================
-- Nasce dal rosso del controllo sul database di prova su master `e2e76b2`
-- (giro 34917192057, tentativo 2, 15/09 08:05 UTC):
--   tests/app/registri-esibibili.test.js > «il registro delle cancellazioni
--   non conserva le righe delle verifiche»
--   → 57014 «canceling statement due to statement timeout».
--
-- ---------------------------------------------------------------------
-- LA MISURA, sul progetto di prova, in sola lettura, il 15/09
-- ---------------------------------------------------------------------
--   · `authenticated` ha `statement_timeout = 8s`: la prova chiama col
--     titolare, quindi ha otto secondi;
--   · `deleted_records` ha 68.891 righe; `lapidi_di_prova()` ne restituisce
--     65.818 (11 MB di risposta) — e la prova ne usava ZERO: tiene solo
--     quelle «verifica di una migrazione», che sono 0;
--   · interrogazione + impacchettamento come fa PostgREST: 5,28 s;
--   · la stessa prova nei registri di GitHub: 4,4 s il 12/09, 5-6 s nella
--     notte fra il 14 e il 15/09, 8,26 s alle 07:54 del 15/09 → interrotta;
--   · cercare la sola parola «verifica»: 0,80-1,06 s, zero righe da spedire.
--
-- 🔴 IL REGISTRO DEL PROGETTO DI PROVA LO RIEMPIONO LE PROVE STESSE: fra
--    1.118 e 6.497 righe al giorno dal 02 al 14/09. La vecchia domanda
--    rallentava quindi a ogni giro di prove, fino a superare il limite — e il
--    rosso non dipendeva dal codice che si stava controllando.
--
-- ---------------------------------------------------------------------
-- LA CURA
-- ---------------------------------------------------------------------
-- Una funzione che chiede al database SOLO la prima categoria di
-- `lapidi_di_prova()` — le verifiche delle migrazioni — cioè l'unica che la
-- prova guarda. Stesso filtro, stessa firma leggibile.
--
-- ⚠️ `lapidi_di_prova()` NON SI TOCCA: serve a guardare anche le altre due
--    categorie, e in produzione il registro è piccolo.
--
-- ⚠️ DUE POSTI DICONO «verifica di una migrazione»: il primo ramo del `case`
--    di `lapidi_di_prova()` e il filtro di questa. La verifica qui sotto
--    pretende che rispondano uguale — sulle due lapidi costruite apposta e
--    nel conteggio totale — così non possono separarsi in silenzio.
--
-- ⚠️ IL LIMITE, dichiarato: il costo resta proporzionale al registro — si
--    scorre ancora ogni riga, con una parola invece di sei, e non si spedisce
--    niente. Il tetto si sposta, non sparisce. Toglierlo davvero vuol dire
--    decidere cosa fare del registro del progetto di prova (una pulizia,
--    cioè una scrittura sui dati), e quella è una decisione di Alessio.
--
-- ⚠️ SECURITY INVOKER, non definer: `deleted_records` lo legge già solo il
--    titolare (policy `deleted_records_select_titolare`), quindi decide la
--    RLS e non serve scavalcarla. Il portiere RIFIUTA chi titolare non è:
--    un elenco vuoto si leggerebbe «nessuna verifica ha lasciato tracce»
--    (regola del 13/08, ribadita il 27/08).
-- =====================================================================

create or replace function lapidi_delle_verifiche()
returns table (
  id            bigint,
  tabella       text,
  firma         text,
  cancellata_il timestamptz
)
language plpgsql
stable
security invoker
set search_path = public
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Il registro delle cancellazioni e'' riservato al titolare.';
  end if;

  -- ⚠️ Lo stesso filtro del primo ramo di `lapidi_di_prova()`: la verifica
  -- qui sotto pretende che le due rispondano uguale.
  return query
  select d.id, d.table_name::text,
         left(coalesce(d.record->>'business_purpose', d.record->>'invoice_number',
                       d.record->>'note', d.record->>'description',
                       d.record->>'customer_name', d.record->>'full_name',
                       d.record->>'free_text_name', d.record::text), 60),
         d.deleted_at
    from deleted_records d
   where d.record::text ilike '%verifica%'
   order by d.deleted_at;
end;
$funzione$;

comment on function lapidi_delle_verifiche() is
  'Le sole righe del registro delle cancellazioni lasciate dalle verifiche delle migrazioni: devono essere zero su qualunque database. È la prima categoria di lapidi_di_prova(), chiesta da sola: dal 15/09/2026 la prova tests/app/registri-esibibili.test.js usa questa, perché scaricare tutto il registro del progetto di prova (68.891 righe, 11 MB) superava il limite di 8 secondi.';

revoke all on function lapidi_delle_verifiche() from public, anon, authenticated;
grant execute on function lapidi_delle_verifiche() to authenticated;


-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
-- ⚠️ Due lapidi costruite apposta, DIRETTAMENTE nel registro: una che nomina
--    una verifica e una di prova che non la nomina. Senza la seconda la
--    verifica passerebbe anche con un filtro che restituisce tutto (regola
--    del caso vuoto). Nel registro e non cancellando un movimento vero:
--    `deleted_records` non ha né vincoli né trigger oltre alla chiave
--    (misurato sul progetto di prova il 15/09), quindi nessun effetto su
--    cassa, saldi o avvisi.
-- ⚠️ Si cancellano per identificativo, e alla fine si pretende che nessuna
--    tabella abbia cambiato numero di righe (regola del 23/08 e del 26/08).
do $verifica$
declare
  v_foto   jsonb := foto_righe();
  v_tit    uuid;
  v_staff  uuid;
  v_si     bigint;
  v_no     bigint;
  v_nota   text := 'VERIFICA-20260915000001 una lapide lasciata da una verifica';
  v_firma  text;
  v_perche text;
  v_n      bigint;
  v_m      bigint;
  v_preso  boolean := false;
begin
  -- 0. La forma: niente security definer, chiusa alla chiave pubblica,
  --    aperta al gestionale.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'lapidi_delle_verifiche' and p.prosecdef) then
    raise exception 'VERIFICA: lapidi_delle_verifiche e'' security definer: scavalcherebbe la RLS del registro.';
  end if;
  if has_function_privilege('anon', 'public.lapidi_delle_verifiche()'::regprocedure, 'execute') then
    raise exception 'VERIFICA: lapidi_delle_verifiche e'' eseguibile con la chiave pubblica.';
  end if;
  if not has_function_privilege('authenticated', 'public.lapidi_delle_verifiche()'::regprocedure, 'execute') then
    raise exception 'VERIFICA: lapidi_delle_verifiche non e'' eseguibile dal gestionale.';
  end if;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_tit is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles.';
  end if;

  -- 1. Le due lapidi.
  insert into deleted_records (table_name, record_id, record)
  values ('verifica_20260915000001', 'si', jsonb_build_object('note', v_nota))
  returning id into v_si;
  insert into deleted_records (table_name, record_id, record)
  values ('prova_20260915000001', 'no',
          jsonb_build_object('note', '__PROVA 20260915000001 una lapide di prova senza quella parola__'))
  returning id into v_no;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- 2. Quella che nomina una verifica c'e', con la sua firma.
  select l.firma into v_firma from lapidi_delle_verifiche() l where l.id = v_si;
  if v_firma is distinct from left(v_nota, 60) then
    raise exception 'VERIFICA: la lapide di una verifica non viene restituita (firma: %).', v_firma;
  end if;

  -- 3. Quella che non la nomina no, anche se e' una lapide di prova.
  if exists (select 1 from lapidi_delle_verifiche() l where l.id = v_no) then
    raise exception 'VERIFICA: una lapide senza la parola «verifica» viene restituita.';
  end if;

  -- 4. D'accordo con lapidi_di_prova(), che non deve essere cambiata: sulle
  --    due lapidi, e nel conteggio totale.
  select l.perche into v_perche from lapidi_di_prova() l where l.id = v_si;
  if v_perche is distinct from 'verifica di una migrazione' then
    raise exception 'VERIFICA: lapidi_di_prova non la chiama verifica (%).', v_perche;
  end if;
  select l.perche into v_perche from lapidi_di_prova() l where l.id = v_no;
  if v_perche is distinct from 'marcatore di una prova automatica' then
    raise exception 'VERIFICA: lapidi_di_prova non la chiama marcatore di prova (%).', v_perche;
  end if;
  select count(*) into v_n from lapidi_delle_verifiche();
  select count(*) into v_m from lapidi_di_prova() l where l.perche = 'verifica di una migrazione';
  if v_n is distinct from v_m then
    raise exception 'VERIFICA: le due funzioni non contano le stesse verifiche (% contro %).', v_n, v_m;
  end if;

  -- 5. Chi titolare non e' riceve un rifiuto, non un elenco vuoto.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  begin
    perform count(*) from lapidi_delle_verifiche();
  exception when others then
    v_preso := true;
  end;
  if not v_preso then
    raise exception 'VERIFICA: lo staff ha letto il registro delle cancellazioni.';
  end if;

  perform set_config('request.jwt.claims', null, true);

  -- pulizia: le due lapidi costruite qui, per identificativo, e nient'altro.
  delete from deleted_records where id in (v_si, v_no);
  perform pretendi_nessun_residuo(v_foto, 'la verifica di lapidi_delle_verifiche');

  raise notice 'Verifica passata: la domanda stretta vede la verifica, non la prova, e conta come lapidi_di_prova.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260915000001', 'le_verifiche_nel_registro_senza_scaricarlo') on conflict (version) do nothing;
