-- =====================================================================
-- IL VINO ENTRA NEL MAGAZZINO — 30/08/2026
-- =====================================================================
--
-- 🔴 LE PAROLE DI ALESSIO: *«non vedo motivi per non trattare vini e bevande
-- come tutto il resto»*. Una bottiglia e' un prodotto comprato come la carta
-- forno: fornitore, prezzo d'acquisto, giacenza, scorta minima, lista della
-- spesa. E su un'osteria il conto lo fa il vino.
--
-- 🔴 COSA HO MISURATO PRIMA DI SCRIVERE, e la risposta e' PIU' GRAVE di come
-- era posta la domanda. La domanda era «una bottiglia venduta oggi scarica
-- qualcosa?». Misurato in produzione il 30/08:
--   · `bar_items` non ha **nessuna** chiave esterna in entrata;
--   · non ha **nessuna** chiave esterna in uscita;
--   · **nessuna** delle funzioni del database la nomina (cercato nei corpi
--     vivi di tutte le funzioni di `public`, non nei nomi).
--   Cioe' e' un'ISOLA: sa cosa vendi e a quanto, e non tocca niente.
--
-- 🔴 MA IL BUCO VERO NON E' LO SCARICO: E' L'IDENTITA'. `handleAddBarItem` in
-- Sala.jsx scrive la voce della carta come **testo libero**
-- (`order_items.free_text_name`, «Grillo · calice»). Quindi un Grillo venduto
-- dalla carta e un «Grillo» digitato a mano nel modulo delle voci libere sono
-- **la stessa identica riga**: nessuno puo' dire quante bottiglie di Grillo
-- sono state vendute. *Senza identita' il margine non e' calcolabile nemmeno
-- a posteriori, il giorno che qualcuno lo volesse.* Per questo la colonna che
-- conta di piu' di questa migrazione e' `order_items.bar_item_id`.
--
-- ⚠️ COSA **NON** SI COSTRUISCE, e perche' (punto 1c del mandato).
-- L'annata **non ha una colonna nuova**. L'ingrediente e' «Nero d'Avola del
-- produttore X»; ogni annata e' un ARTICOLO comprato sotto di lui, e
-- `articoli_fornitore` — costruita il 27/08 — ha gia' descrizione, marca,
-- formato, fornitore, fattore e il suo storico prezzi. Aggiungere `annata`
-- sarebbe la seconda struttura che il mandato vieta, e sarebbe anche
-- «preparare il terreno» per un lavoro non chiesto — cosa che
-- `DECISIONI.md` vieta espressamente. La porta e' gia' aperta: non se ne
-- apre una accanto.
--
-- ⚠️ E NON SI COSTRUISCE NESSUN ALTRO CASO DI RESA. Alessio ha detto che
-- tutto il resto lo vende A BOTTIGLIA INTERA e che non terra' birra alla
-- spina: niente fusti. La resa esiste **solo** per le voci vendute a
-- porzione, e la colonna nasce **vuota** su tutte.
--
-- ⚠️ LA DECISIONE DEL 23/08 NON E' TOCCATA — «il vino non compare
-- nell'elenco degli scarichi mancati». Il ramo (a) di
-- `scarica_magazzino_conto` continua a escludere `destination = 'bar'`, e
-- non e' stato aperto: erano 1.840 righe tutte uguali che seppellivano le
-- venti che contano. Quello che cambia e' che una voce **collegata** a un
-- prodotto entra nel giro normale, quindi se la giacenza non basta lo dice
-- come per il baccalà. ⚠️ E una voce **non collegata** non produce nessuna
-- riga di anomalia: si dichiara **nella carta**, una volta, invece che a ogni
-- conto — un avviso ripetuto a ogni serata e' un avviso che si spegne.

-- ---------------------------------------------------------------------
-- 1. LA VOCE DELLA CARTA SA QUAL E' IL SUO PRODOTTO
-- ---------------------------------------------------------------------
-- ⚠️ NULLABLE, e non e' una comodita': oggi TUTTE le voci sono senza
--    prodotto (misurato: 0 righe in produzione, ma sul progetto di prova ce
--    ne sono). Un `not null` con un valore di comodo risponderebbe al posto
--    di Alessio — la trappola del 14/08. Vuoto vuol dire «non l'ha ancora
--    collegata», ed e' una risposta diversa da «non scarica».
alter table bar_items
  add column if not exists ingredient_id uuid references ingredients(id) on delete restrict;

