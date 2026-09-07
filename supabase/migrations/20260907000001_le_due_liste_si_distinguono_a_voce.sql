-- =====================================================================
-- LE DUE LISTE SI DISTINGUONO ANCHE A VOCE — SPEC-0012
-- 07/09/2026
-- =====================================================================
-- Le due liste esistono separate nel gestionale dal 23/08/2026:
--   · la **Lista della spesa** nasce dalle soglie del magazzino e finisce
--     in una bozza d'ordine per il fornitore;
--   · la **Spesa spicciola** e' quello che Alessio compra di persona al
--     supermercato — niente soglie, niente ordini, niente giacenze,
--     nessun costo.
-- Tabelle diverse, schermate diverse, indirizzi diversi. Quello che
-- mancava era che MEMO sapesse distinguerle.
--
-- 🔴 IL CASO VERO, dal collaudo del 06/09/2026: Alessio detta «segna il
--    pesce spada nella spesa spicciola» e MEMO propone «Aggiungi alla
--    spesa» — la lista dei fornitori. Quel giorno l'appunto e' stato reso
--    NON approvabile, dichiarando che il gestionale quella lista non
--    l'aveva **per la voce**. Adesso ce l'ha.
--
-- ⚠️ COSA NON FA QUESTA MIGRAZIONE, ed e' scritto nel fuori-scope di
--    SPEC-0012: la spesa spicciola non diventa un movimento di cassa, non
--    diventa una spesa fiscale, non si abbina al magazzino. Resta una
--    lista di acquisti. E non tocca «La mia tasca», che e' un'altra cosa
--    ancora (SPEC-0005): li' si registrano soldi usciti, qui no.
--
-- ⚠️ NIENTE DI QUESTO SCRIVE DA SE': ogni cosa detta resta un appunto da
--    approvare (SPEC-0013). Questa migrazione aggiunge una destinazione,
--    non una scorciatoia.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Il catalogo impara la seconda lista
-- ---------------------------------------------------------------------
-- ⚠️ E' un DATO, non un caso dentro un programma: aggiungere un'azione
--    vocale vuol dire aggiungere una riga e dichiararne la natura.
-- ⚠️ `additivo` = true come la lista della spesa: tre articoli detti in
--    tre momenti per la stessa lista sono UN appunto solo (SPEC-0013).
--    ⚠️ E additivo per lista, non per «liste»: il raggruppamento guarda il
--    tipo, quindi due articoli per liste diverse restano due appunti — che
--    e' precisamente cio' che questa migrazione esiste per ottenere.
insert into tipi_azione_vocale (tipo, natura, titolo, spiega, attivo, additivo, eseguibile)
values (
  'spesa_spicciola',
  'misura',
  'Aggiungi alla spesa spicciola',
  'Una riga della spesa che fai di persona al supermercato. Non compra niente, non muove soldi e non tocca il magazzino: si toglie con un tocco.',
  true,
  true,
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
-- ⚠️ Il corpo arriva dal DATABASE VIVO e non dal file che l'ha creata:
--    fra i due ci stanno tutte le migrazioni che l'hanno toccata dal
--    26/08 in poi (regola del 18/08, pagata una volta).


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

-- ---------------------------------------------------------------------
-- 3. Dove si va a finire a mano, e con che cosa gia' scritto
-- ---------------------------------------------------------------------


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
-- ⚠️ Cancella SOLO le righe che ha creato lei, e le riconosce dagli
--    identificativi che si e' segnata in un array (regola del 23/08, e la
--    forma con l'array e' la lezione del 26/08: una variabile riusata
--    tiene solo l'ultimo).
do $verifica$
declare
  v_miei_spicciola uuid[] := '{}';
  v_miei_lista     uuid[] := '{}';
  v_id      uuid;
  v_ris     jsonb;
  v_n_sp    integer;
  v_n_li    integer;
  v_n_sp2   integer;
  v_n_li2   integer;
  v_lapidi  integer;
  v_lapidi2 integer;
  v_manca   text;
  v_tit     uuid;
  v_foto    jsonb;
begin
  -- 🔴 I CLAIMS DEL TITOLARE, e non è una formalità: dentro una migrazione
  --    `is_titolare()` è FALSO — si gira come proprietari del database — e
  --    le funzioni col portiere rifiutano. Questa verifica ne chiama una,
  --    la rete dei tipi senza ramo, e senza questa riga si ferma con «I
  --    comandi vocali sono del titolare». È la trappola scritta negli
  --    appunti del 16/08, incontrata di nuovo qui: la prima stesura di
  --    questa migrazione ci è cascata.
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  v_foto := foto_righe();
  select count(*) into v_lapidi from deleted_records;
  select count(*) into v_n_sp from spesa_spicciola;
  select count(*) into v_n_li from shopping_list_items;

  -- (a) il catalogo la conosce, ed e' approvabile e raggruppabile
  if not exists (
    select 1 from tipi_azione_vocale
     where tipo = 'spesa_spicciola' and attivo and additivo and eseguibile
  ) then
    raise exception 'La spesa spicciola non e'' entrata nel catalogo delle azioni vocali, o non e'' approvabile.';
  end if;

  -- (b) 🔴 NESSUN TIPO SENZA IL SUO GESTO. La rete c'e' gia' dal 27/08 e
  --     legge il corpo vivo: se il ramo mancasse, il gestionale saprebbe
  --     PROPORRE la spesa spicciola e non saprebbe ESEGUIRLA — cioe' il
  --     buco piu' serio trovato in questo progetto.
  select count(*) into v_n_sp2 from tipi_vocali_senza_ramo();
  if v_n_sp2 > 0 then
    raise exception 'Ci sono % tipi vocali senza un ramo che li esegua: %',
      v_n_sp2, (select string_agg(tipo, ', ') from tipi_vocali_senza_ramo());
  end if;

  -- (c) il gesto scrive NELLA SUA LISTA
  v_ris := fai_azione_dettata('spesa_spicciola', jsonb_build_object(
    'nome_libero', 'VERIFICA-0012 shampoo',
    'categoria',   'pulizia',
    'note',        'scritta dalla verifica'));
  v_id := (v_ris->>'spesa_spicciola_id')::uuid;
  if v_id is null then
    raise exception 'La spesa spicciola non ha restituito l''identificativo della riga scritta.';
  end if;
  v_miei_spicciola := v_miei_spicciola || v_id;

  if not exists (
    select 1 from spesa_spicciola
     where id = v_id and articolo = 'VERIFICA-0012 shampoo' and categoria = 'pulizia'
  ) then
    raise exception 'La riga non e'' finita nella spesa spicciola.';
  end if;

  -- (d) 🔴 E NON NELL'ALTRA. E'' la proprieta'' che il mandato chiede: un
  --     articolo aggiunto a una non compare nell'altra.
  select count(*) into v_n_li2 from shopping_list_items;
  if v_n_li2 <> v_n_li then
    raise exception 'Scrivere nella spesa spicciola ha toccato la lista della spesa: % righe invece di %.', v_n_li2, v_n_li;
  end if;
  if exists (select 1 from shopping_list_items where custom_name like 'VERIFICA-0012%') then
    raise exception 'La riga della spesa spicciola e'' comparsa nella lista della spesa.';
  end if;

  -- (e) e allo specchio: la lista della spesa continua a funzionare, e non
  --     finisce nella spicciola. Senza questa meta'', una cura che mandasse
  --     tutto nella spicciola passerebbe i controlli qui sopra.
  v_ris := fai_azione_dettata('lista_spesa', jsonb_build_object(
    'nome_libero', 'VERIFICA-0012 parmigiano',
    'quantita',    2,
    'unita',       'kg'));
  -- ⚠️ `add_shopping_list_item` restituisce l'identificativo NUDO, non un
  --    oggetto: misurato qui, la prima stesura cercava `item.id` e trovava
  --    vuoto su una riga che era stata scritta benissimo.
  v_id := (v_ris->>'item')::uuid;
  if v_id is null then
    raise exception 'La lista della spesa non ha restituito la riga scritta: %', v_ris;
  end if;
  v_miei_lista := v_miei_lista || v_id;

  if not exists (select 1 from shopping_list_items where id = v_id and custom_name = 'VERIFICA-0012 parmigiano') then
    raise exception 'La riga non e'' finita nella lista della spesa.';
  end if;
  if exists (select 1 from spesa_spicciola where articolo like 'VERIFICA-0012 parmigiano%') then
    raise exception 'La riga della lista della spesa e'' comparsa nella spesa spicciola.';
  end if;

  -- (f) l'uscita a mano porta nella schermata giusta, coi campi compilati
  if azione_percorso('spesa_spicciola') is distinct from '/magazzino/spesa-spicciola' then
    raise exception 'La spesa spicciola non ha la sua uscita a mano: %', azione_percorso('spesa_spicciola');
  end if;
  if azione_percorso('lista_spesa') is distinct from '/magazzino/lista-spesa' then
    raise exception 'L''uscita a mano della lista della spesa e'' cambiata: %', azione_percorso('lista_spesa');
  end if;
  -- ⚠️ E la nota NON deve comparire fra i campi: la schermata non ce l'ha,
  --    e un valore che arriva a un campo che non esiste è un valore perso
  --    in silenzio. Si prova col caso che lo distingue — una nota c'è, e
  --    non deve passare.
  if azione_campi('spesa_spicciola', jsonb_build_object(
       'nome_libero', 'shampoo', 'categoria', 'pulizia', 'note', 'quello grande'))
     is distinct from jsonb_build_object('nome', 'shampoo', 'categoria', 'pulizia') then
    raise exception 'I campi precompilati della spesa spicciola non sono quelli attesi: %',
      azione_campi('spesa_spicciola', jsonb_build_object(
        'nome_libero', 'shampoo', 'categoria', 'pulizia', 'note', 'quello grande'));
  end if;

  -- (g) un tipo che non esiste continua a essere rifiutato, non inventato
  begin
    perform fai_azione_dettata('lista_non_detta', jsonb_build_object('nome_libero', 'x'));
    raise exception 'Un tipo che il gestionale non ha e'' stato eseguito lo stesso.';
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics v_manca = message_text;
      if v_manca like 'Un tipo che il gestionale%' then raise; end if;
  end;

  -- pulizia: solo le mie, per identificativo
  delete from shopping_list_items where id = any(v_miei_lista);
  delete from spesa_spicciola where id = any(v_miei_spicciola);

  select count(*) into v_n_sp2 from spesa_spicciola;
  select count(*) into v_n_li2 from shopping_list_items;
  if v_n_sp2 <> v_n_sp or v_n_li2 <> v_n_li then
    raise exception 'La verifica ha lasciato righe in giro: spicciola % (era %), lista % (era %).',
      v_n_sp2, v_n_sp, v_n_li2, v_n_li;
  end if;

  -- ⚠️ E il guardiano del 26/08 su TUTTE le tabelle, non solo sulle due
  --    che questa verifica sa di toccare: quello che non si sa di aver
  --    scritto è precisamente ciò che nessun conteggio mirato vede.
  perform pretendi_nessun_residuo(v_foto, 'la verifica di SPEC-0012');

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'SPEC-0012: le due liste si distinguono anche a voce. Righe toccate e rimesse: 1 e 1.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260907000001', 'le_due_liste_si_distinguono_a_voce') on conflict (version) do nothing;
