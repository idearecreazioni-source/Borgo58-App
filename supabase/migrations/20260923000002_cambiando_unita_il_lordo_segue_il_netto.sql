-- =====================================================================
-- CAMBIANDO UNITA', IL LORDO SEGUE IL NETTO — 23/09/2026
-- =====================================================================
--
-- 🔴 IL BUCO, trovato da una rete che esisteva gia'. R12 ha aggiunto
--    `recipe_ingredients.quantita_lorda`, e il censimento delle unita'
--    (`colonne_unita_non_classificate`) e' diventato rosso da solo: una
--    colonna numerica legata a un ingrediente era rimasta fuori.
--
-- ⚠️ E NON ERA UN DIFETTO DI SOLO ELENCO. Quel censimento e' il promemoria
--    di cosa va convertito: `converti_numeri_dell_unita` moltiplica
--    `quantity` per il fattore, e `quantita_lorda` no. Cambiando l'unita'
--    di un prodotto — da chili a grammi — il netto sarebbe diventato mille
--    volte piu' grande e il lordo sarebbe rimasto dov'era.
--
-- 🔴 E IL DANNO NON SAREBBE STATO UN NUMERO STORTO: sarebbe stato IL
--    CAMBIO D'UNITA' CHE FALLISCE, o uno scarto inventato.
--    `quantita_lorda >= quantity` e' un vincolo: convertendo verso l'alto
--    il solo netto, quasi tutte le righe verrebbero respinte. E dove
--    passasse — convertendo verso il basso — lo scarto riflesso
--    cambierebbe DA SOLO, perche' e' il rapporto fra i due numeri.
--    *Un piatto si ritroverebbe uno scarto diverso senza che nessuno
--    l'abbia toccato*, ed e' precisamente cio' che R12 esiste per
--    impedire.
--
-- ---------------------------------------------------------------------
-- COSA CAMBIA, E COSA NO
-- ---------------------------------------------------------------------
-- ⚠️ SI CAMBIA LA REGOLA DEI CAMBI FUTURI, NON I DATI DI OGGI. Questa
--    migrazione non converte e non riscrive nessuna riga: le quantita'
--    esistenti restano esattamente come sono. Cambia cosa succedera' la
--    prossima volta che qualcuno cambia l'unita' di un prodotto.
--
-- ⚠️ E I DUE NUMERI SI CONVERTONO NELLA STESSA `update`, non in due. Il
--    riflesso scatta a ogni scrittura: fra un'istruzione e l'altra la riga
--    passerebbe per uno stato in cui netto e lordo non si corrispondono, e
--    lo scarto verrebbe ricalcolato proprio su quello stato intermedio.
--
-- ⚠️ I DUE CORPI SONO PRESI DAL CORPO VIVO (regola del 18/08), e cambiano
--    per una riga ciascuno: fra la migrazione che ha creato una funzione e
--    il suo corpo di oggi ci stanno tutte quelle che l'hanno toccata nel
--    mezzo. Sono conservati `security definer`, il percorso di ricerca e i
--    permessi — `create or replace` non li azzera, e riscriverli a memoria
--    sarebbe la trappola del 24/08.
--
-- ⚠️ E NON SI TOCCANO R12 ne' la riparazione della RLS: sono gia'
--    registrate sul progetto di prova, e *una migrazione gia' applicata
--    non si riscrive mai* (23/08). Si ripara in avanti.

