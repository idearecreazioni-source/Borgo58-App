-- =====================================================================
-- LE TRE COLONNE NUOVE DICHIARANO CHE FANNO QUANDO CAMBIA L'UNITA'
-- 30/08/2026
-- =====================================================================
--
-- 🔴 TROVATO DA UNA RETE, NON DA UNA RILETTURA. `cambio-unita.test.js` e'
-- diventata rossa da sola nominando tre colonne: `bar_items.selling_price`,
-- `bar_items.porzioni_per_unita` e `stock_consumptions.quantita_senza_costo`.
--
-- ⚠️ E DUE DELLE TRE NON LE HO NEMMENO CREATE IO IN QUESTA FAMIGLIA:
-- `selling_price` esisteva dal primo giorno della carta ed era invisibile al
-- censimento, perche' quel censimento guarda **le tabelle che hanno un
-- `ingredient_id`** — e `bar_items` non ce l'aveva. Attaccando la carta al
-- magazzino, una tabella intera e' entrata nel perimetro. *Una rete puo'
-- diventare piu' severa senza che nessuno la tocchi, semplicemente perche'
-- il mondo che sorveglia si e' allargato.*
--
-- 🔴 LE TRE RISPOSTE SONO DIVERSE, e sbagliarne una non darebbe nessun
-- errore — darebbe numeri storti in silenzio:
--   · `quantita_senza_costo` e' una QUANTITA' nell'unita' del prodotto:
--     si MOLTIPLICA come le sue sorelle (kg → g, ×1000);
--   · `porzioni_per_unita` e' un numero PER unita': si DIVIDE come un
--     prezzo. «140 tazzine da un chilo» diventa 0,14 da un grammo;
--   · `selling_price` NON SI TOCCA: e' quello che paga il cliente per una
--     porzione, deciso da Alessio. Se si convertisse, cambiare l'unita' di
--     misura di un prodotto **riscriverebbe la carta**.
--
-- ⚠️ Corpi presi dal database VIVO del progetto di prova (`--prova`): la
-- produzione stanotte e' indietro di sei migrazioni.
--
-- 🔴 E LA CONVERSIONE HA DIMOSTRATO CHE UN MIO VINCOLO DI STANOTTE ERA
-- SBAGLIATO — non l'ha trovato una rilettura, l'ha trovato la verifica
-- provando a cambiare l'unita' per davvero.
-- Avevo scritto `porzioni_per_unita > 1`, con la ragione che «una porzione
-- per confezione E' la bottiglia intera, cioe' due modi di dire la stessa
-- cosa». La ragione vale per un prodotto misurato **a pezzi**, ed e' l'unico
-- caso che avevo in testa. Portando un caffe' da chili a grammi, «8 tazzine
-- da un chilo» diventa **0,008 da un grammo** — legittimo, e il vincolo lo
-- **respingeva**: cambiare unita' a un prodotto sarebbe fallito con un
-- errore che non c'entrava niente.
-- ⚠️ E' la regola del 24/08 letta al contrario: *un limite che rifiuta anche
-- i casi buoni e' peggio di nessun limite*. Il limite scende a `> 0`, e la
-- cosa che voleva impedire — due modi di dire «si vende intera» — resta dove
-- appartiene: nella schermata, che propone il campo VUOTO.

-- ⚠️ CONSEGUENZA DA RICORDARE: la verifica della `20260830000002` prova
--    che il vincolo RIFIUTI il valore 1. Da qui in avanti non lo rifiuta
--    piu', quindi **rilanciare quella migrazione da sola fallirebbe**. Su
--    una ricostruzione da zero non succede: le migrazioni si applicano in
--    ordine di numero, e li' la 002 gira quando il vincolo stretto c'e'
--    ancora. Scritto qui perche' fra sei mesi non si rifaccia l'indagine.
alter table bar_items drop constraint if exists bar_items_porzioni_check;
alter table bar_items add constraint bar_items_porzioni_check
  check (porzioni_per_unita is null or porzioni_per_unita > 0);
comment on constraint bar_items_porzioni_check on bar_items is
  'Quante porzioni si ricavano da una confezione: dev''essere un numero maggiore di zero. Se questa voce si vende intera, lascia il campo vuoto.';



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
    ('ordini_fornitore_righe','quantita')
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

  update recipe_ingredients set quantity = quantity * v_f, unit = new.unit
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

