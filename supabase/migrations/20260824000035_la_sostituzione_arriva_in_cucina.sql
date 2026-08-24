-- =====================================================================
-- LA SOSTITUZIONE ARRIVA IN CUCINA, SCARICA IL MAGAZZINO E VA SUL CONTO
-- 24/08/2026 — blocco 1 del mandato del collaudo, seconda parte
-- =====================================================================
-- La prima parte (20260824000034) ha messo nel Ricettario la dichiarazione:
-- questo allergene si puo' togliere, cosi', e costa tanto. Questa mette il
-- gesto in sala e le sue **tre conseguenze**, che sono la parte che Alessio
-- ha scritto per esteso perche' non bastasse la spunta:
--
--   1. la sostituzione arriva IN CUCINA sulla riga di quel piatto;
--   2. il MAGAZZINO scarica l'ingrediente sostituito, non l'originale;
--   3. il COSTO AGGIUNTIVO va sul conto, e il food cost del piatto in
--      carta resta pulito.
--
-- ---------------------------------------------------------------------
-- TUTTO SI FOTOGRAFA, COME IL PREZZO DI UNA RIGA
-- ---------------------------------------------------------------------
-- `order_item_sostituzioni` conserva il supplemento **e la frase** («burro
-- → burro senza lattosio»), non un rimando al Ricettario. Domani Alessio
-- puo' cambiare il supplemento o riscrivere la sostituzione: quel conto no.
-- E' lo stesso principio di `order_items.unit_price` e del costo congelato
-- sul lotto.
--
-- ⚠️ E LA FRASE SI COMPONE QUI, non nella schermata: in cucina, sul
-- preconto e sul conto la sostituzione si legge, e tre schermate che se la
-- ricostruiscono per conto proprio finiscono per dire tre cose diverse.
--
-- ---------------------------------------------------------------------
-- IL COSTO NON TOCCA `unit_price` — ed e' la richiesta di Alessio
-- ---------------------------------------------------------------------
-- *«il food cost del piatto in carta resta pulito — stessa logica del bis
-- dei finger»*. Se il supplemento entrasse dentro `unit_price`, il prezzo
-- di vendita di quel piatto in quel conto non sarebbe piu' il prezzo di
-- carta, e ogni statistica sullo scontrino medio del piatto direbbe un
-- numero inventato. Il supplemento e' quindi una colonna a se', sommata da
-- `totale_conto()` — che resta l'unico posto dove il conto si calcola.
--
-- ⚠️ E VA MOLTIPLICATO PER LA QUANTITA' DELLA RIGA: due porzioni senza
-- lattosio sono due sostituzioni, non una. La sostituzione vale per la riga
-- intera — non esiste «una delle due senza»: quella si batte come due righe.
--
-- ---------------------------------------------------------------------
-- QUANDO SI PUO' FARE
-- ---------------------------------------------------------------------
-- ⚠️ **ANCHE SU UNA RIGA GIA' ANDATA IN CUCINA**, finche' il conto e'
-- aperto — ed e' una scelta, non una dimenticanza: il caso vero e' il
-- cliente che lo dice dopo, e rifiutare qui vorrebbe dire annullare la riga
-- e ribatterla, cioe' un vicolo cieco travestito da regola. Il gestionale
-- lo registra e lo mostra; **avvisare la cucina a voce resta di chi e' in
-- sala**, perche' un biglietto gia' stampato nessun programma lo riscrive.
--
-- ⚠️ **MAI SU UN CONTO CHIUSO O ANNULLATO**, e a rifiutare e' un trigger:
-- e' lo stesso invariante di `vieta_modifica_riga_servita` — il totale su
-- cui si e' incassato non deve cambiare dopo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Cosa e' stato tolto da questa riga
-- ---------------------------------------------------------------------
create table if not exists order_item_sostituzioni (
  id               uuid primary key default gen_random_uuid(),
  order_item_id    uuid not null references order_items(id) on delete cascade,
  allergene        allergen not null,
  ingrediente_id   uuid not null references ingredients(id) on delete restrict,
  sostituto_id     uuid references ingredients(id) on delete restrict,
  costo_aggiuntivo numeric(12,2) not null default 0,
  descrizione      text not null,
  creato_il        timestamptz not null default now(),
  constraint order_item_sostituzione_unica unique (order_item_id, allergene, ingrediente_id),
  constraint order_item_sostituzione_costo_sensato check (costo_aggiuntivo >= 0 and costo_aggiuntivo <= 50)
);

