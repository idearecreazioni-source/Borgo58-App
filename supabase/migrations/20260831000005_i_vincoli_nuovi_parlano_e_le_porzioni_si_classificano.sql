-- =====================================================================
-- I VINCOLI DI STANOTTE PARLANO ITALIANO, E LE PORZIONI SI CLASSIFICANO
-- 31/08/2026
-- =====================================================================
--
-- 🔴 TRE DIFETTI TROVATI DA DUE RETI CHE ESISTEVANO GIA', non da una
-- rilettura: `vincoli-che-parlano.test.js` e `cambio-unita.test.js` sono
-- diventate rosse da sole sulle migrazioni scritte stanotte.
--
-- ⚠️ E NON SI RISCRIVONO LE MIGRAZIONI DI PRIMA (regola del 23/08): il file
-- racconta cosa e' successo quel momento, e correggerlo lo rende una bugia
-- per chi ricostruira' da zero. Si sistema **aggiungendo**.
--
-- ---------------------------------------------------------------------
-- 1. I VINCOLI MUTI
-- ---------------------------------------------------------------------
-- Un vincolo senza commento produce «*violates check constraint "…"*», che
-- in sala non e' un rifiuto: e' un guasto. La traduzione vive in un posto
-- solo (`src/lib/supabase.js`) e prende la frase dal `comment on
-- constraint` — quindi **ogni vincolo nuovo vuole il suo commento**
-- (regola del 24/08).
--
-- 🔴 E UNO DEI CINQUE IL COMMENTO CE L'AVEVA: `articoli_fornitore_annata_check`
-- lo riceve nella `20260831000002`, ed e' **stato perso provando la
-- migrazione per rottura**. Per far fallire la verifica avevo tolto il
-- vincolo e rimesso solo il vincolo:
--     alter table … drop constraint …;   → se ne va anche il commento
--     alter table … add  constraint …;   → torna il vincolo, non il commento
-- ⚠️ **LA LEZIONE, che vale oltre questo caso**: *rimettere a posto dopo una
-- rottura vuol dire rimettere TUTTO* — un `drop`/`add` a mano perde il
-- commento **in silenzio**, e nessun errore lo dice. E' la stessa famiglia
-- del `grant` ricopiato a memoria (24/08 e 27/08): di un oggetto del
-- database si riprende tutto cio' che lo descrive, non solo la sua forma.
-- ⚠️ Su un database ricostruito da zero quel commento ci sarebbe stato: qui
-- si rimette perche' sul progetto di prova l'ho tolto io.

comment on constraint articoli_fornitore_annata_check on articoli_fornitore is
  'L''annata di una bottiglia sta fra il 1900 e il 2100. Vuota va benissimo: quasi niente ha un''annata.';

comment on constraint bottiglie_aperte_chiusa_come_check on bottiglie_aperte is
  'Una bottiglia si chiude «finita» oppure «buttata»: sono due fatti diversi, uno e'' ricavo e l''altro perdita.';

comment on constraint bottiglie_aperte_buttate_check on bottiglie_aperte is
  'I calici buttati non possono essere un numero negativo: si butta quello che restava, o niente.';

comment on constraint bottiglie_aperte_ingredient_id_fkey on bottiglie_aperte is
  'Una bottiglia aperta appartiene a un prodotto che esiste in magazzino. Un prodotto con bottiglie aperte non si cancella: prima si chiudono.';

comment on constraint categorie_ingrediente_mondo_fkey on categorie_ingrediente is
  'Una categoria appartiene a uno dei sette mondi del magazzino. Un ottavo mondo non si puo'' scrivere: se serve, si aggiunge prima al catalogo.';

-- ---------------------------------------------------------------------
-- 2. LE DUE COLONNE NUOVE, CLASSIFICATE
-- ---------------------------------------------------------------------
-- 🔴 `porzioni_totali` e `porzioni_buttate` di `bottiglie_aperte` sono
-- numeri legati a un ingrediente, e il censimento delle unita' pretende che
-- ognuno dichiari **se segue l'unita' del prodotto**. Non dichiararlo
-- significa che il giorno in cui un vino passasse da bottiglie a litri quei
-- numeri resterebbero indietro **senza che nessuno lo dica**.
--
-- ⚠️ E LA RISPOSTA E' CHE **NON SI CONVERTONO**, con la sua ragione: sono
-- CALICI, cioe' un conteggio di porzioni servite — non una quantita'
-- nell'unita' del prodotto. Sei calici restano sei calici che il magazzino
-- misuri il vino in bottiglie o in litri. ⚠️ Da non confondere con
-- `bar_items.porzioni_per_unita`, che invece **si converte** perche' e' un
-- numero *per unita'*: quante porzioni escono da UNA unita' di prodotto.
create or replace function colonne_unita_non_classificate()
returns table (tabella text, colonna text)
language sql
stable
set search_path = public
as $function$
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

revoke all on function colonne_unita_non_classificate() from public, anon, authenticated;
grant execute on function colonne_unita_non_classificate() to authenticated;

-- ---------------------------------------------------------------------
-- 3. VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare v_muti text; v_non_class integer; v_frase text;
begin
  -- (1) I cinque vincoli di stanotte hanno tutti la loro frase.
  select string_agg(conname, ', ') into v_muti
    from pg_constraint
   where conname in (
     'articoli_fornitore_annata_check',
     'bottiglie_aperte_chiusa_come_check',
     'bottiglie_aperte_buttate_check',
     'bottiglie_aperte_ingredient_id_fkey',
     'categorie_ingrediente_mondo_fkey')
     and coalesce(btrim(obj_description(oid, 'pg_constraint')), '') = '';
  if v_muti is not null then
    raise exception 'Vincoli ancora muti: %', v_muti;
  end if;

  -- ⚠️ E LA FRASE DEV'ESSERE IN ITALIANO E DIRE COSA FARE, non solo esserci:
  --    un commento vuoto passerebbe il controllo qui sopra se fosse uno
  --    spazio, e uno inutile lo passerebbe comunque. Si guarda quella del
  --    caso piu' delicato — il mondo inventato — e si pretende che nomini
  --    la via d'uscita.
  select obj_description(oid, 'pg_constraint') into v_frase
    from pg_constraint where conname = 'categorie_ingrediente_mondo_fkey';
  if position('catalogo' in lower(coalesce(v_frase, ''))) = 0 then
    raise exception 'La frase del mondo non dice cosa fare: %', coalesce(v_frase, '(vuota)');
  end if;

  -- (2) Nessuna colonna numerica legata a un ingrediente resta senza
  --     risposta sulla domanda «segue l'unita'?».
  select count(*)::integer into v_non_class from colonne_unita_non_classificate();
  if v_non_class <> 0 then
    raise exception '% colonne numeriche non dichiarano se seguono l''unita''', v_non_class;
  end if;

  raise notice 'Fatto: i cinque vincoli parlano italiano e le due colonne dei calici sono classificate.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260831000005', 'i_vincoli_nuovi_parlano_e_le_porzioni_si_classificano') on conflict (version) do nothing;
