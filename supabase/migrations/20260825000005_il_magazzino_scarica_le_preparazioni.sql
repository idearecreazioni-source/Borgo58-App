-- ============================================================================
-- IL MAGAZZINO SCARICA LE PREPARAZIONI, E UN CONTO CHIUSO DICE SEMPRE
-- LA STESSA COSA — 25/08/2026
-- ============================================================================
--
-- 🔴 LA META' CHE MANCAVA. La decisione del 14/08 dice: una preparazione
--    CHE HA LOTTI non si esplode piu' — si CONSUMA, col costo di quel
--    giorno. `fabbisogno_conto` faceva la prima meta' (smetteva di
--    esploderla) e non la seconda: la riga con `component_recipe_id`
--    veniva scartata dalla select finale (`where e.ingredient_id is not
--    null`), e quella parte del piatto non usciva da NESSUNA PARTE.
--
--    Misurato sul progetto di prova prima di scrivere una riga:
--      · 13.624 scarichi registrati, UNO SOLO su una preparazione
--        (fatto a mano da Alessio, non dal gestionale);
--      · 346 conti hanno scaricato magazzino, NESSUNO ha mai toccato
--        una preparazione;
--      · 14 preparazioni con 15,23 kg in giacenza che non scendono mai.
--
-- ⚠️ E LA MISURA HA CORRETTO LA DIAGNOSI SUL PASSATO. I 14 lotti di
--    preparazione sono stati ricevuti il 23/08 alle 10:28, cioe' DOPO
--    l'ultimo conto chiuso (10:02). Durante i due mesi di vita finta le
--    preparazioni non esistevano: quei 346 conti hanno esploso fino alla
--    materia prima, ed era la cosa giusta. Il difetto non ha mai morso
--    all'indietro — **e' armato in avanti**, dal primo conto nuovo che
--    contenga uno di quei quattordici semilavorati.
--
-- ✅ LA FORMA GIUSTA ESISTEVA GIA', in `fabbisogno_preparazione`: la CTE
--    «i semilavorati che ci sono davvero, presi come sono». Qui non si
--    inventa niente, si porta quella meta' dove mancava.
--
-- 🔴 IL SECONDO DIFETTO, NELLA STESSA RIGA. La condizione che decide
--    esplodi/consuma guardava `quantity_remaining > 0`, cioe' la giacenza
--    di ADESSO. Quindi lo stesso conto chiuso rispondeva diversamente a
--    distanza di settimane. Misurato su un conto vero (T6 del 31/07):
--    registrate allora **34 righe per 1,661**, ricalcolate oggi **43 per
--    1,620** — otto ingredienti diversi.
--
--    L'ancoraggio e' `stock_lots.received_at <= l'istante del conto`, e
--    non il residuo: `received_at` non cambia mai, il residuo cambia a
--    ogni servizio. Un lotto arrivato DOPO quel conto non poteva essere
--    usato in quel conto.
--
-- ⚠️ CONSEGUENZA DICHIARATA, perche' e' un cambiamento di comportamento
--    e non solo di stabilita': una preparazione prodotta e poi ESAURITA
--    non torna piu' a esplodersi nella materia prima — si consuma, e se
--    non basta lascia l'anomalia «giacenza insufficiente» che
--    `scarica_magazzino_conto` scrive gia'. E' piu' vero: scaricare
--    cipolla e sedano crudi vorrebbe dire che il cuoco ha rifatto il
--    soffritto al momento del piatto, e se poi lo registra davvero
--    quella materia prima esce due volte. Misurato: oggi i lotti di
--    preparazione esauriti sono **zero**, quindi sui dati esistenti
--    questo ramo non cambia niente.
--
-- ⚠️ LA CONDIZIONE VIVE IN UN POSTO SOLO (`preparazione_in_cella`) perche'
--    dentro la stessa query serve DUE volte — per fermare la ricorsione e
--    per scegliere i semilavorati. Se le due divergessero, quella parte
--    del piatto o sparirebbe (come oggi) o uscirebbe DUE volte, e nessun
--    errore lo direbbe.
--
-- ⚠️ E NON SI FONDE con la condizione di `fabbisogno_preparazione`, che
--    guarda il residuo di adesso. Col discriminante del 17/08: direbbero
--    *esattamente* la stessa cosa? No — una produzione avviene ADESSO
--    («ce n'e' in cella?»), un conto puo' essere di luglio («ce n'era
--    quella sera?»). Due domande diverse, due condizioni.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. La condizione, in un posto solo
-- ---------------------------------------------------------------------------
create or replace function preparazione_in_cella(
  p_recipe_id uuid,
  p_istante   timestamptz
)
returns uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select i.id
    from ingredients i
   where i.preparazione_id = p_recipe_id
     and exists (
       select 1 from stock_lots sl
        where sl.ingredient_id = i.id
          and sl.received_at <= p_istante
     )
   limit 1;
