-- =====================================================================
-- LO STORICO DEI COSTI — blocco 3 del mandato dei finger food
-- 20/08/2026
-- =====================================================================
-- Mandato: docs/mandati/20260819_i_finger_food_e_lo_storico_dei_costi.md
--
-- Idea di Alessio: *«se a ottobre il food cost della pasta alla Norma e' 3 €
-- e a novembre sale il prezzo delle melanzane, il registro deve poterci
-- comunicare che il piatto a ottobre ci costava 3 € e a novembre 3,50. Che
-- senso avrebbe applicare un food cost da 6 € a un piatto che invece costava
-- 5?»*
--
-- 🔴 IL COSTO PASSATO NON SI RICOSTRUISCE: SI REGISTRA QUANDO CAMBIA. La
-- differenza non e' di comodita'. Ricostruirlo vorrebbe dire rifare a
-- ritroso il calcolo con i prezzi di allora — e i prezzi di allora esistono
-- solo per gli ingredienti *comprati*: un ingrediente inserito a mano e mai
-- acquistato non ha nessun prezzo a una data passata, quindi la
-- ricostruzione darebbe un numero **inventato con l'aria di essere vero**.
--
-- 🔴 LA STORIA LA SCRIVE IL DATABASE, NON LE SCHERMATE (condizione (a) del
-- mandato). Il costo cambia per piu' strade, e se a registrare fossero le
-- schermate prima o poi una si dimenticherebbe: il registro sembrerebbe
-- completo e ne salterebbe un pezzo. E' la famiglia dei 33 posti silenziosi.
--
-- 🔴 E LE STRADE SONO SEI, NON QUATTRO — misurato guardando il calcolo, non
-- dedotto. Il mandato ne nominava quattro (prezzo, composizione, quantita',
-- scarto); il calcolo del costo ne usa altre due:
--   · la **RESA** di una preparazione (`recipes.yield_quantity`): il costo
--     del componente si divide per la resa, quindi cambiarla cambia il costo
--     di **tutto cio' che la usa** — e non della preparazione stessa;
--   · le **PORZIONI** (`recipes.portions_yield`): non cambiano il costo
--     della ricetta base, cambiano il costo **per porzione**, che e' il
--     numero con cui Alessio decide i prezzi del menu.
-- ⚠️ Se ne fossero state coperte quattro, il registro avrebbe avuto due
-- buchi silenziosi proprio della forma che questo blocco esiste per evitare.
--
-- 🔴 LA MISURA DELLA CONDIZIONE (b), fatta PRIMA di scegliere come scrivere.
-- Il Ricettario vero e' vuoto (0 ricette), quindi la misura e' stata fatta
-- costruendo sul progetto di prova un albero della profondita' che Alessio
-- descrive (ingrediente -> preparazione -> preparazione -> piatto ->
-- selezione) e della taglia che ha annunciato: 60 ingredienti, 20
-- preparazioni su due livelli, 40 piatti, 12 finger, 4 selezioni = **76
-- ricette**. Poi si sono cambiati 20 prezzi, cioe' una fattura da 20 righe:
--   · ricette il cui costo cambia: **51 su 76**;
--   · coppie (ricetta, ingrediente cambiato): **233**;
--   · se cambiassero tutti e 60 i prezzi insieme: **76 su 76**.
-- ⚠️ **Niente migliaia di righe**: il ventaglio e' limitato dal NUMERO DI
-- RICETTE, non dal prodotto delle due cose. Con due fatture a settimana si
-- sta sotto le 25.000 voci l'anno nel caso peggiore. Il disegno non cambia.
-- ⚠️ Ma la misura decide **la grana**: una voce per (ricetta, causa), non
-- una per ricetta per fattura. Costa 4,5 volte tanto ed e' il numero giusto,
-- perche' ogni voce porta **una** ragione — che e' precisamente quello che
-- Alessio ha chiesto: sapere PERCHE' un piatto costa di piu'.
--
-- ⚠️ SOLO I CAMBIAMENTI VERI: se il costo non si muove, non si scrive
-- niente. E' la riga che distingue «registra i cambiamenti» da «registra i
-- salvataggi»: senza, il registro si riempie di righe identiche e la domanda
-- «quanto costava a ottobre» affoga.
--
-- 🔴 IL COSTO NON CALCOLABILE SI DICE. `ingredients.current_price` e'
-- `not null default 0`, quindi un ingrediente mai comprato **vale zero** e
-- oggi abbassa in silenzio il food cost di ogni ricetta che lo usa: zero non
-- vuol dire «gratis», vuol dire «non l'ho ancora comprato». Non si tocca
-- quella colonna qui (sarebbe una decisione di Alessio su tutto il
-- gestionale), ma **ogni voce di storia dichiara quante righe erano senza
-- prezzo**, e chi legge sa se quel numero e' un costo o una parte di costo.
-- Misurato in produzione il 20/08: 0 ingredienti su 8 sono a zero, quindi il
-- difetto e' armato e non ancora vivo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- IL REGISTRO
-- ---------------------------------------------------------------------
create table if not exists storico_costi_ricetta (
  id                 uuid primary key default gen_random_uuid(),
  -- 🔴 IL PROGRESSIVO NON E' UNA COMODITA': E' LA CURA DI UN DIFETTO
  -- TROVATO APPLICANDO. Dentro una transazione l'ora di now() e' UN
  -- ISTANTE SOLO (misurato: now() non avanza, clock_timestamp() si'), e il
  -- carico di una fattura e' una transazione sola: tutte le voci di quella
  -- fattura avrebbero avuto la STESSA ora. Cercare «l'ultima voce»
  -- ordinando per ora e poi per `id` — che e' casuale — ne avrebbe scelta
  -- una a caso, e la regola «scrivi solo se e' cambiato» avrebbe scritto o
  -- saltato a caso. E' la trappola del 16/08 («una riga appena scritta si
  -- riconosce dalla sua firma, non dalla sua posizione in un ordinamento
  -- temporale»), ricomparsa qui.
  progressivo        bigint generated always as identity,
  recipe_id          uuid not null references recipes(id) on delete cascade,
  -- ⚠️ clock_timestamp() e non now(), per la stessa ragione: due voci
  -- della stessa fattura sono due fatti in due momenti, non uno.
  rilevato_il        timestamptz not null default clock_timestamp(),
  food_cost_base     numeric(14,4) not null,
  food_cost_portion  numeric(14,4),
  causa              text not null,
  dettaglio          text not null,
  righe_senza_prezzo integer not null default 0,
  constraint storico_causa_ammessa check (
    causa in ('prezzo', 'composizione', 'quantita', 'scarto', 'resa', 'porzioni')
  )
);

