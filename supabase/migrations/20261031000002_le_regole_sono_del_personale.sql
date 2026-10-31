-- LE REGOLE SONO DEL PERSONALE, NON DI CHIUNQUE ABBIA FATTO IL LOGIN — 31/10/2026.
--
-- 🔴 A1 del controllo finale del 30/10, punto 2 della correzione (approvato
--    da Alessio il 31/10). Il punto 1 (spegnere la registrazione libera in
--    produzione) l'ha fatto lui dal pannello alle 10:22.
--
-- COSA NON ANDAVA. 79 regole su 49 tabelle (misurato su Prova) dicevano
-- `using (true)` o `with check (true)`: «chiunque abbia fatto il login».
-- Andava bene finché gli account erano solo i nostri. Ma un account si può
-- creare con la chiave pubblica del sito, che sta nel sito stesso: con la
-- registrazione accesa, un estraneo con un'e-mail qualsiasi leggeva i
-- clienti col telefono e le prenotazioni, e scriveva sui conti.
--
-- COSA CAMBIA. Nasce `is_personale()`: vero solo per chi ha un ruolo in
-- `user_roles` (staff o titolare), come `is_titolare()` lo è per il solo
-- titolare. Ogni regola larga diventa «solo il personale».
-- ⚠️ Per il personale non cambia NIENTE: chi oggi lavora ha un ruolo, e
--    `true` per lui valeva già quanto `is_personale()`. Cambia solo per un
--    account senza ruolo, che da oggi non vede e non scrive niente.
-- ⚠️ Le regole si riscrivono CERCANDOLE, non elencandole a mano: un elenco
--    scritto oggi dimenticherebbe la cinquantesima tabella. Si cambia solo
--    la parte che diceva `true`; una parte che diceva già altro (per esempio
--    `is_titolare()`) resta com'era.
-- ⚠️ `(select is_personale())` e non `is_personale()`: così Postgres la
--    calcola una volta per richiesta e non una per riga (consiglio di
--    Supabase per le regole).
-- ⚠️ Le funzioni online con la chiave di servizio e le funzioni `security
--    definer` non passano dalle regole: non cambiano.
-- 🔴 E QUESTO È IL LIMITE, DICHIARATO (revisione ECC, 31/10): alcune
--    funzioni `security definer` aperte a `authenticated` controllano solo
--    che ci sia un login (`auth.uid() is not null`), per esempio
--    20260824000013. Un account senza ruolo le può ancora chiamare. Con la
--    registrazione spenta il rischio è piccolo; chiuderle con
--    `is_personale()` è un passo successivo, funzione per funzione.
-- ⚠️ Misurato su Prova il 31/10: nessun'altra regola dice «chiunque» in
--    altre forme (`auth.uid() is not null`, `auth.role()`), e quelle del
--    deposito dei file sono già del solo titolare.

create or replace function public.is_personale()
returns boolean
language sql
stable
set search_path to 'public'
as $function$
  select exists (
    select 1 from user_roles
    where user_id = (select auth.uid())
  );
$function$;

revoke all on function public.is_personale() from public, anon;
grant execute on function public.is_personale() to authenticated;

comment on function public.is_personale() is
  'Vero per chi lavora nel locale: ha un ruolo in user_roles (staff o titolare). È la condizione delle regole che prima dicevano «chiunque abbia fatto il login».';

do $stringi$
declare
  v_p     record;
  v_usa   text;
  v_scrivi text;
  v_quante integer := 0;
begin
  for v_p in
    select tablename, policyname, cmd, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (qual = 'true' or with_check = 'true')
       -- ⚠️ Mai la tabella dei ruoli: `is_personale()` la legge, e una sua
       --    regola che chiamasse `is_personale()` girerebbe su se stessa.
       and tablename <> 'user_roles'
     order by tablename, policyname
  loop
    v_usa := case when v_p.qual = 'true' and v_p.cmd <> 'INSERT'
                  then ' using ((select is_personale()))' else '' end;
    v_scrivi := case when v_p.with_check = 'true' and v_p.cmd in ('INSERT', 'UPDATE', 'ALL')
                     then ' with check ((select is_personale()))' else '' end;
    if v_usa = '' and v_scrivi = '' then
      raise exception 'VERIFICA: la regola % di % dice «true» in un posto che non so riscrivere (%).',
        v_p.policyname, v_p.tablename, v_p.cmd;
    end if;
    execute format('alter policy %I on public.%I', v_p.policyname, v_p.tablename) || v_usa || v_scrivi;
    v_quante := v_quante + 1;
  end loop;
  raise notice 'Regole strette: %.', v_quante;
