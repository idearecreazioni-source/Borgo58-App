-- ============================================================================
-- L'AGENDA A VOCE, FASE 2 — chiudere e spostare un impegno che esiste già
-- ============================================================================
-- La fase 1 (08/09) ha chiuso il difetto: «segna come fatto il rinnovo della
-- firma digitale» non fa più nascere un impegno NUOVO con quel titolo.
-- Restava però una cosa che il gestionale non sapeva fare, e lo dichiarava:
-- chiudere o spostare l'impegno vero. Questa migrazione gliela insegna.
--
-- 🔴 LA FRASE DETTA NON SCRIVE NIENTE, e non cambia: fra la voce e la riga
--    di Agenda c'è sempre un appunto approvato guardando il titolo. Quello
--    che cambia è che adesso quell'appunto, quando l'impegno è UNO SOLO, si
--    può approvare — e approvandolo succede davvero.
--
-- 🔴 E QUANDO NON E' UNO SOLO NON SCEGLIE NESSUNO. Zero impegni compatibili
--    o più di uno: la destinazione diventa `agenda_quale_impegno`, che nel
--    catalogo non c'è — quindi l'appunto **non è approvabile per
--    costruzione**, senza nessun controllo da ricordare — e la frase dice se
--    non ne ha trovato nessuno o troppi.
--
-- ⚠️ COSA NON SI TOCCA, ed è metà del lavoro: il promemoria («ricordami
--    di…») resta identico, e così tutte le altre dodici azioni vocali. La
--    verifica in fondo lo controlla invece di sperarlo.
--
-- ⚠️ LE FUNZIONI RISCRITTE VENGONO DAL CORPO VIVO DEL PROGETTO DI PROVA
--    (`npm run funzione:viva -- … --prova`), non dai file che le hanno
--    create: fra i due ci stanno tutte le migrazioni che le hanno toccate
--    (regola del 18/08), e il progetto di prova è quello allineato al
--    repository. Le modifiche sono aggiunte, mai riscritture di righe
--    esistenti.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Il catalogo impara i due gesti
-- ---------------------------------------------------------------------------
-- ⚠️ ED E' QUESTO CHE LI RENDE APPROVABILI. `appunti_vocali.eseguibile` lo
--    scrive `destinazione_vocale` leggendo questa tabella: finché una riga
--    qui non c'era, l'appunto nasceva non approvabile e nessun controllo
--    doveva ricordarsene. Adesso c'è, e insieme alla riga arriva il ramo che
--    la esegue — mai una senza l'altra, altrimenti il gestionale propone una
--    cosa che poi non sa fare (il difetto del 27/08, sorvegliato da
--    `tipi_vocali_senza_ramo()`).
--
-- ⚠️ `natura = 'creazione'` e non `'misura'`: il vocabolario ne ammette due,
--    e fra le due questa è quella che dice «passa dai tuoi occhi». Oggi la
--    natura decide solo la frase di ripiego quando il motivo manca — ma la
--    riga va scritta col significato giusto, non con quello comodo.
--
-- ⚠️ `additivo = false`: due impegni chiusi non si accorpano in un appunto
--    solo. Sono due righe di Agenda diverse, e si guardano una per una.
insert into tipi_azione_vocale (tipo, natura, titolo, attivo, eseguibile, additivo)
values
  ('agenda_da_segnare_fatto', 'creazione', 'Da segnare fatto in Agenda', true, true, false),
  ('agenda_da_spostare',      'creazione', 'Da spostare in Agenda',      true, true, false)
on conflict (tipo) do update
  set natura     = excluded.natura,
      titolo     = excluded.titolo,
      attivo     = excluded.attivo,
      eseguibile = excluded.eseguibile,
      additivo   = excluded.additivo;