comment on table storico_costi_ricetta is
  'Quanto costava una ricetta, registrato OGNI VOLTA CHE CAMBIA e mai ricostruito a posteriori (20/08/2026, idea di Alessio). Lo scrivono solo i trigger, mai l''applicazione. ⚠️ `righe_senza_prezzo` maggiore di zero vuol dire che il costo e'' PARZIALE: un ingrediente mai comprato vale zero e non si distingue da uno gratis.';
comment on column storico_costi_ricetta.causa is
  'Perche'' e'' cambiato: prezzo · composizione · quantita · scarto · resa · porzioni. Le ultime due non erano nel mandato e sono uscite misurando il calcolo del costo.';
comment on column storico_costi_ricetta.dettaglio is
  'La ragione in parole leggibili («e'' salita la melanzana: 2,00 → 2,50 al kg»). Ad Alessio serve sapere PERCHE'' un piatto costa di piu'', non solo che costa di piu''.';

create index if not exists idx_storico_costi_ricetta_data
  on storico_costi_ricetta (recipe_id, progressivo desc);

alter table storico_costi_ricetta enable row level security;

-- ⚠️ SOLA LETTURA, E SOLO AL TITOLARE: dentro ci sono i costi. Nessuna
-- policy di scrittura, per nessuno: le voci le scrivono i trigger, che sono
-- `security definer` e non passano dalla RLS. Un registro che qualcuno puo''
-- riscrivere non e'' un registro.
drop policy if exists storico_costi_select_titolare on storico_costi_ricetta;
create policy storico_costi_select_titolare on storico_costi_ricetta
  for select to authenticated using ((select is_titolare()));


