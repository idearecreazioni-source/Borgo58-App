-- =====================================================================
-- LA SERA DELL'EVENTO — il magazzino scarica le porzioni CONCORDATE
-- 22/08/2026 · blocco 5 dei preventivi
-- =====================================================================
-- Decisione n. 2 del mandato (docs/mandati/20260820_i_preventivi_per_gli_eventi.md):
--
--     Le porzioni modificate valgono SOLO per quell'evento.
--     La ricetta in carta resta intatta.
--     E la sera dell'evento il magazzino deve scaricare QUELLE.
--
-- 🔴 PERCHE' LA RICETTA NON SI TOCCA: se modificare un evento cambiasse la
-- ricetta, il food cost di **tutti gli altri giorni** si sposterebbe senza
-- che nessuno l'abbia chiesto — e nessun numero direbbe perche'. Un primo
-- servito a meta' porzione a una cena di gala non e' un primo piu' piccolo
-- in carta: e' un primo piu' piccolo **quella sera**.
--
-- ⚠️ E QUI NON SI RISCRIVE LO SCARICO. `scarica_magazzino_conto` ha gia' le
-- sue reti — non scarica due volte lo stesso conto (`magazzino_scaricato_il`),
-- non tocca il magazzino su un conto annullato, dichiara in
-- `anomalie_scarico` le righe che non trovano una ricetta. Restano tutte:
-- **cambia da DOVE arrivano le quantita'**, cioe' `fabbisogno_conto`, che
-- e' l'unico posto dove si decide quanta materia prima serve.
--
-- ⚠️ E cambiando li' cambia anche la STIMA, non solo lo scarico: la
-- schermata che mostra il fabbisogno e lo scarico vero sono la stessa
-- funzione. Era gia' cosi' ed e' il motivo per cui il mandato diceva che la
-- strada esisteva.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Quali porzioni valgono per questo conto
-- ---------------------------------------------------------------------
-- La catena e' preventivo → prenotazione → conto, e ogni anello esisteva
-- gia': `preventivi.reservation_id` lo scrive `accetta_preventivo`,
-- `orders.reservation_id` lo scrive `apri_conto` dal giro D1 del 18/08.
-- Qui non si costruisce nessun legame nuovo: si percorre quello che c'e'.
--
-- 🔴 QUALE VERSIONE, ed e' la domanda che il mandato originale non poneva.
-- Un preventivo si puo' correggere DOPO l'accettazione (decisione n. 6), e
-- `accetta_preventivo` **riusa la prenotazione dell'antenato** invece di
-- crearne una seconda. Conseguenza misurata leggendo la funzione viva:
-- accettando una seconda versione, **la prima resta `accettato`** — nessuno
-- la retrocede. Quindi sulla stessa prenotazione possono esserci piu'
-- preventivi accettati, e «il preventivo di questo evento» sarebbe
-- ambiguo.
--
-- ⚠️ Si prende **l'ultimo accettato** (`accettato_il` piu' recente, a pari
-- istante il piu' recente per `created_at`). Prendere il primo sarebbe il
-- difetto peggiore di tutto il blocco: si vedrebbe **mesi dopo, sul food
-- cost**, e somiglierebbe a uno scostamento invece che a un errore.
create or replace function porzioni_evento_del_conto(p_order_id uuid)
returns table (recipe_id uuid, porzioni_per_persona numeric)
language sql
stable
security definer
set search_path = public
as $$
  with prenotazione as (
    select o.reservation_id
      from orders o
     where o.id = p_order_id
       and o.reservation_id is not null
  ),
  ultimo as (
    -- 🔴 L'ULTIMA VERSIONE SI RICONOSCE DALLA GENEALOGIA, NON DALL'ORA.
    -- La prima stesura ordinava per `accettato_il`, e la verifica qui
    -- sotto l'ha bocciata: accettando due versioni **nella stessa
    -- transazione** `now()` e' un istante solo, quindi le due date
    -- pareggiano e l'ordinamento ne sceglie una a caso — ha scelto la
    -- prima, cioe' proprio il difetto che il mandato temeva.
    --
    -- ⚠️ E' la trappola del 16/08 per la terza volta: *una riga si
    -- riconosce dalla sua firma, non dalla sua posizione in un
    -- ordinamento temporale.* Qui la firma c'e' ed e' strutturale:
    -- l'ultima versione accettata e' **quella che non ha discendenti
    -- accettati**. Regge anche se due accettazioni cadono nello stesso
    -- millesimo di secondo, che e' precisamente il caso che ha fallito.
    select p.id
      from preventivi p
      join prenotazione pr on pr.reservation_id = p.reservation_id
     where p.stato = 'accettato'
       and not exists (
         select 1 from preventivi f
          where f.versione_di = p.id
            and f.stato = 'accettato'
       )
     -- Rimane solo come ultima spiaggia: due catene accettate sulla
     -- stessa prenotazione non dovrebbero esistere.
     order by p.accettato_il desc nulls last, p.created_at desc
     limit 1
  )
  select r.recipe_id,
         -- ⚠️ Se lo stesso piatto compare su piu' righe del preventivo, le
         -- porzioni si SOMMANO: due righe da mezza porzione dello stesso
         -- piatto sono una porzione intera. Prenderne una a caso darebbe un
         -- numero plausibile e sbagliato.
         sum(r.porzioni_per_persona) as porzioni_per_persona
    from preventivo_righe r
    join ultimo u on u.id = r.preventivo_id
   where r.natura = 'cibo'
     and r.recipe_id is not null
   group by r.recipe_id;
