-- =====================================================================
-- L'ARCHIVIO DELLE RICETTE — tag, stagioni e allergeni prima del magazzino
-- 25/10/2026
-- =====================================================================
-- Alessio, prima dell'apertura: *«ho moltissime ricette salvate su Clove
-- che vorrei organizzare dentro il gestionale… l'associazione con gli
-- ingredienti avrà senso solo per quei piatti che proverò… ho bisogno di
-- un sistema di tag e categorie… potremmo chiedere a MEMO di darmi una
-- mano nella compilazione»*. Approvato tutto tranne l'importazione di molti
-- link insieme: le ricette si caricano una alla volta.
--
-- Quattro cose, tutte sulla bozza e sulla ricetta:
--
-- 1. TAG E STAGIONI SULLA BOZZA. La ricetta li aveva già (`recipes.tags`,
--    `recipes.seasonality`); la bozza no, quindi un archivio si poteva
--    ordinare solo DOPO aver confermato ogni ricetta. Ora nascono sulla
--    bozza e la promozione li porta con sé.
--
-- 2. 🔴 GLI ALLERGENI D'ARCHIVIO. Gli allergeni di una ricetta si contano
--    dai prodotti del magazzino (`v_recipe_allergens`). Una ricetta i cui
--    ingredienti NON sono collegati non ne ha nessuno — e peggio: una
--    ricetta con metà ingredienti collegati mostra solo gli allergeni di
--    quella metà, senza che niente lo dica. `allergeni_archivio` è l'elenco
--    detto per la ricetta intera, finché non è tutta collegata.
--    ⚠️ VUOTO NON È «NESSUN ALLERGENE»: `null` vuol dire «non l'ha detto
--       nessuno», `'{}'` vuol dire «nessuno». E l'elenco porta SEMPRE la sua
--       origine — «proposti» (da MEMO) o «confermati» (da Alessio) — e un
--       vincolo impedisce che uno ci sia senza l'altra.
--    ⚠️ NON TOCCA IL MENU: una ricetta con ingredienti da collegare non può
--       essere pronta per la carta né stare in un menu (20261025000020),
--       quindi questo elenco non arriva mai su un foglio stampato né in sala.
--
-- 3. MEMO PROPONE all'importazione da link anche tipo, stagioni, tag e
--    allergeni (`crea_bozza_da_lettura` li accetta). Tutto «proposto»:
--    sulla bozza si vede, e niente diventa confermato da solo.
--
-- 4. `ricette_da_collegare`: quali ricette leggono gli allergeni
--    dall'archivio invece che dai prodotti (una riga per ricetta).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LE COLONNE
-- ---------------------------------------------------------------------
alter table bozze_ricetta add column if not exists tags text[] not null default '{}';
alter table bozze_ricetta add column if not exists stagioni season_code[] not null default '{}';
alter table bozze_ricetta add column if not exists allergeni allergen[];
alter table bozze_ricetta add column if not exists allergeni_origine text;

alter table bozze_ricetta drop constraint if exists bozza_ricetta_allergeni_origine_nota;
alter table bozze_ricetta add constraint bozza_ricetta_allergeni_origine_nota check (
  allergeni_origine is null or allergeni_origine in ('proposti', 'confermati'));
alter table bozze_ricetta drop constraint if exists bozza_ricetta_allergeni_con_origine;
alter table bozze_ricetta add constraint bozza_ricetta_allergeni_con_origine check (
  (allergeni is null) = (allergeni_origine is null));

comment on column bozze_ricetta.tags is
  'Le etichette libere per ordinare l''archivio (es. «pesce», «vegetariano», «estate siciliana»). Minuscole.';
comment on column bozze_ricetta.stagioni is
  'Le stagioni della ricetta: passano a recipes.seasonality alla conferma.';
comment on column bozze_ricetta.allergeni is
  'Gli allergeni della ricetta intera, detti prima del collegamento al magazzino. NULL = non l''ha detto nessuno; vuoto = nessuno.';
comment on column bozze_ricetta.allergeni_origine is
  'Chi ha detto gli allergeni: «proposti» (MEMO, da confermare) o «confermati» (il titolare).';
comment on constraint bozza_ricetta_allergeni_origine_nota on bozze_ricetta is
  'Gli allergeni sono proposti da MEMO o confermati da te: non c''è un terzo modo.';
