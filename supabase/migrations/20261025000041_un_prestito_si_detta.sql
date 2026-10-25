-- =====================================================================
-- UN PRESTITO SI DETTA
-- 25/10/2026 — richiesta di Alessio: «segna che Roberto mi ha prestato
-- 100 € in contanti» deve finire in Cassa → Prestiti, dopo il suo sì.
-- =====================================================================
-- Fino a oggi MEMO non aveva un tipo per i prestiti. Una frase cosi'
-- diventava un movimento di cassa in entrata, e la causale di sistema
-- «Prestito ricevuto» era nel catalogo della voce come tutte le altre:
-- presa a voce, avrebbe messo i soldi in cassa SENZA la riga in Cassa →
-- Prestiti. Nessun errore, e un prestito che nessuno avrebbe mai
-- restituito perche' non compare nell'elenco dei prestiti aperti.
--
-- Cosa cambia:
--   1. due tipi nuovi nel catalogo: `prestito_ricevuto` e
--      `prestito_restituito`, tutti e due dietro l'occhio (natura
--      «creazione»);
--   2. `voce_risolvi_dati` dice cosa manca PRIMA del sì: chi, quanto,
--      contanti o banca; per la restituzione trova QUALE prestito, e se
--      sono zero o piu' d'uno non sceglie;
--   3. `fai_azione_dettata` chiama le STESSE due funzioni della schermata
--      (`registra_prestito_privato`, `registra_restituzione_prestito`):
--      nessuna seconda strada che scriva le righe da se';
--   4. un movimento di cassa dettato non puo' prendere una causale di
--      sistema, ne' nell'anteprima ne' al momento di scrivere.
--
-- 🔴 I CORPI VENGONO DALLE ULTIME MIGRAZIONI CHE LI TOCCANO
--    (20260911000002 per `voce_risolvi_dati`, 20261011000002 per
--    `fai_azione_dettata`): da questo contenitore il database non si
--    raggiunge. Prima di sostituirli si pretende che il corpo vivo sia
--    quello atteso, e ci si ferma se qualcuno li ha toccati dopo.
-- =====================================================================

do $prima$
declare
  v_def    text;
  v_rami   text[];
  v_attesi text[] := array['agenda_da_segnare_fatto', 'agenda_da_spostare', 'carico_merce',
    'giacenza', 'lista_spesa', 'merce_buttata', 'movimento_cassa', 'nota_non_capita',
    'preparazione_da_fare', 'prodotto_nuovo', 'promemoria', 'pulizia', 'ricetta',
    'spesa_da_collocare', 'spesa_spicciola', 'spesa_tasca', 'temperatura'];
