-- =====================================================================
-- IL PREVENTIVO ESISTE — blocco 1 del mandato dei preventivi
-- 20/08/2026
-- =====================================================================
-- Mandato: docs/mandati/20260820_i_preventivi_per_gli_eventi.md
--
-- 🔴 UN PREVENTIVO CONSERVA DUE NUMERI DIVERSI, e tenerli separati fin
-- dall'inizio e' la decisione portante di questo blocco:
--   · il **prezzo promesso al cliente** e' una promessa e non cambia piu';
--   · il **costo del momento in cui e' stato fatto** invecchia, perche' i
--     prezzi si muovono.
-- Mescolandoli, fra due mesi nessuno saprebbe se «costava 14» era il costo di
-- allora o di adesso — ed e' esattamente la domanda a cui lo storico dei
-- costi (finito ieri) serve a rispondere.
--
-- 🔴 IL COSTO VIENE DALLA FUNZIONE DEL BLOCCO 0, non da un conto rifatto
-- altrove. Se il numero mostrato al cliente e quello del magazzino nascessero
-- in due posti diversi, prima o poi divergerebbero — e stavolta la differenza
-- la vedrebbe **un ospite**.
-- ⚠️ Quindi qui non c'e' nessuna ricorsione nuova: si chiama
-- `fabbisogno_preparazione`, la stessa che usa lo scarico vero.
--
-- 🔴 LE PORZIONI MODIFICATE VIVONO SUL PREVENTIVO, non sulla ricetta.
-- `porzioni_per_persona` = 1 vuol dire «come in carta», 0,5 «meta' porzione».
-- La ricetta in carta **resta intatta**: e' una decisione di Alessio, non una
-- comodita'. E la sera dell'evento il magazzino dovra' scaricare QUELLE — la
-- strada esiste gia', perche' stima e scarico sono la stessa funzione.
--
-- ⚠️ IL RICARICO SI APPLICA AL SOLO CIBO. Gli extra si sommano dopo, senza
-- ricarico. E' la trappola naturale di questo modulo — *un preventivo puo'
-- risultare in linea sul cibo e in perdita sulla serata* — quindi la
-- avvertenza esce **insieme al numero**, come per `calcola_imposte()`: un
-- avviso che vive nel testo di una schermata non protegge la seconda
-- schermata che mostra lo stesso numero.
--
-- ⚠️ IL RICARICO PREDEFINITO NASCE VUOTO, e va detto perche' e' uno scarto
-- dalla lettera del mandato. Alessio ha chiesto «un valore predefinito,
-- modificabile»; il numero pero' non l'ha detto, e un ricarico inventato da
-- me **decide un prezzo** — sposta la proposta sempre nella stessa direzione,
-- esattamente come i parametri del POS del 15/08, che per questo nascono
-- vuoti. Finche' non lo scrive lui, il gestionale **non propone e lo
-- dichiara**, invece di proporre un numero mio.
-- =====================================================================

alter table service_settings
  add column if not exists food_cost_obiettivo_percento numeric;

alter table service_settings drop constraint if exists food_cost_obiettivo_valido;
alter table service_settings add constraint food_cost_obiettivo_valido
  check (food_cost_obiettivo_percento is null
         or (food_cost_obiettivo_percento > 0 and food_cost_obiettivo_percento <= 100));

comment on column service_settings.food_cost_obiettivo_percento is
  'Quanto deve pesare il cibo sul prezzo di un evento, in percentuale (20/08/2026, deciso da Alessio: 25). ⚠️ SI LEGGE COSI'': 25 vuol dire che 10 € di cibo si propongono a 40 € — il costo diviso 0,25. NON vuol dire «aggiungi il 25%». La colonna e'' scritta come food cost, e non come ricarico, apposta: un ricarico si puo'' leggere in due modi (×4 o ×5) e ci siamo gia'' fermati a chiedere quale fosse; un food cost obiettivo no.';


