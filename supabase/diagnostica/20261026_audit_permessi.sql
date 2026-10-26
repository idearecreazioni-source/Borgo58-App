-- =====================================================================
-- AUDIT DEI PERMESSI — SOLA LETTURA, non modifica niente (26/10/2026)
-- =====================================================================
-- Da incollare nell'SQL Editor di Supabase e premere Run. Non crea, non
-- cancella, non aggiorna nulla: fa solo domande al database.
--
-- PERCHE' SERVE. Il 31/07/2026 (20260731000001_grants_authenticated.sql)
-- tutte le tabelle sono state concesse in lettura e scrittura agli utenti
-- entrati, anche quelle future. Da quel giorno l'unica cosa che separa un
-- dato dal browser e' la RLS della sua tabella, e le migrazioni non bastano
-- a dire se c'e': una parte delle policy nasce da cicli `execute format(...)`
-- che una ricerca nel codice non vede. La risposta la da' solo il database.
--
-- COMPLETA `20260808_audit_fondamenta.sql`, non lo sostituisce: quello
-- guarda le policy aperte e le viste che scavalcano la RLS, questo guarda
-- chi arriva SENZA essere entrato (`anon`, cioe' chiunque abbia la chiave
-- pubblica del sito) e le funzioni che girano coi permessi di chi le ha
-- create.
--
-- Ogni riga del risultato e' qualcosa DA GUARDARE, non necessariamente un
-- errore: le funzioni del modulo pubblico di prenotazione, per esempio,
-- DEVONO essere eseguibili da anon. Zero righe in una categoria = nessun
-- sospetto in quella categoria.

select * from (

  -- 1. Tabelle senza RLS. Con le concessioni del 31/07, una tabella senza
  --    RLS e' leggibile e scrivibile da ogni utente entrato — e da anon,
  --    se anon ha i privilegi (categoria 3).
  select
    1 as ordine,
    'RLS DISATTIVATA' as categoria,
    c.relname::text as oggetto,
    'nessuna policy la protegge' as dettaglio
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity

  union all

  -- 2. Funzioni `security definer` senza `search_path` fissato. Girano coi
  --    permessi di chi le ha create: senza un percorso fisso, chi riesce a
  --    creare un oggetto con lo stesso nome in un altro schema le fa
  --    eseguire codice suo (docs/ARCHITETTURA.md §3).
  select
    2,
    'SECURITY DEFINER SENZA search_path',
    p.oid::regprocedure::text,
    case when has_function_privilege('anon', p.oid, 'EXECUTE')
      then 'ESEGUIBILE DA ANON' else 'non eseguibile da anon' end
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%'
    )

  union all

  -- 3. Tabelle e viste su cui anon ha privilegi. Con la RLS attiva e
  --    nessuna policy per anon resta comunque fuori, ma il privilegio e'
  --    la prima delle due porte: qui si vede quali sono aperte.
  select
    3,
    'PRIVILEGI DI ANON SU TABELLA O VISTA',
    c.relname::text,
    concat_ws(', ',
      case when has_table_privilege('anon', c.oid, 'SELECT') then 'lettura' end,
      case when has_table_privilege('anon', c.oid, 'INSERT') then 'inserimento' end,
      case when has_table_privilege('anon', c.oid, 'UPDATE') then 'modifica' end,
      case when has_table_privilege('anon', c.oid, 'DELETE') then 'cancellazione' end,
      -- Un privilegio dato a una sola colonna non si vede con
      -- has_table_privilege: va chiesto a parte (revisione del 26/10).
      case when has_any_column_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE')
             and not has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE')
           then 'su singole colonne' end
    ) || case when c.relkind = 'v' then ' (vista)'
              when not c.relrowsecurity then ' — E SENZA RLS'
              else '' end
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
    and (has_table_privilege('anon', c.oid, 'SELECT')
      or has_table_privilege('anon', c.oid, 'INSERT')
      or has_table_privilege('anon', c.oid, 'UPDATE')
      or has_table_privilege('anon', c.oid, 'DELETE')
      or has_any_column_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE'))

  union all

  -- 4. Policy che valgono anche per chi non e' entrato (ruolo `anon` o
  --    `public`, che comprende anon). Il modulo di prenotazione passa da
  --    funzioni, non da policy: una riga qui va spiegata. Si guardano
  --    anche le policy dei file (`storage`): un contenitore privato con una
  --    policy aperta e' pubblico quanto uno dichiarato pubblico.
  select
    4,
    'POLICY VALIDA ANCHE PER ANON',
    p.schemaname::text || '.' || p.tablename::text,
    p.cmd || ' — policy ' || p.policyname
      || case when p.qual = 'true' or p.with_check = 'true' then ' — CONDIZIONE SEMPRE VERA' else '' end
  from pg_policies p
  where p.schemaname in ('public', 'storage') and (p.roles && array['anon', 'public']::name[])

  union all

  -- 5. Funzioni eseguibili da anon. In Postgres ogni funzione nuova e'
  --    eseguibile da tutti finche' non le si toglie il permesso: l'elenco
  --    atteso e' quello del modulo pubblico e poco altro. Quelle che girano
  --    coi permessi del creatore (security definer) sono le prime da
  --    guardare, perche' la RLS li' dentro non ferma niente.
  select
    5,
    'FUNZIONE ESEGUIBILE DA ANON',
    p.oid::regprocedure::text,
    case when p.prosecdef then 'SECURITY DEFINER' else 'security invoker' end
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind in ('f', 'p')
    and p.prorettype <> 'trigger'::regtype
    and has_function_privilege('anon', p.oid, 'EXECUTE')

  union all

  -- 6. Privilegi predefiniti per anon o per tutti (PUBLIC): valgono per
  --    gli oggetti che verranno creati domani, ed e' cosi' che una tabella
  --    nuova nasce gia' aperta senza che nessuna migrazione lo dica.
  select
    6,
    'PRIVILEGI PREDEFINITI PER ANON O PUBLIC',
    pg_get_userbyid(d.defaclrole) || ' / '
      || case d.defaclobjtype when 'r' then 'tabelle' when 'S' then 'sequenze'
           when 'f' then 'funzioni' when 'T' then 'tipi' when 'n' then 'schemi'
           else d.defaclobjtype::text end,
    case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end
      || ': ' || a.privilege_type
  from pg_default_acl d
  left join pg_namespace n on n.oid = d.defaclnamespace
  cross join lateral aclexplode(d.defaclacl) a
  where coalesce(n.nspname, 'public') = 'public'
    and (a.grantee = 0 or a.grantee = 'anon'::regrole)

  union all

  -- 7. Contenitori di file pubblici: un file li' dentro si apre con
  --    l'indirizzo, senza essere entrati e senza RLS.
  select
    7,
    'CONTENITORE DI FILE PUBBLICO',
    b.id::text,
    'i file si aprono senza accesso'
  from storage.buckets b
  where b.public

) audit
order by ordine, oggetto;
