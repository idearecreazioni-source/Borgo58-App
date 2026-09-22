-- =====================================================================
-- LA RESA SULLA RIGA DI RICETTA — R12, 22/09/2026
-- =====================================================================
--
-- 🔴 LA DECISIONE, di Alessio, del 14/08/2026 (Blocco 5 del mandato
-- cumulativo): **lo scarto non appartiene all'ingrediente, appartiene alla
-- coppia ingrediente × ricetta.** Le stesse cozze scartano pochissimo per
-- un'impepata e moltissimo se se ne ricava il mollusco: un numero unico
-- sulla scheda del prodotto non può descrivere tutt'e due i casi.
--
-- E la resa si scrive **in lordo → netto** — «1,5 kg di cozze danno 400 g» —
-- non in percentuale: è come ragiona un cuoco, ed è leggibile fra sei mesi.
--
-- ⚠️ **QUESTO NON TOGLIE IL NUMERO DALLA SCHEDA DEL PRODOTTO**, e la
-- differenza è tutta qui: quel numero resta, facoltativo, e **precompila una
-- volta** i due della riga nuova. Quello che smette di fare è **decidere al
-- posto di righe già scritte** — vedi «precompila una volta» più sotto, che
-- è la decisione di Alessio del 22/09.
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
-- 🔴 IL VALORE STANDARD DEL PRODOTTO RESTA, E CAMBIA MESTIERE
-- ---------------------------------------------------------------------
-- 🔴 **DECISIONE DI ALESSIO, 22/09/2026**, che conferma quella del 25/08 —
-- *«il campo % scarto standard RESTA: serve per l'ingrediente che va solo
-- pulito, senza una preparazione da cui ricavare la resa»* — e le dà la
-- forma che le mancava:
--
--     il valore standard del prodotto resta, FACOLTATIVO, e serve soltanto
--     a PRECOMPILARE UNA VOLTA lordo e netto quando nasce una riga di
--     ricetta. Dopo la creazione la riga è autonoma e autorevole: nessuna
--     eredità viva dal prodotto.
--
-- ⚠️ **La prima stesura di questa migrazione toglieva il campo**, e sarebbe
-- stato un rovesciamento di quella decisione fatto dentro un commento. Non
-- confermato: il caso del carciofo che si pulisce e basta è vero, e togliere
-- il campo avrebbe obbligato a riscrivere lo stesso numero su ogni ricetta
-- che usa quel prodotto — partendo da zero ogni volta.
--
-- ---------------------------------------------------------------------
-- 🔴 «PRECOMPILA UNA VOLTA» E «EREDITA PER SEMPRE» SONO DUE COSE DIVERSE
-- ---------------------------------------------------------------------
-- Ed è **questa** la cosa che la migrazione cambia davvero. Fino a oggi il
-- valore del prodotto non precompilava niente: **si sostituiva al volo** a
-- ogni calcolo, con `coalesce(riga.waste_percentage, prodotto.default, 0)`.
-- Conseguenza misurabile: **cambiando il numero sulla scheda del prodotto si
-- spostava il food cost di ogni ricetta che lo usa**, comprese quelle
-- scritte mesi prima da chi quel numero non l'aveva scelto.
--
-- ⚠️ *Un valore che continua a valere per righe già scritte non è un
-- valore standard: è una decisione presa al posto di chi le ha scritte.*
--
-- Da qui in avanti:
--   · la sanatoria **materializza** su ogni riga lo scarto che quella riga
--     aveva davvero — suo, oppure ereditato in quel momento dal prodotto;
--   · `recipe_ingredients.waste_percentage` diventa **`not null`**, quindi
--     il secondo argomento di quei `coalesce` **non è più raggiungibile**;
--   · e i **cinque** punti che lo nominavano vengono riscritti dal loro
--     corpo vivo, perché un `coalesce` morto che sembra vivo è la cosa che
--     qualcuno riaccende fra tre mesi credendo di riparare qualcosa.
--
-- 🔴 **E IL LIMITE «SOTTO 100» SE NE VA**, che è la seconda metà della
-- decisione del 22/09. Non era una prudenza: era la conseguenza della frase
-- falsa qui sopra. Con la formula vera uno scarto del **275%** è la realtà
-- di un sugo di cozze (1,5 kg → 400 g), e il vincolo lo **rifiutava**. Al
-- suo posto resta la sola cosa vera: **non può essere negativo**.
--
-- ⚠️ **La colonna resta `waste_percentage_default`, cioè uno SCARTO**, e non
-- diventa una resa nel database: i cinque calcoli leggono quella forma da
-- sempre, e cambiarla vorrebbe dire toccarli tutti per un guadagno che è di
-- **lettura**, non di sostanza. La resa è come il numero si **scrive e si
-- legge** in schermata (`src/lib/calcoli/resa.js`, un posto solo) — «da 1 kg
-- ne restano 300 g» — mentre sotto resta lo scarto che i conti usano.
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
--
-- 🔴 RILASCIO IN DUE FASI (aggiunto il 22/09/2026): questa migrazione da
--    sola deve poter andare in produzione PRIMA del sito nuovo, senza un
--    intervallo in cui il sito vecchio smette di salvare. Per questo il
--    trigger (blocco 6) accetta ancora — e converte — lo scarto scritto
--    da solo, senza lordo, invece di rifiutarlo. La chiusura di questa
--    tolleranza (`waste_percentage` obbligatorio insieme al lordo) e'' un
--    lavoro SEPARATO, da fare in una migrazione propria e solo dopo che il
--    sito nuovo e'' pubblicato e verificato: unirla qui ricreerebbe lo
--    stesso intervallo incompatibile che questa fase vuole evitare.