$$;

comment on function porzioni_evento_del_conto(uuid) is
  'Le porzioni concordate per l''evento di questo conto, piatto per piatto (1 = come in carta). Vuoto se il conto non nasce da un preventivo accettato. ⚠️ Prende l''ULTIMA versione accettata: un preventivo si corregge anche dopo l''accettazione.';

revoke all on function porzioni_evento_del_conto(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Il fabbisogno, con le porzioni dell'evento dove ci sono
-- ---------------------------------------------------------------------
-- ⚠️ RISCRITTA DAL CORPO VIVO, non dal file che l'aveva creata (regola del
-- 18/08): fra i due ci stanno tutte le migrazioni che l'hanno toccata.
-- L'unica differenza rispetto al corpo di oggi e' il `porzioni` della prima
-- CTE — tutto il resto (l'esplosione delle preparazioni, l'interruttore dei
-- lotti, lo scarto, i facoltativi) e' identico.
create or replace function fabbisogno_conto(p_order_id uuid)
returns table (order_item_id uuid, ingredient_id uuid, quantita numeric)
language sql
stable
security definer
set search_path = public
as $$
  with recursive porzioni_evento as (
    select pe.recipe_id, pe.porzioni_per_persona
      from porzioni_evento_del_conto(p_order_id) pe
  ),
  righe as (
    select oi.id,
           oi.recipe_id,
           -- 🔴 LE PORZIONI DELL'EVENTO, DOVE CI SONO (22/08). `coalesce`
           -- a 1 e non a zero: un piatto ordinato quella sera ma **non**
           -- previsto dal preventivo si scarica come in carta — e' un
           -- fuori-menu, non un piatto da non scaricare.
           oi.quantity::numeric * coalesce(pev.porzioni_per_persona, 1) as porzioni
      from order_items oi
      left join porzioni_evento pev on pev.recipe_id = oi.recipe_id
     where oi.order_id = p_order_id
       and oi.voided_at is null
       -- ⚠️ Mai inviata = mai cucinata: dalla cella non e' uscito niente.
       and oi.sent_at is not null
       and oi.recipe_id is not null
  ),
  espansione as (
    select r.id as order_item_id,
           ri.ingredient_id,
           ri.component_recipe_id,
           r.porzioni * ri.quantity / nullif(rec.portions_yield, 0) as multiplier,
           ri.waste_percentage,
           ri.is_optional,
           1 as depth
      from righe r
      join recipes rec on rec.id = r.recipe_id
      join recipe_ingredients ri on ri.recipe_id = r.recipe_id

    union all

    select e.order_item_id,
           ri2.ingredient_id,
           ri2.component_recipe_id,
           e.multiplier * ri2.quantity / nullif(comp.yield_quantity, 0),
           ri2.waste_percentage,
           (e.is_optional or ri2.is_optional),
           e.depth + 1
      from espansione e
      join recipes comp on comp.id = e.component_recipe_id
      join recipe_ingredients ri2 on ri2.recipe_id = e.component_recipe_id
     where e.component_recipe_id is not null
       and e.depth < 10
       -- L'interruttore del 14/08: una preparazione CHE HA LOTTI non si
       -- esplode piu', si consuma. Senza, servire un piatto scaricherebbe
       -- due volte le stesse verdure.
       and not exists (
         select 1 from ingredients i
          join stock_lots sl on sl.ingredient_id = i.id
         where i.preparazione_id = e.component_recipe_id
           and sl.quantity_remaining > 0
       )
  )
  select e.order_item_id,
         e.ingredient_id,
         sum(e.multiplier * (1 + coalesce(e.waste_percentage, i.waste_percentage_default, 0) / 100.0))
    from espansione e
    join ingredients i on i.id = e.ingredient_id
   where e.ingredient_id is not null
     and not e.is_optional
   group by e.order_item_id, e.ingredient_id;