comment on constraint bozza_ricetta_allergeni_con_origine on bozze_ricetta is
  'Un elenco di allergeni dice sempre chi l''ha scritto, e un''origine senza elenco non ha senso.';

alter table recipes add column if not exists allergeni_archivio allergen[];
alter table recipes add column if not exists allergeni_archivio_origine text;

alter table recipes drop constraint if exists ricetta_allergeni_archivio_origine_nota;
alter table recipes add constraint ricetta_allergeni_archivio_origine_nota check (
  allergeni_archivio_origine is null or allergeni_archivio_origine in ('proposti', 'confermati'));
alter table recipes drop constraint if exists ricetta_allergeni_archivio_con_origine;
alter table recipes add constraint ricetta_allergeni_archivio_con_origine check (
  (allergeni_archivio is null) = (allergeni_archivio_origine is null));

comment on column recipes.allergeni_archivio is
  'Gli allergeni della ricetta intera finché ha ingredienti da collegare al magazzino. Quando è tutta collegata valgono quelli contati dai prodotti (v_recipe_allergens). NULL = non l''ha detto nessuno; vuoto = nessuno.';
comment on column recipes.allergeni_archivio_origine is
  'Chi ha detto allergeni_archivio: «proposti» (MEMO, da confermare) o «confermati» (il titolare).';
comment on constraint ricetta_allergeni_archivio_origine_nota on recipes is
  'Gli allergeni d''archivio sono proposti da MEMO o confermati da te: non c''è un terzo modo.';
comment on constraint ricetta_allergeni_archivio_con_origine on recipes is
  'Un elenco di allergeni dice sempre chi l''ha scritto, e un''origine senza elenco non ha senso.';

