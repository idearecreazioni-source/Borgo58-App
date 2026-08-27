-- ============================================================================
-- LE QUATTRO CHE IL GESTIONALE PROMETTEVA E NON SAPEVA FARE — 27/08/2026
-- ============================================================================
--
-- 🔴 IL DIFETTO, misurato leggendo il corpo vivo di `fai_azione_dettata` e
--    l'elenco `tipi_azione_vocale`: undici tipi accesi, SETTE rami. I quattro
--    scoperti sono esattamente i quattro di natura `creazione` —
--    `movimento_cassa`, `carico_merce`, `prodotto_nuovo`, `ricetta`.
--
--    Cioe': il criterio del 25/08 che regge tutto il modulo — *la misura si
--    salva da se', la creazione passa dai tuoi occhi* — era **meta'
--    costruito**. Il gestionale sapeva PROPORRE cio' che tocca i soldi e non
--    sapeva ESEGUIRLO quando Alessio premeva «Si', fallo». La porta che passa
--    dai suoi occhi non portava da nessuna parte.
--
--    ⚠️ E non e' un buco che si vede leggendo: nessun errore, nessun avviso.
--       Si vede premendo. Alessio l'ha trovato dettando «ho pagato trenta
--       euro al fornitore», premendo due volte, e andando a guardare la
--       Prima Nota — dove quei trenta euro non c'erano.
--
-- ----------------------------------------------------------------------------
-- LA RETE, PERCHE' NON POSSA RIPETERSI
-- ----------------------------------------------------------------------------
-- `tipi_vocali_senza_ramo()` legge il **corpo vivo** di `fai_azione_dettata`
-- e nomina i tipi accesi che non hanno un `when`. Un tipo acceso nell'elenco
-- senza esecuzione e' una promessa che il gestionale non mantiene, e da oggi
-- lo dice da se' invece che scoprirlo una mano.
--
-- ⚠️ Guarda il CORPO e non un elenco scritto a mano, per la ragione di
--    sempre: un elenco a mano e' gia' scaduto il giorno dopo.
--
-- ----------------------------------------------------------------------------
-- COME I DATI ARRIVANO QUI — e perche' il numero, mai il nome
-- ----------------------------------------------------------------------------
-- Il catalogo numera quello che il locale ha davvero, il modello risponde
-- **col numero**, e qui si ritraduce. Vale gia' per prodotti, frigoriferi e
-- pulizie; da oggi anche per **causali di prima nota** e **fornitori**.
--
-- ⚠️ Le causali sono numerate in UN elenco solo, entrate e uscite insieme:
--    cosi' il numero porta con se' il verso, e una causale d'entrata usata su
--    un'uscita **si rifiuta** invece di finire storta in prima nota.
--
-- ----------------------------------------------------------------------------
-- 🔴 IL MOVIMENTO DI BANCA E I CONTI CHE NON CI SONO
-- ----------------------------------------------------------------------------
-- Il vincolo `movimento_di_banca_ha_un_conto` pretende un conto corrente, e
-- oggi i conti sono ZERO. Lasciarlo fallire da se' darebbe a chi e' in cella
-- un errore di vincolo, cioe' un guasto. Quindi:
--   · nessun conto  → si rifiuta **dicendo cosa fare prima**;
--   · un conto solo → si usa quello (non e' indovinare: e' l'unico);
--   · piu' conti    → si chiede quale.
--
-- ----------------------------------------------------------------------------
-- LA CAUSALE RESTA FACOLTATIVA, E LA FRASE LO DICE
-- ----------------------------------------------------------------------------
-- ⚠️ E' la scelta meno ovvia di questo blocco, e va scritta perche' non venga
--    rovesciata per distrazione. «Ho pagato trenta euro al fornitore» non
--    contiene nessuna causale, ed e' il modo normale di dirlo. Pretenderla
--    fermerebbe il gesto piu' frequente.
--    **Il difetto peggiore e' dimenticare l'uscita, non classificarla dopo**:
--    un movimento senza causale e' gia' un caso previsto — lo raccoglie
--    `costi_da_classificare()` — mentre trenta euro mai registrati sono un
--    ammanco di cassa che nessuno sa spiegare.
--    La risposta dichiara `senza_causale`, cosi' non e' un silenzio.
--
-- ----------------------------------------------------------------------------
-- LA DATA E' LA SERATA, NON IL CALENDARIO
-- ----------------------------------------------------------------------------
-- `cash_movements.movement_date` e' uno degli undici punti che intendono la
-- **serata di servizio**: un'uscita dettata all'una di notte appartiene alla
-- sera prima. Si passa `serata_di_servizio(now())` — mai `current_date`, che
-- a quell'ora risponde col giorno di Greenwich.
--
-- ----------------------------------------------------------------------------
-- QUELLO CHE QUESTA MIGRAZIONE **NON** FA, dichiarato
-- ----------------------------------------------------------------------------
-- · `prodotto_nuovo` fa **la cosa minima che funziona oggi**: nome, categoria,
--   unita'. Niente allergeni, niente conservazione, niente soglia — quella e'
--   la scheda, e la separazione fra prodotto e ingrediente (il prossimo
--   mandato) riscrivera' quella parte. Anticiparla qui sarebbe lavoro doppio.
-- · `ricetta` crea **lo scheletro**: nome, categoria, porzioni, e il testo
--   dettato per intero nelle note. **Nessuna riga di ingredienti**, ed e' una
--   scelta e non una resa: una quantita' di riga sbagliata sposta il food
--   cost **in silenzio**, che e' precisamente l'errore che il criterio del
--   25/08 esiste per evitare — e le righe sono la parte che la separazione
--   fra prodotto e ingrediente riscrivera'.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Gli aiuti che ritraducono il numero
-- ----------------------------------------------------------------------------

create or replace function voce_causale_numero(p_n integer)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.id from (
    select row_number() over (order by c.kind, c.label) as n, c.id
      from cash_causali c
     where c.active and c.kind in ('entrata', 'uscita')
  ) r where r.n = p_n;
$$;

comment on function voce_causale_numero(integer) is
  'La causale di prima nota che porta questo numero nel catalogo della voce. Entrate e uscite in un elenco solo: cosi'' il numero porta con se'' il verso.';

create or replace function voce_fornitore_numero(p_n integer)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.id from (
    select row_number() over (order by s.name) as n, s.id from suppliers s
  ) r where r.n = p_n;
$$;

comment on function voce_fornitore_numero(integer) is
  'Il fornitore che porta questo numero nel catalogo della voce.';

revoke all on function voce_causale_numero(integer) from public, anon, authenticated;
revoke all on function voce_fornitore_numero(integer) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Il catalogo che il modello riceve
-- ----------------------------------------------------------------------------
-- ⚠️ La numerazione delle causali e dei fornitori e' la STESSA riga di codice
--    che poi ritraduce (`voce_causale_numero`, `voce_fornitore_numero`): non
--    possono divergere nemmeno se qualcuno rinomina una causale mentre
--    Alessio sta parlando.
--
-- ⚠️ I conti correnti entrano nel catalogo anche quando sono zero, e
--    l'elenco vuoto e' un'informazione: dice al modello che «bonifico» non ha
--    ancora dove appoggiarsi.

create or replace function voce_catalogo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
    ), '[]'::jsonb)
  ) into v_out;

  return v_out;
