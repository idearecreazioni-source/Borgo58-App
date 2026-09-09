-- =====================================================================
-- L'AGENDA A VOCE — SCEGLIERE COL DITO QUALE IMPEGNO, SENZA RIDIRE LA FRASE
-- =====================================================================
-- 09/09/2026, dopo il collaudo col telefono della #45.
--
-- 🔴 DOV'ERA IL VICOLO CIECO. Quando MEMO trova due impegni ugualmente
--    plausibili non sceglie — e fa bene: chiudere l'impegno di un altro o
--    spostare una scadenza che nessuno voleva toccare sono errori che
--    nessun messaggio annuncia. La #45 ha aggiunto la meta' che mancava:
--    l'appunto DICE quali sono, col loro giorno. Ma restava una cosa da
--    leggere, e l'unica via d'uscita era **ridire la frase piu' precisa**.
--    Guardando due righe sullo schermo e non potendole toccare, il gesto
--    naturale e' proprio quello che non funziona.
--
-- ⚠️ E LA REGOLA CHE NON SI TOCCA RESTA INTERA: **il tocco non scrive
--    niente**. Sceglie e basta. Il si' e' un gesto a parte, arriva dopo, e
--    solo lui esegue. E' la regola di SPEC-0013, non una precauzione in piu':
--    una firma su una cosa che si e' appena toccata non e' una firma.
--
-- ⚠️ NON SI COSTRUISCE UNA STRADA NUOVA. Il meccanismo «questa riga non sa
--    QUALE cosa sia, ecco i candidati da toccare» esiste da SPEC-0013 e lo
--    usano prodotti, frigoriferi e pulizie. L'Agenda ci entra dentro. Una
--    seconda strada per la stessa cosa e' due definizioni che un giorno
--    diranno l'una il contrario dell'altra.
--
-- LE TRE COSE CHE CAMBIANO, e sono tutte nel database:
--   1. i candidati portano il loro IDENTIFICATIVO (senza, non c'e' niente da
--      toccare) e, quando due si leggerebbero uguali, il campo che li
--      distingue davvero;
--   2. `azione_scelte` sa costruire i pulsanti per l'Agenda, e **non offre
--      un impegno che nel frattempo e' stato chiuso**;
--   3. scegliere riporta la riga a essere il gesto che era — senza questo,
--      si sceglierebbe giusto e «Approva» non comparirebbe mai.
--
-- 🔴 CIO' CHE GIA' C'ERA E NON SI TOCCA: il controllo prima di eseguire.
--    `fai_azione_dettata` rifiuta gia' se l'impegno non c'e' piu', se e' gia'
--    fatto, se e' stato rinominato, o (per lo spostamento) se la data di
--    partenza e' cambiata. La scelta col dito non apre nessun buco li':
--    scegliendo si fotografano titolo e data di partenza, che sono
--    esattamente cio' che quei controlli confrontano.