-- QUANTE PORZIONI SI RICAVANO DA UNA UNITA' DEL PRODOTTO.
-- ⚠️ Vuoto = si vende intera, ed e' il caso normale. Sei calici da una
--    bottiglia → 6, e vendere un calice scarica un sesto.
-- ⚠️ SI CHIAMA «per unita'» e non «per bottiglia» apposta: l'unita' e'
--    quella dell'ingrediente, quindi la stessa regola copre il caffe'
--    (140 tazzine da un chilo) senza inventare un secondo meccanismo.
alter table bar_items
  add column if not exists porzioni_per_unita numeric;

do $vincoli$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'bar_items'::regclass
                    and conname = 'bar_items_porzioni_check') then
    alter table bar_items add constraint bar_items_porzioni_check
      check (porzioni_per_unita is null or porzioni_per_unita > 1);
  end if;
end
$vincoli$;

-- ⚠️ LA FRASE IN ITALIANO E' OBBLIGATORIA (25/08): senza, quel rifiuto
--    arriverebbe a schermo come «violates check constraint», che in sala non
--    e' un rifiuto — e' un guasto.
comment on constraint bar_items_porzioni_check on bar_items is
  'Quante porzioni si ricavano da una confezione: dev''essere piu'' di una. Se questa voce si vende intera, lascia il campo vuoto.';

comment on column bar_items.ingredient_id is
  'Il prodotto del magazzino che questa voce della carta consuma. Vuoto = non collegata: non scarica e non ha margine, e la schermata lo dice.';
comment on column bar_items.porzioni_per_unita is
  'Quante porzioni si ricavano da UNA unita'' del prodotto (sei calici da una bottiglia → 6). Vuoto = si vende intera.';

-- ---------------------------------------------------------------------
-- 2. LA RIGA DEL CONTO SA CHE COSA E' STATA VENDUTA
-- ---------------------------------------------------------------------
-- 🔴 E' LA COLONNA CHE CHIUDE IL BUCO DELL'IDENTITA'. `free_text_name` resta
--    e continua a essere scritto: e' l'etichetta **fotografata**, come il
--    prezzo del coperto e la dicitura del fornitore — se domani la carta
--    rinomina un vino, un conto di ieri continua a mostrare quello che il
--    cliente aveva letto.
-- ⚠️ `on delete restrict` e mai `set null`: la regola del 16/08. Una voce
--    della carta non si cancella comunque — si mette fuori carta.
alter table order_items
  add column if not exists bar_item_id uuid references bar_items(id) on delete restrict;

comment on column order_items.bar_item_id is
  'Quale voce della carta e'' stata venduta. Vuoto = voce libera scritta a mano. Il nome resta anche in free_text_name, fotografato: la carta di domani non riscrive un conto di ieri.';

create index if not exists idx_order_items_bar_item on order_items (bar_item_id)
  where bar_item_id is not null;

-- ---------------------------------------------------------------------
-- 3. IL FABBISOGNO DI UN CONTO COMPRENDE LE BEVANDE
-- ---------------------------------------------------------------------
-- ⚠️ CORPO PRESO DAL DATABASE VIVO (`npm run funzione:viva`), non dal file
--    che l'ha creata: fra i due ci stanno tutte le migrazioni che l'hanno
--    toccata (regola del 18/08). Produzione e progetto di prova erano
--    allineati quando l'ho letto — 344 migrazioni tutti e due — quindi la
--    fonte era la stessa da tutt'e due le parti.
-- ⚠️ CAMBIA SOLO LA CODA: si aggiunge la terza sorgente `bevande` e la
--    select finale ne unisce tre invece di due. Le due esistenti non sono
--    state toccate di una virgola.

