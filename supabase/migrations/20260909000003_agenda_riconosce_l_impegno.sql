-- =====================================================================
-- L'AGENDA A VOCE — RICONOSCERE L'IMPEGNO SENZA RIPETERNE IL TITOLO
-- =====================================================================
-- 09/09/2026. Fase 2-bis: la fase 2 ha costruito i due gesti (chiudere e
-- spostare un impegno che esiste), e il collaudo col telefono ha trovato
-- che funzionavano **solo ripetendo quasi il titolo letterale**.
--
-- 🔴 IL CASO VERO, MISURATO. In Agenda c'è «Rinnovo firma digitale». La
--    frase che viene da sé — «segna come fatto il rinnovo DELLA firma
--    digitale» — non lo trovava, e rispondeva «non l'ho trovato fra quelli
--    aperti in Agenda». ⚠️ Il modo di fallire è quello che questo progetto
--    teme di più: **nessun errore, e una frase sicura di sé che dice il
--    falso**. Chi la legge va a controllare in Agenda, vede che l'impegno
--    c'è, e da quel momento non si fida più nemmeno delle volte che
--    funziona.
--
--    La colpa era del confronto: `voce_titolo_nudo` appiana maiuscole,
--    accenti e segni, ma lascia gli articoli. E «rinnovo firma digitale»
--    non è contenuto in «rinnovo della firma digitale», perché in mezzo
--    c'è una parola che non porta nessun significato.
--
-- ⚠️ COSA NON SI FA, ed è la metà che conta. Non si allarga il confronto e
--    basta: un confronto più largo trova anche cose che non c'entrano, e
--    su un gesto che CHIUDE l'impegno di qualcun altro o sposta una
--    scadenza che nessuno voleva toccare, trovare troppo è pericoloso
--    quanto non trovare niente — con l'aggravante che sbagliare non dà
--    nessun segnale.
--
--    Al suo posto una **scala**: si cerca prima nel modo più stretto, e si
--    scende di un gradino solo quando non si è trovato niente. Da qui la
--    proprietà che rende questo cambiamento sicuro: *un gradino largo non
--    può togliere una risposta che un gradino stretto aveva già dato.*
--    Quindi tutto ciò che prima si risolveva continua a risolversi
--    identico, e l'unica cosa che cambia è che dei casi che prima non
--    trovavano niente adesso trovano.
--
-- 🔴 E DOVE RESTANO IN DUE, NON SI SCEGLIE — invariato dalla fase 2, ed è
--    la riga che non si tocca. Quello che cambia è che adesso l'appunto
--    **dice quali sono**, col loro giorno: prima diceva «quale dei 2» e
--    lasciava a chi legge il compito di andarli a cercare in Agenda, cioè
--    di rifare a mano il lavoro appena fatto dal gestionale.

-- ---------------------------------------------------------------------------
-- 1. Le parole che non distinguono niente
-- ---------------------------------------------------------------------------
-- ⚠️ SI TOLGONO SOLO ARTICOLI E PREPOSIZIONI, non «le parole corte» e non
--    una lista di parole comuni. La differenza è che queste sono una classe
--    CHIUSA della lingua: se ne possono elencare tutte, e nessuna di loro
--    porta il significato di un impegno. Una lista di «parole poco utili»
--    invece cresce a ogni caso nuovo, e ogni parola che ci si aggiunge
--    rende il confronto un po' più largo senza che nessuno se ne accorga.
--
-- ⚠️ LE CONGIUNZIONI RESTANO. «Ordine verdure e frutta» e «Ordine verdure
--    frutta» non sono la stessa cosa detta in due modi: la «e» lega due
--    cose, e toglierla farebbe combaciare due impegni che parlano di merci
--    diverse. Il confine è la grammatica, non il fastidio.
--
-- ⚠️ SI SPEZZA IN PAROLE INVECE DI CANCELLARE DAL TESTO, e non è un
--    dettaglio di stile: cancellando con una sostituzione, due parole da
--    togliere una accanto all'altra («di la») ne lasciano una — la seconda
--    non viene vista perché lo spazio che la precede se l'è portato via la
--    prima. Spezzando e ricomponendo il caso non esiste.
create or replace function voce_titolo_essenziale(p_testo text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    (select string_agg(p.parola, ' ' order by p.posizione)
       from unnest(string_to_array(voce_titolo_nudo(p_testo), ' '))
            with ordinality as p(parola, posizione)
      where p.parola <> ''
        and p.parola <> all (array[
          -- articoli
          'il','lo','la','i','gli','le','l','un','uno','una',
          -- preposizioni semplici
          'di','a','da','in','con','su','per','tra','fra','d',
          -- preposizioni articolate (e le forme con l'apostrofo, che
          -- `voce_titolo_nudo` ha già ridotto a parole a sé)
          'del','dello','della','dei','degli','delle','dell',
          'al','allo','alla','ai','agli','alle','all',
          'dal','dallo','dalla','dai','dagli','dalle','dall',
          'nel','nello','nella','nei','negli','nelle','nell',
          'sul','sullo','sulla','sui','sugli','sulle','sull',
          'col','coi'
        ])),
    '');
