-- ============================================================================
-- UNA FOTO FA NASCERE UN PRODOTTO, NON UN INGREDIENTE — 27/08/2026
-- ============================================================================
--
-- La radice della confusione fra prodotto e ingrediente, misurata leggendo il
-- codice e non dedotta:
--
--   `Fotografa.jsx` → «Apri la scheda di un prodotto nuovo»
--                   → /ricettario/ingredienti/nuovo
--                   → `create_ingredient`
--
-- Quindi «MAIONESE HELLMANN'S 500 ml» non diventa *un prodotto
-- dell'ingrediente maionese*: diventa **un ingrediente a sé**. Da lì i 133
-- ingredienti del gestionale di prova con **20 in categoria «altro»**.
--
-- ----------------------------------------------------------------------------
-- COSA CAMBIA
-- ----------------------------------------------------------------------------
-- Una lettura d'etichetta produce **due cose in una transazione sola**:
--   1. l'INGREDIENTE generico, trovato se c'è già o creato se manca;
--   2. il PRODOTTO — quella confezione, con marca e formato — appeso a lui.
--
-- ⚠️ È UNA OPERAZIONE DEL CORRIDOIO (regola B4 del Contratto): tocca
--    `ingredients`, `articoli_fornitore` e `allergeni_prodotto`. A metà
--    lascerebbe un prodotto appeso a un ingrediente che non c'è, o un
--    ingrediente nuovo senza il prodotto che l'ha fatto nascere.
--
-- ⚠️ CHI DECIDE SE ACCORPARE È L'ASSISTENTE, per decisione del 25/08: lui
--    dice il nome generico, e se combacia con un ingrediente esistente il
--    prodotto gli si appende. `trova_o_crea_ingrediente` confronta per
--    `nome_ingrediente_chiave`, quindi «Olio EVO» e «olio evo» sono lo
--    stesso ingrediente.
--
-- ⚠️ E ALESSIO CONFERMA GUARDANDO, non a scatola chiusa (25/08: «la scheda
--    si vede PRIMA di salvare»): questa funzione è ciò che scatta al
--    salvataggio, e la schermata dice **prima** se l'ingrediente generico
--    esiste già o sta per nascere.
--
-- ----------------------------------------------------------------------------
-- IL PRODOTTO NON HA FORNITORE, E NON È UNA DIMENTICANZA
-- ----------------------------------------------------------------------------
-- Un'etichetta dice la marca, non chi te l'ha venduto: lo stesso barattolo
-- si compra da due grossisti diversi. Quindi `supplier_id` resta VUOTO, e
-- l'indice unico di `articoli_fornitore` lo ammette già
-- (`coalesce(supplier_id, '000…0'), chiave`). Il fornitore arriva quando
-- arriva una fattura, che è l'unico documento che lo sa.
--
-- ----------------------------------------------------------------------------
-- NESSUN PREZZO SI INVENTA
-- ----------------------------------------------------------------------------
-- Un'etichetta non porta un prezzo. Questa funzione **non scrive nessun
-- prezzo e non crea nessun lotto**: il prezzo arriva da un carico o da una
-- fattura, e il riflesso della `20260827000018` lo rispecchia da sé. Un
-- prezzo dedotto da una confezione sarebbe un numero plausibile al posto di
-- una misura.
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
  v_art         uuid;
  v_art_nuovo   boolean := false;
  v_unita       unit_type;
  v_categoria   ingredient_category;
  v_lettura     jsonb;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' registrare un prodotto letto da una foto.';
  end if;

  -- ------------------------------------------------------------------
  -- I due nomi, e sono due cose diverse
  -- ------------------------------------------------------------------
  v_ingrediente := nullif(btrim(p_scheda->>'ingrediente'), '');
  v_prodotto    := nullif(btrim(p_scheda->>'prodotto'), '');

  if v_ingrediente is null then
    raise exception 'Non ho capito di quale ingrediente e'' un prodotto. Scrivilo tu nella scheda.';
  end if;

  -- ⚠️ Senza una descrizione propria il prodotto prende quella
  --    dell'ingrediente piu'' la marca: e'' l'unico modo di distinguere due
  --    confezioni dello stesso ingrediente. Se non c'e'' nemmeno la marca,
  --    il prodotto e'' l'ingrediente stesso — ed e'' giusto: lo sfuso.
  if v_prodotto is null then
    v_prodotto := btrim(v_ingrediente || ' ' ||
                        coalesce(nullif(btrim(p_scheda->>'marca'), '') || ' ', '') ||
                        coalesce(nullif(btrim(p_scheda->>'formato'), ''), ''));
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

  -- ------------------------------------------------------------------
  -- 1. L'ingrediente generico: trovato o creato
  -- ------------------------------------------------------------------
  select * into v_trovato from trova_o_crea_ingrediente(
    v_ente, v_ingrediente, v_unita, v_categoria,
    coalesce((p_scheda->>'alimentare')::boolean, true));
  v_ing := v_trovato.id;

  -- ------------------------------------------------------------------
  -- 2. Il prodotto, appeso a lui
  -- ------------------------------------------------------------------
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
    'ingrediente_nuovo',  not v_trovato.era_gia_li,
    'prodotto_nuovo',     v_art_nuovo,
    'nome_ingrediente',   v_ingrediente,
    'nome_prodotto',      v_prodotto,
    'scritti',            v_lettura->'scritti',
    'scartati',           v_lettura->'scartati',
    'allergeni_toccati',  v_lettura->'allergeni_toccati');
