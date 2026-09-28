-- =====================================================================
-- LE VERIFICHE NEL REGISTRO, TROVATE DA UN INDICE
-- 28/09/2026
-- =====================================================================
-- Nasce dal rosso della PR #134 (corsa 36349917319, 27/09):
--   tests/app/registri-esibibili.test.js > «il registro delle cancellazioni
--   non conserva le righe delle verifiche» → 57014, statement timeout.
--
-- ---------------------------------------------------------------------
-- LA MISURA, sul progetto di prova, in sola lettura, il 28/09
-- ---------------------------------------------------------------------
--   · `deleted_records` ha 102.394 righe (68.891 il 15/09: circa 2.600 in
--     più al giorno, le lasciano le prove stesse), 71 MB;
--   · le righe con «verifica» sono 0;
--   · la ricerca di `lapidi_delle_verifiche()`, da titolare e con la RLS:
--     Seq Scan, 102.394 righe scartate, 1.091 ms a database fermo — e
--     nei controlli GitHub fra 3,7 e 9,0 s, oltre il limite di 8 s.
--
-- 🔴 LA CURA DEL 15/09 AVEVA SPOSTATO IL TETTO, NON L'AVEVA TOLTO: la
--    migrazione `20260915000001` lo scriveva nel suo stesso commento («il
--    costo resta proporzionale al registro»). Questa lo toglie senza toccare
--    né la funzione né il registro: un indice PARZIALE con lo STESSO
--    predicato del filtro, ordinato per la stessa colonna dell'`order by`.
--    L'indice contiene solo le righe che la funzione restituirebbe — oggi
--    zero — quindi la ricerca non legge più il registro.
--
-- ---------------------------------------------------------------------
-- LA DIMOSTRAZIONE, su un PostgreSQL 17.11 locale usa-e-getta (Prova è
-- 17.6), con 102.394 righe sintetiche e la stessa RLS, il 28/09
-- ---------------------------------------------------------------------
--   · senza indice, zero risultati: Seq Scan + Sort, 769,7 ms; funzione
--     671,4 ms;
--   · con l'indice, zero risultati: Index Scan using
--     idx_deleted_records_verifiche, nessun Sort, 0,043 ms; funzione
--     0,888 ms. Con le impostazioni DI SERIE del pianificatore;
--   · con sei righe pertinenti (maiuscolo, iniziale maiuscola, dentro
--     un'altra parola, come CHIAVE del json, annidata, in un campo che la
--     firma non legge) e quattro quasi-parole: stesso Index Scan, 0,55 ms,
--     stesse 6 righe e stesso ordine che con la lettura intera forzata, in
--     tutti e due i versi, sia la SELECT sia la funzione;
--   · il piano DENTRO la funzione (auto_explain): Index Scan sullo stesso
--     indice;
--   · lo staff riceve ancora il rifiuto.
--
-- ⚠️ SEMANTICA: il predicato dell'indice è la stessa espressione del filtro
--    della funzione — PostgreSQL lo mostra come
--    `((record)::text ~~* '%verifica%'::text)` in tutti e due i posti — e il
--    pianificatore usa un indice parziale SOLO quando dimostra che il filtro
--    della query implica il predicato. Se la funzione cambiasse filtro,
--    l'indice smetterebbe di servire in silenzio: per questo la verifica qui
--    sotto rilegge il corpo vivo della funzione.
--
-- ⚠️ COSA NON CAMBIA: `lapidi_delle_verifiche()`, `lapidi_di_prova()`,
--    la RLS, i permessi, i limiti di tempo, le righe del registro. Nessuna
--    estensione.
-- ⚠️ IL PREZZO, dichiarato: ogni riga nuova del registro calcola una volta
--    `record::text ilike '%verifica%'` per sapere se entra nell'indice. Sulle
--    tabelle sorvegliate si cancella a mano, una riga alla volta.
-- ⚠️ NON CONCORRENTE, apposta: le migrazioni girano dentro `psql -f`, e
--    l'indice si costruisce leggendo il registro una volta sola (circa un
--    secondo su Prova); in produzione il registro è piccolo.
-- =====================================================================

create index if not exists idx_deleted_records_verifiche
  on deleted_records (deleted_at)
  where record::text ilike '%verifica%';

comment on index idx_deleted_records_verifiche is
  'Solo le lapidi il cui record contiene «verifica»: le trova lapidi_delle_verifiche() senza leggere tutto il registro. Il predicato DEVE restare identico al filtro di quella funzione (28/09/2026).';


-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
-- ⚠️ Non scrive niente: nessuna riga nel registro, nessuna cancellazione.
--    Guarda il catalogo, il corpo vivo della funzione e il piano (EXPLAIN
--    senza ANALYZE, quindi senza eseguire la ricerca).
do $verifica$
declare
  v_def    text;
  v_pred   text;
  v_corpo  text;
  v_piano  text := '';
  v_riga   record;
  v_ruolo  text;
  v_seq    text;
  v_claims text;
  v_tit    uuid;
  v_n      bigint;
  v_m      bigint;