do $verifica$
declare
  v_foto  jsonb := foto_righe();
  v_ent   uuid;
  v_ing   uuid;
  v_voce  uuid;
  v_n     integer;
  v_porz  numeric;
  v_prezzo numeric;
  v_corpo text;
begin
  select id into v_ent from entities order by created_at limit 1;
  if v_ent is null then raise exception 'Manca la societa'': impossibile verificare.'; end if;

  -- (1) IL CENSIMENTO NON HA PIU' NIENTE DA DIRE.
  select count(*) into v_n from colonne_unita_non_classificate();
  if v_n > 0 then
    raise exception 'Ci sono ancora % colonne numeriche legate a un prodotto senza classificazione.', v_n;
  end if;

  -- (2) LA CONVERSIONE FA DAVVERO LE TRE COSE DIVERSE, e si prova
  --     CAMBIANDO L'UNITA' per davvero — non leggendo il corpo. Un
  --     ingrediente mio, una voce di carta mia.
  --     ⚠️ I numeri sono scelti perche' le risposte sbagliate si vedano:
  --        da kg a g il fattore e' 1000, quindi 8 porzioni diventano 0,008
  --        e non 8000, e il prezzo resta 6,00 e non 0,006.
  insert into ingredients (name, category, unit, current_price, entity_id,
                           alimentare, tenuto_in_magazzino)
  values ('ZZ caffe di prova', 'bevande', 'kg', 20, v_ent, true, true)
  returning id into v_ing;

  insert into bar_items (section, category, name, serving, selling_price,
                         ingredient_id, porzioni_per_unita)
  values ('bevande', 'ZZ prova', 'ZZ caffe di prova', 'Tazzina', 6, v_ing, 8)
  returning id into v_voce;

  update ingredients set unit = 'g' where id = v_ing;

  select porzioni_per_unita, selling_price into v_porz, v_prezzo
    from bar_items where id = v_voce;
  if v_porz is distinct from 0.008 then
    raise exception 'Le porzioni per unita'' sono % invece di 0,008: da chili a grammi si DIVIDE.',
      coalesce(v_porz::text, '(vuoto)');
  end if;
  if v_prezzo is distinct from 6 then
    raise exception 'Il prezzo di vendita e'' diventato %: cambiare unita'' ha riscritto la carta.',
      coalesce(v_prezzo::text, '(vuoto)');
  end if;

  -- (2-bis) IL LIMITE ALLARGATO ACCETTA IL CASO BUONO E RIFIUTA ANCORA
  --     QUELLO ASSURDO. Un vincolo si prova SEMPRE nei due versi (24/08):
  --     senza il secondo, allargarlo fino a renderlo inutile passerebbe.
  begin
    update bar_items set porzioni_per_unita = 0 where id = v_voce;
    raise exception 'Zero porzioni per unita'' e'' stato accettato: il limite e'' stato allargato troppo.';
  exception when check_violation then
    null;
  end;
  update bar_items set porzioni_per_unita = 0.008 where id = v_voce;

  -- (3) E LA QUANTITA' SENZA COSTO E' NOMINATA NEL CORPO VIVO DELLA
  --     CONVERSIONE. Non si puo' provare col giro sopra — non c'e' nessuno
  --     scarico su questo prodotto — quindi si guarda che la riga ci sia,
  --     e il limite e' dichiarato: prova la FORMA, non il comportamento.
  select pg_get_functiondef(p.oid) into v_corpo
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'converti_numeri_dell_unita';
  if v_corpo not like '%quantita_senza_costo = quantita_senza_costo * v_f%' then
    raise exception 'La conversione non tocca «quantita_senza_costo»: resterebbe in chili dentro un prodotto in grammi.';
  end if;

  delete from bar_items  where id = v_voce;
  delete from price_history where ingredient_id = v_ing;
  delete from ingredients where id = v_ing;

  perform pretendi_nessun_residuo(v_foto, 'la verifica delle tre colonne e l''unita''');
  raise notice 'Fatto: da chili a grammi le porzioni si dividono (0,008), il prezzo resta 6,00, la quantita'' senza costo segue la merce.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260830000007', 'le_tre_colonne_nuove_dichiarano_l_unita') on conflict (version) do nothing;
