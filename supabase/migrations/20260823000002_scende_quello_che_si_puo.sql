-- =====================================================================
-- SCENDE QUELLO CHE SI PUO', E SI DICE COSA NON E' SCESO
-- 23/08/2026
-- =====================================================================
-- Decisione di Alessio, mandato del 23/08, sul referto della notte
-- (docs/referti/20260823_un_pizzico_di_cannella.md): "scende quello che si
-- puo', e viene detto cosa non e' sceso. Niente piu' rifiuto totale".
--
-- 🔴 IL DIFETTO, misurato a scala vera sul progetto di prova: **148 conti
-- chiusi su 346 — il 43% — non fanno scendere il magazzino di un grammo**,
-- senza nessun errore a schermo. La causa e' una sola e spiega tutti e 148:
-- un ingrediente che vale trentasette **milligrammi** (la cannella che
-- tocca a 18 g di frolla, divisa per le porzioni) non e' rappresentabile in
-- una colonna `numeric(12,4)`, il vincolo `quantity > 0` respinge la riga, e
-- il rifiuto si porta via **tutto** lo scarico del conto: il pesce, la
-- carne, il costo della cena.
--
-- ⚠️ E RENDEVA ILLEGGIBILE IL NUMERO PIU' IMPORTANTE DEL COLLAUDO: il food
-- cost calcolato su tutti i conti e' **9,3%**, quello sui soli conti che
-- hanno scaricato e' **16,6%**. Il primo e' assurdo — nessun ristorante
-- compra merce per il nove per cento di quello che incassa.
--
-- ---------------------------------------------------------------------
-- LE DUE CURE, e sono due cose diverse
-- ---------------------------------------------------------------------
-- 1. **IL PIZZICO NON FA PIU' FALLIRE NIENTE.** Non e' "arrotondare per non
--    far fallire": e' che il gestionale **non sa dire trentasette
--    milligrammi**, e il lotto non si muoveva comunque (togliere 0,000037 a
--    una colonna con quattro decimali la lascia dov'era). Quindi non si
--    perde nessuna scrittura che prima avveniva: si smette di **provare** a
--    farne una impossibile. Stessa riga in `registra_produzione`, che aveva
--    la forma identica e oggi non morde solo perche' si produce a dosi
--    intere.
--
-- 2. **OGNI INGREDIENTE STA NEL SUO BLOCCO.** Prima lo scarico di tutti gli
--    ingredienti di un conto viveva dentro un unico `begin ... exception`:
--    qualunque guasto su **uno** annullava **tutti**. Ora un ingrediente che
--    non riesce si ferma da solo, viene dichiarato col suo nome, e il resto
--    del conto scende.
--    ⚠️ **Questo cambia il patto**, ed e' la decisione di Alessio: prima era
--    "tutto o niente, e si riprovera'"; ora e' "quello che si puo' scende, e
--    ti dico cosa manca". La prima meta' del vecchio patto era gia' una
--    frase diventata falsa — misurato: `scarica_magazzino_conto` la chiamano
--    solo le chiusure del conto, e un conto chiuso non si richiude, quindi
--    **nessuno poteva riprovare**.
--
-- 🔴 E CHI GUARDA DEVE SAPERE CHE QUEL CONTO E' SCESO A META'. Un magazzino
-- che scende parzialmente **in silenzio** e' lo stesso difetto di prima,
-- solo piu' difficile da vedere. Per questo `scarichi_non_riusciti` porta da
-- oggi il **conto** e la **serata**, e dice quanti ingredienti di quel conto
-- sono scesi lo stesso: cosi' l'elenco distingue "di questo conto non e'
-- sceso niente" da "e' sceso il resto".
--
-- ⚠️ COSA QUESTA MIGRAZIONE NON FA: non rimedia ai conti gia' chiusi. Il
-- gestionale non ha nessuna strada per riscaricare un conto chiuso, ed e'
-- esattamente il motivo per cui il vecchio patto era falso.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Dove sta scritta la soglia del pizzico
-- ---------------------------------------------------------------------
-- Un posto solo. Il 23/08 quella soglia era in DUE punti della stessa
-- funzione e uno guardava solo il verso di cio' che **manca**
-- (`if v_da_togliere > 0.00005`), mai il verso di cio' che si **scrive** —
-- e il difetto viveva nello spazio fra i due.
create or replace function pizzico_trascurabile(p_quantita numeric)
returns boolean
language sql
immutable
as $funzione$
  -- Non e' un'opinione: e' la taglia della colonna
  -- `stock_consumptions.quantity`, che e' numeric(12,4). Sotto un decimo
  -- di grammo non c'e' nessun numero da scrivere.
  select round(coalesce(p_quantita, 0), 4) <= 0;
$funzione$;

comment on function pizzico_trascurabile(numeric) is
  'Vero quando una quantita'' e'' cosi'' piccola che la colonna del magazzino (quattro decimali) non sa tenerla: scriverla e'' impossibile, non e'' una scrittura persa.';

revoke all on function pizzico_trascurabile(numeric) from public, anon, authenticated;
grant execute on function pizzico_trascurabile(numeric) to authenticated;


-- ---------------------------------------------------------------------
-- 2. Lo scarico di un conto: ingrediente per ingrediente
-- ---------------------------------------------------------------------
-- ⚠️ Corpo preso da quello VIVO nel database (`npm run funzione:viva`), non
-- dal file che l'aveva creata: fra i due ci stanno tutte le migrazioni che
-- l'hanno toccata dopo.
create or replace function scarica_magazzino_conto(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_order        orders%rowtype;
  v_riga         record;
  v_lotto        record;
  v_da_togliere  numeric;
  v_tolto        numeric;
  v_costo        numeric;
  v_quota        numeric;
  v_errore       text;
  v_falliti      integer := 0;
begin
  select * into v_order from orders where id = p_order_id for update;
  if v_order.id is null then return; end if;

  -- Gia' fatto: chiudere due volte non scarica due volte.
  if v_order.magazzino_scaricato_il is not null then return; end if;

  -- Decisione di Alessio: da lui un conto si annulla solo se la cucina
  -- non ha ancora prodotto nulla.
  if v_order.status = 'annullato' then return; end if;

  begin
    -- a. Le voci libere: non hanno ricetta, quindi non si sa cosa
    --    togliere. Non si inventa: si dichiara.
    insert into anomalie_scarico (order_id, order_item_id, tipo, descrizione)
    select p_order_id, oi.id, 'voce_libera',
           coalesce(nullif(trim(oi.free_text_name), ''), 'voce senza nome')
             || ' x' || oi.quantity
      from order_items oi
     where oi.order_id = p_order_id
       and oi.voided_at is null
       and oi.recipe_id is null;

    -- b. Le ricette che non dicono cosa togliere: vuote, con soli
    --    ingredienti facoltativi, o senza il numero di porzioni che
    --    producono.
    insert into anomalie_scarico (order_id, order_item_id, tipo, descrizione)
    select p_order_id, oi.id, 'ricetta_incompleta',
           coalesce(r.name, 'ricetta senza nome')
             || ': nessun ingrediente da scaricare (ricetta vuota, soli ingredienti facoltativi, o porzioni non indicate)'
      from order_items oi
      left join recipes r on r.id = oi.recipe_id
     where oi.order_id = p_order_id
       and oi.voided_at is null
       and oi.recipe_id is not null
       and not exists (
         select 1 from fabbisogno_conto(p_order_id) f where f.order_item_id = oi.id
       );
  exception when others then
    -- 🔴 Il racconto di cio' che non si e' potuto scaricare non deve
    -- portarsi via lo scarico vero: si prende nota e si va avanti.
    v_errore  := sqlerrm;
    v_falliti := v_falliti + 1;
  end;

  begin
    -- c. Lo scarico, un ingrediente per volta, dai lotti che scadono
    --    prima (FEFO). 🔴 OGNUNO NEL SUO BLOCCO: un guasto su uno non
    --    porta via gli altri (decisione di Alessio, 23/08).
    for v_riga in
      select f.ingredient_id, sum(f.quantita) as quantita
        from fabbisogno_conto(p_order_id) f
       group by f.ingredient_id
    loop
      begin
        v_da_togliere := v_riga.quantita;
        v_tolto       := 0;
        v_costo       := 0;

        for v_lotto in
          select id, quantity_remaining, unit_cost
            from stock_lots
           where ingredient_id = v_riga.ingredient_id
             and quantity_remaining > 0
           order by expiry_date asc nulls last, received_at asc
           for update
        loop
          exit when v_da_togliere <= 0;
          v_quota := least(v_lotto.quantity_remaining, v_da_togliere);
          update stock_lots
             set quantity_remaining = quantity_remaining - v_quota
           where id = v_lotto.id;
          v_tolto       := v_tolto + v_quota;
          v_costo       := v_costo + v_quota * coalesce(v_lotto.unit_cost, 0);
          v_da_togliere := v_da_togliere - v_quota;
        end loop;

        -- 🔴 IL PIZZICO. Sotto il decimo di grammo la colonna non sa
        -- tenere il numero: lo scrive 0,0000 e il vincolo `quantity > 0`
        -- respinge la riga. Non e' una scrittura che si perde — il lotto
        -- non si muoveva comunque — e' una scrittura impossibile che si
        -- smette di tentare.
        if not pizzico_trascurabile(v_tolto) then
          insert into stock_consumptions
            (ingredient_id, quantity, reason, note, order_id, quantita_richiesta, costo)
          values
            (v_riga.ingredient_id, round(v_tolto, 4), 'consumo',
             'Conto ' || coalesce(v_order.table_label, '?'),
             p_order_id, v_riga.quantita, round(v_costo, 4));
        end if;

        -- Il magazzino era gia' in debito: si toglie quello che c'e' e si
        -- dice quanto manca. Azzerare e tacere darebbe una giacenza giusta
        -- per caso e un ammanco invisibile.
        if not pizzico_trascurabile(v_da_togliere) then
          insert into anomalie_scarico
            (order_id, ingredient_id, tipo, descrizione, quantita_mancante)
          values
            (p_order_id, v_riga.ingredient_id, 'giacenza_insufficiente',
             (select name from ingredients where id = v_riga.ingredient_id),
             round(v_da_togliere, 4));
        end if;

      exception when others then
        -- Questo ingrediente no; gli altri del conto si'.
        v_falliti := v_falliti + 1;
        v_errore  := sqlerrm;
        begin
          insert into anomalie_scarico (order_id, ingredient_id, tipo, descrizione)
          values (p_order_id, v_riga.ingredient_id, 'errore',
                  coalesce((select name from ingredients where id = v_riga.ingredient_id),
                           'ingrediente sconosciuto')
                    || ': ' || sqlerrm);
        exception when others then
          null;  -- nemmeno il racconto del guasto puo' far fallire una chiusura
        end;
      end;
    end loop;

    update orders set magazzino_scaricato_il = now() where id = p_order_id;

  exception when others then
    -- Qui si arriva solo se e' saltato cio' che sta FUORI dai singoli
    -- ingredienti (il calcolo del fabbisogno, o il segno sul conto): in
    -- quel caso non c'era nessuno scarico da salvare.
    v_errore  := sqlerrm;
    v_falliti := v_falliti + 1;
    begin
      insert into anomalie_scarico (order_id, tipo, descrizione)
      values (p_order_id, 'errore', v_errore);
    exception when others then
      null;
    end;
  end;

  if v_falliti > 0 then
    begin
      perform segnala_allarme(
        'scarico_magazzino',
        'Il magazzino e'' sceso solo in parte alla chiusura di un conto ('
          || v_falliti || ' non scesi): ' || coalesce(v_errore, '?'),
        jsonb_build_object('conto', p_order_id, 'non_scesi', v_falliti),
        'guasto');
    exception when others then
      null;
    end;
  end if;
end;
$funzione$;

comment on function scarica_magazzino_conto(uuid) is
  'Scarica dal magazzino gli ingredienti dei piatti venduti in un conto, dai lotti che scadono prima (FEFO). Dal 23/08/2026 ogni ingrediente sta nel suo blocco: quello che non riesce viene dichiarato in anomalie_scarico col suo nome e gli altri scendono lo stesso.';


-- ---------------------------------------------------------------------
-- 3. La stessa riga nelle produzioni
-- ---------------------------------------------------------------------
-- Qui il pizzico oggi non morde (si produce a dosi intere), ma la forma e'
-- identica e il giorno che mordesse farebbe fallire **tutta** la
-- produzione, dopo aver gia' scaricato gli ingredienti precedenti. Si cura
-- la riga, non il caso.
--
-- ⚠️ Corpo preso da quello VIVO nel database.
create or replace function registra_produzione(
  p_recipe_id         uuid,
  p_dosi              numeric,
  p_quantita_ottenuta numeric,
  p_scadenza          date default null,
  p_note              text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_ric        recipes%rowtype;
  v_ingr       uuid;
  v_prod       uuid;
  v_lotto      uuid;
  v_riga       record;
  v_lot        record;
  v_da         numeric;
  v_tolto      numeric;
  v_quota      numeric;
  v_costo      numeric := 0;
  v_costo_riga numeric;
  v_mancanti   integer := 0;
begin
  if p_dosi is null or p_dosi <= 0 then
    raise exception 'Quante dosi sono state fatte? Senza questo numero non si sa quanto e'' costata la produzione.';
  end if;
  if p_quantita_ottenuta is null or p_quantita_ottenuta <= 0 then
    raise exception 'Quanto ne e'' uscito? Senza questo numero il costo al chilo non si puo'' calcolare.';
  end if;

  select * into v_ric from recipes where id = p_recipe_id;
  if v_ric.id is null then
    raise exception 'Questa preparazione non esiste.';
  end if;
  if v_ric.recipe_type <> 'preparazione' then
    raise exception 'Si producono le preparazioni, non i piatti finiti.';
  end if;

  v_ingr := ingrediente_di_preparazione(p_recipe_id);

  insert into produzioni (
    recipe_id, ingredient_id, dosi, quantita_ottenuta, unita,
    resa_attesa, scadenza, note, creato_da
  ) values (
    p_recipe_id, v_ingr, p_dosi, p_quantita_ottenuta,
    coalesce(v_ric.yield_unit::text, 'kg'),
    case when v_ric.yield_quantity is not null then v_ric.yield_quantity * p_dosi end,
    p_scadenza, p_note, auth.uid()
  )
  returning id into v_prod;

  -- Lo scarico, dai lotti che scadono prima (FEFO).
  for v_riga in
    select f.ingredient_id, f.quantita from fabbisogno_preparazione(p_recipe_id, p_dosi) f
  loop
    v_da := v_riga.quantita;
    v_tolto := 0;
    v_costo_riga := 0;

    for v_lot in
      select id, quantity_remaining, unit_cost
        from stock_lots
       where ingredient_id = v_riga.ingredient_id and quantity_remaining > 0
       order by expiry_date asc nulls last, received_at asc
       for update
    loop
      exit when v_da <= 0;
      v_quota := least(v_lot.quantity_remaining, v_da);
      update stock_lots set quantity_remaining = quantity_remaining - v_quota where id = v_lot.id;
      v_tolto      := v_tolto + v_quota;
      v_costo_riga := v_costo_riga + v_quota * coalesce(v_lot.unit_cost, 0);
      v_da         := v_da - v_quota;
    end loop;

    v_costo := v_costo + v_costo_riga;

    -- 🔴 Come nello scarico di un conto: sotto il decimo di grammo non
    -- c'e' nessun numero da scrivere.
    if not pizzico_trascurabile(v_tolto) then
      insert into stock_consumptions
        (ingredient_id, quantity, reason, note, produzione_id, quantita_richiesta, costo)
      values
        (v_riga.ingredient_id, round(v_tolto, 4), 'consumo',
         'Produzione: ' || v_ric.name, v_prod, v_riga.quantita,
         round(v_costo_riga, 4));
    end if;

    -- Non si inventa e non si blocca: il semilavorato e' gia' fatto.
    if not pizzico_trascurabile(v_da) then
      v_mancanti := v_mancanti + 1;
      insert into anomalie_scarico
        (produzione_id, ingredient_id, tipo, descrizione, quantita_mancante)
      values
        (v_prod, v_riga.ingredient_id, 'giacenza_insufficiente',
         (select name from ingredients where id = v_riga.ingredient_id),
         round(v_da, 4));
    end if;
  end loop;

  -- Il lotto del semilavorato, col costo di oggi.
  insert into stock_lots (
    ingredient_id, quantity_received, quantity_remaining, unit_cost, expiry_date, note
  ) values (
    v_ingr, p_quantita_ottenuta, p_quantita_ottenuta,
    round(v_costo / p_quantita_ottenuta, 4), p_scadenza,
    'Produzione del ' || to_char((now() at time zone 'Europe/Rome')::date, 'DD/MM/YYYY')
  )
  returning id into v_lotto;

  update produzioni set lotto_id = v_lotto, costo = round(v_costo, 4) where id = v_prod;

  -- Niente costi nella risposta: la chiama anche la cucina.
  return jsonb_build_object(
    'produzione_id', v_prod,
    'lotto_id', v_lotto,
    'ingredienti_mancanti', v_mancanti
  );
end;
$funzione$;

revoke all on function registra_produzione(uuid, numeric, numeric, date, text) from public, anon, authenticated;
grant execute on function registra_produzione(uuid, numeric, numeric, date, text) to authenticated;


-- ---------------------------------------------------------------------
-- 4. L'elenco dice il conto, la serata, e se il resto e' sceso
-- ---------------------------------------------------------------------
-- ⚠️ Cambia il tipo di ritorno, quindi va tolta e rifatta. Dopo un `drop`
-- i permessi tornano aperti al mondo: si richiudono a mano (trappola
-- dell'11/08, `revoke` a tutti e tre i ruoli).
drop function if exists scarichi_non_riusciti(date, date);

create or replace function scarichi_non_riusciti(p_dal date default null, p_al date default null)
returns table (
  id                uuid,
  quando            timestamptz,
  tavolo            text,
  tipo              text,
  descrizione       text,
  quantita_mancante numeric,
  unita             text,
  conto_id          uuid,
  serata            date,
  altri_scesi       integer
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  -- `security definer` gira senza RLS: il controllo va rimesso dentro.
  -- E chi non deve vedere riceve un rifiuto, non un elenco vuoto: una
  -- schermata vuota direbbe "e'' andato tutto bene", che qui e'' falso.
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' vedere cosa non e'' stato scaricato dal magazzino';
  end if;

  return query
  select a.id,
         a.creato_il,
         o.table_label,
         a.tipo,
         a.descrizione,
         a.quantita_mancante,
         i.unit::text,
         a.order_id,
         -- 🔴 La serata, non il giorno di calendario: un conto chiuso
         -- all'una di notte appartiene alla sera prima.
         case when o.closed_at is not null then serata_di_servizio(o.closed_at) end,
         -- Quanti ingredienti di QUESTO conto sono scesi lo stesso. E'
         -- cio' che distingue "di questo conto non e' sceso niente" da
         -- "e' sceso il resto": senza, un magazzino che scende a meta'
         -- sarebbe silenzioso quanto uno che non scende affatto.
         (select count(*)::integer from stock_consumptions sc
           where sc.order_id = a.order_id)
    from anomalie_scarico a
    left join orders o      on o.id = a.order_id
    left join ingredients i on i.id = a.ingredient_id
   where (p_dal is null or (a.creato_il at time zone 'Europe/Rome')::date >= p_dal)
     and (p_al  is null or (a.creato_il at time zone 'Europe/Rome')::date <= p_al)
   order by a.creato_il desc;
end;
$funzione$;

comment on function scarichi_non_riusciti(date, date) is
  'Le righe che il magazzino non ha potuto scaricare nel periodo, col motivo, il conto e la serata. Dal 23/08/2026 dice anche quanti ingredienti di quel conto sono scesi lo stesso: da quando lo scarico e'' parziale invece che tutto-o-niente, "non e'' sceso questo" e "non e'' sceso niente" sono due fatti diversi.';

revoke all on function scarichi_non_riusciti(date, date) from public, anon, authenticated;
grant execute on function scarichi_non_riusciti(date, date) to authenticated;


-- ---------------------------------------------------------------------
-- 5. Verifica — con dati propri, cancellati alla fine
-- ---------------------------------------------------------------------
-- ⚠️ Il perimetro e' fatto di roba che la verifica ha creato: mai un
-- ingrediente vero (trappola del 16/08 — FEFO non prende dal lotto di
-- prova e la giacenza vera resta corta).
--
-- ⚠️ E il pizzico nasce da una DIVISIONE, non da un numero scritto piccolo
-- apposta: una ricetta che rende 100 porzioni. Prima di misurare si
-- controlla che il caso si sia formato davvero — senza quel controllo il
-- blocco passerebbe verde senza provare niente (regola del caso vuoto).
do $verifica$
declare
  v_ente     uuid;
  v_normale  uuid;
  v_pizzico  uuid;
  v_terzo    uuid;
  v_ric      uuid;
  v_conto    uuid;
  v_fab_p    numeric;
  v_fab_n    numeric;
  v_righe    integer;
  v_q        numeric;
  v_rimasto  numeric;
  v_lapidi   integer;
  v_lapidi_2 integer;
  v_scaricato timestamptz;
  v_respinto boolean := false;
  v_tit      uuid;
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_ente from entities order by created_at limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;

  -- Due ingredienti propri: uno normale, uno da pizzico.
  insert into ingredients (name, unit, category, entity_id, alimentare)
  values ('ZZ verifica pesce', 'kg', 'pesce', v_ente, true) returning id into v_normale;
  insert into ingredients (name, unit, category, entity_id, alimentare)
  values ('ZZ verifica spezia', 'kg', 'spezie_aromi', v_ente, true) returning id into v_pizzico;
  insert into ingredients (name, unit, category, entity_id, alimentare)
  values ('ZZ verifica olio', 'kg', 'olio_condimenti', v_ente, true) returning id into v_terzo;

  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost)
  values (v_normale, 10, 10, 20), (v_pizzico, 1, 1, 50), (v_terzo, 5, 5, 8);

  -- Una ricetta che rende 100 porzioni: il millesimo nasce dalla divisione.
  insert into recipes (name, category, recipe_type, portions_yield)
  values ('ZZ verifica piatto', 'secondo', 'piatto_finito', 100) returning id into v_ric;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_ric, v_normale, 5, 'kg'),      -- 0,05 kg a porzione: si scrive
         (v_ric, v_pizzico, 0.002, 'kg'),  -- 0,00002 kg a porzione: non si scrive
         (v_ric, v_terzo, 1, 'kg');        -- 0,01 kg a porzione: si scrive

  insert into orders (table_label, status, opened_at)
  values ('ZZ verifica', 'aperto', now()) returning id into v_conto;
  -- ⚠️ `sent_at`: il fabbisogno conta solo cio' che e' stato mandato in
  -- cucina — mai inviata vuol dire mai cucinata.
  insert into order_items (order_id, recipe_id, destination, quantity, unit_price, sent_at)
  values (v_conto, v_ric, 'cucina', 1, 12, now());

  -- 1. IL CASO SI E' FORMATO? Senza questo controllo la verifica passerebbe
  --    verde senza avere niente da provare.
  select quantita into v_fab_p from fabbisogno_conto(v_conto) where ingredient_id = v_pizzico;
  select quantita into v_fab_n from fabbisogno_conto(v_conto) where ingredient_id = v_normale;
  if v_fab_p is null or round(v_fab_p, 4) <> 0 then
    raise exception 'Il caso non si e'' formato: il pizzico vale % e non arrotonda a zero.', v_fab_p;
  end if;
  if v_fab_n is null or round(v_fab_n, 4) <= 0 then
    raise exception 'Il caso non si e'' formato: l''ingrediente normale vale %.', v_fab_n;
  end if;

  -- 2. LA CONTROPROVA: quella quantita' il database la rifiuta davvero.
  --    E' cio' che dimostra che l'arrotondamento e' un fatto, non un sospetto.
  begin
    insert into stock_consumptions (ingredient_id, quantity, reason)
    values (v_pizzico, v_fab_p, 'consumo');
    raise exception 'Il database ha accettato % kg: la premessa di questa migrazione non vale piu''.', v_fab_p;
  exception
    when sqlstate '23514' then v_respinto := true;
  end;
  if not v_respinto then
    raise exception 'La controprova non ha discriminato.';
  end if;

  -- 3. LO SCARICO: il normale scende, il pizzico non lascia niente, e il
  --    conto risulta scaricato.
  perform scarica_magazzino_conto(v_conto);

  select count(*) into v_righe from anomalie_scarico where order_id = v_conto and tipo = 'errore';
  if v_righe <> 0 then
    raise exception 'Il pizzico fa ancora fallire lo scarico: % anomalie di errore.', v_righe;
  end if;

  select quantity into v_q from stock_consumptions where order_id = v_conto and ingredient_id = v_normale;
  if v_q is null or v_q <> 0.0500 then
    raise exception 'Il pesce non e'' sceso come doveva: %.', v_q;
  end if;
  select count(*) into v_righe from stock_consumptions where order_id = v_conto and ingredient_id = v_pizzico;
  if v_righe <> 0 then
    raise exception 'Il pizzico ha scritto % righe, e non poteva.', v_righe;
  end if;
  select quantity_remaining into v_rimasto from stock_lots where ingredient_id = v_pizzico;
  if v_rimasto <> 1 then
    raise exception 'Il lotto del pizzico si e'' mosso: %.', v_rimasto;
  end if;
  select magazzino_scaricato_il into v_scaricato from orders where id = v_conto;
  if v_scaricato is null then
    raise exception 'Il conto non risulta scaricato.';
  end if;

  -- 4. L'INDIPENDENZA: se UN ingrediente non riesce, gli altri scendono.
  --    Il guasto si costruisce con un guardiano temporaneo che rifiuta le
  --    scritture su un ingrediente solo.
  update orders set magazzino_scaricato_il = null where id = v_conto;
  delete from stock_consumptions where order_id = v_conto;
  delete from anomalie_scarico where order_id = v_conto;
  update stock_lots set quantity_remaining = quantity_received
   where ingredient_id in (v_normale, v_pizzico, v_terzo);

  execute format($f$
    create or replace function zz_verifica_guasto() returns trigger
    language plpgsql as $t$
    begin
      if new.ingredient_id = %L then
        raise exception 'guasto costruito apposta';
      end if;
      return new;
    end $t$;
  $f$, v_terzo);
  create trigger zz_verifica_guasto before insert on stock_consumptions
    for each row execute function zz_verifica_guasto();

  perform scarica_magazzino_conto(v_conto);

  select quantity into v_q from stock_consumptions where order_id = v_conto and ingredient_id = v_normale;
  if v_q is null or v_q <> 0.0500 then
    raise exception 'Un guasto su un ingrediente si e'' portato via lo scarico degli altri: il pesce vale %.', v_q;
  end if;
  select count(*) into v_righe from anomalie_scarico
   where order_id = v_conto and tipo = 'errore' and ingredient_id = v_terzo;
  if v_righe <> 1 then
    raise exception 'L''ingrediente che non e'' sceso non e'' stato dichiarato col suo nome (% righe).', v_righe;
  end if;
  select magazzino_scaricato_il into v_scaricato from orders where id = v_conto;
  if v_scaricato is null then
    raise exception 'Con un ingrediente guasto il conto non risulta scaricato, e il resto e'' sceso.';
  end if;

  -- 5. L'ELENCO LO DICE: conto, serata, e quanti sono scesi lo stesso.
  -- ⚠️ Ha un portiere, e una migrazione non ha un utente: si impersona il
  -- titolare come fanno gli altri blocchi di verifica (trappola del 16/08).
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select altri_scesi into v_righe from scarichi_non_riusciti(null, null)
   where conto_id = v_conto and tipo = 'errore' limit 1;
  if v_righe is null or v_righe < 1 then
    raise exception 'L''elenco non dice che il resto del conto e'' sceso (%).', v_righe;
  end if;

  perform set_config('request.jwt.claims', null, true);

  drop trigger zz_verifica_guasto on stock_consumptions;
  drop function zz_verifica_guasto();

  -- pulizia: la roba della verifica, e nient'altro.
  -- ⚠️ Due guardiani vanno spenti per poterla fare, ed e' un gesto
  -- dichiarato: una riga gia' andata in cucina non si cancella (si storna),
  -- e ogni riga cancellata lascerebbe una lapide nel registro delle
  -- cancellazioni — che nessuno puo' ripulire dall'app. Si riaccendono
  -- subito dopo, e la riaccensione si CONTROLLA: lasciarne uno spento
  -- significa che in sala si cancellerebbe cio' che va stornato.
  alter table order_items disable trigger trg_riga_servita;
  alter table order_items disable trigger trg_log_delete;

  delete from stock_consumptions where order_id = v_conto;
  delete from anomalie_scarico where order_id = v_conto;
  delete from order_items where order_id = v_conto;
  delete from orders where id = v_conto;
  delete from recipe_ingredients where recipe_id = v_ric;
  delete from recipes where id = v_ric;
  delete from stock_lots where ingredient_id in (v_normale, v_pizzico, v_terzo);
  delete from ingredients where id in (v_normale, v_pizzico, v_terzo);

  alter table order_items enable trigger trg_riga_servita;
  alter table order_items enable trigger trg_log_delete;
  if (select count(*) from pg_trigger
       where tgrelid = 'order_items'::regclass and tgenabled = 'D') > 0 then
    raise exception 'Un guardiano delle righe e'' rimasto spento.';
  end if;

  select count(*) into v_lapidi_2 from deleted_records;
  if v_lapidi_2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.', v_lapidi_2 - v_lapidi;
  end if;

  raise notice 'Verifica passata: il pizzico non fa fallire niente, un ingrediente guasto non porta via gli altri, e l''elenco dice quanto e'' sceso lo stesso.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260823000002', 'scende_quello_che_si_puo') on conflict (version) do nothing;