end $stringi$;

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_staff    uuid;
  v_titolare uuid;
  v_n        bigint;
  v_t        text;
begin
  -- (1) Nessuna regola dice più «chiunque».
  select string_agg(tablename || '.' || policyname, ', ') into v_t
    from pg_policies
   where schemaname = 'public' and (qual = 'true' or with_check = 'true');
  if v_t is not null then
    raise exception 'VERIFICA (1): restano regole aperte a chiunque abbia fatto il login: %.', v_t;
  end if;

  if has_function_privilege('anon', 'is_personale()', 'execute')
     or not has_function_privilege('authenticated', 'is_personale()', 'execute') then
    raise exception 'VERIFICA: i permessi di is_personale non sono quelli dichiarati.';
  end if;

  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_staff is null or v_titolare is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles.';
  end if;

  begin
    -- Una riga sicura in una tabella prima aperta a tutti.
    insert into customers (name, phone) values ('ZZ cliente della verifica', '+390000000091');

    -- (2) Lo staff la vede e ne scrive una, come prima.
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    set local role authenticated;
    if not is_personale() or is_titolare() then
      raise exception 'VERIFICA (2a): lo staff non risulta personale (o risulta titolare).';
    end if;
    select count(*) into v_n from customers where name = 'ZZ cliente della verifica';
    if v_n <> 1 then
      raise exception 'VERIFICA (2b): lo staff non vede più i clienti.';
    end if;
    insert into customers (name, phone) values ('ZZ cliente dello staff', '+390000000092');
    -- L'aggiornamento è il caso che usa tutte e due le parti della regola.
    update customers set notes = 'ZZ' where phone = '+390000000091';
    get diagnostics v_n = row_count;
    if v_n <> 1 then
      raise exception 'VERIFICA (2c): lo staff non riesce più ad aggiornare un cliente.';
    end if;
    reset role;

    -- (3) Il titolare idem.
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;
    if not is_personale() then
      raise exception 'VERIFICA (3): il titolare non risulta personale.';
    end if;
    reset role;

    -- (4) Un account SENZA ruolo — quello che si sarebbe creato da solo —
    --     non vede niente e non scrive niente.
    perform set_config('request.jwt.claims',
      json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
    set local role authenticated;
    if is_personale() then
      raise exception 'VERIFICA (4a): un account senza ruolo risulta personale.';
    end if;
    select count(*) into v_n from customers;
    if v_n <> 0 then
      raise exception 'VERIFICA (4b): un account senza ruolo vede % clienti.', v_n;
    end if;
    select count(*) into v_n from reservations;
    if v_n <> 0 then
      raise exception 'VERIFICA (4c): un account senza ruolo vede % prenotazioni.', v_n;
    end if;
    select count(*) into v_n from orders;
    if v_n <> 0 then
      raise exception 'VERIFICA (4d): un account senza ruolo vede % conti.', v_n;
    end if;
    -- Un aggiornamento respinto dalla regola non dà errore: tocca zero righe.
    update customers set notes = 'estraneo' where phone = '+390000000091';
    get diagnostics v_n = row_count;
    if v_n <> 0 then
      raise exception 'VERIFICA (4f): un account senza ruolo ha aggiornato un cliente.';
    end if;
    begin
      insert into customers (name, phone) values ('ZZ estraneo', '+390000000093');
      raise exception 'VERIFICA (4e): un account senza ruolo ha scritto un cliente.';
    exception when insufficient_privilege then
      null; -- giusto: la regola lo respinge
    end;
    reset role;
    perform set_config('request.jwt.claims', null, true);

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  if exists (select 1 from customers where phone in ('+390000000091', '+390000000092', '+390000000093')) then
    raise exception 'VERIFICA: la prova ha lasciato dei clienti finti.';
  end if;

  raise notice 'Fatto: nessuna regola dice più «chiunque abbia fatto il login»; staff e titolare vedono e scrivono come prima; un account senza ruolo non vede clienti, prenotazioni né conti e non scrive. Provato e annullato.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261031000002', 'le_regole_sono_del_personale')
on conflict (version) do nothing;