-- ---------------------------------------------------------------------------
-- 1. Chi traduce «come l'ha chiamato lui» in «quale riga e'»
-- ---------------------------------------------------------------------------
-- ⚠️ Il corpo arriva dal DATABASE (regola del 18/08), non dal file che l'aveva
--    creata: fra i due ci stanno tutte le migrazioni che l'hanno toccata.
--    Cambia solo il blocco dell'Agenda.
CREATE OR REPLACE FUNCTION public.voce_risolvi_dati(p_tipo text, p_dati jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dati    jsonb := coalesce(p_dati, '{}'::jsonb);
  v_n       integer;
  v_id      uuid;
  v_sentito text := nullif(btrim(coalesce(v_dati->>'nome_sentito', '')), '');
  v_manca   text := null;
  -- 🔴 «Non l'ho trovato» e «me l'avevi dato e non c'e'» sono due fatti
  --    diversi, e la frase deve dire quale dei due: nel primo caso il
  --    nome non e' stato riconosciuto, nel secondo qualcosa e' stato
  --    cancellato — o inventato da un modello.
  v_perso   boolean := false;
  v_verso   text;
  v_kind    text;
  v_quanti  integer;
  -- Fase 2 dell'Agenda (09/09/2026)
  v_task     tasks%rowtype;
  v_cercato  text;
  v_gesto    text;
  v_quando   text;
  v_manca_ch text[] := '{}';
  v_tipo_new text := null;
  v_dest_new text := null;
  -- La scala della precisione (09/09/2026): quale gradino ha risposto, e
  -- gli impegni che su quel gradino non si sono saputi distinguere.
  v_grado     smallint;
  v_candidati jsonb;
  -- La scelta col dito (09/09/2026): quale gesto e' davvero, e quale
  -- campo distingue due candidati che si leggerebbero uguali.
  v_gesto_tipo text;
  v_campo_dett text;
begin
  -- ------------------------------------------------------------------------
  -- 🔴 CHIUDERE O SPOSTARE UN IMPEGNO CHE ESISTE GIA'
  -- ------------------------------------------------------------------------
  -- La creazione di un promemoria non ha bisogno di trovare niente: si
  -- scrive una riga nuova. Queste due invece devono dire QUALE riga, e
  -- sbagliare riga vuol dire chiudere l'impegno di un altro o spostare una
  -- scadenza che nessuno voleva toccare.
  --
  -- 🔴 QUINDI NON SCEGLIE NESSUNO: se gli impegni compatibili non sono
  --    esattamente uno, la destinazione diventa `agenda_quale_impegno` —
  --    che nel catalogo non c'è, quindi l'appunto NON è approvabile per
  --    costruzione — e la frase dice se non ne ha trovato nessuno o troppi.
  --
  -- ⚠️ E SI CERCA QUI, NEL DATABASE, e non nella funzione online: la
  --    traduzione da «come l'ha chiamato lui» a «quale riga è» vive in
  --    questa funzione per tutti gli altri tipi — prodotti, frigoriferi,
  --    pulizie, preparazioni, causali, fornitori. Metterla altrove sarebbe
  --    il secondo posto che decide la stessa cosa.
  -- 🔴 SI ENTRA ANCHE SU UNA RIGA GIA' DECLASSATA — 09/09/2026, la scelta
  --    col dito. Quando i candidati erano piu' d'uno la riga e' diventata
  --    `agenda_quale_impegno`, e da li' non tornava piu' indietro: era una
  --    strada a senso unico. Adesso, se Alessio tocca uno dei candidati,
  --    la stessa riga deve poter tornare a essere il gesto che era.
  -- ⚠️ IL GESTO SI LEGGE DA `dati.gesto`, e la sua presenza e' anche il
  --    DISCRIMINANTE: una riga declassata perche' il modello non aveva
  --    capito nemmeno quale impegno fosse quel campo non ce l'ha, e quella
  --    non si tocca — non c'e' niente da cui tornare indietro.
  if p_tipo in ('agenda_da_segnare_fatto', 'agenda_da_spostare')
     or (p_tipo = 'agenda_quale_impegno' and nullif(v_dati->>'gesto', '') is not null) then
    v_gesto_tipo := case
      when p_tipo <> 'agenda_quale_impegno' then p_tipo
      when v_dati->>'gesto' = 'sposta'      then 'agenda_da_spostare'
      else 'agenda_da_segnare_fatto'
    end;
    v_gesto   := case v_gesto_tipo when 'agenda_da_segnare_fatto' then 'chiudere' else 'spostare' end;
    v_cercato := coalesce(nullif(btrim(coalesce(v_dati->>'titolo', '')), ''), v_sentito);
    -- 🔴 I CANDIDATI SI RIFANNO A OGNI GIRO, MAI SI CONSERVANO — 09/09/2026.
    --    Questa funzione rigira al momento dell'approvazione, e in mezzo
    --    l'Agenda cambia: un elenco di candidati scritto ieri e lasciato lì
    --    direbbe «erano questi due» quando uno dei due è già stato chiuso.
    --    ⚠️ È la stessa forma di `task_id` qui sotto, che per la stessa
    --    ragione non si tiene se l'impegno non è più aperto. Si toglie
    --    PRIMA di guardare, così l'unico modo di averli è averli appena
    --    trovati.
    v_dati := v_dati - 'impegni_possibili' - 'indistinguibili';
    -- 🔴 L'identificativo che c'era già: è il caso di una riga rimasta in
    --    attesa e confermata più tardi. Se nel frattempo l'impegno è stato
    --    chiuso o tolto, NON si tiene: si torna a cercare, e se non si
    --    trova si chiede. Tenerlo vorrebbe dire approvare su un fatto che
    --    non è più vero.
    v_id := nullif(v_dati->>'task_id', '')::uuid;
    if v_id is not null then
      select * into v_task from tasks t where t.id = v_id;
      if v_task.id is null or v_task.status = 'completato' then
        v_id    := null;
        v_dati  := v_dati - 'task_id';
        v_perso := true;
      end if;
    end if;
    -- ---------------------------------------------------------------------
    -- LA SCALA DELLA PRECISIONE — 09/09/2026
    -- ---------------------------------------------------------------------
    -- 🔴 IL DIFETTO CHE CHIUDE, misurato col telefono in mano: in Agenda c'è
    --    «Rinnovo firma digitale», e la frase naturale «segna come fatto il
    --    rinnovo DELLA firma digitale» non lo trovava. Nessun errore: solo
    --    un «non l'ho trovato» su una cosa che c'è. La colpa era del
    --    confronto, che guardava le parole articoli compresi — e «rinnovo
    --    firma digitale» non è dentro «rinnovo della firma digitale»,
    --    perché in mezzo c'è una parola che non conta niente.
    --
    -- ⚠️ TRE GRADINI, DAL PIÙ STRETTO AL PIÙ LARGO, e si scende solo finché
    --    non si è trovato niente: parola per parola (1), le stesse parole
    --    senza articoli e preposizioni (2), uno contiene l'altro (3). Si
    --    guarda **il gradino più alto che ha trovato qualcosa**, e si
    --    esegue solo se lì dentro c'è UN candidato solo.
    --
    -- 🔴 PERCHÉ UNA SCALA E NON UN INSIEME SOLO. Allargare il confronto trova
    --    più cose, e fra quelle ce ne sono di peggiori: «Ordine verdure»
    --    detto per intero non deve diventare ambiguo perché in Agenda c'è
    --    anche «Ordine verdure e frutta». Con la scala non lo diventa — il
    --    primo gradino ne trova uno solo e la ricerca si ferma lì. **Un
    --    gradino largo non può togliere una risposta che un gradino stretto
    --    aveva già dato**, ed è la proprietà che rende questo cambiamento
    --    incapace di peggiorare ciò che già funzionava: non una speranza da
    --    ricontrollare caso per caso.
    --
    -- ⚠️ E NON SCEGLIE MAI FRA PARI: due candidati sullo stesso gradino sono
    --    due cose ugualmente plausibili, e non esiste nessun criterio onesto
    --    per preferirne una. Lì si chiede, e si dice quali.
    v_grado  := null;
    v_quanti := 0;
    if v_id is null and not v_perso and v_cercato is not null then
      select min(i.grado) into v_grado from impegni_compatibili(v_cercato) i;
      if v_grado is not null then
        select count(*) into v_quanti
          from impegni_compatibili(v_cercato) i where i.grado = v_grado;
        if v_quanti = 1 then
          select i.id into v_id
            from impegni_compatibili(v_cercato) i where i.grado = v_grado;
        end if;
      end if;
    end if;
    -- 🔴 LA FOTOGRAFIA SI RICONOSCE DA `data_precedente`, NON DA `task_id`
    --    — 09/09/2026. Scegliendo col dito, `task_id` arriva PRIMA che il
    --    titolo vero sia stato fotografato: con la condizione di prima
    --    (`non c'e' task_id`) la riga scelta sarebbe rimasta col titolo
    --    SENTITO («commercialista»), e l'esecuzione l'avrebbe respinta
    --    dicendo che l'impegno «adesso si chiama Andare dal
    --    commercialista» — un rifiuto giusto su un fatto falso.
    --    ⚠️ `data_precedente` e' la firma della fotografia: la scrive solo
    --    il ramo qui sotto, e la scrive SEMPRE (anche vuota, quando
    --    l'impegno non ha scadenza). Quindi «c'e' la chiave» vuol dire
    --    esattamente «l'ho gia' guardato», che e' la domanda vera.
    if v_id is not null and not (v_dati ? 'data_precedente') then
      -- ⚠️ IL TITOLO DIVENTA QUELLO SCRITTO IN AGENDA, non quello sentito:
      --    l'appunto si firma, e chi firma deve vedere il nome della riga
      --    che verrà toccata — non le parole con cui l'ha chiamata.
      select * into v_task from tasks t where t.id = v_id;
      v_dati := v_dati || jsonb_build_object(
        'task_id',         v_id,
        'titolo',          v_task.title,
        'data_precedente', v_task.due_date);
    elsif v_id is not null then
      -- 🔴 GIA' RISOLTO PRIMA, E NON SI AGGIORNA NIENTE. Questa funzione
      --    rigira al momento dell'approvazione: riscrivendo il titolo e la
      --    data di partenza con quelli di adesso, l'appunto si allineerebbe
      --    da solo a un impegno cambiato — e il controllo che si ferma
      --    quando è cambiato non scatterebbe mai. Quello che è stato
      --    mostrato resta scritto com'era.
      null;
    else
      -- 🔴 QUANDO SONO TANTI, SI DICE QUALI — 09/09/2026. Prima la frase
      --    diceva soltanto «quale dei 2», e chi la leggeva doveva andare a
      --    cercarli in Agenda per sapere di quali due si parlasse: cioè
      --    rifare a mano il lavoro che il gestionale aveva appena fatto.
      --    Adesso l'appunto se li porta dietro col loro giorno, che è la
      --    cosa che quasi sempre li distingue.
      -- ⚠️ SI MOSTRANO SOLO QUELLI DEL GRADINO CHE HA BLOCCATO, non tutti i
      --    compatibili: sono quelli che il gestionale non ha saputo
      --    distinguere fra loro. Mettere accanto anche i più deboli, che
      --    erano già stati scartati, farebbe sembrare la scelta più
      --    difficile di com'è.
      -- ⚠️ E NON SI TOCCANO: restano una cosa da leggere. Un pulsante per
      --    sceglierli renderebbe approvabile un appunto che finché i
      --    candidati sono due non deve esserlo.
      if v_perso then
        v_manca_ch := v_manca_ch ||
          'l''impegno che ti avevo proposto non è più aperto in Agenda'::text;
      elsif v_cercato is null then
        v_manca_ch := v_manca_ch || 'quale impegno intendevi'::text;
      elsif v_quanti > 1 then
        -- ⚠️ Al più cinque: oltre, l'elenco smette di aiutare a distinguere e
        --    la risposta vera è ridirlo meglio. Il numero intero resta nella
        --    frase, così l'elenco non finge di essere completo.
        -- 🔴 QUALE CAMPO LI DISTINGUE, e si sceglie UNO SOLO per tutti.
        --    Due impegni che si chiamano uguale e scadono lo stesso giorno
        --    si leggerebbero come due righe identiche: toccarne una
        --    sarebbe tirare a sorte. Si cerca allora il PRIMO campo che
        --    li rende davvero diversi, e lo si mostra accanto.
        -- ⚠️ L'ordine non e' casuale: e' quanto quel campo aiuta CHI
        --    GUARDA. Una descrizione dice cos'e'; un'ora dice quando;
        --    una categoria dice dove sta; la data di quando l'hai
        --    scritto e' l'ultima spiaggia — distingue sempre, e spiega
        --    poco.
        -- ⚠️ E SE NESSUNO LI DISTINGUE SI DICHIARA, invece di mostrare due
        --    righe gemelle e lasciar credere che si stia scegliendo.
        with pari as (
          select i.id, i.title, i.due_date, t.description, t.due_time,
                 t.category, t.created_at,
                 row_number() over (order by i.due_date nulls last, i.title, i.id) as ord
            from impegni_compatibili(v_cercato) i
            join tasks t on t.id = i.id
           where i.grado = v_grado
           limit 5
        )
        select case
                 when count(*) = count(distinct (title, due_date))              then null
                 when count(*) = count(distinct (title, due_date, description))  then 'descrizione'
                 when count(*) = count(distinct (title, due_date, due_time))     then 'ora'
                 when count(*) = count(distinct (title, due_date, category))     then 'categoria'
                 when count(*) = count(distinct (title, due_date, created_at))   then 'aggiunto'
                 else 'nessuno'
               end
          into v_campo_dett
          from pari;

        with pari as (
          select i.id, i.title, i.due_date, t.description, t.due_time,
                 t.category, t.created_at,
                 row_number() over (order by i.due_date nulls last, i.title, i.id) as ord
            from impegni_compatibili(v_cercato) i
            join tasks t on t.id = i.id
           where i.grado = v_grado
           limit 5
        )
        select coalesce(jsonb_agg(jsonb_build_object(
                 'id',        p.id,
                 'titolo',    p.title,
                 'data',      p.due_date,
                 'dettaglio', case v_campo_dett
                   when 'descrizione' then nullif(btrim(coalesce(p.description, '')), '')
                   when 'ora'         then to_char(p.due_time, 'HH24:MI')
                   when 'categoria'   then nullif(btrim(coalesce(p.category, '')), '')
                   when 'aggiunto'    then 'aggiunto il ' ||
                        to_char(p.created_at at time zone 'Europe/Rome', 'DD/MM/YYYY')
                   else null end
               ) order by p.ord), '[]'::jsonb)
          into v_candidati
          from pari p;

        v_dati := v_dati || jsonb_build_object('impegni_possibili', v_candidati);
        if v_campo_dett = 'nessuno' then
          v_dati := v_dati || jsonb_build_object('indistinguibili', true);
        end if;
        v_manca_ch := v_manca_ch || ('quale dei ' || v_quanti::text ||
          ' impegni aperti che potrebbero essere «' || v_cercato || '»')::text;
      else
        v_manca_ch := v_manca_ch || ('quale impegno: «' || v_cercato ||
          '» non l''ho trovato fra quelli aperti in Agenda')::text;
      end if;
    end if;
    -- 🔴 LA DATA NUOVA SERVE SOLO ALLO SPOSTAMENTO, e non si inventa:
    --    «a domani» messo al posto suo è una scadenza decisa dal
    --    gestionale, e la riga entrerebbe plausibile senza nessun errore.
    if v_gesto_tipo = 'agenda_da_spostare' then
      v_quando := nullif(btrim(coalesce(v_dati->>'data_nuova', '')), '');
      if v_quando is null or v_quando !~ '^\d{4}-\d{2}-\d{2}$' then
        v_dati     := v_dati - 'data_nuova';
        v_manca_ch := v_manca_ch || 'a quando spostarlo'::text;
      end if;
    end if;
    -- 🔴 E QUANDO NON MANCA PIU' NIENTE, LA RIGA TORNA IL GESTO CHE ERA.
    --    Senza questa riga la scelta col dito riempirebbe il campo e
    --    l'appunto resterebbe `agenda_quale_impegno` — cioe' fuori
    --    catalogo, cioe' NON approvabile per costruzione. Si sarebbe
    --    scelto l'impegno giusto e «Approva» non sarebbe comparso mai.
    -- ⚠️ Il titolo della destinazione si chiede al CATALOGO
    --    (`destinazione_vocale`), non si scrive qui: e' lo stesso posto da
    --    cui lo prende `appunto_per` quando la riga nasce.
    if array_length(v_manca_ch, 1) is null and p_tipo = 'agenda_quale_impegno' then
      v_tipo_new := v_gesto_tipo;
      select d.titolo into v_dest_new from destinazione_vocale(v_gesto_tipo, null) d;
    end if;
    if array_length(v_manca_ch, 1) > 0 then
      -- ⚠️ SI NOMINANO TUTTE LE COSE CHE MANCANO, non la prima: dirne una
      --    per volta fa scoprire la seconda dopo aver rimediato alla prima.
      v_tipo_new := 'agenda_quale_impegno';
      v_dest_new := 'Quale impegno?';
      v_manca := 'Volevi ' || v_gesto || ' un impegno, ma non ho capito ' ||
        array_to_string(v_manca_ch[1:greatest(array_length(v_manca_ch, 1) - 1, 0)], ', ') ||
        case when array_length(v_manca_ch, 1) > 1 then ' e ' else '' end ||
        v_manca_ch[array_length(v_manca_ch, 1)] ||
        '. Ridimmelo nominando l''impegno come si chiama in Agenda, oppure aprilo in Agenda e fallo lì.';
    end if;
    return jsonb_build_object('dati', v_dati, 'manca', v_manca,
                              'tipo', v_tipo_new, 'destinazione', v_dest_new);
  end if;
  -- ------------------------------------------------------------------------
  -- 🔴 LA LISTA DELLA SPESA STA FUORI DA TUTTO IL RESTO, ed e' il punto di
  --    questa migrazione: non cerca in magazzino, non ha bisogno di sapere
  --    quale prodotto sia, e non si ferma mai per un dubbio che non ha.
  -- ------------------------------------------------------------------------
  if p_tipo = 'lista_spesa' then
    if nullif(btrim(coalesce(v_dati->>'nome_libero', '')), '') is null then
      v_dati := v_dati || jsonb_build_object('nome_libero', v_sentito);
    end if;
    if nullif(btrim(coalesce(v_dati->>'nome_libero', '')), '') is null then
      -- L'unica cosa che puo' mancare e': non ho capito COSA.
      v_manca := 'Non ho capito che cosa aggiungere alla lista.';
    end if;
    -- ⚠️ Si buttano via anche se il modello li manda: un identificativo
    --    rimasto attaccato alla riga la farebbe accoppiare col magazzino
    --    domani, quando qualcuno la conferma.
    v_dati := v_dati - 'prodotto' - 'ingredient_id';
    return jsonb_build_object('dati', v_dati, 'manca', v_manca);
  end if;
  if p_tipo in ('giacenza', 'merce_buttata', 'carico_merce') then
    -- 🔴 Se l'identificativo c'e' gia', il numero non serve: e' il caso
    --    di una cosa rimasta in attesa che Alessio conferma piu' tardi.
    v_id := nullif(v_dati->>'ingredient_id', '')::uuid;
    if v_id is null then
      v_n := nullif(v_dati->>'prodotto', '')::integer;
      if v_n is not null then
        select voce_prodotto_numero(v_n) into v_id;
      end if;
      if v_id is not null then
        v_dati := v_dati || jsonb_build_object('ingredient_id', v_id);
      end if;
    elsif not exists (select 1 from ingredients i where i.id = v_id) then
      -- 🔴 L'identificativo c'era e non punta a niente: si toglie dai
      --    dati, altrimenti la riga in attesa se lo porta dietro e chi la
      --    conferma domani ricade nello stesso errore.
      v_id    := null;
      v_dati  := v_dati - 'ingredient_id';
      v_perso := true;
    end if;
    if v_id is null then
      v_manca := case
        when v_perso then
          'Il prodotto che mi avevi indicato non c''e'' piu'' fra quelli del gestionale: dimmi tu qual e''.'
        when v_sentito is not null then
          'Non ho trovato «' || v_sentito || '» fra i prodotti: dimmi tu qual e''.'
        else
          'Non ho capito di quale prodotto stavi parlando.'
      end;
    end if;
    v_dati := v_dati - 'prodotto';
  end if;
  if p_tipo = 'temperatura' then
    v_id := nullif(v_dati->>'equipment_id', '')::uuid;
    if v_id is null then
      v_n := nullif(v_dati->>'frigorifero', '')::integer;
      if v_n is not null then
        select voce_frigorifero_numero(v_n) into v_id;
      end if;
      if v_id is not null then
        v_dati := v_dati || jsonb_build_object('equipment_id', v_id);
      end if;
    elsif not exists (select 1 from haccp_equipment e where e.id = v_id) then
      -- ⚠️ Si guarda che la riga ESISTA, non che sia attiva: una
      --    temperatura misurata su un frigo poi spento e' una misura vera,
      --    e buttarla via sarebbe peggio che scriverla.
      v_id    := null;
      v_dati  := v_dati - 'equipment_id';
      v_perso := true;
    end if;
    if v_id is null then
      -- 🔴 Il frigo non si indovina MAI: quel registro va all'ASP.
      v_manca := case
        when v_perso then 'Il frigo che mi avevi indicato non c''e'' piu'': dimmelo e la scrivo.'
        else 'Non hai detto quale frigo: dimmelo e la scrivo.'
      end;
    end if;
    v_dati := v_dati - 'frigorifero';
  end if;
  if p_tipo = 'pulizia' then
    v_id := nullif(v_dati->>'task_id', '')::uuid;
    if v_id is null then
      v_n := nullif(v_dati->>'pulizia', '')::integer;
      if v_n is not null then
        select voce_pulizia_numero(v_n) into v_id;
      end if;
      if v_id is not null then
        v_dati := v_dati || jsonb_build_object('task_id', v_id);
      end if;
    elsif not exists (select 1 from haccp_cleaning_tasks c where c.id = v_id) then
      v_id    := null;
      v_dati  := v_dati - 'task_id';
      v_perso := true;
    end if;
    if v_id is null then
      v_manca := case
        when v_perso then
          'La pulizia che mi avevi indicato non c''e'' piu'' nel piano.'
        when v_sentito is not null then
          'Non ho trovato «' || v_sentito || '» fra le pulizie del piano.'
        else
          'Non ho capito quale pulizia del piano intendevi.'
      end;
    end if;
    v_dati := v_dati - 'pulizia';
  end if;
  -- ------------------------------------------------------------------------
  -- Il fornitore: vale per il carico e per il movimento di cassa
  -- ------------------------------------------------------------------------
  -- 🔴 NON SI INVENTA, ed e' la stessa regola del frigo. Ma non ferma niente:
  --    una consegna senza fornitore e' una consegna vera, un fornitore
  --    sbagliato no. Quello che ha detto resta comunque scritto.
  if p_tipo in ('carico_merce', 'movimento_cassa') then
    v_id := nullif(v_dati->>'supplier_id', '')::uuid;
    if v_id is null then
      v_n := nullif(v_dati->>'fornitore', '')::integer;
      if v_n is not null then
        select voce_fornitore_numero(v_n) into v_id;
      end if;
      if v_id is not null then
        v_dati := v_dati || jsonb_build_object('supplier_id', v_id);
      end if;
    elsif not exists (select 1 from suppliers s where s.id = v_id) then
      v_dati := v_dati - 'supplier_id';
    end if;
    v_dati := v_dati - 'fornitore';
  end if;
  -- ------------------------------------------------------------------------
  -- Il movimento di cassa
  -- ------------------------------------------------------------------------
  if p_tipo = 'movimento_cassa' then
    v_verso := nullif(v_dati->>'verso', '');
    if v_verso is null or v_verso not in ('entrata', 'uscita') then
      v_manca := coalesce(v_manca,
        'Non ho capito se sono soldi usciti o entrati: dimmelo e lo scrivo.');
    end if;
    if coalesce(nullif(v_dati->>'importo', '')::numeric, 0) <= 0 then
      v_manca := coalesce(v_manca, 'Non ho capito di quanti soldi si tratta.');
    end if;
    v_id := nullif(v_dati->>'causale_id', '')::uuid;
    if v_id is null then
      v_n := nullif(v_dati->>'causale', '')::integer;
      if v_n is not null then
        select voce_causale_numero(v_n) into v_id;
      end if;
    elsif not exists (select 1 from cash_causali c where c.id = v_id and c.active) then
      v_id := null;
      v_dati := v_dati - 'causale_id';
    end if;
    if v_id is not null then
      select kind into v_kind from cash_causali where id = v_id;
      if v_kind is distinct from v_verso then
        -- 🔴 Una causale d'entrata su un'uscita non e' un dettaglio: e' la
        --    riga che finisce nella colonna sbagliata del registro.
        v_manca := coalesce(v_manca,
          'La causale «' || (select label from cash_causali where id = v_id) ||
          '» vale per le ' || coalesce(v_kind, '?') || ', e questi soldi sono in ' ||
          coalesce(v_verso, '?') || '. Ridimmelo.');
        v_dati := v_dati - 'causale_id';
      else
        v_dati := v_dati || jsonb_build_object('causale_id', v_id);
      end if;
    end if;
    v_dati := v_dati - 'causale';
    -- 🔴 Il conto corrente, e i tre casi. Senza questo la banca fallirebbe
    --    con un errore di vincolo, che in cella si legge come un guasto.
    if nullif(v_dati->>'mezzo', '') = 'banca' then
      select count(*) into v_quanti from conti_bancari where attivo;
      if v_quanti = 0 then
        v_manca := coalesce(v_manca,
          'Questi soldi passano dalla banca, ma i Conti correnti non sono ancora stati inseriti: aggiungine uno da Cassa, poi ridimmelo. Se invece erano contanti, dimmi «in contanti».');
      elsif nullif(v_dati->>'conto_id', '') is null then
        if v_quanti = 1 then
          v_dati := v_dati || jsonb_build_object(
            'conto_id', (select id from conti_bancari where attivo limit 1));
        else
          v_manca := coalesce(v_manca,
            'Ci sono piu'' conti correnti: dimmi da quale sono passati.');
        end if;
      end if;
    end if;
  end if;
  -- ------------------------------------------------------------------------
  -- Il carico di merce
  -- ------------------------------------------------------------------------
  if p_tipo = 'carico_merce' then
    if coalesce(nullif(v_dati->>'quantita', '')::numeric, 0) <= 0 then
      v_manca := coalesce(v_manca, 'Non ho capito quanta merce e'' arrivata.');
    end if;
  end if;
  -- ------------------------------------------------------------------------
  -- Il prodotto nuovo
  -- ------------------------------------------------------------------------
  if p_tipo = 'prodotto_nuovo' then
    if nullif(btrim(coalesce(v_dati->>'nome', '')), '') is null then
      v_manca := coalesce(v_manca, 'Non ho capito come si chiama il prodotto nuovo.');
    end if;
    if nullif(v_dati->>'unita', '') is null then
      v_manca := coalesce(v_manca,
        'Non ho capito in che cosa si misura «' || coalesce(v_dati->>'nome', 'quel prodotto') ||
        '»: a chili, a litri o a pezzi?');
    end if;
    if nullif(v_dati->>'categoria', '') is null then
      v_manca := coalesce(v_manca,
        'Non ho capito in che categoria mettere «' || coalesce(v_dati->>'nome', 'quel prodotto') || '».');
    end if;
  end if;
  -- ------------------------------------------------------------------------
  -- La ricetta
  -- ------------------------------------------------------------------------
  if p_tipo = 'ricetta' then
    if nullif(btrim(coalesce(v_dati->>'nome', '')), '') is null then
      v_manca := coalesce(v_manca, 'Non ho capito come si chiama il piatto.');
    end if;
    if nullif(v_dati->>'categoria', '') is null then
      v_manca := coalesce(v_manca,
        'Non ho capito se e'' un antipasto, un primo, un secondo, un dolce o un finger food.');
    end if;
  end if;
  -- ------------------------------------------------------------------------
  -- La preparazione da segnare fra le cose da fare (29/08/2026)
  -- ------------------------------------------------------------------------
  -- ⚠️ Stessa forma del prodotto: se l'identificativo c'e' gia' il numero
  --    non serve, e se il numero non porta a niente si CHIEDE invece di
  --    tirare a indovinare. Segnare la preparazione sbagliata non rompe
  --    niente — ma fa cucinare la cosa sbagliata, che e' peggio.
  if p_tipo = 'preparazione_da_fare' then
    v_id := nullif(v_dati->>'recipe_id', '')::uuid;
    if v_id is null then
      v_n := nullif(v_dati->>'preparazione', '')::integer;
      if v_n is not null then
        select voce_preparazione_numero(v_n) into v_id;
      end if;
      if v_id is not null then
        v_dati := v_dati || jsonb_build_object('recipe_id', v_id);
      end if;
    elsif not exists (select 1 from recipes r
                       where r.id = v_id and r.recipe_type = 'preparazione') then
      v_id    := null;
      v_dati  := v_dati - 'recipe_id';
      v_perso := true;
    end if;
    if v_id is null then
      v_manca := case
        when v_perso then
          'La preparazione che mi avevi indicato non c''e'' piu'' fra quelle del Ricettario: dimmi tu qual e''.'
        when v_sentito is not null then
          'Non ho trovato «' || v_sentito || '» fra le preparazioni: dimmi tu qual e''.'
        else
          'Non ho capito quale preparazione volevi segnare fra le cose da fare.'
      end;
    end if;
    v_dati := v_dati - 'preparazione';
  end if;
  return jsonb_build_object('dati', v_dati, 'manca', v_manca);
end $function$;

-- ---------------------------------------------------------------------------
-- 2. I candidati diventano cose da toccare
-- ---------------------------------------------------------------------------
-- ⚠️ SI RIUSA IL MECCANISMO CHE C'E' GIA', e non se ne inventa uno accanto.
--    Da SPEC-0013 una riga che non sa QUALE cosa sia porta le sue `scelte`,
--    la schermata le disegna come pulsanti, e toccarne una **riempie il campo
--    e basta** — il si' resta un gesto a parte. Prodotti, frigoriferi e
--    pulizie funzionano cosi' da settimane: l'Agenda entra nella stessa
--    strada invece di aprirne una seconda che un giorno direbbe altro.
--
-- ⚠️ E IL NOME DEL PULSANTE PORTA IL GIORNO, non solo il titolo: e' quello
--    che distingue due impegni che si chiamano quasi uguale, ed e' la ragione
--    per cui il giorno era stato messo nell'elenco.
--
-- 🔴 UN CANDIDATO CHIUSO NEL FRATTEMPO NON SI OFFRE PIU'. Fra il momento in
--    cui l'appunto e' nato e il dito che tocca possono passare ore: proporre
--    un impegno gia' fatto vorrebbe dire far scegliere una cosa che poi
--    l'approvazione rifiuta — un vicolo cieco costruito da noi.
CREATE OR REPLACE FUNCTION public.azione_scelte(p_tipo text, p_dati jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_out jsonb := '[]'::jsonb;
  v_n   integer;
  v_id  uuid;
  v_nome text;
begin
  -- Gli impegni dell'Agenda: i candidati sono righe vere, non numeri di
  -- catalogo, e portano gia' con se' come si chiamano.
  if p_tipo = 'agenda_quale_impegno' then
    if p_dati->'impegni_possibili' is null
       or jsonb_typeof(p_dati->'impegni_possibili') <> 'array' then
      return v_out;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
             'id',   (c.value->>'id')::uuid,
             'nome', (c.value->>'titolo')
                     || ' — ' || coalesce(to_char((c.value->>'data')::date, 'DD/MM/YYYY'),
                                          'senza scadenza')
                     || coalesce(' · ' || nullif(c.value->>'dettaglio', ''), '')
           ) order by c.ord), '[]'::jsonb)
      into v_out
      from jsonb_array_elements(p_dati->'impegni_possibili') with ordinality as c(value, ord)
     where nullif(c.value->>'id', '') is not null
       and exists (select 1 from tasks t
                    where t.id = (c.value->>'id')::uuid
                      and t.status <> 'completato');
    return v_out;
  end if;

  if p_dati->'candidati' is null or jsonb_typeof(p_dati->'candidati') <> 'array' then
    return v_out;
  end if;

  -- ⚠️ SOLO I NUMERI: `candidati` qui vuol dire «numeri di catalogo». Un
  --    elemento di un'altra forma si salta invece di far fallire la lettura
  --    di tutti gli appunti insieme.
  for v_n in
    select value::text::integer
      from jsonb_array_elements(p_dati->'candidati')
     where jsonb_typeof(value) = 'number'
  loop
    v_id := null;
    v_nome := null;

    if p_tipo in ('giacenza', 'merce_buttata', 'carico_merce') then
      v_id := voce_prodotto_numero(v_n);
      select i.name into v_nome from ingredients i where i.id = v_id;
    elsif p_tipo = 'temperatura' then
      v_id := voce_frigorifero_numero(v_n);
      select e.name into v_nome from haccp_equipment e where e.id = v_id;
    elsif p_tipo = 'pulizia' then
      v_id := voce_pulizia_numero(v_n);
      select c.name into v_nome from haccp_cleaning_tasks c where c.id = v_id;
    end if;

    -- ⚠️ Un candidato senza nome non entra: un pulsante vuoto è peggio di
    --    un pulsante che manca.
    if v_id is not null and nullif(btrim(coalesce(v_nome, '')), '') is not null then
      v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_id, 'nome', v_nome));
    end if;
  end loop;

  return v_out;
