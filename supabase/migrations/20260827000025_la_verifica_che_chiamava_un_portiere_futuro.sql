-- ============================================================================
-- LA VERIFICA CHE CHIAMAVA UN PORTIERE FUTURO — 27/08/2026
-- ============================================================================
--
-- ✅ TERZA RETE DIVENTATA ROSSA DA SOLA IN UN GIORNO, e le tre hanno preso
--    tre cose diverse: `tre-esiti-lista` il regalo che azzerava un prezzo,
--    `permessi` le due funzioni senza portiere, e ora
--    `migrazioni-senza-portieri`:
--
--      «20260827000018 chiama andamento_prezzo() in un blocco senza
--       impostare i claims»
--
-- ----------------------------------------------------------------------------
-- PERCHÉ NON È UN DIFETTO, E PERCHÉ VA DICHIARATO LO STESSO
-- ----------------------------------------------------------------------------
-- Quando la `…018` è stata scritta, `andamento_prezzo` **non aveva nessun
-- portiere**: lo ha acquistato poche ore dopo con la `…023`, quando la rete
-- dei permessi ha segnalato che mostrava prezzi d'acquisto a chiunque.
--
-- ⚠️ SU UNA RICOSTRUZIONE DA ZERO LA `…018` FUNZIONA, e il motivo è
--    l'ordine: è **lei stessa** a creare `andamento_prezzo`, senza portiere,
--    e la `…023` gliene mette uno solo dopo. Quindi al momento in cui la sua
--    verifica gira, la funzione risponde a tutti.
--
-- 🔴 QUELLO CHE NON SI PUÒ PIÙ FARE è **rieseguire la `…018` da sola oggi**:
--    lì il portiere c'è già, la verifica non imposta i claims, e si
--    fermerebbe. Nessuno strumento di questo progetto lo fa — `npm run
--    prova:migra` applica solo ciò che manca — ma va scritto, perché chi
--    prova a mano una migrazione vecchia non ha modo di saperlo.
--
-- ⚠️ E LA `…018` NON SI RISCRIVE (regola del 23/08): il suo file racconta
--    cosa è successo quel giorno, compreso il fatto che allora quella
--    funzione era aperta. La dichiarazione sta qui.
--
-- ⚠️ La forma della dichiarazione è esatta (lezione del 26/08): col numero di
--    versione nel nome del file, e su UNA riga sola.
--
-- rete-portieri: 20260827000018 chiama andamento_prezzo — il portiere è arrivato DOPO, con la 20260827000023: su una ricostruzione da zero la 018 crea lei stessa la funzione senza portiere, quindi la sua verifica gira prima che il portiere esista
-- ============================================================================

-- ============================================================================
-- VERIFICA — la dichiarazione qui sopra poggia su due fatti, e si controllano
-- ============================================================================
-- ⚠️ Una dichiarazione che zittisce una rete e che nessuno ricontrolla è
--    peggio della rete accesa: resta lì anche quando la ragione è caduta.
do $verifica$
declare
  v_n integer;
begin
  -- 1. `andamento_prezzo` OGGI ha il suo portiere. Se lo perdesse, la
  --    dichiarazione qui sopra descriverebbe un mondo che non c'è più — e
  --    insieme tornerebbe aperta una funzione che mostra prezzi d'acquisto.
  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'andamento_prezzo'
     and pg_get_functiondef(p.oid) like '%is_titolare()%';
  if v_n <> 1 then
    raise exception 'La dichiarazione presume un portiere su andamento_prezzo, e non c''e''';
  end if;

  -- 2. `prezzo_ultima_versione` resta CHIUSA a ogni utente: e'' la chiave
  --    interna del riflesso, e un portiere li' romperebbe il carico in
  --    cucina (vedi la 20260827000023).
  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'prezzo_ultima_versione'
     and (has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute')
       or has_function_privilege('public', p.oid, 'execute'));
  if v_n <> 0 then
    raise exception 'La chiave interna del riflesso e'' tornata eseguibile da un utente';
  end if;

  -- 3. E il riflesso è ancora attaccato ai lotti: e'' la cosa che tiene in
  --    piedi tutto il blocco, e un `drop trigger` di passaggio la
  --    spegnerebbe senza che nessun numero cambi subito.
  select count(*) into v_n from pg_trigger
   where tgrelid = 'stock_lots'::regclass and tgname = 'trg_rispecchia_prezzo'
     and not tgisinternal;
  if v_n <> 1 then
    raise exception 'Il trigger del riflesso del prezzo non e'' al suo posto';
  end if;

  raise notice 'La dichiarazione regge: il portiere di andamento_prezzo c''e'', la chiave interna e'' chiusa, e il riflesso e'' ancora attaccato ai lotti.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000025', 'la_verifica_che_chiamava_un_portiere_futuro') on conflict (version) do nothing;
