-- =====================================================================
-- IL PORTIERE SULLA RETE DELLE ORFANE — 31/08/2026
-- =====================================================================
--
-- 🔴 PRESA DA UNA RETE CHE C'ERA GIA': `tests/app/permessi.test.js` conta le
-- funzioni che scavalcano la RLS senza chiedere chi sei, ed e' diventata
-- rossa da sola — 31 invece di 30 — appena `funzioni_senza_chiamante` e'
-- nata, poche ore fa.
--
-- ⚠️ E LA CURA GIUSTA SI SCEGLIE CHIEDENDOSI **CHI LA CHIAMA** (regola del
-- 27/08), non mettendo un portiere per riflesso:
--   · nessun trigger la usa;
--   · nessuna funzione del database la chiama;
--   · nessun servizio con la chiave di servizio la chiama;
--   · la chiama **una prova automatica, col token del titolare**.
-- Quindi e' il caso (b): **portiere che RIFIUTA**. Un filtro nella `where`
-- sarebbe sbagliato — chi non deve vedere riceverebbe un elenco vuoto, che
-- si legge «non c'e' nessuna funzione orfana»: una rassicurazione falsa
-- proprio sulla rete che esiste per non farsi rassicurare.
--
-- ⚠️ Il corpo e' preso dal file che l'ha creata poche ore fa e **non e'
-- cambiato in mezzo**: nessuna migrazione l'ha toccata da allora.

-- ⚠️ E LA MIGRAZIONE CHE L HA CREATA VA DICHIARATA, non riscritta (regola
--    del 23/08): la sua verifica chiama la funzione quando il portiere non
--    c era ancora, e da oggi quella chiamata risulta "senza claims". Su una
--    ricostruzione da zero non si rompe niente — le migrazioni girano in
--    ordine e li' la funzione e' ancora senza portiere — ma la rete guarda
--    lo stato di ADESSO e non puo' saperlo.
-- rete-portieri: 20260831000006 chiama funzioni_senza_chiamante — quando quella migrazione gira il portiere non esiste ancora: glielo mette questa

create or replace function funzioni_senza_chiamante()
returns table (nome text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- `security definer` gira senza RLS: il controllo va rimesso dentro. E chi
  -- non deve vedere riceve un RIFIUTO, non un elenco vuoto.
  if not (select is_titolare()) then
    raise exception 'La mappa delle funzioni del gestionale la vede solo il titolare';
  end if;

  return query
  with mie as (
    select p.oid, p.proname::text as n
      from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
     -- ⚠️ `prokind = 'f'`: le aggregate non hanno un corpo da leggere, e
     --    `pg_get_functiondef` su una di loro solleva un errore che
     --    fermerebbe tutta la query (trappola del 27/08).
     where ns.nspname = 'public' and p.prokind = 'f'
       and has_function_privilege('authenticated', p.oid, 'execute')
  )
  select m.n
    from mie m
   where not exists (
     -- La chiama il CORPO di un'altra funzione? Allora e' un pezzo interno.
     -- ⚠️ `q.oid <> m.oid`: la propria definizione contiene il proprio nome,
     --    e senza questa riga nessuna funzione risulterebbe mai orfana.
     select 1
       from pg_proc q
       join pg_namespace n2 on n2.oid = q.pronamespace
      where n2.nspname = 'public' and q.prokind = 'f' and q.oid <> m.oid
        and pg_get_functiondef(q.oid) ~ ('\m' || m.n || '\M')
   )
     and not exists (select 1 from pg_trigger t where t.tgfoid = m.oid)
   order by 1;
end;
$$;

comment on function funzioni_senza_chiamante is
  'Le funzioni che dentro il database non chiama nessuno: ne'' un''altra '
  'funzione, ne'' un trigger. ⚠️ NON dice che siano orfane — dice che se una '
  'porta esiste, sta FUORI dal database. A incrociare con `src/` e'' la prova '
  '`tests/app/funzioni-senza-schermata.test.js`.';

revoke all on function funzioni_senza_chiamante() from public, anon, authenticated;
grant execute on function funzioni_senza_chiamante() to authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare v_tit uuid; v_n integer; v_rifiuta boolean := false;
begin
  -- (1) SENZA titolare deve RIFIUTARE, non rispondere vuoto.
  --     Dentro una migrazione `is_titolare()` e' gia' falso, quindi questo
  --     e' il caso naturale e non serve costruirlo.
  begin
    perform count(*) from funzioni_senza_chiamante();
  exception when others then
    v_rifiuta := true;
  end;
  if not v_rifiuta then
    raise exception 'La funzione risponde a chi non e'' il titolare: il portiere non c''e''';
  end if;

  -- (2) CON il titolare deve rispondere, e rispondere qualcosa.
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  select count(*) into v_n from funzioni_senza_chiamante();
  if v_n = 0 then
    raise exception 'Col titolare non trova nessuno: il setaccio e'' rotto';
  end if;

  -- ⚠️ Tarata nei due versi, come prima: `euro` la chiamano in tanti e non
  --    deve comparire; `mondi_del_magazzino` non la chiama nessuno e deve.
  if exists (select 1 from funzioni_senza_chiamante() where nome = 'euro') then
    raise exception 'Il setaccio dice che «euro» non e'' chiamata da nessuno: e'' rotto';
  end if;
  if not exists (select 1 from funzioni_senza_chiamante() where nome = 'mondi_del_magazzino') then
    raise exception 'Il setaccio non vede «mondi_del_magazzino»: e'' rotto';
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Fatto: il portiere rifiuta chi non e'' il titolare, e col titolare trova % funzioni.', v_n;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260831000009', 'il_portiere_sulla_rete_delle_orfane') on conflict (version) do nothing;
