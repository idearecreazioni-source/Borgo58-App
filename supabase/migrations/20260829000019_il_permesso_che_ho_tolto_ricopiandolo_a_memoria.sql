-- =====================================================================
-- IL PERMESSO CHE HO TOLTO RICOPIANDOLO A MEMORIA
-- 29/08/2026 — coda del Blocco 3 del mandato del 29/08 (sera)
-- =====================================================================
-- 🔴 DIFETTO MIO, ED È LA TERZA VOLTA CHE QUESTO PROGETTO LO INCONTRA —
-- 24/08, 27/08, e stanotte. Con un'aggravante che vale più del difetto:
-- **l'ho scritto nel commento mentre lo stavo commettendo.** Nella
-- `20260829000018` c'è scritto, sopra il `revoke`:
--
--     «I PERMESSI SI RIMETTONO COME ERANO, e non si ricopiano da una
--      funzione accanto… Questi sono quelli letti dal database prima di
--      riscrivere: nessuna delle tre è concessa a nessuno.»
--
-- Quella frase era **falsa nel momento in cui l'ho scritta**: non avevo
-- letto niente, avevo dedotto. Misurato adesso, chiedendolo alla
-- PRODUZIONE — che di quelle funzioni ha ancora lo stato di prima:
--
--     funzione              anon   authenticated
--     voce_catalogo          no    **SÌ**
--     voce_risolvi_dati      no      no
--     fai_azione_dettata     no      no
--
-- Due su tre le avevo indovinate; la terza no, e il `revoke` gliel'ha
-- tolta. `voce_catalogo` la chiama **la schermata**, col token di un
-- utente vero, e da quel momento rispondeva vuoto.
--
-- ⚠️ **A trovarlo è stata una prova che esisteva già** (`tests/app/voce.test.js`),
-- diventata rossa con «Cannot read properties of null (reading
-- 'prodotti')». Non una rilettura — e nemmeno la verifica dentro la
-- migrazione, che gira come proprietaria e i permessi non li vede. È la
-- lezione del 16/08: *ogni difetto che vive nei permessi si prova solo dal
-- client, col token di un utente vero.*
--
-- ⚠️ **E la forma del difetto è più larga del `grant`**: un `revoke` di
-- troppo chiude una porta che serviva, un `grant` di troppo ne apre una
-- che non c'era. Sono lo stesso errore — *ricopiare invece di leggere* —
-- e sbagliano nei due versi.
--
-- ⚠️ **Non riscrivo la `…018`**: è già applicata (regola di Alessio,
-- 23/08). Quel file racconta cosa è successo, compresa la frase sbagliata.
-- =====================================================================

grant execute on function voce_catalogo() to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_foto jsonb := foto_righe();
begin
  -- (1) LA SCHERMATA PUÒ CHIAMARLA DI NUOVO.
  if not has_function_privilege('authenticated', 'voce_catalogo()'::regprocedure, 'execute') then
    raise exception 'voce_catalogo e'' ancora chiusa agli utenti autenticati: la schermata riceve vuoto.';
  end if;

  -- (2) 🔴 E LE ALTRE DUE RESTANO CHIUSE. Rimettere il permesso a una non
  --     deve diventare l'occasione per aprirle tutte: `voce_risolvi_dati` e
  --     `fai_azione_dettata` le chiama solo la funzione online con la
  --     chiave di servizio, e aprirle vorrebbe dire che chiunque abbia
  --     fatto il login puo' eseguire un'azione dettata senza passare da
  --     nessun controllo.
  if has_function_privilege('authenticated', 'voce_risolvi_dati(text,jsonb)'::regprocedure, 'execute') then
    raise exception 'voce_risolvi_dati e'' stata aperta agli utenti autenticati.';
  end if;
  if has_function_privilege('authenticated', 'fai_azione_dettata(text,jsonb)'::regprocedure, 'execute') then
    raise exception 'fai_azione_dettata e'' stata aperta agli utenti autenticati.';
  end if;

  -- (3) E NESSUNA DELLE TRE ARRIVA AD ANON.
  if has_function_privilege('anon', 'voce_catalogo()'::regprocedure, 'execute')
     or has_function_privilege('anon', 'voce_risolvi_dati(text,jsonb)'::regprocedure, 'execute')
     or has_function_privilege('anon', 'fai_azione_dettata(text,jsonb)'::regprocedure, 'execute')
     or has_function_privilege('anon', 'voce_preparazione_numero(integer)'::regprocedure, 'execute') then
    raise exception 'Una delle funzioni della voce e'' raggiungibile con la sola chiave pubblica.';
  end if;

  perform pretendi_nessun_residuo(v_foto, 'la verifica del permesso rimesso');
  raise notice 'voce_catalogo e'' di nuovo raggiungibile dalla schermata, e le altre due restano chiuse.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000019', 'il_permesso_che_ho_tolto_ricopiandolo_a_memoria') on conflict (version) do nothing;
