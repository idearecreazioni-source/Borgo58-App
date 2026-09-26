-- =====================================================================
-- LA SPESA DALLA TASCA SI PUO' DETTARE — 07/09/2026
-- =====================================================================
-- 🔴 TRE SOGGETTI CONTABILI, E SI SOMIGLIANO ABBASTANZA DA SCAMBIARSI:
--   · **Borgo 58** — la cassa dell'osteria;
--   · **La mia tasca** — il contante che Alessio spende di suo per il
--     progetto, senza documento. Solo uscite, sempre «Indeducibile», fuori
--     dalla proiezione fiscale, e **non torna indietro** (30/08);
--   · **Anticipo io, poi mi rimborso** — una spesa fatta per conto della
--     societa', che la societa' gli pareggia (`anticipazioni_socio`).
--
-- 🔴 FINO A OGGI LA VOCE NE CONOSCEVA UNO SOLO: `fai_azione_dettata` per
--    `movimento_cassa` sceglie `entity_type = 'srls'` e basta. Una spesa
--    detta «di tasca mia» finiva quindi **nella cassa dell'osteria**, senza
--    nessun errore e con una riga plausibile.
--
-- ⚠️ QUALI PAROLE SCELGONO QUALE LO HA DECISO ALESSIO il 07/09/2026, ed e'
--    una scelta di prodotto: «di tasca mia» e' sempre la tasca; per il
--    rimborso usa parole esplicite; se non nomina nessuno dei due MEMO
--    chiede; se li nomina tutt'e due **prevale il rimborso**. Quella regola
--    vive in `supabase/functions/ascolta-voce/tasca.ts`, dove si prova
--    senza chiamare nessuno.
--
-- ⚠️ QUESTA MIGRAZIONE NON RIFA' NESSUNA PROTEZIONE DELLA CASSA: il divieto
--    di entrate e l'obbligo di «Indeducibile» sono gia' un trigger
--    (`guardia_movimenti_tasca`, migrazione 20260830000012). Qui si sceglie
--    il soggetto giusto e si lascia lavorare il guardiano che c'e'.
--
-- ⚠️ E NIENTE SI SCRIVE DA SE': la spesa detta resta un appunto da
--    approvare (SPEC-0013). Questa migrazione aggiunge una destinazione,
--    non una scorciatoia.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Il catalogo impara la spesa dalla tasca
-- ---------------------------------------------------------------------
-- ⚠️ `additivo` = FALSE, come per il movimento di cassa e al contrario
--    delle liste: due spese sono due movimenti di denaro, ognuno col suo
--    importo, e si approvano uno per uno. Fonderle in un appunto solo
--    vorrebbe dire firmare due righe con un tocco.
insert into tipi_azione_vocale (tipo, natura, titolo, spiega, attivo, additivo, eseguibile)
values (
  'spesa_tasca',
  'misura',
  'Spesa dalla mia tasca',
  'Una spesa pagata con soldi tuoi per il progetto: esce dalla tua tasca, non dalla cassa dell''osteria, ed e'' sempre indeducibile. Non ti verra'' rimborsata: per quella c''e'' «Anticipo io, poi mi rimborso».',
  true,
  false,
  true)
on conflict (tipo) do update
   set natura     = excluded.natura,
       titolo     = excluded.titolo,
       spiega     = excluded.spiega,
       attivo     = excluded.attivo,
       additivo   = excluded.additivo,
       eseguibile = excluded.eseguibile;

-- ---------------------------------------------------------------------
-- 2. Il gesto che la scrive
-- ---------------------------------------------------------------------
-- ⚠️ Il corpo arriva dal DATABASE VIVO e non dal file che l'ha creata: fra
--    i due ci stanno tutte le migrazioni che l'hanno toccata.


