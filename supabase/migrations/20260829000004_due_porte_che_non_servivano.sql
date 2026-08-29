-- =====================================================================
-- DUE PORTE CHE NON SERVIVANO A NESSUNO
-- 29/08/2026
-- =====================================================================
-- 🔴 LE HA TROVATE LA RETE, non una rilettura. `tests/app/permessi.test.js`
-- conta le funzioni che scavalcano la RLS senza chiedere chi sei, ed e'
-- diventata rossa da sola: **23 attese, 25 trovate**, e le due in piu'
-- erano `consumi_ai` e `fonti_ai_scoperte`, nate poche ore prima nella
-- migrazione `20260829000003`. Scritte da me, con il `grant` messo a mano
-- copiando la forma delle funzioni accanto.
--
-- ⚠️ E LA CURA GIUSTA NON E' IL PORTIERE. E' il criterio del 27/08: prima
-- si guarda **CHI la chiama**, e solo dopo si sceglie.
--
--   · `consumi_ai()`  — la chiamano `spesa_ai_del_mese()`, che il portiere
--     ce l'ha gia', e `tetto_ai_raggiunto()`, che e' aperta al solo ruolo
--     di servizio. **Nessuna schermata la chiama** — misurato cercandola
--     in tutto `src/` e `tests/`: zero.
--   · `fonti_ai_scoperte()` — e' una rete diagnostica, la chiama il blocco
--     di verifica di una migrazione, che gira come proprietaria.
--
-- Nessun utente le chiama, quindi **si chiude la porta** invece di metterci
-- un guardiano: un portiere sarebbe un controllo in piu' da mantenere per
-- un caso che, chiusa la porta, non esiste piu'.
--
-- ⚠️ E non e' un dettaglio di forma: `consumi_ai` dice **quanto si spende
-- in assistente**, che e' roba del titolare. Con il `grant` che le avevo
-- lasciato, chiunque entrasse col codice della sala poteva chiederlo.
--
-- 🔴 Ed e' la trappola gia' pagata il 24/08 e di nuovo il 27/08: *un
-- `grant` ricopiato e' una riscrittura come le altre*. L'ho riletta ieri e
-- ci sono ricascato oggi. A prenderlo e' stata di nuovo una rete, non la
-- memoria — che e' esattamente la ragione per cui la rete esiste.
-- =====================================================================

revoke execute on function consumi_ai() from authenticated;
revoke execute on function fonti_ai_scoperte() from authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_aperte text;
  v_tit uuid;
  v_ok boolean;
  v_speso numeric;
begin
  -- (1) Le due porte sono chiuse.
  select string_agg(p.proname, ', ') into v_aperte
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('consumi_ai', 'fonti_ai_scoperte')
     and has_function_privilege('authenticated', p.oid, 'execute');
  if v_aperte is not null then
    raise exception 'Queste sono ancora chiamabili da chi usa l''app: %', v_aperte;
  end if;

  -- (2) 🔴 E IL CONTROLLO CHE VALE DI PIU': chiudere la porta non deve aver
  --     rotto chi le usa. `spesa_ai_del_mese` chiama `consumi_ai` dall'interno
  --     e deve continuare a rispondere — se una funzione `security definer`
  --     chiamasse l'altra coi permessi di chi ha premuto, questo `revoke`
  --     avrebbe spento il conto della spesa in silenzio.
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Verifica impossibile: nessun titolare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select s.speso_euro into v_speso from spesa_ai_del_mese() s;
  perform set_config('request.jwt.claims', null, true);
  if v_speso is null then
    raise exception 'Chiusa la porta, il titolare non riesce piu'' a sapere quanto ha speso.';
  end if;

  -- (3) …e `tetto_ai_raggiunto`, che la chiama dal ruolo di servizio, pure.
  select t.fermo into v_ok from tetto_ai_raggiunto() t;
  if v_ok is null then
    raise exception 'Chiusa la porta, le funzioni online non riescono piu'' a guardare il tetto.';
  end if;

  raise notice 'Le due funzioni non sono piu'' chiamabili da chi usa l''app, e chi le usa dall''interno continua a rispondere.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000004', 'due_porte_che_non_servivano') on conflict (version) do nothing;
