-- ============================================================================
-- L'ANOMALIA DICE IL NOME, IL MOTIVO LO DICE LA SCHERMATA — 25/08/2026
-- ============================================================================
--
-- 🔴 DIFETTO MIO, TROVATO GUARDANDO LA SCHERMATA e non rileggendo il
--    codice. La 20260825000007 scriveva nella descrizione il nome del
--    prodotto **e** la spiegazione; la schermata ci mette davanti il
--    motivo; e la riga usciva cosi':
--
--      «preparazione con partite in cella, ma segnata da non seguire:
--       ZZ ragu' di maiale: ha delle partite in cella, ma la sua scheda
--       dice di non seguirla in magazzino — la giacenza non scende»
--
--    cioe' la stessa cosa detta due volte, in un elenco che si legge di
--    corsa. ⚠️ E il patto era gia' scritto nelle altre righe: per
--    `giacenza_insufficiente` la descrizione e' **solo il nome**
--    («Mascarpone»), e il perche' lo dice la schermata. Il patto non era
--    sbagliato: l'avevo rotto io.
--
-- ⚠️ PERCHE' UNA MIGRAZIONE NUOVA E NON UNA RIGA CAMBIATA NELL'ALTRA: la
--    20260825000007 e' gia' applicata sul progetto di prova. Un file
--    applicato racconta cosa e' successo quel giorno, e riscriverlo lo
--    rende una bugia per chi ricostruira' da zero — anche quando la
--    correzione e' una frase sola e non e' ancora andata in produzione.
--
-- ⚠️ Le anomalie gia' scritte NON si riscrivono: sono un registro di cosa
--    e' successo, e quelle di prova se ne vanno con la pulizia del
--    collaudo. Cambia da qui in avanti.
-- ============================================================================

-- ⚠️ Corpo ripreso VIVO dal database. Cambia SOLO il testo della
--    descrizione nel blocco b-bis.
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
    --    ⚠️ E la descrizione e' SOLO IL NOME: il motivo lo scrive la
    --    schermata, come per le altre righe dell'elenco.
    insert into anomalie_scarico
      (order_id, ingredient_id, tipo, descrizione, quantita_mancante)
    select p_order_id, f.ingredient_id, 'preparazione_non_seguita', i.name,
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
-- E la stessa frase nella produzione
-- ----------------------------------------------------------------------------
-- ⚠️ Corpo ripreso VIVO. Cambia solo il testo della descrizione.
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
  --    ⚠️ Descrizione = SOLO IL NOME: il motivo lo scrive la schermata.
  insert into anomalie_scarico
    (produzione_id, ingredient_id, tipo, descrizione, quantita_mancante)
  select v_prod, f.ingredient_id, 'preparazione_non_seguita', i.name,
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
-- VERIFICA
-- ============================================================================
-- ⚠️ Non basta guardare che la funzione sia stata ricreata: Postgres
--    accetta un corpo che chiama una funzione inesistente e se ne accorge
--    solo eseguendolo (lezione del 17/08). Qui la si CHIAMA.
do $verifica$
declare
  v_ent        uuid;
  v_mp         uuid;
  v_lotto_mp   uuid;
  v_ric_prep   uuid;
  v_ing_prep   uuid;
  v_lotto_prep uuid;
  v_ric_piatto uuid;
  v_conto      uuid;
  v_riga       uuid;
  v_n          integer;
  v_testo      text;
  v_lapidi_pre  integer;
  v_lapidi_post integer;
begin
  select count(*) into v_lapidi_pre from deleted_records;
  select id into v_ent from entities order by created_at limit 1;

  insert into ingredients (entity_id, name, category, unit, tenuto_in_magazzino)
  values (v_ent, 'ZZ nome cipolla', 'verdura', 'kg', true) returning id into v_mp;

  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at)
  values (v_mp, 100, 100, 2.00, now() - interval '60 days') returning id into v_lotto_mp;

  insert into recipes (name, category, recipe_type, portions_yield, yield_quantity, yield_unit)
  values ('ZZ nome soffritto', 'primo', 'preparazione', 1, 1.0, 'kg') returning id into v_ric_prep;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit, waste_percentage)
  values (v_ric_prep, v_mp, 2, 'kg', 0);

  insert into ingredients (entity_id, name, category, unit, tenuto_in_magazzino, preparazione_id)
  values (v_ent, 'ZZ nome soffritto', 'verdura', 'kg', false, v_ric_prep)
  returning id into v_ing_prep;

  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at)
  values (v_ing_prep, 5, 5, 9.00, now() - interval '2 days') returning id into v_lotto_prep;

  insert into recipes (name, category, recipe_type, portions_yield)
  values ('ZZ nome piatto', 'primo', 'piatto_finito', 10) returning id into v_ric_piatto;

  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
  values (v_ric_piatto, v_ric_prep, 0.5, 'kg');

  insert into orders (entity_id, table_label, status)
  values (v_ent, 'ZZ nome A', 'aperto') returning id into v_conto;

  insert into order_items (order_id, recipe_id, destination, quantity, unit_price, sent_at)
  values (v_conto, v_ric_piatto, 'cucina', 6, 12.00, now() - interval '1 day')
  returning id into v_riga;

  update orders set status = 'chiuso', closed_at = now() - interval '1 day' where id = v_conto;

  perform scarica_magazzino_conto(v_conto);

  select descrizione into v_testo
    from anomalie_scarico
   where order_id = v_conto and tipo = 'preparazione_non_seguita';

  if v_testo is null then
    raise exception 'L''anomalia non e'' stata scritta: la cura del blocco b-bis e'' sparita';
  end if;

  -- La proprieta': la descrizione E' il nome del prodotto, niente di piu'.
  -- Un controllo su «contiene il nome» passerebbe anche col testo lungo.
  if v_testo <> 'ZZ nome soffritto' then
    raise exception 'La descrizione non e'' il solo nome: «%»', v_testo;
  end if;

  -- ------------------------------------------------------------------
  -- Pulizia — solo cio' che questa verifica ha creato, per identificativo
  -- ------------------------------------------------------------------
  alter table order_items disable trigger trg_log_delete;
  alter table order_items disable trigger trg_riga_servita;
  alter table order_items disable trigger trg_riga_su_conto_non_aperto;

  delete from stock_consumptions where order_id = v_conto;
  delete from anomalie_scarico    where order_id = v_conto;
  delete from order_items         where id = v_riga;
  delete from orders              where id = v_conto;
  delete from stock_lots          where id in (v_lotto_mp, v_lotto_prep);
  delete from recipe_ingredients  where recipe_id in (v_ric_prep, v_ric_piatto);
  delete from ingredients         where id = v_ing_prep;
  delete from recipes             where id in (v_ric_piatto, v_ric_prep);
  delete from ingredients         where id = v_mp;

  alter table order_items enable trigger trg_log_delete;
  alter table order_items enable trigger trg_riga_servita;
  alter table order_items enable trigger trg_riga_su_conto_non_aperto;

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

  raise notice 'L''anomalia scrive il nome del prodotto e basta: il motivo lo dice la schermata.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260825000008', 'l_anomalia_dice_il_nome_e_basta')
on conflict (version) do nothing;