-- ---------------------------------------------------------------------
-- IL PREVENTIVO
-- ---------------------------------------------------------------------
create table if not exists preventivi (
  id                uuid primary key default gen_random_uuid(),
  entity_id         uuid not null references entities(id),
  -- ⚠️ `restrict`, mai `set null`: una versione nuova che perde il
  -- collegamento col preventivo che sostituisce e' la storia persa in
  -- silenzio — e con un acconto versato e un prezzo concordato, sapere cosa
  -- era stato promesso e quando e' la cosa che conta.
  versione_di       uuid references preventivi(id) on delete restrict,
  customer_id       uuid references customers(id) on delete set null,
  cliente_nome      text not null,
  cliente_telefono  text,
  cliente_email     text,
  data_evento       date not null,
  ora_evento        time,
  persone           integer not null,
  stato             text not null default 'bozza',
  -- Fotografato quando il preventivo si scrive: il food cost obiettivo di
  -- ALLORA. 25 = il cibo pesa un quarto del prezzo.
  food_cost_obiettivo_percento numeric,
  -- Il prezzo scritto a mano da Alessio, che vince sempre sul proposto.
  prezzo_a_persona_scavalcato numeric,
  -- 🔴 IL COSTO DEL MOMENTO, fotografato. Non si ricalcola mai: e' l'unica
  -- risposta possibile a «quanto costava quando gliel'ho promesso».
  costo_cibo        numeric,
  costo_rilevato_il timestamptz,
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint preventivo_persone_positive check (persone > 0),
  constraint preventivo_stato_ammesso check (
    stato in ('bozza', 'inviato', 'accettato', 'rifiutato', 'annullato')
  ),
  constraint preventivo_food_cost_valido check (food_cost_obiettivo_percento is null
         or (food_cost_obiettivo_percento > 0 and food_cost_obiettivo_percento <= 100)),
  constraint preventivo_prezzo_non_negativo check (prezzo_a_persona_scavalcato is null or prezzo_a_persona_scavalcato >= 0),
  constraint preventivo_non_e_versione_di_se_stesso check (versione_di is null or versione_di <> id)
);

comment on table preventivi is
  'Il posto dove Alessio promette un prezzo PRIMA di conoscere il costo (20/08/2026): la cena e'' fra due mesi e i prezzi si muovono. ⚠️ Conserva DUE numeri diversi — il prezzo promesso, che non cambia piu'', e il costo del momento in cui e'' stato fatto, che invecchia.';
comment on column preventivi.versione_di is
  'Il preventivo che questo sostituisce. Dopo l''accettazione non si sovrascrive: si crea una versione nuova COLLEGATA, e resta traccia di tutto.';
comment on column preventivi.costo_cibo is
  'Il costo del cibo FOTOGRAFATO quando il preventivo e'' stato scritto, non ricalcolato. ⚠️ E'' l''unica risposta possibile a «quanto costava quando gliel''ho promesso»: rifarlo oggi darebbe il costo di oggi.';

create index if not exists idx_preventivi_data on preventivi (data_evento desc);
create index if not exists idx_preventivi_versione on preventivi (versione_di);

create table if not exists preventivo_righe (
  id                   uuid primary key default gen_random_uuid(),
  preventivo_id        uuid not null references preventivi(id) on delete cascade,
  natura               text not null,
  recipe_id            uuid references recipes(id) on delete restrict,
  descrizione          text,
  -- 🔴 LE PORZIONI MODIFICATE: 1 = come in carta, 0,5 = meta' porzione.
  -- Vivono QUI, non sulla ricetta.
  porzioni_per_persona numeric not null default 1,
  quantita             numeric,
  prezzo               numeric,
  posizione            integer not null default 0,
  constraint riga_natura_ammessa check (natura in ('cibo', 'extra')),
  constraint riga_porzioni_positive check (porzioni_per_persona > 0),
  -- ⚠️ Le due nature non si mescolano: una riga di cibo entra nel costo
  -- CALCOLATO e non ha un prezzo suo; una riga extra ha un prezzo scritto da
  -- Alessio e non passa dal ricarico. Senza questo vincolo si potrebbe
  -- scrivere una riga che e'' tutte e due, e nessuno saprebbe come contarla.
  constraint riga_coerente check (
    (natura = 'cibo'
       and recipe_id is not null
       and prezzo is null)
    or
    (natura = 'extra'
       and recipe_id is null
       and coalesce(btrim(descrizione), '') <> ''
       and prezzo is not null
       and quantita is not null and quantita > 0)
  )
);