end $function$;

-- ---------------------------------------------------------------------------
-- 3. Toccare sceglie, e riporta la riga a essere il gesto che era
-- ---------------------------------------------------------------------------
-- 🔴 IL TOCCO NON SCRIVE NIENTE IN AGENDA, e non e' una precauzione in piu':
--    e' la regola di SPEC-0013. Scegliere riempie il campo, l'appunto resta
--    li', e il si' arriva dopo — perche' nel frattempo dentro l'appunto ci
--    possono essere altre righe, e perche' una firma su una cosa che si e'
--    appena toccata non e' una firma.
--
-- 🔴 E QUI SI FA UNA COSA IN PIU' CHE PRIMA NON SERVIVA: si rimette a posto
--    IL TIPO della riga. Un impegno ambiguo era diventato
--    `agenda_quale_impegno`, che nel catalogo non c'e' — cioe' non
--    approvabile per costruzione. Scelto il candidato, quel motivo non esiste
--    piu', e la riga deve tornare `agenda_da_segnare_fatto` (o `…spostare`),
--    altrimenti si sarebbe scelto giusto e «Approva» non comparirebbe mai.
--
-- ⚠️ L'APPUNTO SI AGGIORNA SOLO SE CONTIENE QUESTA RIGA E BASTA. Il titolo e
--    l'essere approvabile stanno sull'appunto, non sulla riga: cambiarli
--    quando dentro ce n'e' un'altra vorrebbe dire rendere approvabile anche
--    quella. ⚠️ Misurato: i tre tipi dell'Agenda hanno `additivo = false`,
--    quindi ognuno ha il suo appunto e il caso non si presenta — ma il
--    controllo resta, perche' e' cio' che lo tiene vero.
CREATE OR REPLACE FUNCTION public.scegli_per_azione_dettata(p_id uuid, p_scelta uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_a       azioni_dettate%rowtype;
  v_campo   text;
  v_dati    jsonb;
  v_ris     jsonb;
  v_manca   text;
  v_tipo    text;
  v_quante  integer;
  v_dest    record;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' scegliere.';
  end if;

  select * into v_a from azioni_dettate where id = p_id for update;
  if not found then
    raise exception 'Questa cosa da confermare non c''e'' piu''.';
  end if;
  if v_a.stato not in ('in_attesa', 'fallita') then
    raise exception 'Su questa non c''e'' piu'' niente da scegliere: e'' «%».', v_a.stato;
  end if;

  -- ⚠️ Si accetta SOLO una delle scelte che il gestionale ha offerto. Senza
  --    questo controllo, la scelta arriverebbe dal browser e si potrebbe
  --    scrivere un identificativo qualunque — cioe' abbinare la temperatura
  --    di un frigo a un altro, dal di fuori.
  --    🔴 Per l'Agenda vale doppio: senza, si potrebbe far chiudere QUALSIASI
  --    impegno passando il suo identificativo, saltando la ricerca.
  if not exists (
    select 1 from jsonb_array_elements(azione_scelte(v_a.tipo, v_a.dati)) s
     where (s.value->>'id')::uuid = p_scelta
  ) then
    raise exception 'Questa non e'' una delle cose che ti avevo proposto: ridimmi tu qual e''.';
  end if;

  v_campo := case
    when v_a.tipo in ('giacenza', 'merce_buttata', 'carico_merce') then 'ingredient_id'
    when v_a.tipo = 'temperatura'          then 'equipment_id'
    when v_a.tipo = 'pulizia'              then 'task_id'
    when v_a.tipo = 'agenda_quale_impegno' then 'task_id'
  end;
  if v_campo is null then
    raise exception 'Su questa cosa non c''e'' niente da scegliere.';
  end if;

  -- 🔴 SI SEGNA CHE LA SCELTA E' STATA FATTA COL DITO, e non e' un dettaglio:
  --    e' cio' che permette alla schermata di dire «hai scelto questo» SOLO
  --    quando c'e' stato davvero qualcosa da scegliere. Senza il segno, la
  --    stessa frase comparirebbe anche sul caso a candidato unico — dove
  --    nessuno ha scelto niente — e una frase che dice il falso su come si e'
  --    arrivati a un dato e' peggio di nessuna frase.
  v_dati := (v_a.dati - 'candidati' - 'impegni_possibili' - 'indistinguibili')
            || jsonb_build_object(v_campo, p_scelta, 'scelto_a_mano', true);

  -- Si ritraduce subito: cosi' la scelta si vede sull'appunto invece di
  -- scoprirsi al momento di approvare.
  v_ris   := voce_risolvi_dati(v_a.tipo, v_dati);
  v_dati  := v_ris->'dati';
  v_manca := nullif(v_ris->>'manca', '');
  v_tipo  := coalesce(nullif(v_ris->>'tipo', ''), v_a.tipo);

  update azioni_dettate
     set dati   = v_dati,
         tipo   = v_tipo,
         sicuro = (v_manca is null),
         motivo = v_manca,
         errore = null,
         stato  = 'in_attesa'
   where id = p_id;

  if v_tipo is distinct from v_a.tipo then
    select count(*) into v_quante from azioni_dettate where appunto_id = v_a.appunto_id;
    if v_quante = 1 then
      select * into v_dest from destinazione_vocale(v_tipo, null);
      update appunti_vocali
         set destinazione = v_tipo,
             titolo       = v_dest.titolo,
             eseguibile   = v_dest.eseguibile
       where id = v_a.appunto_id;
    end if;
  end if;

  -- 🔴 NON SI ESEGUE. Il sì e' l'approvazione dell'appunto, e arriva dopo.
  return jsonb_build_object('frase', v_a.frase, 'manca', v_manca, 'dati', v_dati);
end $function$;

-- ---------------------------------------------------------------------------
-- LA VERIFICA
-- ---------------------------------------------------------------------------
-- ⚠️ QUI SI PROVA SOLO CIO' CHE NON HA UN PORTIERE. `scegli_per_azione_dettata`
--    pretende `is_titolare()`, e dentro una migrazione quello e' FALSO (il
--    proprietario non e' un utente): chiamarla qui darebbe un rifiuto che non
--    dice niente. Il giro col dito si prova dal client, col token di un utente
--    vero — `tests/app/agenda-scelta-candidato.test.js` — che e' la regola del
--    16/08: *un difetto che vive nei permessi si prova solo dal client*.
-- ⚠️ Gli impegni se li crea questa verifica, con un marchio a caso, e si
--    cancellano per identificativo (regola del 23/08).
do $verifica$
declare
  v_m     text := 'zzs' || replace(substr(gen_random_uuid()::text, 1, 8), '-', '');
  v_miei  uuid[] := '{}';
  v_a     uuid;  v_b uuid;   -- stesso nome, giorni diversi
  v_c     uuid;  v_d uuid;   -- stesso nome e giorno, categoria diversa
  v_e     uuid;  v_f uuid;   -- gemelli in tutto
  v_solo  uuid;              -- uno solo
  v_sp    uuid;              -- quello da spostare
  v_ris   jsonb;
  v_sc    jsonb;
  v_lap0  bigint;
  v_lap1  bigint;
  v_n     integer;
begin
  select count(*) into v_lap0 from deleted_records;

  insert into tasks (title, status, due_date, category)
       values (v_m || ' Chiamarex fornitorex', 'da_fare', date '2027-03-01', 'altro')
    returning id into v_a;
  insert into tasks (title, status, due_date, category)
       values (v_m || ' Chiamarex fornitorex', 'da_fare', date '2027-03-02', 'altro')
    returning id into v_b;
  insert into tasks (title, status, due_date, category)
       values (v_m || ' Portarex documentix', 'da_fare', date '2027-04-01', 'documenti')
    returning id into v_c;
  insert into tasks (title, status, due_date, category)
       values (v_m || ' Portarex documentix', 'da_fare', date '2027-04-01', 'fornitori')
    returning id into v_d;
  insert into tasks (title, status, due_date, category)
       values (v_m || ' Gemellox esattox', 'da_fare', date '2027-05-01', 'altro')
    returning id into v_e;
  insert into tasks (title, status, due_date, category)
       values (v_m || ' Gemellox esattox', 'da_fare', date '2027-05-01', 'altro')
    returning id into v_f;
  insert into tasks (title, status, due_date, category)
       values (v_m || ' Unicox suox', 'da_fare', date '2027-06-01', 'altro')
    returning id into v_solo;
  insert into tasks (title, status, due_date, category)
       values (v_m || ' Spostarex questox', 'da_fare', date '2027-07-01', 'altro')
    returning id into v_sp;
  v_miei := array[v_a, v_b, v_c, v_d, v_e, v_f, v_solo, v_sp];
  -- I gemelli devono differire SOLO per l'identificativo: la data in cui sono
  -- stati scritti li distinguerebbe, e qui si vuole il caso senza scampo.
  update tasks set created_at = timestamptz '2027-01-01 10:00+01' where id in (v_e, v_f);

  -- ---------------------------------------------------------------------
  -- 1. DUE CANDIDATI: portano l'identificativo, e si possono toccare
  -- ---------------------------------------------------------------------
  v_ris := voce_risolvi_dati('agenda_da_segnare_fatto',
             jsonb_build_object('titolo', v_m || ' chiamarex fornitorex',
                                'gesto',  'segna fatto'));
  if v_ris->>'tipo' is distinct from 'agenda_quale_impegno' then
    raise exception 'VERIFICA: con due candidati la riga non e'' stata declassata: «%»',
      coalesce(v_ris->>'tipo', '(niente)');
  end if;
  v_n := jsonb_array_length(v_ris->'dati'->'impegni_possibili');
  if v_n <> 2 then
    raise exception 'VERIFICA: i candidati sono % invece di 2.', v_n;
  end if;
  -- 🔴 SENZA IDENTIFICATIVO NON C'E' NIENTE DA TOCCARE: e' la riga che rende
  --    possibile tutto il resto, e la sua assenza non darebbe nessun errore —
  --    darebbe un elenco che non risponde al dito.
  if exists (select 1 from jsonb_array_elements(v_ris->'dati'->'impegni_possibili') c
              where nullif(c.value->>'id', '') is null) then
    raise exception 'VERIFICA: un candidato non porta il suo identificativo: %',
      v_ris->'dati'->>'impegni_possibili';
  end if;
  -- Giorni diversi: non serve nessun dettaglio in piu'.
  if exists (select 1 from jsonb_array_elements(v_ris->'dati'->'impegni_possibili') c
              where nullif(c.value->>'dettaglio', '') is not null) then
    raise exception 'VERIFICA: dettaglio aggiunto dove i giorni gia'' distinguono: %',
      v_ris->'dati'->>'impegni_possibili';
  end if;

  v_sc := azione_scelte('agenda_quale_impegno', v_ris->'dati');
  if jsonb_array_length(v_sc) <> 2 then
    raise exception 'VERIFICA: i pulsanti sono % invece di 2: %', jsonb_array_length(v_sc), v_sc;
  end if;
  -- ⚠️ Il nome del pulsante porta il GIORNO: e' quello che distingue.
  if not exists (select 1 from jsonb_array_elements(v_sc) s
                  where s.value->>'nome' like '%01/03/2027%')
     or not exists (select 1 from jsonb_array_elements(v_sc) s
                     where s.value->>'nome' like '%02/03/2027%') then
    raise exception 'VERIFICA: i pulsanti non portano il giorno: %', v_sc;
  end if;

  -- ---------------------------------------------------------------------
  -- 2. STESSO NOME E STESSO GIORNO: si aggiunge cio' che li distingue
  -- ---------------------------------------------------------------------
  v_ris := voce_risolvi_dati('agenda_da_segnare_fatto',
             jsonb_build_object('titolo', v_m || ' portarex documentix',
                                'gesto',  'segna fatto'));
  if jsonb_array_length(v_ris->'dati'->'impegni_possibili') <> 2 then
    raise exception 'VERIFICA: il caso «stesso nome e stesso giorno» non ha due candidati.';
  end if;
  -- ⚠️ Si pretende la PROPRIETA', non due parole scritte a mano: la categoria
  --    la normalizza un trigger dell'Agenda (misurato: «fornitori» diventa
  --    «fornitori_pagamenti»), e una verifica che fissa il valore si rompe il
  --    giorno che quel vocabolario cambia — per una ragione che non c'entra
  --    niente con cio' che sta provando.
  select count(*) into v_n
    from jsonb_array_elements(v_ris->'dati'->'impegni_possibili') c
   where nullif(c.value->>'dettaglio', '') is not null;
  if v_n <> 2 then
    raise exception 'VERIFICA: manca il dettaglio che li distingue: %',
      v_ris->'dati'->>'impegni_possibili';
  end if;
  select count(distinct c.value->>'dettaglio') into v_n
    from jsonb_array_elements(v_ris->'dati'->'impegni_possibili') c;
  if v_n <> 2 then
    raise exception 'VERIFICA: il dettaglio c''e'' ma è uguale per tutti e due: %',
      v_ris->'dati'->>'impegni_possibili';
  end if;
  if (v_ris->'dati'->>'indistinguibili') is not null then
    raise exception 'VERIFICA: dichiarati indistinguibili due impegni che si distinguono.';
  end if;

  -- ---------------------------------------------------------------------
  -- 3. GEMELLI IN TUTTO: si dichiara, non si finge una scelta
  -- ---------------------------------------------------------------------
  v_ris := voce_risolvi_dati('agenda_da_segnare_fatto',
             jsonb_build_object('titolo', v_m || ' gemellox esattox',
                                'gesto',  'segna fatto'));
  if (v_ris->'dati'->>'indistinguibili')::boolean is not true then
    raise exception 'VERIFICA: due impegni identici in tutto non sono dichiarati tali: %',
      v_ris->'dati'::text;
  end if;
  -- ⚠️ E i pulsanti restano: chi guarda puo' saperlo lui quale sia. Quello
  --    che non si fa e' fingere che l'elenco basti a distinguerli.
  if jsonb_array_length(azione_scelte('agenda_quale_impegno', v_ris->'dati')) <> 2 then
    raise exception 'VERIFICA: i gemelli non sono toccabili.';
  end if;

  -- ---------------------------------------------------------------------
  -- 4. SCEGLIERE: la riga torna il gesto che era, col titolo VERO
  -- ---------------------------------------------------------------------
  -- 🔴 E' il punto in cui il difetto sarebbe silenzioso: senza fotografare il
  --    titolo, la riga scelta resterebbe con le parole dette, e l'esecuzione
  --    la respingerebbe dicendo che l'impegno «adesso si chiama…».
  v_ris := voce_risolvi_dati('agenda_quale_impegno',
             jsonb_build_object('titolo',  v_m || ' chiamarex fornitorex',
                                'gesto',   'segna fatto',
                                'task_id', v_a));
  if v_ris->>'tipo' is distinct from 'agenda_da_segnare_fatto' then
    raise exception 'VERIFICA: scelto il candidato, la riga non torna il gesto che era: «%»',
      coalesce(v_ris->>'tipo', '(niente)');
  end if;
  if nullif(v_ris->>'manca', '') is not null then
    raise exception 'VERIFICA: scelto il candidato, dice ancora che manca qualcosa: «%»',
      v_ris->>'manca';
  end if;
  if v_ris->'dati'->>'titolo' is distinct from (v_m || ' Chiamarex fornitorex') then
    raise exception 'VERIFICA: il titolo non e'' quello di Agenda: «%»',
      coalesce(v_ris->'dati'->>'titolo', '(vuoto)');
  end if;
  if not (v_ris->'dati' ? 'data_precedente')
     or v_ris->'dati'->>'data_precedente' is distinct from '2027-03-01' then
    raise exception 'VERIFICA: il giorno di partenza non e'' stato fotografato: «%»',
      coalesce(v_ris->'dati'->>'data_precedente', '(assente)');
  end if;
  if v_ris->'dati' ? 'impegni_possibili' then
    raise exception 'VERIFICA: scelto il candidato, restano gli altri attaccati.';
  end if;

  -- ---------------------------------------------------------------------
  -- 5. UNO SOLO: tutto come nella #45, e nessun pulsante
  -- ---------------------------------------------------------------------
  v_ris := voce_risolvi_dati('agenda_da_segnare_fatto',
             jsonb_build_object('titolo', v_m || ' unicox suox', 'gesto', 'segna fatto'));
  if (v_ris->'dati'->>'task_id')::uuid is distinct from v_solo then
    raise exception 'VERIFICA: con un solo candidato non lo trova piu''.';
  end if;
  if v_ris->'dati' ? 'impegni_possibili'
     or jsonb_array_length(azione_scelte('agenda_quale_impegno', v_ris->'dati')) <> 0 then
    raise exception 'VERIFICA: con un solo candidato compaiono dei pulsanti.';
  end if;

  -- ---------------------------------------------------------------------
  -- 6. NESSUN CANDIDATO: niente pulsanti, niente da approvare
  -- ---------------------------------------------------------------------
  v_ris := voce_risolvi_dati('agenda_da_segnare_fatto',
             jsonb_build_object('titolo', v_m || ' xilofonox marmellatox',
                                'gesto',  'segna fatto'));
  if v_ris->>'tipo' is distinct from 'agenda_quale_impegno' then
    raise exception 'VERIFICA: senza candidati la riga risulta approvabile.';
  end if;
  if jsonb_array_length(azione_scelte('agenda_quale_impegno', v_ris->'dati')) <> 0 then
    raise exception 'VERIFICA: senza candidati compaiono dei pulsanti.';
  end if;

  -- ---------------------------------------------------------------------
  -- 7. UN CANDIDATO CHIUSO NEL FRATTEMPO NON SI OFFRE PIU'
  -- ---------------------------------------------------------------------
  -- Fra l'appunto e il dito possono passare ore: offrire un impegno gia'
  -- fatto sarebbe costruire un vicolo cieco.
  v_ris := voce_risolvi_dati('agenda_da_segnare_fatto',
             jsonb_build_object('titolo', v_m || ' chiamarex fornitorex',
                                'gesto',  'segna fatto'));
  update tasks set status = 'completato' where id = v_b;
  v_sc := azione_scelte('agenda_quale_impegno', v_ris->'dati');
  if jsonb_array_length(v_sc) <> 1 then
    raise exception 'VERIFICA: il candidato chiuso viene ancora offerto: %', v_sc;
  end if;
  if (v_sc->0->>'id')::uuid is distinct from v_a then
    raise exception 'VERIFICA: e'' rimasto in elenco quello sbagliato.';
  end if;
  update tasks set status = 'da_fare' where id = v_b;

  -- ---------------------------------------------------------------------
  -- 8. LO SPOSTAMENTO: scegliendo si fotografa il giorno di partenza
  -- ---------------------------------------------------------------------
  v_ris := voce_risolvi_dati('agenda_quale_impegno',
             jsonb_build_object('titolo',     v_m || ' spostarex questox',
                                'gesto',      'sposta',
                                'data_nuova', '2027-08-15',
                                'task_id',    v_sp));
  if v_ris->>'tipo' is distinct from 'agenda_da_spostare' then
    raise exception 'VERIFICA: lo spostamento scelto non torna «da spostare»: «%»',
      coalesce(v_ris->>'tipo', '(niente)');
  end if;
  if v_ris->'dati'->>'data_precedente' is distinct from '2027-07-01'
     or v_ris->'dati'->>'data_nuova' is distinct from '2027-08-15' then
    raise exception 'VERIFICA: i due giorni dello spostamento non ci sono: %',
      v_ris->'dati'::text;
  end if;

  -- ---------------------------------------------------------------------
  -- 9. UNA RIGA CHE NON SA NEMMENO CHE GESTO SIA NON SI TOCCA
  -- ---------------------------------------------------------------------
  -- ⚠️ E' il discriminante: `agenda_quale_impegno` nasce anche quando il
  --    modello non ha capito quale impegno fosse, e quella riga non ha un
  --    `gesto` da cui tornare indietro. Trattarla come le altre vorrebbe dire
  --    inventare un gesto che nessuno ha detto.
  v_ris := voce_risolvi_dati('agenda_quale_impegno',
             jsonb_build_object('titolo', v_m || ' unicox suox'));
  if v_ris->>'tipo' is not null then
    raise exception 'VERIFICA: una riga senza gesto e'' stata promossa a «%».', v_ris->>'tipo';
  end if;
  if v_ris->'dati' ? 'task_id' then
    raise exception 'VERIFICA: una riga senza gesto si e'' presa un impegno da sola.';
  end if;

  -- ---------------------------------------------------------------------
  -- Si ripulisce: solo cio' che questa verifica ha creato
  -- ---------------------------------------------------------------------
  delete from tasks where id = any(v_miei);
  select count(*) into v_n from tasks where id = any(v_miei);
  if v_n <> 0 then
    raise exception 'VERIFICA: sono rimasti % impegni di prova.', v_n;
  end if;
  select count(*) into v_lap1 from deleted_records;
  if v_lap1 <> v_lap0 then
    raise exception 'VERIFICA: il registro delle cancellazioni e'' passato da % a %.', v_lap0, v_lap1;
  end if;

  raise notice 'Agenda: i candidati si toccano, la scelta riporta il gesto, e nessuno sceglie al posto tuo.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260909000004', 'agenda_scegliere_il_candidato') on conflict (version) do nothing;