-- ---------------------------------------------------------------------
-- 1. LA COLONNA NUOVA, ANCORA VUOTA
-- ---------------------------------------------------------------------
-- 🔴 OTTO DECIMALI, E IL NUMERO NON E' SCELTO A OCCHIO: ESCE DAI TIPI CHE
--    CI SONO GIA'. Il primo tentativo su Prova l'aveva dichiarata
--    `numeric(12,4)`, e la migrazione **si e' fermata da sola** su 25
--    righe vere — quantita' minuscole (spezie e sale, fino a 0,0002 kg) su
--    cui quattro decimali non bastano a far tornare il rapporto.
--
--    L'aritmetica, invece dell'esperienza:
--      · `quantity`          e' `numeric(12,4)`  → 4 decimali
--      · `waste_percentage`  e' `numeric(5,2)`   → 2 decimali, quindi
--        `1 + w/100` ne ha 4
--      · il prodotto dei due ne ha quindi **fino a 8**, e a 8 e' ESATTO.
--    Il caso estremo si scrive: `quantity` 0,0001 con scarto 0,01% da un
--    lordo di 0,00010001 — otto decimali, nessuno di piu'.
--
-- ⚠️ E LA PARTE INTERA NON SI RESTRINGE, che e' l'altra meta'. Il massimo
--    lordo ottenibile dai tipi di oggi e' 99.999.999,9999 × (1 + 999,99/100)
--    ≈ 1,1 miliardi: **dieci cifre intere**. `numeric(18,8)` ne lascia
--    esattamente 18 − 8 = 10. ⚠️ `numeric(12,6)` sarebbe stato il tranello
--    comodo: aggiunge decimali **togliendo** cifre intere (6 invece di 8),
--    cioe' cura il caso trovato e ne apre uno nuovo che nessuno cercava.
alter table recipe_ingredients
  add column if not exists quantita_lorda numeric(18,8);

