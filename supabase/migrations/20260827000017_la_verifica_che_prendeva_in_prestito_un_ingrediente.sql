-- ============================================================================
-- LA VERIFICA CHE PRENDEVA IN PRESTITO UN INGREDIENTE — 27/08/2026
-- ============================================================================
--
-- 🔴 LA `20260827000006` SI È FERMATA IN PRODUZIONE, e il difetto era nella
--    VERIFICA, non nel codice. Due dei suoi controlli facevano così:
--
--        select name into v_nome from ingredients order by name limit 1;
--
--    cioè **prendevano in prestito un ingrediente qualunque** per costruire
--    l'esempio. Sul progetto di prova ce ne sono a decine e passava; in
--    produzione ce ne sono **ZERO**, quindi `v_nome` è venuto vuoto, e la
--    funzione ha risposto — **correttamente** — «Non ho capito che cosa
--    aggiungere alla lista». La verifica ha letto quella risposta giusta
--    come un difetto e si è fermata.
--
-- ⚠️ IL CODICE È GIÀ IN PRODUZIONE E FUNZIONA. Constatato dal catalogo, non
--    dedotto: il corpo vivo di `voce_risolvi_dati` contiene già il ramo
--    nuovo — *«non cerca in magazzino, non ha bisogno di sapere quale
--    prodotto sia, e non si ferma mai per un dubbio che non ha»* — e le due
--    funzioni d'appoggio (`foto_righe`, `pretendi_nessun_residuo`) ci sono.
--    A mancare era solo la riga in `applied_migrations`.
--
-- ----------------------------------------------------------------------------
-- QUARTA RICOMPARSA DELLA STESSA TRAPPOLA
-- ----------------------------------------------------------------------------
-- *«Il perimetro di una prova dev'essere fatto di roba che la prova ha
-- creato»* (16/08), e *«la prova non era falsa: era su uno stato di partenza
-- diverso da quello vero, esattamente nel punto rilevante»* (12/08, 14/08,
-- 15/08).
--
-- ⚠️ E QUI HA UNA FORMA CHE VALE LA PENA NOMINARE: la verifica non aveva
--    bisogno di **quel** prodotto, aveva bisogno di **un nome qualunque**.
--    Prenderlo in prestito dal magazzino sembrava più realistico e ha
--    introdotto una dipendenza da uno stato che non le serviva.
--    *Un esempio si costruisce, non si prende in prestito.*
--
-- ⚠️ E la `…006` NON SI RISCRIVE (regola del 23/08): il file racconta cosa è
--    successo quel giorno. Il controllo buono sta qui, rifatto con roba
--    propria, e alla fine registra la versione che era rimasta fuori.
-- ============================================================================

do $verifica$
declare
  v_foto  jsonb;
  v_tit   uuid;
  v_r     jsonb;
  v_miei  uuid[] := '{}';
  v_ing   uuid;
  v_id    uuid;
  v_ok    integer;