$$;

comment on function fabbisogno_conto(uuid) is
  'Quanta materia prima serve per le righe di un conto, preparazioni esplose e scarto compreso. Non tocca niente: dice solo cosa andrebbe tolto. ⚠️ Dal 22/08 usa le porzioni CONCORDATE quando il conto nasce da un preventivo accettato — la ricetta in carta resta intatta.';

revoke all on function fabbisogno_conto(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. La verifica
-- ---------------------------------------------------------------------
-- ⚠️ I NUMERI SONO SCELTI PERCHE' DISTINGUANO (lezione del 19/08): con
-- porzioni 1 le due risposte coinciderebbero e la verifica passerebbe senza
-- misurare niente. Qui l'evento vale **0,25 porzioni** su **8 piatti
-- ordinati**: in carta 8 × 0,100 = 0,800 kg, all'evento 2 × 0,100 = 0,200.
-- I due numeri sono diversi di quattro volte e nessun errore di segno o di
-- arrotondamento li fa coincidere.
do $$
declare
  v_ing        uuid;
  v_ric        uuid;
  v_lotto      uuid;
  v_prev       uuid;
  v_prev2      uuid;
  v_res        uuid;
  v_ordine     uuid;
  v_item       uuid;
  v_ent        uuid;
  v_tavolo     uuid;
  v_prima      numeric;
  v_dopo       numeric;
  v_dopo2      numeric;
  v_atteso     numeric;
  v_carta      numeric;
  v_qta_carta  numeric;
  v_lapidi     integer;
  v_lapidi_2   integer;
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_ent from entities order by created_at limit 1;
  if v_ent is null then
    raise exception 'Nessuna entita'': non posso costruire un preventivo di prova.';
  end if;

  -- --- l'ingrediente, la ricetta, il lotto ---------------------------
  insert into ingredients (entity_id, name, unit, category, alimentare)
  values (v_ent, '__PROVA__evento', 'kg', 'altro', true)
  returning id into v_ing;

  insert into recipes (name, category, portions_yield)
  values ('__PROVA__piatto evento', 'primo', 1)
  returning id into v_ric;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit, is_optional)
  values (v_ric, v_ing, 0.100, 'kg', false);

  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at)
  values (v_ing, 10, 10, 5, now())
  returning id into v_lotto;

  -- --- il preventivo, accettato --------------------------------------
  insert into preventivi (entity_id, cliente_nome, data_evento, ora_evento, persone, stato)
  values (v_ent, '__PROVA__cliente evento', (oggi_a_roma() + 30), '20:00', 8, 'inviato')
  returning id into v_prev;

  insert into preventivo_righe (preventivo_id, natura, recipe_id, porzioni_per_persona, posizione)
  values (v_prev, 'cibo', v_ric, 0.25, 0);

  -- Si accetta chiamando la funzione vera: e' anche la prova che la catena
  -- preventivo → prenotazione regge.
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select user_id from user_roles where role = 'titolare' limit 1),
                      'role', 'authenticated')::text, true);
  perform accetta_preventivo(v_prev);
  select reservation_id into v_res from preventivi where id = v_prev;
  if v_res is null then
    raise exception 'L''accettazione non ha collegato nessuna prenotazione: la catena si spezza qui.';
  end if;

  -- --- il conto della sera, agganciato a quella prenotazione ---------
  select id into v_tavolo from dining_tables where active limit 1;
  insert into orders (table_label, status, reservation_id)
  values ('__PROVA__evento', 'aperto', v_res)
  returning id into v_ordine;

  insert into order_items (order_id, recipe_id, quantity, unit_price, destination, sent_at)
  values (v_ordine, v_ric, 8, 30, 'cucina', now())
  returning id into v_item;

  -- --- 1) il fabbisogno usa le porzioni DELL'EVENTO ------------------
  select sum(quantita) into v_atteso from fabbisogno_conto(v_ordine) where ingredient_id = v_ing;
  v_carta := 8 * 0.100;   -- come sarebbe in carta
  if v_atteso is null then
    raise exception 'Il fabbisogno del conto dell''evento e'' vuoto.';
  end if;
  if abs(v_atteso - 0.200) > 0.0001 then
    raise exception 'Le porzioni dell''evento non sono arrivate allo scarico: atteso 0,200 kg, trovato %.', v_atteso;
  end if;
  if abs(v_atteso - v_carta) < 0.0001 then
    raise exception 'Il fabbisogno coincide con quello della carta: la prova non distingue niente.';
  end if;

  -- --- 2) e la RICETTA IN CARTA e'' intatta --------------------------
  select quantity into v_qta_carta from recipe_ingredients
   where recipe_id = v_ric and ingredient_id = v_ing;
  if abs(v_qta_carta - 0.100) > 0.000001 then
    raise exception 'La ricetta in carta e'' cambiata: era 0,100 e adesso e'' %.', v_qta_carta;
  end if;

  -- --- 3) lo scarico vero -------------------------------------------
  select quantity_remaining into v_prima from stock_lots where id = v_lotto;
  perform scarica_magazzino_conto(v_ordine);
  update orders set magazzino_scaricato_il = now() where id = v_ordine;
  select quantity_remaining into v_dopo from stock_lots where id = v_lotto;
  if abs((v_prima - v_dopo) - 0.200) > 0.0001 then
    raise exception 'Il magazzino e'' sceso di % invece che di 0,200 kg.', v_prima - v_dopo;
  end if;

  -- --- 4) un secondo scarico non tocca piu' niente -------------------
  perform scarica_magazzino_conto(v_ordine);
  select quantity_remaining into v_dopo2 from stock_lots where id = v_lotto;
  if v_dopo2 <> v_dopo then
    raise exception 'Il secondo scarico ha mosso la giacenza: da % a %.', v_dopo, v_dopo2;
  end if;

  -- --- 5) UNA SECONDA VERSIONE, e vince l'ultima ---------------------
  -- ⚠️ E' il caso che il mandato originale non nominava: fra l'accettazione
  -- e la sera le porzioni possono cambiare. Qui la seconda versione dimezza
  -- ancora (0,125), e il fabbisogno deve seguirla.
  insert into preventivi (entity_id, versione_di, cliente_nome, data_evento, ora_evento, persone, stato)
  values (v_ent, v_prev, '__PROVA__cliente evento', (oggi_a_roma() + 30), '20:00', 8, 'inviato')
  returning id into v_prev2;
  insert into preventivo_righe (preventivo_id, natura, recipe_id, porzioni_per_persona, posizione)
  values (v_prev2, 'cibo', v_ric, 0.125, 0);
  perform accetta_preventivo(v_prev2);

  if (select count(*) from preventivi
       where reservation_id = v_res and stato = 'accettato') < 2 then
    raise exception 'Attese due versioni accettate sulla stessa prenotazione: il caso da provare non si e'' formato.';
  end if;

  select sum(quantita) into v_atteso from fabbisogno_conto(v_ordine) where ingredient_id = v_ing;
  if abs(v_atteso - 0.100) > 0.0001 then
    raise exception 'Lo scarico non segue l''ULTIMA versione: atteso 0,100 kg, trovato %.', v_atteso;
  end if;

  -- --- pulizia, rimettendo e non solo cancellando --------------------
  delete from anomalie_scarico where order_id = v_ordine;
  delete from stock_consumptions where order_id = v_ordine;
  -- ⚠️ `vieta_modifica_riga_servita` impedisce di cancellare una riga
  -- gia' andata in cucina, ed e' una rete che deve restare in piedi: si
  -- spegne per la sola pulizia e si riaccende **controllando** di averlo
  -- fatto (lasciarla spenta vorrebbe dire che da domani in sala si
  -- possono cancellare comande gia' partite, in silenzio).
  -- ⚠️ E anche la lapide: `order_items` e' fra le 21 tabelle tracciate,
  -- quindi la riga cancellata qui lascerebbe una copia in
  -- `deleted_records` — un dato di prova dentro un registro esibibile
  -- che nessuno puo' ripulire dall'app (residuo del 19/08).
  alter table order_items disable trigger trg_riga_servita;
  alter table order_items disable trigger trg_log_delete;
  delete from order_items where order_id = v_ordine;
  alter table order_items enable trigger trg_riga_servita;
  alter table order_items enable trigger trg_log_delete;
  if not exists (
    select 1 from pg_trigger
     where tgname = 'trg_riga_servita'
       and tgrelid = 'order_items'::regclass
       and tgenabled <> 'D'
  ) then
    raise exception 'Il divieto di cancellare una riga servita e'' rimasto spento.';
  end if;
  if not exists (
    select 1 from pg_trigger
     where tgname = 'trg_log_delete'
       and tgrelid = 'order_items'::regclass
       and tgenabled <> 'D'
  ) then
    raise exception 'Il registro delle cancellazioni e'' rimasto spento su order_items.';
  end if;
  delete from orders where id = v_ordine;
  delete from preventivo_righe where preventivo_id in (v_prev, v_prev2);
  update preventivi set reservation_id = null where id in (v_prev, v_prev2);
  delete from preventivi where id in (v_prev2, v_prev);
  delete from giornate_sold_out where preventivo_id in (v_prev, v_prev2);
  delete from reservations where id = v_res;
  delete from stock_lots where id = v_lotto;
  delete from recipe_ingredients where recipe_id = v_ric;
  delete from recipes where id = v_ric;
  delete from ingredients where id = v_ing;

  select count(*) into v_lapidi_2 from deleted_records;
  if v_lapidi_2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.', v_lapidi_2 - v_lapidi;
  end if;

  raise notice 'La sera dell''evento: scaricate le porzioni concordate (0,200 invece di 0,800), ricetta in carta intatta, secondo scarico fermo, e la seconda versione comanda (0,100).';
end $$;

insert into applied_migrations (version, name)
values ('20260822000001', 'la_sera_dell_evento') on conflict (version) do nothing;