comment on column recipe_ingredients.quantita_lorda is
  'Quanto se ne prende per ottenere il netto di `quantity`: «1,5 kg di cozze danno 400 g» sono 1,5 qui e 0,4 li''. Stessa unita'' della riga. E'' il dato che si scrive; lo scarto in percentuale e'' il suo riflesso, non il contrario. Uguale al netto quando non c''e'' scarto. ⚠️ OTTO DECIMALI perche'' il prodotto di `quantity` (4 decimali) per `1 + waste_percentage/100` (4 decimali) ne ha fino a 8: a meno di 8 il rapporto non riproduce lo scarto e il food cost si sposterebbe in silenzio. E DIECI CIFRE INTERE perche'' il massimo lordo ottenibile dai tipi di oggi sfiora 1,1 miliardi.';

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
           -- 8 e non 4: e' il numero di decimali che il prodotto puo'
           -- avere davvero (vedi §1). A 4 il rapporto non riproduceva lo
           -- scarto su 25 righe vere, e la migrazione si fermava.
           quantita_lorda = round(
             ri.quantity * (1 + coalesce(ri.waste_percentage, i.waste_percentage_default, 0) / 100.0),
             8)
      from ingredients i
     where i.id = ri.ingredient_id
       and ri.quantita_lorda is null;
    get diagnostics v_fatte = row_count;
    raise notice 'Resa scritta su % righe con un ingrediente.', v_fatte;

    -- Le righe che puntano a una PREPARAZIONE non hanno un ingrediente da
    -- cui ereditare, e lo scarto della preparazione vive dentro di lei.
    update recipe_ingredients ri
       set waste_percentage = coalesce(ri.waste_percentage, 0),
           quantita_lorda = round(ri.quantity * (1 + coalesce(ri.waste_percentage, 0) / 100.0), 8)
     where ri.quantita_lorda is null;
    get diagnostics v_fatte = row_count;
    raise notice 'Resa scritta su % righe che puntano a una preparazione.', v_fatte;
  end if;

  -- 🔴 IL CONTROLLO CHE FERMA TUTTO SE IL GIRO NON TORNA ESATTO.
  --    `quantity` ha quattro decimali e lo scarto due, quindi il prodotto
  --    puo' averne fino a otto: con meno di otto sul lordo il rapporto fra
  --    i due numeri non riproduce lo scarto di prima, e quel piatto
  --    costerebbe un millesimo in piu' o in meno. ⚠️ Non si aggiusta la
  --    soglia: ci si ferma, e si dice quali righe.
  -- ✅ E IL 22/09 SI E' FERMATO DAVVERO, su Prova: 25 righe con quattro
  --    decimali. Non e' un controllo teorico — e' quello che ha impedito a
  --    25 ricette di cambiare costo nella notte.
  select count(*) into v_storte
    from recipe_ingredients ri
   where scarto_della_riga(ri.quantita_lorda, ri.quantity)
         is distinct from coalesce(ri.waste_percentage, 0);
  if v_storte > 0 then
    -- ⚠️ IL LIMITE VA PRIMA DELL'AGGREGAZIONE, e la prima stesura lo
    --    metteva dopo: `limit 10` accanto a `string_agg` limita le righe
    --    del RISULTATO — che sono una — non gli elementi che finiscono
    --    dentro la frase. Il 22/09 il messaggio prometteva «i primi dieci»
    --    e ne ha elencate venticinque, in una riga sola.
    --    *Un messaggio che promette un numero e ne dice un altro insegna a
    --    non fidarsi dei numeri che dice.*
    -- ⚠️ E l'ordine e' DETERMINISTICO (`order by ri.id`): senza, due
    --    esecuzioni sugli stessi dati nominerebbero dieci righe diverse, e
    --    chi confronta due messaggi crederebbe che siano cambiati i dati.
    raise exception 'FERMO: su % righe il lordo non riproduce lo scarto che avevano. Il food cost di quei piatti si sposterebbe di nascosto. Servono piu'' decimali sul lordo, oppure quelle righe vanno guardate a mano. Ecco i primi % casi (su %): %',
      v_storte,
      least(v_storte, 10),
      v_storte,
      (select string_agg(d.riga, ' · ')
         from (select ri.id::text || ' (netto ' || ri.quantity || ', lordo ' || ri.quantita_lorda
                      || ', scarto ' || coalesce(ri.waste_percentage, 0) || ' contro '
                      || scarto_della_riga(ri.quantita_lorda, ri.quantity) || ')' as riga
                 from recipe_ingredients ri
                where scarto_della_riga(ri.quantita_lorda, ri.quantity)
                      is distinct from coalesce(ri.waste_percentage, 0)
                order by ri.id
                limit 10) d);
  end if;
  raise notice 'Il giro lordo → scarto torna esatto su tutte le righe.';
end $sanatoria$;

alter table recipe_ingredients alter column quantita_lorda set not null;

