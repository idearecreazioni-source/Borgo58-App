-- ============================================================================
-- IL PRODOTTO È UNA COSA, L'INGREDIENTE UN'ALTRA — 27/08/2026
-- ============================================================================
--
-- Blocco 1 del mandato sulla separazione prodotto / ingrediente. Il disegno
-- sta in `docs/referti/20260827_prodotto_e_ingrediente.md`, scritto PRIMA di
-- questa migrazione e confrontato voce per voce con `docs/DECISIONI.md`.
--
-- ----------------------------------------------------------------------------
-- COSA DIVENTA COSA
-- ----------------------------------------------------------------------------
-- `articoli_fornitore` DIVENTA IL PRODOTTO, e non nasce una tabella nuova.
-- Il discriminante è quello del 17/08: le due direbbero *esattamente* la
-- stessa cosa — «una versione acquistabile di un ingrediente, riconoscibile
-- da una descrizione» — quindi una seconda tabella sarebbe un doppione.
--
-- Misurato prima di decidere: `articoli_fornitore` esiste dal 12/08 e ha
-- **ZERO righe su tutti e due i database**, e `price_history.articolo_id` è
-- vuoto in tutte le 115 righe della prova. L'infrastruttura c'era ed era
-- muta, perché `trova_o_crea_ingrediente` — la porta dell'assistente —
-- cerca fra gli INGREDIENTI e, non trovando, **crea un ingrediente**.
-- Da lì i 133 ingredienti della prova con 20 in «altro».
--
-- ----------------------------------------------------------------------------
-- IL FOOD COST NON PUÒ ROMPERSI IN SILENZIO, E QUESTA È LA RAGIONE
-- ----------------------------------------------------------------------------
-- Misurato: il food cost di ogni ricetta dipende da **una sola colonna**,
-- `ingredients.current_price`, attraverso
-- `v_recipe_costs` → `v_recipe_row_costs` → `espansione_costo_ricetta`.
--
-- ⚠️ QUESTA MIGRAZIONE NON TOCCA NESSUNA DELLE TRE. Cambia soltanto **chi
--    riempie** quel numero: `current_price` diventa un RIFLESSO del prezzo
--    dell'ultima versione entrata in magazzino (decisione del 25/08),
--    scritto **solo da un trigger** e definito in **una** funzione, al posto
--    delle cinque strade di oggi.
--
-- ⚠️ E NON C'È NESSUNA SANATORIA, per decisione del 25/08: il gestionale
--    verrà resettato prima dell'uso vero. Quindi le 491 righe di costo dei
--    lotti già presenti sulla prova **non vengono ripassate**, e la somma
--    dei food cost resta quella misurata prima (481,7078 su 106 ricette).
--    Un backfill qui non avrebbe dimostrato niente su dati finti, e avrebbe
--    fatto muovere ogni numero senza una ragione da dire a parole.
--
-- ----------------------------------------------------------------------------
-- LA TERZA RISPOSTA
-- ----------------------------------------------------------------------------
-- `ingredients.prezzo_da` nasce VUOTA e resta ammessa vuota: le risposte sono
-- **tre** — il prezzo viene da un prodotto entrato, l'ha scritto Alessio a
-- mano, oppure **non l'ha ancora detto nessuno**. Un predefinito qui
-- risponderebbe al posto di chi usa il gestionale (lezione del 14/08), e un
-- prezzo a mano indistinguibile da uno misurato è la forma di difetto che
-- questo progetto ha già incontrato tre volte.
--
-- ----------------------------------------------------------------------------
-- LA TRAPPOLA DEI DUE LOTTI NELLO STESSO ISTANTE, CHIUSA PRIMA CHE MORDA
-- ----------------------------------------------------------------------------
-- «L'ultima versione entrata» si ordina per `received_at`, che è la data di
-- ricevimento e **può pareggiare**: un carico da fattura con due righe dello
-- stesso prodotto scrive due lotti nella stessa transazione, quindi con lo
-- stesso `now()`. Ordinando poi per `id` — che è casuale — il riflesso
-- avrebbe scelto **a caso** quale prezzo comanda.
--
-- ⚠️ Misurato: sulla prova le coppie (ingrediente, istante) con più di un
--    lotto sono **ZERO** oggi. La trappola non morde ancora ed è armata in
--    avanti, ed è la stessa che il 20/08 ha morso lo storico dei costi —
--    *«una trappola scritta non è una trappola chiusa»*. Si chiude con un
--    progressivo che cresce da sé, come dice la cura di quel giorno.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Il prodotto acquista quello che gli manca
-- ----------------------------------------------------------------------------
alter table articoli_fornitore add column if not exists marca text;
alter table articoli_fornitore add column if not exists nome_esteso text;
alter table articoli_fornitore add column if not exists formato text;