$$;
comment on function voce_titolo_essenziale(text) is
  'Il titolo di un impegno senza articoli e preposizioni, per riconoscerlo quando e'' stato detto con le parole di tutti i giorni: «rinnovo della firma digitale» e «Rinnovo firma digitale» diventano la stessa cosa. Puo'' tornare vuoto — un titolo fatto di soli articoli non distingue niente — e chi la usa deve trattare quel vuoto come «non lo so», mai come «combacia con tutto».';

-- ---------------------------------------------------------------------------
-- 2. Quali impegni aperti potrebbero essere quello che ha detto, e QUANTO
-- ---------------------------------------------------------------------------
-- 🔴 QUESTA FUNZIONE CONTINUA A NON SCEGLIERE: elenca, e adesso dice anche
--    **quanto bene** ognuno combacia. A decidere resta chi la chiama, e
--    decide una cosa sola — se sul gradino migliore ne è rimasto uno solo.
--
--    grado 1 · parola per parola
--    grado 2 · le stesse parole, senza articoli e preposizioni
--    grado 3 · uno contiene l'altro
--
-- ⚠️ IL VUOTO NON COMBACIA CON NIENTE. Se il titolo detto è fatto di soli
--    articoli, `voce_titolo_essenziale` torna vuoto: senza la guardia
--    esplicita, `like '%' || '' || '%'` prenderebbe **tutta l'Agenda**, e
--    la prenderebbe in silenzio. È la stessa trappola per cui il confronto
--    ha una soglia di tre lettere.
--
-- ⚠️ IL GRADINO 3 CONSERVA IL CONFRONTO VECCHIO ACCANTO A QUELLO NUOVO, e
--    non è cintura e bretelle: il vecchio guardava le parole intere e il
--    nuovo le guarda senza articoli, e ci sono titoli che combaciano in un
--    modo e non nell'altro. Togliendo il vecchio, qualcosa che prima si
--    trovava smetterebbe di trovarsi — che è esattamente il difetto che
--    questa migrazione chiude, al contrario.
--
-- ⚠️ SOLO GLI IMPEGNI APERTI (`status <> 'completato'`): uno già fatto non si
--    richiude e non si sposta, e comparire fra i candidati lo renderebbe
--    ambiguo per niente. «in_corso» resta dentro: è un impegno vivo.
--
-- ⚠️ E LA SOGLIA DI TRE LETTERE non è prudenza: sotto quella lunghezza il
--    confronto «contiene» prende mezza Agenda, e mezza Agenda è la stessa
--    cosa di nessun risultato — con l'aggravante di sembrare una ricerca.
--
-- ⚠️ SI CANCELLA E SI RIFA' perche' cambia quello che restituisce, e
--    Postgres non lo lascia fare con un `create or replace`. Il `drop` porta
--    via anche i permessi: il `revoke` qui sotto non e' una ripetizione di
--    quello della migrazione precedente, e' l'unica cosa che tiene chiusa la
--    porta dopo averla rifatta. ⚠️ E NON SI RIMETTE NESSUN `grant`: quella
--    di prima non ne aveva, e ricopiarne uno «come le funzioni accanto»
--    aprirebbe una porta che non c'era mai stata (trappola del 24 e del
--    27/08).
-- rete-guardie: impegni_compatibili — la colonna «esatto» se ne va perche' e' diventata un doppione: diceva «combacia parola per parola», che adesso e' «grado = 1». Due colonne che dicono ESATTAMENTE la stessa cosa sono un riflesso da togliere, non una rete da tenere (discriminante del 17/08).
drop function if exists impegni_compatibili(text);
create function impegni_compatibili(p_testo text)
returns table (id uuid, title text, due_date date, grado smallint)
language sql
stable
security definer
set search_path = public
as $$
  with detto as (
    select voce_titolo_nudo(p_testo)       as n,
           voce_titolo_essenziale(p_testo) as e
  ),
  righe as (
    select t.id, t.title, t.due_date, t.created_at,
           voce_titolo_nudo(t.title)       as tn,
           voce_titolo_essenziale(t.title) as te,
           d.n, d.e,
           -- Il gradino 2 vale solo se tutte e due le parti hanno ancora
           -- qualcosa da dire dopo aver tolto gli articoli.
           (d.e is not null and length(d.e) >= 3
            and voce_titolo_essenziale(t.title) is not null
            and length(voce_titolo_essenziale(t.title)) >= 3) as e_utile
      from tasks t cross join detto d
     where t.status <> 'completato'
       and length(coalesce(d.n, '')) >= 3
  )
  select r.id, r.title, r.due_date,
         (case
            when r.tn = r.n                        then 1
            when r.e_utile and r.te = r.e          then 2
            else 3
          end)::smallint
    from righe r
   where r.tn = r.n
      or (r.e_utile and r.te = r.e)
      or r.tn like '%' || r.n || '%'
      or r.n  like '%' || r.tn || '%'
      or (r.e_utile and (r.te like '%' || r.e || '%' or r.e like '%' || r.te || '%'))
   order by 4, r.due_date nulls last, r.created_at;
