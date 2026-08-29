-- =====================================================================
-- LA VERIFICA CHE ORA HA BISOGNO DEI CLAIMS
-- 29/08/2026 — coda del Blocco 2 del mandato del 29/08 (sera)
-- =====================================================================
-- 🔴 UNA FRASE DIVENTATA FALSA SENZA CHE UNA RIGA SIA CAMBIATA, ed è la
-- seconda volta che questo progetto la incontra nella stessa forma (la
-- prima è del 24/08, migrazioni `…012` e `…013` di quel giorno).
--
-- Il blocco di verifica della `20260829000012` chiama
-- `ingrediente_con_questo_nome()` senza impostare i claims, e quando è
-- stato scritto andava benissimo: quella funzione non aveva nessun
-- portiere. **Un'ora dopo la `20260829000013` gliene ha messo uno**, e da
-- quel momento quella chiamata è diventata fragile — senza che una sola
-- riga della `…012` sia cambiata.
--
-- ✅ **A trovarlo è stata la rete** (`tests/app/migrazioni-senza-portieri.test.js`),
-- diventata rossa da sola e nominando la coppia file-funzione. Non una
-- rilettura.
--
-- ---------------------------------------------------------------------
-- 🔴 E CERCANDO SI VEDE UNA COSA PIÙ GROSSA DELLA DICHIARAZIONE
-- ---------------------------------------------------------------------
-- La `…012` non si limita a *chiamare* quella funzione: la **crea**, con
-- un `create or replace` e **senza portiere**. Quindi rilanciarla da sola
-- dopo la `…013` — cosa che `npm run prova:migra <nome>` sa fare —
-- **annullerebbe il portiere in silenzio**, e la funzione tornerebbe a
-- rispondere 42501 dal browser.
--
-- ⚠️ Su una **ricostruzione da zero** il caso non si presenta: le
-- migrazioni si applicano in ordine di numero, la `…013` viene dopo, e
-- alla fine il portiere c'è. Il rischio è **il rilancio mirato**, ed è
-- scritto qui perché fra sei mesi nessuno rifaccia l'indagine.
--
-- ⚠️ E LE MIGRAZIONI GIÀ APPLICATE NON SI RISCRIVONO (regola di Alessio,
-- 23/08): quei file raccontano cosa è successo quella notte. La
-- dichiarazione va **nella migrazione che chiude il caso**, non in quella
-- che lo ha causato.
--
-- 🔴 E LA DICHIARAZIONE NON BASTA DA SOLA: zittire un guardiano senza
-- rifare il controllo lascerebbe la regola senza nessuno che la guardi.
-- Quindi qui sotto il controllo si **rifà**, con i claims e con roba
-- creata da questo blocco.
--
-- rete-portieri: 20260829000012 chiama ingrediente_con_questo_nome — quando quel file e' stato scritto la funzione non aveva portiere, e la chiamata era legittima; il portiere e' arrivato un'ora dopo con la 20260829000013. Su una ricostruzione da zero la 012 gira PRIMA della 013, quindi la chiamata riesce. Il controllo e' rifatto qui sotto impostando i claims.
-- =====================================================================

do $verifica$
declare
  v_foto   jsonb := foto_righe();
  v_ent    uuid;
  v_id     uuid;
  v_miei   uuid[] := array[]::uuid[];
  v_quanti integer;
  v_utente uuid;
begin
  -- (0) IL PORTIERE C'È DAVVERO. Se qualcuno rilanciasse la `…012` da sola,
  --     questo controllo lo direbbe la prossima volta che si applica.
  if pg_get_functiondef('ingrediente_con_questo_nome(text)'::regprocedure)
       not like '%is_titolare%' then
    raise exception 'ingrediente_con_questo_nome ha perso il portiere: qualcuno ha rilanciato la 20260829000012 da sola.';
  end if;

  select id into v_ent from entities order by created_at limit 1;
  if v_ent is null then
    raise exception 'Non c''e'' nessuna societa'': la verifica non ha un perimetro suo.';
  end if;

  insert into ingredients (entity_id, name, category, unit, alimentare)
  values (v_ent, 'VERIFICA-29AGO claims', 'altro', 'kg', true)
  returning id into v_id;
  v_miei := v_miei || v_id;

  -- (1) COL TITOLARE IMPOSTATO, la ricerca risponde. È il controllo che la
  --     `…012` faceva senza claims, rifatto come va fatto adesso.
  select ur.user_id into v_utente from user_roles ur where ur.role = 'titolare' limit 1;
  if v_utente is null then
    raise exception 'Non c''e'' nessun titolare: la verifica non puo'' impersonare nessuno.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_utente, 'role', 'authenticated')::text, true);

  select count(*) into v_quanti from ingrediente_con_questo_nome('  VERIFICA-29AGO   CLAIMS ');
  if v_quanti <> 1 then
    raise exception 'Col titolare impostato la ricerca non trova il nome (trovati %).', v_quanti;
  end if;

  -- (2) E UN NOME LIBERO NON DÀ FALSI ALLARMI: un guardiano che grida
  --     sempre si impara a spegnere.
  select count(*) into v_quanti
    from ingrediente_con_questo_nome('VERIFICA-29AGO nessuno si chiama cosi 98765');
  if v_quanti <> 0 then
    raise exception 'Un nome libero risulta gia'' preso (trovati %).', v_quanti;
  end if;

  perform set_config('request.jwt.claims', null, true);
  delete from ingredients where id = any(v_miei);

  perform pretendi_nessun_residuo(v_foto, 'la verifica della ricerca coi claims');
  raise notice 'La ricerca del nome risponde col titolare impostato, e il portiere e'' al suo posto.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000015', 'la_verifica_che_ora_ha_bisogno_dei_claims') on conflict (version) do nothing;