-- ---------------------------------------------------------------------------
-- 2. Come si confronta quello che ha detto con quello che c'è scritto
-- ---------------------------------------------------------------------------
-- ⚠️ NON SI RIUSA `nome_ingrediente_chiave`, e la ragione è il discriminante
--    del 17/08: direbbero *esattamente* la stessa cosa? No. Quella fa una
--    CHIAVE per riconoscere l'articolo di un fornitore, e lascia cadere le
--    lettere accentate. Questa confronta **quello che è stato detto** con
--    **quello che è scritto in Agenda**, e la dettatura del telefono gli
--    accenti a volte li mette e a volte no: «venerdì» e «venerdi» devono
--    essere la stessa parola. Fondere le due vorrebbe dire che il giorno che
--    una cambia, cambia anche l'altra.
create or replace function voce_titolo_nudo(p_testo text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    btrim(regexp_replace(
      regexp_replace(
        translate(lower(coalesce(p_testo, '')),
                  'àáâäãèéêëìíîïòóôöõùúûüçñ',
                  'aaaaaeeeeiiiiooooouuuucn'),
        '[^a-z0-9]+', ' ', 'g'),
      '\s+', ' ', 'g')),
    '');
$$;
comment on function voce_titolo_nudo(text) is
  'Il titolo di un impegno ridotto all''osso per poterlo confrontare con quello che e'' stato detto a voce: minuscole, accenti appianati, segni ridotti a spazi. Serve perche'' la dettatura del telefono gli accenti a volte li mette e a volte no.';

-- ---------------------------------------------------------------------------
-- 3. Quali impegni aperti potrebbero essere quello che ha detto
-- ---------------------------------------------------------------------------
-- 🔴 QUESTA FUNZIONE NON SCEGLIE: elenca. A decidere è chi la chiama, e
--    decide una cosa sola — se ne è uscito **esattamente uno**. È la forma
--    che rende impossibile chiudere l'impegno sbagliato: quando i candidati
--    sono due, non c'è nessun criterio che ne preferisca uno.
--
-- ⚠️ SOLO GLI IMPEGNI APERTI (`status <> 'completato'`): uno già fatto non si
--    richiude e non si sposta, e comparire fra i candidati lo renderebbe
--    ambiguo per niente. «in_corso» resta dentro: è un impegno vivo.
--
-- ⚠️ E LA SOGLIA DI TRE LETTERE non è prudenza: sotto quella lunghezza il
--    confronto «contiene» prende mezza Agenda, e mezza Agenda è la stessa
--    cosa di nessun risultato — con l'aggravante di sembrare una ricerca.
create or replace function impegni_compatibili(p_testo text)
returns table (id uuid, title text, due_date date, esatto boolean)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.title, t.due_date,
         voce_titolo_nudo(t.title) = voce_titolo_nudo(p_testo)
    from tasks t
   where t.status <> 'completato'
     and length(coalesce(voce_titolo_nudo(p_testo), '')) >= 3
     and (
       voce_titolo_nudo(t.title) = voce_titolo_nudo(p_testo)
       or voce_titolo_nudo(t.title) like '%' || voce_titolo_nudo(p_testo) || '%'
       or voce_titolo_nudo(p_testo) like '%' || voce_titolo_nudo(t.title) || '%'
     )
   order by t.due_date nulls last, t.created_at;
$$;
comment on function impegni_compatibili(text) is
  'Gli impegni APERTI che potrebbero essere quello nominato a voce, col segno di quali combaciano parola per parola. Non sceglie: chi chiama esegue solo se ne esce esattamente uno, perche'' fra due candidati non esiste nessun criterio onesto per preferirne uno.';

-- ⚠️ Non è di nessuno: ci si arriva solo da dentro il database, come per le
--    altre traduttrici della voce (`voce_causale_numero`,
--    `voce_fornitore_numero`). Una funzione che elenca gli impegni aperti
--    non ha ragione di essere chiamabile dal browser.
revoke all on function voce_titolo_nudo(text) from public, anon, authenticated;
revoke all on function impegni_compatibili(text) from public, anon, authenticated;


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
    -- 🔴 LE TRE DELL'AGENDA PORTANO ALL'ELENCO, non alla scheda: non c'è
    --    un modulo da riempire, c'è un impegno da CERCARE. E ci porta anche
    --    `agenda_quale_impegno`, che è il caso in cui serve di più — il
    --    gestionale non sa quale sia, quindi l'unica cosa che può fare è
    --    mandare dove stanno tutti.
    -- ⚠️ QUI E NON NEL BROWSER: fino al 08/09 questo collegamento viaggiava
    --    dentro i dati dell'appunto, perché per un tipo fuori catalogo
    --    questa funzione rispondeva — giustamente — niente. Adesso due dei
    --    tre sono nel catalogo e il terzo ha la sua riga: la regola del
    --    27/08 torna intera, e il posto lo dice il database.
    when 'agenda_da_segnare_fatto' then '/agenda'
    when 'agenda_da_spostare'      then '/agenda'
    when 'agenda_quale_impegno'    then '/agenda'
    -- 🔴 `nota_non_capita` NON HA UNA DESTINAZIONE, e non e' una
    --    dimenticanza: vuol dire «non ho capito cosa volevi». Mandare da
    --    qualche parte chi non sa dove sta andando e' peggio che non
    --    mandarlo: sceglierebbe il gestionale al posto suo, a caso.
    else null
  end;