CREATE OR REPLACE FUNCTION public.fabbisogno_conto(p_order_id uuid)
 RETURNS TABLE(order_item_id uuid, ingredient_id uuid, quantita numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
       and e.multiplier is not null
       and not (s.id is not null and s.sostituto_id is null)
     group by e.order_item_id, coalesce(s.sostituto_id, prep.id)
  ),
  -- c) 🔴 LE BEVANDE (30/08). Una voce della carta collegata a un prodotto
  --    del magazzino esce dalla cantina come tutto il resto.
  --    ⚠️ `sent_at is not null` come le altre due: una riga mai mandata al
  --       bar e' una bottiglia mai stappata. Stessa regola, stesso motivo.
  --    ⚠️ La divisione e' la resa: sei calici da una bottiglia scaricano un
  --       sesto per calice. Vuoto = si vende intera, quindi si divide per 1.
  --    ⚠️ NIENTE SCARTO: da una bottiglia non si butta niente. E niente
  --       sostituzioni: un allergene non si toglie da un bicchiere di vino.
  bevande as (
    select oi.id as order_item_id,
           b.ingredient_id,
           sum(oi.quantity::numeric / coalesce(b.porzioni_per_unita, 1)) as quantita
      from order_items oi
      join bar_items b on b.id = oi.bar_item_id
     where oi.order_id = p_order_id
       and oi.voided_at is null
       and oi.sent_at is not null
       and b.ingredient_id is not null
     group by oi.id, b.ingredient_id
  )
  select t.order_item_id, t.ingredient_id, sum(t.quantita)
    from (select * from materia
          union all select * from semilavorati
          union all select * from bevande) t
   group by t.order_item_id, t.ingredient_id;
$function$;

