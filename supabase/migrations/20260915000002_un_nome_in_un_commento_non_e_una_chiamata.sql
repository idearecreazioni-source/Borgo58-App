-- =====================================================================
-- UN NOME IN UN COMMENTO NON E' UNA CHIAMATA
-- 15/09/2026
-- =====================================================================
-- Correzione della 20260915000001, stesso giorno, stessa proposta (#87).
--
-- 🔴 IL DIFETTO, trovato dai controlli della #87 (giro sul commit dd85a7c,
--    lavoro 104386200530) e misurato in sola lettura sul progetto di prova:
--    `tests/app/funzioni-senza-schermata.test.js` e' diventata rossa con
--    «Queste hanno una porta adesso: toglile da ORFANE_NOTE» → ['lapidi_di_prova'].
--    L'unica funzione il cui corpo nominava `lapidi_di_prova` era la nuova
--    `lapidi_delle_verifiche`, e la nominava in un COMMENTO dentro il corpo.
--    La rete delle orfane (`funzioni_senza_chiamante`) cerca il nome a parola
--    intera (`~ '\m<nome>\M'`) nel testo delle funzioni, commenti compresi, e
--    ha concluso che `lapidi_di_prova` avesse un chiamante: la riga congelata
--    sembrava un debito pagato. Difetto di chi ha scritto la 001.
--
-- ⚠️ LA 001 NON SI RISCRIVE: e' gia' applicata sul progetto di prova, e una
--    migrazione applicata racconta cosa e' successo quel giorno (regola del
--    23/08). Si ricrea la funzione qui, dal CORPO VIVO del progetto di prova
--    (regola del 18/08), cambiando SOLO quel commento: stessa firma, stessa
--    lingua, stesso `search_path`, stesso filtro. `create or replace` non
--    tocca i permessi, quindi nessun `grant` riscritto a memoria (24 e 27/08):
--    la verifica li controlla.
--
-- 🔴 IL PRIMO TENTATIVO DI QUESTO FILE SI E' FERMATO SULLA SUA VERIFICA
--    (progetto di prova, 15/09 13:21 UTC), ed e' stato ANNULLATO PER INTERO:
--    `npm run prova:migra` applica ogni file in una transazione sola. Misurato
--    dopo, dal catalogo: corpo della funzione ancora quello della 001, questa
--    versione non registrata, nessuna lapide rimasta. Il difetto era nella
--    VERIFICA, non nella funzione: cercava il nome con `like`, dove `_` vale
--    «un carattere qualunque», e le parole «lapidi di prova» del commento
--    nuovo combaciavano. Ora la verifica usa lo STESSO criterio della rete
--    (`~ '\mlapidi_di_prova\M'`): chiede quello che la rete chiedera'.
--    ⚠️ Il file e' stato corretto invece di aggiungerne un terzo perche' non
--    e' mai stato registrato su nessun database, ne' spinto su GitHub.
--
-- ⚠️ La rete che ha gridato ha un limite, annotato e NON corretto qui: conta
--    come chiamata anche un nome dentro un commento. Oggi e' un falso «ha una
--    porta»; in un altro caso potrebbe nascondere un'orfana vera.
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

  -- ⚠️ E' la prima categoria dell'elenco completo delle lapidi di prova, con
  -- lo stesso filtro: la verifica della migrazione pretende che le due
  -- rispondano uguale. (Il nome dell'altra funzione qui non si scrive: la rete
  -- delle orfane lo leggerebbe come una chiamata.)
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


-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
-- ⚠️ Si pretende la PROPRIETA' che la rete guarda — nessun'altra funzione
--    nomina `lapidi_di_prova` a parola intera, e quella torna fra le orfane —
--    e che il comportamento non sia cambiato: due lapidi costruite apposta nel
--    registro, accordo con `lapidi_di_prova()`, rifiuto allo staff, nessun
--    residuo (stessa forma della verifica della 001).
do $verifica$
declare
  v_foto   jsonb := foto_righe();
  v_tit    uuid;
  v_staff  uuid;
  v_si     bigint;
  v_no     bigint;
  v_nota   text := 'VERIFICA-20260915000002 una lapide lasciata da una verifica';
  v_firma  text;
  v_perche text;
  v_n      bigint;
  v_m      bigint;
  v_preso  boolean := false;
  v_altre  text;