-- ---------------------------------------------------------------------
-- 1. LA CONVERSIONE PORTA CON SE' IL LORDO
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.converti_numeri_dell_unita()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_f numeric;
begin
  if new.unit = old.unit then
    return null;
  end if;

  v_f := unita_conversione(old.unit::text, new.unit::text);

  -- Nessuna conversione definita: il portiere ha lasciato passare solo
  -- perche' non c'era niente attaccato. Restano le etichette da allineare.
  if v_f is null then
    v_f := 1;
  end if;

  -- --- quantita': si moltiplicano ---
  update ingredients set stock_minimum_threshold = stock_minimum_threshold * v_f
   where id = new.id and stock_minimum_threshold is not null;

  -- 🔴 IL LORDO SI CONVERTE INSIEME AL NETTO, e nella STESSA istruzione.
  --    Sono due pesi della stessa cosa nella stessa unita': se se ne
  --    convertisse uno solo, il rapporto fra i due cambierebbe — e con lui
  --    lo scarto, che ne e' il riflesso. Un piatto si ritroverebbe uno
  --    scarto diverso senza che nessuno l'abbia toccato.
  -- ⚠️ E nella stessa `update`, non in due: il riflesso scatta a ogni
  --    scrittura, e fra un'istruzione e l'altra la riga passerebbe per uno
  --    stato in cui i due numeri non si corrispondono.
  update recipe_ingredients set quantity = quantity * v_f,
                                quantita_lorda = quantita_lorda * v_f,
                                unit = new.unit
   where ingredient_id = new.id;

  update stock_lots set quantity_received  = quantity_received  * v_f,
                        quantity_remaining = quantity_remaining * v_f
   where ingredient_id = new.id;

  update stock_consumptions set quantity = quantity * v_f,
      quantita_senza_costo = quantita_senza_costo * v_f,
                                quantita_richiesta = quantita_richiesta * v_f
   where ingredient_id = new.id;

  update shopping_list_items set quantity_needed   = quantity_needed   * v_f,
                                 quantita_arrivata = quantita_arrivata * v_f,
                                 unit = new.unit
   where ingredient_id = new.id;

  update anomalie_scarico set quantita_mancante = quantita_mancante * v_f
   where ingredient_id = new.id;

  update ordini_fornitore_righe set quantita_base = quantita_base * v_f,
                                    unita_base = new.unit::text
   where ingredient_id = new.id;

  update rettifiche_giacenza set atteso     = atteso     * v_f,
                                 dichiarato = dichiarato * v_f,
                                 differenza = differenza * v_f
   where ingredient_id = new.id;

  update intercompany_cessions set quantity = quantity * v_f, unit = new.unit
   where ingredient_id = new.id;

  update crops set harvested_quantity = harvested_quantity * v_f, unit = new.unit
   where ingredient_id = new.id;

  update produzioni set quantita_ottenuta = quantita_ottenuta * v_f,
                        resa_attesa       = resa_attesa       * v_f,
                        unita = new.unit::text
   where ingredient_id = new.id;

  -- --- prezzi per unita': si DIVIDONO ---
  update ingredients set current_price = current_price / v_f
   where id = new.id and current_price is not null;

  update price_history set price = price / v_f where ingredient_id = new.id;

  update stock_lots set unit_cost = unit_cost / v_f
   where ingredient_id = new.id and unit_cost is not null;

  update intercompany_cessions set unit_price = unit_price / v_f
   where ingredient_id = new.id;

  update ordini_fornitore_righe set prezzo_atteso = prezzo_atteso / v_f
   where ingredient_id = new.id and prezzo_atteso is not null;

  -- --- il fattore d'acquisto: una cassa da 6 kg e' una cassa da 6000 g ---
  update articoli_fornitore set fattore = fattore * v_f
   where ingredient_id = new.id and fattore is not null;

  -- --- la carta: quante porzioni da una unita' (30/08) ---
  -- ⚠️ SI DIVIDE, come i prezzi: e' un numero PER unita'. Sei calici da una
  --    bottiglia, ma 0,006 da un millesimo di bottiglia.
  -- ⚠️ E `selling_price` NON si tocca: e' quello che paga il cliente.
  update bar_items set porzioni_per_unita = porzioni_per_unita / v_f
   where ingredient_id = new.id and porzioni_per_unita is not null;

  return null;
end $function$;

