-- ============================================================================
-- IL PRODOTTO SI APPENDE ALL'INGREDIENTE SCELTO — 27/08/2026
-- ============================================================================
--
-- `registra_prodotto_letto` (20260827000020) trova o crea l'ingrediente
-- generico dal nome. Va bene quando la lettura entra da sola, ma la scheda
-- che Alessio vede prima di salvare **è ricca**: soglia di magazzino, scarto,
-- note HACCP, «tenuto in magazzino», fornitore abituale. Quei campi li scrive
-- la schermata, che ha già creato o aggiornato l'ingrediente.
--
-- Se poi la funzione ricercasse l'ingrediente **per nome**, e Alessio avesse
-- corretto il nome nella scheda, **nascerebbe un secondo ingrediente** — cioè
-- esattamente il difetto che questo blocco chiude, rientrato dalla finestra.
--
-- ----------------------------------------------------------------------------
-- L'INGREDIENTE SI PUÒ INDICARE, E VIAGGIA DENTRO LA SCHEDA
-- ----------------------------------------------------------------------------
-- ⚠️ `ingredient_id` sta NEL jsonb e non è un parametro nuovo, apposta: in
--    Postgres un parametro in più fa una funzione **nuova**, e due funzioni
--    sovrapposte rendono ambigua ogni chiamata per nome (errore 42725, a
--    tempo di esecuzione). È la trappola pagata il 13/08 con
--    `create_ingredient`. Dentro il jsonb la firma non cambia, quindi
--    `create or replace` basta e non c'è nessun `drop` che riapra i permessi.
--
-- ⚠️ E SE L'INGREDIENTE INDICATO NON ESISTE si RIFIUTA, invece di ripiegare
--    sulla ricerca per nome: un ripiego silenzioso rimetterebbe in piedi
--    proprio il caso che si vuole impedire.
-- ============================================================================