begin
  v_foto := foto_righe();
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Verifica impossibile: non c''e'' nessun titolare.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  -- ------------------------------------------------------------------
  -- 1. UN NOME QUALUNQUE non ferma niente — e il nome me lo invento io
  -- ------------------------------------------------------------------
  -- 🔴 È il controllo che si era fermato, rifatto senza prendere in
  --    prestito niente: quello che serve è **un nome**, non un prodotto
  --    che esiste in magazzino.
  v_r := voce_risolvi_dati('lista_spesa', jsonb_build_object(
           'prodotto', 1, 'nome_sentito', 'VERIFICA sale grosso', 'quantita', 2));
  if nullif(v_r->>'manca', '') is not null then
    raise exception 'La lista della spesa si e'' fermata su un nome detto: «%»', v_r->>'manca';
  end if;
  -- 🔴 E il numero del catalogo mandato dal modello si BUTTA VIA: la lista
  --    non accoppia mai col magazzino (decisione di Alessio del 27/08).
  if nullif(v_r->'dati'->>'ingredient_id', '') is not null then
    raise exception 'La lista della spesa ha accoppiato col magazzino: doveva non cercare affatto.';
  end if;
  if v_r->'dati'->>'nome_libero' is distinct from 'VERIFICA sale grosso' then
    raise exception 'Il nome detto non e'' finito in lista come si e'' detto.';
  end if;

  -- ------------------------------------------------------------------
  -- 2. Un nome che in magazzino non c'e' passa uguale
  -- ------------------------------------------------------------------
  v_r := voce_risolvi_dati('lista_spesa', jsonb_build_object(
           'nome_sentito', 'VERIFICA carta forno', 'quantita', 1));
  if nullif(v_r->>'manca', '') is not null then
    raise exception 'Un nome libero si e'' fermato: «%»', v_r->>'manca';
  end if;

  -- ------------------------------------------------------------------
  -- 3. L'unica cosa che puo' mancare e' «cosa»
  -- ------------------------------------------------------------------
  v_r := voce_risolvi_dati('lista_spesa', '{}'::jsonb);
  if nullif(v_r->>'manca', '') is null then
    raise exception 'Una riga di lista senza nessun nome e'' passata.';
  end if;

  -- ------------------------------------------------------------------
  -- 4. E la riga nasce davvero, senza ingrediente attaccato
  -- ------------------------------------------------------------------
  v_r := fai_azione_dettata('lista_spesa', jsonb_build_object(
           'nome_libero', 'VERIFICA lista libera', 'quantita', 3, 'unita', 'pz'));
  v_id := (v_r->>'item')::uuid;
  v_miei := v_miei || v_id;
  if (select ingredient_id from shopping_list_items where id = v_id) is not null then
    raise exception 'La riga nata a voce porta un ingrediente: doveva restare libera.';
  end if;
  if (select custom_name from shopping_list_items where id = v_id)
     is distinct from 'VERIFICA lista libera' then
    raise exception 'La riga nata a voce non porta il nome detto.';
  end if;

  -- ------------------------------------------------------------------
  -- 5. La rottura a mano: un identificativo VERO non deve arrivare in tabella
  -- ------------------------------------------------------------------
  -- 🔴 QUI SERVE UN INGREDIENTE VERO, ed e' il solo controllo che ne ha
  --    bisogno: senza, si proverebbe che «un identificativo inesistente non
  --    arriva», che e' un'altra cosa e passerebbe anche se il filtro non ci
  --    fosse. Quindi **me lo creo io** e me lo riporto via.
  select id into v_ing from ingredients order by name limit 1;
  if v_ing is null then
    insert into ingredients (entity_id, name, category, unit, current_price)
    values ((select id from entities where entity_type = 'srls' limit 1),
            'VERIFICA prodotto della prova', 'altro', 'kg', 1)
    returning id into v_ing;
    v_miei := v_miei || v_ing;
  end if;

  v_r := fai_azione_dettata('lista_spesa', jsonb_build_object(
           'nome_libero', 'VERIFICA lista con id', 'ingredient_id', v_ing));
  v_id := (v_r->>'item')::uuid;
  v_miei := v_miei || v_id;
  if (select ingredient_id from shopping_list_items where id = v_id) is not null then
    raise exception 'Un identificativo passato a mano e'' arrivato in tabella.';
  end if;

  -- ------------------------------------------------------------------
  -- 6. LA CONTROPROVA DEL CASO CHE HA FATTO FALLIRE LA `…006`
  -- ------------------------------------------------------------------
  -- ⚠️ Senza nessun nome la funzione DEVE fermarsi: e' la risposta giusta
  --    che la verifica vecchia aveva scambiato per un difetto. Provarla
  --    esplicitamente impedisce che qualcuno, leggendo questo file fra sei
  --    mesi, creda che il caso vuoto sia stato «aggirato».
  v_r := voce_risolvi_dati('lista_spesa', jsonb_build_object('prodotto', 1));
  if nullif(v_r->>'manca', '') is null then
    raise exception 'Senza nessun nome la lista doveva fermarsi, e non l''ha fatto.';
  end if;

  -- ------------------------------------------------------------------
  -- 7. Pulizia — solo quello che questa verifica ha creato
  -- ------------------------------------------------------------------
  delete from shopping_list_items where id = any(v_miei);
  delete from price_history where ingredient_id = any(v_miei);
  delete from ingredients where id = any(v_miei);
  -- ⚠️ `record_id` è TESTO, non uuid: il cast è obbligatorio.
  delete from deleted_records where record_id = any(v_miei::text[]);

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della lista libera, rifatta');

  select count(*) into v_ok from ingredients;
  raise notice 'verifica rifatta: la lista non cerca in magazzino, e il caso vuoto si ferma come deve. Ingredienti in casa: %', v_ok;
end $verifica$;

-- ----------------------------------------------------------------------------
-- E si registra la versione rimasta fuori
-- ----------------------------------------------------------------------------
-- ⚠️ Il suo codice E' in produzione — constatato dal catalogo prima di
--    scrivere questa riga, non dedotto dal fatto che la migrazione si sia
--    fermata dopo le DDL. A mancare era solo la registrazione.
insert into applied_migrations (version, name)
values ('20260827000006', 'la_lista_della_spesa_e_libera') on conflict (version) do nothing;

insert into applied_migrations (version, name)
values ('20260827000017', 'la_verifica_che_prendeva_in_prestito_un_ingrediente') on conflict (version) do nothing;