-- ---------------------------------------------------------------------
-- 2. LA BOZZA DA UNA LETTURA ACCETTA LE PROPOSTE NUOVE
-- ---------------------------------------------------------------------
-- ⚠️ Riscritta dal corpo VIVO (letto dalla produzione il 25/10/2026, uguale
--    a 20261010000003): si aggiungono tipo, tag, stagioni e allergeni.
--    I permessi non si riscrivono: `create or replace` non li tocca.
-- ⚠️ Un valore fuori elenco si RIFIUTA con un messaggio leggibile, come per
--    categoria e fase: chi chiama li ha già filtrati (`proposte.ts`).
create or replace function crea_bozza_da_lettura(
  p_bozza       jsonb,
  p_ingredienti jsonb,
  p_passaggi    jsonb,
  p_gesto       uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id        uuid;
  v_titolo    text;
  v_origine   text;
  v_categoria recipe_category;
  v_fase      step_phase;
  v_riga      jsonb;
  v_n         integer := 0;
  v_tipo      text;
  v_stagioni  season_code[];
  v_allergeni allergen[];
  v_tags      text[];
begin
  if not is_titolare() then
    raise exception 'Creare una bozza di ricetta e'' riservato al titolare.';
  end if;
  if p_gesto is null then
    raise exception 'Manca l''identificativo del gesto: senza, un doppio tocco potrebbe creare due bozze.';
  end if;

  -- Lo stesso gesto ripetuto: la stessa bozza, nessuna scrittura.
  select id into v_id from bozze_ricetta where gesto_creazione = p_gesto;
  if found then
    return jsonb_build_object('bozza_id', v_id, 'gia_fatto', true);
  end if;

  v_titolo := nullif(btrim(coalesce(p_bozza ->> 'titolo', '')), '');
  if v_titolo is null then
    raise exception 'La ricetta letta non ha un titolo: non posso creare la bozza senza.';
  end if;
  v_origine := coalesce(p_bozza ->> 'origine_tipo', 'link');

  begin
    v_categoria := nullif(p_bozza ->> 'categoria', '')::recipe_category;
  exception when invalid_text_representation then
    raise exception 'La categoria «%» non esiste nel Ricettario.', p_bozza ->> 'categoria';
  end;

  v_tipo := coalesce(nullif(p_bozza ->> 'tipo', ''), 'piatto_finito');
  if v_tipo not in ('piatto_finito', 'preparazione', 'finger') then
    raise exception 'Il tipo «%» non esiste nel Ricettario.', v_tipo;
  end if;

  begin
    v_stagioni := coalesce(
      (select array_agg(distinct s::season_code)
         from jsonb_array_elements_text(coalesce(p_bozza -> 'stagioni', '[]'::jsonb)) s),
      '{}');
  exception when invalid_text_representation then
    raise exception 'Una delle stagioni proposte non esiste: %.', p_bozza -> 'stagioni';
  end;

  -- ⚠️ Allergeni: la CHIAVE assente vuol dire «nessuno li ha detti» (null);
  --    un elenco vuoto vuol dire «nessun allergene». Sono due risposte.
  if p_bozza ? 'allergeni' and jsonb_typeof(p_bozza -> 'allergeni') = 'array' then
    begin
      v_allergeni := coalesce(
        (select array_agg(distinct a::allergen order by a::allergen)
           from jsonb_array_elements_text(p_bozza -> 'allergeni') a),
        '{}');
    exception when invalid_text_representation then
      raise exception 'Uno degli allergeni proposti non esiste: %.', p_bozza -> 'allergeni';
    end;
  end if;

  v_tags := coalesce(
    (select array_agg(distinct t)
       from (select lower(btrim(x)) as t
               from jsonb_array_elements_text(coalesce(p_bozza -> 'tags', '[]'::jsonb)) x) q
      where t <> ''),
    '{}');

  insert into bozze_ricetta (
    titolo, origine_tipo, origine_riferimento, sunto, porzioni, categoria,
    buchi_dichiarati, proposte_assistente, gesto_creazione,
    tipo, stagioni, tags, allergeni, allergeni_origine
  ) values (
    v_titolo,
    v_origine,
    nullif(btrim(coalesce(p_bozza ->> 'origine_riferimento', '')), ''),
    nullif(btrim(coalesce(p_bozza ->> 'sunto', '')), ''),
    (p_bozza ->> 'porzioni')::integer,
    v_categoria,
    coalesce(
      (select array_agg(b) from jsonb_array_elements_text(coalesce(p_bozza -> 'buchi_dichiarati', '[]'::jsonb)) b),
      '{}'),
    coalesce(
      (select array_agg(b) from jsonb_array_elements_text(coalesce(p_bozza -> 'proposte_assistente', '[]'::jsonb)) b),
      '{}'),
    p_gesto,
    v_tipo, v_stagioni, v_tags, v_allergeni,
    -- Da una lettura gli allergeni sono SEMPRE proposti: nessuno li ha
    -- ancora guardati.
    case when v_allergeni is null then null else 'proposti' end
  )
  returning id into v_id;

  for v_riga in select * from jsonb_array_elements(coalesce(p_ingredienti, '[]'::jsonb)) loop
    v_n := v_n + 1;
    insert into bozze_ricetta_ingredienti (
      bozza_id, posizione, testo_originale, nome, quantita, unita, nota
    ) values (
      v_id,
      v_n,
      nullif(v_riga ->> 'testo_originale', ''),
      btrim(v_riga ->> 'nome'),
      (v_riga ->> 'quantita')::numeric,
      nullif(btrim(coalesce(v_riga ->> 'unita', '')), ''),
      nullif(btrim(coalesce(v_riga ->> 'nota', '')), '')
    );
  end loop;

  v_n := 0;
  for v_riga in select * from jsonb_array_elements(coalesce(p_passaggi, '[]'::jsonb)) loop
    v_n := v_n + 1;
    begin
      v_fase := nullif(v_riga ->> 'fase', '')::step_phase;
    exception when invalid_text_representation then
      raise exception 'La fase «%» del passaggio % non esiste.', v_riga ->> 'fase', v_n;
    end;
    insert into bozze_ricetta_passaggi (bozza_id, posizione, fase, descrizione)
    values (v_id, v_n, v_fase, nullif(btrim(coalesce(v_riga ->> 'descrizione', '')), ''));
  end loop;

  return jsonb_build_object('bozza_id', v_id, 'gia_fatto', false);
end
$function$;

-- ---------------------------------------------------------------------
-- 3. LA PROMOZIONE PORTA CON SÉ TAG, STAGIONI E ALLERGENI
-- ---------------------------------------------------------------------
-- Ripresa dal corpo di 20261025000050 (non ancora applicata da nessuna
-- parte quando questa è stata scritta): cambia solo l'insert della ricetta.
create or replace function promuovi_bozza_ricetta(
  p_bozza_id uuid,
  p_esito    text,
  p_gesto    uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_bozza   bozze_ricetta%rowtype;
  v_buchi   text[] := '{}';
  v_riga    record;
  v_ricetta uuid;
  v_numero  integer := 0;
  v_unita   unit_type;
begin
  if not is_titolare() then
    raise exception 'Confermare una bozza di ricetta e'' riservato al titolare.';
  end if;
  if p_gesto is null then
    raise exception 'Manca l''identificativo del gesto di conferma: senza, un doppio tocco potrebbe creare due ricette.';
  end if;

  select * into v_bozza from bozze_ricetta where id = p_bozza_id for update;
  if not found then
    raise exception 'Questa bozza non esiste piu''.';
  end if;

  -- Gia' diventata ricetta: lo STESSO gesto ripetuto riceve la stessa
  -- risposta (doppio tocco), un gesto nuovo viene rifiutato.
  if v_bozza.promossa_il is not null then
    if v_bozza.gesto_promozione = p_gesto then
      return jsonb_build_object('esito', 'ricetta', 'ricetta_id', v_bozza.ricetta_id, 'gia_fatto', true);
    end if;
    raise exception 'Questa bozza e'' gia'' diventata ricetta il %: non se ne crea una seconda.',
      to_char(v_bozza.promossa_il at time zone 'Europe/Rome', 'DD/MM/YYYY');
  end if;

  if v_bozza.stato = 'scartata' then
    raise exception 'Questa bozza e'' stata scartata: riaprila, se vuoi confermarla.';
  end if;

  if p_esito = 'ispirazione' then
    if v_bozza.stato = 'ispirazione' then
      return jsonb_build_object('esito', 'ispirazione', 'ricetta_id', null, 'gia_fatto', true);
    end if;
    update bozze_ricetta set stato = 'ispirazione' where id = p_bozza_id;
    return jsonb_build_object('esito', 'ispirazione', 'ricetta_id', null, 'gia_fatto', false);
  elsif p_esito is distinct from 'ricetta' then
    raise exception 'Una bozza si conferma come ispirazione o come ricetta.';
  end if;

  -- ---- i buchi, tutti ----
  if v_bozza.categoria is null then
    v_buchi := v_buchi || 'manca la categoria'::text;
  elsif v_bozza.categoria = 'finger_food' then
    v_buchi := v_buchi || 'i finger si creano dal Ricettario: questa bozza non puo'' diventarne uno'::text;
  end if;
  -- 🔴 25/10/2026: il TIPO decide cosa si pretende. Un piatto vuole le
  --    porzioni; una preparazione e un finger vogliono la RESA, perche' il
  --    Ricettario li costa per unita' di resa quando entrano in un'altra
  --    ricetta (`componente_richiede_resa`), e le porzioni non servono.
  if v_bozza.tipo = 'piatto_finito' then
    if v_bozza.porzioni is null then
      v_buchi := v_buchi || 'mancano le porzioni'::text;
    end if;
  elsif v_bozza.resa_quantita is null or v_bozza.resa_unita is null then
    v_buchi := v_buchi || format('manca la resa (quanto ne viene da una dose di questa %s)',
      case v_bozza.tipo when 'finger' then 'ricetta di finger' else 'preparazione' end);
  end if;
  if cardinality(v_bozza.buchi_dichiarati) > 0 then
    v_buchi := v_buchi || ('segnalazioni ancora aperte: ' || array_to_string(v_bozza.buchi_dichiarati, '; '));
  end if;
  if not exists (select 1 from bozze_ricetta_ingredienti where bozza_id = p_bozza_id) then
    v_buchi := v_buchi || 'nessun ingrediente'::text;
  end if;

  for v_riga in
    select * from bozze_ricetta_ingredienti where bozza_id = p_bozza_id order by posizione, id
  loop
    -- 🔴 25/10/2026: un ingrediente NON collegato non e' piu' un buco.
    --    Entra nella ricetta com'e' scritto, fra quelli da collegare, e il
    --    collegamento diventa obbligatorio solo dove serve davvero: pronta
    --    per la carta, in un menu, usata come preparazione. Quantita' e
    --    unita' si pretendono solo sulle righe collegate, perche' sono le
    --    sole che entrano nel costo; le altre si correggono al collegamento.
    continue when v_riga.ingredient_id is null;
    if v_riga.quantita is null then
      v_buchi := v_buchi || format('«%s»: quantita'' mancante', v_riga.nome);
    end if;
    if v_riga.unita is null or btrim(v_riga.unita) = '' then
      v_buchi := v_buchi || format('«%s»: unita'' mancante', v_riga.nome);
    elsif not exists (select 1 from unnest(enum_range(null::unit_type)) u where u::text = v_riga.unita) then
      v_buchi := v_buchi || format('«%s»: unita'' non compresa («%s»)', v_riga.nome, v_riga.unita);
    end if;
  end loop;

  for v_riga in
    select * from bozze_ricetta_passaggi where bozza_id = p_bozza_id order by posizione, id
  loop
    v_numero := v_numero + 1;
    if v_riga.fase is null then
      v_buchi := v_buchi || format('passaggio %s: manca la fase', v_numero);
    end if;
    if v_riga.descrizione is null or btrim(v_riga.descrizione) = '' then
      v_buchi := v_buchi || format('passaggio %s: manca la descrizione', v_numero);
    end if;
  end loop;

  if cardinality(v_buchi) > 0 then
    raise exception 'Questa bozza ha ancora dei buchi, e non diventa ricetta: %.',
      array_to_string(v_buchi, ' · ');
  end if;

  -- ---- tutto insieme ----
  -- 25/10/2026 (archivio): tag, stagioni e allergeni della bozza passano
  -- alla ricetta. Gli allergeni vanno in `allergeni_archivio` con la LORO
  -- origine: «proposti» resta «proposti», la promozione non conferma niente.
  insert into recipes (name, category, portions_yield, recipe_type, yield_quantity, yield_unit, notes,
                       tags, seasonality, allergeni_archivio, allergeni_archivio_origine)
  values (btrim(v_bozza.titolo), v_bozza.categoria,
          case when v_bozza.tipo = 'piatto_finito' then v_bozza.porzioni else 1 end,
          v_bozza.tipo::recipe_type,
          case when v_bozza.tipo = 'piatto_finito' then null else v_bozza.resa_quantita end,
          case when v_bozza.tipo = 'piatto_finito' then null else v_bozza.resa_unita end,
          v_bozza.sunto,
          v_bozza.tags, v_bozza.stagioni, v_bozza.allergeni, v_bozza.allergeni_origine)
  returning id into v_ricetta;

  for v_riga in
    select * from bozze_ricetta_ingredienti where bozza_id = p_bozza_id order by posizione, id
  loop
    if v_riga.ingredient_id is null then
      insert into ricetta_ingredienti_da_collegare (recipe_id, posizione, nome, quantita, unita, nota)
      values (v_ricetta, v_riga.posizione, btrim(v_riga.nome), v_riga.quantita,
              nullif(btrim(v_riga.unita), ''), v_riga.nota);
    else
      v_unita := v_riga.unita::unit_type;
      insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit, prep_note)
      values (v_ricetta, v_riga.ingredient_id, v_riga.quantita, v_unita, v_riga.nota);
    end if;
  end loop;

  v_numero := 0;
  for v_riga in
    select * from bozze_ricetta_passaggi where bozza_id = p_bozza_id order by posizione, id
  loop
    v_numero := v_numero + 1;
    insert into recipe_steps (recipe_id, step_number, phase, description)
    values (v_ricetta, v_numero, v_riga.fase, btrim(v_riga.descrizione));
  end loop;

  update bozze_ricetta
     set promossa_il = now(), ricetta_id = v_ricetta, gesto_promozione = p_gesto
   where id = p_bozza_id;

  return jsonb_build_object('esito', 'ricetta', 'ricetta_id', v_ricetta, 'gia_fatto', false);
end
$funzione$;
comment on function promuovi_bozza_ricetta(uuid, text, uuid) is
  'La conferma del titolare su una bozza: come ispirazione (nessuna ricetta) o come ricetta (ricetta + ingredienti + passaggi in una transazione). Il tipo, i tag, le stagioni e gli allergeni d''archivio (con la loro origine) vengono dalla bozza: un piatto pretende le porzioni, una preparazione o un finger la resa. Un ingrediente non collegato non blocca: entra fra quelli da collegare. Rifiuta gli altri buchi nominandoli tutti, non crea mai prodotti, rifiuta le bozze scartate o gia'' promosse; lo stesso gesto ripetuto riceve la stessa ricetta. Solo titolare, e solo attraverso il corridoio.';

revoke all on function promuovi_bozza_ricetta(uuid, text, uuid) from public, anon, authenticated;
grant execute on function promuovi_bozza_ricetta(uuid, text, uuid) to authenticated;
-- ---------------------------------------------------------------------
-- 4. QUALI RICETTE HANNO ANCORA INGREDIENTI DA COLLEGARE
-- ---------------------------------------------------------------------
-- L'elenco delle ricette deve sapere, per ognuna, se gli allergeni si
-- contano dai prodotti o si leggono dall'archivio (src/lib/calcoli/
-- archivioRicette.js). 🔴 Chiedere le RIGHE da collegare non va: il gateway
-- ne restituisce al massimo mille, in silenzio, e cento ricette d'archivio
-- da dodici ingredienti sono già 1200 — le ultime ricette risulterebbero
-- «tutte collegate» e il filtro «senza glutine» le farebbe passare. Una riga
-- per ricetta è il numero delle ricette, non degli ingredienti.
-- ⚠️ `security_invoker`: decide la RLS della tabella, non una seconda serratura.
create or replace view ricette_da_collegare with (security_invoker = true) as
  select recipe_id, count(*)::int as righe
    from ricetta_ingredienti_da_collegare
   group by recipe_id;
