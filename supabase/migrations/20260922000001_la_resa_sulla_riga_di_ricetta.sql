-- =====================================================================
-- LA RESA SULLA RIGA DI RICETTA — R12, 22/09/2026
-- =====================================================================
--
-- 🔴 LA DECISIONE, di Alessio, del 14/08/2026 (Blocco 5 del mandato
-- cumulativo): **lo scarto non appartiene all'ingrediente, appartiene alla
-- coppia ingrediente × ricetta.** Le stesse cozze scartano pochissimo per
-- un'impepata e moltissimo se se ne ricava il mollusco: un numero unico
-- sulla scheda del prodotto non descrive nessuno dei due casi e ne
-- precompila uno sbagliato.
--
-- E la resa si scrive **in lordo → netto** — «1,5 kg di cozze danno 400 g» —
-- non in percentuale: è come ragiona un cuoco, ed è leggibile fra sei mesi.
--
-- ---------------------------------------------------------------------
-- 🔴 DUE COSE MISURATE PRIMA DI SCRIVERE, e la seconda cambia il lavoro
-- ---------------------------------------------------------------------
--
-- **1. Quante formule ci sono, davvero.** Cercando nei corpi VIVI quali
-- funzioni usano lo scarto in un calcolo, sono **tre** — `fabbisogno_conto`,
-- `fabbisogno_preparazione`, `simula_prezzo_ingrediente` — più due viste,
-- `v_recipe_row_costs` e `recipe_ingredients_display`. **Tutte e cinque
-- usano la stessa forma**:
--
--     quantita * (1 + coalesce(riga.waste_percentage, ingrediente.waste_percentage_default, 0) / 100.0)
--
-- cioè il **lordo si ottiene MOLTIPLICANDO il netto per (1 + scarto/100)**.
-- Zero usano la forma opposta. Il calcolo, quindi, è già coerente con sé
-- stesso.
--
-- 🔴 **2. E la frase che lo spiega è FALSA.** Il commento del vincolo
-- `ingredients_scarto_sotto_cento`, scritto il 24/08, dice:
--
--     «il lordo si ricava dividendo per (1 - scarto/100), quindi a 100 è una
--      divisione per zero e sopra 100 il fabbisogno diventa negativo»
--
-- Nessuna funzione fa quella divisione. ⚠️ **Non è invecchiata: è nata
-- falsa** — come la frase sulle lapidi del 26/08 — e nessuno l'ha mai
-- misurata perché descriveva una cosa che sembrava ovvia. E non è innocua:
--   · è la frase che `spiega_vincolo()` mostra a chi sbaglia quel campo;
--   · con la formula vera il limite «< 100» **non ha la ragione che
--     dichiara** (a 100 non c'è nessuna divisione per zero: c'è uno scarto
--     che raddoppia la spesa, che è strano ma non assurdo).
-- Con i due numeri la differenza è enorme: a scarto 35, moltiplicare dà
-- 1,35 volte il netto, dividere ne dà 1,538. **Il quattordici per cento del
-- food cost di ogni piatto stava fra le due letture.**
--
-- ⚠️ E il metro con cui l'ho misurato guarda il **codice**, coi commenti
-- tolti: un setaccio che cerca una forma nel testo trova anche chi la
-- nomina per spiegarla (27/08).
--
-- ---------------------------------------------------------------------
-- 🔴 COME CAMBIA IL MODELLO
-- ---------------------------------------------------------------------
-- `recipe_ingredients.quantity` **è già il netto**: è quanto la ricetta
-- chiede, pulito. Quello che manca è il **lordo**, e si aggiunge accanto:
--
--     quantity        → il netto, quello che finisce nel piatto
--     quantita_lorda  → quanto se ne prende per averlo
--
-- 🔴 **`waste_percentage` DIVENTA UN RIFLESSO** (la forma che questo
-- progetto usa dal 16/08 per `orders.payment_method`, `order_tables.conto_aperto`
-- e `recipes.in_carta`): non è più un dato che si scrive, è il rapporto fra
-- i due numeri, scritto **solo da un trigger** e definito in **una funzione
-- sola**. Chi prova a scriverlo direttamente viene **rifiutato**, con la via
-- d'uscita nel messaggio — sovrascriverlo in silenzio farebbe passare per
-- accettata una scelta che il gestionale ha buttato via (regola del 30/08).
--
-- ⚠️ **Il calcolo del costo NON viene toccato**: continua a leggere
-- `waste_percentage` esattamente come prima. Quello che cambia è **da dove
-- quel numero viene**.
--
-- ---------------------------------------------------------------------
-- 🔴 L'ORDINE DELLE ISTRUZIONI E' LA COSA PIU' DELICATA DI QUESTO FILE
-- ---------------------------------------------------------------------
-- Scrivendo la prima stesura avevo messo il trigger **prima** della
-- sanatoria, e sarebbe stato un difetto silenzioso: l'`update` della
-- sanatoria lo avrebbe fatto scattare, il riflesso avrebbe riscritto
-- `waste_percentage` col valore **ricavato dal lordo arrotondato**, e su una
-- quantità come 0,0333 quel giro d'andata e ritorno non torna esatto — il
-- food cost di quel piatto si sarebbe spostato di un millesimo **senza che
-- nessuno lo dicesse**.
--
-- Quindi, in quest'ordine e non in un altro:
--   1. la colonna, vuota;
--   2. la fotografia del food cost di **ogni ricetta**, prima di toccare
--      qualunque cosa;
--   3. la sanatoria, che scrive il lordo **e** materializza lo scarto che
--      ogni riga aveva davvero (suo o ereditato dall'ingrediente);
--   4. il controllo che il giro d'andata e ritorno sia **esatto**, riga per
--      riga: se non lo è la migrazione **si ferma**, invece di spostare un
--      costo di nascosto;
--   5. solo adesso la funzione, il trigger e il vincolo;
--   6. il confronto col food cost della fotografia — che è la prova vera.
--
-- ---------------------------------------------------------------------
-- 🔴 UNA DECISIONE CHE RESTA AD ALESSIO, E NON LA PRENDO IO
-- ---------------------------------------------------------------------
-- `ingredients.waste_percentage_default` **non si tocca**, e dopo questa
-- migrazione **non si legge più in nessun calcolo**: la sanatoria scrive lo
-- scarto esplicito su ogni riga, quindi il
-- `coalesce(..., i.waste_percentage_default, 0)` non arriva mai al secondo
-- argomento.
--
-- ⚠️ E **nemmeno lo scrive più nessuno.** Misurato leggendo la migrazione
-- `20260823000007`: quel giorno Alessio decise che *«lo scarto non lo
-- propone più nessuno, si scrive a mano quando si sa»*, e la migrazione fece
-- due cose — tolse lo scarto dai campi mancanti di `prodotti_da_compilare`,
-- e fece **smettere `applica_scheda_prodotto` di scriverlo** anche se il
-- modello lo rimandasse. L'unica porta rimasta era il campo nella scheda del
-- prodotto, che R12 toglie.
--
-- 🔴 **Quindi da oggi quella colonna non è letta da niente e non è scritta
-- da nessuno**, e la domanda «si tiene o si butta?» è una decisione di
-- prodotto che **non prendo io**. Toglierla vorrebbe dire riscrivere
-- `create_ingredient` (che la prende come parametro),
-- `applica_scheda_prodotto`, `prodotti_troppo_piccoli`, `numeri_sospetti`,
-- il censimento delle unità e il vincolo `ingredients_scarto_sotto_cento`:
-- un lavoro suo, con una decisione dentro. ⚠️ E lasciarla dov'è ha il prezzo
-- che questo progetto conosce — *una colonna spenta, fra tre mesi, qualcuno
-- la riaccende credendo di riparare qualcosa* — che è precisamente il motivo
-- per cui è scritto qui invece di essere lasciato scoprire.
--
-- ⚠️ **La resa misurata continua a vincere dove esiste**: `rese_preparazione`
-- confronta quanto esce DAVVERO da una dose con quanto dice la ricetta, ed è
-- una misura della **preparazione**, non dell'ingrediente dentro la ricetta.
-- Non è toccata, e la decisione del 14/08 resta intera: *dove c'è una
-- produzione registrata la resa misurata vince, la dichiarata resta per la
-- lista della spesa*.
--
-- ---------------------------------------------------------------------
-- ⚠️ QUESTA MIGRAZIONE NON E' STATA APPLICATA DA NESSUNA PARTE
-- ---------------------------------------------------------------------
-- Il mandato che l'ha prodotta lo vieta. I suoi controlli — compreso quello
-- che confronta il food cost di ogni ricetta prima e dopo — non sono mai
-- girati contro un database.

-- ---------------------------------------------------------------------
-- 1. LA COLONNA NUOVA, ANCORA VUOTA
-- ---------------------------------------------------------------------
alter table recipe_ingredients
  add column if not exists quantita_lorda numeric(12,4);

comment on column recipe_ingredients.quantita_lorda is
  'Quanto se ne prende per ottenere il netto di `quantity`: «1,5 kg di cozze danno 400 g» sono 1,5 qui e 0,4 li''. Stessa unita'' della riga. E'' il dato che si scrive; lo scarto in percentuale e'' il suo riflesso, non il contrario. Uguale al netto quando non c''e'' scarto.';

-- ---------------------------------------------------------------------
-- 2. LA REGOLA, IN UN POSTO SOLO
-- ---------------------------------------------------------------------
-- 🔴 DUE PERCENTUALI DIVERSE, E VANNO TENUTE DISTINTE — è la confusione che
--    ha prodotto la frase falsa del 24/08:
--
--      lo SCARTO  = (lordo / netto - 1) * 100   → 1,5 su 0,4 fa 275
--      la RESA    = (netto / lordo)     * 100   → 1,5 su 0,4 fa 26,67
--
--    Lo **scarto** è quello che il calcolo del costo usa da sempre, e resta
--    lui. La **resa** è quella che si mostra, perché «da un chilo e mezzo ne
--    esce il ventisette per cento» si capisce, «lo scarto è il
--    duecentosettantacinque per cento» no.
create or replace function scarto_della_riga(p_lorda numeric, p_netta numeric)
returns numeric
language sql
immutable
as $fn$
  select case
           when coalesce(p_netta, 0) <= 0 then 0::numeric
           else round((coalesce(p_lorda, p_netta) / p_netta - 1) * 100, 2)
         end;
$fn$;

comment on function scarto_della_riga(numeric, numeric) is
  'Lo scarto in punti, nella forma che il calcolo del costo usa da sempre: il lordo e'' il netto moltiplicato per (1 + scarto/100). E'' l''UNICO posto in cui il rapporto fra lordo e netto diventa una percentuale. ⚠️ Non e'' la resa: la resa e'' netto/lordo, ed e'' quella che si mostra a chi guarda.';

-- 🔴 LA PORTA SI CHIUDE E BASTA (regola del 27/08, caso a): la chiamano solo
--    il trigger e questa migrazione. Nessuna schermata, nessun utente.
revoke all on function scarto_della_riga(numeric, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. LA FOTOGRAFIA DEL FOOD COST, PRIMA DI TOCCARE QUALUNQUE COSA
-- ---------------------------------------------------------------------
-- ⚠️ Una tabella temporanea, che muore con la sessione: non lascia niente
--    dietro di sé e non ha bisogno di nessuna pulizia.
drop table if exists zz_food_cost_prima;
create temp table zz_food_cost_prima as
  select recipe_id, food_cost_base, food_cost_portion from v_recipe_costs;

-- ---------------------------------------------------------------------
-- 4. LA SANATORIA
-- ---------------------------------------------------------------------
-- ⚠️ Si applica UNA VOLTA SOLA, guardata dal registro delle migrazioni:
--    rieseguirla riporterebbe indietro un lordo corretto a mano da Alessio
--    dopo l'applicazione — il difetto del giro A del 18/08.
-- ⚠️ E scrive **tutti e due** i numeri: il lordo, e lo scarto che quella
--    riga aveva DAVVERO (il suo, o quello ereditato dall'ingrediente).
--    Materializzarlo è ciò che stacca il calcolo dalla scheda del prodotto
--    senza spostare un centesimo.
do $sanatoria$
declare
  v_fatte integer;
  v_storte integer;
begin
  if exists (select 1 from applied_migrations where version = '20260922000001') then
    raise notice 'La sanatoria e'' gia'' stata fatta: non si ripete.';
  else
    update recipe_ingredients ri
       set waste_percentage = coalesce(ri.waste_percentage, i.waste_percentage_default, 0),
           quantita_lorda = round(
             ri.quantity * (1 + coalesce(ri.waste_percentage, i.waste_percentage_default, 0) / 100.0),
             4)
      from ingredients i
     where i.id = ri.ingredient_id
       and ri.quantita_lorda is null;
    get diagnostics v_fatte = row_count;
    raise notice 'Resa scritta su % righe con un ingrediente.', v_fatte;

    -- Le righe che puntano a una PREPARAZIONE non hanno un ingrediente da
    -- cui ereditare, e lo scarto della preparazione vive dentro di lei.
    update recipe_ingredients ri
       set waste_percentage = coalesce(ri.waste_percentage, 0),
           quantita_lorda = round(ri.quantity * (1 + coalesce(ri.waste_percentage, 0) / 100.0), 4)
     where ri.quantita_lorda is null;
    get diagnostics v_fatte = row_count;
    raise notice 'Resa scritta su % righe che puntano a una preparazione.', v_fatte;
  end if;

  -- 🔴 IL CONTROLLO CHE FERMA TUTTO SE IL GIRO NON TORNA ESATTO.
  --    `quantita_lorda` ha quattro decimali; `quantity` ne ha quattro e lo
  --    scarto due, quindi il prodotto può averne fino a otto. Dove
  --    l'arrotondamento morde, il rapporto fra i due numeri non riproduce
  --    più lo scarto di prima — e quel piatto costerebbe un millesimo in
  --    più o in meno. ⚠️ Non si aggiusta la soglia: ci si ferma, e si dice
  --    quali righe.
  select count(*) into v_storte
    from recipe_ingredients ri
   where scarto_della_riga(ri.quantita_lorda, ri.quantity)
         is distinct from coalesce(ri.waste_percentage, 0);
  if v_storte > 0 then
    raise exception 'FERMO: su % righe il lordo a quattro decimali non riproduce lo scarto che avevano. Il food cost di quei piatti si sposterebbe di nascosto. Servono piu'' decimali sul lordo, oppure quelle righe vanno guardate a mano: %',
      v_storte,
      (select string_agg(ri.id::text || ' (netto ' || ri.quantity || ', lordo ' || ri.quantita_lorda
                         || ', scarto ' || coalesce(ri.waste_percentage, 0) || ' contro '
                         || scarto_della_riga(ri.quantita_lorda, ri.quantity) || ')', ' · ')
         from recipe_ingredients ri
        where scarto_della_riga(ri.quantita_lorda, ri.quantity)
              is distinct from coalesce(ri.waste_percentage, 0)
        limit 10);
  end if;
  raise notice 'Il giro lordo → scarto torna esatto su tutte le righe.';
end $sanatoria$;

alter table recipe_ingredients alter column quantita_lorda set not null;

-- ---------------------------------------------------------------------
-- 5. IL NETTO NON PUO' SUPERARE IL LORDO
-- ---------------------------------------------------------------------
alter table recipe_ingredients drop constraint if exists riga_lordo_e_netto_coerenti;
alter table recipe_ingredients
  add constraint riga_lordo_e_netto_coerenti
  check (quantity > 0 and quantita_lorda >= quantity);

comment on constraint riga_lordo_e_netto_coerenti on recipe_ingredients is
  'La resa si scrive lordo e netto: «1,5 kg di cozze danno 400 g». Tutti e due maggiori di zero, e il netto non puo'' superare il lordo — da un chilo di cozze non escono due chili di mollusco. Se ti serve dire che una cosa cresce cuocendo (il riso che assorbe l''acqua), quella non e'' una resa: e'' la quantita'' della ricetta, e si scrive li''.';

-- ---------------------------------------------------------------------
-- 6. IL RIFLESSO — e solo adesso, non prima della sanatoria
-- ---------------------------------------------------------------------
create or replace function riflette_lo_scarto()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_atteso numeric;
begin
  -- Chi non dice il lordo non sta dichiarando uno scarto: il lordo e'' il
  -- netto. E'' la risposta vera — «nessuno ha detto che c'e'' scarto» — non
  -- un valore inventato.
  if new.quantita_lorda is null then
    new.quantita_lorda := new.quantity;
  end if;

  v_atteso := scarto_della_riga(new.quantita_lorda, new.quantity);

  -- 🔴 LO SCARTO NON SI SCRIVE: si riflette. Chi lo nomina con un valore
  --    diverso da quello che i due numeri dicono viene RIFIUTATO — e non
  --    sovrascritto in silenzio, che farebbe passare per accettata una
  --    scelta buttata via (regola del 30/08 sulla tasca).
  if tg_op = 'INSERT' then
    if new.waste_percentage is not null and new.waste_percentage is distinct from v_atteso then
      raise exception 'Lo scarto non si scrive piu'' a mano: si scrive quanto ne prendi e quanto ne resta, e la percentuale la calcola il gestionale. Questa riga dice scarto %, ma da % ne restano % e lo scarto e'' %. Togli lo scarto e scrivi la quantita'' lorda.',
        new.waste_percentage, new.quantita_lorda, new.quantity, v_atteso;
    end if;
  elsif new.waste_percentage is distinct from old.waste_percentage
        and new.waste_percentage is distinct from v_atteso then
    raise exception 'Lo scarto non si corregge a mano: cambia la quantita'' lorda o quella netta, e la percentuale si sposta da se''. Da % ne restano %, quindi lo scarto e'' %.',
      new.quantita_lorda, new.quantity, v_atteso;
  end if;

  new.waste_percentage := v_atteso;
  return new;
end;
$fn$;

revoke all on function riflette_lo_scarto() from public, anon, authenticated;

-- ⚠️ `insert or update` senza filtro di colonna: `update of colonna` guarda
--    cio' che e' stato NOMINATO, non cio' che e' cambiato (trappola del
--    27/08). Cambiando la sola `quantity`, un filtro sul lordo non
--    scatterebbe e lo scarto resterebbe quello di prima.
drop trigger if exists trg_riflette_lo_scarto on recipe_ingredients;
create trigger trg_riflette_lo_scarto
  before insert or update on recipe_ingredients
  for each row execute function riflette_lo_scarto();

comment on column recipe_ingredients.waste_percentage is
  'RIFLESSO di quantita_lorda e quantity, scritto solo dal trigger `trg_riflette_lo_scarto` (R12, 22/09/2026). Non si scrive e non si corregge a mano: si cambiano i due numeri. ⚠️ E'' lo SCARTO in punti nella forma che il calcolo del costo usa da sempre — il lordo e'' il netto per (1 + scarto/100) — non la resa, che e'' netto/lordo e si mostra soltanto.';

-- ---------------------------------------------------------------------
-- 7. LE DUE FRASI DIVENTATE FALSE, CORRETTE
-- ---------------------------------------------------------------------
-- ⚠️ Si corregge il COMMENTO, non il vincolo: il limite «< 100» resta dov'è
--    ed è innocuo. Quello che si toglie è la ragione sbagliata che
--    dichiarava, e che mandava fuori strada chi la leggeva.
comment on constraint ingredients_scarto_sotto_cento on ingredients is
  'Lo scarto e'' una percentuale in PUNTI (35 = 35%): il lordo si ottiene MOLTIPLICANDO il netto per (1 + scarto/100). ⚠️ Dal 22/09/2026 questo numero non entra piu'' in nessun calcolo: la resa vive sulla riga di ricetta, in lordo e netto. Qui non resta come proposta: dal 23/08/2026 non lo propone piu'' nessuno (`applica_scheda_prodotto` smise di scriverlo) e dal 22/09 non lo scrive piu'' nemmeno la scheda del prodotto. Il limite sotto 100 e'' una prudenza, non un''aritmetica: uno scarto che piu'' che raddoppia la spesa merita di essere scritto sulla riga, dove si vede.';

comment on column ingredients.waste_percentage_default is
  'Lo scarto tipico di questo prodotto. 🔴 DA OGGI NESSUNO LO SCRIVE E NESSUNO LO LEGGE, e non e'' una proposta: dal 23/08/2026 `applica_scheda_prodotto` ha smesso di scriverlo (decisione di Alessio: «lo scarto non lo propone piu'' nessuno»), e dal 22/09/2026 (R12) e'' sparito anche il campo nella scheda del prodotto, che era l''ultima porta. ⚠️ Dal 22/09/2026 non e'' piu'' nemmeno l''ingresso di nessun calcolo: il food cost e il fabbisogno leggono il lordo della RIGA di ricetta, perche'' lo scarto e'' una proprieta'' della coppia ingrediente × ricetta e non dell''ingrediente — le stesse cozze scartano pochissimo per un''impepata e moltissimo se se ne ricava il mollusco. ⚠️ Se questa colonna si tiene o si butta e'' una decisione di Alessio: toglierla vuol dire riscrivere create_ingredient, applica_scheda_prodotto, prodotti_troppo_piccoli, numeri_sospetti, il censimento delle unita'' e il vincolo ingredients_scarto_sotto_cento.';

-- ---------------------------------------------------------------------
-- 8. LA COPIA DI UNA RICETTA PORTA IL LORDO
-- ---------------------------------------------------------------------
-- 🔴 Riscritta dal CORPO VIVO (regola del 18/08), cambiando le sole colonne
--    copiate. ⚠️ Senza, la copia porterebbe lo scarto — che adesso il
--    riflesso RIFIUTA — e duplicare una ricetta smetterebbe di funzionare al
--    primo tentativo.
create or replace function duplica_ricetta(p_recipe_id uuid, p_nome text default null::text)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_orig   recipes%rowtype;
  v_nuova  uuid;
  v_nome   text;
  v_righe  integer;
  v_passi  integer;
begin
  select * into v_orig from recipes where id = p_recipe_id;
  if not found then
    raise exception 'La ricetta da copiare non esiste piu''.';
  end if;

  -- ⚠️ Il nome NON puo' restare identico: due schede con lo stesso nome in
  -- un elenco sono indistinguibili, e la prima cosa che si fa dopo una
  -- copia e' cercarla. Se chi chiama non ne propone uno, «(copia)».
  v_nome := coalesce(nullif(btrim(p_nome), ''), v_orig.name || ' (copia)');

  insert into recipes (
    name, category, subcategory, seasonality, portions_yield, tags, notes,
    menu_description, recipe_type, yield_quantity, yield_unit, prezzo_al_pezzo
  ) values (
    v_nome, v_orig.category, v_orig.subcategory, v_orig.seasonality,
    v_orig.portions_yield, v_orig.tags, v_orig.notes, v_orig.menu_description,
    v_orig.recipe_type, v_orig.yield_quantity, v_orig.yield_unit,
    v_orig.prezzo_al_pezzo
  )
  returning id into v_nuova;

  -- ⚠️ Si copiano i DUE NUMERI, non lo scarto: lo scarto e' un riflesso, e
  --    scriverlo verrebbe rifiutato. Copiando lordo e netto, la percentuale
  --    della copia esce identica a quella dell'originale da se'.
  insert into recipe_ingredients (
    recipe_id, ingredient_id, component_recipe_id, quantity, quantita_lorda, unit,
    prep_note
  )
  select v_nuova, ingredient_id, component_recipe_id, quantity, quantita_lorda, unit,
         prep_note
  from recipe_ingredients
  where recipe_id = p_recipe_id;
  get diagnostics v_righe = row_count;

  insert into recipe_steps (
    recipe_id, step_number, phase, description, technique, duration_min,
    is_active_time, temperature_c, is_haccp_ccp, haccp_limit, haccp_action,
    equipment
  )
  select v_nuova, step_number, phase, description, technique, duration_min,
         is_active_time, temperature_c, is_haccp_ccp, haccp_limit,
         haccp_action, equipment
  from recipe_steps
  where recipe_id = p_recipe_id;
  get diagnostics v_passi = row_count;

  return jsonb_build_object(
    'id', v_nuova,
    'nome', v_nome,
    'righe', v_righe,
    'passi', v_passi
  );
end;
$function$;

-- ---------------------------------------------------------------------
-- 9. LA RIGA, COME LA LEGGE UNA SCHERMATA
-- ---------------------------------------------------------------------
-- 🔴 `recipe_ingredients_display` riscritta dal CORPO VIVO, aggiungendo tre
--    colonne IN FONDO (mai in mezzo: `create or replace view` lo rifiuta,
--    errore 42P16).
-- ⚠️ La RESA si calcola qui e non nella schermata: è un numero che
--    comparirebbe in più posti, e due formule per lo stesso numero prima o
--    poi dicono due cose diverse.
create or replace view recipe_ingredients_display as
 select ri.id as recipe_ingredient_id,
    ri.recipe_id,
    coalesce(i.name, comp.name) as ingredient_name,
    i.category as ingredient_category,
    ri.quantity,
    ri.unit,
    coalesce(ri.waste_percentage, i.waste_percentage_default, 0::numeric) as waste_percentage,
    ri.prep_note,
    coalesce(i.allergens, '{}'::allergen[]) as allergens,
    ri.component_recipe_id is not null as is_preparation,
    ri.quantita_lorda,
    -- La resa: quanto del lordo finisce nel piatto.
    (case when coalesce(ri.quantita_lorda, 0) > 0
          then round(ri.quantity / ri.quantita_lorda * 100, 1)
          else 100::numeric end) as resa_percento,
    -- ⚠️ Da dove viene il numero. Oggi è sempre «dichiarata» sulla riga: la
    --    resa MISURATA vive in `rese_preparazione` e riguarda la
    --    preparazione intera, non l'ingrediente dentro la ricetta. Questa
    --    colonna esiste perché la schermata possa DIRLO invece di lasciarlo
    --    capire — e perché il giorno che una misura per riga esistesse, il
    --    posto dove dichiararla c'è già.
    'dichiarata'::text as origine_resa
   from recipe_ingredients ri
     left join ingredients i on i.id = ri.ingredient_id
     left join recipes comp on comp.id = ri.component_recipe_id;

-- ---------------------------------------------------------------------
-- 10. IL CONFRONTO CHE VALE: IL FOOD COST DI OGNI RICETTA
-- ---------------------------------------------------------------------
do $costi$
declare
  v_diverse integer;
  v_quali   text;
begin
  select count(*), string_agg(p.recipe_id::text || ' (' || p.food_cost_base || ' → ' || d.food_cost_base || ')', ' · ')
    into v_diverse, v_quali
    from zz_food_cost_prima p
    join v_recipe_costs d on d.recipe_id = p.recipe_id
   where p.food_cost_base is distinct from d.food_cost_base
      or p.food_cost_portion is distinct from d.food_cost_portion;

  if coalesce(v_diverse, 0) > 0 then
    raise exception 'FERMO: il food cost di % ricette si e'' mosso. Non doveva muoversi nessuno: %',
      v_diverse, v_quali;
  end if;

  -- ⚠️ E non basta che «nessuna sia diversa»: se la fotografia fosse vuota
  --    il confronto passerebbe senza aver guardato niente — la trappola del
  --    caso vuoto (17/08). Si dichiara quante ne sono state confrontate.
  select count(*) into v_diverse from zz_food_cost_prima;
  raise notice 'Food cost confrontato su % ricette: nessuna si e'' mossa.', v_diverse;
end $costi$;

drop table if exists zz_food_cost_prima;

-- =====================================================================
-- VERIFICA
-- =====================================================================
-- ⚠️ Tutto dentro una sotto-transazione che viene annullata (regola del
--    30/08): il registro delle cancellazioni resta acceso per tutto il
--    tempo e non nasce nessuna lapide finta da togliere.
do $verifica$
declare
  v_foto    jsonb := foto_righe();
  v_ent     uuid;
  v_ing     uuid;
  v_r1      uuid;
  v_r2      uuid;
  v_riga    uuid;
  v_copia   uuid;
  v_preso   boolean;
  v_num     numeric;
begin
  select id into v_ent from entities where entity_type = 'srls';
  if v_ent is null then raise exception 'Serve la societa'' per verificare.'; end if;

  begin  -- <<< la sotto-transazione che verra' annullata

    insert into ingredients (entity_id, name, category, unit, current_price, waste_percentage_default)
    values (v_ent, 'ZZ verifica resa - cozze', 'pesce', 'kg', 10, 25)
    returning id into v_ing;

    insert into recipes (name, category, portions_yield, recipe_type)
    values ('ZZ verifica resa - impepata', 'antipasto', 1, 'piatto_finito')
    returning id into v_r1;
    insert into recipes (name, category, portions_yield, recipe_type)
    values ('ZZ verifica resa - sugo', 'primo', 1, 'piatto_finito')
    returning id into v_r2;

    -- -------------------------------------------------------------
    -- (1) LO STESSO INGREDIENTE, DUE RESE DIVERSE IN DUE RICETTE.
    -- -------------------------------------------------------------
    -- È la ragione per cui questo blocco esiste: sulla scheda del prodotto
    -- un numero solo non descrive nessuno dei due casi.
    insert into recipe_ingredients (recipe_id, ingredient_id, quantity, quantita_lorda, unit)
    values (v_r1, v_ing, 1.0000, 1.1000, 'kg');          -- impepata: scarta poco
    insert into recipe_ingredients (recipe_id, ingredient_id, quantity, quantita_lorda, unit)
    values (v_r2, v_ing, 0.4000, 1.5000, 'kg')           -- sugo: si ricava il mollusco
    returning id into v_riga;

    if (select waste_percentage from recipe_ingredients where recipe_id = v_r1) is distinct from 10.00 then
      raise exception 'La prima riga doveva riflettere uno scarto del 10%%, ha %.',
        (select waste_percentage from recipe_ingredients where recipe_id = v_r1);
    end if;
    if (select waste_percentage from recipe_ingredients where id = v_riga) is distinct from 275.00 then
      raise exception 'La seconda riga doveva riflettere uno scarto del 275%%, ha %.',
        (select waste_percentage from recipe_ingredients where id = v_riga);
    end if;
    -- E la resa mostrata è l'ALTRA percentuale: 0,4 su 1,5 fa 26,7.
    select resa_percento into v_num from recipe_ingredients_display
     where recipe_ingredient_id = v_riga;
    if v_num is distinct from 26.7 then
      raise exception 'La resa mostrata doveva essere 26,7%%, e'' %.', v_num;
    end if;
    -- ⚠️ E lo scarto dell'ingrediente (25) non c'entra piu' niente: le due
    --    righe dicono 10 e 275, non 25 e 25.
    if (select count(distinct waste_percentage) from recipe_ingredients
         where recipe_id in (v_r1, v_r2)) <> 2 then
      raise exception 'Le due righe hanno lo stesso scarto: la resa non e'' della coppia.';
    end if;

    -- -------------------------------------------------------------
    -- (2) LORDO E NETTO UGUALI: RESA 100%, SCARTO ZERO.
    -- -------------------------------------------------------------
    insert into recipe_ingredients (recipe_id, ingredient_id, quantity, quantita_lorda, unit)
    values (v_r1, v_ing, 0.2000, 0.2000, 'kg') returning id into v_riga;
    if (select waste_percentage from recipe_ingredients where id = v_riga) is distinct from 0.00 then
      raise exception 'Lordo uguale al netto doveva dare scarto zero.';
    end if;
    select resa_percento into v_num from recipe_ingredients_display where recipe_ingredient_id = v_riga;
    if v_num is distinct from 100.0 then
      raise exception 'Lordo uguale al netto doveva dare resa 100%%, ha dato %.', v_num;
    end if;

    -- -------------------------------------------------------------
    -- (3) IL NETTO MAGGIORE DEL LORDO E' RESPINTO.
    -- -------------------------------------------------------------
    v_preso := false;
    begin
      insert into recipe_ingredients (recipe_id, ingredient_id, quantity, quantita_lorda, unit)
      values (v_r1, v_ing, 1.0000, 0.5000, 'kg');
    exception when check_violation then v_preso := true;
    end;
    if not v_preso then
      raise exception 'Da mezzo chilo sono usciti un chilo di netto: il vincolo non ha fermato niente.';
    end if;

    -- -------------------------------------------------------------
    -- (4) ZERO E NEGATIVI SONO RESPINTI.
    -- -------------------------------------------------------------
    v_preso := false;
    begin
      insert into recipe_ingredients (recipe_id, ingredient_id, quantity, quantita_lorda, unit)
      values (v_r1, v_ing, 0, 1, 'kg');
    exception when check_violation then v_preso := true;
    end;
    if not v_preso then raise exception 'Una riga col netto a zero e'' passata.'; end if;

    v_preso := false;
    begin
      insert into recipe_ingredients (recipe_id, ingredient_id, quantity, quantita_lorda, unit)
      values (v_r1, v_ing, 1, -1, 'kg');
    exception when check_violation then v_preso := true;
    end;
    if not v_preso then raise exception 'Una riga col lordo negativo e'' passata.'; end if;

    -- -------------------------------------------------------------
    -- (5) CHI NON DICE IL LORDO NON STA DICHIARANDO UNO SCARTO.
    -- -------------------------------------------------------------
    -- ⚠️ È la rampa che tiene in piedi ogni scrittura che esisteva prima:
    --    senza lordo, lordo = netto. La risposta vera, non un valore
    --    inventato — e in particolare NON lo scarto della scheda prodotto,
    --    che qui vale 25 e non deve entrare da nessuna porta.
    insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
    values (v_r1, v_ing, 0.3000, 'kg') returning id into v_riga;
    if (select quantita_lorda from recipe_ingredients where id = v_riga) is distinct from 0.3000 then
      raise exception 'Senza lordo, il lordo doveva essere il netto.';
    end if;
    if (select waste_percentage from recipe_ingredients where id = v_riga) is distinct from 0.00 then
      raise exception 'Senza lordo e'' rientrato dalla finestra lo scarto della scheda prodotto: %.',
        (select waste_percentage from recipe_ingredients where id = v_riga);
    end if;

    -- -------------------------------------------------------------
    -- (6) LO SCARTO NON SI SCRIVE PIU' A MANO: SI RIFIUTA.
    -- -------------------------------------------------------------
    v_preso := false;
    begin
      insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit, waste_percentage)
      values (v_r1, v_ing, 0.5000, 'kg', 30);
    exception when others then
      v_preso := true;
      if sqlerrm not like '%non si scrive piu%' then
        raise exception 'Lo scarto scritto a mano e'' stato respinto, ma col messaggio sbagliato: %', sqlerrm;
      end if;
    end;
    if not v_preso then raise exception 'Lo scarto si e'' lasciato scrivere a mano.'; end if;

    -- ...e non si corregge nemmeno dopo.
    v_preso := false;
    begin
      update recipe_ingredients set waste_percentage = 99 where id = v_riga;
    exception when others then
      v_preso := true;
      if sqlerrm not like '%non si corregge a mano%' then
        raise exception 'La correzione dello scarto e'' stata respinta col messaggio sbagliato: %', sqlerrm;
      end if;
    end;
    if not v_preso then raise exception 'Lo scarto si e'' lasciato correggere a mano.'; end if;

    -- -------------------------------------------------------------
    -- (7) CAMBIANDO I NUMERI, LO SCARTO SI SPOSTA DA SE'.
    -- -------------------------------------------------------------
    -- ⚠️ Il secondo caso è quello che un trigger scritto
    --    `update of quantita_lorda` non vedrebbe: si tocca solo `quantity`
    --    (trappola del 27/08).
    update recipe_ingredients set quantita_lorda = 1.0000, quantity = 0.5000 where id = v_riga;
    if (select waste_percentage from recipe_ingredients where id = v_riga) is distinct from 100.00 then
      raise exception 'Cambiando i due numeri lo scarto non si e'' spostato: e'' %.',
        (select waste_percentage from recipe_ingredients where id = v_riga);
    end if;
    update recipe_ingredients set quantity = 0.2500 where id = v_riga;
    if (select waste_percentage from recipe_ingredients where id = v_riga) is distinct from 300.00 then
      raise exception 'Cambiando il solo netto lo scarto non si e'' spostato: e'' %.',
        (select waste_percentage from recipe_ingredients where id = v_riga);
    end if;

    -- -------------------------------------------------------------
    -- (8) LA COPIA DI UNA RICETTA PORTA IL LORDO, E NON VIENE RESPINTA.
    -- -------------------------------------------------------------
    perform duplica_ricetta(v_r2, 'ZZ verifica resa - copia');
    select id into v_copia from recipes where name = 'ZZ verifica resa - copia';
    select quantita_lorda into v_num from recipe_ingredients where recipe_id = v_copia limit 1;
    if v_num is distinct from 1.5000 then
      raise exception 'La copia non ha portato il lordo: ha %.', v_num;
    end if;
    select waste_percentage into v_num from recipe_ingredients where recipe_id = v_copia limit 1;
    if v_num is distinct from 275.00 then
      raise exception 'La copia non ha riflesso lo scarto dell''originale: ha %.', v_num;
    end if;

    -- -------------------------------------------------------------
    -- (9) IL FOOD COST LEGGE IL LORDO, E FA IL NUMERO GIUSTO.
    -- -------------------------------------------------------------
    -- Il sugo: 0,4 kg netti, 1,5 lordi, a 10 euro al kg → 15,00.
    select food_cost_base into v_num from v_recipe_costs where recipe_id = v_r2;
    if round(v_num, 2) is distinct from 15.00 then
      raise exception 'Il food cost del sugo doveva essere 15,00 (1,5 kg a 10 euro): e'' %.', v_num;
    end if;

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform pretendi_nessun_residuo(v_foto, 'la verifica della resa sulla riga di ricetta');

  raise notice 'Fatto: la resa vive sulla riga in lordo e netto, lo scarto e'' il suo riflesso e non si scrive piu'' a mano, lo stesso ingrediente ha rese diverse in ricette diverse, e nessun food cost si e'' mosso. Provato nei due versi e annullato: zero residui.';
end $verifica$;

-- ---------------------------------------------------------------------
-- La migrazione si registra da sé
-- ---------------------------------------------------------------------
insert into applied_migrations (version, name)
values ('20260922000001', 'la_resa_sulla_riga_di_ricetta')
on conflict (version) do nothing;