-- 🔴 E QUESTA RIGA E' QUELLA CHE SPEGNE L'EREDITA' VIVA, per costruzione e
--    non per promessa. Finche' `waste_percentage` poteva essere vuota, il
--    `coalesce(ri.waste_percentage, i.waste_percentage_default, 0)` dei
--    cinque calcoli aveva un secondo argomento **raggiungibile**: bastava
--    una riga senza scarto perche' il numero della scheda del prodotto
--    tornasse a decidere al posto suo. Adesso non e' piu' raggiungibile da
--    nessuna riga, presente o futura — e il riflesso la riempie sempre.
-- ⚠️ La sanatoria l'ha appena riempita su TUTTE le righe: se questa
--    istruzione fallisse, vorrebbe dire che la sanatoria ne ha saltata una,
--    ed e' giusto che si fermi qui invece di lasciare un buco.
alter table recipe_ingredients alter column waste_percentage set not null;

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
-- 🔴 PERIODO DI PASSAGGIO (R12, aggiunto il 22/09/2026 per il rilascio in
--    due fasi): il sito vecchio scrive ancora `waste_percentage` da solo,
--    senza sapere che `quantita_lorda` esiste. Se questa migrazione lo
--    rifiutasse, pubblicare il database prima del sito romperebbe ogni
--    salvataggio del sito vecchio ancora in giro. Finche'' i due non sono
--    scritti insieme, chi manda SOLO lo scarto viene preso in parola: il
--    lordo si RICAVA da quanto dichiara, invece di essere rifiutato o
--    sostituito da un lordo pari al netto (che avrebbe cancellato lo
--    scarto dichiarato in silenzio). ⚠️ QUESTO RAMO E'' TEMPORANEO: si
--    chiude con una migrazione separata, solo dopo che il sito nuovo e''
--    pubblicato e verificato, che rendera'' di nuovo obbligatorio il
--    lordo e togliera'' questa tolleranza.
create or replace function riflette_lo_scarto()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_atteso numeric;
  v_vecchio_client boolean := false;
begin
  if new.quantita_lorda is null then
    if new.waste_percentage is not null then
      -- Il vecchio client: c'e'' uno scarto dichiarato e nessun lordo.
      -- Si ricava il lordo da quello che ha detto, non da un'ipotesi di
      -- scarto zero.
      new.quantita_lorda := round(new.quantity * (1 + new.waste_percentage / 100.0), 8);
      v_vecchio_client := true;
    else
      -- Ne' lordo ne'' scarto: chi non dice il lordo non sta dichiarando
      -- uno scarto, il lordo e'' il netto. E'' la risposta vera —
      -- «nessuno ha detto che c'e'' scarto» — non un valore inventato.
      new.quantita_lorda := new.quantity;
    end if;
  elsif tg_op = 'UPDATE'
        and new.quantita_lorda is not distinct from old.quantita_lorda
        and new.waste_percentage is distinct from old.waste_percentage then
    -- Lo stesso caso, in aggiornamento: il vecchio client corregge lo
    -- scarto senza toccare il lordo (che non conosce). Si ricalcola il
    -- lordo dal nuovo scarto invece di rifiutare la modifica.
    new.quantita_lorda := round(new.quantity * (1 + new.waste_percentage / 100.0), 8);
    v_vecchio_client := true;
  end if;

  v_atteso := scarto_della_riga(new.quantita_lorda, new.quantity);

  -- 🔴 LO SCARTO NON SI SCRIVE: si riflette. Chi lo nomina con un valore
  --    diverso da quello che i due numeri dicono viene RIFIUTATO — e non
  --    sovrascritto in silenzio, che farebbe passare per accettata una
  --    scelta buttata via (regola del 30/08 sulla tasca). ⚠️ Non vale per
  --    il vecchio client: li'' il lordo appena ricavato riproduce lo
  --    scarto dichiarato per costruzione, e non c'e'' niente da rifiutare.
  if not v_vecchio_client then
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
  'RIFLESSO di quantita_lorda e quantity, scritto solo dal trigger `trg_riflette_lo_scarto` (R12, 22/09/2026). Non si scrive e non si corregge a mano: si cambiano i due numeri. ⚠️ E'' lo SCARTO in punti nella forma che il calcolo del costo usa da sempre — il lordo e'' il netto per (1 + scarto/100) — non la resa, che e'' netto/lordo e si mostra soltanto. 🔴 PERIODO DI PASSAGGIO: chi scrive SOLO questo campo (il sito vecchio, che non conosce quantita_lorda) viene preso in parola e il lordo si ricava da qui — tolleranza temporanea, chiusa da una migrazione separata dopo la pubblicazione del sito nuovo.';