comment on table order_item_sostituzioni is
  'Le sostituzioni applicate a una riga di comanda: fotografate al momento del gesto — supplemento e frase leggibile — perche'' un conto non deve cambiare quando cambia il Ricettario.';
comment on constraint order_item_sostituzione_costo_sensato on order_item_sostituzioni is
  'Il supplemento di una sostituzione va da 0 a 50 euro: sopra i 50 non e'' un supplemento, e'' una virgola sbagliata su un conto vero.';

create index if not exists idx_order_item_sostituzioni_riga
  on order_item_sostituzioni (order_item_id);

-- ---------------------------------------------------------------------
-- 2 · Su un conto chiuso non si tocca piu' niente
-- ---------------------------------------------------------------------
create or replace function public.vieta_sostituzione_a_conto_chiuso()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_riga  uuid;
  v_stato text;
begin
  v_riga := coalesce(new.order_item_id, old.order_item_id);
  select o.status into v_stato
    from order_items oi join orders o on o.id = oi.order_id
   where oi.id = v_riga;

  if v_stato is distinct from 'aperto' then
    raise exception
      'Questo conto non e'' piu'' aperto: le sostituzioni non si toccano dopo. Il totale su cui si e'' incassato non deve cambiare.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

drop trigger if exists trg_vieta_sostituzione_a_conto_chiuso on order_item_sostituzioni;
create trigger trg_vieta_sostituzione_a_conto_chiuso
  before insert or update or delete on order_item_sostituzioni
  for each row execute function vieta_sostituzione_a_conto_chiuso();

-- ---------------------------------------------------------------------
-- 3 · I permessi
-- ---------------------------------------------------------------------
-- La sala scrive e legge: e' un gesto del servizio, non una decisione del
-- titolare. Il supplemento e' un prezzo di VENDITA, non un costo d'acquisto:
-- chi batte il conto lo vede gia' su ogni riga.
alter table order_item_sostituzioni enable row level security;

drop policy if exists order_item_sostituzioni_lettura on order_item_sostituzioni;
create policy order_item_sostituzioni_lettura on order_item_sostituzioni
  for select to authenticated using (true);

drop policy if exists order_item_sostituzioni_scrittura on order_item_sostituzioni;
create policy order_item_sostituzioni_scrittura on order_item_sostituzioni
  for insert to authenticated with check (true);