comment on table articoli_fornitore is
  'IL PRODOTTO: una versione acquistabile di un ingrediente — marca, formato, '
  'come la chiama il fornitore e come la chiama Alessio. Un ingrediente ne ha '
  'tante; la giacenza segue l''ingrediente, non la versione (decisione del '
  '25/08/2026). Il fornitore puo'' essere vuoto: la spesa spicciola al '
  'supermercato non ne ha, e l''indice unico lo ammette gia''.';

comment on column articoli_fornitore.marca is
  'La marca, quando c''e''. VUOTA e'' normale: lo sfuso e la spesa spicciola non '
  'ne hanno, e pretenderla farebbe scrivere parole finte per passare oltre.';

comment on column articoli_fornitore.nome_esteso is
  'Il nome per esteso ricavato da una sigla di scontrino («MAION SG 500» -> '
  '«maionese»), per ritrovare il prodotto. Decisione di Alessio del 25/08/2026.';

comment on column articoli_fornitore.formato is
  'Il nome del formato in parole: «cassa da 6 kg», «bottiglia da 1 L». NON e'' '
  'la conversione — quella e'' `unita_fattura` + `fattore`, che servono a fare '
  'i conti. Questo serve a riconoscere la confezione con gli occhi.';

-- ----------------------------------------------------------------------------
-- 2. Il lotto sa quale versione è entrata
-- ----------------------------------------------------------------------------
-- ⚠️ `restrict` e non `set null`: un prodotto che è entrato in magazzino ha
--    generato un effetto, e la regola del 16/08 dice che non si cancella e
--    basta. Scollegarlo lascerebbe il lotto a non saper dire quale versione
--    era — cioè perderebbe in silenzio proprio il dato che questa colonna
--    esiste per conservare.
alter table stock_lots add column if not exists articolo_id uuid
  references articoli_fornitore(id) on delete restrict;

create index if not exists idx_stock_lots_articolo on stock_lots (articolo_id);

comment on column stock_lots.articolo_id is
  'Quale VERSIONE del prodotto e'' entrata con questo lotto. Vuoto quando non '
  'si sa (carico a mano senza prodotto). Il FEFO non la guarda: continua a '
  'prendere il lotto che scade prima, quindi «scende la versione piu'' vecchia '
  'ancora buona» (25/08/2026) resta vero per costruzione.';

-- ⚠️ Il progressivo chiude la trappola del pareggio di istante. Le 499 righe
--    già presenti lo ricevono in un ordine qualunque, e va detto: fra loro
--    `received_at` non pareggia mai (misurato: zero coppie), quindi
--    l'ordinamento non dipende da quei valori.
alter table stock_lots add column if not exists progressivo bigint
  generated by default as identity;

comment on column stock_lots.progressivo is
  'Ordine di scrittura, cresce da se''. Serve a rompere i pareggi di '
  '`received_at`: due lotti scritti nella stessa transazione hanno lo stesso '
  'istante, e ordinare per `id` sceglierebbe a caso quale prezzo comanda.';