-- ---------------------------------------------------------------------
-- 7. IL VALORE STANDARD DEL PRODOTTO: IL LIMITE FALSO E IL MESTIERE NUOVO
-- ---------------------------------------------------------------------
-- 🔴 IL LIMITE «SOTTO 100» SE NE VA, ed e' una decisione di Alessio del
--    22/09. Non era una prudenza: era la conseguenza di una frase nata
--    falsa il 24/08 — «il lordo si ricava dividendo per (1 - scarto/100),
--    quindi a 100 e' una divisione per zero». Nessun calcolo di questo
--    progetto ha mai fatto quella divisione: misurati sui corpi vivi,
--    **cinque moltiplicano e zero dividono**.
-- ⚠️ E il limite non era innocuo, perche' RIFIUTAVA ANCHE I CASI BUONI:
--    con la formula vera un sugo di cozze (1,5 kg → 400 g) ha uno scarto
--    del **275%**, e quel vincolo lo respingeva. Al suo posto resta la
--    sola cosa che e' davvero vera: non puo' essere negativo.
-- ⚠️ IL NOME CAMBIA INSIEME ALLA REGOLA. Lasciarlo
--    `ingredients_scarto_sotto_cento` su un vincolo che non guarda piu'
--    il cento sarebbe una frase falsa scritta nel posto che questo
--    progetto mostra all'utente quando rifiuta.
alter table ingredients drop constraint if exists ingredients_scarto_sotto_cento;
alter table ingredients drop constraint if exists ingredients_scarto_standard_sensato;
alter table ingredients
  add constraint ingredients_scarto_standard_sensato
  check (waste_percentage_default is null or waste_percentage_default >= 0);

comment on constraint ingredients_scarto_standard_sensato on ingredients is
  'Lo scarto standard e'' una percentuale in PUNTI (35 = 35%) e non puo'' essere negativo: il lordo si ottiene MOLTIPLICANDO il netto per (1 + scarto/100), quindi un numero sotto zero vorrebbe dire che comprando meno se ne ottiene di piu''. ⚠️ Sopra 100 e'' AMMESSO ed e'' normale: da 1,5 kg di cozze escono 400 g di mollusco, cioe'' uno scarto del 275%. Il vecchio limite «sotto 100» e'' stato tolto il 22/09/2026 — veniva da una formula sbagliata scritta in questo stesso commento il 24/08, e rifiutava casi veri. ⚠️ Puo'' restare VUOTO, e vuoto non vuol dire zero: vuol dire che per questo prodotto non lo sa ancora nessuno.';

-- 🔴 E LA COLONNA CAMBIA MESTIERE, che e' l'altra meta' della decisione.
comment on column ingredients.waste_percentage_default is
  'Lo scarto tipico di questo prodotto — quanto se ne butta pulendolo. FACOLTATIVO, e vuoto non e'' zero: vuol dire che nessuno l''ha ancora detto. 🔴 DAL 22/09/2026 (R12) SERVE SOLO A PRECOMPILARE UNA VOLTA lordo e netto quando NASCE una riga di ricetta: dopo, la riga e'' autonoma e comanda lei. Prima invece si sostituiva al volo a ogni calcolo, quindi cambiando questo numero si spostava il food cost di ricette scritte mesi prima da chi quel numero non l''aveva scelto. ⚠️ Non e'' piu'' raggiungibile da nessun calcolo: recipe_ingredients.waste_percentage e'' `not null`, e i cinque punti che lo nominavano sono stati riscritti. ⚠️ In schermata si scrive e si legge come RESA — «da 1 kg ne restano 300 g» — perche'' una resa si capisce e uno scarto del 275% no; qui sotto resta lo scarto, che e'' la forma che i conti usano da sempre.';

-- ⚠️ E LA DECISIONE DEL 25/08 RESTA SCRITTA DOVE VIVE: il campo serve per
--    l'ingrediente che va solo pulito, senza una preparazione da cui
--    ricavare la resa. Quello che cambia non e' se esiste: e' fin dove
--    arriva.

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
    -- 🔴 QUI SPARISCE L'EREDITA' VIVA, ed era uno dei cinque punti: prima
    --    una riga senza scarto prendeva quello della scheda del prodotto, a
    --    ogni lettura. Adesso `waste_percentage` e' `not null` e la riga
    --    risponde per se'.
    ri.waste_percentage,
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
-- 9-bis. GLI ALTRI QUATTRO PUNTI CHE EREDITAVANO DAL PRODOTTO
-- ---------------------------------------------------------------------
-- 🔴 I punti dove il valore della scheda del prodotto si sostituiva a
--    quello della riga erano CINQUE, misurati sui corpi vivi del
--    progetto di prova e non ricordati: `recipe_ingredients_display`
--    (appena riscritta qui sopra), `v_recipe_row_costs`,
--    `fabbisogno_conto`, `fabbisogno_preparazione` e
--    `simula_prezzo_ingrediente`.
--
-- ⚠️ DOPO IL `not null` QUEL RAMO E' GIA' IRRAGGIUNGIBILE, e si potrebbe
--    lasciarlo scritto. Non si fa, ed e' una regola di questo progetto:
--    *un `coalesce` morto che sembra vivo e' la cosa che qualcuno
--    riaccende fra tre mesi credendo di riparare qualcosa.* La riga che
--    resta dice il vero: la riga di ricetta risponde per se'.
--
-- ⚠️ TUTTI E QUATTRO PRESI DAL CORPO VIVO (regola del 18/08), da un
--    programma che FALLISCE se non trova l'ancora — non ricopiati a mano:
--    fra la migrazione che ha creato una funzione e il suo corpo di oggi
--    ci stanno tutte le migrazioni che l'hanno toccata nel mezzo.