$function$;;

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

    -- ⚠️ PRIMA IL NOME ESATTO, POI QUELLO CHE LO CONTIENE. Un titolo che
    --    combacia parola per parola non è ambiguo nemmeno se altri lo
    --    contengono: «Ordine verdure» detto per intero non deve diventare
    --    incerto perché in Agenda c'è anche «Ordine verdure e frutta».
    --    Non è una scelta fra candidati: è che uno dei due modi di cercare
    --    ne trova uno solo.
    -- 🔴 E SE L'IDENTIFICATIVO SI E' PERSO NON SI CERCA UN SOSTITUTO.
    --    Questa funzione viene richiamata ANCHE al momento dell'approvazione
    --    (al momento del «sì»): se l'impegno proposto è stato chiuso e in
    --    Agenda ce n'è un altro che gli somiglia, ripescarlo vorrebbe dire
    --    chiudere una riga che nessuno ha mai visto sull'appunto firmato.
    if v_id is null and not v_perso and v_cercato is not null then
      select count(*) into v_quanti from impegni_compatibili(v_cercato) i where i.esatto;
      if v_quanti = 1 then
        select i.id into v_id from impegni_compatibili(v_cercato) i where i.esatto;
      else
        select count(*) into v_quanti from impegni_compatibili(v_cercato) i;
        if v_quanti = 1 then
          select i.id into v_id from impegni_compatibili(v_cercato) i;
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
      v_manca_ch := v_manca_ch || case
        when v_perso then
          'l''impegno che ti avevo proposto non è più aperto in Agenda'
        when v_cercato is null then
          'quale impegno intendevi'
        when (select count(*) from impegni_compatibili(v_cercato)) > 1 then
          'quale dei ' || (select count(*) from impegni_compatibili(v_cercato))::text ||
          ' impegni aperti che potrebbero essere «' || v_cercato || '»'
        else
          'quale impegno: «' || v_cercato || '» non l''ho trovato fra quelli aperti in Agenda'
      end;
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
end $function$;;