$fn$;

comment on function preparazione_in_cella(uuid, timestamptz) is
  'L''ingrediente-preparazione da consumare invece di esplodere la ricetta, oppure niente. Ancorata a QUANDO: un lotto arrivato dopo quel conto non poteva essere usato in quel conto, e il residuo di oggi non dice niente su una sera di luglio.';

-- Una funzione nuova nasce eseguibile da chiunque abbia la chiave pubblica.
-- Questa la chiamano solo funzioni `security definer`, che girano come
-- proprietarie: nessuno deve poterla chiamare da fuori.
revoke all on function preparazione_in_cella(uuid, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Il fabbisogno di un conto — corpo ripreso VIVO dal database,
--    con la seconda meta' e l'ancoraggio
-- ---------------------------------------------------------------------------
create or replace function fabbisogno_conto(p_order_id uuid)
returns table(order_item_id uuid, ingredient_id uuid, quantita numeric)
language sql
stable
security definer
set search_path = public
as $fn$
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
           oi.quantity::numeric * coalesce(pev.porzioni_per_persona, 1) as porzioni,
           -- 🔴 L'ISTANTE DEL CONTO, portato dentro la ricorsione invece
           -- che riletto: un conto aperto vive adesso, un conto chiuso
           -- vive nella sera in cui e' stato chiuso e non si muove piu'.
           coalesce(o.closed_at, now()) as istante
      from order_items oi
      join orders o on o.id = oi.order_id
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
           r.istante,
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
           e.istante,
           e.depth + 1
      from espansione e
      join recipes comp on comp.id = e.component_recipe_id
      join recipe_ingredients ri2 on ri2.recipe_id = e.component_recipe_id
     where e.component_recipe_id is not null
       and e.depth < 10
       -- L'interruttore del 14/08: una preparazione CHE HA LOTTI non si
       -- esplode piu', si consuma (sotto). Senza, servire un piatto
       -- scaricherebbe due volte le stesse verdure.
       and preparazione_in_cella(e.component_recipe_id, e.istante) is null
  ),
  -- a) la materia prima
  --    🔴 LA SOSTITUZIONE (24/08): dove il cameriere ha tolto un allergene
  --       da questa riga, dal magazzino esce il SOSTITUTO. E dove il
  --       sostituto non c'e' — «si toglie e basta» — non esce niente.
  materia as (
    select e.order_item_id,
           coalesce(s.sostituto_id, e.ingredient_id) as ingredient_id,
           sum(e.multiplier * (1 + coalesce(e.waste_percentage, i.waste_percentage_default, 0) / 100.0)) as quantita
      from espansione e
      join ingredients i on i.id = e.ingredient_id
      left join order_item_sostituzioni s
             on s.order_item_id = e.order_item_id
            and s.ingrediente_id = e.ingredient_id
     where e.ingredient_id is not null
       and not e.is_optional
       and not (s.id is not null and s.sostituto_id is null)
     group by e.order_item_id, coalesce(s.sostituto_id, e.ingredient_id)
  ),
  -- b) i semilavorati che c'erano davvero quella sera, presi come sono
  --    ⚠️ Nessuno scarto: un semilavorato in cella e' gia' pulito e gia'
  --       pesato — lo scarto e' stato pagato quando l'hanno prodotto.
  --       Stessa scelta di `fabbisogno_preparazione`.
  semilavorati as (
    select e.order_item_id,
           coalesce(s.sostituto_id, prep.id) as ingredient_id,
           sum(e.multiplier) as quantita
      from espansione e
      join lateral (
        select preparazione_in_cella(e.component_recipe_id, e.istante) as id
      ) prep on prep.id is not null
      left join order_item_sostituzioni s
             on s.order_item_id = e.order_item_id
            and s.ingrediente_id = prep.id
     where e.component_recipe_id is not null
       and not e.is_optional
       and e.multiplier is not null
       and not (s.id is not null and s.sostituto_id is null)
     group by e.order_item_id, coalesce(s.sostituto_id, prep.id)
  )
  select t.order_item_id, t.ingredient_id, sum(t.quantita)
    from (select * from materia union all select * from semilavorati) t
   group by t.order_item_id, t.ingredient_id;
$fn$;