begin
  -- 1. L'indice c'è, è valido, è un btree sulla SOLA colonna deleted_at, e
  --    il predicato è esattamente quello della funzione.
  select pg_get_indexdef(i.indexrelid), pg_get_expr(i.indpred, i.indrelid)
    into v_def, v_pred
    from pg_index i
   where i.indexrelid = to_regclass('public.idx_deleted_records_verifiche');
  if v_def is null then
    raise exception 'VERIFICA: l''indice idx_deleted_records_verifiche non c''e''.';
  end if;
  if not exists (select 1 from pg_index i
                  where i.indexrelid = 'public.idx_deleted_records_verifiche'::regclass
                    and i.indisvalid and i.indisready
                    and i.indrelid = 'public.deleted_records'::regclass) then
    raise exception 'VERIFICA: l''indice non e'' valido o non e'' sul registro delle cancellazioni.';
  end if;
  if v_def not like '%USING btree (deleted_at) WHERE%' then
    raise exception 'VERIFICA: l''indice non e'' ordinato per la sola deleted_at: %', v_def;
  end if;
  if v_pred is distinct from '((record)::text ~~* ''%verifica%''::text)' then
    raise exception 'VERIFICA: il predicato dell''indice e'' cambiato: %', v_pred;
  end if;

  -- 2. La funzione cerca ancora con quel filtro e con quell'ordine: se no,
  --    l'indice non la servirebbe piu', e nessun errore lo direbbe.
  --    ⚠️ Si guarda il corpo SENZA i commenti e con gli spazi e le maiuscole
  --    ridotti (revisione Codex del 28/09): un commento che ripetesse il
  --    vecchio filtro non deve bastare a far passare un filtro cambiato, e
  --    una riga andata a capo diversamente non deve far fallire.
  select lower(regexp_replace(regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), '\s+', ' ', 'g'))
    into v_corpo
    from pg_proc p
   where p.oid = 'public.lapidi_delle_verifiche()'::regprocedure;
  if v_corpo not like '%from deleted_records d where d.record::text ilike ''\%verifica\%'' order by d.deleted_at;%' then
    raise exception 'VERIFICA: lapidi_delle_verifiche non ha piu'' il filtro o l''ordine che l''indice serve.';
  end if;

  -- 3. Il piano della SELECT della funzione, da titolare e con la RLS: usa
  --    l'indice, non legge il registro, non riordina. ⚠️ La lettura intera
  --    si scoraggia (`enable_seqscan`) solo per chiedere al pianificatore se
  --    l'indice PUO' servire la query: su un registro piccolo, come quello
  --    della produzione, leggerlo tutto costerebbe meno e sceglierebbe
  --    quello — senza che sia un difetto. Che lo scelga da solo su un
  --    registro grande è misurato nella dimostrazione qui sopra.
  select user_id into v_tit from user_roles where role = 'titolare' order by created_at limit 1;
  if v_tit is null then
    raise exception 'VERIFICA: serve un titolare in user_roles.';
  end if;
  -- Le impostazioni di partenza si salvano e si rimettono com'erano:
  -- `npm run migra` applica il file in una transazione sola, e quello che si
  -- cambia qui resterebbe per le istruzioni che seguono.
  v_ruolo  := current_setting('role');
  v_seq    := current_setting('enable_seqscan');
  v_claims := current_setting('request.jwt.claims', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform set_config('enable_seqscan', 'off', true);
  for v_riga in execute $q$
    explain (costs off)
    select d.id, d.table_name::text,
           left(coalesce(d.record->>'business_purpose', d.record->>'invoice_number',
                         d.record->>'note', d.record->>'description',
                         d.record->>'customer_name', d.record->>'full_name',
                         d.record->>'free_text_name', d.record::text), 60),
           d.deleted_at
      from deleted_records d
     where d.record::text ilike '%verifica%'
     order by d.deleted_at
  $q$ loop
    v_piano := v_piano || v_riga."QUERY PLAN" || E'\n';
  end loop;
  perform set_config('enable_seqscan', v_seq, true);
  if v_piano not like '%Index Scan using idx_deleted_records_verifiche on deleted_records%'
     or v_piano like '%Seq Scan on deleted_records%' then
    raise exception 'VERIFICA: la ricerca non usa l''indice delle verifiche: %', v_piano;
  end if;
  -- Nessun Sort in tutto il piano: l'ordine per deleted_at lo da' l'indice,
  -- non una lettura da riordinare.
  if v_piano like '%Sort%' then
    raise exception 'VERIFICA: il piano riordina, l''ordine non viene dall''indice: %', v_piano;
  end if;

  -- 4. D'accordo con lapidi_di_prova(), che non e' toccata: stesso conteggio
  --    delle verifiche, dallo stesso ruolo e con gli stessi claims del
  --    piano (titolare, `authenticated`, RLS attiva).
  select count(*) into v_n from lapidi_delle_verifiche();
  select count(*) into v_m from lapidi_di_prova() l where l.perche = 'verifica di una migrazione';
  if v_n is distinct from v_m then
    raise exception 'VERIFICA: le due funzioni non contano le stesse verifiche (% contro %).', v_n, v_m;
  end if;
  perform set_config('role', v_ruolo, true);
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);

  raise notice 'Verifica passata: l''indice ha il predicato della funzione, la ricerca lo usa senza riordinare, e le due funzioni contano % verifiche.', v_n;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260928000001', 'le_verifiche_trovate_da_un_indice') on conflict (version) do nothing;