end $$;

revoke all on function voce_catalogo() from public, anon, authenticated;
grant execute on function voce_catalogo() to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Che cosa manca prima di poterla fare
-- ----------------------------------------------------------------------------
-- ⚠️ Sta QUI e non dentro `fai_azione_dettata` per la ragione di sempre: e' la
--    stessa funzione che riempie i dati di una riga rimasta in attesa, e la
--    frase che restituisce e' quella che Alessio legge. Un rifiuto di vincolo
--    non e' un rifiuto: e' un guasto.

create or replace function voce_risolvi_dati(p_tipo text, p_dati jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
  if p_tipo in ('giacenza', 'merce_buttata', 'lista_spesa', 'carico_merce') then
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
      if p_tipo = 'lista_spesa' then
        -- ⚠️ Sulla lista della spesa un nome scritto a mano e' una riga
        --    legittima: «prendi la carta forno» non e' un prodotto del
        --    ricettario e non deve diventarlo.
        if nullif(v_dati->>'nome_libero', '') is null and v_sentito is not null then
          v_dati := v_dati || jsonb_build_object('nome_libero', v_sentito);
        end if;
        if nullif(v_dati->>'nome_libero', '') is null then
          v_manca := 'Non ho capito che cosa aggiungere alla lista.';
        end if;
      else
        v_manca := case
          when v_perso then
            'Il prodotto che mi avevi indicato non c''e'' piu'' fra quelli del gestionale: dimmi tu qual e''.'
          when v_sentito is not null then
            'Non ho trovato «' || v_sentito || '» fra i prodotti: dimmi tu qual e''.'
          else
            'Non ho capito di quale prodotto stavi parlando.'
        end;
      end if;
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

    -- La causale: si accetta il numero, si controlla il VERSO, e se non c'e'
    -- si va avanti lo stesso (vedi la nota in testa a questa migrazione).
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
          -- Non e' indovinare: e' l'unico che c'e'.
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

  return jsonb_build_object('dati', v_dati, 'manca', v_manca);
end $$;

revoke all on function voce_risolvi_dati(text, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. E adesso le fa
-- ----------------------------------------------------------------------------
-- ⚠️ Il corpo e' ripreso dal DATABASE (regola del 18/08: mai dal file che
--    l'ha creata) e cambia solo per i quattro rami nuovi in fondo.

create or replace function fai_azione_dettata(p_tipo text, p_dati jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

    when 'lista_spesa' then
      -- ⚠️ Il nome libero e' ammesso apposta: «prendi la carta forno» non
      --    e' un prodotto del ricettario e non deve diventarlo. Aggiungere
      --    una riga alla lista non crea niente in magazzino.
      return jsonb_build_object('item', add_shopping_list_item(
        nullif(p_dati->>'ingredient_id', '')::uuid,
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
        (p_dati->>'categoria')::ingredient_category,
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
end $$;

revoke all on function fai_azione_dettata(text, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. LA RETE — un tipo acceso senza esecuzione e' una promessa non mantenuta
-- ----------------------------------------------------------------------------
-- ⚠️ Legge il **corpo vivo** e non un elenco scritto a mano: un elenco a mano
--    sarebbe gia' scaduto al prossimo tipo aggiunto, che e' esattamente il
--    modo in cui questo buco e' nato.
--
-- ⚠️ `pg_get_functiondef` si chiama su UNA funzione per nome, mai ciclando su
--    `pg_proc`: quel ciclo il 23/08 ha fermato una migrazione in produzione
--    perche' il motore calcolava la definizione di ogni funzione del catalogo.

create or replace function tipi_vocali_senza_ramo()
returns table (tipo text, natura text, titolo text)
language sql
stable
security definer
set search_path = public
as $$
  select t.tipo, t.natura, t.titolo
    from tipi_azione_vocale t
   where t.attivo
     and position('when ''' || t.tipo || '''' in
           pg_get_functiondef('public.fai_azione_dettata(text,jsonb)'::regprocedure)) = 0
   order by t.tipo;
$$;

comment on function tipi_vocali_senza_ramo() is
  'I tipi di comando vocale ACCESI che `fai_azione_dettata` non sa eseguire. Deve essere vuota: un tipo acceso senza esecuzione e'' una cosa che il gestionale propone e non fa, e non da'' nessun errore finche'' qualcuno non preme «Si'', fallo».';

revoke all on function tipi_vocali_senza_ramo() from public, anon, authenticated;
grant execute on function tipi_vocali_senza_ramo() to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_foto    jsonb;
  v_tit     uuid;
  v_ent     uuid;
  v_miei    text[] := '{}';
  v_ric     text[] := '{}';
  v_x       uuid;
  v_r       jsonb;
  v_n       integer;
  v_caus    uuid;
  v_txt     text;
  v_prima   numeric;
  v_dopo    numeric;
begin
  v_foto := foto_righe();
  select id into v_ent from entities where entity_type = 'srls' limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  -- (1) LA RETE E' VUOTA — e' una proprieta', non un conteggio.
  select count(*) into v_n from tipi_vocali_senza_ramo();
  if v_n <> 0 then
    raise exception 'Ci sono % tipi vocali accesi che il gestionale non sa eseguire: %',
      v_n, (select string_agg(tipo, ', ') from tipi_vocali_senza_ramo());
  end if;

  -- (2) LA RETE DISCRIMINA: un tipo finto senza ramo dev'essere nominato.
  --     ⚠️ Un guardiano che risponde «zero» al primo colpo non ha ancora
  --        detto niente.
  insert into tipi_azione_vocale (tipo, natura, titolo, attivo)
  values ('verifica_tipo_finto', 'creazione', 'Tipo finto della verifica', true);
  if not exists (select 1 from tipi_vocali_senza_ramo() where tipo = 'verifica_tipo_finto') then
    raise exception 'La rete NON discrimina: un tipo acceso senza ramo non viene nominato.';
  end if;
  delete from tipi_azione_vocale where tipo = 'verifica_tipo_finto';

  -- (3) IL CATALOGO PORTA LE CAUSALI, e il numero ritraduce.
  if jsonb_array_length(voce_catalogo()->'causali') = 0 then
    raise exception 'Il catalogo della voce non porta nessuna causale: il modello non puo'' sceglierne una.';
  end if;
  v_n := (voce_catalogo()->'causali'->0->>'n')::integer;
  if voce_causale_numero(v_n) is null then
    raise exception 'Il numero della prima causale del catalogo non ritraduce a niente.';
  end if;

  -- (4) UN MOVIMENTO DI CASSA NASCE DAVVERO, e il saldo scende.
  select id into v_caus from cash_causali where kind = 'uscita' and active order by label limit 1;
  select coalesce(balance, 0) into v_prima from v_cash_balance where entity_id = v_ent;
  v_r := fai_azione_dettata('movimento_cassa', jsonb_build_object(
           'verso', 'uscita', 'importo', 30, 'causale_id', v_caus,
           'mezzo', 'cassa', 'descrizione', 'VERIFICA voce'));
  if (v_r->>'movimento_id') is null then
    raise exception 'Il movimento di cassa dettato non ha prodotto nessuna riga.';
  end if;
  v_miei := v_miei || (v_r->>'movimento_id');
  select coalesce(balance, 0) into v_dopo from v_cash_balance where entity_id = v_ent;
  if v_dopo <> v_prima - 30 then
    raise exception 'Il saldo di cassa non e'' sceso di 30: era %, adesso e'' %.',
      euro(v_prima), euro(v_dopo);
  end if;
  -- 🔴 LA DATA E' LA SERATA, non il calendario.
  if (select movement_date from cash_movements where id::text = v_miei[1])
     is distinct from serata_di_servizio(now()) then
    raise exception 'Il movimento dettato non porta la data della serata di servizio.';
  end if;

  -- (5) LA CAUSALE DEL VERSO SBAGLIATO SI RIFIUTA, e lo dice.
  select id into v_x from cash_causali where kind = 'entrata' and active order by label limit 1;
  v_r := voce_risolvi_dati('movimento_cassa', jsonb_build_object(
           'verso', 'uscita', 'importo', 10, 'causale_id', v_x, 'mezzo', 'cassa'));
  if nullif(v_r->>'manca', '') is null then
    raise exception 'Una causale d''entrata usata su un''uscita e'' passata senza dire niente.';
  end if;

  -- (6) LA BANCA SENZA CONTI DICE COSA FARE, invece di rompersi sul vincolo.
  if (select count(*) from conti_bancari where attivo) = 0 then
    v_r := voce_risolvi_dati('movimento_cassa', jsonb_build_object(
             'verso', 'uscita', 'importo', 10, 'mezzo', 'banca'));
    if nullif(v_r->>'manca', '') is null then
      raise exception 'Un movimento di banca senza nessun conto corrente e'' passato: sarebbe fallito sul vincolo.';
    end if;
    if v_r->>'manca' not like '%Conti correnti%' then
      raise exception 'Il rifiuto del movimento di banca non dice dove si aggiunge un conto: «%»', v_r->>'manca';
    end if;
  end if;

  -- (7) UN PRODOTTO NUOVO NASCE, E IL DOPPIONE SI RIFIUTA.
  v_txt := 'VERIFICA voce prodotto ' || gen_random_uuid()::text;
  v_r := fai_azione_dettata('prodotto_nuovo', jsonb_build_object(
           'nome', v_txt, 'categoria', 'verdura', 'unita', 'kg'));
  v_x := (v_r->>'ingredient_id')::uuid;
  if v_x is null then
    raise exception 'Il prodotto nuovo dettato non e'' nato.';
  end if;
  begin
    perform fai_azione_dettata('prodotto_nuovo', jsonb_build_object(
      'nome', lower(v_txt), 'categoria', 'verdura', 'unita', 'kg'));
    raise exception 'Il doppione di un prodotto e'' passato: due giacenze per la stessa merce.';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%c''e'' gia''%' then raise; end if;
  end;

  -- (8) IL CARICO DI MERCE METTE DAVVERO LA MERCE IN MAGAZZINO.
  v_r := fai_azione_dettata('carico_merce', jsonb_build_object(
           'ingredient_id', v_x, 'quantita', 6));
  if (select quantity_remaining from stock_lots where id = (v_r->>'lotto_id')::uuid) <> 6 then
    raise exception 'Il carico dettato non ha messo in magazzino 6 di quel prodotto.';
  end if;

  -- (9) LA RICETTA NASCE SCHELETRO, e il testo dettato resta scritto.
  v_txt := 'VERIFICA voce ricetta ' || gen_random_uuid()::text;
  v_r := fai_azione_dettata('ricetta', jsonb_build_object(
           'nome', v_txt, 'categoria', 'primo', 'porzioni', 4,
           'sentito', 'pasta con le sarde per quattro'));
  v_ric := v_ric || (v_r->>'recipe_id');
  if (select notes from recipes where id::text = v_ric[1]) not like '%sarde%' then
    raise exception 'La ricetta dettata non conserva quello che e'' stato detto.';
  end if;
  if (select count(*) from recipe_ingredients where recipe_id::text = v_ric[1]) <> 0 then
    raise exception 'La ricetta dettata ha righe di ingredienti: qui si crea solo lo scheletro.';
  end if;

  -- (10) IL PRODOTTO NUOVO SENZA UNITA' SI FERMA E LO DICE.
  v_r := voce_risolvi_dati('prodotto_nuovo', jsonb_build_object('nome', 'qualcosa'));
  if nullif(v_r->>'manca', '') is null then
    raise exception 'Un prodotto nuovo senza unita'' di misura e'' passato.';
  end if;

  -- ------------------------------------------------------------------------
  -- PULIZIA — solo per identificativo, e gli identificativi in un ELENCO
  -- ------------------------------------------------------------------------
  delete from stock_consumptions where ingredient_id = v_x;
  delete from stock_lots where ingredient_id = v_x;
  delete from price_history where ingredient_id = v_x;
  delete from ingredients where id = v_x;
  delete from recipes where id::text = any(v_ric);
  delete from cash_movements where id::text = any(v_miei);
  delete from deleted_records where record_id = any(v_miei) or record_id = any(v_ric)
     or record_id = v_x::text;

  if (select coalesce(balance, 0) from v_cash_balance where entity_id = v_ent) <> v_prima then
    raise exception 'Il saldo di cassa non e'' tornato a quello di partenza.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica delle quattro azioni vocali');
  raise notice 'verifica: 10 controlli passati, nessun residuo, saldo di cassa tornato a %', euro(v_prima);
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000002', 'le_quattro_che_prometteva_e_non_faceva')
on conflict (version) do nothing;