comment on function fabbisogno_conto(uuid) is
  'Cosa esce dal magazzino per un conto: la materia prima delle ricette, e i semilavorati che erano in cella quella sera presi come sono. Le due meta'' sono decise dalla STESSA condizione (preparazione_in_cella): se divergessero, un pezzo del piatto sparirebbe o uscirebbe due volte.';

revoke all on function fabbisogno_conto(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. La verifica — con roba propria, e provando anche il contrario
-- ---------------------------------------------------------------------------
do $verifica$
declare
  v_ent         uuid;
  v_mp          uuid;   -- materia prima
  v_ric_prep    uuid;   -- la ricetta della preparazione
  v_ing_prep    uuid;   -- l'ingrediente-preparazione (dove stanno i lotti)
  v_ric_piatto  uuid;
  v_lotto_mp    uuid;
  v_lotto_prep  uuid;
  v_conto_a     uuid;   -- conto DOPO l'arrivo del lotto: deve consumare
  v_conto_b     uuid;   -- conto PRIMA dell'arrivo: deve esplodere
  v_riga_a      uuid;
  v_riga_b      uuid;
  v_prima       numeric;
  v_dopo        numeric;
  v_n           integer;
  v_lapidi_pre  integer;
  v_lapidi_post integer;
begin
  select count(*) into v_lapidi_pre from deleted_records;

  select id into v_ent from entities order by created_at limit 1;
  if v_ent is null then
    raise exception 'Nessuna entita'': la verifica non puo'' costruire niente';
  end if;

  -- La materia prima, con un lotto abbondante
  insert into ingredients (entity_id, name, category, unit, tenuto_in_magazzino)
  values (v_ent, 'ZZ prova cipolla', 'verdura', 'kg', true)
  returning id into v_mp;

  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at)
  values (v_mp, 100, 100, 2.00, now() - interval '60 days')
  returning id into v_lotto_mp;

  -- La preparazione: 1 kg per dose, 2 kg di cipolla dentro
  insert into recipes (name, category, recipe_type, portions_yield, yield_quantity, yield_unit)
  values ('ZZ prova soffritto', 'primo', 'preparazione', 1, 1.0, 'kg')
  returning id into v_ric_prep;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit, waste_percentage)
  values (v_ric_prep, v_mp, 2, 'kg', 0);

  insert into ingredients (entity_id, name, category, unit, tenuto_in_magazzino, preparazione_id)
  values (v_ent, 'ZZ prova soffritto', 'verdura', 'kg', true, v_ric_prep)
  returning id into v_ing_prep;

  -- Il piatto: 10 porzioni, 0,5 kg di soffritto in tutto -> 0,05 kg a porzione
  insert into recipes (name, category, recipe_type, portions_yield)
  values ('ZZ prova piatto', 'primo', 'piatto_finito', 10)
  returning id into v_ric_piatto;

  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
  values (v_ric_piatto, v_ric_prep, 0.5, 'kg');

  -- ------------------------------------------------------------------
  -- CASO 1 — il lotto della preparazione c'e' gia': si CONSUMA
  -- ------------------------------------------------------------------
  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at)
  values (v_ing_prep, 5, 5, 9.00, now() - interval '2 days')
  returning id into v_lotto_prep;

  -- ⚠️ Il conto nasce APERTO e si chiude dopo: un vincolo del database
  --    rifiuta le righe su un conto gia' chiuso, ed e' giusto che le
  --    rifiuti — «non si aggiungono piatti a un conto su cui hai gia'
  --    incassato». La verifica passa dalla porta da cui passa la sala.
  insert into orders (entity_id, table_label, status)
  values (v_ent, 'ZZ prova A', 'aperto')
  returning id into v_conto_a;

  insert into order_items (order_id, recipe_id, destination, quantity, unit_price, sent_at)
  values (v_conto_a, v_ric_piatto, 'cucina', 6, 12.00, now() - interval '1 day')
  returning id into v_riga_a;

  update orders set status = 'chiuso', closed_at = now() - interval '1 day'
   where id = v_conto_a;

  -- 6 porzioni su 10 -> 0,30 kg di soffritto, e NIENTE cipolla
  select count(*) into v_n
    from fabbisogno_conto(v_conto_a) f where f.ingredient_id = v_ing_prep;
  if v_n <> 1 then
    raise exception 'Il semilavorato non compare nel fabbisogno (righe: %)', v_n;
  end if;

  select f.quantita into v_prima
    from fabbisogno_conto(v_conto_a) f where f.ingredient_id = v_ing_prep;
  if round(v_prima, 4) <> 0.3000 then
    raise exception 'Quantita'' del semilavorato sbagliata: % invece di 0,3000', v_prima;
  end if;

  if exists (select 1 from fabbisogno_conto(v_conto_a) f where f.ingredient_id = v_mp) then
    raise exception 'La materia prima esce ANCHE quando il semilavorato c''e'': uscirebbe due volte';
  end if;

  -- Lo scarico vero: il lotto della preparazione deve scendere
  select quantity_remaining into v_prima from stock_lots where id = v_lotto_prep;
  perform scarica_magazzino_conto(v_conto_a);
  select quantity_remaining into v_dopo from stock_lots where id = v_lotto_prep;

  if round(v_prima - v_dopo, 4) <> 0.3000 then
    raise exception 'Il lotto della preparazione non e'' sceso di 0,3000: da % a %', v_prima, v_dopo;
  end if;

  if not exists (
    select 1 from stock_consumptions
     where order_id = v_conto_a and ingredient_id = v_ing_prep
  ) then
    raise exception 'Nessuno scarico registrato sulla preparazione';
  end if;

  -- E il costo e' quello del lotto, non quello di rifarla oggi
  select costo into v_dopo from stock_consumptions
   where order_id = v_conto_a and ingredient_id = v_ing_prep;
  if round(v_dopo, 2) <> 2.70 then
    raise exception 'Costo dello scarico sbagliato: % invece di 2,70 (0,3 kg a 9,00)', v_dopo;
  end if;

  -- ------------------------------------------------------------------
  -- CASO 2 — LO STESSO PIATTO IN UN CONTO PIU' VECCHIO DEL LOTTO.
  --    E' la prova del secondo difetto: un conto chiuso deve dire
  --    sempre la stessa cosa, e quella sera il soffritto non c'era.
  -- ------------------------------------------------------------------
  insert into orders (entity_id, table_label, status)
  values (v_ent, 'ZZ prova B', 'aperto')
  returning id into v_conto_b;

  insert into order_items (order_id, recipe_id, destination, quantity, unit_price, sent_at)
  values (v_conto_b, v_ric_piatto, 'cucina', 6, 12.00, now() - interval '30 days')
  returning id into v_riga_b;

  update orders set status = 'chiuso', closed_at = now() - interval '30 days'
   where id = v_conto_b;

  if exists (select 1 from fabbisogno_conto(v_conto_b) f where f.ingredient_id = v_ing_prep) then
    raise exception 'Un conto di trenta giorni fa consuma un lotto arrivato due giorni fa';
  end if;

  select f.quantita into v_prima
    from fabbisogno_conto(v_conto_b) f where f.ingredient_id = v_mp;
  if v_prima is null or round(v_prima, 4) <> 0.6000 then
    raise exception 'Il conto vecchio non esplode nella materia prima: % invece di 0,6000', v_prima;
  end if;

  -- ------------------------------------------------------------------
  -- Pulizia — solo cio' che questa verifica ha creato, per
  -- identificativo. `order_items` e' tracciata: il registro delle
  -- cancellazioni e' esibibile e non si sporca con roba di prova.
  -- ------------------------------------------------------------------
  --    ⚠️ E i due vincoli che proteggono un conto chiuso vanno spenti per
  --       poter portare via la roba di prova: proteggono il totale su cui
  --       si e' incassato, e hanno ragione a fermare chiunque — verifica
  --       compresa. Si spengono nominandoli, e si controlla dopo di
  --       averli riaccesi tutti e tre.
  alter table order_items disable trigger trg_log_delete;
  alter table order_items disable trigger trg_riga_servita;
  alter table order_items disable trigger trg_riga_su_conto_non_aperto;

  delete from stock_consumptions where order_id in (v_conto_a, v_conto_b);
  delete from anomalie_scarico    where order_id in (v_conto_a, v_conto_b);
  delete from order_items         where id in (v_riga_a, v_riga_b);
  delete from orders              where id in (v_conto_a, v_conto_b);
  delete from stock_lots          where id in (v_lotto_mp, v_lotto_prep);
  delete from recipe_ingredients  where recipe_id in (v_ric_prep, v_ric_piatto);
  delete from ingredients         where id = v_ing_prep;
  delete from recipes             where id in (v_ric_piatto, v_ric_prep);
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

  raise notice 'Il magazzino scarica le preparazioni: 0,300 kg di semilavorato scesi, costo 2,70, e un conto di trenta giorni fa continua a esplodere.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260825000005', 'il_magazzino_scarica_le_preparazioni')
on conflict (version) do nothing;
