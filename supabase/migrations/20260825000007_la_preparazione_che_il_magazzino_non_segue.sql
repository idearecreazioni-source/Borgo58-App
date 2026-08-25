-- ============================================================================
-- LA PREPARAZIONE CHE HA I LOTTI E IL MAGAZZINO NON SEGUE — 25/08/2026
-- ============================================================================
--
-- 🔴 IL DIFETTO E' UN SILENZIO, cioe' la famiglia peggiore. Il ciclo dello
--    scarico cammina sul fabbisogno e taglia via tutto cio' che ha
--    `tenuto_in_magazzino = false`:
--
--        join ingredients i on i.id = f.ingredient_id
--       where i.tenuto_in_magazzino
--
--    Niente scarico, niente anomalia, niente rumore.
--
-- ✅ E PER I PRODOTTI ORDINARI E' VOLUTO, e non si tocca. La decisione del
--    23/08 e' scritta accanto a quella riga: le bevande e le spezie erano
--    1.840 righe tutte uguali che seppellivano le venti che contano, e un
--    guardiano che grida sempre si impara a spegnere. Quel taglio resta,
--    ed e' dichiarato nella schermata.
--
-- 🔴 MA UNA PREPARAZIONE CHE HA DEI LOTTI E' UN CASO DIVERSO, e la
--    differenza non e' un'opinione: **avere lotti significa che il
--    magazzino la segue di fatto**. Qualcuno l'ha prodotta, il gestionale
--    le ha creato una partita in cella, e da `fabbisogno_conto` esce
--    proprio come semilavorato da consumare — la meta' rimessa a posto
--    stamattina dalla 20260825000005. Se poi la sua scheda dice «non
--    seguirla», quella riga sparisce senza una parola: **le partite
--    entrano e non escono mai**, la giacenza sale e non scende, e a
--    schermo non compare niente. E' la stessa forma del difetto per cui
--    il magazzino non scaricava le preparazioni, rimasto invisibile per
--    giorni proprio perche' non faceva rumore.
--
-- ⚠️ MISURATO PRIMA DI SCRIVERE, sul progetto di prova (25/08/2026):
--      · 14 ingredienti-preparazione, tutti con almeno un lotto;
--      · 14 su 14 con `tenuto_in_magazzino = true`;
--      · **zero** oggi nella condizione di rischio.
--    Lo zero e' MISURATO, non dedotto: il buco non morde adesso, ma
--    niente impedisce di togliere quella spunta domani — ed e'
--    esattamente il momento in cui non se ne accorgerebbe nessuno.
--
-- 🔴 ED E' UNA FAMIGLIA, come quasi sempre. Lo stesso filtro sta anche in
--    `fabbisogno_preparazione_seguito`, che alimenta `registra_produzione`:
--    un ragu' che consuma un soffritto in cella «non seguito» taceva
--    allo stesso modo. Curati tutt'e due qui, o la correzione varrebbe
--    per la sala e non per la cucina.
--
-- ⚠️ COSA QUESTA MIGRAZIONE NON FA: non scarica. Non e' una decisione da
--    prendere dentro una migrazione — la scheda del prodotto dice di non
--    seguirlo, e forzare lo scarico scavalcherebbe una scelta di Alessio.
--    Dice che e' successo, e su cosa.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Il vocabolario si allarga, e impara a parlare italiano
-- ----------------------------------------------------------------------------
-- ⚠️ Il vincolo era fra i «muti noti» congelati stamattina dalla
--    20260825000002. Ricreandolo gli si mette la frase e lo si toglie dal
--    congelamento: un vincolo che ha imparato a parlare non resta
--    nell'elenco di quelli a cui si perdona il silenzio.
alter table anomalie_scarico drop constraint if exists anomalie_scarico_tipo_check;

alter table anomalie_scarico
  add constraint anomalie_scarico_tipo_check
  check (tipo in ('voce_libera', 'ricetta_incompleta', 'giacenza_insufficiente',
                  'preparazione_non_seguita', 'errore'));

comment on constraint anomalie_scarico_tipo_check on anomalie_scarico is
  'Un''anomalia di scarico dice PERCHE'' la giacenza non e'' scesa, e i motivi sono cinque: voce libera senza ricetta, ricetta che non dice cosa togliere, giacenza insufficiente, preparazione con partite in cella che la scheda dice di non seguire, guasto. Un motivo fuori elenco e'' un motivo che nessuna schermata sa scrivere in italiano.';