-- ---------------------------------------------------------------------
-- CHI VIENE TOCCATO — la catena, in su
-- ---------------------------------------------------------------------
-- ⚠️ Si sale, non si scende: cambiato il prezzo di un ingrediente, cambia il
-- costo di ogni ricetta che lo contiene **e di ogni ricetta che contiene
-- quella**, fino in cima. E' la catena a quattro livelli del mandato, ed e'
-- il punto dove questo genere di lavoro si rompe.
create or replace function ricette_toccate_da_ingrediente(p_ingredient_id uuid)
returns table(recipe_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with recursive su as (
    select ri.recipe_id
      from recipe_ingredients ri
     where ri.ingredient_id = p_ingredient_id
    union            -- ⚠️ `union` e non `union all`: un anello nella catena
    select ri.recipe_id   --    farebbe girare all'infinito un `union all`.
      from recipe_ingredients ri
      join su on ri.component_recipe_id = su.recipe_id
  )
  select su.recipe_id from su;
$$;

create or replace function ricette_toccate_da_ricetta(p_recipe_id uuid)
returns table(recipe_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with recursive su as (
    select p_recipe_id as recipe_id
    union
    select ri.recipe_id
      from recipe_ingredients ri
      join su on ri.component_recipe_id = su.recipe_id
  )
  select su.recipe_id from su;
$$;

revoke all on function ricette_toccate_da_ingrediente(uuid) from public, anon, authenticated;
revoke all on function ricette_toccate_da_ricetta(uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- LA REGISTRAZIONE — un posto solo
-- ---------------------------------------------------------------------
-- ⚠️ Tutte e sei le strade passano di qui. Se la decisione «e' cambiato
-- davvero?» vivesse in ogni trigger, sei copie divergerebbero.
create or replace function registra_storico_costi(
  p_ricette uuid[],
  p_causa   text,
  p_dettaglio text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid;
  v_base    numeric(14,4);
  v_porz    numeric(14,4);
  v_senza   integer;
  v_ub      numeric(14,4);
  v_up      numeric(14,4);
  v_us      integer;
  v_scritte integer := 0;
begin
  foreach v_id in array coalesce(p_ricette, '{}'::uuid[]) loop
    -- La ricetta puo' essere sparita (una cancellazione a cascata fa
    -- scattare i trigger sulle righe figlie): niente storia per chi non c'e'.
    if not exists (select 1 from recipes where id = v_id) then
      continue;
    end if;

    -- ⚠️ Il costo si CHIEDE alla vista che lo calcola per tutto il
    -- gestionale, non si rifa' qui: due calcoli dello stesso numero sono il
    -- difetto tolto da nove punti col mandato di correzione.
    select c.food_cost_base, c.food_cost_portion
      into v_base, v_porz
      from v_recipe_costs c
     where c.recipe_id = v_id;

    -- Quante righe entrano nel costo con prezzo zero, cioe' senza prezzo.
    select count(*) into v_senza
      from espansione_costo_ricetta(v_id) e
      join ingredients i on i.id = e.ingredient_id
     where not e.is_optional and i.current_price = 0;

    -- L'ultima voce, se c'e'.
    select s.food_cost_base, s.food_cost_portion, s.righe_senza_prezzo
      into v_ub, v_up, v_us
      from storico_costi_ricetta s
     where s.recipe_id = v_id
     order by s.progressivo desc
     limit 1;

    -- ⚠️ SOLO I CAMBIAMENTI VERI. Se niente si e' mosso non si scrive: e' la
    -- riga che distingue «registra i cambiamenti» da «registra i
    -- salvataggi». ⚠️ Anche il numero di righe senza prezzo conta come
    -- cambiamento: passare da «costo completo» a «costo parziale» e'
    -- un'informazione, e a volte il costo in euro non si muove.
    if found
       and v_ub is not distinct from v_base
       and v_up is not distinct from v_porz
       and v_us is not distinct from v_senza then
      continue;
    end if;

    insert into storico_costi_ricetta
      (recipe_id, food_cost_base, food_cost_portion, causa, dettaglio, righe_senza_prezzo)
    values (v_id, coalesce(v_base, 0), v_porz, p_causa, p_dettaglio, coalesce(v_senza, 0));
    v_scritte := v_scritte + 1;
  end loop;

  return v_scritte;
end;
$$;

revoke all on function registra_storico_costi(uuid[], text, text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- LE SEI STRADE
-- ---------------------------------------------------------------------

-- 1 · IL PREZZO DI UN INGREDIENTE
create or replace function storico_al_cambio_prezzo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.current_price is not distinct from old.current_price then
    return null;
  end if;
  perform registra_storico_costi(
    array(select recipe_id from ricette_toccate_da_ingrediente(new.id)),
    'prezzo',
    case when new.current_price > old.current_price then 'È salita ' else 'È scesa ' end
      || new.name || ': ' || euro(old.current_price) || ' → ' || euro(new.current_price)
      || ' al ' || new.unit
  );
  return null;
end;
$$;

-- 2-4 · COMPOSIZIONE, QUANTITÀ, SCARTO — tutte righe di ricetta
create or replace function storico_al_cambio_riga()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_riga    recipe_ingredients;
  v_nome    text;
  v_causa   text;
  v_dett    text;
begin
  v_riga := case when tg_op = 'DELETE' then old else new end;

  select coalesce(i.name, r.name) into v_nome
    from (select 1) x
    left join ingredients i on i.id = v_riga.ingredient_id
    left join recipes r on r.id = v_riga.component_recipe_id;
  v_nome := coalesce(v_nome, 'una voce');

  if tg_op = 'INSERT' then
    v_causa := 'composizione';
    v_dett  := 'Aggiunto ' || v_nome;
  elsif tg_op = 'DELETE' then
    v_causa := 'composizione';
    v_dett  := 'Tolto ' || v_nome;
  elsif new.quantity is distinct from old.quantity then
    v_causa := 'quantita';
    v_dett  := 'Cambiata la dose di ' || v_nome || ': '
               || trim(to_char(old.quantity, 'FM999999990.0999')) || ' → '
               || trim(to_char(new.quantity, 'FM999999990.0999')) || ' ' || new.unit;
  elsif new.waste_percentage is distinct from old.waste_percentage then
    v_causa := 'scarto';
    v_dett  := 'Cambiato lo scarto di ' || v_nome || ': '
               || coalesce(old.waste_percentage::text, 'quello dell''ingrediente') || '% → '
               || coalesce(new.waste_percentage::text, 'quello dell''ingrediente') || '%';
  elsif new.is_optional is distinct from old.is_optional then
    -- ⚠️ Una riga marcata «opzionale» esce dal costo: e' composizione a
    -- tutti gli effetti, e senza questo ramo sparirebbe dal registro.
    v_causa := 'composizione';
    v_dett  := case when new.is_optional then 'Reso opzionale ' else 'Reso obbligatorio ' end || v_nome;
  else
    return null;   -- una modifica che il costo non vede
  end if;

  perform registra_storico_costi(
    array(select recipe_id from ricette_toccate_da_ricetta(v_riga.recipe_id)),
    v_causa, v_dett
  );
  return null;
end;
$$;

-- 5-6 · RESA E PORZIONI — le due strade che il mandato non nominava
create or replace function storico_al_cambio_ricetta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.yield_quantity is distinct from old.yield_quantity then
    -- ⚠️ La resa NON cambia il costo di questa ricetta: cambia quello di
    -- tutto cio' che la usa, perche' il costo del componente si divide per
    -- la resa. Quindi si registra sui SUOI GENITORI — e `registra_storico`
    -- scarta da se' la ricetta stessa, dove niente si e' mosso.
    perform registra_storico_costi(
      array(select recipe_id from ricette_toccate_da_ricetta(new.id)),
      'resa',
      'Cambiata la resa di ' || new.name || ': '
        || coalesce(trim(to_char(old.yield_quantity, 'FM999999990.0999')), 'nessuna') || ' → '
        || coalesce(trim(to_char(new.yield_quantity, 'FM999999990.0999')), 'nessuna') || ' '
        || coalesce(new.yield_unit::text, '')
    );
  end if;

  if new.portions_yield is distinct from old.portions_yield then
    perform registra_storico_costi(
      array[new.id],
      'porzioni',
      'Cambiate le porzioni di ' || new.name || ': '
        || old.portions_yield || ' → ' || new.portions_yield
    );
  end if;

  return null;
end;
$$;

revoke all on function storico_al_cambio_prezzo() from public, anon, authenticated;
revoke all on function storico_al_cambio_riga() from public, anon, authenticated;
revoke all on function storico_al_cambio_ricetta() from public, anon, authenticated;

drop trigger if exists trg_storico_prezzo on ingredients;
create trigger trg_storico_prezzo
  after update of current_price on ingredients
  for each row execute function storico_al_cambio_prezzo();

drop trigger if exists trg_storico_riga on recipe_ingredients;
create trigger trg_storico_riga
  after insert or update or delete on recipe_ingredients
  for each row execute function storico_al_cambio_riga();

drop trigger if exists trg_storico_ricetta on recipes;
create trigger trg_storico_ricetta
  after update of yield_quantity, portions_yield on recipes
  for each row execute function storico_al_cambio_ricetta();


-- ---------------------------------------------------------------------
-- LA LETTURA
-- ---------------------------------------------------------------------
create or replace function storico_costo_ricetta(p_recipe_id uuid)
returns table(
  rilevato_il        timestamptz,
  food_cost_base     numeric,
  food_cost_portion  numeric,
  causa              text,
  dettaglio          text,
  righe_senza_prezzo integer,
  parziale           boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_titolare() then
    raise exception 'Lo storico dei costi e'' riservato al titolare.';
  end if;

  return query
  select s.rilevato_il, s.food_cost_base, s.food_cost_portion,
         s.causa, s.dettaglio, s.righe_senza_prezzo,
         s.righe_senza_prezzo > 0
    from storico_costi_ricetta s
   where s.recipe_id = p_recipe_id
   order by s.progressivo desc;
end;
$$;

-- ⚠️ QUANTO COSTAVA A UNA DATA: l'ultima voce PRIMA di quel momento. Se non
-- ce n'e' nessuna, la risposta e' **vuota** e non e' un errore — vuol dire
-- «di quel giorno non so niente», che e'' diverso da «costava zero». E'' la
-- regola applicata quattro volte in questi giorni.
create or replace function costo_ricetta_alla_data(p_recipe_id uuid, p_quando timestamptz)
returns table(
  food_cost_base     numeric,
  food_cost_portion  numeric,
  rilevato_il        timestamptz,
  dettaglio          text,
  parziale           boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_titolare() then
    raise exception 'Lo storico dei costi e'' riservato al titolare.';
  end if;

  return query
  select s.food_cost_base, s.food_cost_portion, s.rilevato_il, s.dettaglio,
         s.righe_senza_prezzo > 0
    from storico_costi_ricetta s
   where s.recipe_id = p_recipe_id
     and s.rilevato_il <= p_quando
   order by s.progressivo desc
   limit 1;
end;
$$;

revoke all on function storico_costo_ricetta(uuid) from public, anon, authenticated;
grant execute on function storico_costo_ricetta(uuid) to authenticated;
revoke all on function costo_ricetta_alla_data(uuid, timestamptz) from public, anon, authenticated;
grant execute on function costo_ricetta_alla_data(uuid, timestamptz) to authenticated;


-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit    uuid;
  v_ente   uuid;
  v_ing    uuid;
  v_ing2   uuid;
  v_base   uuid;   -- preparazione di primo livello
  v_comp   uuid;   -- preparazione che usa la prima
  v_finger uuid;
  v_selez  uuid;
  v_riga   uuid;
  v_n      integer;
  v_prima  numeric;
  v_dopo   numeric;
  v_dett   text;
  v_quando timestamptz;
  v_causa  text;
  v_lap_p  integer;
  v_lap_d  integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_lap_p from deleted_records;
  select id into v_ente from entities order by created_at limit 1;

  -- LA CATENA A QUATTRO LIVELLI: ingrediente → preparazione → preparazione
  -- → finger → selezione. ⚠️ E' il caso su cui questo genere di lavoro si
  -- rompe: una prova a un livello solo non distinguerebbe niente.
  insert into ingredients (entity_id, name, category, unit, current_price)
    values (v_ente, '__VERIFICA__ storico melanzana', 'verdura', 'kg', 2.00)
    returning id into v_ing;
  insert into ingredients (entity_id, name, category, unit, current_price)
    values (v_ente, '__VERIFICA__ storico sale', 'verdura', 'kg', 1.00)
    returning id into v_ing2;

  insert into recipes (name, category, portions_yield, recipe_type, yield_quantity, yield_unit)
    values ('__VERIFICA__ storico base', 'antipasto', 1, 'preparazione', 1, 'kg')
    returning id into v_base;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
    values (v_base, v_ing, 1, 'kg');

  insert into recipes (name, category, portions_yield, recipe_type, yield_quantity, yield_unit)
    values ('__VERIFICA__ storico comp', 'antipasto', 1, 'preparazione', 1, 'kg')
    returning id into v_comp;
  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
    values (v_comp, v_base, 1, 'kg');

  insert into recipes (name, category, portions_yield, recipe_type, yield_quantity, yield_unit)
    values ('__VERIFICA__ storico finger', 'antipasto', 1, 'finger', 1, 'pz')
    returning id into v_finger;
  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
    values (v_finger, v_comp, 1, 'kg');

  -- ⚠️ SEI bocconcini nella selezione, non due: con due, le risposte
  -- sbagliate coincidono con quella giusta (lezione del 19/08). Qui il
  -- sesto e' lo stesso finger ripetuto? No: l'unicita' lo vieta. Si usa un
  -- moltiplicatore di 6 sulla riga, che e' la stessa aritmetica e distingue
  -- lo stesso: 6 × il costo del finger.
  insert into recipes (name, category, portions_yield, recipe_type)
    values ('__VERIFICA__ storico selezione', 'antipasto', 2, 'piatto_finito')
    returning id into v_selez;
  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
    values (v_selez, v_finger, 6, 'pz');

  -- 1 · LA VOCE ARRIVA FINO IN CIMA, con la ragione giusta.
  select count(*) into v_n from storico_costi_ricetta
   where recipe_id = v_selez;
  if v_n = 0 then
    raise exception 'La selezione non ha nessuna voce di storia dopo essere stata composta.';
  end if;
  select food_cost_base into v_prima from storico_costi_ricetta
   where recipe_id = v_selez order by progressivo desc limit 1;

  update ingredients set current_price = 3.00 where id = v_ing;

  select food_cost_base, dettaglio into v_dopo, v_dett
    from storico_costi_ricetta
   where recipe_id = v_selez order by progressivo desc limit 1;

  if v_dopo is not distinct from v_prima then
    raise exception 'Il rincaro dell''ingrediente non e'' arrivato in cima alla catena (costo fermo a %).', v_prima;
  end if;
  if v_dett not like '%melanzana%' then
    raise exception 'La voce in cima non dice cosa l''ha causata: «%».', v_dett;
  end if;
  -- ⚠️ E il numero: 6 bocconcini × 1 kg × 3,00 = 18,00. Con 2 non si
  -- distinguerebbe da una catena che perde un livello.
  if v_dopo <> 18.0000 then
    raise exception 'Il costo in cima e'' % invece di 18,0000: la catena perde un livello.', v_dopo;
  end if;

  -- 2 · UN SALVATAGGIO CHE NON CAMBIA NIENTE NON SCRIVE NIENTE.
  select count(*) into v_n from storico_costi_ricetta where recipe_id = v_selez;
  select id into v_riga from recipe_ingredients where recipe_id = v_selez limit 1;
  update recipe_ingredients set quantity = quantity where id = v_riga;
  update ingredients set current_price = 3.00 where id = v_ing;
  if (select count(*) from storico_costi_ricetta where recipe_id = v_selez) <> v_n then
    raise exception 'Un salvataggio senza modifiche ha scritto una voce: il registro registra i salvataggi, non i cambiamenti.';
  end if;

  -- 3 · IL COSTO DI IERI RESTA QUELLO DI IERI.
  v_quando := now();
  perform pg_sleep(0.05);
  update recipe_ingredients set quantity = 3 where id = v_riga;
  select food_cost_base into v_dopo from costo_ricetta_alla_data(v_selez, v_quando);
  if v_dopo <> 18.0000 then
    raise exception 'Il costo alla data di prima e'' cambiato: % invece di 18,0000.', v_dopo;
  end if;
  select food_cost_base into v_dopo from storico_costi_ricetta
   where recipe_id = v_selez order by progressivo desc limit 1;
  if v_dopo <> 9.0000 then
    raise exception 'Il costo di adesso e'' % invece di 9,0000.', v_dopo;
  end if;

  -- 4 · LA RESA — la quinta strada, quella che il mandato non nominava.
  select count(*) into v_n from storico_costi_ricetta where recipe_id = v_selez;
  update recipes set yield_quantity = 2 where id = v_base;
  if (select count(*) from storico_costi_ricetta where recipe_id = v_selez) <= v_n then
    raise exception 'Cambiare la resa di una preparazione non ha scritto niente sulla selezione che la usa.';
  end if;
  select dettaglio into v_dett from storico_costi_ricetta
   where recipe_id = v_selez order by progressivo desc limit 1;
  if v_dett not like '%resa%' then
    raise exception 'La voce della resa non dice che e'' la resa: «%».', v_dett;
  end if;

  -- 5 · LE PORZIONI — la sesta.
  select count(*) into v_n from storico_costi_ricetta where recipe_id = v_selez;
  update recipes set portions_yield = 4 where id = v_selez;
  if (select count(*) from storico_costi_ricetta where recipe_id = v_selez) <= v_n then
    raise exception 'Cambiare le porzioni non ha scritto niente, e il costo per porzione e'' cambiato.';
  end if;

  -- 6 · IL COSTO PARZIALE SI DICHIARA.
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
    values (v_base, v_ing2, 1, 'kg');
  update ingredients set current_price = 0 where id = v_ing2;
  select righe_senza_prezzo into v_n from storico_costi_ricetta
   where recipe_id = v_selez order by progressivo desc limit 1;
  if v_n < 1 then
    raise exception 'Un ingrediente senza prezzo non e'' dichiarato: il costo sembra completo e non lo e''.';
  end if;

  -- 7 · TOLTO UN PEZZO, la composizione lo dice.
  delete from recipe_ingredients where recipe_id = v_base and ingredient_id = v_ing2;
  select dettaglio, causa into v_dett, v_causa from storico_costi_ricetta
   where recipe_id = v_selez order by progressivo desc limit 1;
  if v_dett not like 'Tolto %' then
    raise exception 'La voce della cancellazione non dice cosa e'' stato tolto: «%».', v_dett;
  end if;

  -- 8 . LO SCARTO, la quarta strada del mandato: senza questo controllo
  --     sarebbe l unica delle sei a non essere provata da nessuna parte.
  select count(*) into v_n from storico_costi_ricetta where recipe_id = v_selez;
  update recipe_ingredients set waste_percentage = 20
   where recipe_id = v_base and ingredient_id = v_ing;
  if (select count(*) from storico_costi_ricetta where recipe_id = v_selez) <= v_n then
    raise exception 'Cambiare lo scarto non ha scritto niente, e il costo e'' cambiato.';
  end if;
  select dettaglio into v_dett from storico_costi_ricetta
   where recipe_id = v_selez order by progressivo desc limit 1;
  if v_dett not like '%scarto%' then
    raise exception 'La voce dello scarto non dice che e'' lo scarto: %.', v_dett;
  end if;

  -- =========== PULIZIA ===========
  delete from recipe_ingredients
    where recipe_id in (select id from recipes where name like '__VERIFICA__ storico%')
       or component_recipe_id in (select id from recipes where name like '__VERIFICA__ storico%');
  delete from storico_costi_ricetta
    where recipe_id in (select id from recipes where name like '__VERIFICA__ storico%');
  delete from recipes where name like '__VERIFICA__ storico%';
  delete from ingredients where name like '__VERIFICA__ storico%';

  select count(*) into v_lap_d from deleted_records;
  if v_lap_d <> v_lap_p then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.', v_lap_d - v_lap_p;
  end if;
  if exists (select 1 from recipes where name like '__VERIFICA__ storico%')
     or exists (select 1 from ingredients where name like '__VERIFICA__ storico%') then
    raise exception 'La verifica ha lasciato delle righe finte.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Lo storico dei costi registra i cambiamenti veri, dalle sei strade, fino in cima alla catena.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260820000003', 'lo_storico_dei_costi')
on conflict (version) do nothing;