$$;
comment on function impegni_compatibili(text) is
  'Gli impegni APERTI che potrebbero essere quello nominato a voce, ognuno col GRADO di quanto combacia: 1 parola per parola, 2 le stesse parole senza articoli e preposizioni, 3 uno contiene l''altro. Non sceglie: chi chiama guarda il gradino migliore ed esegue solo se li dentro ne e'' rimasto uno, perche'' fra due candidati altrettanto buoni non esiste nessun criterio onesto per preferirne uno.';

-- ⚠️ Non sono di nessuno: ci si arriva solo da dentro il database, come per
--    le altre traduttrici della voce (`voce_causale_numero`,
--    `voce_fornitore_numero`). Una funzione che elenca gli impegni aperti
--    non ha ragione di essere chiamabile dal browser.
revoke all on function voce_titolo_essenziale(text) from public, anon, authenticated;
revoke all on function impegni_compatibili(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Chi traduce «come l'ha chiamato lui» in «quale riga è»
-- ---------------------------------------------------------------------------
-- ⚠️ IL CORPO ARRIVA DAL DATABASE, non dal file che l'aveva creata (regola
--    del 18/08): fra i due ci stanno tutte le migrazioni che l'hanno
--    toccata, e ricopiarlo dal file annullerebbe in silenzio quello che
--    hanno aggiunto. Cambia solo il blocco dell'Agenda; tutto il resto —
--    prodotti, frigoriferi, pulizie, causali, fornitori, liste — è quello
--    che c'era, riga per riga.

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
  if p_tipo in ('agenda_da_segnare_fatto', 'agenda_da_spostare') then
    v_gesto   := case p_tipo when 'agenda_da_segnare_fatto' then 'chiudere' else 'spostare' end;
    v_cercato := coalesce(nullif(btrim(coalesce(v_dati->>'titolo', '')), ''), v_sentito);

    -- 🔴 I CANDIDATI SI RIFANNO A OGNI GIRO, MAI SI CONSERVANO — 09/09/2026.
    --    Questa funzione rigira al momento dell'approvazione, e in mezzo
    --    l'Agenda cambia: un elenco di candidati scritto ieri e lasciato lì
    --    direbbe «erano questi due» quando uno dei due è già stato chiuso.
    --    ⚠️ È la stessa forma di `task_id` qui sotto, che per la stessa
    --    ragione non si tiene se l'impegno non è più aperto. Si toglie
    --    PRIMA di guardare, così l'unico modo di averli è averli appena
    --    trovati.
    v_dati := v_dati - 'impegni_possibili';

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

    if v_id is not null and not (v_dati ? 'task_id') then
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
        select coalesce(jsonb_agg(jsonb_build_object('titolo', c.title, 'data', c.due_date)
                                  order by c.ord), '[]'::jsonb)
          into v_candidati
          from (select i.title, i.due_date,
                       row_number() over (order by i.due_date nulls last, i.title) as ord
                  from impegni_compatibili(v_cercato) i
                 where i.grado = v_grado
                 limit 5) c;
        v_dati := v_dati || jsonb_build_object('impegni_possibili', v_candidati);
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
    if p_tipo = 'agenda_da_spostare' then
      v_quando := nullif(btrim(coalesce(v_dati->>'data_nuova', '')), '');
      if v_quando is null or v_quando !~ '^\d{4}-\d{2}-\d{2}$' then
        v_dati     := v_dati - 'data_nuova';
        v_manca_ch := v_manca_ch || 'a quando spostarlo'::text;
      end if;
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
-- 4. Un elenco di candidati che non sono numeri non deve far cadere la schermata
-- ---------------------------------------------------------------------------
-- 🔴 TROVATO SBATTENDOCI CONTRO, e vale più del difetto. La prima versione di
--    questo lavoro chiamava il proprio elenco `candidati` — e `candidati` in
--    questo database **era già una parola con un significato**: per giacenza,
--    temperatura e pulizia è l'elenco dei NUMERI di catalogo fra cui scegliere,
--    e `azione_scelte` li converte a intero uno per uno.
--
-- ⚠️ IL DANNO NON ERA LA RIGA, ERA LA SCHERMATA. `azione_scelte` viene
--    chiamata dentro `appunti_da_approvare()`, che raccoglie **tutti** gli
--    appunti in una interrogazione sola: un solo appunto con quella chiave
--    piena della cosa sbagliata faceva fallire la lettura intera, e MEMO
--    rispondeva «non ho capito niente» su tutto. È la famiglia del 18/08 —
--    *nove letture in blocco, e se una fallisce non si applica nessuna*.
--
-- ⚠️ LA CURA VERA È STATA IL NOME (l'elenco degli impegni si chiama
--    `impegni_possibili`, perché è un'altra cosa: quelli non si toccano, non
--    sono una scelta). Questa riga è la rete: un valore inatteso lì dentro
--    adesso viene **saltato**, non fa cadere niente. *Un dato storto in una
--    riga non deve portarsi via le righe che stanno bene.*
--
-- ⚠️ Il corpo arriva dal database, e cambia UNA riga: il filtro nel ciclo.
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
-- LA VERIFICA
-- ---------------------------------------------------------------------------
-- ⚠️ GLI IMPEGNI SE LI CREA QUESTA VERIFICA, e li riconosce da un marchio
--    generato a caso a ogni giro: il perimetro di una prova dev'essere
--    fatto di roba che la prova ha creato (regola del 16/08), e un marchio
--    fisso prima o poi incrocia una riga vera.
-- ⚠️ IL MARCHIO STA ANCHE NEL TESTO CERCATO, e non è per simmetria: senza,
--    un impegno vero dell'Agenda potrebbe finire fra i candidati e far
--    fallire un conteggio per un motivo che non c'entra niente con quello
--    che si sta provando.
-- ⚠️ E SI CANCELLA PER IDENTIFICATIVO (regola del 23/08), tenendoli in un
--    array invece che in una variabile sola — che è il modo in cui il
--    26/08 una riga di prova è rimasta in produzione.
do $verifica$
declare
  v_m      text := 'zzv' || replace(substr(gen_random_uuid()::text, 1, 8), '-', '');
  v_miei   uuid[] := '{}';
  v_a      uuid;   -- Rinnovo firma digitale
  v_acc    uuid;   -- un titolo con l'accento
  v_c1     uuid;   -- Ordine verdure
  v_c2     uuid;   -- Ordine delle verdure
  v_d1     uuid;   -- Ordine pane
  v_d2     uuid;   -- Ordine pane e latte
  v_e      uuid;   -- quello da spostare
  v_ris    jsonb;
  v_dati   jsonb;
  v_cerca  text;
  v_vinti  text;
  v_min    smallint;
  v_lap0   bigint;
  v_lap1   bigint;
  v_n      integer;

