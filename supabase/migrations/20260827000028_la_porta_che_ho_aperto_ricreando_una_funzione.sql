-- ============================================================================
-- LA PORTA CHE HO APERTO RICREANDO UNA FUNZIONE — 27/08/2026
-- ============================================================================
--
-- 🔴 DIFETTO MIO, TROVATO DALLA RETE DEI PERMESSI — la terza volta in un
--    giorno che `tests/app/permessi.test.js` prende qualcosa che nessuna
--    rilettura aveva visto. È diventata rossa nominando
--    **`trova_o_crea_ingrediente`** fra le funzioni che scavalcano la RLS
--    senza chiedere chi sei.
--
-- La `20260827000026` ha dovuto **ricreare** quella funzione, perché il tipo
-- della categoria era nella sua firma. Il **corpo** l'ho preso dal database,
-- come vuole la regola del 18/08. I **permessi** li ho scritti a memoria, sul
-- modello delle funzioni accanto:
--
--     grant execute on function trova_o_crea_ingrediente(...) to authenticated;
--
-- Misurato: la migrazione che l'ha creata, il 12/08, faceva
-- `revoke all … from public, anon, authenticated` e **nessun grant**. Quindi
-- quel `grant` non ha ripristinato niente — **ha aperto una porta che non
-- c'era**, e da quel momento qualunque utente autenticato poteva far
-- comparire un ingrediente in anagrafica.
--
-- ⚠️ ED È ESATTAMENTE LA LEZIONE DEL 24/08 — *«un `revoke`/`grant` ricopiato
--    è una riscrittura come le altre»* — nata su `fabbisogno_conto`, letta
--    poche ore prima di rifare questo stesso errore. *Una trappola scritta
--    non è una trappola chiusa, nemmeno per chi l'ha appena riletta.*
--
-- ----------------------------------------------------------------------------
-- E NESSUNO HA BISOGNO DI QUEL PERMESSO, misurato
-- ----------------------------------------------------------------------------
-- I due che la chiamano — `registra_prodotto_letto` e `esegui_azione_posta` —
-- sono entrambi `security definer`: girano coi permessi del proprietario e
-- **non hanno bisogno di quelli di chi chiama**. Il portiere ce l'hanno dove
-- conta, all'ingresso: `registra_prodotto_letto` pretende il titolare.
--
-- ⚠️ Quindi la cura è **chiudere la porta**, non metterci un portiere: una
--    funzione che nessuno deve poter chiamare da fuori non ha bisogno di
--    chiedere chi sei — ha bisogno che la porta non ci sia. È il criterio del
--    26/08, già usato la stessa notte su `prezzo_ultima_versione`.
-- ============================================================================

revoke all on function trova_o_crea_ingrediente(uuid, text, unit_type, text, boolean)
  from public, anon, authenticated;

comment on function trova_o_crea_ingrediente(uuid, text, unit_type, text, boolean) is
  'Restituisce l''ingrediente con quel nome dentro quell''entita'', creandolo '
  'solo se non c''e''. Seconda difesa contro i doppioni: un dato sbagliato che '
  'sembra giusto merita due barriere, non una. '
  '⚠️ NON E'' ESEGUIBILE DA NESSUN UTENTE, e non e'' una dimenticanza: la '
  'chiamano solo funzioni `security definer`, che girano come proprietarie. '
  'Il 27/08/2026 un `grant` scritto a memoria ricreandola aveva aperto una '
  'porta che non c''era — a trovarlo e'' stata la rete dei permessi.';

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_foto  jsonb;
  v_tit   uuid;
  v_ente  uuid;
  v_r     jsonb;
  v_mie_i uuid[] := '{}';
  v_mie_a uuid[] := '{}';
  v_n     integer;
  v_elenco text[];
begin
  v_foto := foto_righe();

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  if v_tit is null or v_ente is null then
    raise exception 'Verifica impossibile: manca il titolare o la societa''';
  end if;

  -- 1. La porta e' chiusa a tutti
  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'trova_o_crea_ingrediente'
     and (has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute')
       or has_function_privilege('public', p.oid, 'execute'));
  if v_n <> 0 then
    raise exception 'La funzione e'' ancora eseguibile da un utente';
  end if;

  -- 2. 🔴 E IL GIRO CONTINUA A FUNZIONARE, che e' il controllo che conta:
  --    chiudere una funzione che serve ad altre e' il modo piu' facile di
  --    rompere quelle altre. Si chiama la porta VERA, col titolare.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  v_r := registra_prodotto_letto(jsonb_build_object(
    'ingrediente', 'Aceto di verifica 20260827000028',
    'prodotto',    'Aceto di verifica Marca W 20260827000028',
    'marca',       'Marca W',
    'unita',       'l',
    'categoria',   'olio_condimenti'));
  v_mie_i := v_mie_i || (v_r->>'ingredient_id')::uuid;
  v_mie_a := v_mie_a || (v_r->>'articolo_id')::uuid;

  if (v_r->>'ingrediente_nuovo')::boolean is not true then
    raise exception 'Il giro non ha fatto nascere l''ingrediente dopo la chiusura';
  end if;

  -- 3. E la rete non ha piu' niente da dire su di lei
  select coalesce(array_agg(nome), '{}') into v_elenco
    from funzioni_senza_portiere() where nome = 'trova_o_crea_ingrediente';
  if array_length(v_elenco, 1) is not null then
    raise exception 'La rete dei permessi la segnala ancora';
  end if;

  -- ------------------------------------------------------------------
  -- Si riporta via tutto, per identificativo
  -- ------------------------------------------------------------------
  perform set_config('request.jwt.claims', null, true);
  delete from allergeni_prodotto where ingredient_id = any(v_mie_i);
  delete from articoli_fornitore where id = any(v_mie_a);
  delete from price_history where ingredient_id = any(v_mie_i);
  delete from ingredients where id = any(v_mie_i);
  delete from deleted_records where record_id = any((v_mie_i || v_mie_a)::text[]);

  perform pretendi_nessun_residuo(v_foto, 'la porta aperta ricreando una funzione');

  raise notice 'La porta e'' chiusa e il giro funziona ancora: un prodotto letto fa nascere il suo ingrediente passando da una funzione che nessun utente puo'' chiamare.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000028', 'la_porta_che_ho_aperto_ricreando_una_funzione') on conflict (version) do nothing;
