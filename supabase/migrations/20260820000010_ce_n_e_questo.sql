-- =====================================================================
-- «CE N'È QUESTO» — l'allineamento del magazzino
-- 20/08/2026 · blocchi 1-3 del mandato dell'allineamento
-- =====================================================================
-- 🔴 IL PROBLEMA L'HA POSTO ALESSIO: *«è quasi impossibile che il gestionale
-- mostri un magazzino allineato con la realtà, banalmente perché le quantità
-- che scarica sono solo stimate a monte»*. La conseguenza è più grossa del
-- magazzino: **quel numero non è una giacenza, è una previsione** — quanto ci
-- sarebbe se ogni ricetta fosse rispettata al grammo.
--
-- ⚠️ SI SCRIVE QUANTO C'È DAVVERO, NON QUANTO TOGLIERE. Davanti allo scaffale
-- non si fanno conti, e chiedere «quanto togli» sposterebbe l'aritmetica su
-- chi ha in mano il barattolo — cioè dove sbaglia.
--
-- ⚠️ NIENTE CAUSALE, deciso da Alessio contro la proposta del validatore: le
-- cause possono essere ignote, e *un elenco che si riempie di «non so»
-- produce righe che sembrano informazione e non lo sono*. **Quello che conta
-- è il trend.**
--
-- ⚠️ LA CORREZIONE LA PUÒ FARE CHIUNQUE, anche dalla sala: chi si accorge che
-- ne manca è chi sta guardando lo scaffale, non chi ha il gestionale aperto
-- in ufficio.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1 · IL REGISTRO DEGLI ALLINEAMENTI
-- ---------------------------------------------------------------------
-- ⚠️ Perché una tabella sua e non solo uno scarico con `reason='rettifica'`:
-- uno scarico può solo TOGLIERE (`quantity > 0` è un vincolo di
-- `stock_consumptions`), e **una correzione in aumento esiste** — una
-- consegna registrata male, un conteggio precedente sbagliato. È il caso che
-- si dimentica sempre.
--
-- ⚠️ E i tre numeri si FOTOGRAFANO tutti e tre: atteso, dichiarato e valore.
-- Ricalcolare l'atteso domani darebbe un altro numero — le partite nel
-- frattempo si muovono — e il trend racconterebbe una storia che non è
-- successa. Stesso principio del costo congelato sul lotto.
create table if not exists rettifiche_giacenza (
  id            uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id) on delete restrict,
  atteso        numeric not null,
  dichiarato    numeric not null,
  differenza    numeric not null,
  valore        numeric,
  note          text,
  creato_da     uuid default auth.uid(),
  creato_il     timestamptz not null default now(),
  constraint rettifica_dichiarato_non_negativo check (dichiarato >= 0),
  constraint rettifica_differenza_coerente check (differenza = dichiarato - atteso)
);

comment on table rettifiche_giacenza is
  'Ogni volta che qualcuno dichiara quanto c''è davvero di un prodotto. I tre numeri sono FOTOGRAFATI: ricalcolare l''atteso domani darebbe un''altra storia.';
comment on column rettifiche_giacenza.valore is
  'Quanto vale la differenza, ai costi delle partite toccate. Vuoto = non si è potuto calcolare (nessuna partita), e vuoto NON è zero.';
comment on column rettifiche_giacenza.creato_da is
  'L''accesso che ha corretto. Oggi si entra per ruolo e non per persona: l''identificativo si conserva lo stesso, così il giorno degli accessi personali la storia diventa leggibile all''indietro.';

create index if not exists idx_rettifiche_ingrediente on rettifiche_giacenza (ingredient_id, creato_il desc);

alter table rettifiche_giacenza enable row level security;

