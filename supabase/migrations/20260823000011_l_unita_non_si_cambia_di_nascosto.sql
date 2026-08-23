-- =====================================================================
-- L'UNITA' NON SI CAMBIA DI NASCOSTO
-- 23/08/2026
-- =====================================================================
-- Blocco 1 del mandato del 23/08. 🔴 Va PRIMA del grammo, e l'ordine non
-- e' una preferenza: il grammo senza questa migrazione e' un'arma.
--
-- ---------------------------------------------------------------------
-- IL DIFETTO, misurato il 23/08 e gia' vivo oggi
-- ---------------------------------------------------------------------
-- Un aggiornamento diretto dell'unita' su un prodotto con lotti, ricette e
-- scarichi viene **accettato senza un controllo**. I lotti non hanno
-- un'unita' propria: la leggono dall'ingrediente. Quindi 993,3333 g
-- diventano 993,3333 kg **in silenzio**, e nessun numero cambia.
--
-- ⚠️ Non lo introduce l'unita' piccola: vale gia' oggi fra kg e litri. Ma
-- fra kg e grammi il fattore e' **mille**, e l'errore diventa mille volte
-- piu' grosso.
--
-- ---------------------------------------------------------------------
-- LE TRE STRADE, e perche' due sono state scartate
-- ---------------------------------------------------------------------
-- **A. I lotti prendono un'unita' propria.** Scartata, e non per la
-- taglia: aprirebbe un problema che oggi non esiste. Un prodotto con lotti
-- in kg e lotti in g avrebbe una **giacenza non sommabile** — e fra kg e
-- pz non esiste nessun fattore che li faccia sommare. Si guadagna la
-- storia esatta e si perde la domanda piu' semplice: *quanto ce n'e'?*
--
-- **B. Si blocca e basta quando c'e' qualcosa attaccato.** Scartata da
-- sola: e' un rifiuto senza via d'uscita, cioe' il difetto n. 8 del
-- mandato di correzione. Chi ha creato lo zafferano in kg e vuole i grammi
-- resterebbe senza nessuna strada che non sia rifare il prodotto da capo,
-- **spezzando lo storico dei prezzi** — che e' il numero su cui si decide
-- se un fornitore sta aumentando.
--
-- **C. Si converte.** ⚠️ Da sola e' **peggio delle altre due**, e la
-- misura lo dice invece di sospettarlo.
--
-- ---------------------------------------------------------------------
-- 🔴 LA MISURA CHE HA DECISO LA FORMA: la conversione PERDE NUMERI
-- ---------------------------------------------------------------------
-- Provata sui dati veri del progetto di prova, nei due versi.
--
-- **kg verso g, sul prezzo** (current_price e' numeric(12,4), e il prezzo
-- si DIVIDE per mille):
--
--   | prodotto  | eur/kg | eur/g scritto | ritorno | errore   |
--   |-----------|--------|---------------|---------|----------|
--   | Sale      | 0,6500 | 0,0007        | 0,7000  | 7,69 %   |
--   | Zucchero  | 1,1500 | 0,0012        | 1,2000  | 4,35 %   |
--   | Carota    | 1,2500 | 0,0013        | 1,3000  | 4,00 %   |
--
-- **g verso kg, sulle quantita'** (che si dividono):
--
--   * righe di ricetta che diventerebbero **zero**: **95 su 317** (30 %)
--   * lotti che perderebbero **tutta** la giacenza: **15**
--
-- ⚠️ Quindi «converti sempre» non e' una cura: e' lo stesso difetto con
-- un'altra faccia — numeri cambiati in silenzio, solo per arrotondamento
-- invece che per distrazione.
--
-- ---------------------------------------------------------------------
-- LA CURA: la regola del 16/08, applicata qui
-- ---------------------------------------------------------------------
-- *«O e' respinto con un messaggio che dice cosa lo impedisce e cosa fare
-- prima, oppure storna l'effetto nella stessa transazione. Non esiste il
-- terzo caso.»* Il terzo caso oggi ESISTE ed e' precisamente il difetto:
-- l'unita' cambia e i numeri restano.
--
--   1. **niente attaccato** -> si cambia e basta: non c'e' nessun numero
--      da salvare, e vietarlo sarebbe una regola scritta sulle sue cose;
--   2. **conversione definita ed ESATTA su ogni riga** -> si converte
--      tutto, nella stessa transazione;
--   3. **conversione non definita, o definita ma che perderebbe anche un
--      solo numero** -> si **rifiuta**, dicendo quale numero si perderebbe.
--
-- 🔴 IL CRITERIO E' «NON SERVE ARROTONDARE», non «l'errore e' piccolo».
-- Un valore passa se arrotondarlo alla scala della colonna lo lascia
-- **identico**. Non c'e' nessuna soglia di tolleranza da scegliere, quindi
-- non c'e' nessun numero che fra sei mesi qualcuno alzera' «solo un po'».
--
-- ⚠️ E NON C'E' NESSUNA SCAPPATOIA NEL TRIGGER — ne' un parametro di
-- sessione, ne' una funzione privilegiata che lo salta. E' la lezione del
-- congelamento delle previsioni (15/08): *una scappatoia sarebbe anche la
-- strada per aggirarlo*. Il controllo vale per l'app, per il corridoio,
-- per chi scrive dal browser e per una migrazione futura.
--
-- ---------------------------------------------------------------------
-- ⚠️ COSA CONOSCE OGGI, e perche' e' giusto che sia poco
-- ---------------------------------------------------------------------
-- unita_conversione() parla per **testo**, non per valori dell'enum: cosi'
-- questa migrazione regge sia prima che dopo il grammo. Oggi **nessuna
-- coppia dell'enum e' convertibile** — fra kg e litri, kg e pezzi, kg e
-- mazzi non c'e' nessun fattore che esista al mondo — quindi il
-- comportamento di oggi e' *si rifiuta sempre, se c'e' qualcosa
-- attaccato*, che e' il comportamento sicuro. Il blocco 2 aprira' il
-- grammo **dentro** questa protezione.
--
-- ---------------------------------------------------------------------
-- LE COLONNE, e come sono state trovate
-- ---------------------------------------------------------------------
-- Chieste al catalogo (ingredient_id piu' colonne numeriche), non
-- ricordate: **12 tabelle**. Divise per come si comportano, che e' la sola
-- distinzione che conta:
--
--   * **quantita'** -> si moltiplicano per il fattore;
--   * **prezzo per unita'** -> si DIVIDONO (se il kg vale 2400 euro, il
--     grammo ne vale 2,40);
--   * **fattore d'acquisto** -> si moltiplica (una cassa da 6 kg e' una
--     cassa da 6000 g);
--   * **euro totali, percentuali, dosi** -> non si toccano. Un costo
--     gia' sostenuto e' quello, comunque lo si misuri.
--
-- ⚠️ L'elenco e' **esplicito e non costruito dal catalogo**, ed e' una
-- scelta: dal catalogo entrerebbero anche i costi in euro, che non vanno
-- convertiti. Il prezzo di scriverlo a mano e' che una colonna nuova non
-- ci finisce da sola — ed e' per questo che accanto c'e' una **rete** che
-- confronta l'elenco col catalogo e diventa rossa quando compare una
-- colonna numerica nuova legata a un ingrediente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Quali unita' si convertono l'una nell'altra, e con che fattore
-- ---------------------------------------------------------------------
-- Restituisce quanto vale UNA unita' di partenza espressa in quella di
-- arrivo, oppure null se la conversione non esiste. ⚠️ Parla per testo
-- apposta: il grammo non esiste ancora nell'enum quando questa
-- migrazione viene applicata.
create or replace function unita_conversione(p_da text, p_a text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when p_da = p_a then 1
    -- Peso. L'unica famiglia con piu' di un membro, per ora.
    when p_da = 'kg' and p_a = 'g'  then 1000
    when p_da = 'g'  and p_a = 'kg' then 0.001
    -- ⚠️ Tutto il resto e' null, e non e' una dimenticanza: fra un litro e
    -- un chilo il fattore dipende da COSA c'e' dentro, e fra un chilo e un
    -- pezzo dipende da quanto pesa il pezzo. Sono numeri che il gestionale
    -- non puo' sapere, e inventarli sarebbe peggio che rifiutare.
    else null
  end;
$$;

comment on function unita_conversione(text, text) is
  'Quanto vale una unita'' di partenza espressa in quella di arrivo, o null se la conversione non esiste al mondo (23/08/2026). Parla per testo e non per unit_type apposta: cosi'' regge anche prima che un valore nuovo entri nell''enum.';

revoke all on function unita_conversione(text, text) from public, anon, authenticated;
grant execute on function unita_conversione(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Il viaggio regge? — il criterio, in un posto solo
-- ---------------------------------------------------------------------
-- Vero se convertire un numero col fattore dato non richiede di
-- arrotondarlo per entrare in una colonna con quella scala di decimali.
-- Nessuna soglia: o il numero ci sta esatto, o no.
create or replace function conversione_esatta(v numeric, f numeric, scala int)
returns boolean
language sql
immutable
set search_path = public
as $$
  select v is null or round(v * f, scala) = v * f;
$$;

comment on function conversione_esatta(numeric, numeric, int) is
  'Vero se convertire questo numero non richiede di arrotondarlo (23/08/2026). ⚠️ Non c''e'' nessuna tolleranza da scegliere: e'' quello che rende il criterio impossibile da allentare un po'' alla volta.';

revoke all on function conversione_esatta(numeric, numeric, int) from public, anon, authenticated;
grant execute on function conversione_esatta(numeric, numeric, int) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Che cosa impedisce il cambio — la DECISIONE, separata dall'azione
-- ---------------------------------------------------------------------
-- Restituisce il motivo del rifiuto, o null se si puo' fare. Separata dal
-- trigger perche' si possa **chiedere prima di provare** — la schermata
-- puo' avvisare invece di far sbattere l'utente contro un errore. Stessa
-- forma di email_conferma_dovuta() e allarme_frenato().
create or replace function cambio_unita_impedito(
  p_ingredient_id uuid,
  p_da            text,
  p_a             text
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_f       numeric;
  v_nome    text;
  v_quanto  int;
  v_dove    text;
  v_valore  numeric;
  v_prezzo  numeric;
  v_soglia  numeric;
begin
  -- 🔴 IL PORTIERE, e non e' una formalita': il messaggio di rifiuto
  -- NOMINA UN PREZZO D'ACQUISTO («vale 0,65»). Senza questa riga, chiunque
  -- abbia l'accesso della sala potrebbe chiedere quanto costa un prodotto
  -- provando a cambiargli unita' — che e' precisamente il difetto chiuso il
  -- 13/08 su varianti_ingrediente() e variazione_prezzo().
  --
  -- ⚠️ La condizione e' «c'e' un utente E non e' il titolare»: dentro una
  -- migrazione auth.uid() e' nullo, e senza quella prima meta' il portiere
  -- fermerebbe il trigger su ogni cambio fatto da una migrazione futura.
  if auth.uid() is not null and not is_titolare() then
    raise exception 'I prezzi d''acquisto sono riservati al titolare.';
  end if;

  if p_da = p_a then
    return null;
  end if;

  select name, current_price, stock_minimum_threshold
    into v_nome, v_prezzo, v_soglia
    from ingredients where id = p_ingredient_id;

  -- --- Il prodotto non ha niente attaccato: nessun numero da salvare. ---
  select
    (select count(*) from recipe_ingredients     where ingredient_id = p_ingredient_id)
  + (select count(*) from stock_lots             where ingredient_id = p_ingredient_id)
  + (select count(*) from stock_consumptions     where ingredient_id = p_ingredient_id)
  + (select count(*) from shopping_list_items    where ingredient_id = p_ingredient_id)
  + (select count(*) from price_history          where ingredient_id = p_ingredient_id)
  + (select count(*) from anomalie_scarico       where ingredient_id = p_ingredient_id)
  + (select count(*) from ordini_fornitore_righe where ingredient_id = p_ingredient_id)
  + (select count(*) from rettifiche_giacenza    where ingredient_id = p_ingredient_id)
  + (select count(*) from intercompany_cessions  where ingredient_id = p_ingredient_id)
  + (select count(*) from crops                  where ingredient_id = p_ingredient_id)
  + (select count(*) from produzioni             where ingredient_id = p_ingredient_id)
  + (select count(*) from articoli_fornitore     where ingredient_id = p_ingredient_id)
  into v_quanto;

  -- ⚠️ Il prezzo conta come «attaccato» anche senza storico: e' un numero
  -- per unita', e cambiarlo di nascosto e' lo stesso difetto in piccolo.
  if v_quanto = 0 and coalesce(v_prezzo, 0) = 0 and v_soglia is null then
    return null;
  end if;

  -- --- C'e' qualcosa attaccato: serve una conversione, e deve esistere. ---
  v_f := unita_conversione(p_da, p_a);

  -- ⚠️ I MESSAGGI CHE LEGGE ALESSIO HANNO GLI ACCENTI VERI, non gli
  -- apostrofi. Guardato a schermo il 23/08: «non c'e' nessuna conversione»
  -- si legge male, ed e' testo che compare in servizio. Reggono perche' le
  -- migrazioni si applicano da FILE (psql -f): era `psql -c` a rompere gli
  -- accenti, non il database — la precisazione del 18/08.
  if v_f is null then
    return format(
      'Da %s a %s non c''è nessuna conversione: quanto pesa un %s di %s lo sa solo chi lo compra, e il gestionale non può inventarlo. '
      || 'Ci sono già dei numeri scritti in %s (ricette, lotti, prezzi o storico), e cambiare l''etichetta li lascerebbe come sono. '
      || 'Se l''unità è sbagliata davvero, crea un prodotto nuovo con l''unità giusta e disattiva questo.',
      p_da, p_a, p_a, coalesce(v_nome, 'questo prodotto'), p_da);
  end if;

  -- --- La conversione esiste: regge su OGNI numero? ---
  -- ⚠️ Il primo che non regge ferma tutto, e viene NOMINATO col suo
  -- valore: «non si puo'» senza dire quale numero si perderebbe manda a
  -- cercare alla cieca in dodici tabelle.

  -- Quantita' (si moltiplicano). Le colonne numeric senza scala dichiarata
  -- non arrotondano mai, quindi non compaiono qui.
  select 'la quantità di una riga di ricetta', quantity into v_dove, v_valore
    from recipe_ingredients
   where ingredient_id = p_ingredient_id and not conversione_esatta(quantity, v_f, 4)
   limit 1;

  if v_dove is null then
    select 'la giacenza di un lotto', quantity_remaining into v_dove, v_valore
      from stock_lots
     where ingredient_id = p_ingredient_id
       and (not conversione_esatta(quantity_remaining, v_f, 4)
            or not conversione_esatta(quantity_received, v_f, 4))
     limit 1;
  end if;

  if v_dove is null then
    select 'una quantità già scaricata', quantity into v_dove, v_valore
      from stock_consumptions
     where ingredient_id = p_ingredient_id
       and (not conversione_esatta(quantity, v_f, 4)
            or not conversione_esatta(quantita_richiesta, v_f, 4))
     limit 1;
  end if;

  if v_dove is null then
    select 'una quantità della lista della spesa', quantity_needed into v_dove, v_valore
      from shopping_list_items
     where ingredient_id = p_ingredient_id and not conversione_esatta(quantity_needed, v_f, 4)
     limit 1;
  end if;

  if v_dove is null then
    select 'una quantità mancante già registrata', quantita_mancante into v_dove, v_valore
      from anomalie_scarico
     where ingredient_id = p_ingredient_id and not conversione_esatta(quantita_mancante, v_f, 4)
     limit 1;
  end if;

  if v_dove is null then
    select 'una rettifica di giacenza', atteso into v_dove, v_valore
      from rettifiche_giacenza
     where ingredient_id = p_ingredient_id
       and (not conversione_esatta(atteso, v_f, 4)
            or not conversione_esatta(dichiarato, v_f, 4)
            or not conversione_esatta(differenza, v_f, 4))
     limit 1;
  end if;

  if v_dove is null then
    select 'una quantità prodotta', quantita_ottenuta into v_dove, v_valore
      from produzioni
     where ingredient_id = p_ingredient_id
       and (not conversione_esatta(quantita_ottenuta, v_f, 4)
            or not conversione_esatta(resa_attesa, v_f, 4))
     limit 1;
  end if;

  if v_dove is null then
    select 'una quantità ceduta all''altra società', quantity into v_dove, v_valore
      from intercompany_cessions
     where ingredient_id = p_ingredient_id and not conversione_esatta(quantity, v_f, 3)
     limit 1;
  end if;

  if v_dove is null then
    select 'una raccolta dell''orto', harvested_quantity into v_dove, v_valore
      from crops
     where ingredient_id = p_ingredient_id and not conversione_esatta(harvested_quantity, v_f, 3)
     limit 1;
  end if;

  -- Prezzi per unita': si DIVIDONO, ed e' il verso che ha perso il 7,69 %
  -- sul sale. E' il caso che il criterio deve prendere.
  if v_dove is null and not conversione_esatta(v_prezzo, 1 / v_f, 4) then
    v_dove := 'il prezzo di adesso';
    v_valore := v_prezzo;
  end if;

  if v_dove is null and not conversione_esatta(v_soglia, v_f, 4) then
    v_dove := 'la scorta minima';
    v_valore := v_soglia;
  end if;

  if v_dove is null then
    select 'un prezzo dello storico', price into v_dove, v_valore
      from price_history
     where ingredient_id = p_ingredient_id and not conversione_esatta(price, 1 / v_f, 4)
     limit 1;
  end if;

  if v_dove is null then
    select 'il costo di un lotto', unit_cost into v_dove, v_valore
      from stock_lots
     where ingredient_id = p_ingredient_id and not conversione_esatta(unit_cost, 1 / v_f, 4)
     limit 1;
  end if;

  if v_dove is null then
    select 'il prezzo di una cessione', unit_price into v_dove, v_valore
      from intercompany_cessions
     where ingredient_id = p_ingredient_id and not conversione_esatta(unit_price, 1 / v_f, 4)
     limit 1;
  end if;

  if v_dove is not null then
    return format(
      'Passando da %s a %s, %s non si può riscrivere senza arrotondarla: vale %s, e in %s diventerebbe un numero diverso. '
      || 'Il gestionale non cambia un numero già scritto per far tornare un''etichetta. '
      || 'Se ti serve davvero questa unità, crea un prodotto nuovo e disattiva questo.',
      p_da, p_a, v_dove, trim(to_char(v_valore, 'FM999999990.0999')), p_a);
  end if;

  return null;
end $funzione$;

comment on function cambio_unita_impedito(uuid, text, text) is
  'Il motivo per cui l''unita'' di questo prodotto non si puo'' cambiare, o null se si puo'' (23/08/2026). Decisione separata dall''azione: la schermata puo'' chiederlo PRIMA, invece di far sbattere l''utente contro un errore.';

revoke all on function cambio_unita_impedito(uuid, text, text) from public, anon, authenticated;
grant execute on function cambio_unita_impedito(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Il portiere: l'unita' non cambia se i numeri non la seguono
-- ---------------------------------------------------------------------
create or replace function vieta_cambio_unita()
returns trigger
language plpgsql
security definer
set search_path = public
as $trigger$
declare
  v_motivo text;
begin
  if new.unit = old.unit then
    return new;
  end if;

  v_motivo := cambio_unita_impedito(old.id, old.unit::text, new.unit::text);

  if v_motivo is not null then
    raise exception using errcode = 'P0001', message = v_motivo;
  end if;

  return new;
end $trigger$;

-- ⚠️ Anche una funzione TRIGGER nasce eseguibile da chiunque abbia la
-- chiave pubblica (trappola del 15/08). Fuori da un trigger si rifiuta di
-- girare, quindi non esce nessun dato — ma l'elenco degli anonimi non deve
-- crescere in silenzio, ed e' la prova automatica del 13/08 che l'ha detto
-- diventando rossa da sola mentre si scriveva questa migrazione.
revoke all on function vieta_cambio_unita() from public, anon, authenticated;

drop trigger if exists trg_vieta_cambio_unita on ingredients;
create trigger trg_vieta_cambio_unita
  before update of unit on ingredients
  for each row execute function vieta_cambio_unita();

-- ---------------------------------------------------------------------
-- 5. La conseguenza: cambiata l'unita', i numeri la seguono
-- ---------------------------------------------------------------------
-- Gira solo dopo che il portiere ha lasciato passare, quindi qui la
-- conversione **esiste ed e' esatta**: non c'e' nessun caso da gestire.
create or replace function converti_numeri_dell_unita()
returns trigger
language plpgsql
security definer
set search_path = public
as $trigger$
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

  return null;
end $trigger$;

revoke all on function converti_numeri_dell_unita() from public, anon, authenticated;

drop trigger if exists trg_converti_numeri_dell_unita on ingredients;
create trigger trg_converti_numeri_dell_unita
  after update of unit on ingredients
  for each row execute function converti_numeri_dell_unita();

-- ---------------------------------------------------------------------
-- 6. La rete: una colonna nuova non resta fuori in silenzio
-- ---------------------------------------------------------------------
-- L'elenco della conversione e' scritto a mano (vedi sopra: dal catalogo
-- entrerebbero anche gli euro). Questa funzione dice quali colonne
-- numeriche legate a un ingrediente **non sono state classificate**:
-- convertite, oppure dichiarate «non si converte» con la ragione.
create or replace function colonne_unita_non_classificate()
returns table (tabella text, colonna text)
language sql
stable
set search_path = public
as $$
  with conosciute(t, c) as (values
    -- si convertono: quantita'
    ('ingredients','stock_minimum_threshold'),
    ('recipe_ingredients','quantity'),
    ('stock_lots','quantity_received'), ('stock_lots','quantity_remaining'),
    ('stock_consumptions','quantity'), ('stock_consumptions','quantita_richiesta'),
    ('shopping_list_items','quantity_needed'), ('shopping_list_items','quantita_arrivata'),
    ('anomalie_scarico','quantita_mancante'),
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
    -- NON si convertono, e la ragione e' la stessa per tutte: sono euro
    -- gia' spesi, percentuali o conteggi, e non cambiano con l'unita' di
    -- misura del prodotto.
    ('ingredients','waste_percentage_default'), ('recipe_ingredients','waste_percentage'),
    ('stock_consumptions','costo'), ('produzioni','costo'), ('produzioni','dosi'),
    ('intercompany_cessions','total_amount'), ('intercompany_cessions','vat_rate'),
    ('shopping_list_items','purchased_amount'),
    ('rettifiche_giacenza','valore'),
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
$$;

comment on function colonne_unita_non_classificate() is
  'Le colonne numeriche legate a un ingrediente che nessuno ha ancora dichiarato «si converte» o «non si converte» (23/08/2026). Deve essere vuota: una colonna nuova che resta fuori e'' un numero che cambia significato in silenzio quando cambia l''unita''.';

revoke all on function colonne_unita_non_classificate() from public, anon, authenticated;
grant execute on function colonne_unita_non_classificate() to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_ente     uuid;
  v_ing      uuid;
  v_vuoto    uuid;
  v_lotto    uuid;
  v_motivo   text;
  v_n        int;
  v_lapidi   int;
  v_lapidi2  int;
  v_q        numeric;
  v_p        numeric;
  v_passato  boolean;
  v_staff    uuid;
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_ente from entities order by created_at limit 1;

  -- ===== 0. La rete non deve avere niente da dire.
  select count(*) into v_n from colonne_unita_non_classificate();
  if v_n > 0 then
    raise exception 'Ci sono % colonne numeriche legate a un ingrediente che nessuno ha classificato: %.',
      v_n, (select string_agg(tabella || '.' || colonna, ', ')
              from colonne_unita_non_classificate());
  end if;

  -- ===== 1. Un prodotto SENZA niente attaccato: l'unita' si cambia.
  insert into ingredients (entity_id, name, category, unit, current_price)
  values (v_ente, 'ZZ prova unita vuoto', 'altro', 'kg', 0)
  returning id into v_vuoto;

  update ingredients set unit = 'l' where id = v_vuoto;

  if (select unit from ingredients where id = v_vuoto) <> 'l' then
    raise exception 'Un prodotto senza niente attaccato non ha potuto cambiare unità.';
  end if;

  -- ===== 2. Un prodotto CON lotti e prezzo: il cambio verso un'unita'
  -- =====    non convertibile viene RIFIUTATO.
  insert into ingredients (entity_id, name, category, unit, current_price)
  values (v_ente, 'ZZ prova unita pieno', 'altro', 'kg', 12.5000)
  returning id into v_ing;

  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining,
                          unit_cost)
  values (v_ing, 2.0000, 2.0000, 12.5000)
  returning id into v_lotto;

  v_motivo := cambio_unita_impedito(v_ing, 'kg', 'l');
  if v_motivo is null then
    raise exception 'Il cambio da kg a litri su un prodotto con lotti non viene impedito.';
  end if;
  if v_motivo not like '%nessuna conversione%' then
    raise exception 'Il motivo del rifiuto non dice che la conversione non esiste: %', v_motivo;
  end if;

  -- ===== 3. E il portiere lo rifiuta DAVVERO, non solo a parole.
  --
  -- ⚠️ IL RISULTATO SI RACCOGLIE IN UNA VARIABILE, non con un raise dentro
  -- il blocco protetto — ed e' la trappola gia' scritta negli appunti
  -- («un gestore d'eccezione puo' inghiottire i propri stessi controlli»),
  -- trovata QUI rompendo il trigger apposta: un `raise exception` senza
  -- codice **e' P0001**, quindi finiva nel gestore di sotto e la verifica
  -- annunciava «ha rifiutato per un altro motivo» mentre il portiere non
  -- aveva rifiutato affatto. Diventava rossa lo stesso, ma **mandava a
  -- cercare il difetto dalla parte sbagliata**.
  v_passato := false;
  begin
    update ingredients set unit = 'l' where id = v_ing;
    v_passato := true;
  exception when sqlstate 'P0001' then
    v_motivo := sqlerrm;
  end;

  if v_passato then
    raise exception 'Il portiere ha lasciato passare un cambio di unità impossibile.';
  end if;
  if v_motivo not like '%nessuna conversione%' then
    raise exception 'Il portiere ha rifiutato, ma per un altro motivo: %', v_motivo;
  end if;

  if (select unit from ingredients where id = v_ing) <> 'kg' then
    raise exception 'L''unità è cambiata nonostante il rifiuto.';
  end if;

  -- ===== 4. 🔴 IL CUORE: i numeri sono rimasti quelli.
  select quantity_remaining, unit_cost into v_q, v_p from stock_lots where id = v_lotto;
  if v_q <> 2.0000 or v_p <> 12.5000 then
    raise exception 'Il rifiuto ha lasciato indietro dei numeri cambiati: % e %.', v_q, v_p;
  end if;

  -- ===== 5. La rete sui NUMERI che non reggerebbero il viaggio.
  -- ⚠️ Provata con la conversione da chili a grammi, che l'enum ancora non
  -- ha: si chiama la funzione della decisione, che parla per testo. E' il
  -- solo modo di provare oggi la regola che il blocco 2 accendera'.
  --
  -- Il prezzo di questo prodotto e' 12,50 al kg, cioe' 0,0125 al grammo:
  -- esatto, quindi passa.
  if cambio_unita_impedito(v_ing, 'kg', 'g') is not null then
    raise exception 'Un cambio da chili a grammi con numeri esatti viene rifiutato: %',
      cambio_unita_impedito(v_ing, 'kg', 'g');
  end if;

  -- Ora un prezzo che NON regge: 0,65 al kg diventerebbe 0,00065 al
  -- grammo, che in numeric(12,4) si scrive 0,0007. E' il sale, misurato
  -- oggi sui dati veri.
  update ingredients set current_price = 0.6500 where id = v_ing;

  v_motivo := cambio_unita_impedito(v_ing, 'kg', 'g');
  if v_motivo is null then
    raise exception 'Un prezzo che si perderebbe arrotondando non viene fermato.';
  end if;
  if v_motivo not like '%il prezzo di adesso%' then
    raise exception 'Il rifiuto non nomina il numero che si perderebbe: %', v_motivo;
  end if;

  -- ===== 6. E al contrario: una quantita' che si perderebbe tornando
  -- =====    indietro (da grammi a chili) ferma anche lei.
  update ingredients set current_price = 12.5000 where id = v_ing;
  update stock_lots set quantity_remaining = 0.0371 where id = v_lotto;

  v_motivo := cambio_unita_impedito(v_ing, 'g', 'kg');
  if v_motivo is null then
    raise exception 'Una giacenza che diventerebbe zero non viene fermata.';
  end if;
  if v_motivo not like '%la giacenza di un lotto%' then
    raise exception 'Il rifiuto non nomina la giacenza: %', v_motivo;
  end if;

  -- ===== 7. Oggi nessuna coppia dell'enum e' convertibile: e' lo stato
  -- =====    voluto finche' il grammo non esiste.
  if unita_conversione('kg', 'l') is not null
     or unita_conversione('kg', 'pz') is not null
     or unita_conversione('l', 'mazzo') is not null then
    raise exception 'Esiste una conversione fra unità che al mondo non si convertono.';
  end if;
  if unita_conversione('kg', 'g') <> 1000 or unita_conversione('g', 'kg') <> 0.001 then
    raise exception 'La conversione fra chili e grammi non e'' quella giusta.';
  end if;

  -- ===== 8. 🔴 IL PORTIERE: con l'accesso della sala, il motivo del
  -- =====    rifiuto NON si puo' chiedere — dentro c'e' un prezzo.
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);

    v_passato := false;
    begin
      perform cambio_unita_impedito(v_ing, 'kg', 'g');
      v_passato := true;
    exception when others then
      v_motivo := sqlerrm;
    end;

    perform set_config('request.jwt.claims', null, true);

    if v_passato then
      raise exception 'Dalla sala si puo'' chiedere un motivo che contiene un prezzo d''acquisto.';
    end if;
    if v_motivo not like '%riservati al titolare%' then
      raise exception 'Il portiere ha rifiutato per un altro motivo: %', v_motivo;
    end if;
  end if;

  -- ===== pulizia: si toglie tutto cio' che questa verifica ha creato.
  delete from stock_lots where id = v_lotto;
  delete from ingredients where id in (v_ing, v_vuoto);

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Verifica passata: l''unità non si cambia se i numeri non la seguono, e il rifiuto dice quale numero si perderebbe.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260823000011', 'l_unita_non_si_cambia_di_nascosto') on conflict (version) do nothing;