end;
$$;

revoke all on function registra_prodotto_letto(jsonb) from public, anon, authenticated;
grant execute on function registra_prodotto_letto(jsonb) to authenticated;

comment on function registra_prodotto_letto(jsonb) is
  'Da una lettura d''etichetta fa nascere DUE cose in una transazione sola: '
  'l''INGREDIENTE generico (trovato se c''e'' gia'') e il PRODOTTO — quella '
  'confezione, con marca e formato — appeso a lui. Prima del 27/08/2026 una '
  'foto creava un ingrediente nuovo ogni volta, ed e'' da li'' che venivano i '
  '133 ingredienti con 20 in «altro». Non scrive nessun prezzo: un''etichetta '
  'non ne porta uno, e un prezzo dedotto da una confezione sarebbe un numero '
  'plausibile al posto di una misura.';

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- ⚠️ Costruisce tutto quello che le serve: gira su un gestionale vuoto.
do $verifica$
declare
  v_foto     jsonb;
  v_tit      uuid;
  v_r1       jsonb;
  v_r2       jsonb;
  v_r3       jsonb;
  v_miei_ing uuid[] := '{}';
  v_miei_art uuid[] := '{}';
  v_n        integer;
  v_cat      text;
begin
  v_foto := foto_righe();

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Verifica impossibile: nessun titolare configurato';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- ------------------------------------------------------------------
  -- 1. La prima foto: nascono UN ingrediente e UN prodotto
  -- ------------------------------------------------------------------
  v_r1 := registra_prodotto_letto(jsonb_build_object(
    'ingrediente', 'Maionese di verifica 20260827000020',
    'prodotto',    'MAIONESE VERIFICA SQUEEZE 500 20260827000020',
    'marca',       'Marca A',
    'formato',     'flacone da 500 ml',
    'nome_esteso', 'maionese',
    'unita',       'kg',
    'categoria',   'olio_condimenti',
    'conservazione', 'dispensa',
    'durata_giorni', 200));

  v_miei_ing := v_miei_ing || (v_r1->>'ingredient_id')::uuid;
  v_miei_art := v_miei_art || (v_r1->>'articolo_id')::uuid;

  if (v_r1->>'ingrediente_nuovo')::boolean is not true then
    raise exception 'Il primo giro doveva far nascere un ingrediente nuovo';
  end if;
  if (v_r1->>'prodotto_nuovo')::boolean is not true then
    raise exception 'Il primo giro doveva far nascere un prodotto nuovo';
  end if;

  -- ------------------------------------------------------------------
  -- 2. IL CUORE DEL BLOCCO: una SECONDA marca dello STESSO ingrediente
  --    NON crea un secondo ingrediente. E'' il difetto che questa
  --    migrazione chiude: prima ne nascevano due.
  -- ------------------------------------------------------------------
  v_r2 := registra_prodotto_letto(jsonb_build_object(
    'ingrediente', 'maionese di verifica 20260827000020',   -- stesso nome, altra grafia
    'prodotto',    'MAIONESE VERIFICA VASETTO 250 20260827000020',
    'marca',       'Marca B',
    'formato',     'vasetto da 250 ml',
    'unita',       'kg',
    'categoria',   'olio_condimenti'));

  v_miei_art := v_miei_art || (v_r2->>'articolo_id')::uuid;

  if (v_r2->>'ingrediente_nuovo')::boolean is not false then
    raise exception 'La seconda marca ha fatto nascere un SECONDO ingrediente: e'' il difetto che stiamo chiudendo';
  end if;
  if (v_r2->>'ingredient_id')::uuid <> (v_r1->>'ingredient_id')::uuid then
    raise exception 'Le due marche sono finite su due ingredienti diversi';
  end if;
  if (v_r2->>'prodotto_nuovo')::boolean is not true then
    raise exception 'La seconda marca doveva essere un prodotto nuovo';
  end if;

  select count(*) into v_n from articoli_fornitore
   where ingredient_id = (v_r1->>'ingredient_id')::uuid;
  if v_n <> 2 then
    raise exception 'L''ingrediente dovrebbe avere due versioni, ne ha %', v_n;
  end if;

  select count(*) into v_n from ingredients
   where name ilike '%20260827000020%';
  if v_n <> 1 then
    raise exception 'Gli ingredienti dovrebbero essere UNO, sono %', v_n;
  end if;

  -- ------------------------------------------------------------------
  -- 3. LA STESSA FOTO DUE VOLTE non duplica il prodotto
  -- ------------------------------------------------------------------
  v_r3 := registra_prodotto_letto(jsonb_build_object(
    'ingrediente', 'Maionese di verifica 20260827000020',
    'prodotto',    'MAIONESE VERIFICA SQUEEZE 500 20260827000020',
    'marca',       'Marca A',
    'unita',       'kg',
    'categoria',   'olio_condimenti'));

  if (v_r3->>'prodotto_nuovo')::boolean is not false then
    raise exception 'La stessa foto due volte ha creato un secondo prodotto';
  end if;
  if (v_r3->>'articolo_id')::uuid <> (v_r1->>'articolo_id')::uuid then
    raise exception 'La stessa foto due volte punta a due prodotti diversi';
  end if;

  -- ------------------------------------------------------------------
  -- 4. NESSUN PREZZO E NESSUN LOTTO si inventano
  -- ------------------------------------------------------------------
  select count(*) into v_n from stock_lots
   where ingredient_id = (v_r1->>'ingredient_id')::uuid;
  if v_n <> 0 then
    raise exception 'Una lettura d''etichetta ha creato % lotti', v_n;
  end if;
  select count(*) into v_n from price_history
   where ingredient_id = (v_r1->>'ingredient_id')::uuid;
  if v_n <> 0 then
    raise exception 'Una lettura d''etichetta ha inventato % prezzi', v_n;
  end if;
  select prezzo_da into v_cat from ingredients where id = (v_r1->>'ingredient_id')::uuid;
  if v_cat is not null then
    raise exception 'Un ingrediente nato da un''etichetta dichiara una provenienza del prezzo: %', v_cat;
  end if;

  -- ------------------------------------------------------------------
  -- 5. Senza il nome generico si RIFIUTA, e lo dice in italiano
  -- ------------------------------------------------------------------
  begin
    perform registra_prodotto_letto(jsonb_build_object(
      'prodotto', 'QUALCOSA SENZA INGREDIENTE 20260827000020', 'unita', 'kg'));
    raise exception 'Un prodotto senza ingrediente generico e'' passato';
  exception
    when others then
      if sqlerrm not like '%di quale ingrediente%' then
        raise exception 'Il rifiuto dice la cosa sbagliata: %', sqlerrm;
      end if;
  end;

  -- ------------------------------------------------------------------
  -- Si riporta via tutto, per identificativo
  -- ------------------------------------------------------------------
  perform set_config('request.jwt.claims', null, true);
  delete from allergeni_prodotto where ingredient_id = any(v_miei_ing);
  delete from articoli_fornitore where id = any(v_miei_art);
  delete from price_history where ingredient_id = any(v_miei_ing);
  delete from ingredients where id = any(v_miei_ing);
  delete from deleted_records where record_id = any((v_miei_ing || v_miei_art)::text[]);

  perform pretendi_nessun_residuo(v_foto, 'una foto fa nascere un prodotto');

  raise notice 'Una foto fa nascere un prodotto e non un ingrediente: due marche restano UN ingrediente con DUE versioni, la stessa foto due volte non duplica niente, e nessun prezzo si inventa.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000020', 'una_foto_fa_nascere_un_prodotto_non_un_ingrediente') on conflict (version) do nothing;