drop policy if exists rettifiche_select on rettifiche_giacenza;
drop policy if exists rettifiche_insert on rettifiche_giacenza;
-- ⚠️ Legge e scrive tutto lo staff (decisione di Alessio), ma **modificare e
-- cancellare no**: una correzione è un fatto avvenuto, e il trend si legge da
-- qui. Chi sbaglia ne fa un'altra — che è anche il gesto vero in dispensa.
create policy rettifiche_select on rettifiche_giacenza for select to authenticated using (true);
create policy rettifiche_insert on rettifiche_giacenza for insert to authenticated with check (true);


-- ---------------------------------------------------------------------
-- 2 · «CE N'È QUESTO»
-- ---------------------------------------------------------------------
-- ⚠️ IN DIMINUZIONE si toglie dalle partite che scadono prima — **la stessa
-- regola FEFO dello scarico vero**, non una seconda. Da quale partita si
-- toglie **cambia il valore** dello scostamento, perché `unit_cost` è per
-- partita: la scelta è dichiarata e misurata nel riepilogo.
--
-- ⚠️ IN AUMENTO la merce trovata entra **al costo dell'ultima partita rimasta**
-- di quel prodotto. Non è un costo inventato: quasi sempre la merce in più
-- **è** quella che il gestionale aveva scaricato di troppo, quindi il costo di
-- quella partita è la stima migliore che esista. ⚠️ Se non c'è nessuna partita
-- né un prezzo di listino, la correzione in aumento **si rifiuta dicendo
-- perché**: un costo inventato sporcherebbe il food cost reale, che è
-- esattamente il numero che questo mandato costruisce.
create or replace function allinea_giacenza(
  p_ingredient_id uuid,
  p_quanto_ce     numeric,
  p_note          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atteso   numeric;
  v_diff     numeric;
  v_resta    numeric;
  v_valore   numeric := 0;
  v_costo    numeric;
  v_lotto    record;
  v_nome     text;
  v_unita    unit_type;
  v_id       uuid;
begin
  if auth.uid() is null then
    raise exception 'Serve un accesso per correggere una giacenza.';
  end if;
  if p_quanto_ce is null or p_quanto_ce < 0 then
    raise exception 'Scrivi quanto ce n''è: un numero, anche zero.';
  end if;

  select name, unit into v_nome, v_unita from ingredients where id = p_ingredient_id;
  if v_nome is null then
    raise exception 'Questo prodotto non esiste più.';
  end if;

  select coalesce(sum(quantity_remaining), 0) into v_atteso
    from stock_lots where ingredient_id = p_ingredient_id;

  v_diff := p_quanto_ce - v_atteso;

  -- ⚠️ Scrivere lo stesso numero che il gestionale già mostra NON produce
  -- nessuno scostamento, e non è un dettaglio: distingue «registro le
  -- differenze» da «registro i salvataggi». Con la seconda, il trend si
  -- riempirebbe di zeri e la media direbbe che va tutto bene.
  if v_diff = 0 then
    return jsonb_build_object(
      'prodotto', v_nome, 'atteso', v_atteso, 'dichiarato', p_quanto_ce,
      'differenza', 0, 'valore', 0, 'registrata', false,
      'frase', format('%s: %s %s, come diceva il gestionale. Non ho scritto niente.',
                      v_nome, trim(to_char(p_quanto_ce, 'FM999999990.999')), v_unita)
    );
  end if;

  if v_diff < 0 then
    -- MENO DEL PREVISTO: si toglie FEFO, e si conta quanto vale.
    v_resta := -v_diff;
    for v_lotto in
      select id, quantity_remaining, unit_cost
        from stock_lots
       where ingredient_id = p_ingredient_id and quantity_remaining > 0
       order by expiry_date nulls last, received_at, id
    loop
      exit when v_resta <= 0;
      v_costo := least(v_lotto.quantity_remaining, v_resta);
      update stock_lots
         set quantity_remaining = quantity_remaining - v_costo
       where id = v_lotto.id;
      v_valore := v_valore + v_costo * coalesce(v_lotto.unit_cost, 0);
      v_resta := v_resta - v_costo;
    end loop;
    -- ⚠️ Se le partite non bastano a coprire la differenza, la giacenza
    -- scende a zero e il resto è comunque REGISTRATO: il gestionale credeva
    -- di avere meno di quanto ha tolto, e nasconderlo cancellerebbe proprio
    -- lo scostamento che serve a vedere.
    v_valore := -v_valore;
  else
    -- PIÙ DEL PREVISTO: entra all'ULTIMO PREZZO PAGATO per quel prodotto.
    --
    -- 🔴 QUI C'ERA «il costo dell'ultima partita», ED ERA AMBIGUO — trovato
    -- dalla prova, non rileggendo. Un carico da fattura scrive tutte le sue
    -- partite in UNA transazione, quindi hanno lo stesso `received_at`:
    -- l'ordinamento ne sceglieva una **a caso**, e il valore della merce
    -- trovata in più cambiava da un'esecuzione all'altra. È la trappola del
    -- 16/08 (*«dentro una transazione `now()` è un istante solo»*),
    -- ricomparsa per la terza volta.
    --
    -- ⚠️ E la cura non è un ordinamento più furbo: è **usare la regola che
    -- il progetto ha già deciso**. Dal 13/08 il food cost segue l'ULTIMO
    -- PREZZO PAGATO, e quel numero vive in `ingredients.current_price`, in
    -- un posto solo. Niente seconda regola, niente ambiguità.
    select current_price into v_costo from ingredients where id = p_ingredient_id;
    if v_costo is null then
      -- Ripiego: un prodotto che non ha mai avuto un prezzo di listino ma ha
      -- delle partite. Si prende il costo più alto fra quelle rimaste —
      -- ⚠️ **scelto perché è deterministico**, non perché sia più giusto:
      -- fra due partite scritte nello stesso istante «la più cara» è sempre
      -- la stessa, «l'ultima» no.
      select max(unit_cost) into v_costo
        from stock_lots where ingredient_id = p_ingredient_id;
    end if;
    if v_costo is null then
      raise exception
        'Di % non so quanto costa, quindi non posso dire quanto vale la merce in più. Registra prima un carico, oppure scrivi il prezzo sulla sua scheda.',
        v_nome;
    end if;
    insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, note)
    values (p_ingredient_id, v_diff, v_diff, v_costo,
            'Trovata in più durante un allineamento');
    v_valore := v_diff * v_costo;
  end if;

  insert into rettifiche_giacenza (ingredient_id, atteso, dichiarato, differenza, valore, note)
  values (p_ingredient_id, v_atteso, p_quanto_ce, v_diff, v_valore, nullif(btrim(p_note), ''))
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id, 'prodotto', v_nome, 'atteso', v_atteso, 'dichiarato', p_quanto_ce,
    'differenza', v_diff, 'valore', v_valore, 'registrata', true,
    -- ⚠️ La frase esce insieme ai numeri: un messaggio composto dalla
    -- schermata sarebbe un secondo posto dove dire la stessa cosa.
    'frase', format('%s: ne risultavano %s %s, ne hai %s. %s %s.',
                    v_nome,
                    trim(to_char(v_atteso, 'FM999999990.999')), v_unita,
                    trim(to_char(p_quanto_ce, 'FM999999990.999')),
                    case when v_diff < 0 then 'Mancano' else 'Ce ne sono in più' end,
                    trim(to_char(abs(v_diff), 'FM999999990.999')))
  );