CREATE OR REPLACE FUNCTION public.fai_azione_dettata(p_tipo text, p_dati jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id     uuid;
  v_ent    uuid;
  v_lotto  uuid;
  v_pezzi  text;
begin
  case p_tipo

    when 'giacenza' then
      return allinea_giacenza(
        (p_dati->>'ingredient_id')::uuid,
        (p_dati->>'quanto_ce')::numeric,
        coalesce(nullif(p_dati->>'note', ''), 'Contato a voce'));

    when 'temperatura' then
      -- 🔴 Il frigo non si indovina MAI: quel registro va all'ASP.
      --    Il vincolo sulla riga lo impedisce gia', e qui si rifiuta con
      --    una frase leggibile invece che con un errore di vincolo.
      if nullif(p_dati->>'equipment_id', '') is null then
        raise exception 'Non hai detto quale frigo: una temperatura senza il suo frigo non si scrive nel registro.';
      end if;
      return registra_temperatura(
        (p_dati->>'equipment_id')::uuid,
        (p_dati->>'gradi')::numeric,
        nullif(p_dati->>'note', ''),
        null);

    when 'promemoria' then
      insert into tasks (title, description, due_date, priority, status, category, origine_modulo)
      values (
        left(coalesce(nullif(p_dati->>'titolo', ''), 'Promemoria dettato'), 200),
        nullif(p_dati->>'descrizione', ''),
        nullif(p_dati->>'data', '')::date,
        coalesce(nullif(p_dati->>'priorita', ''), 'media')::task_priority,
        'da_fare'::task_status,
        coalesce(nullif(p_dati->>'categoria', ''), 'altro'),
        'voce')
      returning id into v_id;
      return jsonb_build_object('task_id', v_id);

    when 'pulizia' then
      if nullif(p_dati->>'task_id', '') is null then
        raise exception 'Non ho capito quale pulizia: dimmi il nome di una di quelle previste nel piano.';
      end if;
      insert into haccp_cleaning_logs (task_id, note)
      values ((p_dati->>'task_id')::uuid, nullif(p_dati->>'note', ''))
      returning id into v_id;
      return jsonb_build_object('log_id', v_id);

    when 'preparazione_da_fare' then
      -- 🔴 SI ESEGUE DA SE', SENZA CONFERMA PARLATA — decisione di Alessio
      --    del 29/08: *se sbaglia si cancella una riga*. E' la stessa
      --    ragione per cui la lista della spesa non chiede conferma: qui
      --    non si muove nessun numero, non esce nessun soldo, e la riga si
      --    toglie con un tocco dalla schermata delle Produzioni.
      -- ⚠️ Aggiungerla due volte NON e' un errore e non solleva niente:
      --    `aggiungi_da_fare` risponde «c'era gia'» con la frase, e chi ha
      --    dettato la sente invece di ricevere un rifiuto per un gesto
      --    normale.
      return aggiungi_da_fare(
        (p_dati->>'recipe_id')::uuid,
        nullif(p_dati->>'note', ''));

    when 'lista_spesa' then
      -- ⚠️ Il nome libero e' ammesso apposta: «prendi la carta forno» non
      --    e' un prodotto del ricettario e non deve diventarlo. Aggiungere
      --    una riga alla lista non crea niente in magazzino.
      return jsonb_build_object('item', add_shopping_list_item(
        -- 🔴 SEMPRE NULL, ed e' la decisione del 27/08: la lista della
        --    spesa non accoppia mai col magazzino. Quello che si dice
        --    finisce in lista come si e' detto, e l'abbinamento si fa
        --    dopo, con la foto del documento quando la merce arriva.
        null,
        nullif(p_dati->>'nome_libero', ''),
        null,
        nullif(p_dati->>'quantita', '')::numeric,
        nullif(p_dati->>'unita', '')::unit_type,
        nullif(p_dati->>'note', '')));

    when 'spesa_spicciola' then
      -- 🔴 LA SECONDA LISTA, e non tocca niente di quello che fa la prima.
      --    La spesa spicciola è il foglietto del supermercato: non nasce
      --    dalle soglie, non finisce in un ordine, non muove giacenze e non
      --    scrive nessun costo (23/08/2026). Qui si scrive una riga e basta.
      -- ⚠️ Stesso patto della lista della spesa: NIENTE CATALOGO. Quello
      --    che è stato detto entra come è stato detto — un collegamento a
      --    `ingredients` sarebbe la prima crepa da cui torna il magazzino.
      insert into spesa_spicciola (articolo, categoria, nota)
      values (
        nullif(btrim(p_dati->>'nome_libero'), ''),
        nullif(btrim(p_dati->>'categoria'), ''),
        nullif(btrim(p_dati->>'note'), ''))
      returning id into v_id;
      return jsonb_build_object('spesa_spicciola_id', v_id);

    when 'merce_buttata' then
      -- 🔴 `record_stock_consumption` NON RESTITUISCE NIENTE (void), e
      --    quindi si chiama con `perform` e la risposta la si costruisce
      --    qui. Scrivendo `return` si otteneva «invalid input syntax for
      --    type json» — un errore che parla di JSON per una funzione che
      --    di JSON non ne ha mai visto.
      perform record_stock_consumption(
        (p_dati->>'ingredient_id')::uuid,
        (p_dati->>'quantita')::numeric,
        'spreco',
        coalesce(nullif(p_dati->>'note', ''), 'Buttata, detto a voce'));
      return jsonb_build_object(
        'ingredient_id', p_dati->>'ingredient_id',
        'quantita',      p_dati->>'quantita',
        'motivo',        'spreco');

    when 'nota_non_capita' then
      -- 🔴 LA MAGLIA LARGA: non ho capito, e NON INVENTO. Resta scritto
      --    quello che ho sentito, e Alessio lo vede in Dashboard.
      insert into tasks (title, description, priority, status, category, origine_modulo)
      values (
        'Da riguardare: una cosa detta a voce',
        p_dati->>'sentito',
        'media'::task_priority,
        'da_fare'::task_status,
        'altro',
        'voce')
      returning id into v_id;
      return jsonb_build_object('task_id', v_id);

    -- =====================================================================
    -- I QUATTRO CHE MANCAVANO — natura `creazione`, tutti dietro l'occhio
    -- =====================================================================

    when 'movimento_cassa' then
      -- 🔴 LA DATA E' LA SERATA. Un'uscita dettata all'una di notte
      --    appartiene alla sera prima, e `current_date` a quell'ora
      --    risponderebbe col giorno di Greenwich.
      select id into v_ent from entities where entity_type = 'srls' limit 1;
      insert into cash_movements (
        entity_id, direction, amount, movement_date, causale_id, mezzo,
        conto_id, tipo_documento, business_purpose, note)
      values (
        v_ent,
        (p_dati->>'verso')::cash_direction,
        (p_dati->>'importo')::numeric,
        coalesce(nullif(p_dati->>'data', '')::date, serata_di_servizio(now())),
        nullif(p_dati->>'causale_id', '')::uuid,
        coalesce(nullif(p_dati->>'mezzo', ''), 'cassa'),
        nullif(p_dati->>'conto_id', '')::uuid,
        coalesce(nullif(p_dati->>'documento', ''), 'non_documentato')::cash_document_type,
        -- ⚠️ Su `cash_movements` non c'e' nessuna colonna «fornitore»: il
        --    nome riconosciuto si scrive qui, in chiaro, invece di
        --    inventare un legame che lo schema non prevede.
        nullif(concat_ws(' · ',
          (select 'Fornitore: ' || s.name from suppliers s
            where s.id = nullif(p_dati->>'supplier_id', '')::uuid),
          nullif(p_dati->>'descrizione', '')), ''),
        coalesce(nullif(p_dati->>'note', ''), 'Registrato a voce'))
      returning id into v_id;
      return jsonb_build_object(
        'movimento_id',  v_id,
        'senza_causale', nullif(p_dati->>'causale_id', '') is null);

    when 'spesa_tasca' then
      -- 🔴 LA TASCA E' UN SOGGETTO A SE', accanto a Borgo 58 e all'orto
      --    (decisione del 30/08): il contante che Alessio spende di suo per
      --    il progetto, senza documento. Qui si sceglie **quel** soggetto,
      --    e non quello dell'osteria come fa `movimento_cassa`.
      select id into v_ent from entities where entity_type = 'tasca' limit 1;

      -- ⚠️ SE LA TASCA NON C'E' SI RIFIUTA, non si ripiega sull'osteria:
      --    una spesa personale registrata su Borgo 58 non da' nessun errore
      --    e sporca i conti del locale. Meglio un rifiuto leggibile.
      if v_ent is null then
        raise exception 'In questo gestionale non c''e'' nessun soggetto «tasca»: la spesa personale non si puo'' registrare da nessuna parte, e sulla cassa dell''osteria non ci va.';
      end if;

      -- ⚠️ IL VERSO E' SCRITTO QUI E NON ARRIVA DA FUORI: dalla tasca escono
      --    soldi e basta. Il divieto vero e' un trigger del database
      --    (`guardia_movimenti_tasca`, migrazione 20260830000012), che
      --    rifiuta le entrate e mette da se' l'unica regola di deducibilita'
      --    ammessa. Qui non si ricopia quella regola: si sceglie il soggetto
      --    e si lascia decidere al guardiano che c'e' gia'.
      insert into cash_movements (
        entity_id, direction, amount, movement_date, mezzo,
        tipo_documento, business_purpose, note)
      values (
        v_ent,
        'uscita'::cash_direction,
        (p_dati->>'importo')::numeric,
        coalesce(nullif(p_dati->>'data', '')::date, serata_di_servizio(now())),
        'cassa',
        'non_documentato'::cash_document_type,
        -- 🔴 QUI VA IL «PER CHE COSA», ed e' il campo che SPEC-0005 chiama
        --    «Descrizione della spesa»: sulla tasca non c'e' nessuna verifica
        --    fiscale da superare, quel riquadro serve a dire che cosa hai
        --    pagato.
        nullif(btrim(p_dati->>'descrizione'), ''),
        coalesce(nullif(p_dati->>'note', ''), 'Spesa dalla tasca, detta a voce'))
      returning id into v_id;
      return jsonb_build_object('movimento_id', v_id, 'soggetto', 'tasca');

    when 'carico_merce' then
      if nullif(p_dati->>'ingredient_id', '') is null then
        raise exception 'Non ho capito quale prodotto e'' arrivato.';
      end if;
      v_lotto := register_stock_delivery(
        (p_dati->>'ingredient_id')::uuid,
        (p_dati->>'quantita')::numeric,
        nullif(p_dati->>'supplier_id', '')::uuid,
        nullif(p_dati->>'scadenza', '')::date,
        coalesce(nullif(p_dati->>'note', ''), 'Arrivato, detto a voce'),
        nullif(p_dati->>'costo_unitario', '')::numeric,
        nullif(p_dati->>'lotto', ''),
        null);
      return jsonb_build_object(
        'lotto_id',      v_lotto,
        'senza_scadenza', nullif(p_dati->>'scadenza', '') is null);

    when 'prodotto_nuovo' then
      -- 🔴 IL DOPPIONE SI RIFIUTA. Due prodotti con lo stesso nome sono due
      --    giacenze che si dividono la stessa merce e non si riuniscono
      --    piu': e' il difetto che il carico da fattura ha gia' imparato a
      --    evitare.
      if exists (select 1 from ingredients i
                  where lower(btrim(i.name)) = lower(btrim(p_dati->>'nome'))) then
        raise exception '«%» c''e'' gia'' fra i prodotti: non ne faccio un secondo. Se volevi caricarlo, dimmi che e'' arrivato.',
          btrim(p_dati->>'nome');
      end if;
      select id into v_ent from entities where entity_type = 'srls' limit 1;
      -- ⚠️ Il prezzo nasce a ZERO, che qui e' il predefinito dello schema e
      --    non una mia risposta: la scheda si compila dopo, e il primo
      --    carico con un costo lo aggiorna.
      -- ⚠️ `create_ingredient` restituisce la RIGA INTERA in jsonb, non
      --    l'identificativo: assegnandola a un uuid l'errore che si ottiene
      --    parla di «invalid input syntax for type uuid» e mostra tutta la
      --    riga — sembra un dato storto, ed e' solo il tipo di ritorno.
      v_id := (create_ingredient(
        v_ent,
        btrim(p_dati->>'nome'),
        -- ⚠️ Il catalogo al posto del cast all'enum (27/08/2026).
        coalesce(valore_del_vocabolario('ingredients', 'category',
                                        nullif(p_dati->>'categoria', '')), 'altro'),
        (p_dati->>'unita')::unit_type,
        0)->>'id')::uuid;
      return jsonb_build_object('ingredient_id', v_id, 'senza_scheda', true);

    when 'ricetta' then
      if exists (select 1 from recipes r
                  where lower(btrim(r.name)) = lower(btrim(p_dati->>'nome'))) then
        raise exception 'Una ricetta che si chiama «%» c''e'' gia''. Se la vuoi cambiare, aprila dal Ricettario.',
          btrim(p_dati->>'nome');
      end if;
      -- ⚠️ SOLO LO SCHELETRO, e il testo dettato per intero nelle note: gli
      --    ingredienti si mettono a mano. Una quantita' di riga sbagliata
      --    sposta il food cost in silenzio, ed e' precisamente l'errore che
      --    il criterio «la creazione passa dai tuoi occhi» esiste per
      --    evitare.
      v_pezzi := nullif(btrim(coalesce(p_dati->>'sentito', '')), '');
      insert into recipes (name, category, portions_yield, notes)
      values (
        btrim(p_dati->>'nome'),
        (p_dati->>'categoria')::recipe_category,
        greatest(coalesce(nullif(p_dati->>'porzioni', '')::integer, 1), 1),
        case when v_pezzi is null then null else 'Dettata a voce: ' || v_pezzi end)
      returning id into v_id;
      return jsonb_build_object('recipe_id', v_id, 'senza_ingredienti', true);

    else
      raise exception 'Questa cosa il gestionale non la sa ancora fare a voce (%). Si fa a mano come sempre.', p_tipo;
  end case;
end $function$;
;


CREATE OR REPLACE FUNCTION public.azione_percorso(p_tipo text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case p_tipo
    when 'giacenza'        then '/magazzino/allineamento'
    when 'temperatura'     then '/haccp/temperature'
    when 'promemoria'      then '/agenda/nuovo'
    when 'pulizia'         then '/haccp/pulizia'
    when 'lista_spesa'     then '/magazzino/lista-spesa'
    -- ⚠️ Ogni riga ha la sua uscita a mano (27/08): se il gestionale non
    --    riesce a scriverla, si finisce nella schermata giusta coi campi
    --    già compilati. Senza questa riga la spesa spicciola manderebbe da
    --    nessuna parte — cioè butterebbe via il lavoro già fatto.
    when 'spesa_spicciola' then '/magazzino/spesa-spicciola'
    when 'merce_buttata'   then '/magazzino'
    when 'movimento_cassa' then '/cassa/prima-nota'
    -- ⚠️ LA TASCA PORTA IL SOGGETTO NELL'INDIRIZZO: la Prima nota lo legge
    --    gia' (dal 31/08, e' la stessa strada del pulsante «La mia tasca» in
    --    Cassa) e arriva con la tasca scelta e il verso gia' fermo su
    --    «uscita». Senza, si arriverebbe su Borgo 58 e bisognerebbe cambiare
    --    a mano — che e' precisamente il gesto in cui si sbaglia.
    when 'spesa_tasca'     then '/cassa/prima-nota?soggetto=tasca'
    when 'carico_merce'    then '/magazzino/carico'
    when 'prodotto_nuovo'  then '/ricettario/ingredienti/nuovo'
    when 'ricetta'         then '/ricettario/ricette/nuova'
    -- 🔴 `nota_non_capita` NON HA UNA DESTINAZIONE, e non e' una
    --    dimenticanza: vuol dire «non ho capito cosa volevi». Mandare da
    --    qualche parte chi non sa dove sta andando e' peggio che non
    --    mandarlo: sceglierebbe il gestionale al posto suo, a caso.
    else null
  end;
$function$;


CREATE OR REPLACE FUNCTION public.azione_campi(p_tipo text, p_dati jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    case p_tipo
      when 'giacenza' then jsonb_strip_nulls(jsonb_build_object(
        'prodotto', nullif(p_dati->>'ingredient_id', ''),
        'quanto',   nullif(p_dati->>'quanto_ce', ''),
        'note',     nullif(p_dati->>'note', '')))

      when 'temperatura' then jsonb_strip_nulls(jsonb_build_object(
        'attrezzatura', nullif(p_dati->>'equipment_id', ''),
        'gradi',        nullif(p_dati->>'gradi', ''),
        'note',         nullif(p_dati->>'note', '')))

      when 'promemoria' then jsonb_strip_nulls(jsonb_build_object(
        'titolo',      nullif(p_dati->>'titolo', ''),
        'descrizione', nullif(p_dati->>'descrizione', ''),
        'scadenza',    nullif(p_dati->>'data', ''),
        'priorita',    valore_del_vocabolario('tasks', 'priority', p_dati->>'priorita'),
        'categoria',   valore_del_vocabolario('tasks', 'category', p_dati->>'categoria')))

      when 'pulizia' then jsonb_strip_nulls(jsonb_build_object(
        'compito', nullif(p_dati->>'task_id', ''),
        'note',    nullif(p_dati->>'note', '')))

      when 'lista_spesa' then jsonb_strip_nulls(jsonb_build_object(
        'prodotto',  nullif(p_dati->>'ingredient_id', ''),
        'nome',      nullif(p_dati->>'nome_libero', ''),
        'quantita',  nullif(p_dati->>'quantita', ''),
        'unita',     valore_del_vocabolario('shopping_list_items', 'unit', p_dati->>'unita'),
        'note',      nullif(p_dati->>'note', '')))

      -- ⚠️ Niente quantità e niente unità: la spesa spicciola non le ha.
      --    Un campo che la schermata non possiede resterebbe lì a non
      --    riempire niente.
      -- ⚠️ E NEMMENO LA NOTA, per la stessa ragione e con un prezzo che va
      --    detto: la schermata della spesa spicciola ha due campi soli,
      --    cosa serve e la categoria. La nota detta resta nell'appunto e
      --    viene scritta quando lo si APPROVA — è la via normale. A perdersi
      --    è solo se si sceglie di finire a mano, e allora è meglio saperlo
      --    che ritrovarsela scritta in un campo che non si vede.
      when 'spesa_spicciola' then jsonb_strip_nulls(jsonb_build_object(
        'nome',      nullif(p_dati->>'nome_libero', ''),
        'categoria', nullif(p_dati->>'categoria', '')))

      when 'merce_buttata' then jsonb_strip_nulls(jsonb_build_object(
        'prodotto', nullif(p_dati->>'ingredient_id', ''),
        'quantita', nullif(p_dati->>'quantita', ''),
        -- ⚠️ Il motivo e' fissato: questo tipo di azione E' lo spreco. Non
        --    e' un valore indovinato, e' cio' che l'azione significa — e
        --    passa dal vocabolario come tutti gli altri, cosi' se un giorno
        --    quell'elenco cambiasse questo campo tacerebbe invece di
        --    scrivere un motivo che non esiste piu'.
        'motivo',   valore_del_vocabolario('stock_consumptions', 'reason', 'spreco'),
        'note',     nullif(p_dati->>'note', '')))

      -- ⚠️ NIENTE CAUSALE E NIENTE MEZZO: sulla tasca la causale non si
      --    salva (SPEC-0005 — il menu non c'e', quello che si vede e'
      --    «Indeducibile», che e' la regola fiscale e la scrive il
      --    database), e il mezzo e' il contante per definizione. Un campo
      --    che la schermata non offre resterebbe li' a non riempire niente.
      -- ⚠️ E NEMMENO IL VERSO: dalla tasca escono soldi e basta, e la
      --    schermata ci arriva gia' ferma su «uscita».
      when 'spesa_tasca' then jsonb_strip_nulls(jsonb_build_object(
        'importo',     nullif(p_dati->>'importo', ''),
        'descrizione', nullif(p_dati->>'descrizione', ''),
        'data',        nullif(p_dati->>'data', '')))

      when 'movimento_cassa' then jsonb_strip_nulls(jsonb_build_object(
        'verso',       valore_del_vocabolario('cash_movements', 'direction', p_dati->>'verso'),
        'importo',     nullif(p_dati->>'importo', ''),
        'data',        nullif(p_dati->>'data', ''),
        'causale',     nullif(p_dati->>'causale_id', ''),
        'mezzo',       valore_del_vocabolario('cash_movements', 'mezzo', p_dati->>'mezzo'),
        'descrizione', nullif(concat_ws(' · ',
          (select 'Fornitore: ' || s.name from suppliers s
            where s.id = nullif(p_dati->>'supplier_id', '')::uuid),
          nullif(p_dati->>'descrizione', '')), ''),
        'note',        nullif(p_dati->>'note', '')))

      when 'carico_merce' then jsonb_strip_nulls(jsonb_build_object(
        'prodotto',  nullif(p_dati->>'ingredient_id', ''),
        'quantita',  nullif(p_dati->>'quantita', ''),
        'fornitore', nullif(p_dati->>'supplier_id', ''),
        'scadenza',  nullif(p_dati->>'scadenza', ''),
        'costo',     nullif(p_dati->>'costo_unitario', ''),
        'lotto',     nullif(p_dati->>'lotto', ''),
        'note',      nullif(p_dati->>'note', '')))

      when 'prodotto_nuovo' then jsonb_strip_nulls(jsonb_build_object(
        'nome',      nullif(p_dati->>'nome', ''),
        'categoria', valore_del_vocabolario('ingredients', 'category', p_dati->>'categoria'),
        'unita',     valore_del_vocabolario('ingredients', 'unit', p_dati->>'unita')))

      when 'ricetta' then jsonb_strip_nulls(jsonb_build_object(
        'nome',      nullif(p_dati->>'nome', ''),
        'categoria', valore_del_vocabolario('recipes', 'category', p_dati->>'categoria'),
        'porzioni',  nullif(p_dati->>'porzioni', ''),
        'note',      nullif(p_dati->>'sentito', '')))

      else null
    end, '{}'::jsonb);
$function$;

-- ---------------------------------------------------------------------
-- 4. La verifica
-- ---------------------------------------------------------------------
-- ⚠️ Cancella SOLO le righe che ha creato lei, per identificativo raccolto
--    in un array (regola del 23/08 e lezione del 26/08).
do $verifica$
declare
  v_miei    uuid[] := '{}';
  v_tit     uuid;
  v_foto    jsonb;
  v_tasca   uuid;
  v_srls    uuid;
  v_id      uuid;
  v_ris     jsonb;
  v_n       integer;
  v_prima_t integer;
  v_prima_s integer;
  v_dopo    integer;
  v_msg     text;
  v_reg     uuid;
  v_ind     uuid;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);
  v_foto := foto_righe();

  select id into v_tasca from entities where entity_type = 'tasca' limit 1;
  select id into v_srls  from entities where entity_type = 'srls'  limit 1;
  if v_tasca is null or v_srls is null then
    raise exception 'Per provare questa migrazione servono il soggetto tasca e il soggetto Borgo 58.';
  end if;

  select count(*) into v_prima_t from cash_movements where entity_id = v_tasca;
  select count(*) into v_prima_s from cash_movements where entity_id = v_srls;

  -- ⚠️ TUTTO DENTRO UNA SOTTO-TRANSAZIONE CHE VIENE ANNULLATA, come la
  --    verifica che ha costruito la tasca il 30/08: i movimenti di cassa
  --    sono fra le tabelle sorvegliate dal registro delle cancellazioni,
  --    quindi creare e poi cancellare lascerebbe **lapidi finte** in un
  --    registro che nessuno puo' ripulire dall'app. Annullando invece di
  --    cancellare, il registro resta acceso per tutto il tempo e non resta
  --    niente. L'ha preteso il guardiano dei residui, non una rilettura.
  begin

  -- (a) il catalogo la conosce, e NON e' additiva: due spese di denaro non
  --     si firmano con un tocco solo.
  if not exists (
    select 1 from tipi_azione_vocale
     where tipo = 'spesa_tasca' and attivo and eseguibile and not additivo
  ) then
    raise exception 'La spesa dalla tasca non e'' entrata nel catalogo come si deve.';
  end if;

  -- (b) nessun tipo acceso senza il gesto che lo esegue (rete del 27/08)
  select count(*) into v_n from tipi_vocali_senza_ramo();
  if v_n > 0 then
    raise exception 'Ci sono % tipi vocali senza un ramo che li esegua: %',
      v_n, (select string_agg(tipo, ', ') from tipi_vocali_senza_ramo());
  end if;

  -- (c) 🔴 LA SPESA FINISCE SULLA TASCA, E NON SULL'OSTERIA
  v_ris := fai_azione_dettata('spesa_tasca', jsonb_build_object(
    'importo',     12,
    'descrizione', 'VERIFICA-tasca detersivo'));
  v_id := (v_ris->>'movimento_id')::uuid;
  if v_id is null then
    raise exception 'La spesa dalla tasca non ha restituito il movimento scritto: %', v_ris;
  end if;
  v_miei := v_miei || v_id;

  if not exists (
    select 1 from cash_movements
     where id = v_id and entity_id = v_tasca and direction = 'uscita'
       and amount = 12 and business_purpose = 'VERIFICA-tasca detersivo'
  ) then
    raise exception 'Il movimento non e'' finito sulla tasca come uscita da 12.';
  end if;

  select count(*) into v_dopo from cash_movements where entity_id = v_srls;
  if v_dopo <> v_prima_s then
    raise exception 'Una spesa della tasca ha toccato la cassa dell''osteria: % righe invece di %.', v_dopo, v_prima_s;
  end if;

  -- (d) ⚠️ LA PROTEZIONE NON E' RICOPIATA, E' QUELLA CHE C'ERA: il trigger
  --     riempie da se' l'unica regola di deducibilita' ammessa.
  select regola_deducibilita_id into v_reg from cash_movements where id = v_id;
  select id into v_ind from regole_deducibilita
   where percentuale_deducibile = 0 order by ordine limit 1;
  if v_reg is distinct from v_ind then
    raise exception 'La spesa della tasca non e'' risultata «Indeducibile»: e'' %.', coalesce(v_reg::text, 'vuota');
  end if;

  -- (e) e allo specchio: il movimento dell'osteria continua ad andare
  --     sull'osteria. Senza questa meta', una cura che mandasse tutto sulla
  --     tasca passerebbe i controlli qui sopra.
  v_ris := fai_azione_dettata('movimento_cassa', jsonb_build_object(
    'verso', 'uscita', 'importo', 7, 'descrizione', 'VERIFICA-tasca pane osteria'));
  v_id := (v_ris->>'movimento_id')::uuid;
  v_miei := v_miei || v_id;
  if not exists (select 1 from cash_movements where id = v_id and entity_id = v_srls) then
    raise exception 'Il movimento dell''osteria non e'' finito su Borgo 58.';
  end if;
  select count(*) into v_dopo from cash_movements where entity_id = v_tasca;
  if v_dopo <> v_prima_t + 1 then
    raise exception 'Un movimento dell''osteria ha toccato la tasca: % righe invece di %.', v_dopo, v_prima_t + 1;
  end if;

  -- (f) l'uscita a mano porta sulla tasca, coi campi che la schermata ha
  if azione_percorso('spesa_tasca') is distinct from '/cassa/prima-nota?soggetto=tasca' then
    raise exception 'La spesa dalla tasca non ha la sua uscita a mano: %', azione_percorso('spesa_tasca');
  end if;
  if azione_percorso('movimento_cassa') is distinct from '/cassa/prima-nota' then
    raise exception 'L''uscita a mano del movimento di cassa e'' cambiata: %', azione_percorso('movimento_cassa');
  end if;
  if azione_campi('spesa_tasca', jsonb_build_object(
       'importo', '12', 'descrizione', 'detersivo', 'causale_id', 'x', 'mezzo', 'banca'))
     is distinct from jsonb_build_object('importo', '12', 'descrizione', 'detersivo') then
    raise exception 'I campi precompilati della tasca non sono quelli attesi: %',
      azione_campi('spesa_tasca', jsonb_build_object(
        'importo', '12', 'descrizione', 'detersivo', 'causale_id', 'x', 'mezzo', 'banca'));
  end if;

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  -- Dopo l'annullamento non deve restare niente E le lapidi devono essere
  -- le stesse: se qualcosa fosse stato cancellato invece che annullato, il
  -- registro lo direbbe.
  perform pretendi_nessun_residuo(v_foto, 'la verifica della tasca a voce');

  raise notice 'La spesa dalla tasca si detta: 1 riga sulla tasca, 1 sull''osteria, e nessuna delle due dall''altra parte.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260907000002', 'la_spesa_dalla_tasca_si_detta') on conflict (version) do nothing;