comment on table preventivo_righe is
  'Le voci di un preventivo, di due nature che non si mescolano: `cibo` (una ricetta, con le porzioni dell''evento, entra nel costo calcolato) ed `extra` (personale aggiuntivo, servizi, vini: prezzo scritto da Alessio, NESSUN ricarico).';

create index if not exists idx_preventivo_righe on preventivo_righe (preventivo_id, posizione);

alter table preventivi enable row level security;
alter table preventivo_righe enable row level security;

-- Titolare-only: un preventivo e' un documento commerciale, e dentro c'e' il
-- costo. Le scritture passano dalle funzioni del corridoio.
drop policy if exists preventivi_titolare on preventivi;
create policy preventivi_titolare on preventivi
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

drop policy if exists preventivo_righe_titolare on preventivo_righe;
create policy preventivo_righe_titolare on preventivo_righe
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

drop trigger if exists trg_preventivi_updated on preventivi;
create trigger trg_preventivi_updated before update on preventivi
  for each row execute function set_updated_at();


-- ---------------------------------------------------------------------
-- IL COSTO — dalla stessa funzione dello scarico, mai da un secondo posto
-- ---------------------------------------------------------------------
create or replace function fabbisogno_preventivo(p_preventivo_id uuid)
returns table(
  ingredient_id uuid,
  nome          text,
  unita         unit_type,
  quantita      numeric,
  costo         numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_p preventivi%rowtype;
begin
  if not is_titolare() then
    raise exception 'I preventivi sono riservati al titolare.';
  end if;
  select * into v_p from preventivi where id = p_preventivo_id;
  if not found then raise exception 'Questo preventivo non esiste.'; end if;

  return query
  select f.ingredient_id, i.name, i.unit,
         sum(f.quantita)::numeric(14,4),
         sum(f.quantita * i.current_price)::numeric(14,4)
    from preventivo_righe pr
    join recipes r on r.id = pr.recipe_id
    -- ⚠️ LE DOSI, non le persone, e con le porzioni DELL'EVENTO: un piatto
    -- da 4 porzioni servito a 8 persone a meta' porzione sono 1 dose.
    cross join lateral fabbisogno_preparazione(
      pr.recipe_id,
      (v_p.persone * pr.porzioni_per_persona)::numeric / nullif(r.portions_yield, 0)
    ) f
    join ingredients i on i.id = f.ingredient_id
   where pr.preventivo_id = p_preventivo_id
     and pr.natura = 'cibo'
   group by f.ingredient_id, i.name, i.unit
   order by i.name;
end;
$$;

-- ⚠️ IL TOTALE NON SI RICALCOLA: somma le righe di sopra. Due somme dello
-- stesso costo sono due numeri che possono divergere.
create or replace function costo_cibo_preventivo(p_preventivo_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(costo), 0)::numeric(14,4) from fabbisogno_preventivo(p_preventivo_id);
$$;

-- ⚠️ Si CANCELLA e si rifa': cambia una colonna del risultato, e Postgres
-- non lascia sostituire una funzione che restituisce una forma diversa.
-- Dopo un drop i permessi tornano aperti al mondo, quindi si richiudono a
-- mano piu' sotto (lezione del 13/08).
drop function if exists prezzo_preventivo(uuid);
create or replace function prezzo_preventivo(p_preventivo_id uuid)
returns table(
  costo_cibo            numeric,
  costo_cibo_a_persona  numeric,
  extra_totale          numeric,
  food_cost_obiettivo_percento numeric,
  prezzo_a_persona      numeric,
  scavalcato            boolean,
  avvertenza            text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_p       preventivi%rowtype;
  v_costo   numeric;
  v_extra   numeric;
  v_ric     numeric;
  v_prop    numeric;
begin
  if not is_titolare() then
    raise exception 'I preventivi sono riservati al titolare.';
  end if;
  select * into v_p from preventivi where id = p_preventivo_id;
  if not found then raise exception 'Questo preventivo non esiste.'; end if;

  -- ⚠️ Il costo FOTOGRAFATO se c'e', quello di adesso se il preventivo non e'
  -- ancora stato scritto: il prezzo di una promessa si costruisce sul costo
  -- di quando la promessa e' stata fatta.
  v_costo := coalesce(v_p.costo_cibo, costo_cibo_preventivo(p_preventivo_id));

  select coalesce(sum(prezzo * quantita), 0) into v_extra
    from preventivo_righe
   where preventivo_id = p_preventivo_id and natura = 'extra';

  v_ric := coalesce(v_p.food_cost_obiettivo_percento,
                    (select s.food_cost_obiettivo_percento from service_settings s where s.id = 1));

  -- 🔴 IL FOOD COST OBIETTIVO SI APPLICA AL SOLO CIBO, e gli extra si
  -- sommano dopo, senza nessun ricarico.
  -- ⚠️ La formula e' una DIVISIONE, non una moltiplicazione: 25% vuol dire
  -- che il cibo pesa un quarto del prezzo, quindi 10 € di cibo fanno 40 € di
  -- cibo venduto. Scritta come «+X%» sarebbe stata leggibile in due modi.
  if v_ric is not null then
    v_prop := round((v_costo / (v_ric / 100.0) + v_extra) / v_p.persone, 2);
  end if;

  return query select
    round(v_costo, 2),
    round(v_costo / v_p.persone, 2),
    round(v_extra, 2),
    v_ric,
    coalesce(v_p.prezzo_a_persona_scavalcato, v_prop),
    v_p.prezzo_a_persona_scavalcato is not null,
    -- ⚠️ IL NUMERO E IL SUO LIMITE VIAGGIANO INSIEME: un'avvertenza scritta
    -- nel testo di una schermata non protegge la seconda che mostra lo
    -- stesso numero.
    case
      when v_ric is null then
        'Nessun food cost obiettivo impostato: il gestionale non puo'' proporre un prezzo. Scrivilo in Sala e orari, oppure metti tu il prezzo a persona.'
      when v_p.prezzo_a_persona_scavalcato is not null then
        'Prezzo scritto a mano: il food cost obiettivo non lo tocca piu''.'
      else
        -- ⚠️ SI DICE COL RISULTATO, non con la percentuale: «10 € di cibo
        -- → 40 €». Una percentuale si puo'' leggere in due modi, un prezzo no.
        'Food cost obiettivo ' || trim(to_char(v_ric, 'FM999990.0#')) || '%: '
        || euro(10) || ' di cibo diventano ' || euro(round(10 / (v_ric / 100.0), 2))
        || '. Vale sul SOLO cibo; gli extra sono sommati dopo, senza ricarico.'
    end
    || case when v_p.costo_cibo is null then ' ⚠️ Costo di adesso: questo preventivo non e'' ancora stato salvato.'
            else ' Costo fotografato il ' || to_char(v_p.costo_rilevato_il at time zone 'Europe/Rome', 'DD/MM/YYYY') || '.' end;
end;
$$;

revoke all on function fabbisogno_preventivo(uuid) from public, anon, authenticated;
grant execute on function fabbisogno_preventivo(uuid) to authenticated;
-- 🔴 NON SI CONCEDE A NESSUNO, e la ragione l'ha trovata la rete dei
-- permessi diventando rossa da sola: questa funzione e' `security definer` e
-- il suo portiere sta nella funzione che chiama, non nel suo corpo. Un
-- portiere DELEGATO e' un portiere che sparisce il giorno che l'altra
-- funzione cambia. Qui non serve a nessun client — la schermata chiede il
-- prezzo, non il costo nudo — quindi la porta si chiude invece di
-- raddoppiare il controllo.
revoke all on function costo_cibo_preventivo(uuid) from public, anon, authenticated;
revoke all on function prezzo_preventivo(uuid) from public, anon, authenticated;
grant execute on function prezzo_preventivo(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- LE OPERAZIONI — testata e righe insieme, o niente
-- ---------------------------------------------------------------------
create or replace function salva_preventivo(
  p_preventivo_id uuid,
  p_testata jsonb,
  p_righe   jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid := p_preventivo_id;
  v_riga jsonb;
  v_i   integer := 0;
begin
  if not is_titolare() then
    raise exception 'I preventivi sono riservati al titolare.';
  end if;

  if v_id is null then
    insert into preventivi (
      entity_id, versione_di, customer_id, cliente_nome, cliente_telefono,
      cliente_email, data_evento, ora_evento, persone, stato,
      food_cost_obiettivo_percento, prezzo_a_persona_scavalcato, note
    ) values (
      (p_testata->>'entity_id')::uuid,
      nullif(p_testata->>'versione_di','')::uuid,
      nullif(p_testata->>'customer_id','')::uuid,
      p_testata->>'cliente_nome',
      nullif(p_testata->>'cliente_telefono',''),
      nullif(p_testata->>'cliente_email',''),
      (p_testata->>'data_evento')::date,
      nullif(p_testata->>'ora_evento','')::time,
      (p_testata->>'persone')::integer,
      coalesce(nullif(p_testata->>'stato',''), 'bozza'),
      -- ⚠️ Il food cost obiettivo si FOTOGRAFA dal predefinito: cambiarlo
      -- domani non deve riscrivere il prezzo di una promessa gia' fatta.
      coalesce(nullif(p_testata->>'food_cost_obiettivo_percento','')::numeric,
               (select s.food_cost_obiettivo_percento from service_settings s where s.id = 1)),
      nullif(p_testata->>'prezzo_a_persona_scavalcato','')::numeric,
      nullif(p_testata->>'note','')
    ) returning id into v_id;
  else
    update preventivi set
      customer_id      = nullif(p_testata->>'customer_id','')::uuid,
      cliente_nome     = p_testata->>'cliente_nome',
      cliente_telefono = nullif(p_testata->>'cliente_telefono',''),
      cliente_email    = nullif(p_testata->>'cliente_email',''),
      data_evento      = (p_testata->>'data_evento')::date,
      ora_evento       = nullif(p_testata->>'ora_evento','')::time,
      persone          = (p_testata->>'persone')::integer,
      stato            = coalesce(nullif(p_testata->>'stato',''), stato),
      prezzo_a_persona_scavalcato = nullif(p_testata->>'prezzo_a_persona_scavalcato','')::numeric,
      note             = nullif(p_testata->>'note','')
     where id = v_id;
    if not found then raise exception 'Questo preventivo non esiste piu''.'; end if;
    delete from preventivo_righe where preventivo_id = v_id;
  end if;

  for v_riga in select * from jsonb_array_elements(coalesce(p_righe, '[]'::jsonb)) loop
    insert into preventivo_righe
      (preventivo_id, natura, recipe_id, descrizione, porzioni_per_persona, quantita, prezzo, posizione)
    values (
      v_id,
      v_riga->>'natura',
      nullif(v_riga->>'recipe_id','')::uuid,
      nullif(v_riga->>'descrizione',''),
      coalesce(nullif(v_riga->>'porzioni_per_persona','')::numeric, 1),
      nullif(v_riga->>'quantita','')::numeric,
      nullif(v_riga->>'prezzo','')::numeric,
      v_i
    );
    v_i := v_i + 1;
  end loop;

  -- 🔴 IL COSTO SI FOTOGRAFA QUI, alla fine e in automatico. Un gesto
  -- separato «fotografa il costo» sarebbe un gesto che si puo' dimenticare,
  -- e un preventivo senza costo fotografato non sa piu' rispondere a «quanto
  -- costava quando gliel'ho promesso».
  update preventivi
     set costo_cibo = costo_cibo_preventivo(v_id),
         costo_rilevato_il = now()
   where id = v_id;

  return v_id;
end;
$$;

-- LA VERSIONE NUOVA: non si sovrascrive, si collega.
create or replace function nuova_versione_preventivo(p_preventivo_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nuovo uuid;
begin
  if not is_titolare() then
    raise exception 'I preventivi sono riservati al titolare.';
  end if;
  if not exists (select 1 from preventivi where id = p_preventivo_id) then
    raise exception 'Questo preventivo non esiste.';
  end if;

  insert into preventivi (
    entity_id, versione_di, customer_id, cliente_nome, cliente_telefono,
    cliente_email, data_evento, ora_evento, persone, stato,
    food_cost_obiettivo_percento, prezzo_a_persona_scavalcato, note
  )
  select entity_id, id, customer_id, cliente_nome, cliente_telefono,
         cliente_email, data_evento, ora_evento, persone, 'bozza',
         food_cost_obiettivo_percento, prezzo_a_persona_scavalcato, note
    from preventivi where id = p_preventivo_id
  returning id into v_nuovo;

  insert into preventivo_righe
    (preventivo_id, natura, recipe_id, descrizione, porzioni_per_persona, quantita, prezzo, posizione)
  select v_nuovo, natura, recipe_id, descrizione, porzioni_per_persona, quantita, prezzo, posizione
    from preventivo_righe where preventivo_id = p_preventivo_id;

  -- ⚠️ Il costo si RIFOTOGRAFA: la versione nuova nasce oggi, e il suo costo
  -- e' quello di oggi. Quello di ieri resta scritto sulla versione di ieri.
  update preventivi
     set costo_cibo = costo_cibo_preventivo(v_nuovo), costo_rilevato_il = now()
   where id = v_nuovo;

  return v_nuovo;
end;
$$;

revoke all on function salva_preventivo(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function salva_preventivo(uuid, jsonb, jsonb) to authenticated;
revoke all on function nuova_versione_preventivo(uuid) from public, anon, authenticated;
grant execute on function nuova_versione_preventivo(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit    uuid;
  v_ente   uuid;
  v_ing    uuid;
  v_prep   uuid;
  v_piatto uuid;
  v_prev   uuid;
  v_nuova  uuid;
  v_costo  numeric;
  v_prezzo numeric;
  v_scav   boolean;
  v_avv    text;
  v_qta    numeric;
  v_ric    numeric;
  v_ok     boolean;
  v_lap_p  integer;
  v_lap_d  integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_lap_p from deleted_records;
  select id into v_ente from entities order by created_at limit 1;
  select food_cost_obiettivo_percento into v_ric from service_settings where id = 1;

  -- Catena: ingrediente -> preparazione -> piatto. 10 persone, piatto da 4
  -- porzioni, mezza porzione a testa = 1,25 dosi.
  -- ⚠️ I numeri sono scelti perche' DISTINGUANO: a porzione piena farebbero
  -- 2,5 dosi, cioe' il doppio.
  insert into ingredients (entity_id, name, category, unit, current_price, waste_percentage_default)
    values (v_ente, '__VERIFICA__ prev alice', 'pesce', 'kg', 4, 0) returning id into v_ing;
  insert into recipes (name, category, portions_yield, recipe_type, yield_quantity, yield_unit)
    values ('__VERIFICA__ prev base', 'antipasto', 1, 'preparazione', 1, 'kg') returning id into v_prep;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
    values (v_prep, v_ing, 1, 'kg');
  insert into recipes (name, category, portions_yield, recipe_type, pronta_per_carta)
    values ('__VERIFICA__ prev piatto', 'antipasto', 4, 'piatto_finito', true) returning id into v_piatto;
  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
    values (v_piatto, v_prep, 2, 'kg');

  -- 1 · IL PREVENTIVO SI SCRIVE, testata e righe insieme.
  v_prev := salva_preventivo(null,
    jsonb_build_object('entity_id', v_ente, 'cliente_nome', '__VERIFICA__ cliente',
                       'data_evento', '1995-09-10', 'persone', 10,
                       'food_cost_obiettivo_percento', 25),
    jsonb_build_array(
      jsonb_build_object('natura', 'cibo', 'recipe_id', v_piatto, 'porzioni_per_persona', 0.5),
      jsonb_build_object('natura', 'extra', 'descrizione', 'Cameriere in piu''',
                         'quantita', 1, 'prezzo', 120)
    ));

  -- 2 · IL COSTO ARRIVA DALLA CATENA, e viene FOTOGRAFATO.
  -- 1,25 dosi x 2 kg x 4 €/kg = 10,00 €
  select costo_cibo into v_costo from preventivi where id = v_prev;
  if round(v_costo, 2) <> 10.00 then
    raise exception 'Il costo fotografato e'' % invece di 10,00.', v_costo;
  end if;
  if (select costo_rilevato_il from preventivi where id = v_prev) is null then
    raise exception 'Il costo e'' stato scritto senza dire quando: non risponde piu'' a «quanto costava allora».';
  end if;

  -- 3 · LO STESSO NUMERO DEL MAGAZZINO: il fabbisogno del preventivo e la
  --     funzione che scarica devono dire la stessa cosa.
  select quantita into v_qta from fabbisogno_preventivo(v_prev) where ingredient_id = v_ing;
  if round(v_qta, 4) <> round((select sum(f.quantita) from fabbisogno_preparazione(v_piatto, 1.25) f
                                where f.ingredient_id = v_ing), 4) then
    raise exception 'Il fabbisogno del preventivo non coincide con quello del magazzino.';
  end if;

  -- 4 · LA RICETTA IN CARTA RESTA INTATTA. ⚠️ E' la prova che distingue
  --     «vale per l'evento» da «ho modificato la ricetta».
  if (select quantity from recipe_ingredients where recipe_id = v_piatto and component_recipe_id = v_prep) <> 2 then
    raise exception 'Le porzioni dell''evento hanno modificato la ricetta in carta.';
  end if;
  if (select portions_yield from recipes where id = v_piatto) <> 4 then
    raise exception 'Le porzioni dell''evento hanno cambiato le porzioni della ricetta.';
  end if;

  -- 5 · IL PREZZO: food cost obiettivo sul SOLO cibo, extra sommati dopo.
  --     10,00 / 0,25 = 40,00 di cibo venduto; + 120 = 160 / 10 = 16,00.
  --     ⚠️ I numeri distinguono: col food cost applicato anche agli extra
  --     farebbe 52,00; letto come «+25%» farebbe 13,25.
  select prezzo_a_persona, scavalcato, avvertenza into v_prezzo, v_scav, v_avv
    from prezzo_preventivo(v_prev);
  if round(v_prezzo, 2) <> 16.00 then
    raise exception 'Il prezzo proposto e'' % invece di 16,00 a persona.', v_prezzo;
  end if;
  if v_scav then raise exception 'Il prezzo risulta scavalcato senza che nessuno l''abbia scritto.'; end if;
  if v_avv not like '%SOLO cibo%' then
    raise exception 'L''avvertenza non dice che vale sul solo cibo: «%».', v_avv;
  end if;
  -- ⚠️ E DICE IL RISULTATO, non solo la percentuale: una percentuale si
  --    legge in due modi, un prezzo no.
  if v_avv not like '%40,00%' then
    raise exception 'L''avvertenza non dice come si legge il food cost: «%».', v_avv;
  end if;

  -- 6 · IL PREZZO SCAVALCATO VINCE, e resta anche cambiando il ricarico.
  perform salva_preventivo(v_prev,
    jsonb_build_object('entity_id', v_ente, 'cliente_nome', '__VERIFICA__ cliente',
                       'data_evento', '1995-09-10', 'persone', 10,
                       'prezzo_a_persona_scavalcato', 55),
    jsonb_build_array(
      jsonb_build_object('natura', 'cibo', 'recipe_id', v_piatto, 'porzioni_per_persona', 0.5),
      jsonb_build_object('natura', 'extra', 'descrizione', 'Cameriere in piu''',
                         'quantita', 1, 'prezzo', 120)
    ));
  update service_settings set food_cost_obiettivo_percento = 10 where id = 1;
  select prezzo_a_persona, scavalcato into v_prezzo, v_scav from prezzo_preventivo(v_prev);
  update service_settings set food_cost_obiettivo_percento = v_ric where id = 1;
  if round(v_prezzo, 2) <> 55.00 or not v_scav then
    raise exception 'Il prezzo scritto a mano e'' cambiato col food cost obiettivo: % .', v_prezzo;
  end if;

  -- 7 · LA VERSIONE NUOVA E' COLLEGATA, e porta le righe con se'.
  v_nuova := nuova_versione_preventivo(v_prev);
  if (select versione_di from preventivi where id = v_nuova) <> v_prev then
    raise exception 'La versione nuova non e'' collegata a quella vecchia: la storia e'' persa.';
  end if;
  if (select count(*) from preventivo_righe where preventivo_id = v_nuova) <> 2 then
    raise exception 'La versione nuova non ha portato le righe.';
  end if;

  -- 8 · E QUELLA VECCHIA NON SI PUO' CANCELLARE lasciando la nuova orfana.
  v_ok := false;
  begin
    delete from preventivi where id = v_prev;
  exception when foreign_key_violation then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'Il preventivo vecchio e'' stato cancellato: la versione nuova e'' rimasta senza storia.';
  end if;

  -- 9 · UNA RIGA NON PUO' ESSERE CIBO E EXTRA INSIEME.
  v_ok := false;
  begin
    insert into preventivo_righe (preventivo_id, natura, recipe_id, descrizione, prezzo, quantita)
      values (v_nuova, 'cibo', v_piatto, 'con prezzo', 10, 1);
  exception when check_violation then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'Una riga di cibo ha accettato un prezzo: non si saprebbe come contarla.';
  end if;

  -- =========== PULIZIA ===========
  delete from preventivo_righe where preventivo_id in (v_prev, v_nuova);
  delete from preventivi where id = v_nuova;
  delete from preventivi where id = v_prev;
  delete from recipe_ingredients
    where recipe_id in (select id from recipes where name like '__VERIFICA__ prev%')
       or component_recipe_id in (select id from recipes where name like '__VERIFICA__ prev%');
  delete from storico_costi_ricetta
    where recipe_id in (select id from recipes where name like '__VERIFICA__ prev%');
  delete from recipes where name like '__VERIFICA__ prev%';
  delete from ingredients where name like '__VERIFICA__ prev%';

  select count(*) into v_lap_d from deleted_records;
  if v_lap_d <> v_lap_p then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.', v_lap_d - v_lap_p;
  end if;
  if exists (select 1 from preventivi where cliente_nome like '__VERIFICA__%')
     or exists (select 1 from recipes where name like '__VERIFICA__ prev%') then
    raise exception 'La verifica ha lasciato delle righe finte.';
  end if;
  if (select food_cost_obiettivo_percento from service_settings where id = 1) is distinct from v_ric then
    raise exception 'La verifica ha lasciato il food cost obiettivo cambiato.';
  end if;

  -- 10 . E il costo nudo NON e' una porta: la rete dei permessi conta le
  --      funzioni che scavalcano la RLS senza chiedere chi sei, e questa non
  --      deve comparirci.
  if has_function_privilege('authenticated', 'costo_cibo_preventivo(uuid)', 'execute') then
    raise exception 'costo_cibo_preventivo e'' eseguibile dallo staff: il suo portiere sta in un''altra funzione.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Il preventivo esiste: costo dalla catena, food cost obiettivo sul solo cibo, porzioni sull''evento e versioni collegate.';
end $verifica$;

-- 🔴 IL VALORE DECISO DA ALESSIO: food cost al 25%, cioe' 10 € di cibo si
-- propongono a 40 € a persona — il costo per QUATTRO.
-- ⚠️ Lui l'aveva detto come «400%», intendendo questo: il numero giusto e'
-- quello che porta 10 a 40, non a 50. E' precisamente l'ambiguita' su cui ci
-- si e' fermati a chiedere, ed e' il motivo per cui la colonna non si chiama
-- «ricarico»: scritta come food cost obiettivo, quel dubbio non si presenta.
-- ⚠️ Si scrive solo se e' ancora vuota: e' un valore di partenza, e
-- riapplicando la migrazione non deve riportare indietro una sua scelta.
update service_settings
   set food_cost_obiettivo_percento = 25
 where id = 1 and food_cost_obiettivo_percento is null;

insert into applied_migrations (version, name)
values ('20260820000006', 'il_preventivo_esiste')
on conflict (version) do nothing;