-- ⚠️ In `v_recipe_row_costs` lo zero RESTA, e non e' l'eredita' che si sta
--    togliendo: serve al LEFT JOIN, per la riga che non ha nessuna
--    espansione sotto di se'.

-- ⚠️ In `simula_prezzo_ingrediente` il default arrivava per un'altra
--    strada — letto in una variabile e usato come secondo argomento — e
--    se ne va anche la VARIABILE: lasciarla dichiarata e mai usata
--    sarebbe la stessa cosa che lasciare il coalesce.

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
           sum(e.multiplier * (1 + e.waste_percentage / 100.0)) as quantita
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

CREATE OR REPLACE FUNCTION public.fabbisogno_preparazione(p_recipe_id uuid, p_dosi numeric)
 RETURNS TABLE(ingredient_id uuid, quantita numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with recursive esplosione as (
    select ri.ingredient_id,
           ri.component_recipe_id,
           (p_dosi * ri.quantity)::numeric as qta,
           ri.waste_percentage,
           1 as depth
      from recipe_ingredients ri
     where ri.recipe_id = p_recipe_id
    union all
    select ri2.ingredient_id,
           ri2.component_recipe_id,
           (e.qta * ri2.quantity / nullif(comp.yield_quantity, 0)),
           ri2.waste_percentage,
           e.depth + 1
      from esplosione e
      join recipes comp           on comp.id = e.component_recipe_id
      join recipe_ingredients ri2 on ri2.recipe_id = e.component_recipe_id
     where e.component_recipe_id is not null
       and e.depth < 10
       -- L'INTERRUTTORE: si esplode solo se quel semilavorato non esiste
       -- in cella. Se esiste, lo si consuma (sotto), col costo di quel
       -- giorno.
       and not exists (
         select 1
           from ingredients pi
           join stock_lots sl on sl.ingredient_id = pi.id
          where pi.preparazione_id = e.component_recipe_id
            and sl.quantity_remaining > 0
       )
  ),
  -- a) la materia prima
  materia as (
    select e.ingredient_id,
           sum(e.qta * (1 + e.waste_percentage / 100.0)) as quantita
      from esplosione e
      join ingredients i on i.id = e.ingredient_id
     where e.ingredient_id is not null
       and e.qta is not null
     group by e.ingredient_id
  ),
  -- b) i semilavorati che ci sono davvero, presi come sono
  semilavorati as (
    select pi.id as ingredient_id, sum(e.qta) as quantita
      from esplosione e
      join ingredients pi on pi.preparazione_id = e.component_recipe_id
     where e.component_recipe_id is not null
       and e.qta is not null
       and exists (
         select 1 from stock_lots sl
          where sl.ingredient_id = pi.id and sl.quantity_remaining > 0
       )
     group by pi.id
  )
  select ingredient_id, sum(quantita)::numeric(14,4)
    from (select * from materia union all select * from semilavorati) tutto
   group by ingredient_id
  having sum(quantita) > 0;
$function$;

