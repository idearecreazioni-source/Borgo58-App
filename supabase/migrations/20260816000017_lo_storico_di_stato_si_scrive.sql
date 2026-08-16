-- Lo storico di stato di una ricetta non si poteva scrivere.
--
-- 🔴 DIFETTO VERO, e trovato nel modo per cui il blocco dello stato di
-- partenza esiste: costruendolo con le funzioni VERE dell'app, la prima
-- ricetta segnata «pronta per carta» ha risposto
--
--     42501 — new row violates row-level security policy
--             for table "recipe_status_history"
--
-- Il trigger `log_recipe_status_change` e' `security invoker`: gira coi
-- permessi di chi ha fatto la modifica. Su `recipe_status_history`
-- l'unico permesso concesso e' `select` (migrazione `20260802000003`, che
-- nel commento dichiara di volerci scrivere e poi non concede l'insert).
-- Risultato: **da nessuna schermata si poteva marcare una ricetta
-- «pronta per carta» o toglierle quel segno.** Non un errore silenzioso —
-- un errore incomprensibile in faccia, sopra un gesto normale.
--
-- ⚠️ PERCHE' NON SE N'ERA ACCORTO NESSUNO, ed e' la parte da tenere: il
-- Ricettario in produzione e' VUOTO (0 ricette). Le verifiche dentro le
-- migrazioni non potevano vederlo, perche' girano come proprietarie del
-- database e le proprietarie scavalcano la RLS. Le prove automatiche
-- nemmeno: nessuna cambiava quel campo su una ricetta esistente. Serviva
-- qualcuno che facesse **il gesto vero, col token di un utente vero**, ed
-- e' esattamente quello che fa `npm run prova:base`.
--
-- La cura e' il pattern gia' scritto in CLAUDE.md §6: una funzione che
-- deve scrivere fuori dai permessi di chi la chiama e' `security definer`
-- con `search_path` fissato. Lo storico resta **non scrivibile** dai
-- client (nessuna policy di insert, nessun grant): lo riempie solo il
-- trigger, come `deleted_records`.

create or replace function log_recipe_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pronta_per_carta is distinct from old.pronta_per_carta
     or new.in_carta is distinct from old.in_carta then
    insert into recipe_status_history (recipe_id, pronta_per_carta, in_carta)
    values (new.id, new.pronta_per_carta, new.in_carta);
  end if;
  return new;
end;
$$;

comment on function log_recipe_status_change() is
  'Scrive lo storico di stato di una ricetta. SECURITY DEFINER dal 16/08/2026: era invoker, e su recipe_status_history i client hanno solo la lettura — quindi nessuno poteva marcare una ricetta «pronta per carta». Lo storico resta non scrivibile dall''applicazione: lo riempie solo questo trigger.';

-- ⚠️ E ora che e' `security definer` la revoca non e' piu' una formalita':
-- una funzione definer eseguibile con la chiave pubblica sarebbe una porta
-- aperta. Come funzione di trigger non ha bisogno di nessun permesso —
-- la esegue il motore per conto di `recipes`.
revoke all on function log_recipe_status_change() from public, anon, authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
--
-- ⚠️ Quello che questa verifica NON puo' provare, detto subito: una
-- migrazione gira come proprietaria del database, e le proprietarie
-- scavalcano la RLS. Il difetto qui sopra sarebbe passato verde anche
-- prima della correzione. La prova del gesto vero sta in
-- `tests/app/in-carta-riflesso.test.js`, che scrive col token di un
-- utente vero — ed e' l'unico posto dove questo difetto e' visibile.
-- Qui si controllano le proprieta' che la migrazione governa davvero.
do $verifica$
declare
  r        uuid;
  n        int;
  corpo    text;
begin
  -- 1. La funzione e' definer e ha il search_path fissato. Si legge dal
  --    catalogo, non dal file: il file potrebbe non essere quello applicato.
  select prosecdef::text || '|' || coalesce(array_to_string(proconfig, ','), '')
    into corpo
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'log_recipe_status_change';
  if corpo not like 'true|%' then
    raise exception 'log_recipe_status_change non e'' security definer.';
  end if;
  if corpo not like '%search_path=public%' then
    raise exception 'log_recipe_status_change non ha il search_path fissato: %', corpo;
  end if;

  -- 2. Non e' piu' raggiungibile da fuori.
  if has_function_privilege('anon', 'log_recipe_status_change()', 'execute')
     or has_function_privilege('authenticated', 'log_recipe_status_change()', 'execute') then
    raise exception 'log_recipe_status_change e'' rimasta eseguibile dall''esterno.';
  end if;

  -- 3. Il trigger e' ancora attaccato e acceso: `create or replace` della
  --    funzione non lo tocca, ma «non dovrebbe cambiare niente» non e' una
  --    verifica.
  select count(*) into n
    from pg_trigger
   where tgrelid = 'recipes'::regclass and tgname = 'trg_recipe_status_history' and tgenabled = 'O';
  if n <> 1 then
    raise exception 'Il trigger dello storico di stato non e'' attivo su recipes.';
  end if;

  -- 4. E scrive davvero: si cambia lo stato di una ricetta di prova e la
  --    riga deve comparire. (Qui prova che la scrittura AVVIENE, non che
  --    sia permessa a un utente: quello lo prova la suite.)
  insert into recipes (name, category, recipe_type, portions_yield, pronta_per_carta)
  values ('__VERIFICA__ storico', 'primo', 'piatto_finito', 4, false) returning id into r;
  update recipes set pronta_per_carta = true where id = r;
  select count(*) into n from recipe_status_history where recipe_id = r;
  if n <> 1 then
    raise exception 'Cambiando lo stato sono comparse % righe di storico invece di 1.', n;
  end if;

  -- 5. Su `recipe_status_history` nessun client puo' scrivere: la cura non
  --    doveva aprire la tabella a nessuno.
  --
  -- ⚠️ Trovato scrivendo questo controllo, e vale la pena saperlo: il
  -- PERMESSO di insert sulla tabella `authenticated` ce l'ha (glielo dà
  -- Supabase a tutte le tabelle dello schema). Non e' quello a tenere
  -- chiusa la porta — la tiene chiusa la RLS accesa **senza nessuna policy
  -- di scrittura**. Guardare il permesso avrebbe dato un allarme falso, e
  -- un allarme falso in una migrazione si disattiva e non torna piu'.
  if not (select relrowsecurity from pg_class where oid = 'recipe_status_history'::regclass) then
    raise exception 'La RLS su recipe_status_history e'' spenta: chiunque potrebbe scriverci.';
  end if;
  select count(*) into n from pg_policies
   where tablename = 'recipe_status_history' and cmd in ('INSERT', 'ALL', 'UPDATE', 'DELETE');
  if n <> 0 then
    raise exception 'E'' comparsa una policy di scrittura su recipe_status_history.';
  end if;

  delete from recipe_status_history where recipe_id = r;
  delete from recipes where id = r;
  select count(*) into n from recipes where name like '__VERIFICA__%';
  if n <> 0 then raise exception 'Restano % ricette di prova.', n; end if;

  raise notice 'Lo storico di stato si scrive, e la tabella resta in sola lettura per i client.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260816000017', 'lo_storico_di_stato_si_scrive')
on conflict (version) do nothing;

select
  (select count(*) from recipe_status_history)                          as righe_di_storico,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')) as aperte_alla_chiave_pubblica;
