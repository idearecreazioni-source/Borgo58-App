-- =====================================================================
-- «MEMO, AGGIUNGI IL FONDO BRUNO ALLE COSE DA FARE»
-- 29/08/2026 — Blocco 3 (l'ultima riga del punto 3e) del mandato
-- =====================================================================
-- Decisione di Alessio: la lista delle cose da fare si modifica anche a
-- voce, e **qui NON serve conferma parlata** — *se sbaglia si cancella una
-- riga*. E' la stessa ragione per cui la lista della spesa si esegue da
-- se': nessun numero si muove, nessun soldo esce, e la riga si toglie con
-- un tocco.
--
-- ---------------------------------------------------------------------
-- I PEZZI SONO CINQUE, E FARNE QUATTRO E' PEGGIO CHE FARNE ZERO
-- ---------------------------------------------------------------------
-- 🔴 Il 27/08 questo progetto ha trovato **quattro tipi accesi
-- nell'elenco e senza nessun ramo che li esegua**: il gestionale sapeva
-- proporre e non sapeva fare, e la frase «questa cosa non la so ancora
-- fare» compariva **dopo** la conferma. Quindi qui si toccano tutti e
-- cinque i posti nello stesso passaggio:
--
--   1. `voce_preparazione_numero()` — il numero del catalogo diventa una
--      ricetta;
--   2. `voce_catalogo()` — l'elenco delle preparazioni, cosi' il modello
--      ha con cosa abbinare;
--   3. `voce_risolvi_dati()` — il numero diventa un identificativo, e se
--      non si trova si CHIEDE invece di indovinare;
--   4. `fai_azione_dettata()` — il ramo che esegue;
--   5. `tipi_azione_vocale` — la riga che accende il tipo.
--
-- ⚠️ E il sesto pezzo NON e' qui: le istruzioni che MEMO legge stanno
-- nella funzione online `ascolta-voce`, e sono cambiate nello stesso
-- commit. Senza quelle, il tipo esiste e nessuno lo produce mai.
--
-- ---------------------------------------------------------------------
-- ⚠️ I CORPI VIVI NON SONO STATI RISCRITTI A MANO
-- ---------------------------------------------------------------------
-- `voce_catalogo`, `voce_risolvi_dati` e `fai_azione_dettata` sono stati
-- ripresi **dal database del progetto di prova** — che con le migrazioni
-- in attesa di push e' l'unico allineato al repository — e il ramo nuovo
-- e' stato innestato da uno script che si ferma se l'ancora non
-- combacia. Nessuna riga di quei corpi e' passata dalle mie dita: e' la
-- regola del 18/08, dove riscrivere una funzione dal file che l'aveva
-- creata annullo' in silenzio due cose aggiunte dopo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Il numero del catalogo diventa una preparazione
-- ---------------------------------------------------------------------
-- ⚠️ LO STESSO ORDINAMENTO del catalogo, ed e' l'unica cosa che tiene
-- insieme le due parti: il modello risponde con un numero, e due
-- ordinamenti diversi farebbero segnare da fare la preparazione
-- sbagliata — **senza nessun errore**, perche' il numero e' valido lo
-- stesso. E' la forma di `voce_prodotto_numero`, copiata apposta.
create or replace function voce_preparazione_numero(p_n integer)
returns uuid
language sql
stable
security definer
set search_path = public
as $corpo$
  select r.id from (
    select row_number() over (order by rc.name) as n, rc.id
      from recipes rc where rc.recipe_type = 'preparazione'
  ) r where r.n = p_n;
$corpo$;

revoke all on function voce_preparazione_numero(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2-4. I tre corpi vivi, col ramo innestato
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.voce_catalogo()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_out jsonb;
begin
  if not is_titolare() then
    raise exception 'Il catalogo della voce e'' riservato al titolare.';
  end if;

  select jsonb_build_object(
    'prodotti', coalesce((
      select jsonb_agg(jsonb_build_object('n', r.n, 'nome', r.name, 'unita', r.unit) order by r.n)
        from (select row_number() over (order by i.name) as n, i.name, i.unit::text as unit
                from ingredients i) r
    ), '[]'::jsonb),
    'frigoriferi', coalesce((
      select jsonb_agg(jsonb_build_object('n', r.n, 'nome', r.name) order by r.n)
        from (select row_number() over (order by e.name) as n, e.name
                from haccp_equipment e where e.active) r
    ), '[]'::jsonb),
    'pulizie', coalesce((
      select jsonb_agg(jsonb_build_object('n', r.n, 'nome', r.name) order by r.n)
        from (select row_number() over (order by c.name) as n, c.name
                from haccp_cleaning_tasks c where c.active) r
    ), '[]'::jsonb),
    'causali', coalesce((
      select jsonb_agg(jsonb_build_object('n', r.n, 'nome', r.label, 'verso', r.kind) order by r.n)
        from (select row_number() over (order by c.kind, c.label) as n, c.label, c.kind
                from cash_causali c
               where c.active and c.kind in ('entrata', 'uscita')) r
    ), '[]'::jsonb),
    'fornitori', coalesce((
      select jsonb_agg(jsonb_build_object('n', r.n, 'nome', r.name) order by r.n)
        from (select row_number() over (order by s.name) as n, s.name from suppliers s) r
    ), '[]'::jsonb),
    'conti_correnti', coalesce((
      select jsonb_agg(jsonb_build_object('nome', b.nome) order by b.nome)
        from conti_bancari b where b.attivo
    ), '[]'::jsonb),
    -- 🔴 GLI ELENCHI DI ALESSIO ARRIVANO QUI (27/08/2026), e non da una
    --    chiamata a parte: la porta della Scorciatoia parla come `anon`, e
    --    una seconda RPC concessa a `authenticated` le risponderebbe di no —
    --    quindi da quella porta MEMO resterebbe senza elenchi proprio dove
    --    Alessio detta con le mani occupate. Il catalogo passa da qui in
    --    entrambe le porte, e questa funzione gira come proprietaria.
    -- LE PREPARAZIONI (29/08/2026, Blocco 3): servono a «MEMO, aggiungi
    --    fondo bruno alle cose da fare».
    -- ⚠️ Lo STESSO ORDINE di `voce_preparazione_numero`, e non e' un
    --    dettaglio: il modello risponde con un NUMERO, e due ordinamenti
    --    diversi farebbero segnare da fare la preparazione sbagliata —
    --    senza nessun errore, perche' il numero e' valido lo stesso.
    'preparazioni', coalesce((
      select jsonb_agg(jsonb_build_object('n', r.n, 'nome', r.name) order by r.n)
        from (select row_number() over (order by rc.name) as n, rc.name
                from recipes rc where rc.recipe_type = 'preparazione') r
    ), '[]'::jsonb),
    'vocabolari', vocabolari_per_assistente()
  ) into v_out;

  return v_out;
end $function$;
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
begin
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

-- ⚠️ I PERMESSI SI RIMETTONO COME ERANO, e non si ricopiano da una
-- funzione accanto: il 24/08 e il 27/08 un `grant` scritto a memoria ha
-- aperto due volte una porta che non c'era. Questi sono quelli letti dal
-- database prima di riscrivere: nessuna delle tre e' concessa a nessuno,
-- perche' le chiama solo la funzione online con la chiave di servizio.
revoke all on function voce_catalogo() from public, anon, authenticated;
revoke all on function voce_risolvi_dati(text, jsonb) from public, anon, authenticated;
revoke all on function fai_azione_dettata(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Il tipo si accende — E SOLO ADESSO, che il ramo c'e'
-- ---------------------------------------------------------------------
insert into tipi_azione_vocale (tipo, natura, titolo, spiega, attivo)
values ('preparazione_da_fare', 'misura', 'Segna una preparazione da fare',
  'Una riga nella lista delle cose da fare in cucina. Non muove nessun numero e non tocca il magazzino: si toglie con un tocco.',
  true)
on conflict (tipo) do update
  set natura = excluded.natura, titolo = excluded.titolo,
      spiega = excluded.spiega, attivo = excluded.attivo;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_foto   jsonb := foto_righe();
  v_ric    uuid;
  v_miei   uuid[] := array[]::uuid[];
  v_n      integer;
  v_cat    jsonb;
  v_ris    jsonb;
  v_fatto  jsonb;
  v_utente uuid;
  v_senza  integer;
begin
  -- ⚠️ I CLAIMS SI IMPOSTANO SUBITO, non a metà blocco: `tipi_vocali_senza_ramo()`
  --    e `voce_catalogo()` hanno il portiere, e una migrazione non ha un
  --    utente — ha un proprietario. Chiamarle prima si ferma con «I comandi
  --    vocali sono del titolare», che è il portiere che funziona.
  select ur.user_id into v_utente from user_roles ur where ur.role = 'titolare' limit 1;
  if v_utente is null then
    raise exception 'Non c''e'' nessun titolare: la verifica non puo'' impersonare nessuno.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_utente, 'role', 'authenticated')::text, true);

  -- (0) 🔴 NESSUN TIPO ACCESO SENZA UN RAMO CHE LO ESEGUA. E' la rete nata
  --     il 27/08, e qui si interroga PRIMA di ogni altra cosa: un tipo che
  --     il gestionale sa proporre e non sa fare dice «questa cosa non la so
  --     ancora fare» DOPO la conferma, cioe' dopo che chi guarda ha gia'
  --     deciso di si'.
  select count(*) into v_senza from tipi_vocali_senza_ramo();
  if v_senza <> 0 then
    raise exception 'Ci sono % tipi vocali accesi senza un ramo che li esegua.', v_senza;
  end if;

  -- (1) LE SOSTITUZIONI HANNO ATTECCHITO in tutti e tre i corpi vivi.
  if pg_get_functiondef('voce_catalogo()'::regprocedure) not like '%preparazioni%' then
    raise exception 'voce_catalogo non porta l''elenco delle preparazioni.';
  end if;
  if pg_get_functiondef('voce_risolvi_dati(text,jsonb)'::regprocedure)
       not like '%voce_preparazione_numero%' then
    raise exception 'voce_risolvi_dati non risolve il numero della preparazione.';
  end if;
  if pg_get_functiondef('fai_azione_dettata(text,jsonb)'::regprocedure)
       not like '%preparazione_da_fare%' then
    raise exception 'fai_azione_dettata non ha il ramo delle preparazioni da fare.';
  end if;

  -- ⚠️ IL PERIMETRO SE LO COSTRUISCE QUESTA VERIFICA. Il nome comincia per
  -- «zzz» apposta: cosi' e' l'ULTIMA in ordine alfabetico, e il suo numero
  -- di catalogo si sa senza doverlo indovinare.
  insert into recipes (name, category, recipe_type, yield_quantity, yield_unit)
  values ('zzz VERIFICA-29AGO voce', 'antipasto', 'preparazione', 1, 'kg')
  returning id into v_ric;
  v_miei := v_miei || v_ric;

  -- (2) IL CATALOGO LA NOMINA, e il numero e' l'ultimo.
  v_cat := voce_catalogo();
  select count(*)::integer into v_n from jsonb_array_elements(v_cat -> 'preparazioni');
  if v_n = 0 then
    raise exception 'Il catalogo della voce non elenca nessuna preparazione.';
  end if;
  if (v_cat -> 'preparazioni' -> (v_n - 1) ->> 'nome') is distinct from 'zzz VERIFICA-29AGO voce' then
    raise exception 'L''ultima preparazione del catalogo e'' «%» invece della mia.',
      v_cat -> 'preparazioni' -> (v_n - 1) ->> 'nome';
  end if;

  -- (3) 🔴 IL NUMERO PORTA ALLA RICETTA GIUSTA. E' il controllo che tiene
  --     insieme il catalogo e chi lo legge: se i due ordinamenti
  --     divergessero, il numero resterebbe valido e la preparazione
  --     segnata sarebbe un'altra — senza nessun errore.
  if voce_preparazione_numero(v_n) is distinct from v_ric then
    raise exception 'Il numero % del catalogo non porta alla preparazione giusta.', v_n;
  end if;

  -- (4) I DATI SI RISOLVONO, e il numero sparisce a favore dell'identificativo.
  v_ris := voce_risolvi_dati('preparazione_da_fare',
    jsonb_build_object('preparazione', v_n, 'nome_sentito', 'quella cosa'));
  if (v_ris -> 'dati' ->> 'recipe_id') is distinct from v_ric::text then
    raise exception 'Il numero non e'' diventato un identificativo: %', v_ris;
  end if;
  if v_ris ->> 'manca' is not null then
    raise exception 'Con un numero valido dice che manca qualcosa: %', v_ris ->> 'manca';
  end if;

  -- (5) 🔴 UN NUMERO CHE NON PORTA A NIENTE CHIEDE, e non tira a
  --     indovinare. Segnare la preparazione sbagliata non rompe niente, ma
  --     fa cucinare la cosa sbagliata.
  v_ris := voce_risolvi_dati('preparazione_da_fare',
    jsonb_build_object('preparazione', 99999, 'nome_sentito', 'il ragu di ieri'));
  if v_ris ->> 'manca' is null then
    raise exception 'Con un numero inesistente non chiede niente: %', v_ris;
  end if;
  if (v_ris ->> 'manca') not like '%il ragu di ieri%' then
    raise exception 'La domanda non ripete quello che ha sentito: %', v_ris ->> 'manca';
  end if;

  -- (6) E IL RAMO ESEGUE DAVVERO.
  v_fatto := fai_azione_dettata('preparazione_da_fare',
    jsonb_build_object('recipe_id', v_ric));
  if (v_fatto ->> 'aggiunta') is distinct from 'true' then
    raise exception 'Il ramo non ha messo la preparazione fra le cose da fare: %', v_fatto;
  end if;

  -- (7) E LA SECONDA VOLTA NON SI ROMPE: risponde «c'era gia'».
  v_fatto := fai_azione_dettata('preparazione_da_fare',
    jsonb_build_object('recipe_id', v_ric));
  if (v_fatto ->> 'gia_c_era') is distinct from 'true' then
    raise exception 'Dettandola due volte non dice che c''era gia'': %', v_fatto;
  end if;

  perform set_config('request.jwt.claims', null, true);
  delete from preparazioni_da_fare where recipe_id = any(v_miei);
  delete from recipes where id = any(v_miei);

  perform pretendi_nessun_residuo(v_foto, 'la verifica della preparazione dettata');
  raise notice 'Il numero del catalogo porta alla preparazione giusta, e il ramo la mette fra le cose da fare senza chiedere conferma.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000018', 'la_preparazione_si_segna_a_voce') on conflict (version) do nothing;
