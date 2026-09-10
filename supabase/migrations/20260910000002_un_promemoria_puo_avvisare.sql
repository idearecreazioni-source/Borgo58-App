-- =====================================================================
-- UN PROMEMORIA PUO' AVVISARE — «ricordamelo il giorno prima alle 15»
-- =====================================================================
-- 10/09/2026. Blocco 3 del mandato notturno, deciso da Alessio.
--
-- 🔴 LA FRASE DEL MANDATO, PAROLA PER PAROLA: *«Segna che ho appuntamento
--    in banca sabato 13 e ricordamelo con una notifica il giorno prima
--    alle 15.»* Dentro ci sono DUE date e non una: il giorno in cui la
--    cosa succede, e il giorno in cui vuole esserne avvisato. Il gestionale
--    sapeva scrivere solo la prima — il campo del promemoria Telegram
--    esiste dal primo giorno, e a voce non lo riempiva nessuno.
--
-- ⚠️ E IL MODO DI FALLIRE ERA MUTO: dettando quella frase nasceva un
--    impegno giusto **senza nessun avviso**, e nessun errore. Chi l'ha
--    dettata resta convinto di aver chiesto una notifica, e se ne accorge
--    il giorno che non arriva — cioe' il giorno in cui serviva.
--
-- 🔴 QUI NON SI INVENTA NE' IL GIORNO NE' L'ORA. Un'ora plausibile messa
--    al posto di un'ora detta e' **indistinguibile da un'ora detta**:
--    l'avviso arriverebbe quando ha deciso il gestionale, e chi lo riceve
--    crederebbe di averlo chiesto lui. Quindi mezzo avviso non e' un
--    avviso: si chiede, e finche' non c'e' la risposta l'appunto **non e'
--    approvabile**.
--
-- ⚠️ COME SI RENDE NON APPROVABILE, ed e' lo stesso meccanismo dell'Agenda
--    (09/09): si cambia il TIPO in `promemoria_quando_avvisare`, che nel
--    catalogo `tipi_azione_vocale` **non c'e'**. `eseguibile` lo decide il
--    catalogo, non i dati, quindi un tipo che li' non esiste nasce non
--    approvabile **per costruzione**, senza nessun controllo da ricordare.
--    Non e' una dimenticanza da sanare: e' la strada.
--
-- 🔴 E IL CONTROLLO SI RIFA' AL MOMENTO DI «APPROVA», non solo quando
--    l'appunto nasce. Fra la proposta e la firma possono passare ore — un
--    appunto lasciato aperto la sera si approva la mattina dopo — e un
--    avviso che allora era futuro adesso puo' essere passato. Controllarlo
--    solo alla proposta lascerebbe scrivere un promemoria che **non
--    arrivera' mai**, e nessun errore lo direbbe. Sono due controlli e non
--    un doppione: rispondono a due domande in due momenti diversi.
--
-- ⚠️ L'ORA E' ITALIANA. Senza il fuso, «alle 15» sarebbero le 15 di
--    Greenwich, cioe' le 17 di qui in estate: l'avviso arriverebbe due ore
--    dopo, plausibile e sbagliato. E' la famiglia gia' pagata undici volte
--    in questo progetto.
--
-- ⚠️ COSA NON CAMBIA: il lavoro che manda le notifiche gira **ogni cinque
--    minuti** (`send-due-task-reminders`), quindi il Telegram arriva
--    all'ora scelta o entro i cinque minuti dopo. Non e' un difetto da
--    correggere — e' una cosa che la schermata deve DIRE, e la dice.
-- =====================================================================

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
  -- Il promemoria che avvisa (10/09/2026)
  v_av_data  text;
  v_av_ora   text;
  v_chiesto  boolean;
  v_quando_ts timestamptz;
  v_storto   boolean := false;
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
  -- ------------------------------------------------------------------------
  -- 🔴 IL PROMEMORIA CHE AVVISA — 10/09/2026, Blocco 3 del mandato notturno
  -- ------------------------------------------------------------------------
  -- «Segna che ho appuntamento in banca sabato 13 e ricordamelo con una
  -- notifica il giorno prima alle 15» sono DUE date: il giorno dell'impegno
  -- e il giorno dell'avviso. Il gestionale sapeva scrivere solo la prima.
  --
  -- 🔴 E QUI NON SI INVENTA NIENTE. Un'ora plausibile messa al posto di
  --    un'ora detta e' indistinguibile da un'ora detta: l'avviso
  --    arriverebbe quando ha deciso il gestionale, e chi lo riceve
  --    crederebbe di averlo chiesto lui. Quindi mezzo avviso non e' un
  --    avviso: si chiede, e finche' non c'e' la risposta l'appunto **non
  --    e' approvabile**.
  --
  -- ⚠️ COME SI RENDE NON APPROVABILE, ed e' lo stesso meccanismo
  --    dell'Agenda (09/09): si cambia il TIPO in uno che nel catalogo non
  --    c'e'. `eseguibile` lo decide il catalogo, non i dati — quindi un
  --    tipo che li' non esiste nasce non approvabile **per costruzione**,
  --    senza nessun controllo da ricordare.
  if p_tipo = 'promemoria' then
    v_av_data := nullif(btrim(coalesce(v_dati->>'avviso_data', '')), '');
    v_av_ora  := nullif(btrim(coalesce(v_dati->>'avviso_ora',  '')), '');
    begin
      v_chiesto := nullif(btrim(coalesce(v_dati->>'avviso_chiesto', '')), '')::boolean;
    exception when others then
      v_chiesto := null;
    end;

    -- ⚠️ Una forma storta non e' un avviso: si BUTTA il campo invece di
    --    tenerlo. Un valore che non si sa leggere, lasciato nei dati, se lo
    --    porta dietro chi conferma domani — ed e' la stessa ragione per cui
    --    un identificativo che non punta a niente si toglie.
    if v_av_data is not null and v_av_data !~ '^\d{4}-\d{2}-\d{2}$' then
      v_dati := v_dati - 'avviso_data'; v_av_data := null; v_storto := true;
    end if;
    if v_av_ora is not null and v_av_ora !~ '^\d{1,2}:\d{2}(:\d{2})?$' then
      v_dati := v_dati - 'avviso_ora'; v_av_ora := null; v_storto := true;
    end if;
    -- L'ora si normalizza a HH:MM: «9:30» e «09:30» sono la stessa ora, e
    -- due scritture diverse dello stesso istante si leggono come due dati.
    if v_av_ora is not null then
      v_av_ora := to_char(v_av_ora::time, 'HH24:MI');
      v_dati := v_dati || jsonb_build_object('avviso_ora', v_av_ora);
    end if;

    if v_av_data is not null and v_av_ora is not null then
      -- 🔴 L'ISTANTE E' ITALIANO. Senza il fuso, «alle 15» diventerebbe le
      --    15 di Greenwich, cioe' le 17 di qui in estate: l'avviso
      --    arriverebbe due ore dopo, e nessun errore lo direbbe.
      v_quando_ts := (v_av_data || ' ' || v_av_ora)::timestamp at time zone 'Europe/Rome';
      if v_quando_ts <= now() then
        -- ⚠️ Un avviso per un momento gia' passato non e' un avviso: il
        --    lavoro che li manda guarda avanti, quindi non partirebbe mai e
        --    l'impegno resterebbe li' a dichiarare una notifica che non
        --    arrivera'. Si rifiuta **prima di scrivere**, dicendo quando.
        v_tipo_new := 'promemoria_quando_avvisare';
        v_dest_new := 'Quando ti avviso?';
        v_manca := 'Mi hai chiesto di avvisarti il ' ||
          to_char(v_quando_ts at time zone 'Europe/Rome', 'DD/MM/YYYY') || ' alle ' ||
          to_char(v_quando_ts at time zone 'Europe/Rome', 'HH24:MI') ||
          ', che è già passato: una notifica per un momento passato non parte mai. ' ||
          'Ridimmi quando vuoi che ti avvisi.';
      end if;
    elsif v_av_data is not null or v_av_ora is not null or v_chiesto is true or v_storto then
      -- Mezzo avviso, oppure un avviso chiesto senza dire quando.
      v_tipo_new := 'promemoria_quando_avvisare';
      v_dest_new := 'Quando ti avviso?';
      v_manca := 'Vuoi che ti avvisi, ma non ho capito ' ||
        case
          when v_av_data is null and v_av_ora is null then 'ne'' in che giorno ne'' a che ora'
          when v_av_data is null then 'in che giorno (l''ora l''ho capita: ' || v_av_ora || ')'
          else 'a che ora (il giorno l''ho capito: ' ||
               to_char(v_av_data::date, 'DD/MM/YYYY') || ')'
        end ||
        '. Ridimmelo dicendo giorno e ora, oppure ridillo senza notifica e l''impegno nasce lo stesso.';
    end if;
    -- ⚠️ Fuori da qui `avviso_chiesto` non serve piu': ha fatto il suo
    --    lavoro (distinguere «non voleva un avviso» da «lo voleva e non ha
    --    detto quando») e non e' una cosa che si scrive da nessuna parte.
    v_dati := v_dati - 'avviso_chiesto';
    return jsonb_build_object('dati', v_dati, 'manca', v_manca,
                              'tipo', v_tipo_new, 'destinazione', v_dest_new);
  end if;
  return jsonb_build_object('dati', v_dati, 'manca', v_manca);