delete from vincoli_muti_noti where conname = 'anomalie_scarico_tipo_check';

-- ----------------------------------------------------------------------------
-- 2. Lo scarico di un conto lo dichiara
-- ----------------------------------------------------------------------------
-- ⚠️ Corpo ripreso VIVO dal database (`pg_get_functiondef`), non dal file
--    che l'ha creata e non a memoria: fra i due ci stanno tutte le
--    migrazioni che l'hanno toccata, e questo progetto ci e' gia' caduto
--    cinque volte. Di tutto quello che segue cambia SOLO il blocco b-bis.
create or replace function scarica_magazzino_conto(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  if v_order.magazzino_scaricato_il is not null then return; end if;
  if v_order.status = 'annullato' then return; end if;

  begin
    -- a. Le voci libere: non hanno ricetta, quindi non si sa cosa
    --    togliere. Non si inventa: si dichiara.
    --    🔴 MENO LE BEVANDE (23/08): una riga destinata al bar non e' un
    --    buco del magazzino, e' come si ordina da bere. Misurate 1.840
    --    righe tutte uguali, che seppellivano le venti che contano — e un
    --    guardiano che grida sempre si impara a spegnere. Il taglio e'
    --    dichiarato nella schermata, non nascosto.
    insert into anomalie_scarico (order_id, order_item_id, tipo, descrizione)
    select p_order_id, oi.id, 'voce_libera',
           coalesce(nullif(trim(oi.free_text_name), ''), 'voce senza nome')
             || ' x' || oi.quantity
      from order_items oi
     where oi.order_id = p_order_id
       and oi.voided_at is null
       and oi.recipe_id is null
       and oi.destination <> 'bar';

    -- b. Le ricette che non dicono cosa togliere.
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

    -- b-bis. 🔴 LE PREPARAZIONI CHE IL MAGAZZINO NON SEGUE (25/08/2026).
    --    Il filtro del ciclo qui sotto tace su tutto cio' che ha
    --    `tenuto_in_magazzino = false`, e per i prodotti ordinari e'
    --    voluto. Ma una preparazione CON DELLE PARTITE IN CELLA il
    --    magazzino la segue di fatto: c'e' merce che entra e non esce
    --    piu'. Quel silenzio non e' una scelta, e' un buco.
    --    ⚠️ Si dichiara e basta: NON si scarica. Forzare lo scarico
    --    scavalcherebbe una scelta scritta sulla scheda del prodotto.
    insert into anomalie_scarico
      (order_id, ingredient_id, tipo, descrizione, quantita_mancante)
    select p_order_id, f.ingredient_id, 'preparazione_non_seguita',
           i.name || ': ha delle partite in cella, ma la sua scheda dice di non seguirla in magazzino — la giacenza non scende',
           case when pizzico_trascurabile(sum(f.quantita)) then null
                else round(sum(f.quantita), 4) end
      from fabbisogno_conto(p_order_id) f
      join ingredients i on i.id = f.ingredient_id
     where not i.tenuto_in_magazzino
       and i.preparazione_id is not null
       and exists (select 1 from stock_lots sl where sl.ingredient_id = i.id)
     group by f.ingredient_id, i.name;
  exception when others then
    v_errore  := sqlerrm;
    v_falliti := v_falliti + 1;
  end;

  begin
    -- c. Lo scarico, un ingrediente per volta, dai lotti che scadono
    --    prima (FEFO). Ognuno nel suo blocco: un guasto su uno non porta
    --    via gli altri (23/08).
    --    🔴 E i prodotti che il magazzino non segue non entrano nemmeno
    --    nel giro: niente scarico. Il silenzio pero' non e' piu' totale —
    --    le preparazioni con partite in cella sono dichiarate sopra.
    for v_riga in
      select f.ingredient_id, sum(f.quantita) as quantita
        from fabbisogno_conto(p_order_id) f
        join ingredients i on i.id = f.ingredient_id
       where i.tenuto_in_magazzino
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

        -- Sotto il decimo di grammo la colonna non sa tenere il numero:
        -- non e' una scrittura persa, e' una scrittura impossibile.
        if not pizzico_trascurabile(v_tolto) then
          insert into stock_consumptions
            (ingredient_id, quantity, reason, note, order_id, quantita_richiesta, costo)
          values
            (v_riga.ingredient_id, round(v_tolto, 4), 'consumo',
             'Conto ' || coalesce(v_order.table_label, '?'),
             p_order_id, v_riga.quantita, round(v_costo, 4));
        end if;

        if not pizzico_trascurabile(v_da_togliere) then
          insert into anomalie_scarico
            (order_id, ingredient_id, tipo, descrizione, quantita_mancante)
          values
            (p_order_id, v_riga.ingredient_id, 'giacenza_insufficiente',
             (select name from ingredients where id = v_riga.ingredient_id),
             round(v_da_togliere, 4));
        end if;

      exception when others then
        v_falliti := v_falliti + 1;
        v_errore  := sqlerrm;
        begin
          insert into anomalie_scarico (order_id, ingredient_id, tipo, descrizione)
          values (p_order_id, v_riga.ingredient_id, 'errore',
                  coalesce((select name from ingredients where id = v_riga.ingredient_id),
                           'ingrediente sconosciuto')
                    || ': ' || sqlerrm);
        exception when others then
          null;
        end;
      end;
    end loop;

    update orders set magazzino_scaricato_il = now() where id = p_order_id;

  exception when others then
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
$function$;

revoke all on function scarica_magazzino_conto(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. E la produzione lo dichiara allo stesso modo
-- ----------------------------------------------------------------------------
-- ⚠️ Corpo ripreso VIVO dal database. Cambia SOLO il blocco che precede il
--    ciclo dello scarico.
create or replace function registra_produzione(
  p_recipe_id uuid,
  p_dosi numeric,
  p_quantita_ottenuta numeric,
  p_scadenza date default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ric        recipes%rowtype;
  v_ingr       uuid;
  v_prod       uuid;
  v_lotto      uuid;
  v_riga       record;
  v_lot        record;
  v_da         numeric;
  v_tolto      numeric;
  v_costo      numeric := 0;   -- il totale della produzione
  v_costo_riga numeric;        -- quanto e' costato QUESTO ingrediente
  v_quota      numeric;
  v_mancanti   integer := 0;
begin
  -- Registrare una produzione e' compito della cucina: il controllo e'
  -- che ci sia un utente vero, non che sia il titolare. Il COSTO pero'
  -- non torna indietro da qui — vive sul lotto, che lo staff non legge.
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_ric from recipes where id = p_recipe_id;
  if v_ric.id is null then raise exception 'Preparazione non trovata'; end if;
  if p_dosi is null or p_dosi <= 0 then
    raise exception 'Quante dosi hai fatto? Il numero serve: senza, un calo e mezza dose sono la stessa cosa';
  end if;
  if p_quantita_ottenuta is null or p_quantita_ottenuta <= 0 then
    raise exception 'Quanto ne e'' uscito? Serve il peso vero, non quello della ricetta';
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

  -- 🔴 LE PREPARAZIONI CHE IL MAGAZZINO NON SEGUE (25/08/2026), stessa
  --    regola della sala: `fabbisogno_preparazione_seguito` taglia via
  --    tutto cio' che ha `tenuto_in_magazzino = false`, e per i prodotti
  --    ordinari e' voluto. Un semilavorato CON DELLE PARTITE IN CELLA no:
  --    li' il silenzio nasconde merce che entra e non esce.
  insert into anomalie_scarico
    (produzione_id, ingredient_id, tipo, descrizione, quantita_mancante)
  select v_prod, f.ingredient_id, 'preparazione_non_seguita',
         i.name || ': ha delle partite in cella, ma la sua scheda dice di non seguirla in magazzino — la giacenza non scende',
         case when pizzico_trascurabile(sum(f.quantita)) then null
              else round(sum(f.quantita), 4) end
    from fabbisogno_preparazione(p_recipe_id, p_dosi) f
    join ingredients i on i.id = f.ingredient_id
   where not i.tenuto_in_magazzino
     and i.preparazione_id is not null
     and exists (select 1 from stock_lots sl where sl.ingredient_id = i.id)
   group by f.ingredient_id, i.name;

  -- ⚠️ E il conteggio che torna alla schermata le comprende: sono righe
  --    non scaricate a tutti gli effetti, e lasciarle fuori direbbe
  --    «e' sceso tutto» proprio nel caso in cui non e' vero.
  get diagnostics v_mancanti = row_count;

  -- Lo scarico, dai lotti che scadono prima (FEFO).
  -- ⚠️ Dal fabbisogno che salta i prodotti fuori magazzino (23/08): senza,
  -- un ragu' scaricherebbe la cannella che la sala non scarica, e i due
  -- posti direbbero due cose diverse.
  for v_riga in
    select f.ingredient_id, f.quantita from fabbisogno_preparazione_seguito(p_recipe_id, p_dosi) f
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
    -- c'e' nessun numero da scrivere (23/08).
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
  -- ⚠️ I NOMI DEI CAMPI SONO UN PATTO CON LA SCHERMATA: `Produzioni.jsx`
  -- legge `righe_non_scaricate`, e rinominarlo non da' nessun errore —
  -- l'avviso direbbe zero per sempre.
  return jsonb_build_object(
    'produzione_id', v_prod,
    'lotto_id', v_lotto,
    'quantita', p_quantita_ottenuta,
    'righe_non_scaricate', v_mancanti
  );
end;
$function$;

revoke all on function registra_produzione(uuid, numeric, numeric, date, text)
  from public, anon, authenticated;
grant execute on function registra_produzione(uuid, numeric, numeric, date, text)
  to authenticated;

-- ============================================================================
-- VERIFICA — e la prova sa diventare rossa
-- ============================================================================
-- ⚠️ IL PERIMETRO E' FATTO DI ROBA CHE LA VERIFICA HA CREATO (regola del
--    16/08): un ingrediente proprio, una preparazione propria, un conto
--    proprio. Mai riusare merce vera per provare uno scarico.
--
-- ⚠️ E SI PROVA NEI DUE VERSI, perche' un controllo che passa e basta non
--    prova niente: prima con la preparazione FUORI dal magazzino
--    (l'anomalia deve comparire), poi DENTRO (non deve comparire, e la
--    giacenza deve scendere davvero).
do $verifica$
declare
  v_ent          uuid;
  v_mp           uuid;
  v_lotto_mp     uuid;
  v_ric_prep     uuid;
  v_ing_prep     uuid;
  v_lotto_prep   uuid;
  v_ric_piatto   uuid;
  v_conto_a      uuid;
  v_riga_a       uuid;
  v_conto_b      uuid;
  v_riga_b       uuid;
  v_ric_semplice uuid;
  v_conto_c      uuid;
  v_riga_c       uuid;
  v_n            integer;
  v_prima        numeric;
  v_dopo         numeric;
  v_quantita     numeric;
  v_lapidi_pre   integer;
  v_lapidi_post  integer;
begin
  select count(*) into v_lapidi_pre from deleted_records;
  select id into v_ent from entities order by created_at limit 1;
  if v_ent is null then
    raise exception 'Nessuna entita'': impossibile verificare.';
  end if;

  -- La materia prima, con la sua partita
  insert into ingredients (entity_id, name, category, unit, tenuto_in_magazzino)
  values (v_ent, 'ZZ verifica cipolla non seguita', 'verdura', 'kg', true)
  returning id into v_mp;

  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at)
  values (v_mp, 100, 100, 2.00, now() - interval '60 days')
  returning id into v_lotto_mp;

  -- La preparazione: 1 kg per dose, 2 kg di cipolla dentro
  insert into recipes (name, category, recipe_type, portions_yield, yield_quantity, yield_unit)
  values ('ZZ verifica soffritto', 'primo', 'preparazione', 1, 1.0, 'kg')
  returning id into v_ric_prep;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit, waste_percentage)
  values (v_ric_prep, v_mp, 2, 'kg', 0);

  -- 🔴 QUI STA IL CASO: la preparazione ha la sua partita in cella, ma la
  --    scheda dice di NON seguirla in magazzino.
  insert into ingredients (entity_id, name, category, unit, tenuto_in_magazzino, preparazione_id)
  values (v_ent, 'ZZ verifica soffritto', 'verdura', 'kg', false, v_ric_prep)
  returning id into v_ing_prep;

  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at)
  values (v_ing_prep, 5, 5, 9.00, now() - interval '2 days')
  returning id into v_lotto_prep;

  -- Il piatto: 10 porzioni, 0,5 kg di soffritto in tutto
  insert into recipes (name, category, recipe_type, portions_yield)
  values ('ZZ verifica piatto', 'primo', 'piatto_finito', 10)
  returning id into v_ric_piatto;

  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
  values (v_ric_piatto, v_ric_prep, 0.5, 'kg');

  -- ------------------------------------------------------------------
  -- CASO 1 — la preparazione ha i lotti e il magazzino NON la segue:
  --          l'anomalia deve comparire, e nominare il prodotto.
  -- ------------------------------------------------------------------
  insert into orders (entity_id, table_label, status)
  values (v_ent, 'ZZ verifica A', 'aperto')
  returning id into v_conto_a;

  insert into order_items (order_id, recipe_id, destination, quantity, unit_price, sent_at)
  values (v_conto_a, v_ric_piatto, 'cucina', 6, 12.00, now() - interval '1 day')
  returning id into v_riga_a;

  update orders set status = 'chiuso', closed_at = now() - interval '1 day'
   where id = v_conto_a;

  -- Il fabbisogno la vede: 6 porzioni su 10 -> 0,30 kg di soffritto.
  -- Se non la vedesse, la prova non starebbe provando il silenzio ma
  -- un'assenza, che e' un'altra cosa.
  select f.quantita into v_quantita
    from fabbisogno_conto(v_conto_a) f where f.ingredient_id = v_ing_prep;
  if v_quantita is null or round(v_quantita, 4) <> 0.3000 then
    raise exception 'Il semilavorato non e'' nel fabbisogno (%): la prova non proverebbe niente', v_quantita;
  end if;

  select quantity_remaining into v_prima from stock_lots where id = v_lotto_prep;
  perform scarica_magazzino_conto(v_conto_a);
  select quantity_remaining into v_dopo from stock_lots where id = v_lotto_prep;

  -- (a) la giacenza NON scende — e' la scelta scritta sulla scheda
  if v_prima <> v_dopo then
    raise exception 'Il lotto e'' sceso su un prodotto che il magazzino non segue: da % a %', v_prima, v_dopo;
  end if;

  -- (b) ma NON e' piu' un silenzio
  select count(*) into v_n
    from anomalie_scarico
   where order_id = v_conto_a
     and tipo = 'preparazione_non_seguita'
     and ingredient_id = v_ing_prep;
  if v_n <> 1 then
    raise exception 'Il silenzio non e'' stato dichiarato: % anomalie invece di 1', v_n;
  end if;

  -- (c) e dice quanto non e' sceso
  select quantita_mancante into v_dopo
    from anomalie_scarico
   where order_id = v_conto_a and tipo = 'preparazione_non_seguita';
  if v_dopo is null or round(v_dopo, 4) <> 0.3000 then
    raise exception 'L''anomalia non dice quanto non e'' sceso: % invece di 0,3000', v_dopo;
  end if;

  -- (d) e nomina il prodotto: una riga che non si sa a cosa si riferisce
  --     e' un allarme che nessuno sa cosa farne
  if not exists (
    select 1 from anomalie_scarico
     where order_id = v_conto_a and tipo = 'preparazione_non_seguita'
       and descrizione like 'ZZ verifica soffritto:%'
  ) then
    raise exception 'L''anomalia non nomina la preparazione';
  end if;

  -- ------------------------------------------------------------------
  -- CASO 2 — LA PROVA AL CONTRARIO. Stessa scena, ma la preparazione e'
  --          seguita dal magazzino: nessuna anomalia, e la giacenza
  --          scende davvero. Senza questo verso, un codice che scrivesse
  --          l'anomalia SEMPRE passerebbe il caso 1.
  -- ------------------------------------------------------------------
  update ingredients set tenuto_in_magazzino = true where id = v_ing_prep;

  insert into orders (entity_id, table_label, status)
  values (v_ent, 'ZZ verifica B', 'aperto')
  returning id into v_conto_b;

  insert into order_items (order_id, recipe_id, destination, quantity, unit_price, sent_at)
  values (v_conto_b, v_ric_piatto, 'cucina', 6, 12.00, now() - interval '1 day')
  returning id into v_riga_b;

  update orders set status = 'chiuso', closed_at = now() - interval '1 day'
   where id = v_conto_b;

  select quantity_remaining into v_prima from stock_lots where id = v_lotto_prep;
  perform scarica_magazzino_conto(v_conto_b);
  select quantity_remaining into v_dopo from stock_lots where id = v_lotto_prep;

  if round(v_prima - v_dopo, 4) <> 0.3000 then
    raise exception 'Con la spunta rimessa il lotto non scende di 0,3000: da % a %', v_prima, v_dopo;
  end if;

  select count(*) into v_n
    from anomalie_scarico
   where order_id = v_conto_b and tipo = 'preparazione_non_seguita';
  if v_n <> 0 then
    raise exception 'Anomalia dichiarata su una preparazione che il magazzino segue (%)', v_n;
  end if;

  -- ------------------------------------------------------------------
  -- CASO 3 — il silenzio VOLUTO resta silenzio. Un prodotto ordinario
  --          fuori magazzino (una spezia, una bevanda) non deve
  --          produrre nessuna riga: e' la decisione del 23/08, e una
  --          correzione che se la portasse via riempirebbe l'elenco di
  --          rumore fino a farlo spegnere.
  -- ------------------------------------------------------------------
  -- ⚠️ La cipolla e' materia prima, non una preparazione: fuori magazzino
  --    deve restare muta anche avendo delle partite in cella.
  update ingredients set tenuto_in_magazzino = false where id = v_mp;

  insert into recipes (name, category, recipe_type, portions_yield)
  values ('ZZ verifica piatto semplice', 'primo', 'piatto_finito', 10)
  returning id into v_ric_semplice;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit, waste_percentage)
  values (v_ric_semplice, v_mp, 1, 'kg', 0);

  insert into orders (entity_id, table_label, status)
  values (v_ent, 'ZZ verifica C', 'aperto')
  returning id into v_conto_c;

  insert into order_items (order_id, recipe_id, destination, quantity, unit_price, sent_at)
  values (v_conto_c, v_ric_semplice, 'cucina', 6, 12.00, now() - interval '1 day')
  returning id into v_riga_c;

  update orders set status = 'chiuso', closed_at = now() - interval '1 day'
   where id = v_conto_c;

  -- La cipolla e' nel fabbisogno: se non ci fosse, questo caso non
  -- proverebbe il silenzio ma un'assenza.
  if not exists (
    select 1 from fabbisogno_conto(v_conto_c) f where f.ingredient_id = v_mp
  ) then
    raise exception 'La materia prima non e'' nel fabbisogno: il caso 3 non proverebbe niente';
  end if;

  perform scarica_magazzino_conto(v_conto_c);

  select count(*) into v_n
    from anomalie_scarico
   where order_id = v_conto_c and tipo = 'preparazione_non_seguita';
  if v_n <> 0 then
    raise exception 'Il silenzio voluto sui prodotti ordinari e'' stato rotto (% righe)', v_n;
  end if;

  -- ------------------------------------------------------------------
  -- Pulizia — solo cio' che questa verifica ha creato, per
  -- identificativo (regola del 23/08). `order_items` e' tracciata: il
  -- registro delle cancellazioni e' esibibile e non si sporca con roba
  -- di prova.
  -- ------------------------------------------------------------------
  alter table order_items disable trigger trg_log_delete;
  alter table order_items disable trigger trg_riga_servita;
  alter table order_items disable trigger trg_riga_su_conto_non_aperto;

  delete from stock_consumptions where order_id in (v_conto_a, v_conto_b, v_conto_c);
  delete from anomalie_scarico    where order_id in (v_conto_a, v_conto_b, v_conto_c);
  delete from order_items         where id in (v_riga_a, v_riga_b, v_riga_c);
  delete from orders              where id in (v_conto_a, v_conto_b, v_conto_c);
  delete from stock_lots          where id in (v_lotto_mp, v_lotto_prep);
  delete from recipe_ingredients  where recipe_id in (v_ric_prep, v_ric_piatto, v_ric_semplice);
  delete from ingredients         where id = v_ing_prep;
  delete from recipes             where id in (v_ric_piatto, v_ric_prep, v_ric_semplice);
  delete from ingredients         where id = v_mp;

  alter table order_items enable trigger trg_log_delete;
  alter table order_items enable trigger trg_riga_servita;
  alter table order_items enable trigger trg_riga_su_conto_non_aperto;

  -- Riaccesi davvero? Lasciarne uno spento significa cancellazioni senza
  -- traccia, o righe aggiunte a un conto gia' incassato — in silenzio.
  select count(*) into v_n
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where c.relname = 'order_items' and not t.tgisinternal and t.tgenabled = 'D';
  if v_n <> 0 then
    raise exception 'Sono rimasti % trigger spenti su order_items', v_n;
  end if;

  select count(*) into v_lapidi_post from deleted_records;
  if v_lapidi_post <> v_lapidi_pre then
    raise exception 'La verifica ha lasciato % lapidi nel registro', v_lapidi_post - v_lapidi_pre;
  end if;

  raise notice 'La preparazione con le partite in cella e fuori magazzino ora si dichiara (0,3000 kg non scesi), quella dentro scende, e il silenzio voluto sui prodotti ordinari resta.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260825000007', 'la_preparazione_che_il_magazzino_non_segue')
on conflict (version) do nothing;