-- ----------------------------------------------------------------------------
-- 3. Da dove viene il prezzo — tre risposte, non due
-- ----------------------------------------------------------------------------
alter table ingredients add column if not exists prezzo_da text;

do $vincolo$
begin
  if not exists (select 1 from pg_constraint where conname = 'ingredients_prezzo_da_check') then
    alter table ingredients add constraint ingredients_prezzo_da_check
      check (prezzo_da is null or prezzo_da in ('prodotto', 'a_mano'));
  end if;
end $vincolo$;

comment on constraint ingredients_prezzo_da_check on ingredients is
  'Da dove viene il prezzo si dice in un modo solo: «prodotto» (l''ultima '
  'versione entrata in magazzino) o «a_mano» (l''ha scritto Alessio).';

comment on column ingredients.prezzo_da is
  'Chi ha deciso `current_price`. «prodotto» = riflesso dell''ultima versione '
  'entrata in magazzino, scritto dal trigger. «a_mano» = l''ha scritto Alessio. '
  'VUOTO = nessuno l''ha ancora detto, ed e'' il terzo stato: un predefinito '
  'qui risponderebbe al posto suo, e un prezzo a mano indistinguibile da uno '
  'misurato e'' un dato che non si puo'' mettere in dubbio.';

-- ----------------------------------------------------------------------------
-- 4. Un solo posto dove si decide quale prezzo comanda
-- ----------------------------------------------------------------------------
create or replace function prezzo_ultima_versione(p_ingredient_id uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  -- L'ULTIMA versione entrata, non la media e non la minima: e'' la
  -- decisione del 25/08/2026 sul food cost. `progressivo` rompe il pareggio
  -- di istante invece di lasciarlo all'`id`, che e'' casuale.
  select l.unit_cost
    from stock_lots l
   where l.ingredient_id = p_ingredient_id
     and l.unit_cost is not null
   order by l.received_at desc, l.progressivo desc
   limit 1;
$$;

revoke all on function prezzo_ultima_versione(uuid) from public, anon, authenticated;
grant execute on function prezzo_ultima_versione(uuid) to authenticated;

comment on function prezzo_ultima_versione(uuid) is
  'Il prezzo dell''ULTIMA versione entrata in magazzino per questo '
  'ingrediente. Vuoto se nessun lotto porta un costo — e vuoto NON e'' zero: '
  'uno zero si leggerebbe «questo ingrediente e'' gratis».';

-- ----------------------------------------------------------------------------
-- 5. Il riflesso: lo scrive un trigger, mai l'applicazione
-- ----------------------------------------------------------------------------
-- ⚠️ `security definer` per NECESSITÀ, come le funzioni degli altri riflessi:
--    lo staff registra una consegna e su `ingredients` non ha la scrittura.
--    Senza, un carico fatto in cucina non muoverebbe il prezzo — e non
--    darebbe nessun errore.
create or replace function rispecchia_prezzo_ingrediente()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ing    uuid;
  v_prezzo numeric;
begin
  v_ing := coalesce(new.ingredient_id, old.ingredient_id);
  v_prezzo := prezzo_ultima_versione(v_ing);

  -- ⚠️ Vuoto NON azzera: un lotto senza costo non e'' un prezzo di zero, e
  --    cancellare il prezzo che c'era renderebbe gratis l'ingrediente in
  --    ogni ricetta che lo usa. Se non c'e'' niente da rispecchiare, si
  --    lascia stare quello che c'e'' — compreso un prezzo scritto a mano.
  if v_prezzo is null then
    return null;
  end if;

  update ingredients
     set current_price = v_prezzo,
         prezzo_da     = 'prodotto',
         updated_at    = now()
   where id = v_ing
     and (current_price is distinct from v_prezzo or prezzo_da is distinct from 'prodotto');

  return null;
end;
$$;

revoke all on function rispecchia_prezzo_ingrediente() from public, anon, authenticated;

drop trigger if exists trg_rispecchia_prezzo on stock_lots;
create trigger trg_rispecchia_prezzo
  after insert or update of unit_cost, received_at, ingredient_id or delete
  on stock_lots
  for each row execute function rispecchia_prezzo_ingrediente();

comment on function rispecchia_prezzo_ingrediente() is
  'Scrive il riflesso `ingredients.current_price` dal prezzo dell''ultima '
  'versione entrata. E'' l''UNICO posto da cui il riflesso si scrive: '
  'l''applicazione non lo tocca. `security definer` perche'' lo staff registra '
  'una consegna senza avere la scrittura su `ingredients`.';

-- ----------------------------------------------------------------------------
-- 6. La strada a mano resta, e ora DICE di essere a mano
-- ----------------------------------------------------------------------------
-- ⚠️ Non e'' una scappatoia: le ricette si caricano PRIMA dei prodotti
--    (decisione del 25/08), quindi un ingrediente senza nessun lotto deve
--    poter avere un prezzo scritto da Alessio. Senza, il suo food cost e''
--    zero — e uno zero non e'' una risposta.
-- ⚠️ Il corpo di partenza e'' stato preso dal DATABASE, non dal file che l'ha
--    creata (regola del 18/08): fra i due ci stanno tutte le migrazioni che
--    l'hanno toccata.
create or replace function update_ingredient_price(
  p_ingredient_id uuid,
  p_new_price numeric,
  p_source price_source default 'manuale'::price_source,
  p_note text default null,
  p_supplier_id uuid default null,
  p_articolo_id uuid default null
) returns void
language plpgsql
set search_path to 'public'
as $$
begin
  update ingredients
     set current_price = p_new_price,
         prezzo_da     = 'a_mano',
         updated_at    = now()
   where id = p_ingredient_id;

  if not found then
    raise exception 'Ingrediente % inesistente', p_ingredient_id;
  end if;

  insert into price_history (ingredient_id, price, supplier_id, source, note, articolo_id)
  values (p_ingredient_id, p_new_price, p_supplier_id, p_source, p_note, p_articolo_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. La media e l'andamento si LEGGONO, non si conservano
-- ----------------------------------------------------------------------------
-- Decisione del 25/08: servono ENTRAMBI — l'ultima versione per il food cost,
-- media e trend per vedere come cambiano le cose. Una funzione sola risponde
-- per ingrediente E per versione, cosi'' le sezioni la chiamano invece di
-- rifarsi il conto (stesso patto di `orderTotals()`).
create or replace function andamento_prezzo(
  p_ingredient_id uuid,
  p_articolo_id uuid default null
) returns table (
  quante        integer,
  primo         numeric,
  ultimo        numeric,
  medio         numeric,
  minimo        numeric,
  massimo       numeric,
  dal           timestamptz,
  al            timestamptz,
  variazione    numeric
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with righe as (
    select ph.price, ph.recorded_at
      from price_history ph
     where ph.ingredient_id = p_ingredient_id
       and (p_articolo_id is null or ph.articolo_id = p_articolo_id)
  ), estremi as (
    select
      (select price from righe order by recorded_at asc  limit 1) as primo,
      (select price from righe order by recorded_at desc limit 1) as ultimo
  )
  select
    count(*)::integer,
    e.primo,
    e.ultimo,
    round(avg(r.price), 4),
    min(r.price),
    max(r.price),
    min(r.recorded_at),
    max(r.recorded_at),
    -- ⚠️ La variazione si misura dal PIU'' VECCHIO, non dal minimo: un numero
    --    scelto per fare effetto e'' un numero di cui non ci si fida
    --    (regola del 12/08 sulla sorveglianza dei rincari).
    case when e.primo is null or e.primo = 0 then null
         else round((e.ultimo - e.primo) / e.primo * 100, 2) end
  from righe r cross join estremi e
  group by e.primo, e.ultimo
  having count(*) > 0;
$$;

revoke all on function andamento_prezzo(uuid, uuid) from public, anon, authenticated;
grant execute on function andamento_prezzo(uuid, uuid) to authenticated;

comment on function andamento_prezzo(uuid, uuid) is
  'Media, estremi e variazione dei prezzi di un ingrediente, o di una sua '
  'sola versione se si passa `p_articolo_id`. Legge `price_history`: nessun '
  'numero viene conservato, cosi'' non puo'' divergere. Restituisce ZERO RIGHE '
  'quando non c''e'' nessuno storico — chi chiama deve dire «non lo so», non '
  'mostrare zeri.';

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- ⚠️ COSTRUISCE TUTTO QUELLO CHE LE SERVE e non prende in prestito niente:
--    gira su un gestionale VUOTO, che in produzione e'' lo stato normale
--    (misurato il 27/08: zero ingredienti, zero prodotti, zero lotti).
--    E'' la quarta ricomparsa della trappola del 16/08 — *un esempio si
--    costruisce, non si prende in prestito*.
do $verifica$
declare
  v_foto     jsonb;
  v_ente     uuid;
  v_ing      uuid;
  v_ing2     uuid;
  v_forn     uuid;
  v_art_a    uuid;
  v_art_b    uuid;
  v_lotto    uuid;
  v_ricetta  uuid;
  v_riga     uuid;
  v_miei_ing uuid[] := '{}';
  v_miei_art uuid[] := '{}';
  v_miei_lot uuid[] := '{}';
  v_miei_ric uuid[] := '{}';
  v_miei_for uuid[] := '{}';
  v_prezzo   numeric;
  v_da       text;
  v_costo    numeric;
  v_n        integer;
  v_and      record;
begin
  v_foto := foto_righe();

  select id into v_ente from entities order by created_at limit 1;
  if v_ente is null then
    raise exception 'Verifica impossibile: nessuna societa'' configurata';
  end if;

  -- ------------------------------------------------------------------
  -- Si costruisce l'esempio: un ingrediente, due versioni, un fornitore
  -- ------------------------------------------------------------------
  insert into suppliers (entity_id, name) values (v_ente, 'Fornitore di verifica 20260827000018')
    returning id into v_forn;
  v_miei_for := v_miei_for || v_forn;

  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'Olio di verifica 20260827000018', 'olio_condimenti', 'l')
  returning id into v_ing;
  v_miei_ing := v_miei_ing || v_ing;

  insert into articoli_fornitore (supplier_id, descrizione, chiave, ingredient_id,
                                  marca, formato, unita_fattura, fattore)
  values (v_forn, 'OLIO EVO LATTINA 5 L', 'olio evo lattina 5 l', v_ing,
          'Marca di verifica', 'lattina da 5 L', 'lattina', 5)
  returning id into v_art_a;
  v_miei_art := v_miei_art || v_art_a;

  insert into articoli_fornitore (supplier_id, descrizione, chiave, ingredient_id,
                                  marca, formato, unita_fattura, fattore)
  values (v_forn, 'OLIO EVO BOTTIGLIA 1 L', 'olio evo bottiglia 1 l', v_ing,
          'Marca di nicchia', 'bottiglia da 1 L', 'bottiglia', 1)
  returning id into v_art_b;
  v_miei_art := v_miei_art || v_art_b;

  -- ------------------------------------------------------------------
  -- 1. Il prezzo a mano DICE di essere a mano
  -- ------------------------------------------------------------------
  perform update_ingredient_price(v_ing, 9.80, 'manuale', 'verifica: a mano');
  select current_price, prezzo_da into v_prezzo, v_da from ingredients where id = v_ing;
  if v_prezzo <> 9.80 or v_da is distinct from 'a_mano' then
    raise exception 'Il prezzo a mano non si registra come tale: % / %', v_prezzo, v_da;
  end if;

  -- ------------------------------------------------------------------
  -- 2. UN CARICO CHE ARRIVA A UN PREZZO DIVERSO MUOVE IL FOOD COST
  --    (oggi non lo faceva: `register_stock_delivery` non toccava il prezzo)
  -- ------------------------------------------------------------------
  insert into stock_lots (ingredient_id, supplier_id, articolo_id,
                          quantity_received, quantity_remaining, unit_cost, received_at)
  values (v_ing, v_forn, v_art_a, 10, 10, 8.50, now() - interval '2 days')
  returning id into v_lotto;
  v_miei_lot := v_miei_lot || v_lotto;

  select current_price, prezzo_da into v_prezzo, v_da from ingredients where id = v_ing;
  if v_prezzo <> 8.50 or v_da is distinct from 'prodotto' then
    raise exception 'Il carico non ha mosso il prezzo: % / %', v_prezzo, v_da;
  end if;

  -- ------------------------------------------------------------------
  -- 3. DUE VERSIONI A PREZZI DIVERSI: comanda l'ULTIMA ENTRATA,
  --    non la media (che sarebbe 10,25) e non la minima (8,50)
  -- ------------------------------------------------------------------
  insert into stock_lots (ingredient_id, supplier_id, articolo_id,
                          quantity_received, quantity_remaining, unit_cost, received_at)
  values (v_ing, v_forn, v_art_b, 6, 6, 12.00, now() - interval '1 day')
  returning id into v_lotto;
  v_miei_lot := v_miei_lot || v_lotto;

  select current_price into v_prezzo from ingredients where id = v_ing;
  if v_prezzo <> 12.00 then
    raise exception 'Non comanda l''ultima versione entrata: % (media 10,25, minima 8,50)', v_prezzo;
  end if;

  -- ------------------------------------------------------------------
  -- 4. IL PAREGGIO DI ISTANTE non sceglie a caso
  --    Due lotti con lo STESSO `received_at`: vince quello scritto dopo.
  -- ------------------------------------------------------------------
  insert into stock_lots (ingredient_id, articolo_id, quantity_received,
                          quantity_remaining, unit_cost, received_at)
  values (v_ing, v_art_a, 1, 1, 20.00, '2026-08-27 09:00:00+02')
  returning id into v_lotto;
  v_miei_lot := v_miei_lot || v_lotto;

  insert into stock_lots (ingredient_id, articolo_id, quantity_received,
                          quantity_remaining, unit_cost, received_at)
  values (v_ing, v_art_b, 1, 1, 21.00, '2026-08-27 09:00:00+02')
  returning id into v_lotto;
  v_miei_lot := v_miei_lot || v_lotto;

  select current_price into v_prezzo from ingredients where id = v_ing;
  if v_prezzo <> 21.00 then
    raise exception 'Il pareggio di istante sceglie a caso: % invece di 21,00', v_prezzo;
  end if;

  -- ------------------------------------------------------------------
  -- 5. UN LOTTO SENZA COSTO NON AZZERA IL PREZZO
  --    Il caso e'' vero: lo staff registra una consegna senza poterne
  --    scrivere il costo, e un prezzo azzerato renderebbe gratis
  --    l'ingrediente in ogni ricetta che lo usa.
  -- ------------------------------------------------------------------
  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining,
                          unit_cost, received_at)
  values (v_ing, 3, 3, null, now())
  returning id into v_lotto;
  v_miei_lot := v_miei_lot || v_lotto;

  select current_price into v_prezzo from ingredients where id = v_ing;
  if v_prezzo <> 21.00 then
    raise exception 'Un lotto senza costo ha spostato il prezzo: %', v_prezzo;
  end if;

  -- ------------------------------------------------------------------
  -- 6. UN INGREDIENTE SENZA NESSUN PREZZO NON DICE ZERO: dice VUOTO
  -- ------------------------------------------------------------------
  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'Ingrediente muto 20260827000018', 'altro', 'kg')
  returning id into v_ing2;
  v_miei_ing := v_miei_ing || v_ing2;

  if prezzo_ultima_versione(v_ing2) is not null then
    raise exception 'Senza lotti il prezzo dell''ultima versione dovrebbe essere vuoto';
  end if;
  select prezzo_da into v_da from ingredients where id = v_ing2;
  if v_da is not null then
    raise exception 'Un ingrediente appena nato dichiara una provenienza del prezzo: %', v_da;
  end if;

  -- ------------------------------------------------------------------
  -- 7. IL FOOD COST SEGUE, e la formula non e'' cambiata
  -- ------------------------------------------------------------------
  insert into recipes (name, category, portions_yield)
  values ('Ricetta di verifica 20260827000018', 'antipasto', 1)
  returning id into v_ricetta;
  v_miei_ric := v_miei_ric || v_ricetta;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_ricetta, v_ing, 2, 'l')
  returning id into v_riga;

  select food_cost_base into v_costo from v_recipe_costs where recipe_id = v_ricetta;
  if v_costo <> 42.0000 then
    raise exception 'Il food cost non segue il prezzo dell''ultima versione: % invece di 42,0000', v_costo;
  end if;

  -- ⚠️ Un prodotto SENZA prezzo che entra in un food cost: la riga vale zero
  --    e il totale non deve mentire dicendo che il piatto costa meno.
  --    Lo si CONSTATA, perche'' e'' il caso in cui uno zero e'' plausibile.
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_ricetta, v_ing2, 1, 'kg');
  select food_cost_base into v_costo from v_recipe_costs where recipe_id = v_ricetta;
  if v_costo <> 42.0000 then
    raise exception 'Un ingrediente senza prezzo ha cambiato il totale: %', v_costo;
  end if;

  -- ------------------------------------------------------------------
  -- 8. MEDIA E ANDAMENTO
  -- ------------------------------------------------------------------
  select * into v_and from andamento_prezzo(v_ing);
  if v_and.quante is null or v_and.quante < 1 then
    raise exception 'L''andamento non trova lo storico che abbiamo scritto';
  end if;
  if v_and.primo <> 9.80 then
    raise exception 'L''andamento non parte dal piu'' vecchio: %', v_and.primo;
  end if;

  select count(*) into v_n from andamento_prezzo(v_ing2);
  if v_n <> 0 then
    raise exception 'Senza storico l''andamento deve restituire ZERO righe, non zeri: %', v_n;
  end if;

  -- ------------------------------------------------------------------
  -- 9. Un prodotto entrato in magazzino non si cancella e basta
  -- ------------------------------------------------------------------
  begin
    delete from articoli_fornitore where id = v_art_a;
    raise exception 'Si e'' potuto cancellare un prodotto che ha dei lotti';
  exception
    when foreign_key_violation then null;
  end;

  -- ------------------------------------------------------------------
  -- Si riporta via tutto quello che ha costruito, per identificativo
  -- ------------------------------------------------------------------
  delete from recipe_ingredients where recipe_id = any(v_miei_ric);
  delete from recipes where id = any(v_miei_ric);
  delete from stock_lots where id = any(v_miei_lot);
  delete from articoli_fornitore where id = any(v_miei_art);
  delete from price_history where ingredient_id = any(v_miei_ing);
  delete from ingredients where id = any(v_miei_ing);
  delete from suppliers where id = any(v_miei_for);
  -- ⚠️ `record_id` è TESTO, non uuid: il cast è obbligatorio.
  delete from deleted_records
   where record_id = any((v_miei_ing || v_miei_art || v_miei_lot || v_miei_ric || v_miei_for)::text[]);

  perform pretendi_nessun_residuo(v_foto, 'la separazione prodotto / ingrediente');

  raise notice 'Il prodotto e'' una cosa e l''ingrediente un''altra: il riflesso segue l''ultima versione entrata, il pareggio di istante non sceglie a caso, un lotto senza costo non azzera niente, e senza storico l''andamento non inventa zeri.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000018', 'il_prodotto_e_una_cosa_l_ingrediente_un_altra') on conflict (version) do nothing;