CREATE OR REPLACE FUNCTION public.scrivi_dettatura(p_utente uuid, p_testo text, p_provenienza text, p_azioni jsonb, p_esito text, p_modello text, p_token_domanda integer, p_token_risposta integer, p_messaggio text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_prezzo    costo_modello_ai%rowtype;
  v_costo     numeric := 0;
  v_msg       text := p_messaggio;
  v_dettatura uuid;
  v_azione    jsonb;
  v_i         integer := 0;
  v_tipo      text;
  v_libera    text;
  v_sicuro    boolean;
  v_dati      jsonb;
  v_frase     text;
  v_motivo    text;
  v_alt       jsonb;
  v_risolto   jsonb;
  v_manca     text;
  v_d         record;
  v_appunti   integer := 0;
begin
  if p_modello is not null then
    select * into v_prezzo from costo_modello_ai where modello = p_modello;
    if found then
      v_costo := round(
        coalesce(p_token_domanda, 0)::numeric  / 1000000 * v_prezzo.euro_milione_in +
        coalesce(p_token_risposta, 0)::numeric / 1000000 * v_prezzo.euro_milione_out, 5);
    else
      -- Uno zero silenzioso in un conto di spesa si legge «gratis».
      v_msg := coalesce(v_msg || ' — ', '') ||
        'Il costo di questa dettatura non e'' stato conteggiato: il modello «' || p_modello ||
        '» non e'' nel listino. Va aggiunto, altrimenti la spesa del mese risulta piu'' bassa del vero.';
    end if;
  end if;

  insert into dettature (testo, provenienza, esito, modello,
                         token_domanda, token_risposta, costo_euro, messaggio, creato_da)
  values (p_testo, p_provenienza, p_esito, p_modello,
          coalesce(p_token_domanda, 0), coalesce(p_token_risposta, 0), v_costo, v_msg, p_utente)
  returning id into v_dettatura;

  for v_azione in select * from jsonb_array_elements(coalesce(p_azioni, '[]'::jsonb))
  loop
    v_i      := v_i + 1;
    v_tipo   := coalesce(nullif(btrim(coalesce(v_azione->>'tipo', '')), ''), 'nota_non_capita');
    v_libera := nullif(btrim(coalesce(v_azione->>'destinazione', '')), '');
    v_sicuro := coalesce((v_azione->>'sicuro')::boolean, false);
    v_dati   := coalesce(v_azione->'dati', '{}'::jsonb);
    v_frase  := nullif(btrim(coalesce(v_azione->>'frase', '')), '');
    v_motivo := nullif(btrim(coalesce(v_azione->>'motivo', '')), '');
    v_alt    := case when jsonb_typeof(v_azione->'alternative') = 'array'
                       and jsonb_array_length(v_azione->'alternative') > 0
                     then v_azione->'alternative' end;

    select * into v_d from destinazione_vocale(v_tipo, v_libera);

    -- ⚠️ SI RITRADUCE SOLO CIO' CHE IL GESTIONALE SA ESEGUIRE: su una
    --    destinazione che non esiste non c'e' nessun catalogo in cui cercare.
    if v_d.eseguibile then
      v_risolto := voce_risolvi_dati(v_tipo, v_dati);
      v_dati    := v_risolto->'dati';
      v_manca   := nullif(v_risolto->>'manca', '');
      if v_manca is not null then
        -- Quello che manca VINCE su qualunque sicurezza dichiarata.
        v_sicuro := false;
        v_motivo := coalesce(v_motivo, v_manca);
      end if;

      -- 🔴 E CIO' CHE SI SCOPRE GUARDANDO IL DATABASE PUO' CAMBIARE LA
      --    DESTINAZIONE, non solo i dati (09/09/2026). «Segna come fatto
      --    l'ordine delle verdure» è un comando eseguibile finché in Agenda
      --    quell'impegno c'è ed è uno solo; se non c'è, o se ce ne sono
      --    due, non è più lo stesso gesto — diventa una domanda.
      --    ⚠️ Senza questa riga l'appunto resterebbe APPROVABILE (lo dice
      --    il catalogo, non i dati) e chi preme «Approva» riceverebbe un
      --    rifiuto per una cosa che la schermata gli aveva offerto.
      --    ⚠️ Chi decide resta `voce_risolvi_dati`, che è l'unico posto che
      --    ha guardato: qui si esegue quello che ha detto.
      if nullif(v_risolto->>'tipo', '') is not null
         and v_risolto->>'tipo' is distinct from v_tipo then
        v_tipo   := v_risolto->>'tipo';
        v_libera := coalesce(nullif(v_risolto->>'destinazione', ''), v_libera);
        select * into v_d from destinazione_vocale(v_tipo, v_libera);
      end if;
    else
      -- 🔴 NON E' UN'INCERTEZZA DI MEMO: MEMO puo' aver capito benissimo, e'
      --    il gestionale che non ha il gesto. Detto in parole, perche' «non
      --    sicuro» da solo farebbe credere che il problema sia nell'ascolto.
      v_motivo := coalesce(v_motivo,
        'Ho capito cosa vuoi, ma il gestionale non ha ancora un modo per farlo: '
        || 'questo appunto resta qui come promemoria.');
    end if;

    if v_frase is null then
      v_frase := coalesce(v_d.titolo, 'Una cosa che non ho capito');
    end if;

    -- 🔴 IL PERCHE' C'E' SEMPRE. Anche su una riga sicura e eseguibile: da
    --    quando niente si salva da se', anche quella aspetta — e un elenco
    --    di cose in attesa senza il perche' e' un elenco di cose di cui non
    --    si sa che fare.
    if v_motivo is null then
      v_motivo := case
        when not v_sicuro then 'Non ero sicuro: guardala tu.'
        else 'Questa la guardi sempre tu prima che venga scritta.'
      end;
    end if;

    -- 🔴 SEMPRE `in_attesa`, e l'appunto lo mette il trigger.
    insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro,
                                frase, motivo, stato, alternative, destinazione_libera)
    values (v_dettatura, v_i, v_tipo, v_dati, v_sicuro,
            v_frase, v_motivo, 'in_attesa', v_alt, v_libera);
  end loop;

  select count(distinct a.appunto_id) into v_appunti
    from azioni_dettate a where a.dettatura_id = v_dettatura;

  return jsonb_build_object(
    'dettatura_id', v_dettatura,
    'costo_euro',   v_costo,
    'nel_listino',  v_prezzo.modello is not null,
    'azioni',       v_i,
    'eseguite',     0,
    'appunti',      coalesce(v_appunti, 0),
    'da_guardare',  v_i);