begin
  -- 0. La proprieta' che la rete guarda, con il SUO criterio (parola intera):
  --    nessun corpo di funzione, oltre al suo, nomina piu' `lapidi_di_prova`.
  select string_agg(p.proname, ', ') into v_altre
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and p.proname <> 'lapidi_di_prova'
     and pg_get_functiondef(p.oid) ~ '\mlapidi_di_prova\M';
  if v_altre is not null then
    raise exception 'VERIFICA: questi corpi nominano ancora lapidi_di_prova: %.', v_altre;
  end if;

  -- 1. La forma, invariata: niente security definer, search_path fissato,
  --    chiusa alla chiave pubblica, aperta al gestionale.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'lapidi_delle_verifiche'
                and (p.prosecdef or p.proconfig is null
                     or not ('search_path=public' = any(p.proconfig)))) then
    raise exception 'VERIFICA: lapidi_delle_verifiche ha cambiato forma (definer o search_path).';
  end if;
  if has_function_privilege('anon', 'public.lapidi_delle_verifiche()'::regprocedure, 'execute') then
    raise exception 'VERIFICA: lapidi_delle_verifiche e'' eseguibile con la chiave pubblica.';
  end if;
  if not has_function_privilege('authenticated', 'public.lapidi_delle_verifiche()'::regprocedure, 'execute') then
    raise exception 'VERIFICA: lapidi_delle_verifiche non e'' piu'' eseguibile dal gestionale.';
  end if;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_tit is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles.';
  end if;

  insert into deleted_records (table_name, record_id, record)
  values ('verifica_20260915000002', 'si', jsonb_build_object('note', v_nota))
  returning id into v_si;
  insert into deleted_records (table_name, record_id, record)
  values ('prova_20260915000002', 'no',
          jsonb_build_object('note', '__PROVA 20260915000002 una lapide di prova senza quella parola__'))
  returning id into v_no;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- 2. La rete delle orfane vede di nuovo `lapidi_di_prova` senza chiamante,
  --    e anche la funzione nuova (le due righe dichiarate in ORFANE_NOTE).
  if not exists (select 1 from funzioni_senza_chiamante() where nome = 'lapidi_di_prova') then
    raise exception 'VERIFICA: per la rete delle orfane lapidi_di_prova ha ancora un chiamante.';
  end if;
  if not exists (select 1 from funzioni_senza_chiamante() where nome = 'lapidi_delle_verifiche') then
    raise exception 'VERIFICA: per la rete delle orfane lapidi_delle_verifiche ha un chiamante.';
  end if;

  -- 3. Il comportamento, invariato.
  select l.firma into v_firma from lapidi_delle_verifiche() l where l.id = v_si;
  if v_firma is distinct from left(v_nota, 60) then
    raise exception 'VERIFICA: la lapide di una verifica non viene restituita (firma: %).', v_firma;
  end if;
  if exists (select 1 from lapidi_delle_verifiche() l where l.id = v_no) then
    raise exception 'VERIFICA: una lapide senza la parola «verifica» viene restituita.';
  end if;
  select l.perche into v_perche from lapidi_di_prova() l where l.id = v_si;
  if v_perche is distinct from 'verifica di una migrazione' then
    raise exception 'VERIFICA: lapidi_di_prova non la chiama verifica (%).', v_perche;
  end if;
  select count(*) into v_n from lapidi_delle_verifiche();
  select count(*) into v_m from lapidi_di_prova() l where l.perche = 'verifica di una migrazione';
  if v_n is distinct from v_m then
    raise exception 'VERIFICA: le due funzioni non contano le stesse verifiche (% contro %).', v_n, v_m;
  end if;

  -- 4. Chi titolare non e' riceve un rifiuto, non un elenco vuoto.
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

  delete from deleted_records where id in (v_si, v_no);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della 20260915000002');

  raise notice 'Verifica passata: nessun altro corpo nomina lapidi_di_prova, che torna fra le orfane; il comportamento non cambia.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260915000002', 'un_nome_in_un_commento_non_e_una_chiamata') on conflict (version) do nothing;
