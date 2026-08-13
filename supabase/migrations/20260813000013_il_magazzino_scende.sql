-- =====================================================================
-- Il magazzino scende da solo (Blocco 1 del mandato, rilievo 7 del referto)
-- =====================================================================
-- Fino a stasera chiudere un conto scriveva sul conto e sulla cassa e
-- **non toccava la giacenza in nessun modo**: nessun trigger su `orders`
-- o `order_items`, e le uniche due cose che muovevano il magazzino erano
-- il carico da fattura (che lo fa salire) e lo scarico a mano. Con le
-- ricette perfette e la cella piena, servire cento coperti lasciava la
-- giacenza esattamente com'era.
--
-- La conseguenza peggiore non e' la giacenza sbagliata: **la Fase A della
-- filiera della spesa** fa comparire un ingrediente in lista quando
-- scende sotto soglia. Se la giacenza non scende, quella lista sarebbe
-- costruita, funzionante e **muta per sempre**.
--
-- ---------------------------------------------------------------------
-- LE DECISIONI DI ALESSIO, del 13/08/2026
-- ---------------------------------------------------------------------
-- 1. **La giacenza scende quando un conto viene chiuso** — non quando il
--    piatto parte per la cucina. Un conto si chiude sempre, anche se e'
--    un omaggio; e uno storno prima della chiusura non deve rimettere
--    dentro niente, perche' niente era ancora uscito.
--
-- 2. **Un conto annullato non scarica mai.** Gliel'ho chiesto proponendo
--    la regola piu' prudente («scarica se i piatti erano gia' andati in
--    cucina») e ha risposto con un fatto del suo locale che la rende
--    inutile:
--
--      «Se il pasto viene prodotto e consumato il conto viene chiuso in
--       modo diverso, quindi l'annullamento avviene solo quando la cucina
--       non ha ancora prodotto nulla.»
--
--    Un conto mangiato e non pagato si chiude come omaggio o con una
--    causale, non si annulla. Quindi «annullato» vuol dire, nel suo
--    locale, «non e' stato cucinato niente» — e una regola piu'
--    complicata avrebbe scaricato merce mai uscita dalla cella.
--
-- ---------------------------------------------------------------------
-- LE REGOLE CHE VALGONO PIU' DEL CALCOLO
-- ---------------------------------------------------------------------
-- ⚠️ **Non si inventa mai uno scarico.** Una voce libera non ha ricetta;
--    una ricetta senza ingredienti, o con la resa non indicata, non dice
--    quanto togliere. In quei casi non si toglie niente e **lo si
--    dichiara**: la riga finisce in `anomalie_scarico` e si conta. E'
--    la lezione dello scarto a zero e del «parziale: N conti» — un buco
--    dichiarato, mai uno zero che sembra un dato.
--
-- ⚠️ **Lo scarico non blocca MAI la chiusura del conto.** E' una
--    scrittura di conseguenza: il cliente ha pagato e sta aspettando. Se
--    la giacenza non basta si toglie quello che c'e' e si registra il
--    mancante; se succede qualcosa di imprevisto, il conto si chiude
--    lo stesso, resta una riga di anomalia e parte un avviso. La verifica
--    lo prova **forzando un guasto vero** (§9 punto 8), non sulla parola.
--
-- ⚠️ **Chiudere due volte non scarica due volte.** Il segno sta sul conto
--    (`orders.magazzino_scaricato_il`) e un indice unico su
--    (conto, ingrediente) rende il doppio scarico impossibile anche
--    aggirando la funzione — prevenire invece di segnalare, come per il
--    doppio pagamento di una fattura fornitore.
--
-- ⚠️ **Lo scarto entra nel conteggio.** La ricetta dice 200 g puliti, ma
--    per averli se ne prendono 235 dalla cella: si scarica cio' che esce
--    davvero, non cio' che finisce nel piatto. E' la stessa formula del
--    food cost (`v_recipe_costs`), non una seconda: due regole diverse
--    per la stessa cosa finirebbero per dire due numeri diversi.
--
-- ⚠️ **Le preparazioni si esplodono fino alla materia prima**, perche'
--    oggi un semilavorato non ha un lotto proprio in magazzino. Quando
--    arrivera' il Blocco 2 (le Produzioni), una preparazione con i suoi
--    lotti smettera' di essere esplosa e verra' scaricata come se stessa:
--    l'aggancio e' gia' previsto qui, ed e' il motivo per cui la
--    ricorsione riusa la stessa forma della vista dei costi.
--
-- ⚠️ **Il costo si fotografa adesso.** Scaricando dai lotti si sa quanto
--    e' costata davvero quella merce, coi prezzi di quel giorno. Fra sei
--    mesi non si ricostruisce (stessa ragione del costo degli omaggi), e
--    il Blocco 3 — la proiezione economica — vive su questo numero. Il
--    costo NON sta in una colonna leggibile dallo staff: per questo
--    `stock_consumptions` passa da «lettura aperta a tutti» a
--    titolare-only. Nessuna schermata la leggeva (codice morto rimosso
--    nell'audit dell'08/08), quindi non si rompe niente.
--
-- FEFO: si scarica dai lotti che scadono prima (`expiry_date` crescente,
-- poi il piu' vecchio ricevuto) — cosi' lo scadenziario e la
-- rintracciabilita' restano veri. E' l'ordine che `record_stock_consumption`
-- usa gia' per lo scarico a mano: una regola sola.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Il segno sul conto, e le colonne che raccontano lo scarico
-- ---------------------------------------------------------------------
alter table orders
  add column if not exists magazzino_scaricato_il timestamptz;

comment on column orders.magazzino_scaricato_il is
  'Quando la giacenza e'' scesa per questo conto. Serve a non scaricare due volte lo stesso conto: e'' il segno, non l''indice unico, che rende idempotente la chiusura ripetuta.';

alter table stock_consumptions
  add column if not exists order_id uuid references orders(id) on delete set null,
  add column if not exists quantita_richiesta numeric(14,4),
  add column if not exists costo numeric(14,4);

comment on column stock_consumptions.quantita_richiesta is
  'Quanto serviva secondo ricetta. `quantity` e'' quanto i lotti hanno davvero potuto dare: se richiesta > quantity, il magazzino era gia'' in debito e la differenza sta in anomalie_scarico.';
comment on column stock_consumptions.costo is
  'Quanto e'' costata la merce uscita, ai prezzi dei lotti toccati. Si calcola solo qui e solo adesso: fra sei mesi quei lotti non ci sono piu''.';

-- Il doppio scarico dello stesso conto diventa impossibile per
-- costruzione, non improbabile per attenzione.
create unique index if not exists uq_scarico_conto_ingrediente
  on stock_consumptions (order_id, ingredient_id)
  where order_id is not null;

create index if not exists idx_stock_consumptions_order
  on stock_consumptions (order_id) where order_id is not null;

-- La lettura era aperta a chiunque fosse autenticato: senza il costo era
-- innocua, con il costo diventerebbe il listino d'acquisto a disposizione
-- della sala.
drop policy if exists stock_consumptions_select_all on stock_consumptions;
drop policy if exists stock_consumptions_titolare_select on stock_consumptions;
create policy stock_consumptions_titolare_select on stock_consumptions
  for select using ((select is_titolare()));

-- ---------------------------------------------------------------------
-- 2. Cio' che non si e' potuto scaricare — dichiarato, non ignorato
-- ---------------------------------------------------------------------
create table if not exists anomalie_scarico (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references orders(id) on delete cascade,
  order_item_id     uuid references order_items(id) on delete cascade,
  ingredient_id     uuid references ingredients(id) on delete set null,
  tipo              text not null check (tipo in (
                      'voce_libera',            -- riga senza ricetta
                      'ricetta_incompleta',     -- ricetta che non dice cosa togliere
                      'giacenza_insufficiente', -- i lotti non bastavano
                      'errore'                  -- guasto imprevisto, conto chiuso lo stesso
                    )),
  descrizione       text,
  quantita_mancante numeric(14,4),
  creato_il         timestamptz not null default now()
);

comment on table anomalie_scarico is
  'Le righe che il magazzino non ha potuto scaricare, col motivo. Esiste perche'' un buco dichiarato e'' onesto e uno zero silenzioso no: senza questa tabella una giacenza incompleta avrebbe l''aria di essere giusta.';

create index if not exists idx_anomalie_scarico_quando on anomalie_scarico (creato_il desc);
create index if not exists idx_anomalie_scarico_conto  on anomalie_scarico (order_id);

alter table anomalie_scarico enable row level security;
drop policy if exists anomalie_scarico_titolare on anomalie_scarico;
create policy anomalie_scarico_titolare on anomalie_scarico
  for all using ((select is_titolare())) with check ((select is_titolare()));

-- ---------------------------------------------------------------------
-- 3. Il fabbisogno di un conto: dal piatto alla materia prima
-- ---------------------------------------------------------------------
-- Stessa ricorsione di `v_recipe_costs`, e non una copia riscritta a
-- mano: se domani cambia il modo di espandere una preparazione, deve
-- cambiare in un posto solo — altrimenti il costo direbbe una cosa e lo
-- scarico un'altra, e nessuno se ne accorgerebbe.
--
-- Chiusa a tutti: la chiamano solo funzioni che girano come proprietario.
-- Una porta che non serve a nessuno si chiude, non le si mette un
-- portiere.
create or replace function fabbisogno_conto(p_order_id uuid)
returns table (order_item_id uuid, ingredient_id uuid, quantita numeric)
language sql
stable
security definer
set search_path = public
as $funzione$
  with recursive righe as (
    select oi.id, oi.recipe_id, oi.quantity::numeric as porzioni
      from order_items oi
     where oi.order_id = p_order_id
       and oi.voided_at is null
       and oi.recipe_id is not null
  ),
  espansione as (
    -- Livello 1: la ricetta del piatto. La quantita' in ricetta e' per
    -- l'INTERA resa, quindi si divide per le porzioni che produce — una
    -- riga d'ordine e' una porzione.
    select r.id                                                as order_item_id,
           ri.ingredient_id,
           ri.component_recipe_id,
           (r.porzioni * ri.quantity / nullif(rec.portions_yield, 0)) as mult,
           ri.waste_percentage,
           ri.is_optional,
           1                                                   as depth
      from righe r
      join recipes rec            on rec.id = r.recipe_id
      join recipe_ingredients ri  on ri.recipe_id = r.recipe_id
    union all
    -- Livelli successivi: una preparazione dentro la ricetta. Si divide
    -- per la resa della preparazione (se ne produce 2 kg e ne servono
    -- 0,3, si prende il 15% dei suoi ingredienti).
    select e.order_item_id,
           ri2.ingredient_id,
           ri2.component_recipe_id,
           (e.mult * ri2.quantity / nullif(comp.yield_quantity, 0)),
           ri2.waste_percentage,
           (e.is_optional or ri2.is_optional),
           e.depth + 1
      from espansione e
      join recipes comp           on comp.id = e.component_recipe_id
      join recipe_ingredients ri2 on ri2.recipe_id = e.component_recipe_id
     where e.component_recipe_id is not null
       and e.depth < 10
  )
  select e.order_item_id,
         e.ingredient_id,
         -- Lo scarto: cio' che esce dalla cella, non cio' che entra nel
         -- piatto. Stessa formula del food cost.
         sum(e.mult * (1 + coalesce(e.waste_percentage, i.waste_percentage_default, 0) / 100.0))::numeric(14,4)
    from espansione e
    join ingredients i on i.id = e.ingredient_id
   where e.ingredient_id is not null
     and not e.is_optional
     and e.mult is not null
   group by e.order_item_id, e.ingredient_id
  having sum(e.mult * (1 + coalesce(e.waste_percentage, i.waste_percentage_default, 0) / 100.0)) > 0;
$funzione$;

comment on function fabbisogno_conto(uuid) is
  'Quanta materia prima serve per le righe di un conto, preparazioni esplose e scarto compreso. Non tocca niente: dice solo cosa andrebbe tolto.';

revoke all on function fabbisogno_conto(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Lo scarico vero — e non solleva mai un'eccezione verso chi chiude
-- ---------------------------------------------------------------------
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
             || ' ×' || oi.quantity
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

    -- c. Lo scarico, un ingrediente per volta, dai lotti che scadono
    --    prima (FEFO).
    for v_riga in
      select f.ingredient_id, sum(f.quantita) as quantita
        from fabbisogno_conto(p_order_id) f
       group by f.ingredient_id
    loop
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

      if v_tolto > 0 then
        insert into stock_consumptions
          (ingredient_id, quantity, reason, note, order_id, quantita_richiesta, costo)
        values
          (v_riga.ingredient_id, v_tolto, 'consumo',
           'Conto ' || coalesce(v_order.table_label, '?'),
           p_order_id, v_riga.quantita, round(v_costo, 4));
      end if;

      -- Il magazzino era gia' in debito: si toglie quello che c'e' e si
      -- dice quanto manca. Azzerare e tacere darebbe una giacenza giusta
      -- per caso e un ammanco invisibile.
      if v_da_togliere > 0.00005 then
        insert into anomalie_scarico
          (order_id, ingredient_id, tipo, descrizione, quantita_mancante)
        values
          (p_order_id, v_riga.ingredient_id, 'giacenza_insufficiente',
           (select name from ingredients where id = v_riga.ingredient_id),
           round(v_da_togliere, 4));
      end if;
    end loop;

    update orders set magazzino_scaricato_il = now() where id = p_order_id;

  exception when others then
    -- Il conto e' gia' chiuso e il cliente non aspetta: qualunque cosa sia
    -- successa qui dentro non deve tornare indietro fino a lui. Le
    -- scritture di questo blocco sono annullate, il conto resta chiuso e
    -- non segnato come scaricato — cosi' si potra' riprovare.
    v_errore := sqlerrm;
  end;

  if v_errore is not null then
    begin
      insert into anomalie_scarico (order_id, tipo, descrizione)
      values (p_order_id, 'errore', v_errore);

      perform segnala_allarme(
        'scarico_magazzino',
        'Il magazzino non e'' sceso alla chiusura di un conto: ' || v_errore,
        jsonb_build_object('conto', p_order_id),
        'guasto');
    exception when others then
      null;  -- nemmeno il racconto del guasto puo' far fallire una chiusura
    end;
  end if;
end;
$funzione$;

comment on function scarica_magazzino_conto(uuid) is
  'Toglie dalla giacenza gli ingredienti dei piatti di un conto chiuso, dai lotti che scadono prima. Non solleva mai eccezioni: e'' una scrittura di conseguenza, e un conto si chiude anche se un lotto non torna.';

-- Chiusa a tutti: si entra solo dalle due funzioni di chiusura conto.
revoke all on function scarica_magazzino_conto(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Chiudere un conto pagato diventa un'operazione del corridoio (B4)
-- ---------------------------------------------------------------------
-- Prima era un `update` su una riga sola, fatto dal browser: categoria A,
-- legittima. Da adesso chiudere tocca `orders`, `stock_lots`,
-- `stock_consumptions` e `anomalie_scarico` — quattro tabelle che devono
-- riuscire o fallire insieme, cioe' B4 del Contratto: una funzione
-- Postgres sola, invocata attraverso `operazioni-atomiche`.
create or replace function close_order_paid(
  p_order_id           uuid,
  p_payment_method     text,
  p_coperto_unit_price numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_order  orders%rowtype;
  v_prezzo numeric(12,2);
begin
  -- Chiudere un conto e' compito anche dello staff (§3.5): il controllo
  -- e' che ci sia un utente vero, non che sia il titolare. La funzione
  -- non allarga i permessi rispetto all'update diretto di prima.
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Conto non trovato';
  end if;
  if v_order.status <> 'aperto' then
    raise exception 'Questo conto e'' gia'' stato chiuso (stato: %). Ricaricare la schermata.', v_order.status;
  end if;
  if p_payment_method is null or p_payment_method not in ('contante', 'carta') then
    raise exception 'Metodo di pagamento non valido: %', coalesce(p_payment_method, '(vuoto)');
  end if;

  -- Il coperto si fotografa sul conto: da domani puo' cambiare, questo
  -- conto no (stesso principio di order_items.unit_price).
  v_prezzo := coalesce(
    p_coperto_unit_price,
    v_order.coperto_unit_price,
    (select coperto_price from service_settings where id = 1),
    0
  );

  update orders set
    status             = 'chiuso',
    payment_method     = p_payment_method::order_payment_method,
    coperto_unit_price = v_prezzo,
    closed_at          = now()
  where id = p_order_id;

  perform scarica_magazzino_conto(p_order_id);
end;
$funzione$;

comment on function close_order_paid(uuid, text, numeric) is
  'Chiude un conto pagato e fa scendere la giacenza nella stessa transazione. Serve in sala, quindi e'' eseguibile da chi e'' autenticato: non restituisce nessun dato economico.';

revoke all on function close_order_paid(uuid, text, numeric) from public, anon, authenticated;
grant execute on function close_order_paid(uuid, text, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Anche uno sconto o un omaggio fanno uscire la merce dalla cella
-- ---------------------------------------------------------------------
-- Ricreata identica, con l'unica aggiunta dello scarico in fondo: un
-- pasto regalato consuma ingredienti come uno pagato, e non scaricarlo
-- lascerebbe una giacenza ottimista proprio sui conti che gia' costano.
create or replace function close_order_as_discount_gift(
  p_order_id uuid,
  p_is_gift boolean,
  p_collected_amount numeric default 0,
  p_expected_full_amount numeric default null,
  p_causale_id uuid default null,
  p_causale_note text default null,
  p_customer_id uuid default null,
  p_device_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_utente         uuid := auth.uid();
  v_order          orders%rowtype;
  v_prezzo_coperto numeric(12,2);
  v_totale_righe   numeric(12,2);
  v_totale         numeric(12,2);
  v_incassato      numeric(12,2);
  v_dg_id          uuid;
  v_costo          record;
begin
  if v_utente is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_order from orders where id = p_order_id for update;

  if v_order.id is null then
    raise exception 'Conto non trovato';
  end if;

  if v_order.status <> 'aperto' then
    raise exception 'Questo conto e'' gia'' stato chiuso (stato: %). Ricaricare la schermata.', v_order.status;
  end if;

  v_prezzo_coperto := coalesce(
    v_order.coperto_unit_price,
    (select coperto_price from service_settings where id = 1),
    0
  );

  select coalesce(sum(quantity * unit_price), 0)
    into v_totale_righe
  from order_items
  where order_id = p_order_id and voided_at is null;

  v_totale := v_totale_righe + coalesce(v_order.coperti, 0) * v_prezzo_coperto;

  if p_expected_full_amount is not null
     and abs(p_expected_full_amount - v_totale) > 0.01 then
    raise exception 'Il totale e'' cambiato mentre chiudevi il conto (a schermo %, ora %). Ricarica e riprova.',
      p_expected_full_amount, v_totale;
  end if;

  if p_is_gift then
    v_incassato := 0;
  else
    v_incassato := coalesce(p_collected_amount, 0);
    if v_incassato < 0 then
      raise exception 'L''importo incassato non puo'' essere negativo';
    end if;
    if v_incassato > v_totale then
      raise exception 'L''importo incassato (%) non puo'' superare il totale del conto (%)', v_incassato, v_totale;
    end if;
  end if;

  -- Quanto e' costato, adesso e non domani.
  select * into v_costo from costo_ingredienti_conto(p_order_id);

  insert into discounts_gifts (
    entity_id, type, full_amount, collected_amount,
    causale_id, causale_note, customer_id, device_id, note, created_by,
    costo_ingredienti, righe_valorizzate, righe_senza_costo
  ) values (
    v_order.entity_id,
    case when p_is_gift then 'omaggio' else 'sconto' end::discount_gift_type,
    v_totale,
    v_incassato,
    p_causale_id, p_causale_note, p_customer_id, p_device_id, p_note, v_utente,
    v_costo.costo, coalesce(v_costo.valorizzate, 0), coalesce(v_costo.senza_costo, 0)
  )
  returning id into v_dg_id;

  update orders set
    status             = case when p_is_gift then 'omaggiato' else 'chiuso' end::order_status,
    discount_gift_id   = v_dg_id,
    coperto_unit_price = v_prezzo_coperto,
    closed_at          = now()
  where id = p_order_id;

  -- La merce e' uscita dalla cella anche se il conto non ha incassato.
  perform scarica_magazzino_conto(p_order_id);

  return v_dg_id;
end;
$funzione$;

revoke all on function close_order_as_discount_gift(uuid, boolean, numeric, numeric, uuid, text, uuid, uuid, text) from public, anon;
grant execute on function close_order_as_discount_gift(uuid, boolean, numeric, numeric, uuid, text, uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. «Cosa non e' sceso» — la domanda deve avere risposta in schermata
-- ---------------------------------------------------------------------
create or replace function scarichi_non_riusciti(
  p_dal date default null,
  p_al  date default null
)
returns table (
  id                uuid,
  quando            timestamptz,
  tavolo            text,
  tipo              text,
  descrizione       text,
  quantita_mancante numeric,
  unita             text
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  -- `security definer` gira senza RLS: il controllo va rimesso dentro.
  -- E chi non deve vedere riceve un rifiuto, non un elenco vuoto: una
  -- schermata vuota direbbe «e'' andato tutto bene», che qui e'' falso.
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
         i.unit::text
    from anomalie_scarico a
    left join orders o      on o.id = a.order_id
    left join ingredients i on i.id = a.ingredient_id
   where (p_dal is null or (a.creato_il at time zone 'Europe/Rome')::date >= p_dal)
     and (p_al  is null or (a.creato_il at time zone 'Europe/Rome')::date <= p_al)
   order by a.creato_il desc;
end;
$funzione$;

comment on function scarichi_non_riusciti(date, date) is
  'Le righe che il magazzino non ha potuto scaricare nel periodo, col motivo. Serve a rispondere a «come mai la giacenza non torna?» senza contare a mano.';

revoke all on function scarichi_non_riusciti(date, date) from public, anon, authenticated;
grant execute on function scarichi_non_riusciti(date, date) to authenticated;

-- ---------------------------------------------------------------------
-- 8. Verifica (§7 punti 1-3) — con dati finti, cancellati alla fine
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente      uuid;
  v_titolare  uuid;
  v_staff     uuid;
  v_forn      uuid;
  v_ing_a     uuid;
  v_ing_b     uuid;
  v_prep      uuid;
  v_piatto    uuid;
  v_vuota     uuid;
  v_lotto1    uuid;
  v_lotto2    uuid;
  v_lotto_b   uuid;
  v_conto     uuid;
  v_conto2    uuid;
  v_conto3    uuid;
  v_q         numeric;
  v_c         numeric;
  n           integer;
  respinto    boolean;
begin
  select id into v_ente from entities order by created_at limit 1;
  if v_ente is null then raise exception 'Nessuna entita''.'; end if;
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'Servono un titolare e uno staff in user_roles per questa verifica.';
  end if;

  -- ---- La dispensa finta -------------------------------------------
  insert into suppliers (entity_id, name, category)
  values (v_ente, 'PROVA SCAR fornitore', 'ortofrutta') returning id into v_forn;

  -- A: nessuno scarto. B: 20% di scarto dichiarato sull'anagrafica.
  insert into ingredients (entity_id, name, category, unit, waste_percentage_default)
  values (v_ente, 'PROVA SCAR pomodoro', 'verdura', 'kg', 0) returning id into v_ing_a;
  insert into ingredients (entity_id, name, category, unit, waste_percentage_default)
  values (v_ente, 'PROVA SCAR semola', 'farine_cereali', 'kg', 20) returning id into v_ing_b;

  -- Due lotti di A: uno scade domani (0,5 kg a 2,00 €), uno fra un mese
  -- (5 kg a 4,00 €). FEFO deve prendere prima quello che scade domani.
  insert into stock_lots (ingredient_id, supplier_id, quantity_received, quantity_remaining,
                          unit_cost, expiry_date, received_at)
  values (v_ing_a, v_forn, 0.5, 0.5, 2.00, ((now() at time zone 'Europe/Rome')::date + 1), now() - interval '5 days')
  returning id into v_lotto1;
  insert into stock_lots (ingredient_id, supplier_id, quantity_received, quantity_remaining,
                          unit_cost, expiry_date, received_at)
  values (v_ing_a, v_forn, 5, 5, 4.00, ((now() at time zone 'Europe/Rome')::date + 30), now())
  returning id into v_lotto2;

  -- B: in cella ce n'e' meno di quanta ne serve. E' il caso che non deve
  -- bloccare niente e deve lasciare traccia.
  insert into stock_lots (ingredient_id, supplier_id, quantity_received, quantity_remaining,
                          unit_cost, expiry_date, received_at)
  values (v_ing_b, v_forn, 0.10, 0.10, 1.00, ((now() at time zone 'Europe/Rome')::date + 60), now())
  returning id into v_lotto_b;

  -- ---- Le ricette: una preparazione dentro un piatto ---------------
  -- Preparazione: da 3 kg di A escono 2 kg di prodotto.
  insert into recipes (name, category, recipe_type, portions_yield, yield_quantity, yield_unit)
  values ('PROVA SCAR salsa', 'primo', 'preparazione', 1, 2, 'kg')
  returning id into v_prep;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_prep, v_ing_a, 3, 'kg');

  -- Piatto da 4 porzioni: 1 kg di salsa + 0,5 kg di semola.
  insert into recipes (name, category, recipe_type, portions_yield)
  values ('PROVA SCAR pasta', 'primo', 'piatto_finito', 4)
  returning id into v_piatto;
  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
  values (v_piatto, v_prep, 1, 'kg');
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_piatto, v_ing_b, 0.5, 'kg');

  -- Un piatto senza ingredienti: deve dichiararsi, non sparire.
  insert into recipes (name, category, recipe_type, portions_yield)
  values ('PROVA SCAR piatto vuoto', 'secondo', 'piatto_finito', 1)
  returning id into v_vuota;

  -- ---- Il conto -----------------------------------------------------
  insert into orders (entity_id, table_label, status, coperti)
  values (v_ente, 'PROVA SCAR T1', 'aperto', 2) returning id into v_conto;
  insert into order_items (order_id, recipe_id, destination, quantity, unit_price)
  values (v_conto, v_piatto, 'cucina', 2, 12.00);
  insert into order_items (order_id, recipe_id, destination, quantity, unit_price)
  values (v_conto, v_vuota, 'cucina', 1, 8.00);
  insert into order_items (order_id, free_text_name, destination, quantity, unit_price)
  values (v_conto, 'PROVA SCAR caffe', 'bar', 3, 1.50);
  -- Una riga stornata non deve scaricare niente.
  insert into order_items (order_id, recipe_id, destination, quantity, unit_price, voided_at, void_reason)
  values (v_conto, v_piatto, 'cucina', 5, 12.00, now(), 'prova');

  -- 1. Il conto dei fabbisogni, prima di toccare qualunque cosa.
  --    2 porzioni × (1 kg salsa / 4 porzioni) = 0,5 kg di salsa
  --    0,5 kg di salsa su una resa di 2 kg = 25% di 3 kg = 0,75 kg di A
  select sum(quantita) into v_q from fabbisogno_conto(v_conto) where ingredient_id = v_ing_a;
  if v_q is null or abs(v_q - 0.75) > 0.0001 then
    raise exception 'Il fabbisogno del pomodoro dovrebbe essere 0,75 kg, risulta %.', coalesce(v_q::text, 'niente');
  end if;
  --    2 porzioni × (0,5 kg / 4) = 0,25 kg + 20% di scarto = 0,30 kg
  select sum(quantita) into v_q from fabbisogno_conto(v_conto) where ingredient_id = v_ing_b;
  if v_q is null or abs(v_q - 0.30) > 0.0001 then
    raise exception 'Lo scarto non entra nel conteggio: la semola dovrebbe essere 0,30 kg, risulta %.', coalesce(v_q::text, 'niente');
  end if;

  -- 2. Si chiude il conto DAL RUOLO VERO dello staff, attraverso la
  --    funzione vera: e' la sala che chiude i conti.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  perform close_order_paid(v_conto, 'contante', 5.00);
  perform set_config('request.jwt.claims', null, true);

  if (select status from orders where id = v_conto) <> 'chiuso' then
    raise exception 'Il conto non risulta chiuso.';
  end if;

  -- 3. FEFO: il lotto che scade domani si svuota per primo.
  if (select quantity_remaining from stock_lots where id = v_lotto1) <> 0 then
    raise exception 'Il lotto in scadenza non e'' stato usato per primo (FEFO).';
  end if;
  if abs((select quantity_remaining from stock_lots where id = v_lotto2) - 4.75) > 0.0001 then
    raise exception 'Il secondo lotto doveva scendere di 0,25 kg, e'' a %.',
      (select quantity_remaining from stock_lots where id = v_lotto2);
  end if;

  -- 4. Il costo fotografato: 0,5 kg a 2,00 + 0,25 kg a 4,00 = 2,00 €.
  select quantity, costo into v_q, v_c
    from stock_consumptions where order_id = v_conto and ingredient_id = v_ing_a;
  if abs(v_q - 0.75) > 0.0001 then
    raise exception 'Il movimento del pomodoro dice % invece di 0,75.', v_q;
  end if;
  if abs(v_c - 2.00) > 0.0001 then
    raise exception 'Il costo della merce uscita dovrebbe essere 2,00 €, risulta %.', v_c;
  end if;

  -- 5. Giacenza insufficiente: si toglie quello che c'e', si dichiara il
  --    mancante, e la chiusura NON si e' fermata.
  if (select quantity_remaining from stock_lots where id = v_lotto_b) <> 0 then
    raise exception 'La semola disponibile doveva uscire tutta.';
  end if;
  select quantita_mancante into v_q from anomalie_scarico
   where order_id = v_conto and tipo = 'giacenza_insufficiente' and ingredient_id = v_ing_b;
  if v_q is null or abs(v_q - 0.20) > 0.0001 then
    raise exception 'Il mancante di semola dovrebbe essere 0,20 kg, risulta %.', coalesce(v_q::text, 'niente');
  end if;

  -- 6. La voce libera e la ricetta vuota si dichiarano, non si inventano.
  select count(*) into n from anomalie_scarico
   where order_id = v_conto and tipo = 'voce_libera' and descrizione like '%caffe%';
  if n <> 1 then raise exception 'La voce libera non e'' stata dichiarata (trovate %).', n; end if;

  select count(*) into n from anomalie_scarico
   where order_id = v_conto and tipo = 'ricetta_incompleta' and descrizione like '%piatto vuoto%';
  if n <> 1 then raise exception 'La ricetta senza ingredienti non e'' stata dichiarata (trovate %).', n; end if;

  -- 7. La riga stornata non ha scaricato niente: se avesse contato, il
  --    pomodoro sarebbe sceso di molto piu' di 0,75 kg (gia' verificato
  --    al punto 4) — qui si controlla che non abbia lasciato anomalie.
  select count(*) into n from anomalie_scarico where order_id = v_conto;
  if n <> 3 then
    raise exception 'Le anomalie del conto dovrebbero essere 3 (voce libera, ricetta vuota, semola), sono %.', n;
  end if;

  -- 8. Chiudere due volte non scarica due volte.
  perform scarica_magazzino_conto(v_conto);
  if abs((select quantity_remaining from stock_lots where id = v_lotto2) - 4.75) > 0.0001 then
    raise exception 'Un secondo scarico dello stesso conto ha toccato di nuovo la giacenza.';
  end if;
  select count(*) into n from anomalie_scarico where order_id = v_conto;
  if n <> 3 then raise exception 'Un secondo scarico ha duplicato le anomalie (ora %).', n; end if;

  -- ...e nemmeno aggirando la funzione: l'indice unico lo impedisce.
  respinto := false;
  begin
    insert into stock_consumptions (ingredient_id, quantity, reason, order_id)
    values (v_ing_a, 1, 'consumo', v_conto);
  exception when sqlstate '23505' then respinto := true;
  end;
  if not respinto then
    raise exception 'Si e'' potuto registrare due volte lo scarico dello stesso ingrediente sullo stesso conto.';
  end if;

  -- 9. Un conto ANNULLATO non tocca il magazzino (decisione di Alessio).
  insert into orders (entity_id, table_label, status, coperti)
  values (v_ente, 'PROVA SCAR T2', 'aperto', 2) returning id into v_conto2;
  insert into order_items (order_id, recipe_id, destination, quantity, unit_price)
  values (v_conto2, v_piatto, 'cucina', 1, 12.00);
  update orders set status = 'annullato', cancel_reason = 'prova', closed_at = now() where id = v_conto2;
  perform scarica_magazzino_conto(v_conto2);
  if abs((select quantity_remaining from stock_lots where id = v_lotto2) - 4.75) > 0.0001 then
    raise exception 'Un conto annullato ha fatto scendere la giacenza.';
  end if;
  select count(*) into n from anomalie_scarico where order_id = v_conto2;
  if n <> 0 then raise exception 'Un conto annullato ha lasciato % anomalie.', n; end if;

  -- 10. IL PUNTO CHE VALE PIU' DEGLI ALTRI: un guasto dentro lo scarico
  --     non deve fermare la chiusura del conto. Si forza un guasto vero
  --     mettendo un ostacolo sulla scrittura dei movimenti.
  insert into orders (entity_id, table_label, status, coperti)
  values (v_ente, 'PROVA SCAR T3', 'aperto', 2) returning id into v_conto3;
  insert into order_items (order_id, recipe_id, destination, quantity, unit_price)
  values (v_conto3, v_piatto, 'cucina', 1, 12.00);

  -- ⚠️ Il guasto finto fa partire un avviso vero, e il telefono di
  --    Alessio suonerebbe per una prova (§8: e' gia' successo l'11/08).
  --    Si usa il freno anti-tempesta del sistema stesso — un avviso per
  --    tipo all'ora — mettendo davanti un allarme di quel tipo appena
  --    creato: la regola viene percorsa per intero, il messaggio non parte.
  insert into allarmi (tipo, messaggio, notificato)
  values ('scarico_magazzino', 'PROVA SCAR: silenzia l''avviso della verifica', true);

  execute $blocco$
    create or replace function prova_scar_guasto() returns trigger
    language plpgsql as $t$
    begin raise exception 'guasto finto per la prova'; end $t$;
  $blocco$;
  execute 'drop trigger if exists prova_scar_guasto on stock_consumptions';
  execute 'create trigger prova_scar_guasto before insert on stock_consumptions
           for each row execute function prova_scar_guasto()';

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  perform close_order_paid(v_conto3, 'carta', 5.00);
  perform set_config('request.jwt.claims', null, true);

  execute 'drop trigger prova_scar_guasto on stock_consumptions';
  execute 'drop function prova_scar_guasto()';

  if (select status from orders where id = v_conto3) <> 'chiuso' then
    raise exception 'Un guasto nello scarico ha impedito la chiusura del conto. E'' esattamente cio'' che non deve succedere.';
  end if;
  select count(*) into n from anomalie_scarico where order_id = v_conto3 and tipo = 'errore';
  if n <> 1 then
    raise exception 'Il guasto nello scarico non e'' stato registrato (righe %).', n;
  end if;
  if (select magazzino_scaricato_il from orders where id = v_conto3) is not null then
    raise exception 'Un conto il cui scarico e'' fallito risulta scaricato: non si potrebbe piu'' riprovare.';
  end if;
  -- E il guasto non ha lasciato mezzo scarico dietro di se'.
  select count(*) into n from stock_consumptions where order_id = v_conto3;
  if n <> 0 then raise exception 'Il guasto ha lasciato % movimenti a meta''.', n; end if;

  -- 11. Il portiere: lo staff non vede l'elenco di cio' che non e' sceso.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  respinto := false;
  begin perform scarichi_non_riusciti();
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then
    raise exception 'Lo staff ha potuto leggere l''elenco degli scarichi non riusciti.';
  end if;

  perform set_config('request.jwt.claims', null, true);

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  select count(*) into n from scarichi_non_riusciti();
  if n < 3 then
    raise exception 'Il titolare non vede le anomalie (ne trova %).', n;
  end if;

  -- Nessuna delle funzioni nuove ha lasciato una porta aperta sul mondo:
  -- l'elenco congelato di chi puo' bussare con la sola chiave pubblica
  -- deve essere ancora quello.
  select count(*) into n from funzioni_aperte_ad_anon();
  if n <> 12 then
    raise exception 'L''elenco di chi puo'' bussare da fuori e'' passato a %: una funzione nuova e'' nata senza revoca.', n;
  end if;
  perform set_config('request.jwt.claims', null, true);

  -- 12. La chiusura di uno stesso conto due volte resta un rifiuto
  --     leggibile, non un guasto.
  respinto := false;
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    perform close_order_paid(v_conto, 'contante', 5.00);
  exception when sqlstate 'P0001' then respinto := true;
  end;
  perform set_config('request.jwt.claims', null, true);
  if not respinto then raise exception 'Un conto gia'' chiuso si e'' lasciato chiudere di nuovo.'; end if;

  -- 13. Lo sconto/omaggio scarica anche lui: si controlla sul corpo della
  --     funzione, perche' provarlo davvero scriverebbe in discounts_gifts,
  --     che ha il registro delle cancellazioni (la pulizia lascerebbe una
  --     riga finta in un registro che deve restare vero).
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'close_order_as_discount_gift'
     and pg_get_functiondef(p.oid) like '%scarica_magazzino_conto%';
  if n <> 1 then
    raise exception 'La chiusura con sconto o omaggio non fa scendere la giacenza.';
  end if;

  -- ---- Pulizia (§5 punto 8) ----------------------------------------
  delete from allarmi where messaggio like 'PROVA SCAR%';
  delete from anomalie_scarico where order_id in (v_conto, v_conto2, v_conto3);
  delete from stock_consumptions where order_id in (v_conto, v_conto2, v_conto3);
  delete from order_items where order_id in (v_conto, v_conto2, v_conto3);
  delete from orders where id in (v_conto, v_conto2, v_conto3);
  delete from recipe_ingredients where recipe_id in (v_prep, v_piatto, v_vuota);
  delete from recipe_status_history where recipe_id in (v_prep, v_piatto, v_vuota);
  delete from recipes where id in (v_prep, v_piatto, v_vuota);
  delete from stock_consumptions where ingredient_id in (v_ing_a, v_ing_b);
  delete from stock_lots where ingredient_id in (v_ing_a, v_ing_b);
  delete from price_history where ingredient_id in (v_ing_a, v_ing_b);
  delete from ingredients where id in (v_ing_a, v_ing_b);
  delete from suppliers where id = v_forn;

  select count(*) into n from ingredients where name like 'PROVA SCAR%';
  if n <> 0 then raise exception 'La prova ha lasciato % ingredienti.', n; end if;
  select count(*) into n from recipes where name like 'PROVA SCAR%';
  if n <> 0 then raise exception 'La prova ha lasciato % ricette.', n; end if;
  select count(*) into n from orders where table_label like 'PROVA SCAR%';
  if n <> 0 then raise exception 'La prova ha lasciato % conti.', n; end if;

  raise notice 'Il magazzino scende da solo: FEFO, scarto compreso, cio'' che non si e'' potuto togliere e'' dichiarato, e la chiusura del conto non si ferma mai.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260813000013', 'il_magazzino_scende')
on conflict (version) do nothing;

select count(*) as conti_chiusi_senza_scarico
  from orders
 where status in ('chiuso', 'omaggiato')
   and magazzino_scaricato_il is null;