end $function$;;

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
end $function$;;

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- ⚠️ TUTTO DENTRO UNA SOTTO-TRANSAZIONE ANNULLATA: la verifica chiude e
--    sposta impegni veri, e annullando non resta niente da cancellare. Il
--    guardiano dei residui gira lo stesso, perché una sotto-transazione
--    annullata non dimostra che non sia rimasto niente **fuori** da lei.
--
-- 🔴 E LA META' CHE CONTA E' QUELLA CHE NON DEVE CAMBIARE: il promemoria e
--    gli altri dodici gesti vocali. Una verifica che provasse solo i due
--    gesti nuovi passerebbe anche se questa migrazione avesse rotto la
--    creazione di un impegno, che è il gesto più frequente dell'Agenda.
do $verifica$
declare
  v_tit    uuid;
  v_foto   jsonb;
  v_a      uuid;
  v_b      uuid;
  v_c      uuid;
  v_det    jsonb;
  v_riga   azioni_dettate%rowtype;
  v_app    appunti_vocali%rowtype;
  v_marchio text := 'VERIFICA 20260909000002 ' || replace(gen_random_uuid()::text, '-', '');
  v_n      integer;
  v_msg    text;
  v_task   tasks%rowtype;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Serve un titolare per provare questa migrazione.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);
  v_foto := foto_righe();

  begin

  -- ------------------------------------------------------------------------
  -- (0) il catalogo e il ramo che lo esegue nascono INSIEME
  -- ------------------------------------------------------------------------
  -- ⚠️ È la rete del 27/08: un tipo acceso senza esecuzione è una cosa che
  --    il gestionale propone e poi non sa fare, e lo si scopre solo dopo
  --    aver premuto «sì».
  select count(*) into v_n from tipi_vocali_senza_ramo();
  if v_n <> 0 then
    raise exception 'Ci sono % tipi vocali accesi senza esecuzione.', v_n;
  end if;

  -- ------------------------------------------------------------------------
  -- (1) UN SOLO impegno compatibile: l'appunto si approva, e chiude quello
  -- ------------------------------------------------------------------------
  insert into tasks (title, status, due_date, category, origine_modulo)
  values (v_marchio || ' rinnovo della firma', 'da_fare', current_date + 3, 'altro', 'voce')
  returning id into v_a;

  v_det := scrivi_dettatura(v_tit, 'detto: segna come fatto', 'app',
    jsonb_build_array(jsonb_build_object(
      'tipo', 'agenda_da_segnare_fatto', 'sicuro', true,
      'frase', 'Segnato come fatto',
      'dati', jsonb_build_object('titolo', v_marchio || ' rinnovo della firma'))),
    'capita', null, 0, 0, null);

  select * into v_riga from azioni_dettate where dettatura_id = (v_det->>'dettatura_id')::uuid;
  if v_riga.tipo <> 'agenda_da_segnare_fatto' then
    raise exception 'Con un solo impegno compatibile la destinazione e'' diventata %', v_riga.tipo;
  end if;
  if nullif(v_riga.dati->>'task_id', '')::uuid is distinct from v_a then
    raise exception 'L''impegno non e'' stato riconosciuto: task_id = %', coalesce(v_riga.dati->>'task_id', '(vuoto)');
  end if;
  if v_riga.dati->>'titolo' is distinct from v_marchio || ' rinnovo della firma' then
    raise exception 'L''appunto non mostra il titolo scritto in Agenda: %', v_riga.dati->>'titolo';
  end if;

  select * into v_app from appunti_vocali where id = v_riga.appunto_id;
  if not v_app.eseguibile then
    raise exception 'L''appunto di un impegno riconosciuto non e'' approvabile.';
  end if;

  -- Prima di approvare, in Agenda non e'' cambiato niente.
  select * into v_task from tasks where id = v_a;
  if v_task.status <> 'da_fare' then
    raise exception 'L''impegno si e'' chiuso PRIMA dell''approvazione.';
  end if;

  perform approva_appunto(v_riga.appunto_id);

  select * into v_task from tasks where id = v_a;
  if v_task.status <> 'completato' then
    raise exception 'Approvando non si e'' chiuso niente: lo stato e'' %', v_task.status;
  end if;

  -- ------------------------------------------------------------------------
  -- (2) DUE impegni compatibili: non sceglie, e l'appunto non si approva
  -- ------------------------------------------------------------------------
  insert into tasks (title, status, category, origine_modulo)
  values (v_marchio || ' ordine delle verdure lunedi', 'da_fare', 'altro', 'voce')
  returning id into v_b;
  insert into tasks (title, status, category, origine_modulo)
  values (v_marchio || ' ordine delle verdure giovedi', 'da_fare', 'altro', 'voce')
  returning id into v_c;

  v_det := scrivi_dettatura(v_tit, 'detto: segna come fatto (due candidati)', 'app',
    jsonb_build_array(jsonb_build_object(
      'tipo', 'agenda_da_segnare_fatto', 'sicuro', true,
      'frase', 'Segnato come fatto',
      'dati', jsonb_build_object('titolo', v_marchio || ' ordine delle verdure'))),
    'capita', null, 0, 0, null);

  select * into v_riga from azioni_dettate where dettatura_id = (v_det->>'dettatura_id')::uuid;
  if v_riga.tipo <> 'agenda_quale_impegno' then
    raise exception 'Con due impegni compatibili il gestionale ne ha scelto uno: %', v_riga.tipo;
  end if;
  if v_riga.motivo not like '%quale dei 2%' then
    raise exception 'Il motivo non dice che i candidati sono due: %', v_riga.motivo;
  end if;
  select * into v_app from appunti_vocali where id = v_riga.appunto_id;
  if v_app.eseguibile then
    raise exception 'Un appunto ambiguo e'' approvabile.';
  end if;
  if v_app.titolo <> 'Quale impegno?' then
    raise exception 'L''appunto ambiguo si chiama «%»', v_app.titolo;
  end if;

  -- ------------------------------------------------------------------------
  -- (3) NESSUN impegno compatibile: si dice, e non si crea niente
  -- ------------------------------------------------------------------------
  select count(*) into v_n from tasks;
  v_det := scrivi_dettatura(v_tit, 'detto: segna come fatto (nessun candidato)', 'app',
    jsonb_build_array(jsonb_build_object(
      'tipo', 'agenda_da_segnare_fatto', 'sicuro', true,
      'frase', 'Segnato come fatto',
      'dati', jsonb_build_object('titolo', v_marchio || ' una cosa che non esiste'))),
    'capita', null, 0, 0, null);
  select * into v_riga from azioni_dettate where dettatura_id = (v_det->>'dettatura_id')::uuid;
  if v_riga.tipo <> 'agenda_quale_impegno' then
    raise exception 'Senza nessun impegno compatibile la destinazione e'' %', v_riga.tipo;
  end if;
  if v_riga.motivo not like '%non l''ho trovato%' then
    raise exception 'Il motivo non dice che non l''ha trovato: %', v_riga.motivo;
  end if;
  -- 🔴 E NON HA CREATO UN IMPEGNO NUOVO: e'' il difetto della fase 1, che
  --    qui potrebbe tornare da un'altra porta.
  if (select count(*) from tasks) <> v_n then
    raise exception 'Una frase che chiude un impegno ha creato una riga in Agenda.';
  end if;

  -- ------------------------------------------------------------------------
  -- (4) SPOSTARE: mostra i due giorni, e approvando sposta davvero
  -- ------------------------------------------------------------------------
  update tasks set due_date = current_date + 1 where id = v_b;
  v_det := scrivi_dettatura(v_tit, 'detto: sposta', 'app',
    jsonb_build_array(jsonb_build_object(
      'tipo', 'agenda_da_spostare', 'sicuro', true,
      'frase', 'Spostare',
      'dati', jsonb_build_object(
        'titolo', v_marchio || ' ordine delle verdure lunedi',
        'data_nuova', to_char(current_date + 10, 'YYYY-MM-DD')))),
    'capita', null, 0, 0, null);
  select * into v_riga from azioni_dettate where dettatura_id = (v_det->>'dettatura_id')::uuid;
  if v_riga.tipo <> 'agenda_da_spostare' then
    raise exception 'Lo spostamento con un solo candidato e'' diventato %', v_riga.tipo;
  end if;
  if nullif(v_riga.dati->>'data_precedente', '')::date is distinct from current_date + 1 then
    raise exception 'L''appunto non mostra il giorno di partenza: %', coalesce(v_riga.dati->>'data_precedente', '(vuoto)');
  end if;
  if nullif(v_riga.dati->>'data_nuova', '')::date is distinct from current_date + 10 then
    raise exception 'L''appunto non mostra il giorno nuovo: %', coalesce(v_riga.dati->>'data_nuova', '(vuoto)');
  end if;

  perform approva_appunto(v_riga.appunto_id);
  select * into v_task from tasks where id = v_b;
  if v_task.due_date is distinct from current_date + 10 then
    raise exception 'Approvando lo spostamento la scadenza e'' rimasta %', coalesce(v_task.due_date::text, '(vuota)');
  end if;
  if v_task.status <> 'da_fare' then
    raise exception 'Spostare un impegno lo ha anche chiuso.';
  end if;
  -- ⚠️ E l'altro non si e'' mosso: si sposta UNO SOLO.
  select * into v_task from tasks where id = v_c;
  if v_task.due_date is not null then
    raise exception 'Spostando un impegno si e'' mossa anche la scadenza di un altro.';
  end if;

  -- ------------------------------------------------------------------------
  -- (5) SPOSTARE SENZA IL GIORNO: si chiede, non si inventa
  -- ------------------------------------------------------------------------
  v_det := scrivi_dettatura(v_tit, 'detto: sposta senza giorno', 'app',
    jsonb_build_array(jsonb_build_object(
      'tipo', 'agenda_da_spostare', 'sicuro', true, 'frase', 'Spostare',
      'dati', jsonb_build_object('titolo', v_marchio || ' ordine delle verdure giovedi'))),
    'capita', null, 0, 0, null);
  select * into v_riga from azioni_dettate where dettatura_id = (v_det->>'dettatura_id')::uuid;
  if v_riga.tipo <> 'agenda_quale_impegno' then
    raise exception 'Senza il giorno nuovo la destinazione e'' %', v_riga.tipo;
  end if;
  if v_riga.motivo not like '%a quando spostarlo%' then
    raise exception 'Il motivo non chiede il giorno: %', v_riga.motivo;
  end if;

  -- ------------------------------------------------------------------------
  -- (6) L'IMPEGNO CAMBIA FRA LA PROPOSTA E IL «SI'»
  -- ------------------------------------------------------------------------
  -- (6a) chiuso da qualcun altro: l'approvazione si ferma
  v_det := scrivi_dettatura(v_tit, 'detto: segna come fatto (poi chiuso)', 'app',
    jsonb_build_array(jsonb_build_object(
      'tipo', 'agenda_da_segnare_fatto', 'sicuro', true, 'frase', 'Segnato come fatto',
      'dati', jsonb_build_object('titolo', v_marchio || ' ordine delle verdure giovedi'))),
    'capita', null, 0, 0, null);
  select * into v_riga from azioni_dettate where dettatura_id = (v_det->>'dettatura_id')::uuid;
  if v_riga.tipo <> 'agenda_da_segnare_fatto' then
    raise exception 'La proposta non era eseguibile prima del cambiamento: %', v_riga.tipo;
  end if;
  update tasks set status = 'completato' where id = v_c;

  v_msg := null;
  begin
    perform approva_appunto(v_riga.appunto_id);
  exception when others then
    v_msg := sqlerrm;
  end;
  if v_msg is null then
    raise exception 'Un impegno chiuso nel frattempo si e'' lasciato chiudere una seconda volta.';
  end if;

  -- 🔴 E NON HA RIPESCATO UN ALTRO IMPEGNO SOMIGLIANTE. Ce n'e'' uno con un
  --    titolo che contiene lo stesso testo: se la ricerca ripartisse dopo
  --    aver perso l'identificativo, il «si''» chiuderebbe una riga che
  --    nessuno ha mai visto sull'appunto.
  select * into v_task from tasks where id = v_b;
  if v_task.status = 'completato' then
    raise exception 'Approvando si e'' chiuso un impegno DIVERSO da quello proposto.';
  end if;

  -- (6b) spostato da qualcun altro: l'approvazione si ferma e dice i giorni
  update tasks set status = 'da_fare' where id = v_c;
  update tasks set due_date = current_date + 2 where id = v_c;
  v_det := scrivi_dettatura(v_tit, 'detto: sposta (poi spostato da altri)', 'app',
    jsonb_build_array(jsonb_build_object(
      'tipo', 'agenda_da_spostare', 'sicuro', true, 'frase', 'Spostare',
      'dati', jsonb_build_object(
        'titolo', v_marchio || ' ordine delle verdure giovedi',
        'data_nuova', to_char(current_date + 20, 'YYYY-MM-DD')))),
    'capita', null, 0, 0, null);
  select * into v_riga from azioni_dettate where dettatura_id = (v_det->>'dettatura_id')::uuid;
  if v_riga.tipo <> 'agenda_da_spostare' then
    raise exception 'La proposta di spostamento non era eseguibile: %', v_riga.tipo;
  end if;
  update tasks set due_date = current_date + 30 where id = v_c;

  v_msg := null;
  begin
    perform approva_appunto(v_riga.appunto_id);
  exception when others then
    v_msg := sqlerrm;
  end;
  if v_msg is null then
    raise exception 'Un impegno spostato nel frattempo si e'' lasciato riscrivere.';
  end if;
  select * into v_task from tasks where id = v_c;
  if v_task.due_date is distinct from current_date + 30 then
    raise exception 'L''approvazione fermata ha comunque toccato la scadenza: %', v_task.due_date;
  end if;

  -- ------------------------------------------------------------------------
  -- (7) LA META' CHE DISCRIMINA: il promemoria non cambia di una virgola
  -- ------------------------------------------------------------------------
  select count(*) into v_n from tasks;
  v_det := scrivi_dettatura(v_tit, 'detto: ricordami', 'app',
    jsonb_build_array(jsonb_build_object(
      'tipo', 'promemoria', 'sicuro', true, 'frase', 'Promemoria',
      'dati', jsonb_build_object('titolo', v_marchio || ' chiamare Tiziana',
                                 'data', to_char(current_date + 1, 'YYYY-MM-DD')))),
    'capita', null, 0, 0, null);
  select * into v_riga from azioni_dettate where dettatura_id = (v_det->>'dettatura_id')::uuid;
  if v_riga.tipo <> 'promemoria' then
    raise exception 'Il promemoria e'' diventato %', v_riga.tipo;
  end if;
  select * into v_app from appunti_vocali where id = v_riga.appunto_id;
  if not v_app.eseguibile or v_app.titolo <> 'Annota in Agenda' then
    raise exception 'Il promemoria non e'' piu'' quello di prima: «%», approvabile %', v_app.titolo, v_app.eseguibile;
  end if;
  perform approva_appunto(v_riga.appunto_id);
  if (select count(*) from tasks) <> v_n + 1 then
    raise exception 'Approvando un promemoria non e'' nato l''impegno.';
  end if;

  -- ------------------------------------------------------------------------
  -- (8) le uscite a mano, e quelle di prima invariate
  -- ------------------------------------------------------------------------
  if azione_percorso('agenda_da_segnare_fatto') is distinct from '/agenda'
     or azione_percorso('agenda_da_spostare')   is distinct from '/agenda'
     or azione_percorso('agenda_quale_impegno') is distinct from '/agenda' then
    raise exception 'Le tre destinazioni dell''Agenda non portano tutte in Agenda.';
  end if;
  if azione_percorso('promemoria') is distinct from '/agenda/nuovo'
     or azione_percorso('spesa_tasca') is distinct from '/cassa/prima-nota?soggetto=tasca' then
    raise exception 'Un''uscita a mano di prima e'' cambiata.';
  end if;

  raise exception 'ANNULLA-VERIFICA';
  exception when others then
    if sqlerrm <> 'ANNULLA-VERIFICA' then
      raise;
    end if;
  end;

  perform pretendi_nessun_residuo(v_foto, 'la verifica dell''Agenda a voce, fase 2');

  raise notice 'Verifica passata: un impegno si chiude e si sposta a voce, ma solo dopo il si e solo quando e uno solo.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260909000002', 'agenda_chiude_e_sposta_un_impegno') on conflict (version) do nothing;