end $function$;

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
  v_task   tasks%rowtype;
  v_prima  date;
  v_nuova  date;
  -- Il promemoria che avvisa (10/09/2026)
  v_av_data date;
  v_av_ora  time;
  v_avviso  timestamptz;
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
      -- 🔴 L'AVVISO SI RICONTROLLA ADESSO, NON QUANDO L'APPUNTO E' NATO —
      --    10/09/2026. Fra il momento in cui MEMO propone e il momento in
      --    cui Alessio preme «Approva» possono passare ore, e un appunto
      --    lasciato aperto la sera si approva la mattina dopo: un avviso
      --    che allora era futuro adesso puo' essere passato. Il controllo
      --    fatto solo al momento della proposta lascerebbe scrivere un
      --    promemoria che **non arrivera' mai**, e nessun errore lo
      --    direbbe.
      v_av_data := nullif(btrim(coalesce(p_dati->>'avviso_data', '')), '')::date;
      v_av_ora  := nullif(btrim(coalesce(p_dati->>'avviso_ora',  '')), '')::time;

      -- ⚠️ Mezzo avviso non e' un avviso, e qui si rifiuta invece di
      --    scriverne meta': un giorno senza ora non dice quando, e un'ora
      --    senza giorno non dice quale.
      if (v_av_data is null) <> (v_av_ora is null) then
        raise exception 'Per avvisarti mi servono tutt''e due: il giorno e l''ora. Ridimmelo, oppure ridillo senza notifica.';
      end if;

      if v_av_data is not null then
        -- 🔴 ITALIANO, non Greenwich: «alle 15» sono le 15 di qui.
        v_avviso := (v_av_data + v_av_ora) at time zone 'Europe/Rome';
        if v_avviso <= now() then
          raise exception 'L''avviso del % alle % è già passato: non ho scritto niente. Ridimmi quando vuoi che ti avvisi.',
            to_char(v_av_data, 'DD/MM/YYYY'), to_char(v_av_ora, 'HH24:MI');
        end if;
      end if;

      insert into tasks (title, description, due_date, priority, status, category,
                         origine_modulo, remind_at)
      values (
        left(coalesce(nullif(p_dati->>'titolo', ''), 'Promemoria dettato'), 200),
        nullif(p_dati->>'descrizione', ''),
        nullif(p_dati->>'data', '')::date,
        coalesce(nullif(p_dati->>'priorita', ''), 'media')::task_priority,
        'da_fare'::task_status,
        coalesce(nullif(p_dati->>'categoria', ''), 'altro'),
        'voce',
        v_avviso)
      returning id into v_id;
      -- ⚠️ L'avviso torna nella risposta: chi ha approvato deve poter
      --    leggere che cosa e' stato scritto davvero, non fidarsi di quello
      --    che l'appunto prometteva.
      return jsonb_build_object('task_id', v_id, 'avviso', v_avviso);

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

    -- =====================================================================
    -- L'AGENDA, FASE 2 — chiudere e spostare un impegno che esiste già
    -- =====================================================================
    -- 🔴 QUI SI ARRIVA SOLO DOPO CHE ALESSIO HA APPROVATO L'APPUNTO. La
    --    frase detta non scrive niente: fra la voce e queste righe c'è
    --    sempre un «sì» premuto guardando il titolo dell'impegno.
    --
    -- 🔴 E FRA LA PROPOSTA E IL «SI'» PUO' ESSERE CAMBIATO TUTTO. L'appunto
    --    non scade mai, quindi possono passare giorni: l'impegno può essere
    --    stato chiuso da qualcun altro, tolto, o spostato a un'altra data.
    --    In tutti e tre i casi ci si FERMA senza toccare niente e si dice
    --    perché — sovrascrivere sarebbe eseguire una firma data su un fatto
    --    che non è più vero.

    when 'agenda_da_segnare_fatto' then
      if nullif(p_dati->>'task_id', '') is null then
        raise exception 'Non so quale impegno segnare come fatto: aprilo in Agenda e toccalo lì.';
      end if;
      select * into v_task from tasks t where t.id = (p_dati->>'task_id')::uuid;
      if v_task.id is null then
        raise exception 'Quell''impegno non c''è più in Agenda: è stato tolto dopo che te l''avevo proposto. Non ho toccato niente.';
      end if;
      if v_task.status = 'completato' then
        raise exception 'L''impegno «%» risulta già fatto: qualcuno l''ha chiuso dopo che te l''avevo proposto. Non ho toccato niente.', v_task.title;
      end if;
      -- 🔴 E IL NOME DEV'ESSERE ANCORA QUELLO CHE L'APPUNTO MOSTRAVA: se
      --    qualcuno ha rinominato la riga, quello che si sta per chiudere
      --    non è più la cosa che si è letta prima di firmare.
      if v_task.title is distinct from nullif(p_dati->>'titolo', '') then
        raise exception 'Quell''impegno adesso si chiama «%», non «%» come diceva l''appunto: è stato rinominato dopo. Non ho toccato niente.',
          v_task.title, coalesce(nullif(p_dati->>'titolo', ''), '(senza nome)');
      end if;
      -- ⚠️ SI RIUSA `completa_task`, che è il gesto dell'Agenda: chiude
      --    l'impegno **e fa nascere il ricorrente successivo**. Scrivere qui
      --    un `update` sarebbe la seconda definizione di «segnare fatto», e
      --    la prima volta che qualcuno chiude a voce un adempimento annuale
      --    quello sparirebbe invece di ripresentarsi l'anno dopo.
      return jsonb_build_object(
        'task_id',         v_task.id,
        'titolo',          v_task.title,
        'ricorrente_nato', completa_task(v_task.id));

    when 'agenda_da_spostare' then
      if nullif(p_dati->>'task_id', '') is null then
        raise exception 'Non so quale impegno spostare: aprilo in Agenda e cambiagli la data lì.';
      end if;
      v_nuova := nullif(p_dati->>'data_nuova', '')::date;
      if v_nuova is null then
        raise exception 'Non so a quando spostarlo: senza il giorno nuovo non tocco la scadenza.';
      end if;
      select * into v_task from tasks t where t.id = (p_dati->>'task_id')::uuid;
      if v_task.id is null then
        raise exception 'Quell''impegno non c''è più in Agenda: è stato tolto dopo che te l''avevo proposto. Non ho toccato niente.';
      end if;
      if v_task.status = 'completato' then
        raise exception 'L''impegno «%» risulta già fatto: spostarlo adesso lo rimetterebbe in mezzo alle cose da fare. Non ho toccato niente.', v_task.title;
      end if;
      if v_task.title is distinct from nullif(p_dati->>'titolo', '') then
        raise exception 'Quell''impegno adesso si chiama «%», non «%» come diceva l''appunto: è stato rinominato dopo. Non ho toccato niente.',
          v_task.title, coalesce(nullif(p_dati->>'titolo', ''), '(senza nome)');
      end if;
      -- 🔴 E SI CONTROLLA CHE LA DATA DI PARTENZA SIA ANCORA QUELLA CHE
      --    L'APPUNTO MOSTRAVA. «Approva» è una firma su una frase precisa —
      --    «dal 5 al 11» — e se nel frattempo qualcuno l'ha portato al 20,
      --    scrivere l'11 sarebbe eseguire una decisione che nessuno ha
      --    preso. Ci si ferma e si dicono tutti e tre i giorni.
      v_prima := nullif(p_dati->>'data_precedente', '')::date;
      if v_task.due_date is distinct from v_prima then
        raise exception 'L''impegno «%» adesso è %, non % come diceva l''appunto: qualcuno l''ha spostato dopo. Non l''ho portato al %.',
          v_task.title,
          coalesce(to_char(v_task.due_date, 'DD/MM/YYYY'), 'senza data'),
          coalesce(to_char(v_prima, 'DD/MM/YYYY'), 'senza data'),
          to_char(v_nuova, 'DD/MM/YYYY');
      end if;

      -- ⚠️ UNA TABELLA SOLA e nessuna conseguenza altrove: qui il Contratto
      --    non chiede il corridoio, ed è lo stesso `update` che fa il
      --    pulsante «rimanda» dell'Agenda (`spostaTask`).
      update tasks set due_date = v_nuova where id = v_task.id;
      return jsonb_build_object(
        'task_id',         v_task.id,
        'titolo',          v_task.title,
        'data_precedente', v_task.due_date,
        'data_nuova',      v_nuova);

    else
      raise exception 'Questa cosa il gestionale non la sa ancora fare a voce (%). Si fa a mano come sempre.', p_tipo;
  end case;