revoke all on function fabbisogno_conto(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. IL MARGINE SUL VINO — quanto paghi una bottiglia e quanto la incassi
-- ---------------------------------------------------------------------
-- 🔴 E' IL RISULTATO CHE IL MANDATO CHIEDE (punto 1g), e la domanda vera non
--    e' «quanto guadagno su un calice»: e' **quanto rende una bottiglia**.
--    Per questo ci sono tutti e due i numeri — la porzione e la confezione —
--    e per un vino a mescita `incasso_confezione` e' sei volte il calice.
--    Su un totale non si vede: 8 € a calice sembra poco accanto a una
--    bottiglia pagata 12, e sono 48.
--
-- ⚠️ UNO ZERO NON E' UNA RISPOSTA, ed e' il cuore di questa funzione.
--    `ingredients.current_price` e' `not null` con zero di partenza, quindi
--    un prodotto mai comprato **direbbe margine pieno**: un vino pagato
--    niente e venduto 8 €. Qui zero si legge «non lo so», il margine resta
--    **vuoto** e la colonna `motivo` dice quale delle due cose manca. La
--    schermata mostra la frase, non il numero.
--
-- ⚠️ E LE RISPOSTE SONO TRE, non due: collegata e prezzata · collegata e
--    senza prezzo · non collegata. Le ultime due si comportano uguale (niente
--    margine) e **non si dicono uguale**: la prima si cura comprando, la
--    seconda collegando. Un motivo solo manderebbe a cercare nel posto
--    sbagliato.
create or replace function margine_carta()
returns table (
  bar_item_id          uuid,
  section              text,
  category             text,
  name                 text,
  serving              text,
  attiva               boolean,
  selling_price        numeric,
  ingredient_id        uuid,
  prodotto             text,
  porzioni_per_unita   numeric,
  costo_confezione     numeric,
  costo_porzione       numeric,
  margine_porzione     numeric,
  margine_percento     numeric,
  incasso_confezione   numeric,
  margine_confezione   numeric,
  giacenza             numeric,
  porzioni_disponibili numeric,
  motivo               text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  -- 🔴 IL PORTIERE RIFIUTA, non filtra. Un filtro nella `where` darebbe un
  --    elenco VUOTO, che si legge «non c'e' niente in carta»: e' la
  --    rassicurazione falsa del 27/08. Stessa forma di
  --    `varianti_ingrediente`, che espone gli stessi prezzi d'acquisto.
  if not (select is_titolare()) then
    raise exception 'Il margine della carta lo vede solo il titolare: contiene i prezzi d''acquisto.';
  end if;

  return query
  select b.id, b.section, b.category, b.name, b.serving, b.active,
         b.selling_price,
         b.ingredient_id, i.name,
         b.porzioni_per_unita,
         -- ⚠️ `nullif(...,0)` in ogni punto: zero non e' un prezzo, e' un
         --    prezzo che nessuno ha ancora misurato. Da qui in giu' ogni
         --    numero che ne discende resta VUOTO invece di essere generoso.
         nullif(i.current_price, 0),
         round(nullif(i.current_price, 0) / coalesce(b.porzioni_per_unita, 1), 4),
         round(b.selling_price - nullif(i.current_price, 0) / coalesce(b.porzioni_per_unita, 1), 4),
         case when b.selling_price > 0
              then round(100 * (b.selling_price - nullif(i.current_price, 0) / coalesce(b.porzioni_per_unita, 1))
                             / b.selling_price, 1)
         end,
         round(b.selling_price * coalesce(b.porzioni_per_unita, 1), 4),
         round(b.selling_price * coalesce(b.porzioni_per_unita, 1) - nullif(i.current_price, 0), 4),
         g.giacenza,
         round(g.giacenza * coalesce(b.porzioni_per_unita, 1), 2),
         case when b.ingredient_id is null then 'non_collegata'
              when coalesce(i.current_price, 0) = 0 then 'prezzo_mancante'
         end
    from bar_items b
    left join ingredients i on i.id = b.ingredient_id
    left join lateral (
      select coalesce(sum(sl.quantity_remaining), 0) as giacenza
        from stock_lots sl where sl.ingredient_id = b.ingredient_id
    ) g on true
   order by b.section, b.category, b.name;
end;
$function$;

-- ⚠️ I PERMESSI SONO MISURATI, NON RICOPIATI (trappola del 24 e del 27/08).
--    Misurato sulla produzione il 30/08: `fabbisogno_conto` non e' eseguibile
--    da nessuno dei quattro ruoli, `varianti_ingrediente` — che espone gli
--    stessi prezzi d'acquisto dietro lo stesso portiere — e' concessa a
--    `authenticated`. Qui si riproduce quello stato, non quello che
--    sembrerebbe naturale.
revoke all on function margine_carta() from public, anon, authenticated;
grant execute on function margine_carta() to authenticated;

-- ---------------------------------------------------------------------
-- 5. LA VERIFICA
-- ---------------------------------------------------------------------
-- ⚠️ L'ESEMPIO SI COSTRUISCE, NON SI PRENDE IN PRESTITO (27/08): un
--    ingrediente mio, un lotto mio, due voci di carta mie, un conto mio.
--    Prendere in prestito una bottiglia vera di Alessio la farebbe scendere
--    davvero, e l'ho gia' pagata una volta il 16/08.
-- ⚠️ E I NUMERI SONO SCELTI PERCHE' LE RISPOSTE SBAGLIATE SIANO DIVERSE FRA
--    LORO (19/08). 10 bottiglie, se ne vende 1 intera e 6 calici da una
--    seconda: restano 8. Se la resa fosse ignorata resterebbero 3
--    (1+6 bottiglie); se le bevande non scaricassero affatto, 10. Tre
--    risposte, tre numeri.
do $verifica$
declare
  v_foto   jsonb;
  v_ent    uuid;
  v_tit    uuid;
  v_ing    uuid;
  v_bott   uuid;
  v_cal    uuid;
  v_conto  uuid;
  v_lotto  uuid;
  v_rim    numeric;
  v_ok     boolean;
  v_msg    text;
  v_costoc numeric;
  v_costop numeric;
  v_incc   numeric;
  v_margc  numeric;
  v_mot    text;
  v_spenti integer;
begin
  v_foto := foto_righe();
  select id into v_ent from entities order by created_at limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_ent is null or v_tit is null then
    raise exception 'Manca la societa o il titolare: impossibile verificare.';
  end if;

  -- (1) IL VINCOLO SULLE PORZIONI RIFIUTA 1, E LO DICE IN ITALIANO.
  --     Una porzione per confezione E la bottiglia intera: due modi di
  --     dire la stessa cosa, e due modi di dire la stessa cosa in questo
  --     progetto sono un difetto.
  v_ok := false;
  begin
    insert into bar_items (section, category, name, selling_price, porzioni_per_unita)
    values ('vini', 'ZZ prova', 'ZZ rifiuto', 5, 1);
  exception when check_violation then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'Il vincolo sulle porzioni non ha rifiutato 1: restano due modi di dire «si vende intera».';
  end if;

  -- E LO STESSO VINCOLO NON DEVE RIFIUTARE IL CASO BUONO. Un limite che
  -- respinge anche cio che e legittimo e peggio di nessun limite (24/08).
  insert into ingredients (name, category, unit, current_price, entity_id,
                           alimentare, tenuto_in_magazzino)
  values ('ZZ vino di prova', 'bevande', 'pz', 12, v_ent, true, true)
  returning id into v_ing;

  insert into bar_items (section, category, name, serving, selling_price, ingredient_id)
  values ('vini', 'ZZ prova', 'ZZ vino di prova', 'Bottiglia', 30, v_ing)
  returning id into v_bott;

  insert into bar_items (section, category, name, serving, selling_price,
                         ingredient_id, porzioni_per_unita)
  values ('vini', 'ZZ prova', 'ZZ vino di prova', 'Calice', 6, v_ing, 6)
  returning id into v_cal;

  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost)
  values (v_ing, 10, 10, 12) returning id into v_lotto;

  -- (2) LO SCARICO. Una bottiglia intera e sei calici.
  insert into orders (entity_id, table_label, status, coperti, coperto_unit_price)
  values (v_ent, 'ZZ vino', 'aperto', 2, 5) returning id into v_conto;

  insert into order_items (order_id, bar_item_id, free_text_name, destination,
                           quantity, unit_price, turno, sent_at)
  values (v_conto, v_bott, 'ZZ vino di prova - Bottiglia', 'bar', 1, 30, 1, now());

  insert into order_items (order_id, bar_item_id, free_text_name, destination,
                           quantity, unit_price, turno, sent_at)
  values (v_conto, v_cal, 'ZZ vino di prova - Calice', 'bar', 6, 6, 1, now());

  -- Il fabbisogno PRIMA dello scarico: la somma dev essere 2 bottiglie.
  select round(sum(f.quantita), 6) into v_rim
    from fabbisogno_conto(v_conto) f where f.ingredient_id = v_ing;
  if v_rim is distinct from 2.000000 then
    raise exception 'Il fabbisogno delle bevande e % invece di 2: la resa non e stata applicata.', coalesce(v_rim::text, '(vuoto)');
  end if;

  update orders set status = 'chiuso', closed_at = now() where id = v_conto;
  perform scarica_magazzino_conto(v_conto);

  select quantity_remaining into v_rim from stock_lots where id = v_lotto;
  if v_rim is distinct from 8 then
    raise exception 'Dopo la vendita restano % bottiglie invece di 8 (10 = niente scarico, 3 = resa ignorata).', coalesce(v_rim::text, '(vuoto)');
  end if;

  -- (3) IL COSTO E STATO FOTOGRAFATO DAL LOTTO: due bottiglie a 12 = 24.
  select round(sum(sc.costo), 2) into v_rim
    from stock_consumptions sc where sc.order_id = v_conto;
  if v_rim is distinct from 24.00 then
    raise exception 'Il costo scaricato e % invece di 24,00.', coalesce(v_rim::text, '(vuoto)');
  end if;

  -- (4) IL MARGINE, dal ruolo vero del titolare.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  select m.costo_confezione, m.costo_porzione, m.incasso_confezione,
         m.margine_confezione, m.motivo
    into v_costoc, v_costop, v_incc, v_margc, v_mot
    from margine_carta() m where m.bar_item_id = v_cal;
  if v_costoc is distinct from 12 then
    raise exception 'Il costo della confezione e % invece di 12.', coalesce(v_costoc::text, '(vuoto)');
  end if;
  if round(v_costop, 2) is distinct from 2.00 then
    raise exception 'Il costo di un calice e % invece di 2,00 (12 diviso 6).', coalesce(v_costop::text, '(vuoto)');
  end if;
  -- IL NUMERO CHE VALE: sei calici da 6 euro fanno 36, la bottiglia costa
  -- 12, quindi rende 24. Su un calice solo si vedrebbe 4 e sembrerebbe poco.
  if v_incc is distinct from 36 or v_margc is distinct from 24 then
    raise exception 'La bottiglia a mescita incassa % e rende % invece di 36 e 24.',
      coalesce(v_incc::text, '(vuoto)'), coalesce(v_margc::text, '(vuoto)');
  end if;
  if v_mot is not null then
    raise exception 'Una voce collegata e prezzata dichiara il motivo %: doveva essere vuoto.', v_mot;
  end if;

  -- (5) LE TRE RISPOSTE SI DISTINGUONO. Una voce senza prodotto e una con
  --     un prodotto senza prezzo non si dicono uguale.
  update bar_items set ingredient_id = null where id = v_bott;
  select m.motivo, m.margine_confezione into v_mot, v_margc
    from margine_carta() m where m.bar_item_id = v_bott;
  if v_mot is distinct from 'non_collegata' or v_margc is not null then
    raise exception 'Una voce non collegata dice % con margine %: doveva dire non_collegata e restare vuota.',
      coalesce(v_mot, '(vuoto)'), coalesce(v_margc::text, '(vuoto)');
  end if;

  update bar_items set ingredient_id = v_ing where id = v_bott;
  update ingredients set current_price = 0 where id = v_ing;
  select m.motivo, m.margine_confezione into v_mot, v_margc
    from margine_carta() m where m.bar_item_id = v_bott;
  if v_mot is distinct from 'prezzo_mancante' or v_margc is not null then
    raise exception 'Un prodotto senza prezzo dice % con margine %: uno zero non e una risposta.',
      coalesce(v_mot, '(vuoto)'), coalesce(v_margc::text, '(vuoto)');
  end if;
  update ingredients set current_price = 12 where id = v_ing;

  -- (6) IL PORTIERE RIFIUTA CHI NON E IL TITOLARE, e non risponde vuoto.
  perform set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  v_ok := false;
  begin
    perform count(*) from margine_carta();
  exception when others then
    v_ok  := true;
    v_msg := sqlerrm;
  end;
  perform set_config('request.jwt.claims', null, true);
  if not v_ok then
    raise exception 'Il margine della carta si e fatto leggere da chi non e il titolare.';
  end if;
  if v_msg not like '%solo il titolare%' then
    raise exception 'Il rifiuto del margine non dice chi puo vederlo: %.', v_msg;
  end if;

  -- ------------------------------------------------------------------
  -- LA PULIZIA. Solo roba mia, riconosciuta per identificativo (23/08).
  -- I TRE TRIGGER DELLE LAPIDI si spengono e si riaccendono, e il
  -- riaccendimento si CONTROLLA: lasciarne uno spento vuol dire
  -- cancellazioni vere che smettono di essere registrate, in silenzio.
  -- Misurato il 30/08: fra le tabelle toccate qui, quelle nel registro
  -- sono tre — order_items, orders, stock_consumptions.
  -- ------------------------------------------------------------------
  -- ⚠️ E SI SPEGNE ANCHE `trg_riga_servita`, trovato APPLICANDO e non
  --    rileggendo: una riga gia' andata al bar su un conto chiuso non si
  --    puo' togliere, ed e' giusto — e' la regola che protegge il totale
  --    su cui si e' incassato. Ma la verifica DEVE poter ripulire quello
  --    che ha creato, e non ha altra strada.
  alter table order_items        disable trigger trg_log_delete;
  alter table order_items        disable trigger trg_riga_servita;
  alter table orders             disable trigger trg_log_delete;
  alter table stock_consumptions disable trigger trg_log_delete;

  delete from anomalie_scarico    where order_id = v_conto;
  delete from stock_consumptions  where order_id = v_conto;
  delete from order_items         where order_id = v_conto;
  delete from orders              where id = v_conto;
  delete from bar_items           where id in (v_bott, v_cal);
  delete from stock_lots          where id = v_lotto;
  delete from price_history       where ingredient_id = v_ing;
  delete from ingredients         where id = v_ing;

  alter table order_items        enable trigger trg_log_delete;
  alter table order_items        enable trigger trg_riga_servita;
  alter table orders             enable trigger trg_log_delete;
  alter table stock_consumptions enable trigger trg_log_delete;

  select count(*) into v_spenti from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
   where ((t.tgname = 'trg_log_delete'
           and c.relname in ('order_items', 'orders', 'stock_consumptions'))
       or (t.tgname = 'trg_riga_servita' and c.relname = 'order_items'))
     and t.tgenabled = 'D';
  if v_spenti > 0 then
    raise exception '% dei quattro guardiani spenti dalla pulizia e rimasto spento.', v_spenti;
  end if;

  perform pretendi_nessun_residuo(v_foto, 'la verifica del vino in magazzino');

  raise notice 'Fatto: la carta scarica il magazzino. Fabbisogno 2 bottiglie, restano 8, costo 24,00, la bottiglia a mescita rende 24,00.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260830000002', 'il_vino_entra_nel_magazzino') on conflict (version) do nothing;
