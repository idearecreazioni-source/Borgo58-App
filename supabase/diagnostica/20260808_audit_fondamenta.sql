-- =====================================================================
-- AUDIT DELLE FONDAMENTA — SOLA LETTURA, non modifica niente
-- =====================================================================
-- Da incollare nell'SQL Editor di Supabase e premere Run. Non crea, non
-- cancella, non aggiorna nulla: fa solo domande al database.
--
-- Perche' serve: leggere le migrazioni NON basta a sapere com'e' fatto il
-- database. Meta' delle policy di questo progetto e' creata da cicli SQL
-- dinamici (execute format(...)), che una ricerca nel codice non vede: una
-- verifica testuale ha dato 29 falsi allarmi. L'unica fonte attendibile
-- sullo stato dei permessi e' il database stesso.
--
-- Ogni riga del risultato e' qualcosa DA GUARDARE, non necessariamente un
-- errore. Zero righe = nessun sospetto in nessuna delle sei categorie.

select * from (

  -- 1. Tabelle senza RLS. Su un'app pubblica con chiave anon nel browser,
  --    una tabella senza RLS e' leggibile da chiunque conosca l'indirizzo.
  select
    1 as ordine,
    'RLS DISATTIVATA' as categoria,
    c.relname::text as oggetto,
    'chiunque abbia la chiave anon puo'' leggerla' as dettaglio
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity

  union all

  -- 2. RLS attiva ma nessuna policy: la tabella e' invisibile all'app.
  --    Sintomo tipico: "la pagina e' vuota e non da' errore".
  select
    2,
    'RLS ATTIVA MA SENZA POLICY',
    c.relname::text,
    'nessuno puo'' leggerla dall''app'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)

  union all

  -- 3. Lettura aperta a tutti gli autenticati. NON e' un errore di per se'
  --    (ricette, tavoli e comande devono esserlo), ma ogni riga qui va
  --    guardata: se compare una tabella con dati economici o personali,
  --    e' una fuga come quella di Agenda/tasks del 04/08.
  select
    3,
    'Lettura aperta a tutto lo staff',
    p.tablename::text,
    'policy ' || p.policyname
  from pg_policies p
  where p.schemaname = 'public' and p.cmd = 'SELECT' and p.qual = 'true'

  union all

  -- 4. Viste che bypassano la RLS. In Postgres 15+ una vista senza
  --    security_invoker=true gira coi permessi di chi l'ha creata: e' il
  --    meccanismo voluto per le viste _display, ma se una vista nuova
  --    espone per sbaglio una colonna economica, la RLS non la ferma.
  select
    4,
    'Vista che bypassa la RLS',
    c.relname::text,
    case
      when has_table_privilege('authenticated', c.oid, 'SELECT') then 'LEGGIBILE DALLO STAFF — controllare le colonne'
      else 'non concessa allo staff'
    end
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and coalesce(array_to_string(c.reloptions, ','), '') not like '%security_invoker=true%'

  union all

  -- 5. Chiavi esterne senza indice: ogni cancellazione o join su quella
  --    colonna diventa una scansione dell'intera tabella. Invisibile con
  --    poche righe, pesante fra due anni di servizio.
  select
    5,
    'Chiave esterna senza indice',
    ct.conrelid::regclass::text,
    a.attname::text
  from pg_constraint ct
  join pg_attribute a on a.attrelid = ct.conrelid and a.attnum = ct.conkey[1]
  where ct.contype = 'f'
    and ct.connamespace = 'public'::regnamespace
    and array_length(ct.conkey, 1) = 1
    and not exists (
      select 1 from pg_index i
      where i.indrelid = ct.conrelid and i.indkey[0] = ct.conkey[1]
    )

  union all

  -- 6. Tabelle senza chiave primaria: righe non identificabili in modo
  --    stabile, duplicati impossibili da correggere a posteriori.
  select
    6,
    'Tabella senza chiave primaria',
    c.relname::text,
    ''
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and not exists (select 1 from pg_constraint k where k.conrelid = c.oid and k.contype = 'p')

) audit
order by ordine, oggetto;