begin
  v_def := pg_get_functiondef('fai_azione_dettata(text, jsonb)'::regprocedure);
  select array_agg(distinct r[1] order by r[1]) into v_rami
    from regexp_matches(v_def, E'\\n    when ''([a-z_]+)'' then', 'g') as m(r);
  v_rami := array_remove(array_remove(v_rami, 'prestito_ricevuto'), 'prestito_restituito');
  if v_rami is distinct from v_attesi then
    raise exception 'fai_azione_dettata nel database ha i rami % e questa migrazione si aspettava %: e'' stata toccata dopo il 11/10. Guarda il corpo vivo prima di sostituirlo.', v_rami, v_attesi;
  end if;

  v_def := pg_get_functiondef('voce_risolvi_dati(text, jsonb)'::regprocedure);
  if v_def not like '%v_dati := v_dati - ''avviso_chiesto'';%'
     or v_def not like '%Ci sono piu'''' conti correnti: dimmi da quale sono passati.%' then
    raise exception 'voce_risolvi_dati nel database non e'' quella del 11/09: guarda il corpo vivo prima di sostituirlo.';
  end if;
end $prima$;

-- ---------------------------------------------------------------------
-- 1. I DUE TIPI
-- ---------------------------------------------------------------------
insert into tipi_azione_vocale (tipo, natura, titolo, spiega, attivo, additivo, eseguibile)
values
  ('prestito_ricevuto', 'creazione', 'Prestito ricevuto',
   'Soldi prestati da qualcuno. Vanno in Cassa → Prestiti, non fra gli incassi: e quando li restituisci non sono un costo.',
   true, false, true),
  ('prestito_restituito', 'creazione', 'Restituzione di un prestito',
   'Soldi restituiti a chi te li aveva prestati. Escono dallo stesso posto da cui erano entrati, e non sono un costo.',
   true, false, true)
on conflict (tipo) do update
   set natura     = excluded.natura,
       titolo     = excluded.titolo,
       spiega     = excluded.spiega,
       attivo     = excluded.attivo,
       additivo   = excluded.additivo,
       eseguibile = excluded.eseguibile;

-- ---------------------------------------------------------------------
-- 2. COSA MANCA, PRIMA DEL SI'
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.voce_risolvi_dati(p_tipo text, p_dati jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  -- L'ora dell'impegno (11/09/2026)
  v_ora text;
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

    -- 🔴 L'ORA DELL'IMPEGNO — 11/09/2026, decisione di Alessio: *«aggiungi
    --    l'ora al vero campo Ora dell'Agenda quando è stata detta e capita
    --    con sicurezza»*. Si normalizza a HH:MM come quella dell'avviso.
    -- ⚠️ UN'ORA CHE NON SI LEGGE NON SI SCRIVE, E NON SI BUTTA: resta nei
    --    dati come «ora non capita», cosi' chi firma vede che l'impegno
    --    nascera' senza ora e perche'. L'impegno resta approvabile: un'ora
    --    e' facoltativa, e fermare tutto per un'ora mancata toglierebbe il
    --    giorno, che invece e' stato capito.
    v_ora := nullif(btrim(coalesce(v_dati->>'ora', '')), '');
    if v_ora is not null then
      begin
        -- ⚠️ ORE 00-23 E MINUTI 00-59, SCRITTI (revisione del diff, 11/09):
        --    «24:00» ha la forma di un'ora e PostgreSQL la accetta come
        --    `time`, ma non è l'ora di un impegno.
        if v_ora !~ '^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$' then
          raise exception 'ora storta';
        end if;
        v_dati := v_dati || jsonb_build_object('ora', to_char(v_ora::time, 'HH24:MI'));
      exception when others then
        v_dati := (v_dati - 'ora') || jsonb_build_object('ora_non_capita', v_ora);
      end;
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
  -- ------------------------------------------------------------------------
  -- 🔴 I PRESTITI (25/10/2026)
  -- ------------------------------------------------------------------------
  -- «Roberto mi ha prestato 100 € in contanti». Non e' un incasso: va in
  -- Cassa → Prestiti, con la sua causale di sistema, ed e' l'unico modo in
  -- cui quei soldi restano fuori dai ricavi e la restituzione fuori dai costi.
  if p_tipo in ('prestito_ricevuto', 'prestito_restituito') then
    if nullif(btrim(coalesce(v_dati->>'da_chi', '')), '') is null then
      v_manca := coalesce(v_manca,
        case when p_tipo = 'prestito_ricevuto'
             then 'Non ho capito chi ti ha prestato i soldi.'
             else 'Non ho capito a chi hai restituito i soldi.' end);
    end if;
    if coalesce(nullif(v_dati->>'importo', '')::numeric, 0) <= 0 then
      v_manca := coalesce(v_manca, 'Non ho capito di quanti soldi si tratta.');
    end if;
  end if;

  if p_tipo = 'prestito_ricevuto' then
    -- ⚠️ IL MEZZO NON SI INDOVINA: un prestito entrato in banca e registrato
    --    in cassa fa sbagliare il cassetto la sera stessa, e la restituzione
    --    poi deve uscire dallo stesso posto.
    if nullif(v_dati->>'mezzo', '') is null or v_dati->>'mezzo' not in ('cassa', 'banca') then
      v_manca := coalesce(v_manca,
        'Non ho capito se i soldi sono arrivati in contanti o in banca.');
    elsif v_dati->>'mezzo' = 'banca' and not exists (select 1 from conti_bancari where attivo) then
      v_manca := coalesce(v_manca,
        'I soldi sono arrivati in banca, ma i Conti correnti non sono ancora stati inseriti: aggiungine uno da Cassa, poi ridimmelo.');
    end if;
  end if;

  if p_tipo = 'prestito_restituito' and nullif(btrim(coalesce(v_dati->>'da_chi', '')), '') is not null then
    -- 🔴 QUALE PRESTITO: si cerca qui, come per gli impegni dell'Agenda. Se
    --    quelli aperti con quel nome non sono esattamente uno, non sceglie
    --    nessuno e lo dice.
    v_cercato := lower(btrim(v_dati->>'da_chi'));
    select count(*) into v_quanti
      from prestiti_privati p
     where lower(btrim(p.da_chi)) like '%' || v_cercato || '%'
       and p.importo > coalesce((select sum(x.importo) from restituzioni_prestito x where x.prestito_id = p.id), 0);
    if v_quanti = 0 then
      v_manca := coalesce(v_manca,
        'Non trovo nessun prestito ancora da restituire a «' || btrim(v_dati->>'da_chi') || '». Guarda in Cassa → Prestiti.');
    elsif v_quanti > 1 then
      v_manca := coalesce(v_manca,
        'Ci sono ' || v_quanti || ' prestiti aperti con il nome «' || btrim(v_dati->>'da_chi') || '»: la restituzione registrala da Cassa → Prestiti, scegliendo quello giusto.');
    else
      select p.id, p.mezzo into v_id, v_verso
        from prestiti_privati p
       where lower(btrim(p.da_chi)) like '%' || v_cercato || '%'
         and p.importo > coalesce((select sum(x.importo) from restituzioni_prestito x where x.prestito_id = p.id), 0);
      -- ⚠️ Si restituisce dallo stesso posto da cui e' entrato (lo impone il
      --    database): se non l'ha detto, si mette quello; se ha detto
      --    l'altro, si avvisa adesso invece che al momento del sì.
      if nullif(v_dati->>'mezzo', '') is null then
        v_dati := v_dati || jsonb_build_object('mezzo', v_verso);
      elsif v_dati->>'mezzo' is distinct from v_verso then
        v_manca := coalesce(v_manca,
          'Questo prestito era entrato in ' || v_verso || ': va restituito da li''. Ridimmelo.');
      end if;
      v_dati := v_dati || jsonb_build_object('prestito_id', v_id);
    end if;
  end if;

  -- 🔴 E UN MOVIMENTO DI CASSA NON PRENDE UNA CAUSALE DI SISTEMA. Le mette il
  --    gestionale da se' (prestiti, caparre, versamenti, differenze): presa a
  --    voce su un movimento qualunque, un prestito risulterebbe in cassa ma
  --    non in Cassa → Prestiti, e nessuno lo restituirebbe mai.
  if p_tipo = 'movimento_cassa' and nullif(v_dati->>'causale_id', '') is not null
     and exists (select 1 from cash_causali c
                  where c.id = (v_dati->>'causale_id')::uuid and c.di_sistema) then
    v_manca := coalesce(v_manca,
      'La causale «' || (select label from cash_causali where id = (v_dati->>'causale_id')::uuid) ||
      '» la mette il gestionale da se''. Se e'' un prestito, dimmi «mi ha prestato…» e lo registro in Cassa → Prestiti.');
    v_dati := v_dati - 'causale_id';
  end if;

  return jsonb_build_object('dati', v_dati, 'manca', v_manca);
end $function$;

revoke all on function voce_risolvi_dati(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. LO SCRIVE, CON LE FUNZIONI DELLA SCHERMATA
-- ---------------------------------------------------------------------
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
  -- L'ora dell'impegno (11/09/2026)
  v_ora_imp text;
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
      -- ⚠️ CHI SCRIVE NON SI FIDA DI CHI CHIAMA — 10/09/2026.
      --    Questi due rifiuti NON sono la rete che protegge l'app: dalla
      --    porta vera ci si arriva passando da `approva_appunto`, che
      --    rigira `voce_risolvi_dati` al momento della firma e si ferma
      --    prima, sul suo «manca». **Misurato rompendo**: spegnendo i due
      --    rifiuti qui sotto, tutte e 552 le prove contro il progetto di
      --    prova restano verdi.
      --    ⚠️ Si tengono lo stesso, e la ragione e' la stessa per cui in
      --    questo progetto gli invarianti stanno nel database e non nelle
      --    schermate: qui si SCRIVE, e chi scrive non deve dipendere dal
      --    fatto che qualcun altro abbia guardato. Il giorno che
      --    `fai_azione_dettata` verra' chiamata da un'altra porta, la riga
      --    c'e' gia'.
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

      -- ⚠️ L'ORA DELL'IMPEGNO (11/09/2026): chi scrive non si fida di chi
      --    chiama, come per l'avviso. Un'ora che non ha la forma di un'ora
      --    si rifiuta qui, prima di scrivere, invece di finire in un campo.
      v_ora_imp := nullif(btrim(coalesce(p_dati->>'ora', '')), '');
      -- ⚠️ Ore 00-23, minuti 00-59: «24:00» si rifiuta (revisione, 11/09).
      if v_ora_imp is not null and v_ora_imp !~ '^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$' then
        raise exception 'L''ora «%» non la so leggere: non ho scritto niente.', v_ora_imp;
      end if;

      insert into tasks (title, description, due_date, priority, status, category,
                         origine_modulo, remind_at, due_time)
      values (
        left(coalesce(nullif(p_dati->>'titolo', ''), 'Promemoria dettato'), 200),
        nullif(p_dati->>'descrizione', ''),
        nullif(p_dati->>'data', '')::date,
        coalesce(nullif(p_dati->>'priorita', ''), 'media')::task_priority,
        'da_fare'::task_status,
        coalesce(nullif(p_dati->>'categoria', ''), 'altro'),
        'voce',
        v_avviso,
        v_ora_imp::time)
      returning id into v_id;
      -- ⚠️ L'avviso torna nella risposta: chi ha approvato deve poter
      --    leggere che cosa e' stato scritto davvero, non fidarsi di quello
      --    che l'appunto prometteva.
      return jsonb_build_object('task_id', v_id, 'avviso', v_avviso, 'ora', v_ora_imp);

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
      -- 🔴 CHI SCRIVE NON SI FIDA DI CHI CHIAMA (25/10/2026): una causale di
      --    sistema la mette il gestionale da se'. Un prestito scritto qui come
      --    movimento qualunque sarebbe in cassa e non in Cassa → Prestiti.
      if exists (select 1 from cash_causali c
                  where c.id = nullif(p_dati->>'causale_id', '')::uuid and c.di_sistema) then
        raise exception 'Questa causale la mette il gestionale da se'': se e'' un prestito, registralo come prestito.';
      end if;
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

    when 'spesa_da_collocare' then
      -- 🔴 NON E' CONTABILITA' (11/10/2026, C12): si scrive un appunto
      --    nell'elenco «Da collocare», e niente altro. Da li' Alessio sceglie
      --    la destinazione — prima nota, tasca, anticipo, archivio — una
      --    volta sola.
      -- ⚠️ Il fornitore arriva come NUMERO del catalogo (il modello non
      --    scrive nomi): qui diventa il nome, perche' l'appunto lo mostra.
      v_pezzi := null;
      if coalesce(p_dati->>'fornitore', '') ~ '^[0-9]+$' then
        select s.name into v_pezzi from suppliers s
         where s.id = voce_fornitore_numero((p_dati->>'fornitore')::integer);
      end if;
      v_id := scrivi_spesa_da_collocare('voce',
        (p_dati - 'fornitore' - 'causale')
        || jsonb_strip_nulls(jsonb_build_object(
             'controparte', coalesce(nullif(btrim(coalesce(p_dati->>'controparte', '')), ''), v_pezzi),
             'causale_id', case when coalesce(p_dati->>'causale', '') ~ '^[0-9]+$'
                                then voce_causale_numero((p_dati->>'causale')::integer) end)));
      return jsonb_build_object('spesa_da_collocare_id', v_id);

    -- =====================================================================
    -- 🔴 I PRESTITI (25/10/2026) — passano dalle funzioni della schermata
    -- =====================================================================
    -- Non si scrive niente qui dentro: si chiamano le stesse due funzioni di
    -- Cassa → Prestiti, che mettono la causale di sistema e legano il
    -- movimento al prestito. Una seconda strada che scrivesse le righe da
    -- se' sarebbe il secondo posto che decide la stessa cosa.
    when 'prestito_ricevuto' then
      select id into v_ent from entities where entity_type = 'srls' limit 1;
      return registra_prestito_privato(
        v_ent,
        btrim(p_dati->>'da_chi'),
        (p_dati->>'importo')::numeric,
        p_dati->>'mezzo',
        coalesce(nullif(p_dati->>'data', '')::date, serata_di_servizio(now())),
        coalesce(nullif(btrim(coalesce(p_dati->>'note', '')), ''), 'Registrato a voce'));

    when 'prestito_restituito' then
      if nullif(p_dati->>'prestito_id', '') is null then
        raise exception 'Non so quale prestito stai restituendo: registralo da Cassa → Prestiti.';
      end if;
      return registra_restituzione_prestito(
        (p_dati->>'prestito_id')::uuid,
        (p_dati->>'importo')::numeric,
        p_dati->>'mezzo',
        coalesce(nullif(p_dati->>'data', '')::date, serata_di_servizio(now())),
        coalesce(nullif(btrim(coalesce(p_dati->>'note', '')), ''), 'Registrato a voce'));

    else
      raise exception 'Questa cosa il gestionale non la sa ancora fare a voce (%). Si fa a mano come sempre.', p_tipo;
  end case;
end $function$;

revoke all on function fai_azione_dettata(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione che si annulla
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_r        jsonb;
  v_p        prestiti_privati%rowtype;
  v_m        cash_movements%rowtype;
  v_cau      uuid;
  v_respinto boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles.';
  end if;

  if has_function_privilege('authenticated', 'fai_azione_dettata(text, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'voce_risolvi_dati(text, jsonb)', 'execute')
     or has_function_privilege('anon', 'fai_azione_dettata(text, jsonb)', 'execute')
     or has_function_privilege('anon', 'voce_risolvi_dati(text, jsonb)', 'execute') then
    raise exception 'VERIFICA: una porta della voce e'' aperta a chi non deve.';
  end if;
  if exists (select 1 from tipi_vocali_senza_ramo() t
              where t.tipo in ('prestito_ricevuto', 'prestito_restituito')) then
    raise exception 'VERIFICA: un tipo dei prestiti e'' nel catalogo senza un ramo che lo esegua.';
  end if;

  begin  -- <<< la sotto-transazione che verra' annullata
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- 1. Completo: niente manca.
    v_r := voce_risolvi_dati('prestito_ricevuto', jsonb_build_object(
      'da_chi', 'ZZ Roberto verifica', 'importo', 100, 'mezzo', 'cassa'));
    if v_r->>'manca' is not null then
      raise exception 'VERIFICA: un prestito completo risulta incompleto (%).', v_r->>'manca';
    end if;

    -- 2. Senza mezzo si chiede, non si indovina.
    v_r := voce_risolvi_dati('prestito_ricevuto', jsonb_build_object(
      'da_chi', 'ZZ Roberto verifica', 'importo', 100));
    if coalesce(v_r->>'manca', '') not like '%contanti o in banca%' then
      raise exception 'VERIFICA: un prestito senza mezzo non chiede da dove (%).', v_r->>'manca';
    end if;

    -- 3. Senza chi, e senza quanto.
    v_r := voce_risolvi_dati('prestito_ricevuto', jsonb_build_object('importo', 100, 'mezzo', 'cassa'));
    if coalesce(v_r->>'manca', '') not like '%chi ti ha prestato%' then
      raise exception 'VERIFICA: un prestito senza nome non lo chiede (%).', v_r->>'manca';
    end if;
    v_r := voce_risolvi_dati('prestito_ricevuto', jsonb_build_object('da_chi', 'ZZ Roberto verifica', 'mezzo', 'cassa'));
    if coalesce(v_r->>'manca', '') not like '%quanti soldi%' then
      raise exception 'VERIFICA: un prestito senza importo non lo chiede (%).', v_r->>'manca';
    end if;

    -- 4. Scritto: finisce in Cassa → Prestiti, con la causale di sistema.
    v_r := fai_azione_dettata('prestito_ricevuto', jsonb_build_object(
      'da_chi', 'ZZ Roberto verifica', 'importo', 100, 'mezzo', 'cassa'));
    select * into v_p from prestiti_privati where id = (v_r->>'prestito_id')::uuid;
    select * into v_m from cash_movements where id = (v_r->>'movimento_id')::uuid;
    select id into v_cau from cash_causali where label = 'Prestito ricevuto' and kind = 'entrata' and di_sistema;
    if v_p.id is null or v_p.importo is distinct from 100.00 or v_p.mezzo is distinct from 'cassa'
       or v_p.movimento_id is distinct from v_m.id then
      raise exception 'VERIFICA: il prestito dettato non e'' quello atteso (%).', row_to_json(v_p);
    end if;
    if v_m.causale_id is distinct from v_cau or v_m.direction is distinct from 'entrata'::cash_direction
       or v_m.mezzo is distinct from 'cassa' or v_m.prestito_id is distinct from v_p.id then
      raise exception 'VERIFICA: il movimento del prestito dettato non e'' quello atteso (%).', row_to_json(v_m);
    end if;

    -- 5. La restituzione trova QUEL prestito e ne prende il mezzo.
    v_r := voce_risolvi_dati('prestito_restituito', jsonb_build_object(
      'da_chi', 'zz roberto', 'importo', 40));
    if v_r->>'manca' is not null
       or (v_r->'dati'->>'prestito_id')::uuid is distinct from v_p.id
       or v_r->'dati'->>'mezzo' is distinct from 'cassa' then
      raise exception 'VERIFICA: la restituzione non ha trovato il prestito giusto (%).', v_r;
    end if;
    v_r := fai_azione_dettata('prestito_restituito', v_r->'dati');
    if (v_r->>'residuo')::numeric is distinct from 60.00 then
      raise exception 'VERIFICA: dopo la restituzione il residuo non e'' 60 (%).', v_r;
    end if;

    -- 6. Dal posto sbagliato si avvisa prima del si'.
    v_r := voce_risolvi_dati('prestito_restituito', jsonb_build_object(
      'da_chi', 'zz roberto', 'importo', 10, 'mezzo', 'banca'));
    if coalesce(v_r->>'manca', '') not like '%entrato in cassa%' then
      raise exception 'VERIFICA: una restituzione dalla banca di un prestito in contanti non viene fermata (%).', v_r->>'manca';
    end if;

    -- 7. Nessun prestito con quel nome: lo dice e non sceglie.
    v_r := voce_risolvi_dati('prestito_restituito', jsonb_build_object(
      'da_chi', 'ZZ nessuno verifica', 'importo', 10));
    if coalesce(v_r->>'manca', '') not like '%Non trovo nessun prestito%'
       or v_r->'dati' ? 'prestito_id' then
      raise exception 'VERIFICA: una restituzione senza prestito non viene fermata (%).', v_r;
    end if;

    -- 8. Due prestiti con lo stesso nome: non sceglie.
    perform fai_azione_dettata('prestito_ricevuto', jsonb_build_object(
      'da_chi', 'ZZ Roberto verifica bis', 'importo', 50, 'mezzo', 'cassa'));
    v_r := voce_risolvi_dati('prestito_restituito', jsonb_build_object(
      'da_chi', 'zz roberto', 'importo', 10));
    if coalesce(v_r->>'manca', '') not like '%Ci sono 2 prestiti aperti%'
       or v_r->'dati' ? 'prestito_id' then
      raise exception 'VERIFICA: con due prestiti aperti la voce ne ha scelto uno (%).', v_r;
    end if;

    -- 9. Un movimento di cassa non prende una causale di sistema.
    v_r := voce_risolvi_dati('movimento_cassa', jsonb_build_object(
      'verso', 'entrata', 'importo', 100, 'mezzo', 'cassa', 'causale_id', v_cau));
    if coalesce(v_r->>'manca', '') not like '%la mette il gestionale%'
       or v_r->'dati' ? 'causale_id' then
      raise exception 'VERIFICA: un movimento dettato ha preso una causale di sistema (%).', v_r;
    end if;
    v_respinto := false;
    begin
      perform fai_azione_dettata('movimento_cassa', jsonb_build_object(
        'verso', 'entrata', 'importo', 100, 'mezzo', 'cassa', 'causale_id', v_cau));
    exception when others then v_respinto := sqlerrm like '%la mette il gestionale%';
    end;
    if not v_respinto then
      raise exception 'VERIFICA: fai_azione_dettata ha scritto un movimento con una causale di sistema.';
    end if;

    -- 10. Il portiere: lo staff riceve un rifiuto.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_respinto := false;
    begin
      perform fai_azione_dettata('prestito_ricevuto', jsonb_build_object(
        'da_chi', 'ZZ staff verifica', 'importo', 5, 'mezzo', 'cassa'));
    exception when others then v_respinto := sqlerrm like '%titolare%';
    end;
    if not v_respinto then raise exception 'VERIFICA: lo staff ha registrato un prestito a voce.'; end if;

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dei prestiti a voce');

  raise notice 'Fatto: un prestito detto finisce in Cassa → Prestiti con la causale di sistema; la restituzione trova il prestito e ne prende il mezzo; con zero o due prestiti non sceglie; una causale di sistema non entra in un movimento qualunque; lo staff e'' respinto. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261025000041', 'un_prestito_si_detta')
on conflict (version) do nothing;
