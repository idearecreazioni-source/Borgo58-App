-- =====================================================================
-- IL LETTORE DEL PREFLIGHT, SENZA CHIAVI
-- 03/10/2026 · mandato M23-C (+ integrazione M23-C-1)
-- =====================================================================
-- 🔴 PROPOSTA NON APPLICATA. Preparazione autonoma del preflight: NON fa
--    parte del piano delle 17 migrazioni mancanti, e prima di qualunque
--    applicazione richiede prove controllate su Prova. Password e login
--    sono una decisione separata, che questo file NON prende.
--
-- COSA FA, e nient'altro:
--   · crea il ruolo tecnico `borgo58_preflight_reader`, SENZA login e
--     senza nessun attributo amministrativo;
--   · gli lascia vedere lo schema `public` (USAGE) e leggere la SOLA
--     colonna `version` di `applied_migrations`;
--   · aggiunge UNA regola di riga, solo per lui e solo in lettura, su quel
--     registro: senza, la RLS gli restituirebbe zero righe senza nessun
--     errore (docs/consegne/20261003_identita_sola_lettura_preflight.md § 2).
--
-- A cosa serve: alle tre misure del catalogo che il database da' da se' —
-- la versione piu' alta registrata, le versioni mancanti, quelle estranee.
-- Tutte leggono soltanto `applied_migrations.version`.
--
-- ---------------------------------------------------------------------
-- SE IL RUOLO ESISTE GIA' (decisione 1 dell'integrazione M23-C-1)
-- ---------------------------------------------------------------------
-- Un ruolo vive sull'intero server, non nello schema: quando Prova viene
-- ricostruita, lo schema sparisce e il ruolo resta, spoglio. Quindi:
--   · ruolo assente               → lo crea;
--   · esiste ed e' una scatola vuota → gli ridà SOLO la lettura minima;
--   · esiste e NON e' vuoto        → si ferma, prima di concedere,
--                                    revocare o modificare alcunche'.
-- «Scatola vuota»: niente login, niente password, nessun attributo
-- amministrativo, nessuna appartenenza (ne' come membro ne' come
-- contenitore), nessun oggetto posseduto, nessun privilegio esplicito su
-- database, schemi, tabelle, viste, sequenze, colonne, funzioni, privilegi
-- predefiniti, nessuna regola di riga. I privilegi concessi a PUBLIC non
-- contano: sono di tutti, non suoi.
--
-- ⚠️ La password si controlla SENZA leggerla: si chiede solo se il campo e'
--    vuoto. Se il catalogo delle password non e' leggibile da chi applica,
--    la migrazione NON indovina: si ferma.
--
-- ⚠️ IL RILANCIO DELLO STESSO FILE (§5 punto 3 di CLAUDE.md: premere Run
--    due volte e' normale). Se questa versione e' gia' registrata e il
--    ruolo esiste, non concede, non revoca e non modifica niente: passa
--    direttamente alla verifica, che pretende lo stato esatto qui sotto.
--
-- NON CONTIENE: password, login, appartenenze, privilegi su altro, modifiche
-- ai privilegi di PUBLIC.
-- =====================================================================

do $lettore$
declare
  v_oid oid;
  v_registrata boolean;
  v_r record;
  v_motivi text[];
begin
  select exists (select 1 from applied_migrations where version = '20261003000001')
    into v_registrata;
  select r.oid into v_oid from pg_roles r where r.rolname = 'borgo58_preflight_reader';

  -- Il rilancio dello stesso file: niente da fare, decide la verifica.
  if v_oid is not null and v_registrata then
    raise notice 'IL LETTORE: migrazione gia'' registrata e ruolo presente: nessuna modifica, solo verifica.';
    return;
  end if;

  if v_oid is not null then
    -- ---------------------------------------------------------------
    -- Il ruolo c'e' gia': e' una scatola vuota? Si guarda TUTTO prima
    -- di toccare qualunque cosa.
    -- ---------------------------------------------------------------
    if not has_table_privilege('pg_catalog.pg_authid', 'select') then
      raise exception 'IL LETTORE: il ruolo borgo58_preflight_reader esiste e non posso controllare se ha una password: mi fermo senza toccare niente.';
    end if;

    select r.rolcanlogin, r.rolsuper, r.rolcreatedb, r.rolcreaterole,
           r.rolreplication, r.rolbypassrls
      into v_r
      from pg_roles r
     where r.oid = v_oid;

    v_motivi := array_remove(array[
      case when v_r.rolcanlogin then 'login attivo' end,
      case when exists (select 1 from pg_authid a
                         where a.oid = v_oid and a.rolpassword is not null)
           then 'password impostata' end,
      case when v_r.rolsuper then 'SUPERUSER' end,
      case when v_r.rolcreatedb then 'CREATEDB' end,
      case when v_r.rolcreaterole then 'CREATEROLE' end,
      case when v_r.rolreplication then 'REPLICATION' end,
      case when v_r.rolbypassrls then 'BYPASSRLS' end,
      case when exists (select 1 from pg_auth_members m where m.member = v_oid)
           then 'membro di un altro ruolo' end,
      case when exists (select 1 from pg_auth_members m where m.roleid = v_oid)
           then 'contiene altri ruoli' end,
      case when exists (select 1 from pg_shdepend d
                         where d.refclassid = 'pg_authid'::regclass
                           and d.refobjid = v_oid and d.deptype = 'o')
           then 'possiede oggetti' end,
      case when exists (select 1 from pg_shdepend d
                         where d.refclassid = 'pg_authid'::regclass
                           and d.refobjid = v_oid and d.deptype <> 'o')
           then 'privilegi o regole registrati sul server' end,
      case when exists (select 1 from pg_database b, aclexplode(b.datacl) x where x.grantee = v_oid)
           then 'privilegi su un database' end,
      case when exists (select 1 from pg_namespace n, aclexplode(n.nspacl) x where x.grantee = v_oid)
           then 'privilegi su uno schema' end,
      case when exists (select 1 from pg_class c, aclexplode(c.relacl) x where x.grantee = v_oid)
           then 'privilegi su tabelle, viste o sequenze' end,
      case when exists (select 1 from pg_attribute t, aclexplode(t.attacl) x where x.grantee = v_oid)
           then 'privilegi su colonne' end,
      case when exists (select 1 from pg_proc p, aclexplode(p.proacl) x where x.grantee = v_oid)
           then 'privilegi su funzioni' end,
      case when exists (select 1 from pg_default_acl d where d.defaclrole = v_oid)
             or exists (select 1 from pg_default_acl d, aclexplode(d.defaclacl) x where x.grantee = v_oid)
           then 'privilegi predefiniti' end,
      case when exists (select 1 from pg_policy p where v_oid = any (p.polroles))
           then 'regole di riga' end
    ], null);

    if cardinality(v_motivi) > 0 then
      raise exception 'IL LETTORE: il ruolo borgo58_preflight_reader esiste ma non e'' una scatola vuota (%): mi fermo prima di concedere, revocare o modificare alcunche''.',
        array_to_string(v_motivi, ', ');
    end if;

    raise notice 'IL LETTORE: il ruolo esisteva ed e'' una scatola vuota: riceve di nuovo soltanto la lettura minima.';
  else
    create role borgo58_preflight_reader
      nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls noinherit;
    raise notice 'IL LETTORE: ruolo creato senza login e senza attributi amministrativi.';
  end if;

  -- ---------------------------------------------------------------
  -- Solo qui, e solo nei due casi ammessi: la lettura minima.
  -- ---------------------------------------------------------------
  grant usage on schema public to borgo58_preflight_reader;
  grant select (version) on table public.applied_migrations to borgo58_preflight_reader;
  create policy applied_migrations_select_preflight on public.applied_migrations
    as permissive for select to borgo58_preflight_reader using (true);
end $lettore$;

-- =====================================================================
-- VERIFICA: lo stato dopo deve essere ESATTAMENTE questo, o si ferma tutto.
-- Si guardano solo i privilegi che nominano il ruolo: quelli di PUBLIC non
-- sono suoi e non contano.
-- =====================================================================
do $verifica$
declare
  v_oid oid;
  v_r record;
  v_n integer;
  v_p record;
begin
  select r.oid, r.rolcanlogin, r.rolsuper, r.rolcreatedb, r.rolcreaterole,
         r.rolreplication, r.rolbypassrls
    into v_r
    from pg_roles r
   where r.rolname = 'borgo58_preflight_reader';
  v_oid := v_r.oid;
  if v_oid is null then
    raise exception 'VERIFICA: il ruolo borgo58_preflight_reader non esiste.';
  end if;

  if v_r.rolcanlogin or v_r.rolsuper or v_r.rolcreatedb or v_r.rolcreaterole
     or v_r.rolreplication or v_r.rolbypassrls then
    raise exception 'VERIFICA: il ruolo ha login o un attributo amministrativo.';
  end if;

  select count(*) into v_n from pg_auth_members m where m.member = v_oid;
  if v_n <> 0 then
    raise exception 'VERIFICA: il ruolo appartiene a un altro ruolo.';
  end if;

  select count(*) into v_n from pg_shdepend d
   where d.refclassid = 'pg_authid'::regclass and d.refobjid = v_oid and d.deptype = 'o';
  if v_n <> 0 then
    raise exception 'VERIFICA: il ruolo possiede oggetti.';
  end if;

  select count(*) into v_n from pg_shdepend d
   where d.refclassid = 'pg_authid'::regclass and d.refobjid = v_oid
     and d.dbid is distinct from (select b.oid from pg_database b where b.datname = current_database());
  if v_n <> 0 then
    raise exception 'VERIFICA: il ruolo ha privilegi o regole fuori da questo database.';
  end if;

  select count(*) into v_n from pg_database b, aclexplode(b.datacl) x where x.grantee = v_oid;
  if v_n <> 0 then
    raise exception 'VERIFICA: il ruolo ha privilegi su un database.';
  end if;

  select count(*) into v_n from pg_namespace n, aclexplode(n.nspacl) x where x.grantee = v_oid;
  if v_n <> 1 then
    raise exception 'VERIFICA: il ruolo deve avere esattamente un privilegio di schema, ne ha %.', v_n;
  end if;
  select count(*) into v_n from pg_namespace n, aclexplode(n.nspacl) x
   where x.grantee = v_oid and n.nspname = 'public' and x.privilege_type = 'USAGE' and not x.is_grantable;
  if v_n <> 1 then
    raise exception 'VERIFICA: il privilegio di schema non e'' il solo USAGE su public.';
  end if;

  select count(*) into v_n from pg_class c, aclexplode(c.relacl) x where x.grantee = v_oid;
  if v_n <> 0 then
    raise exception 'VERIFICA: il ruolo ha privilegi su una tabella, vista o sequenza intera.';
  end if;

  select count(*) into v_n from pg_attribute t, aclexplode(t.attacl) x where x.grantee = v_oid;
  if v_n <> 1 then
    raise exception 'VERIFICA: il ruolo deve avere esattamente un privilegio di colonna, ne ha %.', v_n;
  end if;
  select count(*) into v_n from pg_attribute t, aclexplode(t.attacl) x
   where x.grantee = v_oid
     and t.attrelid = 'public.applied_migrations'::regclass
     and t.attname = 'version'
     and x.privilege_type = 'SELECT'
     and not x.is_grantable;
  if v_n <> 1 then
    raise exception 'VERIFICA: il privilegio di colonna non e'' la sola lettura di applied_migrations.version.';
  end if;

  select count(*) into v_n from pg_proc p, aclexplode(p.proacl) x where x.grantee = v_oid;
  if v_n <> 0 then
    raise exception 'VERIFICA: il ruolo ha privilegi su una funzione.';
  end if;

  select count(*) into v_n from pg_default_acl d where d.defaclrole = v_oid;
  if v_n <> 0 then
    raise exception 'VERIFICA: il ruolo ha privilegi predefiniti.';
  end if;
  select count(*) into v_n from pg_default_acl d, aclexplode(d.defaclacl) x where x.grantee = v_oid;
  if v_n <> 0 then
    raise exception 'VERIFICA: il ruolo riceve privilegi predefiniti.';
  end if;

  -- Una sola regola di riga che lo nomina, ed e' quella prevista.
  select count(*) into v_n from pg_policy p where v_oid = any (p.polroles);
  if v_n <> 1 then
    raise exception 'VERIFICA: il ruolo deve comparire in esattamente una regola di riga, compare in %.', v_n;
  end if;
  select p.polname, p.polrelid, p.polcmd, p.polpermissive, p.polroles,
         pg_get_expr(p.polqual, p.polrelid) as condizione,
         p.polwithcheck is null as senza_controllo
    into v_p
    from pg_policy p
   where v_oid = any (p.polroles);
  if v_p.polname is distinct from 'applied_migrations_select_preflight'
     or v_p.polrelid is distinct from 'public.applied_migrations'::regclass
     or v_p.polcmd is distinct from 'r'
     or v_p.polpermissive is distinct from true
     or v_p.polroles is distinct from array[v_oid]
     or v_p.condizione is distinct from 'true'
     or not v_p.senza_controllo then
    raise exception 'VERIFICA: la regola di riga del lettore non e'' la sola lettura di applied_migrations per lui solo.';
  end if;

  -- La regola del titolare e' ancora la', intatta nel suo verso.
  select count(*) into v_n from pg_policy p
   where p.polrelid = 'public.applied_migrations'::regclass
     and p.polname = 'applied_migrations_select_titolare'
     and p.polcmd = 'r';
  if v_n <> 1 then
    raise exception 'VERIFICA: la regola applied_migrations_select_titolare non e'' piu'' quella di prima.';
  end if;

  raise notice 'Verifica passata: lettore senza login, sola lettura di applied_migrations.version, una sola regola di riga.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261003000001', 'il_lettore_del_preflight_senza_chiavi') on conflict (version) do nothing;