begin
  select count(*) into v_lap0 from deleted_records;

  -- ---------------------------------------------------------------------
  -- Gli impegni su cui si prova
  -- ---------------------------------------------------------------------
  insert into tasks (title, status, due_date, category)
       values (v_m || ' Rinnovo firmax digitalex', 'da_fare', date '2027-03-01', 'altro')
    returning id into v_a;
  insert into tasks (title, status, due_date, category)
       values (v_m || ' Verifica caffè zorbax', 'da_fare', date '2027-03-02', 'altro')
    returning id into v_acc;
  insert into tasks (title, status, due_date, category)
       values (v_m || ' Ordinex verdurax', 'da_fare', date '2027-03-03', 'altro')
    returning id into v_c1;
  insert into tasks (title, status, due_date, category)
       values (v_m || ' Ordinex delle verdurax', 'da_fare', date '2027-03-04', 'altro')
    returning id into v_c2;
  insert into tasks (title, status, due_date, category)
       values (v_m || ' Panex kalox', 'da_fare', date '2027-03-05', 'altro')
    returning id into v_d1;
  insert into tasks (title, status, due_date, category)
       values (v_m || ' Panex kalox e lattex', 'da_fare', date '2027-03-06', 'altro')
    returning id into v_d2;
  insert into tasks (title, status, due_date, category)
       values (v_m || ' Consegnax vimox', 'da_fare', date '2027-04-10', 'altro')
    returning id into v_e;
  v_miei := array[v_a, v_acc, v_c1, v_c2, v_d1, v_d2, v_e];

  -- ---------------------------------------------------------------------
  -- 1. Le parole che non contano se ne vanno, le altre no
  -- ---------------------------------------------------------------------
  if voce_titolo_essenziale('il rinnovo della firma') is distinct from 'rinnovo firma' then
    raise exception 'VERIFICA: gli articoli non se ne vanno: «%»',
      coalesce(voce_titolo_essenziale('il rinnovo della firma'), '(vuoto)');
  end if;
  -- ⚠️ La congiunzione RESTA: toglierla farebbe combaciare due impegni che
  --    parlano di merci diverse.
  if voce_titolo_essenziale('verdure e frutta') is distinct from 'verdure e frutta' then
    raise exception 'VERIFICA: la «e» e'' stata tolta, e non doveva: «%»',
      coalesce(voce_titolo_essenziale('verdure e frutta'), '(vuoto)');
  end if;
  -- 🔴 DUE PAROLE DA TOGLIERE UNA ACCANTO ALL'ALTRA: è il caso che una
  --    sostituzione sul testo sbaglierebbe, lasciando in piedi la seconda.
  if voce_titolo_essenziale('ordine di la firma') is distinct from 'ordine firma' then
    raise exception 'VERIFICA: due parole vicine non se ne vanno tutte e due: «%»',
      coalesce(voce_titolo_essenziale('ordine di la firma'), '(vuoto)');
  end if;
  -- 🔴 UN TITOLO DI SOLI ARTICOLI NON DISTINGUE NIENTE, e deve dirlo col
  --    vuoto: se rispondesse la stringa vuota, il confronto «contiene»
  --    prenderebbe tutta l'Agenda in silenzio.
  if voce_titolo_essenziale('il la di a') is not null then
    raise exception 'VERIFICA: un titolo di soli articoli non e'' vuoto: «%»',
      voce_titolo_essenziale('il la di a');
  end if;

  -- ---------------------------------------------------------------------
  -- 2. LA VARIANTE NATURALE TROVA L'IMPEGNO — il difetto che si chiude
  -- ---------------------------------------------------------------------
  v_cerca := v_m || ' rinnovo della firmax digitalex';
  select min(i.grado) into v_min from impegni_compatibili(v_cerca) i;
  select coalesce(string_agg(i.title, ' | ' order by i.title), '(nessuno)')
    into v_vinti from impegni_compatibili(v_cerca) i where i.grado = v_min;
  if v_min is distinct from 2::smallint then
    raise exception 'VERIFICA: la variante naturale doveva combaciare al gradino 2, e invece «%» (trovati: %)',
      coalesce(v_min::text, '(niente)'), v_vinti;
  end if;

  v_ris := voce_risolvi_dati('agenda_da_segnare_fatto',
             jsonb_build_object('titolo', v_cerca));
  if (v_ris->'dati'->>'task_id')::uuid is distinct from v_a then
    raise exception 'VERIFICA: «rinnovo della firmax digitalex» non ha trovato l''impegno. manca: «%», candidati: %',
      coalesce(v_ris->>'manca', '(nessuno)'), coalesce(v_ris->'dati'->>'impegni_possibili', '(nessuno)');
  end if;
  if nullif(v_ris->>'manca', '') is not null then
    raise exception 'VERIFICA: trovato l''impegno e dice lo stesso che manca qualcosa: «%»', v_ris->>'manca';
  end if;
  -- ⚠️ Il titolo mostrato è quello SCRITTO IN AGENDA, non quello sentito:
  --    chi firma deve vedere il nome della riga che verrà toccata.
  if v_ris->'dati'->>'titolo' is distinct from (v_m || ' Rinnovo firmax digitalex') then
    raise exception 'VERIFICA: l''appunto non mostra il titolo di Agenda: «%»',
      coalesce(v_ris->'dati'->>'titolo', '(vuoto)');
  end if;
  -- ⚠️ Risolto: nessun candidato da mostrare.
  if v_ris->'dati' ? 'impegni_possibili' then
    raise exception 'VERIFICA: l''impegno e'' stato trovato e porta lo stesso un elenco di candidati: %',
      v_ris->'dati'->>'impegni_possibili';
  end if;

  -- ---------------------------------------------------------------------
  -- 3. Maiuscole, accenti, punteggiatura e spazi doppi non cambiano niente
  -- ---------------------------------------------------------------------
  v_ris := voce_risolvi_dati('agenda_da_segnare_fatto',
             jsonb_build_object('titolo',
               upper(v_m) || ',  RINNOVO   della FIRMAX!! digitalex.'));
  if (v_ris->'dati'->>'task_id')::uuid is distinct from v_a then
    raise exception 'VERIFICA: maiuscole e punteggiatura hanno cambiato il risultato. manca: «%»',
      coalesce(v_ris->>'manca', '(nessuno)');
  end if;
  -- 🔴 L'ACCENTO NEL VERSO IN CUI SBAGLIA IL TELEFONO: in Agenda c'è
  --    «caffè», la dettatura scrive «caffe».
  v_ris := voce_risolvi_dati('agenda_da_segnare_fatto',
             jsonb_build_object('titolo', v_m || ' verifica caffe zorbax'));
  if (v_ris->'dati'->>'task_id')::uuid is distinct from v_acc then
    raise exception 'VERIFICA: l''accento mancante ha fatto perdere l''impegno. manca: «%»',
      coalesce(v_ris->>'manca', '(nessuno)');
  end if;

  -- ---------------------------------------------------------------------
  -- 4. DUE CANDIDATI PARI: non si sceglie, e si dice quali sono
  -- ---------------------------------------------------------------------
  v_cerca := v_m || ' ordinex di verdurax';
  v_ris   := voce_risolvi_dati('agenda_da_segnare_fatto',
               jsonb_build_object('titolo', v_cerca));
  if v_ris->'dati' ? 'task_id' then
    raise exception 'VERIFICA: con due candidati pari ne ha scelto uno — %',
      v_ris->'dati'->>'task_id';
  end if;
  if nullif(v_ris->>'manca', '') is null then
    raise exception 'VERIFICA: due candidati pari e non chiede niente.';
  end if;
  if v_ris->>'tipo' is distinct from 'agenda_quale_impegno' then
    raise exception 'VERIFICA: con due candidati la destinazione resta approvabile: «%»',
      coalesce(v_ris->>'tipo', '(nessuna)');
  end if;
  if not (v_ris->'dati' ? 'impegni_possibili') then
    raise exception 'VERIFICA: due candidati e l''appunto non dice quali sono. manca: «%»',
      v_ris->>'manca';
  end if;
  v_n := jsonb_array_length(v_ris->'dati'->'impegni_possibili');
  if v_n <> 2 then
    raise exception 'VERIFICA: i candidati mostrati sono % invece di 2: %',
      v_n, v_ris->'dati'->>'impegni_possibili';
  end if;
  -- 🔴 TITOLO **E** GIORNO: è il giorno che quasi sempre li distingue, e un
  --    elenco di due titoli somiglianti senza data non aiuta a scegliere.
  if exists (
    select 1 from jsonb_array_elements(v_ris->'dati'->'impegni_possibili') c
     where nullif(c.value->>'titolo', '') is null
        or nullif(c.value->>'data', '') is null
  ) then
    raise exception 'VERIFICA: un candidato non porta titolo e giorno: %',
      v_ris->'dati'->>'impegni_possibili';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_ris->'dati'->'impegni_possibili') c
     where c.value->>'titolo' = v_m || ' Ordinex delle verdurax'
       and c.value->>'data'   = '2027-03-04'
  ) then
    raise exception 'VERIFICA: fra i candidati manca quello vero, o la sua data e'' sbagliata: %',
      v_ris->'dati'->>'impegni_possibili';
  end if;

  -- ---------------------------------------------------------------------
  -- 5. IL GRADINO STRETTO VINCE — la proprietà che rende sicuro l'allargamento
  -- ---------------------------------------------------------------------
  -- «Panex kalox» detto per intero non deve diventare ambiguo perché in
  -- Agenda c'è anche «Panex kalox e lattex», che lo contiene.
  v_ris := voce_risolvi_dati('agenda_da_segnare_fatto',
             jsonb_build_object('titolo', v_m || ' Panex kalox'));
  if (v_ris->'dati'->>'task_id')::uuid is distinct from v_d1 then
    raise exception 'VERIFICA: il titolo esatto e'' diventato ambiguo per colpa di uno che lo contiene. manca: «%», candidati: %',
      coalesce(v_ris->>'manca', '(nessuno)'), coalesce(v_ris->'dati'->>'impegni_possibili', '(nessuno)');
  end if;

  -- ---------------------------------------------------------------------
  -- 6. NESSUN CANDIDATO: resta non approvabile, e non inventa un elenco
  -- ---------------------------------------------------------------------
  v_ris := voce_risolvi_dati('agenda_da_segnare_fatto',
             jsonb_build_object('titolo', v_m || ' xilofonox marmellatox'));
  if v_ris->'dati' ? 'task_id' then
    raise exception 'VERIFICA: ha trovato un impegno che non esiste — %', v_ris->'dati'->>'task_id';
  end if;
  if v_ris->'dati' ? 'impegni_possibili' then
    raise exception 'VERIFICA: nessun candidato, e mostra un elenco: %', v_ris->'dati'->>'impegni_possibili';
  end if;
  if v_ris->>'manca' not like '%non l''ho trovato%' then
    raise exception 'VERIFICA: senza candidati non dice che non l''ha trovato: «%»',
      coalesce(v_ris->>'manca', '(nessuno)');
  end if;

  -- ---------------------------------------------------------------------
  -- 7. LO SPOSTAMENTO CONSERVA IDENTIFICATIVO, GIORNO DI PRIMA E GIORNO NUOVO
  -- ---------------------------------------------------------------------
  v_ris := voce_risolvi_dati('agenda_da_spostare',
             jsonb_build_object('titolo',     v_m || ' la consegnax di vimox',
                                'data_nuova', '2027-05-20'));
  if (v_ris->'dati'->>'task_id')::uuid is distinct from v_e then
    raise exception 'VERIFICA: lo spostamento non ha trovato l''impegno. manca: «%»',
      coalesce(v_ris->>'manca', '(nessuno)');
  end if;
  if v_ris->'dati'->>'data_precedente' is distinct from '2027-04-10' then
    raise exception 'VERIFICA: il giorno di prima non e'' quello di Agenda: «%»',
      coalesce(v_ris->'dati'->>'data_precedente', '(vuoto)');
  end if;
  if v_ris->'dati'->>'data_nuova' is distinct from '2027-05-20' then
    raise exception 'VERIFICA: il giorno nuovo si e'' perso: «%»',
      coalesce(v_ris->'dati'->>'data_nuova', '(vuoto)');
  end if;
  if nullif(v_ris->>'manca', '') is not null then
    raise exception 'VERIFICA: lo spostamento e'' completo e dice che manca qualcosa: «%»', v_ris->>'manca';
  end if;

  -- ---------------------------------------------------------------------
  -- 8. I CANDIDATI NON SI CONSERVANO FRA UN GIRO E L'ALTRO
  -- ---------------------------------------------------------------------
  -- 🔴 Questa funzione rigira al momento dell'approvazione. Se l'elenco
  --    restasse scritto nei dati, direbbe «erano questi due» quando uno dei
  --    due nel frattempo è stato chiuso.
  v_cerca := v_m || ' ordinex di verdurax';
  v_dati  := voce_risolvi_dati('agenda_da_segnare_fatto',
               jsonb_build_object('titolo', v_cerca))->'dati';
  if not (v_dati ? 'impegni_possibili') then
    raise exception 'VERIFICA: lo stato di partenza del giro 8 non ha candidati.';
  end if;
  update tasks set status = 'completato' where id = v_c2;
  v_ris := voce_risolvi_dati('agenda_da_segnare_fatto', v_dati);
  if (v_ris->'dati'->>'task_id')::uuid is distinct from v_c1 then
    raise exception 'VERIFICA: chiuso uno dei due, non ha risolto sull''altro. manca: «%»',
      coalesce(v_ris->>'manca', '(nessuno)');
  end if;
  if v_ris->'dati' ? 'impegni_possibili' then
    raise exception 'VERIFICA: i candidati vecchi sono rimasti attaccati all''appunto: %',
      v_ris->'dati'->>'impegni_possibili';
  end if;

  -- ---------------------------------------------------------------------
  -- 9. L'IMPEGNO PROPOSTO E POI CHIUSO NON SI RIMPIAZZA CON UN ALTRO
  -- ---------------------------------------------------------------------
  -- 🔴 È il caso «diventata obsoleta fra la proposta e l'approvazione»: se
  --    l'impegno che l'appunto nominava non è più aperto, non si va a
  --    pescare quello che gli somiglia — si dice che è cambiato. Chiudere
  --    una riga che nessuno ha mai visto sull'appunto firmato sarebbe la
  --    firma in bianco che tutto questo lavoro esiste per evitare.
  v_ris := voce_risolvi_dati('agenda_da_segnare_fatto',
             jsonb_build_object('titolo',  v_m || ' Ordinex delle verdurax',
                                'task_id', v_c2));
  if v_ris->'dati' ? 'task_id' then
    raise exception 'VERIFICA: l''impegno chiuso e'' stato rimpiazzato da un altro — %',
      v_ris->'dati'->>'task_id';
  end if;
  if v_ris->>'manca' not like '%non è più aperto%' then
    raise exception 'VERIFICA: non dice che l''impegno proposto non c''e'' piu'': «%»',
      coalesce(v_ris->>'manca', '(nessuno)');
  end if;

  -- ---------------------------------------------------------------------
  -- 10. UN TITOLO DI SOLI ARTICOLI NON PRENDE TUTTA L'AGENDA
  -- ---------------------------------------------------------------------
  select count(*) into v_n from impegni_compatibili('il la di a') i
   where i.id = any(v_miei);
  if v_n <> 0 then
    raise exception 'VERIFICA: un titolo di soli articoli ha preso % impegni.', v_n;
  end if;

  -- ---------------------------------------------------------------------
  -- 11. UN ELENCO STORTO NON FA CADERE LA LETTURA DI TUTTI GLI APPUNTI
  -- ---------------------------------------------------------------------
  -- 🔴 Prima di questa migrazione la riga qui sotto sollevava «invalid input
  --    syntax for type integer», e quell'errore non restava nella sua riga:
  --    `azione_scelte` gira dentro la lettura che raccoglie TUTTI gli
  --    appunti, quindi uno storto li faceva sparire tutti.
  if azione_scelte('giacenza',
       jsonb_build_object('candidati',
         jsonb_build_array(jsonb_build_object('titolo', 'x', 'data', null))))
     is distinct from '[]'::jsonb then
    raise exception 'VERIFICA: un candidato che non e'' un numero non e'' stato saltato.';
  end if;

  -- ---------------------------------------------------------------------
  -- Si ripulisce: solo ciò che questa verifica ha creato, per identificativo
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

  raise notice 'Agenda: la variante naturale trova l''impegno, due candidati pari si mostrano e non si approvano.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260909000003', 'agenda_riconosce_l_impegno') on conflict (version) do nothing;