end $function$;
-- ⚠️ Nessun `grant`: tutt'e due si chiamano solo da dentro altre funzioni
--    del gestionale (misurato — nessun ruolo le poteva eseguire prima, e
--    nessuno le puo' eseguire adesso). Il `revoke` resta scritto perche'
--    la regola non dipenda dal fatto che `create or replace` conservi i
--    permessi: un giorno qualcuno potrebbe rifarle con `drop` + `create`,
--    e li' i permessi tornano aperti al mondo (trappola del 13/08).
revoke all on function voce_risolvi_dati(text, jsonb) from public, anon, authenticated;
revoke all on function fai_azione_dettata(text, jsonb) from public, anon, authenticated;

-- rete-guardie: fai_azione_dettata — niente si perde: il ramo del promemoria guadagna due rifiuti (mezzo avviso, avviso gia' passato) e una colonna scritta in piu'. La dichiarazione c'e' perche' la risposta del ramo cambia forma, e chi legge il registro deve vederlo.

-- =====================================================================
-- VERIFICA
-- =====================================================================
-- ⚠️ Le date si costruiscono RELATIVE A OGGI, mai fisse: una verifica che
--    dice «il 13/09/2026 e' nel futuro» diventa falsa il 14, e da li' in
--    avanti fallirebbe per il calendario invece che per un difetto.
-- ⚠️ E il fuso NON si conta a mano: si chiede a Postgres se l'istante
--    scritto, riletto in ora italiana, e' esattamente il giorno e l'ora che
--    si erano detti. Cosi' la verifica regge anche al cambio dell'ora.
do $verifica$
declare
  v_foto   jsonb := foto_righe();
  v_lap0   integer;
  v_lap1   integer;
  v_miei   uuid[] := '{}';
  v_id     uuid;
  v_r      jsonb;
  v_dom    date;
  v_ieri   date;
  v_task   tasks%rowtype;
  v_preso  boolean;
  v_n      integer;
begin
  select count(*) into v_lap0 from deleted_records;
  v_dom  := (now() at time zone 'Europe/Rome')::date + 30;
  v_ieri := (now() at time zone 'Europe/Rome')::date - 1;

  -- -------------------------------------------------------------------
  -- 1. IL TIPO CHE CHIEDE NON E' NEL CATALOGO
  -- -------------------------------------------------------------------
  -- E' la proprieta' su cui poggia tutto il resto: se un giorno qualcuno
  -- lo aggiungesse, l'appunto diventerebbe approvabile e chi preme
  -- riceverebbe un rifiuto per una cosa che la schermata gli aveva offerto.
  if exists (select 1 from tipi_azione_vocale t
              where t.tipo = 'promemoria_quando_avvisare' and t.eseguibile) then
    raise exception 'VERIFICA: «promemoria_quando_avvisare» risulta eseguibile nel catalogo.';
  end if;

  -- -------------------------------------------------------------------
  -- 2. SENZA AVVISO NON MANCA NIENTE, ed e' il caso normale
  -- -------------------------------------------------------------------
  v_r := voce_risolvi_dati('promemoria', jsonb_build_object(
           'titolo', 'VERIFICA-10SET banca', 'data', v_dom::text,
           'avviso_chiesto', false));
  if nullif(v_r->>'manca', '') is not null then
    raise exception 'VERIFICA: un promemoria senza avviso dice che manca qualcosa (%).', v_r->>'manca';
  end if;
  if nullif(v_r->>'tipo', '') is not null then
    raise exception 'VERIFICA: un promemoria senza avviso ha cambiato tipo in %.', v_r->>'tipo';
  end if;

  v_r := fai_azione_dettata('promemoria', v_r->'dati');
  v_id := (v_r->>'task_id')::uuid;
  v_miei := v_miei || v_id;
  select * into v_task from tasks where id = v_id;
  if v_task.remind_at is not null then
    raise exception 'VERIFICA: un promemoria senza avviso ha scritto un avviso (%).', v_task.remind_at;
  end if;

  -- -------------------------------------------------------------------
  -- 3. GIORNO E ORA DETTI: L'ISTANTE SCRITTO E' QUELLO ITALIANO
  -- -------------------------------------------------------------------
  v_r := voce_risolvi_dati('promemoria', jsonb_build_object(
           'titolo', 'VERIFICA-10SET banca con avviso', 'data', (v_dom + 1)::text,
           'avviso_data', v_dom::text, 'avviso_ora', '15:00',
           'avviso_chiesto', true));
  if nullif(v_r->>'manca', '') is not null then
    raise exception 'VERIFICA: un avviso completo e futuro dice che manca qualcosa (%).', v_r->>'manca';
  end if;
  -- ⚠️ `avviso_chiesto` ha fatto il suo lavoro e non deve restare fra i
  --    dati: e' una dichiarazione su cosa ha chiesto, non una cosa da
  --    scrivere, e mostrarla fra i dati concreti direbbe a chi firma che
  --    sta autorizzando anche quella.
  if v_r->'dati' ? 'avviso_chiesto' then
    raise exception 'VERIFICA: «avviso_chiesto» e'' rimasto fra i dati dell''appunto.';
  end if;

  v_r := fai_azione_dettata('promemoria', v_r->'dati');
  v_id := (v_r->>'task_id')::uuid;
  v_miei := v_miei || v_id;
  select * into v_task from tasks where id = v_id;
  if v_task.remind_at is null then
    raise exception 'VERIFICA: l''avviso non e'' stato scritto.';
  end if;
  if (v_task.remind_at at time zone 'Europe/Rome')::date is distinct from v_dom then
    raise exception 'VERIFICA: l''avviso e'' finito il %, non il %.',
      (v_task.remind_at at time zone 'Europe/Rome')::date, v_dom;
  end if;
  if to_char(v_task.remind_at at time zone 'Europe/Rome', 'HH24:MI') <> '15:00' then
    raise exception 'VERIFICA: l''avviso e'' alle % invece che alle 15:00 (ora italiana).',
      to_char(v_task.remind_at at time zone 'Europe/Rome', 'HH24:MI');
  end if;
  -- Il giorno dell'impegno e il giorno dell'avviso restano due cose diverse.
  if v_task.due_date is distinct from v_dom + 1 then
    raise exception 'VERIFICA: il giorno dell''impegno e'' %, doveva essere %.',
      coalesce(v_task.due_date::text, 'vuoto'), (v_dom + 1)::text;
  end if;
  -- E il promemoria non risulta gia' mandato, o non partirebbe.
  if v_task.reminder_sent_at is not null then
    raise exception 'VERIFICA: il promemoria nasce gia'' segnato come inviato.';
  end if;

  -- -------------------------------------------------------------------
  -- 4. MEZZO AVVISO NON E' UN AVVISO: SI CHIEDE, E NON SI APPROVA
  -- -------------------------------------------------------------------
  v_r := voce_risolvi_dati('promemoria', jsonb_build_object(
           'titolo', 'VERIFICA-10SET solo giorno', 'avviso_data', v_dom::text));
  if v_r->>'tipo' is distinct from 'promemoria_quando_avvisare' then
    raise exception 'VERIFICA: un avviso senza ora resta approvabile (tipo %).',
      coalesce(v_r->>'tipo', 'invariato');
  end if;
  if v_r->>'manca' not like '%a che ora%' then
    raise exception 'VERIFICA: la frase non dice che manca l''ora: %', v_r->>'manca';
  end if;

  v_r := voce_risolvi_dati('promemoria', jsonb_build_object(
           'titolo', 'VERIFICA-10SET solo ora', 'avviso_ora', '15:00'));
  if v_r->>'tipo' is distinct from 'promemoria_quando_avvisare' then
    raise exception 'VERIFICA: un avviso senza giorno resta approvabile.';
  end if;
  if v_r->>'manca' not like '%in che giorno%' then
    raise exception 'VERIFICA: la frase non dice che manca il giorno: %', v_r->>'manca';
  end if;

  -- 🔴 E IL CASO CHE SENZA `avviso_chiesto` NON SI DISTINGUEREBBE: ha
  --    chiesto un avviso e non ha detto quando. Senza quel campo sarebbe
  --    identico a «non voleva nessun avviso», e la sua richiesta cadrebbe
  --    in silenzio.
  v_r := voce_risolvi_dati('promemoria', jsonb_build_object(
           'titolo', 'VERIFICA-10SET ricordamelo', 'avviso_chiesto', true));
  if v_r->>'tipo' is distinct from 'promemoria_quando_avvisare' then
    raise exception 'VERIFICA: «ricordamelo» senza quando resta approvabile.';
  end if;

  -- -------------------------------------------------------------------
  -- 5. UN AVVISO GIA' PASSATO SI RIFIUTA, E DICE QUANDO
  -- -------------------------------------------------------------------
  v_r := voce_risolvi_dati('promemoria', jsonb_build_object(
           'titolo', 'VERIFICA-10SET passato', 'avviso_data', v_ieri::text,
           'avviso_ora', '15:00', 'avviso_chiesto', true));
  if v_r->>'tipo' is distinct from 'promemoria_quando_avvisare' then
    raise exception 'VERIFICA: un avviso gia'' passato resta approvabile.';
  end if;
  if v_r->>'manca' not like '%già passato%' then
    raise exception 'VERIFICA: la frase non dice che è già passato: %', v_r->>'manca';
  end if;

  -- -------------------------------------------------------------------
  -- 6. E IL CONTROLLO SI RIFA' AL MOMENTO DI «APPROVA»
  -- -------------------------------------------------------------------
  -- 🔴 E' il caso vero: l'appunto e' nato ieri sera quando l'avviso era
  --    futuro, e si approva stamattina. I dati arrivano diretti, senza
  --    ripassare da `voce_risolvi_dati`.
  v_preso := false;
  begin
    perform fai_azione_dettata('promemoria', jsonb_build_object(
      'titolo', 'VERIFICA-10SET approvato tardi',
      'avviso_data', v_ieri::text, 'avviso_ora', '15:00'));
  exception when others then v_preso := true;
  end;
  if not v_preso then
    raise exception 'VERIFICA: approvando piu'' tardi, un avviso passato e'' stato scritto.';
  end if;
  select count(*) into v_n from tasks where title = 'VERIFICA-10SET approvato tardi';
  if v_n <> 0 then
    raise exception 'VERIFICA: il rifiuto ha lasciato % impegni scritti.', v_n;
  end if;

  -- E mezzo avviso si rifiuta anche li'.
  v_preso := false;
  begin
    perform fai_azione_dettata('promemoria', jsonb_build_object(
      'titolo', 'VERIFICA-10SET meta avviso', 'avviso_data', v_dom::text));
  exception when others then v_preso := true;
  end;
  if not v_preso then
    raise exception 'VERIFICA: mezzo avviso e'' stato scritto lo stesso.';
  end if;

  -- -------------------------------------------------------------------
  -- 7. UN'ORA SCRITTA IN DUE MODI E' LA STESSA ORA
  -- -------------------------------------------------------------------
  -- «9:30» e «09:30» sono lo stesso istante: due scritture diverse dello
  -- stesso dato si leggono come due dati.
  v_r := voce_risolvi_dati('promemoria', jsonb_build_object(
           'titolo', 'VERIFICA-10SET nove e mezza', 'avviso_data', v_dom::text,
           'avviso_ora', '9:30', 'avviso_chiesto', true));
  if v_r->'dati'->>'avviso_ora' <> '09:30' then
    raise exception 'VERIFICA: «9:30» non e'' diventato «09:30» (e'' %).', v_r->'dati'->>'avviso_ora';
  end if;

  -- E una forma che non si sa leggere si BUTTA invece di restare nei dati.
  v_r := voce_risolvi_dati('promemoria', jsonb_build_object(
           'titolo', 'VERIFICA-10SET ora storta', 'avviso_data', v_dom::text,
           'avviso_ora', 'verso sera', 'avviso_chiesto', true));
  if v_r->'dati' ? 'avviso_ora' then
    raise exception 'VERIFICA: un''ora illeggibile e'' rimasta nei dati.';
  end if;
  if v_r->>'tipo' is distinct from 'promemoria_quando_avvisare' then
    raise exception 'VERIFICA: un''ora illeggibile lascia l''appunto approvabile.';
  end if;

  -- -------------------------------------------------------------------
  -- Si ripulisce: solo cio' che questa verifica ha creato
  -- -------------------------------------------------------------------
  delete from tasks where id = any(v_miei);
  select count(*) into v_n from tasks where title like 'VERIFICA-10SET%';
  if v_n <> 0 then
    raise exception 'VERIFICA: sono rimasti % impegni di prova.', v_n;
  end if;

  select count(*) into v_lap1 from deleted_records;
  if v_lap1 <> v_lap0 then
    raise exception 'VERIFICA: il registro delle cancellazioni e'' passato da % a %.', v_lap0, v_lap1;
  end if;
  perform pretendi_nessun_residuo(v_foto, 'la verifica del promemoria che avvisa');

  raise notice 'Un promemoria puo'' avvisare: giorno e ora italiani, mezzo avviso si chiede, un avviso passato si rifiuta due volte.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260910000002', 'un_promemoria_puo_avvisare') on conflict (version) do nothing;