drop policy if exists order_item_sostituzioni_cancellazione on order_item_sostituzioni;
create policy order_item_sostituzioni_cancellazione on order_item_sostituzioni
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------
-- 4 · Cosa vede il cameriere sulla riga
-- ---------------------------------------------------------------------
-- ⚠️ UNA CHIAMATA SOLA PER RIGA, e restituisce **tutti** gli allergeni del
-- piatto — anche quelli che non si possono togliere. E' la richiesta di
-- Alessio, ed e' la parte che protegge il cliente: *«quelli non eliminabili
-- si vedono ma sono SPENTI — il cameriere sa che deve avvisare il cliente
-- invece di promettere qualcosa che non possiamo fare»*. Nasconderli
-- lascerebbe credere che il piatto quell'allergene non ce l'abbia.
create or replace function public.allergeni_della_riga(p_order_item_id uuid)
returns table(
  allergene        allergen,
  eliminabile      boolean,
  applicata        boolean,
  costo_aggiuntivo numeric,
  descrizione      text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_recipe uuid;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select oi.recipe_id into v_recipe from order_items oi where oi.id = p_order_item_id;
  if v_recipe is null then return; end if;

  return query
  select
    ap.allergene,
    ap.stato = 'eliminabile',
    exists (select 1 from order_item_sostituzioni os
             where os.order_item_id = p_order_item_id and os.allergene = ap.allergene),
    ap.costo_aggiuntivo,
    -- La frase che si vede prima di toccare: quella applicata la si rilegge
    -- fotografata, quella ancora da fare si compone dal Ricettario.
    coalesce(
      (select string_agg(os.descrizione, ' · ' order by os.descrizione)
         from order_item_sostituzioni os
        where os.order_item_id = p_order_item_id and os.allergene = ap.allergene),
      (select string_agg(
                x.nome || case when x.sostituto is null then ' (si toglie)' else ' → ' || x.sostituto end,
                ' · ' order by x.nome)
         from ingredienti_con_allergene(v_recipe, ap.allergene) x
        where x.coperto)
    )
  from allergeni_del_piatto(v_recipe) ap
  order by 1;
end;
$function$;

comment on function public.allergeni_della_riga(uuid) is
  'Gli allergeni del piatto di questa riga di comanda: quali si possono togliere, quali sono gia'' stati tolti, quanto costa. Gli altri restano in elenco, spenti: il cameriere deve sapere che ci sono.';

revoke all on function public.allergeni_della_riga(uuid) from public, anon, authenticated;
grant execute on function public.allergeni_della_riga(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5 · Il gesto: togliere un allergene da una riga
-- ---------------------------------------------------------------------
-- ⚠️ IL PREZZO NON ARRIVA DAL TABLET: la funzione lo legge dal Ricettario.
-- Se lo passasse la schermata, un supplemento sbagliato entrerebbe sul conto
-- di un cliente senza che nessun vincolo se ne accorga.
--
-- ⚠️ E SCRIVE N RIGHE IN UNA VOLTA SOLA: un allergene puo' arrivare da piu'
-- ingredienti, e a meta' resterebbe un piatto che dichiara «senza lattosio»
-- con dentro ancora la panna. Corridoio (B4), anche se la tabella e' una.
create or replace function public.applica_sostituzione_riga(
  p_order_item_id uuid,
  p_allergene     allergen
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_recipe   uuid;
  v_stato    text;
  v_piatto   text;
  v_quante   integer;
  v_costo    numeric;
  v_scoperti text[];
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select oi.recipe_id, r.name into v_recipe, v_piatto
    from order_items oi
    left join recipes r on r.id = oi.recipe_id
   where oi.id = p_order_item_id;

  if v_recipe is null then
    raise exception 'Questa riga non e'' un piatto del ricettario: non c''e'' nessun allergene da togliere.';
  end if;

  select case when sc.eliminabile then 'eliminabile' else 'non_eliminabile' end
    into v_stato
    from scelte_allergene sc
   where sc.recipe_id = v_recipe and sc.allergene = p_allergene;

  if v_stato is null then
    raise exception
      'Su «%» nessuno ha ancora dichiarato se questo allergene si puo'' togliere. Va deciso nel Ricettario, sulla scheda del piatto.',
      coalesce(v_piatto, 'questo piatto');
  end if;
  if v_stato = 'non_eliminabile' then
    raise exception
      'Su «%» questo allergene non si puo'' togliere: va detto al cliente, non promesso.',
      coalesce(v_piatto, 'questo piatto');
  end if;

  -- ⚠️ Doppio controllo voluto: fra la dichiarazione e adesso qualcuno puo'
  --    aver aggiunto un ingrediente al piatto. Il trigger del Ricettario
  --    guarda il momento in cui si dichiara; qui si guarda il momento in cui
  --    si promette a un cliente.
  select array_agg(x.nome order by x.nome) into v_scoperti
    from ingredienti_con_allergene(v_recipe, p_allergene) x
   where not x.coperto;
  if v_scoperti is not null and cardinality(v_scoperti) > 0 then
    raise exception
      'Su «%» questo allergene arriva ancora da % e non c''e'' una sostituzione: non si puo'' promettere al cliente.',
      coalesce(v_piatto, 'questo piatto'), array_to_string(v_scoperti, ', ');
  end if;

  insert into order_item_sostituzioni
    (order_item_id, allergene, ingrediente_id, sostituto_id, costo_aggiuntivo, descrizione)
  select p_order_item_id,
         p_allergene,
         s.ingrediente_id,
         s.sostituto_id,
         s.costo_aggiuntivo,
         i1.name || case when i2.name is null then ' (si toglie)' else ' → ' || i2.name end
    from sostituzioni_allergene s
    join ingredients i1 on i1.id = s.ingrediente_id
    left join ingredients i2 on i2.id = s.sostituto_id
   where s.recipe_id = v_recipe and s.allergene = p_allergene
  on conflict (order_item_id, allergene, ingrediente_id) do nothing;

  select count(*), coalesce(sum(os.costo_aggiuntivo), 0) into v_quante, v_costo
    from order_item_sostituzioni os
   where os.order_item_id = p_order_item_id and os.allergene = p_allergene;

  return jsonb_build_object('sostituzioni', v_quante, 'costo_aggiuntivo', v_costo);
end;
$function$;

comment on function public.applica_sostituzione_riga(uuid, allergen) is
  'Toglie un allergene da una riga di comanda: fotografa le sostituzioni e il supplemento presi dal Ricettario. Rifiuta se nessuno ha dichiarato che si puo'' fare.';

revoke all on function public.applica_sostituzione_riga(uuid, allergen) from public, anon, authenticated;
grant execute on function public.applica_sostituzione_riga(uuid, allergen) to authenticated;

create or replace function public.togli_sostituzione_riga(
  p_order_item_id uuid,
  p_allergene     allergen
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare v_quante integer;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  delete from order_item_sostituzioni os
   where os.order_item_id = p_order_item_id and os.allergene = p_allergene;
  get diagnostics v_quante = row_count;

  return jsonb_build_object('tolte', v_quante);
end;
$function$;

comment on function public.togli_sostituzione_riga(uuid, allergen) is
  'Rimette l''allergene: il piatto torna com''e'' in carta e il supplemento sparisce dal conto.';

revoke all on function public.togli_sostituzione_riga(uuid, allergen) from public, anon, authenticated;
grant execute on function public.togli_sostituzione_riga(uuid, allergen) to authenticated;

-- ---------------------------------------------------------------------
-- 6 · Il magazzino scarica quello che e' uscito davvero
-- ---------------------------------------------------------------------
-- ⚠️ IL CORPO E' QUELLO VIVO DEL DATABASE, letto adesso e non ricopiato dal
-- file che l'ha creata: fra i due ci stanno tutte le migrazioni che l'hanno
-- toccata, e questo progetto ci e' gia' caduto cinque volte. Cambia SOLO la
-- select finale.
--
-- ⚠️ LA PERCENTUALE DI SCARTO RESTA QUELLA DELL'INGREDIENTE ORIGINALE: la
-- quantita' scritta in ricetta parla di lui, e il sostituto entra al suo
-- posto per la stessa quantita' pulita.
create or replace function public.fabbisogno_conto(p_order_id uuid)
returns table(order_item_id uuid, ingredient_id uuid, quantita numeric)
language sql
stable
security definer
set search_path to 'public'
as $function$
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
  -- 🔴 LA SOSTITUZIONE (24/08): dove il cameriere ha tolto un allergene da
  --    questa riga, dal magazzino esce il SOSTITUTO. E dove il sostituto non
  --    c'e' — «si toglie e basta» — non esce niente.
  select e.order_item_id,
         coalesce(s.sostituto_id, e.ingredient_id),
         sum(e.multiplier * (1 + coalesce(e.waste_percentage, i.waste_percentage_default, 0) / 100.0))
    from espansione e
    join ingredients i on i.id = e.ingredient_id
    left join order_item_sostituzioni s
           on s.order_item_id = e.order_item_id
          and s.ingrediente_id = e.ingredient_id
   where e.ingredient_id is not null
     and not e.is_optional
     and not (s.id is not null and s.sostituto_id is null)
   group by e.order_item_id, coalesce(s.sostituto_id, e.ingredient_id);
$function$;

revoke all on function public.fabbisogno_conto(uuid) from public, anon, authenticated;
grant execute on function public.fabbisogno_conto(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7 · Il supplemento sul conto
-- ---------------------------------------------------------------------
-- ⚠️ CORPO VIVO, cambia solo la somma delle righe. E il supplemento segue le
-- stesse due regole del resto: entra solo se la riga e' stata mandata in
-- cucina, e viene moltiplicato per la quantita'.
--
-- ⚠️ SI CANCELLA E SI RICREA, perche' la colonna in piu' cambia il tipo di
-- ritorno e `create or replace` lo rifiuta. Dopo un `drop` i permessi
-- tornano aperti al mondo: il `revoke`/`grant` qui sotto non e' un di piu',
-- e la prova sui permessi diventerebbe rossa se mancasse.
drop function if exists public.totale_conto(uuid);

create or replace function public.totale_conto(p_order_id uuid)
returns table(
  righe             numeric,
  coperti           integer,
  prezzo_coperto    numeric,
  totale            numeric,
  righe_mai_inviate integer,
  valore_mai_inviate numeric,
  supplementi       numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_order  orders%rowtype;
  v_righe  numeric;
  v_supp   numeric;
  v_prezzo numeric;
  v_n      integer;
  v_val    numeric;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Conto non trovato';
  end if;

  v_prezzo := coalesce(
    v_order.coperto_unit_price,
    (select coperto_price from service_settings where id = 1),
    0
  );

  -- ⚠️ `sent_at is not null`: una riga scritta e mai mandata in cucina non
  -- e' un piatto servito. Deciso da Alessio (Blocco 4.2 del mandato).
  select coalesce(sum(quantity * unit_price), 0) into v_righe
    from order_items
   where order_id = p_order_id and voided_at is null and sent_at is not null;

  -- 🔴 I SUPPLEMENTI DELLE SOSTITUZIONI (24/08): stanno FUORI da
  --    `unit_price` apposta, cosi' il prezzo di carta del piatto resta
  --    quello — e' la richiesta di Alessio sul food cost pulito. Ma sul
  --    conto ci vanno, altrimenti il locale regala una cosa che costa.
  select coalesce(sum(os.costo_aggiuntivo * oi.quantity), 0) into v_supp
    from order_item_sostituzioni os
    join order_items oi on oi.id = os.order_item_id
   where oi.order_id = p_order_id and oi.voided_at is null and oi.sent_at is not null;

  -- ⚠️ E il buco si DICHIARA insieme al numero, non si lascia dedurre:
  -- una riga che sparisce dal conto senza una frase e' indistinguibile da
  -- un piatto dimenticato. Stessa forma dell'avvertenza di calcola_imposte().
  select count(*), coalesce(sum(quantity * unit_price), 0) into v_n, v_val
    from order_items
   where order_id = p_order_id and voided_at is null and sent_at is null;

  return query select
    v_righe + v_supp,
    coalesce(v_order.coperti, 0),
    v_prezzo,
    v_righe + v_supp + coalesce(v_order.coperti, 0) * v_prezzo,
    v_n,
    v_val,
    v_supp;
end;
$function$;

revoke all on function public.totale_conto(uuid) from public, anon, authenticated;
grant execute on function public.totale_conto(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_lapidi   integer;
  v_lapidi2  integer;
  v_entita   uuid;
  v_burro    uuid;
  v_senza    uuid;
  v_panna    uuid;
  v_piatto   uuid;
  v_conto    uuid;
  v_riga     uuid;
  v_tavolo   uuid;
  v_n        integer;
  v_q        numeric;
  v_msg      text;
  r          record;
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_entita from entities limit 1;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- Perimetro tutto proprio: ingredienti, piatto, conto.
  insert into ingredients (entity_id, name, category, unit, allergens, current_price)
  values (v_entita, '__VERIFICA__ burro', 'latticini', 'kg', array['latte']::allergen[], 10)
  returning id into v_burro;
  insert into ingredients (entity_id, name, category, unit, allergens, current_price)
  values (v_entita, '__VERIFICA__ burro senza lattosio', 'latticini', 'kg', '{}'::allergen[], 14)
  returning id into v_senza;
  -- ⚠️ IL SECONDO PORTATORE DELLO STESSO ALLERGENE: senza, la prova non
  --    distinguerebbe «coperto» da «tutti coperti».
  insert into ingredients (entity_id, name, category, unit, allergens, current_price)
  values (v_entita, '__VERIFICA__ panna', 'latticini', 'kg', array['latte']::allergen[], 8)
  returning id into v_panna;

  insert into recipes (name, category, recipe_type, portions_yield)
  values ('__VERIFICA__ piatto in cucina', 'primo', 'piatto_finito', 1)
  returning id into v_piatto;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_piatto, v_burro, 0.05, 'kg'), (v_piatto, v_panna, 0.10, 'kg');

  select id into v_tavolo from dining_tables limit 1;
  insert into orders (table_label, status, coperti, entity_id)
  values ('__VERIFICA__ sostituzioni', 'aperto', 2, v_entita)
  returning id into v_conto;

  -- ⚠️ DUE PORZIONI, non una: con una sola, «supplemento per riga» e
  --    «supplemento per porzione» darebbero lo stesso numero e la prova non
  --    misurerebbe niente.
  insert into order_items (order_id, recipe_id, destination, quantity, unit_price, sent_at)
  values (v_conto, v_piatto, 'cucina', 2, 20.00, now())
  returning id into v_riga;

  -- (a) SENZA DICHIARAZIONE il gesto e' respinto, e lo dice.
  begin
    perform applica_sostituzione_riga(v_riga, 'latte');
    raise exception 'La sostituzione e'' passata senza nessuna dichiarazione nel Ricettario.';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%nessuno ha ancora dichiarato%' then
      raise exception 'Il rifiuto non spiega il terzo stato: «%».', v_msg;
    end if;
  end;

  -- (b) DICHIARATO NON ELIMINABILE: respinto con l'altra frase.
  insert into scelte_allergene (recipe_id, allergene, eliminabile)
  values (v_piatto, 'latte', false);
  begin
    perform applica_sostituzione_riga(v_riga, 'latte');
    raise exception 'La sostituzione e'' passata su un allergene dichiarato non eliminabile.';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%non si puo'' togliere%' then
      raise exception 'Il rifiuto non e'' quello giusto: «%».', v_msg;
    end if;
  end;

  -- (c) COPERTURA COMPLETA E DICHIARAZIONE: adesso si fa.
  insert into sostituzioni_allergene (recipe_id, allergene, ingrediente_id, sostituto_id, costo_aggiuntivo)
  values (v_piatto, 'latte', v_burro, v_senza, 1.00),
         (v_piatto, 'latte', v_panna, null,   0.50);
  update scelte_allergene set eliminabile = true
   where recipe_id = v_piatto and allergene = 'latte';

  perform applica_sostituzione_riga(v_riga, 'latte');

  select count(*) into v_n from order_item_sostituzioni where order_item_id = v_riga;
  if v_n <> 2 then
    raise exception 'Le sostituzioni scritte sulla riga dovrebbero essere 2, sono %.', v_n;
  end if;

  -- (d) LA FRASE PER LA CUCINA e' fotografata e nomina i due ingredienti.
  select string_agg(os.descrizione, ' · ' order by os.descrizione) into v_msg
    from order_item_sostituzioni os where os.order_item_id = v_riga;
  if v_msg not like '%burro senza lattosio%' or v_msg not like '%si toglie%' then
    raise exception 'La frase per la cucina non dice cosa si fa: «%».', v_msg;
  end if;

  -- (e) IL CONTO: 2 x 20,00 = 40,00 di righe, piu' 2 x 1,50 di supplementi.
  --     ⚠️ Il 3,00 e' il numero che distingue le due risposte sbagliate
  --     possibili (1,50 se il supplemento non seguisse la quantita'; 0 se
  --     non entrasse affatto).
  select * into r from totale_conto(v_conto);
  if r.supplementi <> 3.00 then
    raise exception 'I supplementi dovrebbero essere 2 x (1,00 + 0,50) = 3,00: sono %.', r.supplementi;
  end if;
  if r.righe <> 43.00 then
    raise exception 'Le righe con supplemento dovrebbero fare 43,00: fanno %.', r.righe;
  end if;

  -- (f) IL MAGAZZINO: esce il burro SENZA lattosio, non il burro; e la panna
  --     non esce affatto.
  select count(*) into v_n from fabbisogno_conto(v_conto) f where f.ingredient_id = v_burro;
  if v_n <> 0 then
    raise exception 'Il burro con lattosio risulta ancora fra gli scarichi: la sostituzione non arriva al magazzino.';
  end if;
  select count(*) into v_n from fabbisogno_conto(v_conto) f where f.ingredient_id = v_panna;
  if v_n <> 0 then
    raise exception 'La panna risulta ancora fra gli scarichi, ma era stata tolta senza sostituto.';
  end if;
  select f.quantita into v_q from fabbisogno_conto(v_conto) f where f.ingredient_id = v_senza;
  if v_q is null then
    raise exception 'Il burro senza lattosio non risulta fra gli scarichi.';
  end if;
  if round(v_q, 4) <> 0.1000 then
    raise exception 'Dal burro senza lattosio dovrebbero uscire 2 x 0,05 = 0,1000 kg: escono %.', round(v_q, 4);
  end if;

  -- (g) SI TORNA INDIETRO: tolta la sostituzione, tutto com'era.
  perform togli_sostituzione_riga(v_riga, 'latte');
  select * into r from totale_conto(v_conto);
  if r.supplementi <> 0 then
    raise exception 'Tolta la sostituzione, i supplementi dovrebbero essere zero: sono %.', r.supplementi;
  end if;
  select f.quantita into v_q from fabbisogno_conto(v_conto) f where f.ingredient_id = v_burro;
  if v_q is null then
    raise exception 'Tolta la sostituzione, il burro dovrebbe tornare fra gli scarichi.';
  end if;

  -- (h) SU UN CONTO CHIUSO NON SI TOCCA PIU' NIENTE.
  perform applica_sostituzione_riga(v_riga, 'latte');
  update orders set status = 'chiuso', closed_at = now() where id = v_conto;
  begin
    perform togli_sostituzione_riga(v_riga, 'latte');
    raise exception 'Su un conto chiuso la sostituzione si e'' potuta togliere: il totale incassato puo'' cambiare dopo.';
  exception when sqlstate 'P0001' then
    null;
  end;
  update orders set status = 'aperto', closed_at = null where id = v_conto;

  -- Pulizia: solo la roba di questa verifica, nell'ordine delle chiavi.
  -- ⚠️ I guardiani si spengono per il tempo della pulizia — una riga gia'
  --    andata in cucina non si cancella, ed e' giusto cosi' — e la
  --    riaccensione si CONTROLLA: lasciarne uno spento vorrebbe dire che in
  --    sala si cancellerebbe cio' che va stornato.
  alter table order_items disable trigger trg_riga_servita;
  alter table order_items disable trigger trg_log_delete;

  delete from order_item_sostituzioni where order_item_id = v_riga;
  delete from order_items where order_id = v_conto;
  delete from orders where id = v_conto;

  alter table order_items enable trigger trg_riga_servita;
  alter table order_items enable trigger trg_log_delete;
  if (select count(*) from pg_trigger
       where tgrelid = 'order_items'::regclass and tgenabled = 'D') > 0 then
    raise exception 'Un guardiano delle righe e'' rimasto spento.';
  end if;

  delete from scelte_allergene where recipe_id = v_piatto;
  delete from sostituzioni_allergene where recipe_id = v_piatto;
  delete from recipe_ingredients where recipe_id = v_piatto;
  delete from recipes where id = v_piatto;
  delete from ingredients where id in (v_burro, v_senza, v_panna);

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'La sostituzione arriva in cucina, scarica il sostituto e va sul conto.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000035', 'la_sostituzione_arriva_in_cucina') on conflict (version) do nothing;