comment on view ricette_da_collegare is
  'Una riga per ogni ricetta che ha ancora ingredienti da collegare al magazzino, col loro numero. Finché c''è, i suoi allergeni si leggono da recipes.allergeni_archivio e non dai prodotti.';
revoke all on ricette_da_collegare from public, anon, authenticated;
grant select on ricette_da_collegare to authenticated;

-- ---------------------------------------------------------------------
-- LA VERIFICA, dentro una sotto-transazione che si annulla.
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_r        jsonb;
  v_bozza    uuid;
  v_ricetta  uuid;
  v_respinto boolean;
  v_msg      text;
  v_b        bozze_ricetta%rowtype;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Serve un titolare per verificare.';
  end if;
  if has_table_privilege('anon', 'ricette_da_collegare', 'select') then
    raise exception 'La vista delle ricette da collegare e'' leggibile con la chiave pubblica.';
  end if;
  if has_function_privilege('anon', 'crea_bozza_da_lettura(jsonb, jsonb, jsonb, uuid)', 'execute') then
    raise exception 'La creazione di una bozza da lettura e'' eseguibile con la chiave pubblica.';
  end if;

  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- (1) Una lettura con tutte le proposte: nascono sulla bozza, e gli
    --     allergeni sono «proposti».
    v_r := crea_bozza_da_lettura(
      jsonb_build_object('titolo', 'ZZ verifica archivio - crema', 'categoria', 'dolce',
        'tipo', 'preparazione', 'stagioni', jsonb_build_array('inverno', 'autunno'),
        'tags', jsonb_build_array(' Siciliana ', 'siciliana', '', 'al cucchiaio'),
        'allergeni', jsonb_build_array('uova', 'latte')),
      jsonb_build_array(jsonb_build_object('nome', 'ZZ latte')),
      '[]'::jsonb, gen_random_uuid());
    v_bozza := (v_r ->> 'bozza_id')::uuid;
    select * into v_b from bozze_ricetta where id = v_bozza;
    if v_b.tipo <> 'preparazione' or v_b.stagioni::text[] is distinct from array['autunno', 'inverno']
       or v_b.tags is distinct from array['al cucchiaio', 'siciliana']
       or v_b.allergeni::text[] is distinct from array['uova', 'latte']
       or v_b.allergeni_origine is distinct from 'proposti' then
      raise exception 'La bozza non ha preso le proposte come dovuto: tipo %, stagioni %, tag %, allergeni % (%).',
        v_b.tipo, v_b.stagioni, v_b.tags, v_b.allergeni, v_b.allergeni_origine;
    end if;

    -- (2) Senza la chiave «allergeni»: nessuno li ha detti (null), non «nessuno».
    --     Con un elenco vuoto: «nessun allergene», e proposto.
    v_r := crea_bozza_da_lettura(jsonb_build_object('titolo', 'ZZ verifica archivio - senza'),
      '[]'::jsonb, '[]'::jsonb, gen_random_uuid());
    if (select allergeni is not null or allergeni_origine is not null or tipo <> 'piatto_finito'
          from bozze_ricetta where id = (v_r ->> 'bozza_id')::uuid) then
      raise exception 'Una lettura senza allergeni li ha inventati.';
    end if;
    v_r := crea_bozza_da_lettura(jsonb_build_object('titolo', 'ZZ verifica archivio - nessuno',
      'allergeni', '[]'::jsonb), '[]'::jsonb, '[]'::jsonb, gen_random_uuid());
    if (select allergeni is distinct from '{}'::allergen[] or allergeni_origine is distinct from 'proposti'
          from bozze_ricetta where id = (v_r ->> 'bozza_id')::uuid) then
      raise exception 'Un elenco vuoto di allergeni non e'' diventato «nessuno, proposto».';
    end if;

    -- (3) I valori fuori elenco si rifiutano, uno per uno.
    v_respinto := false;
    begin
      perform crea_bozza_da_lettura(jsonb_build_object('titolo', 'ZZ x', 'stagioni', jsonb_build_array('monsone')),
        '[]'::jsonb, '[]'::jsonb, gen_random_uuid());
    exception when others then v_respinto := true; v_msg := sqlerrm;
    end;
    if not v_respinto or v_msg not like '%stagioni%' then
      raise exception 'Una stagione inesistente e'' passata: %', coalesce(v_msg, 'nessun errore');
    end if;
    v_respinto := false;
    begin
      perform crea_bozza_da_lettura(jsonb_build_object('titolo', 'ZZ x', 'allergeni', jsonb_build_array('fragole')),
        '[]'::jsonb, '[]'::jsonb, gen_random_uuid());
    exception when others then v_respinto := true; v_msg := sqlerrm;
    end;
    if not v_respinto or v_msg not like '%allergeni%' then
      raise exception 'Un allergene inesistente e'' passato: %', coalesce(v_msg, 'nessun errore');
    end if;
    v_respinto := false;
    begin
      perform crea_bozza_da_lettura(jsonb_build_object('titolo', 'ZZ x', 'tipo', 'selezione'),
        '[]'::jsonb, '[]'::jsonb, gen_random_uuid());
    exception when others then v_respinto := true; v_msg := sqlerrm;
    end;
    if not v_respinto or v_msg not like '%tipo%' then
      raise exception 'Un tipo inesistente e'' passato: %', coalesce(v_msg, 'nessun errore');
    end if;

    -- (4) Un elenco di allergeni senza origine, o un'origine senza elenco: no.
    v_respinto := false;
    begin
      update bozze_ricetta set allergeni_origine = null where id = v_bozza;
    exception when check_violation then v_respinto := true;
    end;
    if not v_respinto then
      raise exception 'Una bozza ha accettato allergeni senza origine.';
    end if;

    -- (5) La promozione porta tutto alla ricetta, origine compresa: un
    --     allergene proposto resta proposto.
    update bozze_ricetta set resa_quantita = 1, resa_unita = 'kg' where id = v_bozza;
    v_r := promuovi_bozza_ricetta(v_bozza, 'ricetta', gen_random_uuid());
    v_ricetta := (v_r ->> 'ricetta_id')::uuid;
    if not exists (select 1 from recipes where id = v_ricetta
                     and tags = array['al cucchiaio', 'siciliana']
                     and seasonality::text[] = array['autunno', 'inverno']
                     and allergeni_archivio::text[] = array['uova', 'latte']
                     and allergeni_archivio_origine = 'proposti') then
      raise exception 'La ricetta non ha preso tag, stagioni e allergeni della bozza: %', v_r;
    end if;
    -- …e l'ingrediente non collegato è fra quelli da collegare, cioè il caso
    -- in cui questo elenco vale.
    if not exists (select 1 from ricetta_ingredienti_da_collegare where recipe_id = v_ricetta) then
      raise exception 'La ricetta d''archivio non ha l''ingrediente da collegare.';
    end if;
    if (select righe from ricette_da_collegare where recipe_id = v_ricetta) is distinct from 1 then
      raise exception 'La vista delle ricette da collegare non conta la riga della ricetta d''archivio.';
    end if;

    -- (6) Lo stesso vincolo sulla ricetta.
    v_respinto := false;
    begin
      update recipes set allergeni_archivio = null where id = v_ricetta;
    exception when check_violation then v_respinto := true;
    end;
    if not v_respinto then
      raise exception 'Una ricetta ha accettato un''origine senza elenco di allergeni.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dell''archivio delle ricette');

  raise notice 'Fatto: tag, stagioni e allergeni d''archivio sulla bozza e sulla ricetta, con la loro origine. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261025000051', 'l_archivio_delle_ricette')
on conflict (version) do nothing;