-- ---------------------------------------------------------------------
-- 2. E IL CENSIMENTO IMPARA LA COLONNA NUOVA
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.colonne_unita_non_classificate()
 RETURNS TABLE(tabella text, colonna text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with conosciute(t, c) as (values
    -- si convertono: quantita'
    ('ingredients','stock_minimum_threshold'),
    ('recipe_ingredients','quantity'),
    -- 🔴 23/09: il LORDO della riga di ricetta, arrivato con R12. Sta fra
    --    le quantita' che SI CONVERTONO, accanto al netto: e' un peso
    --    nella stessa unita', e si comporta come sua sorella. Non e' un
    --    prezzo (che si dividerebbe) ne' una percentuale (che non si
    --    tocca). ⚠️ E i due si convertono NELLA STESSA istruzione: il
    --    rapporto fra loro e' lo scarto, e uno spostato senza l'altro lo
    --    cambierebbe da solo.
    ('recipe_ingredients','quantita_lorda'),
    ('stock_lots','quantity_received'), ('stock_lots','quantity_remaining'),
    ('stock_consumptions','quantity'), ('stock_consumptions','quantita_richiesta'),
    -- 30/08: quanta merce e' uscita da lotti senza prezzo. E' una QUANTITA'
    -- nell'unita' del prodotto, quindi segue l'unita' come le sue sorelle.
    ('stock_consumptions','quantita_senza_costo'),
    ('shopping_list_items','quantity_needed'), ('shopping_list_items','quantita_arrivata'),
    ('anomalie_scarico','quantita_mancante'), ('anomalie_scarico','quantita_richiesta'),
    ('ordini_fornitore_righe','quantita_base'),
    ('rettifiche_giacenza','atteso'), ('rettifiche_giacenza','dichiarato'),
    ('rettifiche_giacenza','differenza'),
    ('intercompany_cessions','quantity'),
    ('crops','harvested_quantity'),
    ('produzioni','quantita_ottenuta'), ('produzioni','resa_attesa'),
    -- si convertono: prezzi per unita' (si dividono) e il fattore
    ('ingredients','current_price'),
    ('stock_lots','unit_cost'),
    ('price_history','price'),
    ('intercompany_cessions','unit_price'),
    ('ordini_fornitore_righe','prezzo_atteso'),
    ('articoli_fornitore','fattore'),
    -- 🔴 30/08 — QUANTE PORZIONI DA UNA UNITA' DEL PRODOTTO. Si divide come
    --    un prezzo, e la ragione e' la stessa: se un caffe' passa da chili a
    --    grammi, «140 tazzine da un chilo» diventa 0,14 da un grammo. E' un
    --    numero PER unita', quindi si rimpicciolisce quando l'unita' si
    --    rimpicciolisce.
    ('bar_items','porzioni_per_unita'),
    -- NON si convertono, e la ragione e' la stessa per tutte: sono euro
    -- gia' spesi, percentuali o conteggi, e non cambiano con l'unita' di
    -- misura del prodotto.
    ('ingredients','waste_percentage_default'), ('recipe_ingredients','waste_percentage'),
    ('stock_consumptions','costo'), ('produzioni','costo'), ('produzioni','dosi'),
    ('intercompany_cessions','total_amount'), ('intercompany_cessions','vat_rate'),
    ('shopping_list_items','purchased_amount'),
    ('rettifiche_giacenza','valore'),
    -- ⚠️ 30/08 — IL PREZZO DI UNA VOCE DELLA CARTA NON SI CONVERTE: e' quello
    --    che il cliente paga per una porzione, deciso da Alessio, e non
    --    cambia perche' il magazzino misura il vino in un altro modo. Se si
    --    convertisse, cambiare unita' a un prodotto RISCRIVEREBBE la carta.
    ('bar_items','selling_price'),
    -- ⚠️ Il costo di una foto letta e' in EURO GIA' SPESI: se domani un
    -- prodotto passasse da chili a pezzi, quei centesimi resterebbero
    -- quelli. Non si converte.
    ('letture_foto','costo_euro'),
    -- ⚠️ La quantita' dell'ordine e' nell'unita' del FORNITORE (2 casse):
    -- e' quantita_base a parlare la lingua dell'ingrediente.
    ('ordini_fornitore_righe','quantita'),
    -- 🔴 31/08 — I CALICI DI UNA BOTTIGLIA APERTA **NON SI CONVERTONO**: sono
    --    un conteggio di porzioni servite, non una quantita' nell'unita' del
    --    prodotto. Sei calici restano sei calici che il magazzino misuri il
    --    vino in bottiglie o in litri.
    -- ⚠️ Da non confondere con `bar_items.porzioni_per_unita` qui sopra, che
    --    invece si converte: quello e' un numero PER unita' di prodotto,
    --    questi sono porzioni contate dentro una bottiglia sola.
    ('bottiglie_aperte','porzioni_totali'), ('bottiglie_aperte','porzioni_buttate')
  )
  select c.table_name::text, c.column_name::text
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
     and t.table_type = 'BASE TABLE'
   where c.table_schema = 'public'
     and c.data_type = 'numeric'
     and c.table_name in (
       select table_name from information_schema.columns
        where table_schema = 'public' and column_name = 'ingredient_id')
     and not exists (select 1 from conosciute k
                      where k.t = c.table_name and k.c = c.column_name)
   order by 1, 2;