end;
$$;

revoke all on function allinea_giacenza(uuid, numeric, text) from public, anon, authenticated;
grant execute on function allinea_giacenza(uuid, numeric, text) to authenticated;


-- ---------------------------------------------------------------------
-- 3 · IL FOOD COST STIMATO E QUELLO REALE
-- ---------------------------------------------------------------------
-- 🔴 I DUE NUMERI RESTANO DISTINTI E RICONOSCIBILI, MAI FUSI IN UNO
-- «AGGIORNATO»: lo **stimato** è quello con cui Alessio decide i prezzi del
-- menu, il **reale** è quello che sta vivendo. Fusi, i prezzi si farebbero su
-- un numero che si muove da sé.
--
-- ⚠️ Lo stimato NON si ricalcola dalle ricette di oggi: si legge dal costo
-- **fotografato** al momento di ogni scarico. Le ricette cambiano, e un
-- confronto fra il consuntivo di marzo e le ricette di agosto non è uno
-- scostamento — è due cose diverse messe accanto.
create or replace function food_cost_reale(p_dal date, p_al date)
returns table (
  stimato        numeric,
  scostamento    numeric,
  reale          numeric,
  scarto_percento numeric,
  righe_stimate  integer,
  rettifiche     integer,
  avvertenza     text
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_stim  numeric;
  v_righe integer;
  v_rett  numeric;
  v_quante integer;
begin
  -- ⚠️ IL FOOD COST È UN DATO ECONOMICO, e in questo progetto i costi non si
  -- mostrano allo staff (§3.5). La correzione la fa tutta la sala — decisione
  -- di Alessio — ma **quanto è costata** la vede il titolare.
  -- ⚠️ E si RIFIUTA, non si restituisce un elenco vuoto: una schermata vuota
  -- è una rassicurazione falsa (regola del 13/08).
  if not is_titolare() then
    raise exception 'Il food cost è riservato al titolare.';
  end if;

  select coalesce(sum(costo), 0), count(*)::integer into v_stim, v_righe
    from stock_consumptions
   where order_id is not null and costo is not null
     and (created_at at time zone 'Europe/Rome')::date between p_dal and p_al;

  -- ⚠️ Il segno: una differenza NEGATIVA (ne manca) ha valore negativo e vuol
  -- dire che è uscita più merce di quanta il gestionale contasse, cioè il
  -- costo vero è PIÙ ALTO. Per questo si sottrae.
  select coalesce(sum(valore), 0), count(*)::integer into v_rett, v_quante
    from rettifiche_giacenza
   where (creato_il at time zone 'Europe/Rome')::date between p_dal and p_al;

  return query select
    v_stim,
    -v_rett,
    v_stim - v_rett,
    case when v_stim > 0 then round((-v_rett) * 100 / v_stim, 2) else null end,
    v_righe,
    v_quante,
    case
      when v_righe = 0 and v_quante = 0 then
        'In questo periodo non è ancora uscito niente dal magazzino: non c''è nessun food cost da confrontare.'
      when v_righe = 0 then
        'Ci sono correzioni ma nessun piatto venduto in questo periodo: lo scostamento non si può rapportare a niente.'
      else
        'Lo stimato viene dalle ricette al momento in cui i piatti sono usciti; il reale ci somma le correzioni fatte in dispensa. Restano due numeri diversi apposta: sui prezzi del menu si decide con lo stimato.'
    end;
end;
$fn$;

revoke all on function food_cost_reale(date, date) from public, anon, authenticated;
grant execute on function food_cost_reale(date, date) to authenticated;


-- ---------------------------------------------------------------------
-- 4 · CHI SCAPPA — il dettaglio prodotto per prodotto
-- ---------------------------------------------------------------------
create or replace function scostamenti_per_prodotto(p_dal date, p_al date)
returns table (
  ingredient_id uuid,
  nome          text,
  unita         unit_type,
  quante        integer,
  differenza    numeric,
  valore        numeric,
  ultima        timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  -- ⚠️ Costi: titolare-only, e un RIFIUTO invece di un elenco vuoto.
  if not is_titolare() then
    raise exception 'Il dettaglio degli scostamenti è riservato al titolare.';
  end if;

  return query
    select i.id, i.name, i.unit,
           count(*)::integer,
           sum(r.differenza),
           -coalesce(sum(r.valore), 0),
           max(r.creato_il)
      from rettifiche_giacenza r
      join ingredients i on i.id = r.ingredient_id
     where (r.creato_il at time zone 'Europe/Rome')::date between p_dal and p_al
     group by i.id, i.name, i.unit
     -- Chi scappa di più sta in cima: è la domanda con cui si apre la sezione.
     order by -coalesce(sum(r.valore), 0) desc;
end;
$fn$;

revoke all on function scostamenti_per_prodotto(date, date) from public, anon, authenticated;
grant execute on function scostamenti_per_prodotto(date, date) to authenticated;


-- ---------------------------------------------------------------------
-- 5 · COSA C'È DA ALLINEARE
-- ---------------------------------------------------------------------
-- ⚠️ Si apre sull'ELENCO, non sul rapporto: si entra per fare una cosa. E in
-- cima ci sono i prodotti in esaurimento, che è il momento in cui quel numero
-- serve per decidere — *«devo ordinare gli spaghetti, il gestionale dice 5 kg
-- e invece ne ho 4»*.
create or replace function da_allineare()
returns table (
  ingredient_id     uuid,
  nome              text,
  unita             unit_type,
  atteso            numeric,
  soglia            numeric,
  sotto_soglia      boolean,
  ultimo_allineamento timestamptz,
  giorni_da_allora  integer
)
language sql
stable
security definer
set search_path = public
as $fn$
  -- 🔴 DUE SOTTOQUERY, NON DUE `left join`, e il perche' l'ha trovato una
  -- prova: unendo lotti e rettifiche nella stessa query, la somma delle
  -- partite viene MOLTIPLICATA per il numero di correzioni — un prodotto con
  -- 6 kg e 12 correzioni ne dichiarava 72. ⚠️ E non dava nessun errore: era
  -- un numero plausibile, piu' alto del vero, esattamente sulla schermata
  -- che serve a correggere i numeri piu' alti del vero.
  with giacenze as (
    select ingredient_id, sum(quantity_remaining) as quanto
      from stock_lots group by ingredient_id
  ),
  ultime as (
    select ingredient_id, max(creato_il) as quando
      from rettifiche_giacenza group by ingredient_id
  )
  select i.id, i.name, i.unit,
         coalesce(g.quanto, 0),
         i.stock_minimum_threshold,
         (i.stock_minimum_threshold is not null
          and coalesce(g.quanto, 0) <= i.stock_minimum_threshold),
         u.quando,
         case when u.quando is null then null
              else extract(day from now() - u.quando)::integer end
    from ingredients i
    left join giacenze g on g.ingredient_id = i.id
    left join ultime   u on u.ingredient_id = i.id
   where i.alimentare is not false
     and (coalesce(g.quanto, 0) > 0 or i.stock_minimum_threshold is not null)
   -- In cima chi e' in esaurimento, poi chi non si allinea da piu' tempo.
   order by (i.stock_minimum_threshold is not null
             and coalesce(g.quanto, 0) <= i.stock_minimum_threshold) desc,
            u.quando nulls first,
            i.name;
$fn$;

revoke all on function da_allineare() from public, anon, authenticated;
grant execute on function da_allineare() to authenticated;


-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit    uuid;
  v_staff  uuid;
  v_ente   uuid;
  v_ing    uuid;
  v_l1     uuid;
  v_l2     uuid;
  v_r      jsonb;
  v_n      integer;
  v_lap_p  integer;
  v_lap_d  integer;
  v_ok     boolean;
  v_val    numeric;
  v_scost_p numeric;
  v_scost_d numeric;
  v_stimato_p numeric;
  v_stimato_d numeric;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role <> 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  select count(*) into v_lap_p from deleted_records;
  select id into v_ente from entities order by created_at limit 1;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- ⚠️ Un ingrediente TUTTO NOSTRO: la lezione del 16/08 — il perimetro di una
  -- prova dev'essere fatto di roba che la prova ha creato, altrimenti il FEFO
  -- prende da un lotto vero e la giacenza vera resta corta senza spiegazione.
  insert into ingredients (entity_id, name, category, unit, waste_percentage_default, current_price)
  values (v_ente, '__VERIFICA__ allineamento', 'verdura', 'kg', 0, 7.00)
  returning id into v_ing;

  -- 🔴 DUE PARTITE A PREZZI DIVERSI, e i numeri sono scelti perché
  -- DISTINGUANO: 2 kg a 2,00 € che scadono prima, 10 kg a 5,00 € dopo.
  -- Togliendone 3: FEFO dà 2×2 + 1×5 = 9,00. Dalla più cara darebbe 15,00;
  -- a un prezzo medio (4,50) darebbe 13,50. Tre risposte diverse.
  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, expiry_date)
  values (v_ing, 2, 2, 2.00, current_date + 1) returning id into v_l1;
  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, expiry_date)
  values (v_ing, 10, 10, 5.00, current_date + 60) returning id into v_l2;

  -- 1 · MENO DEL PREVISTO: 12 attesi, 9 dichiarati.
  v_r := allinea_giacenza(v_ing, 9);
  if (v_r->>'atteso')::numeric <> 12 then
    raise exception 'L''atteso risulta % invece di 12.', v_r->>'atteso';
  end if;
  if (v_r->>'differenza')::numeric <> -3 then
    raise exception 'La differenza risulta % invece di -3.', v_r->>'differenza';
  end if;
  -- 🔴 IL NUMERO CHE DISTINGUE LA REGOLA FEFO DA OGNI ALTRA SCELTA.
  if (v_r->>'valore')::numeric <> -9.00 then
    raise exception
      'Lo scostamento vale % invece di -9,00: non si è tolto dalle partite che scadono prima.',
      v_r->>'valore';
  end if;
  if (select quantity_remaining from stock_lots where id = v_l1) <> 0
     or (select quantity_remaining from stock_lots where id = v_l2) <> 9 then
    raise exception 'Le partite non sono state toccate col metodo FEFO.';
  end if;

  -- 2 · SCRIVERE LO STESSO NUMERO NON PRODUCE NESSUNO SCOSTAMENTO.
  --     ⚠️ Distingue «registro le differenze» da «registro i salvataggi».
  select count(*) into v_n from rettifiche_giacenza where ingredient_id = v_ing;
  v_r := allinea_giacenza(v_ing, 9);
  if (v_r->>'registrata')::boolean then
    raise exception 'Scrivere lo stesso numero ha prodotto uno scostamento.';
  end if;
  if (select count(*) from rettifiche_giacenza where ingredient_id = v_ing) <> v_n then
    raise exception 'Scrivere lo stesso numero ha lasciato una riga nel registro.';
  end if;

  -- 3 · PIÙ DEL PREVISTO — ⚠️ è il caso che si dimentica sempre.
  v_r := allinea_giacenza(v_ing, 11);
  if (v_r->>'differenza')::numeric <> 2 then
    raise exception 'La correzione in aumento dà differenza % invece di 2.', v_r->>'differenza';
  end if;
  -- ⚠️ Entra all'ULTIMO PREZZO PAGATO (`current_price` = 7,00), non al costo
  -- di una partita scelta da un ordinamento: 2 × 7,00 = 14,00.
  -- 🔴 I numeri sono scelti perché DISTINGUANO: 7,00 non è nessuno dei due
  -- costi delle partite (2,00 e 5,00), quindi se il codice tornasse a
  -- leggerli questa riga diventerebbe rossa.
  if (v_r->>'valore')::numeric <> 14.00 then
    raise exception 'La merce trovata in più vale % invece di 14,00.', v_r->>'valore';
  end if;
  if (select coalesce(sum(quantity_remaining), 0) from stock_lots where ingredient_id = v_ing) <> 11 then
    raise exception 'Dopo la correzione in aumento la giacenza non è 11.';
  end if;

  -- 4 · 🔴 IL FOOD COST REALE SI MUOVE, LO STIMATO RESTA FERMO.
  --
  --     ⚠️ QUESTA VERIFICA È STATA RISCRITTA: la prima diceva solo «lo
  --     scostamento non è vuoto», e ROMPENDO IL CALCOLO APPOSTA — facendogli
  --     ignorare le rettifiche — **restava verde**. Non misurava niente, ed è
  --     esattamente il caso che il mandato temeva: *se non diventa rossa, i
  --     due numeri possono già essere lo stesso senza che nessuno lo veda.*
  --
  --     Ora si misura una DIFFERENZA che la verifica produce lei: si legge
  --     prima, si fa una rettifica di valore noto, si rilegge. Il numero è
  --     indipendente da cosa c'è già nel database.
  select f.stimato, f.scostamento into v_stimato_p, v_scost_p
    from food_cost_reale(current_date, current_date) f;

  -- Ne mancano 4 sulla partita da 5,00 €/kg → il costo vero sale di 20,00.
  v_r := allinea_giacenza(v_ing, 7);
  if (v_r->>'valore')::numeric <> -20.00 then
    raise exception 'La rettifica di controllo vale % invece di -20,00.', v_r->>'valore';
  end if;

  select f.stimato, f.scostamento, f.reale into v_stimato_d, v_scost_d, v_val
    from food_cost_reale(current_date, current_date) f;

  if v_scost_d - v_scost_p <> 20.00 then
    raise exception
      'Lo scostamento è passato da % a %: la rettifica da 20,00 non è entrata nel food cost reale.',
      v_scost_p, v_scost_d;
  end if;
  -- ⚠️ E lo stimato NON si muove: è il numero con cui Alessio decide i prezzi
  -- del menu, e se si muovesse da sé li deciderebbe su una cosa viva.
  if v_stimato_d <> v_stimato_p then
    raise exception 'Lo stimato si è mosso da % a % per una correzione in dispensa.',
      v_stimato_p, v_stimato_d;
  end if;
  -- ⚠️ E i due numeri devono essere DIVERSI: fusi, tutto il mandato non esiste.
  if v_val = v_stimato_d then
    raise exception 'Il food cost reale e quello stimato sono lo stesso numero (%).', v_val;
  end if;

  -- 5 · IL DETTAGLIO NOMINA IL PRODOTTO GIUSTO.
  select count(*) into v_n from scostamenti_per_prodotto(current_date, current_date)
   where ingredient_id = v_ing;
  if v_n <> 1 then
    raise exception 'Il dettaglio non nomina il prodotto corretto (righe: %).', v_n;
  end if;

  -- 6 · LO STAFF PUÒ CORREGGERE — decisione di Alessio.
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_r := allinea_giacenza(v_ing, 10);
    if not (v_r->>'registrata')::boolean then
      raise exception 'Lo staff non è riuscito a correggere una giacenza.';
    end if;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  end if;

  -- 7 · SENZA ACCESSO NON SI CORREGGE.
  v_ok := false;
  begin
    perform set_config('request.jwt.claims', null, true);
    perform allinea_giacenza(v_ing, 5);
  exception when others then
    v_ok := true;
  end;
  if not v_ok then raise exception 'Una giacenza è stata corretta senza accesso.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- =========== PULIZIA ===========
  delete from rettifiche_giacenza where ingredient_id = v_ing;
  delete from stock_lots where ingredient_id = v_ing;
  delete from ingredients where id = v_ing;

  if exists (select 1 from ingredients where name like '__VERIFICA__%') then
    raise exception 'La verifica ha lasciato delle righe finte.';
  end if;
  select count(*) into v_lap_d from deleted_records;
  if v_lap_d <> v_lap_p then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lap_d - v_lap_p;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Si dichiara quanto c''è, la differenza la calcola il gestionale, e si toglie dalla partita che scade prima.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260820000010', 'ce_n_e_questo')
on conflict (version) do nothing;
