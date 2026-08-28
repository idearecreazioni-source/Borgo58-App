-- ============================================================================
-- 20260828000013 — la funzione nuova nasceva aperta a tutti
-- ============================================================================
--
-- DIFETTO MIO, di poche ore fa, trovato da una rete scritta il 13/08.
--
-- La `20260828000010` ha tolto il parametro dalla conservazione e ha scritto
-- `create or replace function preavviso_giorni(p_esplicito integer)`. Ma una
-- FIRMA NUOVA e' una FUNZIONE NUOVA: quella vecchia aveva un `revoke`
-- esplicito, quella nuova e' nata coi permessi predefiniti di Postgres —
-- cioe' **eseguibile da chiunque abbia la chiave anonima**, che in questo
-- progetto e' pubblica e sta nel pacchetto del sito.
-- Misurato: sul progetto di prova le funzioni aperte all'anonimo erano
-- passate da 12 a 13; in produzione erano rimaste 12.
--
-- 🔴 E LA MIA VERIFICA ERA CIECA PROPRIO SU QUESTO CASO. Controllava che
--    nella lista dei permessi non comparisse `anon=X`:
--        if position('anon=X' in v_acl) > 0 then raise ...
--    Ma con i permessi PREDEFINITI quella lista e' **vuota** — nessun ACL
--    esplicito — quindi la ricerca non trovava niente e il controllo
--    passava. Cercava la prova che la porta fosse stata aperta APPOSTA, e
--    la porta era aperta PER DIFETTO.
--    ⚠️ Il metro giusto e' `has_function_privilege('anon', …)`, che chiede
--       al database se quel ruolo PUO', invece di leggere una stringa.
--    ⚠️ E avevo perfino scritto nel commento «la funzione nuova nasce con
--       gli stessi permessi predefiniti», convinto che fosse una
--       rassicurazione. «Predefiniti» qui vuol dire «aperti».
--
-- A prenderlo e' stata `tests/app/permessi.test.js`, che conta le funzioni
-- eseguibili con la sola chiave pubblica ed e' diventata rossa da sola —
-- esattamente il lavoro per cui era stata scritta il 13/08, quando l'elenco
-- era cresciuto da 12 a 14 senza che nessuno lo dicesse.
-- ============================================================================

-- rete-guardie: preavviso_giorni — FALSO ALLARME della rete: questa migrazione non riscrive la funzione, toglie solo un permesso. La rete la nomina perche il nome compare, e non distingue un revoke da un create or replace
revoke all on function public.preavviso_giorni(integer) from public, anon, authenticated;

-- Nessun `grant`: la chiamava solo `partite_in_scadenza`, che e'
-- `security definer` e gira coi permessi della sua proprietaria. Letto dal
-- database prima di scriverlo, non ricordato — la vecchia forma aveva
-- esattamente questo, `postgres` e basta.

do $verifica$
declare
  v_foto jsonb;
  v_n    integer;
begin
  v_foto := foto_righe();

  -- 1. IL CASO DEL DIFETTO: l'anonimo non deve poterla eseguire.
  --    ⚠️ Si CHIEDE AL DATABASE se puo', invece di cercare una stringa nella
  --    lista dei permessi: e' la differenza che ha reso cieca la verifica
  --    della 20260828000010.
  if has_function_privilege('anon', 'public.preavviso_giorni(integer)', 'execute') then
    raise exception 'preavviso_giorni e'' ancora eseguibile con la chiave pubblica';
  end if;
  if has_function_privilege('authenticated', 'public.preavviso_giorni(integer)', 'execute') then
    raise exception 'preavviso_giorni e'' ancora eseguibile da un utente qualunque';
  end if;

  -- 2. E NON E' UN MURO: lo scadenziario, che la chiama, risponde ancora.
  --    `partite_in_scadenza` e' security definer, quindi il revoke non la
  --    tocca — ma «non dovrebbe toccarla» e «non la tocca» sono due cose
  --    diverse, e questa e' la seconda.
  select count(*) into v_n from partite_in_scadenza();
  if v_n is null then
    raise exception 'Lo scadenziario ha smesso di rispondere dopo il revoke';
  end if;

  -- 3. LA PROPRIETA', non il caso singolo: nessuna funzione del progetto
  --    deve essere eseguibile dall'anonimo se non e' fra quelle dichiarate.
  --    Il conteggio vive gia' in `funzioni_aperte_ad_anon()` e in
  --    `tests/app/permessi.test.js`; qui si controlla solo che quella
  --    appena toccata non ci sia piu'.
  select count(*) into v_n
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'preavviso_giorni'
     and has_function_privilege('anon', p.oid, 'execute');
  if v_n <> 0 then
    raise exception 'Ci sono ancora % forme di preavviso_giorni aperte all''anonimo', v_n;
  end if;

  perform pretendi_nessun_residuo(v_foto, 'la funzione nuova nata aperta');

  raise notice 'preavviso_giorni non e'' piu'' eseguibile con la chiave pubblica, e lo scadenziario risponde ancora.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260828000013', 'la_funzione_nuova_nasceva_aperta')
on conflict (version) do nothing;