$function$;

-- =====================================================================
-- VERIFICA
-- =====================================================================
-- ⚠️ Tutto dentro una sotto-transazione annullata (regola del 30/08): il
--    registro delle cancellazioni resta acceso e non nasce nessuna lapide
--    finta da togliere.
do $verifica$
declare
  v_foto   jsonb := foto_righe();
  v_ent    uuid;
  v_ing    uuid;
  v_ric    uuid;
  v_riga   uuid;
  v_netto  numeric;
  v_lordo  numeric;
  v_scarto numeric;
begin
  select id into v_ent from entities where entity_type = 'srls';
  if v_ent is null then raise exception 'Serve la societa'' per verificare.'; end if;

  begin  -- <<< la sotto-transazione che verra' annullata

    -- 1. Il censimento non ha piu' niente da dire.
    if exists (select 1 from colonne_unita_non_classificate()) then
      raise exception 'Restano colonne non classificate: %',
        (select string_agg(tabella || '.' || colonna, ', ')
           from colonne_unita_non_classificate());
    end if;

    -- 2. Una riga con uno scarto vero, e poi il cambio d'unita'.
    insert into ingredients (entity_id, name, category, unit, current_price)
    values (v_ent, 'ZZ verifica unita - cozze', 'pesce', 'kg', 10)
    returning id into v_ing;

    insert into recipes (name, category, portions_yield, recipe_type)
    values ('ZZ verifica unita - sugo', 'primo', 1, 'piatto_finito')
    returning id into v_ric;

    -- 1,5 kg che danno 0,4 kg netti: scarto 275%.
    insert into recipe_ingredients (recipe_id, ingredient_id, quantity, quantita_lorda, unit)
    values (v_ric, v_ing, 0.4000, 1.5000, 'kg')
    returning id into v_riga;

    select waste_percentage into v_scarto from recipe_ingredients where id = v_riga;
    if v_scarto is distinct from 275.00 then
      raise exception 'La riga di prova doveva avere scarto 275, ha %.', v_scarto;
    end if;

    -- 3. 🔴 IL CAMBIO D'UNITA': da chili a grammi, fattore 1000.
    update ingredients set unit = 'g' where id = v_ing;

    select quantity, quantita_lorda, waste_percentage
      into v_netto, v_lordo, v_scarto
      from recipe_ingredients where id = v_riga;

    -- ⚠️ I DUE SI SONO SPOSTATI INSIEME.
    if v_netto is distinct from 400.0000 then
      raise exception 'Il netto doveva diventare 400 g, e'' %.', v_netto;
    end if;
    if v_lordo is distinct from 1500.00000000 then
      raise exception 'Il lordo doveva diventare 1500 g, e'' % — il netto si e'' convertito e lui no.', v_lordo;
    end if;

    -- 🔴 E LO SCARTO NON SI E' MOSSO, che e' il punto: e' il rapporto fra i
    --    due, e due numeri moltiplicati per lo stesso fattore lo lasciano
    --    dov'era.
    if v_scarto is distinct from 275.00 then
      raise exception 'Lo scarto si e'' mosso cambiando unita'': era 275, adesso e'' %.', v_scarto;
    end if;

    -- 4. E l'unita' della riga ha seguito.
    if (select unit::text from recipe_ingredients where id = v_riga) is distinct from 'g' then
      raise exception 'L''unita'' della riga non ha seguito quella del prodotto.';
    end if;

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform pretendi_nessun_residuo(v_foto, 'la verifica del cambio unita'' col lordo');

  raise notice 'Fatto: cambiando unita'' netto e lordo si spostano insieme, e lo scarto resta dov''era. Provato e annullato: zero residui.';
end $verifica$;

-- La migrazione si registra da sé
insert into applied_migrations (version, name)
values ('20260923000002', 'cambiando_unita_il_lordo_segue_il_netto')
on conflict (version) do nothing;