CREATE OR REPLACE FUNCTION public.simula_prezzo_ingrediente(p_menu_id uuid, p_ingredient_id uuid, p_variazione_pct numeric)
 RETURNS TABLE(menu_item_id uuid, piatto text, prezzo_vendita numeric, food_cost_attuale numeric, food_cost_simulato numeric, pct_attuale numeric, pct_simulata numeric, via_preparazione boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_prezzo numeric;
  v_delta  numeric;
begin
  -- ⚠️ security definer: il controllo va rimesso dentro, altrimenti la
  -- funzione gira senza RLS e i prezzi d'acquisto escono da qui.
  if not is_titolare() then
    raise exception 'Il simulatore del menu e'' riservato al titolare.';
  end if;
  if p_variazione_pct is null then
    raise exception 'Serve di quanto cambia il prezzo.';
  end if;

  select i.current_price
    into v_prezzo
    from ingredients i where i.id = p_ingredient_id;
  if v_prezzo is null then
    raise exception 'Ingrediente non trovato.';
  end if;

  v_delta := v_prezzo * p_variazione_pct / 100.0;

  return query
  with peso as (
    -- Quanto di questo ingrediente entra in una porzione del piatto,
    -- scarto compreso. E' la sola cosa che serve sapere in piu'.
    select
      mi.id as menu_item_id,
      sum(e.multiplier * (1 + e.waste_percentage / 100.0)) as quantita,
      bool_or(e.profondita > 1) as via_prep
    from menu_items mi
    cross join lateral espansione_costo_ricetta(mi.recipe_id) e
    where mi.menu_id = p_menu_id
      and e.ingredient_id = p_ingredient_id
    group by mi.id
  )
  select
    p.menu_item_id,
    r.name,
    mi.selling_price,
    ec.food_cost_portion,
    (ec.food_cost_portion
      + v_delta * p.quantita / nullif(r.portions_yield, 0))::numeric(14,4),
    ec.food_cost_pct,
    case when mi.selling_price > 0 then
      round(100 * (ec.food_cost_portion
        + v_delta * p.quantita / nullif(r.portions_yield, 0)) / mi.selling_price, 2)
    end,
    p.via_prep
  from peso p
  join menu_items mi on mi.id = p.menu_item_id
  join recipes r on r.id = mi.recipe_id
  join v_menu_item_economics ec on ec.menu_item_id = mi.id
  order by p.via_prep desc, r.name;
end;
$function$;

create or replace view v_recipe_row_costs as
SELECT ri.id AS recipe_ingredient_id,
    ri.recipe_id,
    COALESCE(sum(e.multiplier * i.current_price * (1::numeric + COALESCE(e.waste_percentage, 0::numeric) / 100.0)), 0::numeric)::numeric(14,4) AS costo
   FROM recipe_ingredients ri
     LEFT JOIN LATERAL espansione_costo_ricetta(ri.recipe_id) e(riga_id, ingredient_id, multiplier, waste_percentage, profondita) ON e.riga_id = ri.id
     LEFT JOIN ingredients i ON i.id = e.ingredient_id
  GROUP BY ri.id, ri.recipe_id;;

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
  v_riga_vecchio uuid;
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
    -- (6) IL VECCHIO CLIENT: SOLO LO SCARTO, SENZA IL LORDO — SI RICAVA.
    -- -------------------------------------------------------------
    -- 🔴 RILASCIO IN DUE FASI (22/09/2026): durante il passaggio il sito
    --    vecchio scrive ancora `waste_percentage` da solo, senza sapere
    --    che `quantita_lorda` esiste. Non si rifiuta piu': il lordo si
    --    ricava da quanto dichiara (blocco 6 del trigger).
    insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit, waste_percentage)
    values (v_r1, v_ing, 0.5000, 'kg', 30) returning id into v_riga_vecchio;
    if (select quantita_lorda from recipe_ingredients where id = v_riga_vecchio) is distinct from 0.6500 then
      raise exception 'Il vecchio client ha scritto scarto 30 su 0,5 netti: il lordo doveva ricavarsi a 0,65, e'' %.',
        (select quantita_lorda from recipe_ingredients where id = v_riga_vecchio);
    end if;

    -- ...e lo stesso vale correggendo SOLO lo scarto, in aggiornamento: il
    -- vecchio client non conosce il lordo, quindi non lo tocca mai.
    update recipe_ingredients set waste_percentage = 10 where id = v_riga_vecchio;
    if (select quantita_lorda from recipe_ingredients where id = v_riga_vecchio) is distinct from 0.5500 then
      raise exception 'Il vecchio client ha corretto lo scarto a 10 su 0,5 netti: il lordo doveva ricalcolarsi a 0,55, e'' %.',
        (select quantita_lorda from recipe_ingredients where id = v_riga_vecchio);
    end if;

    -- -------------------------------------------------------------
    -- (6-bis) IL NUOVO CLIENT: LORDO E SCARTO INSIEME, E NON TORNANO —
    --         QUI SI RIFIUTA ANCORA, IN INSERIMENTO E IN CORREZIONE.
    -- -------------------------------------------------------------
    -- ⚠️ La tolleranza del blocco (6) vale solo per chi NON manda il
    --    lordo. Chi lo manda insieme a uno scarto che non torna resta
    --    autorevole quanto prima, e resta respinto.
    v_preso := false;
    begin
      insert into recipe_ingredients (recipe_id, ingredient_id, quantity, quantita_lorda, unit, waste_percentage)
      values (v_r1, v_ing, 0.5000, 1.0000, 'kg', 30);
    exception when others then
      v_preso := true;
      if sqlerrm not like '%non si scrive piu%' then
        raise exception 'Lordo e scarto incoerenti in inserimento sono stati respinti col messaggio sbagliato: %', sqlerrm;
      end if;
    end;
    if not v_preso then raise exception 'Lordo e scarto incoerenti sono passati insieme in inserimento.'; end if;

    v_preso := false;
    begin
      update recipe_ingredients set quantita_lorda = 2.0000, waste_percentage = 30 where id = v_riga_vecchio;
    exception when others then
      v_preso := true;
      if sqlerrm not like '%non si corregge a mano%' then
        raise exception 'Lordo e scarto incoerenti in aggiornamento sono stati respinti col messaggio sbagliato: %', sqlerrm;
      end if;
    end;
    if not v_preso then raise exception 'Lordo e scarto incoerenti sono passati insieme in aggiornamento.'; end if;

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

    -- -------------------------------------------------------------
    -- (10) 🔴 IL CUORE DELLA DECISIONE DEL 22/09: IL NUMERO DELLA SCHEDA
    --      DEL PRODOTTO NON MUOVE PIU' UNA RIGA GIA' SCRITTA.
    -- -------------------------------------------------------------
    -- ⚠️ E' il controllo per cui questa migrazione esiste nella forma che
    --    ha. Prima, `coalesce(riga, prodotto, 0)` faceva si' che cambiare
    --    questo numero spostasse il food cost di OGNI ricetta che usa
    --    quell'ingrediente — anche scritte mesi prima da chi quel numero
    --    non l'aveva scelto. Adesso precompila e basta.
    update ingredients set waste_percentage_default = 900 where id = v_ing;

    select waste_percentage into v_num from recipe_ingredients where id = v_riga;
    if v_num is distinct from 275.00 then
      raise exception 'Lo scarto della riga si e'' mosso col numero del prodotto: e'' %, doveva restare 275.', v_num;
    end if;

    select food_cost_base into v_num from v_recipe_costs where recipe_id = v_r2;
    if round(v_num, 2) is distinct from 15.00 then
      raise exception 'Il food cost si e'' mosso cambiando il numero sulla scheda del prodotto: e'' %, doveva restare 15,00.', v_num;
    end if;

    -- ⚠️ E ALLO SPECCHIO: il fabbisogno di magazzino legge lo stesso numero
    --    da un'altra strada (`fabbisogno_*`), quindi si guarda anche quello
    --    — due letture che si comportassero diversamente sarebbero la
    --    forma peggiore, perche' ognuna delle due sembra plausibile.
    select round(quantita, 4) into v_num
      from fabbisogno_preparazione(v_r2, 1)
     where ingredient_id = v_ing;
    if v_num is distinct from 1.5000 then
      raise exception 'Il fabbisogno si e'' mosso col numero del prodotto: e'' %, doveva restare 1,5.', v_num;
    end if;

    update ingredients set waste_percentage_default = 25 where id = v_ing;

    -- -------------------------------------------------------------
    -- (11) SOPRA 100 SI ACCETTA, E SOTTO ZERO NO.
    -- -------------------------------------------------------------
    -- 🔴 Il vecchio vincolo «sotto 100» rifiutava un caso VERO: il sugo di
    --    cozze qui sopra ha uno scarto del 275%. Si prova nei due versi,
    --    perche' un limite che rifiuta anche i casi buoni e' peggio di
    --    nessun limite (regola del 24/08).
    update ingredients set waste_percentage_default = 275 where id = v_ing;
    update ingredients set waste_percentage_default = null where id = v_ing;

    v_preso := false;
    begin
      update ingredients set waste_percentage_default = -1 where id = v_ing;
    exception when check_violation then v_preso := true;
    end;
    if not v_preso then
      raise exception 'Uno scarto standard negativo doveva essere respinto.';
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
