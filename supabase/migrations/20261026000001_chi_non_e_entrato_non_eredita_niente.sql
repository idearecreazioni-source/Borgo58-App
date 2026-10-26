-- =====================================================================
-- CHI NON È ENTRATO NON EREDITA NIENTE — 26/10/2026
-- =====================================================================
-- L'audit dei permessi (`supabase/diagnostica/20261026_audit_permessi.sql`)
-- lanciato sul gestionale vero il 26/10/2026 ha dato 16 righe nella
-- categoria «privilegi predefiniti per anon o PUBLIC». Il progetto di prova
-- non ne ha nessuna: non vengono dalle migrazioni, sono le impostazioni con
-- cui Supabase crea i progetti.
--
--   · ruolo postgres, tabelle: anon MAINTAIN, TRUNCATE, REFERENCES, TRIGGER
--   · ruolo supabase_admin, tabelle, sequenze e funzioni: anon tutto
--
-- OGGI NON APRONO NIENTE: anon non ha lettura né scrittura su nessuna
-- tabella o vista (stesso audit, categoria 3, zero righe), e quei
-- privilegi PostgREST non li espone. Ma un privilegio predefinito vale
-- per gli oggetti di DOMANI: è la serratura montata di serie sulle porte
-- nuove. Questa migrazione la toglie, e toglie gli stessi privilegi dalle
-- tabelle e dalle sequenze che ci sono già.
--
-- ⚠️ LE FUNZIONI NON SI TOCCANO. Le otto funzioni che anon deve poter
--    eseguire (il modulo pubblico di prenotazione, la chiave della voce e
--    tre funzioni di servizio) restano come sono: un `revoke` generale le
--    spegnerebbe. La verifica qui sotto controlla che siano ancora
--    eseguibili.
--
-- ⚠️ I PREDEFINITI DI supabase_admin si cambiano solo da supabase_admin.
--    Il tentativo è dentro un blocco che, se il permesso manca, lo dice e
--    va avanti: è una cosa della piattaforma, e su Supabase le tabelle di
--    questo gestionale le crea postgres. Il riepilogo riporta l'esito.
--
-- Idempotente: un `revoke` di ciò che non c'è non fa niente.
-- =====================================================================

-- 1. I predefiniti del ruolo che crea le tabelle del gestionale.
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon;

-- 2. Lo stesso per supabase_admin, se la piattaforma lo permette.
do $supabase_admin$
begin
  execute 'alter default privileges for role supabase_admin in schema public revoke all on tables from anon';
  execute 'alter default privileges for role supabase_admin in schema public revoke all on sequences from anon';
  execute 'alter default privileges for role supabase_admin in schema public revoke all on functions from anon';
  raise notice 'Predefiniti di supabase_admin per anon: tolti.';
exception when insufficient_privilege then
  raise notice 'Predefiniti di supabase_admin: questo ruolo non li può cambiare (%). Restano quelli della piattaforma.', sqlerrm;
end $supabase_admin$;

-- 3. Le tabelle e le sequenze che ci sono già.
revoke truncate, trigger, references, maintain on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- 4. Verifica.
do $verifica$
declare
  v_n integer;
  v_elenco text;
begin
  -- (1) Nessun predefinito di postgres in public che dia qualcosa ad anon
  --     su tabelle o sequenze.
  select count(*) into v_n
    from pg_default_acl d
    cross join lateral aclexplode(d.defaclacl) a
   where d.defaclrole = 'postgres'::regrole
     and d.defaclnamespace = 'public'::regnamespace
     and d.defaclobjtype in ('r', 'S')
     and a.grantee = 'anon'::regrole;
  if v_n > 0 then
    raise exception 'Restano % privilegi predefiniti di postgres per anon su tabelle o sequenze.', v_n;
  end if;

  -- (2) Nessuna tabella o vista di public su cui anon abbia un privilegio
  --     qualunque (anche quelli che PostgREST non espone).
  select string_agg(c.relname, ', ' order by c.relname) into v_elenco
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relkind in ('r', 'p', 'v', 'm', 'f')
     and has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN');
  if v_elenco is not null then
    raise exception 'anon ha ancora privilegi su: %', v_elenco;
  end if;

  -- (3) Nessuna sequenza di public usabile da anon.
  --     ⚠️ Il `case` non è un vezzo: Postgres non promette l'ordine delle
  --     condizioni del `where`, e has_sequence_privilege su un indice
  --     solleva errore (misurato sul progetto di prova il 26/10).
  select string_agg(c.relname, ', ' order by c.relname) into v_elenco
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and case when c.relkind = 'S'
              then has_sequence_privilege('anon', c.oid, 'USAGE,SELECT,UPDATE')
              else false end;
  if v_elenco is not null then
    raise exception 'anon può ancora usare le sequenze: %', v_elenco;
  end if;

  -- (4) Il modulo pubblico di prenotazione funziona ancora: le sue
  --     funzioni restano eseguibili da anon.
  if not has_function_privilege('anon', 'public.submit_public_reservation(date,time without time zone,integer,text,text,text,text)', 'EXECUTE')
     or not has_function_privilege('anon', 'public.public_reservation_options(date,integer)', 'EXECUTE')
     or not has_function_privilege('anon', 'public.giorni_chiusi_prenotabili()', 'EXECUTE') then
    raise exception 'Il modulo pubblico di prenotazione ha perso le sue funzioni: non si toccano.';
  end if;

  -- (5) Gli utenti entrati non perdono niente.
  if not has_table_privilege('authenticated', 'public.recipes', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'authenticated ha perso i privilegi sulle tabelle: la migrazione ha toccato il ruolo sbagliato.';
  end if;

  raise notice 'Fatto: anon non eredita più niente su tabelle e sequenze nuove, e non ha privilegi su quelle esistenti. Il modulo pubblico funziona ancora.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261026000001', 'chi_non_e_entrato_non_eredita_niente')
on conflict (version) do nothing;