create or replace function registra_prodotto_letto(p_scheda jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ente        uuid;
  v_ingrediente text;
  v_prodotto    text;
  v_chiave      text;
  v_trovato     record;
  v_ing         uuid;
  v_indicato    uuid;
  v_ing_nuovo   boolean := false;
  v_art         uuid;
  v_art_nuovo   boolean := false;
  v_unita       unit_type;
  v_categoria   ingredient_category;
  v_lettura     jsonb;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' registrare un prodotto letto da una foto.';
  end if;

  v_ingrediente := nullif(btrim(p_scheda->>'ingrediente'), '');
  v_prodotto    := nullif(btrim(p_scheda->>'prodotto'), '');

  begin
    v_indicato := nullif(btrim(p_scheda->>'ingredient_id'), '')::uuid;
  exception when others then
    raise exception 'L''ingrediente indicato non si capisce.';
  end;

  -- ------------------------------------------------------------------
  -- 1. L'ingrediente: indicato, oppure trovato/creato dal nome
  -- ------------------------------------------------------------------
  if v_indicato is not null then
    select id, name into v_ing, v_ingrediente from ingredients where id = v_indicato;
    if v_ing is null then
      -- ⚠️ RIFIUTA invece di ripiegare sul nome: un ripiego silenzioso
      --    farebbe nascere il secondo ingrediente che stiamo evitando.
      raise exception 'L''ingrediente a cui appendere il prodotto non esiste piu''.';
    end if;
  else
    if v_ingrediente is null then
      raise exception 'Non ho capito di quale ingrediente e'' un prodotto. Scrivilo tu nella scheda.';
    end if;

    select id into v_ente from entities order by created_at limit 1;
    if v_ente is null then
      raise exception 'Nessuna societa'' configurata: non so a chi intestare il prodotto.';
    end if;

    begin
      v_unita := coalesce(nullif(p_scheda->>'unita', ''), 'kg')::unit_type;
    exception when others then
      v_unita := 'kg'::unit_type;
    end;

    begin
      v_categoria := coalesce(nullif(p_scheda->>'categoria', ''), 'altro')::ingredient_category;
    exception when others then
      v_categoria := 'altro'::ingredient_category;
    end;

    select * into v_trovato from trova_o_crea_ingrediente(
      v_ente, v_ingrediente, v_unita, v_categoria,
      coalesce((p_scheda->>'alimentare')::boolean, true));
    v_ing := v_trovato.id;
    v_ing_nuovo := not v_trovato.era_gia_li;
  end if;

  -- ------------------------------------------------------------------
  -- 2. Il prodotto, appeso a lui
  -- ------------------------------------------------------------------
  if v_prodotto is null then
    v_prodotto := btrim(v_ingrediente || ' ' ||
                        coalesce(nullif(btrim(p_scheda->>'marca'), '') || ' ', '') ||
                        coalesce(nullif(btrim(p_scheda->>'formato'), ''), ''));
  end if;

  v_chiave := chiave_articolo(v_prodotto);

  select id into v_art
    from articoli_fornitore
   where supplier_id is null and chiave = v_chiave;

  if v_art is null then
    insert into articoli_fornitore (
      supplier_id, descrizione, chiave, ingredient_id,
      marca, formato, nome_esteso, unita_fattura, fattore)
    values (
      null, v_prodotto, v_chiave, v_ing,
      nullif(btrim(p_scheda->>'marca'), ''),
      nullif(btrim(p_scheda->>'formato'), ''),
      nullif(btrim(p_scheda->>'nome_esteso'), ''),
      nullif(btrim(p_scheda->>'unita_confezione'), ''),
      greatest(coalesce((p_scheda->>'quantita_confezione')::numeric, 1), 0.0001))
    returning id into v_art;
    v_art_nuovo := true;
  else
    -- ⚠️ Un prodotto che c'era gia'' NON cambia ingrediente: se qualcuno
    --    l'aveva collegato a mano, quella scelta vince su una lettura
    --    automatica — stessa regola degli allergeni «alessio».
    update articoli_fornitore
       set marca       = coalesce(marca, nullif(btrim(p_scheda->>'marca'), '')),
           formato     = coalesce(formato, nullif(btrim(p_scheda->>'formato'), '')),
           nome_esteso = coalesce(nome_esteso, nullif(btrim(p_scheda->>'nome_esteso'), '')),
           ingredient_id = coalesce(ingredient_id, v_ing),
           aggiornato_il = now()
     where id = v_art;
    select ingredient_id into v_ing from articoli_fornitore where id = v_art;
  end if;

  -- ------------------------------------------------------------------
  -- 3. I campi dell'etichetta sull'ingrediente
  -- ------------------------------------------------------------------
  v_lettura := applica_lettura_etichetta(v_ing, p_scheda);

  return jsonb_build_object(
    'ingredient_id',      v_ing,
    'articolo_id',        v_art,
    'ingrediente_nuovo',  v_ing_nuovo,
    'prodotto_nuovo',     v_art_nuovo,
    'nome_ingrediente',   v_ingrediente,
    'nome_prodotto',      v_prodotto,
    'scritti',            v_lettura->'scritti',
    'scartati',           v_lettura->'scartati',
    'allergeni_toccati',  v_lettura->'allergeni_toccati');
end;
$$;

-- ⚠️ Nessun `drop`, quindi i permessi restano quelli della `…020`. Si
--    riscrivono lo stesso: un `revoke`/`grant` che si da'' per fatto e'' la
--    stessa cosa di un corpo dato per fatto (lezione del 24/08).
revoke all on function registra_prodotto_letto(jsonb) from public, anon, authenticated;
grant execute on function registra_prodotto_letto(jsonb) to authenticated;

comment on function registra_prodotto_letto(jsonb) is
  'Da una lettura d''etichetta fa nascere il PRODOTTO — quella confezione, con '
  'marca e formato — appeso a un INGREDIENTE generico. L''ingrediente si puo'' '
  'INDICARE con `ingredient_id` dentro la scheda (e'' il caso della schermata, '
  'che l''ha appena salvato con tutti i suoi campi); senza, si trova per nome '
  'o si crea. Non scrive nessun prezzo: un''etichetta non ne porta uno.';

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_foto     jsonb;
  v_tit      uuid;
  v_ente     uuid;
  v_ing      uuid;
  v_r        jsonb;
  v_miei_ing uuid[] := '{}';
  v_miei_art uuid[] := '{}';
  v_n        integer;
begin
  v_foto := foto_righe();

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  if v_tit is null or v_ente is null then
    raise exception 'Verifica impossibile: manca il titolare o la societa''';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- La schermata ha gia' salvato l'ingrediente, col nome CORRETTO A MANO
  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'Passata di pomodoro 20260827000024', 'secco_dispensa', 'kg')
  returning id into v_ing;
  v_miei_ing := v_miei_ing || v_ing;

  -- ------------------------------------------------------------------
  -- IL CONTROLLO: il prodotto si appende a QUELL'ingrediente, anche se
  -- il nome letto dalla foto era diverso. Prima nasceva un secondo
  -- ingrediente, ed e' il difetto che questo blocco chiude.
  -- ------------------------------------------------------------------
  v_r := registra_prodotto_letto(jsonb_build_object(
    'ingredient_id', v_ing::text,
    'ingrediente',   'POMODORO PELATO MARCA X 20260827000024',  -- il nome storto della foto
    'prodotto',      'Passata Marca X bottiglia 700 g 20260827000024',
    'marca',         'Marca X',
    'formato',       'bottiglia da 700 g'));

  v_miei_art := v_miei_art || (v_r->>'articolo_id')::uuid;

  if (v_r->>'ingredient_id')::uuid <> v_ing then
    raise exception 'Il prodotto si e'' appeso a un altro ingrediente';
  end if;
  if (v_r->>'ingrediente_nuovo')::boolean is not false then
    raise exception 'Indicando l''ingrediente non ne deve nascere uno nuovo';
  end if;

  select count(*) into v_n from ingredients where name ilike '%20260827000024%';
  if v_n <> 1 then
    raise exception 'Gli ingredienti dovrebbero essere UNO, sono %', v_n;
  end if;

  -- ------------------------------------------------------------------
  -- E un ingrediente indicato che non esiste si RIFIUTA, invece di
  -- ripiegare sul nome (che ne farebbe nascere uno)
  -- ------------------------------------------------------------------
  begin
    perform registra_prodotto_letto(jsonb_build_object(
      'ingredient_id', '00000000-0000-0000-0000-000000000000',
      'ingrediente',   'Qualcosa 20260827000024',
      'prodotto',      'Qualcosa di preciso 20260827000024'));
    raise exception 'Un ingrediente indicato inesistente e'' passato';
  exception
    when others then
      if sqlerrm not like '%non esiste piu%' then
        raise exception 'Il rifiuto dice la cosa sbagliata: %', sqlerrm;
      end if;
  end;

  select count(*) into v_n from ingredients where name ilike '%20260827000024%';
  if v_n <> 1 then
    raise exception 'Il rifiuto ha lasciato nascere un ingrediente: ora sono %', v_n;
  end if;

  -- ------------------------------------------------------------------
  -- Si riporta via tutto, per identificativo
  -- ------------------------------------------------------------------
  perform set_config('request.jwt.claims', null, true);
  delete from allergeni_prodotto where ingredient_id = any(v_miei_ing);
  delete from articoli_fornitore where id = any(v_miei_art);
  delete from price_history where ingredient_id = any(v_miei_ing);
  delete from ingredients where id = any(v_miei_ing);
  delete from deleted_records where record_id = any((v_miei_ing || v_miei_art)::text[]);

  perform pretendi_nessun_residuo(v_foto, 'il prodotto si appende all''ingrediente scelto');

  raise notice 'Il prodotto si appende all''ingrediente indicato dalla schermata, anche quando il nome letto dalla foto era diverso — e un ingrediente indicato che non esiste viene rifiutato invece di farne nascere uno.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000024', 'il_prodotto_si_appende_all_ingrediente_scelto') on conflict (version) do nothing;
