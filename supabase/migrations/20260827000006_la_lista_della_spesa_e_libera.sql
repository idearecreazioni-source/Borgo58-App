-- ============================================================================
-- LA LISTA DELLA SPESA NON CERCA NIENTE IN MAGAZZINO — 27/08/2026
-- ============================================================================
--
-- **Decisione di Alessio**, presa guardando il gestionale lavorare: la lista
-- della spesa e' un **elenco libero di cosa prendere**, e non accoppia mai
-- col magazzino. L'accoppiamento si fa dopo, con la foto del documento
-- quando la merce arriva davvero in cucina.
--
-- ----------------------------------------------------------------------------
-- IL COMPORTAMENTO DI PRIMA ERA INCOERENTE, e si e' visto usandolo
-- ----------------------------------------------------------------------------
-- Detto «servono un rotolo di carta forno e due pacchi di sale grosso»:
--   · la **carta forno** e' passata — nessun prodotto somigliante, quindi
--     nome libero, quindi in lista;
--   · il **sale grosso** si e' **fermato in attesa** — due prodotti
--     somiglianti in magazzino e nessuno che sapesse quale.
--
-- 🔴 Cioe': **se non trovava niente scriveva, se trovava troppo si fermava**.
--    Il gesto piu' semplice del gestionale — segnarsi cosa comprare —
--    diventava piu' difficile man mano che il magazzino si riempiva.
--
-- ----------------------------------------------------------------------------
-- ⚠️ NON E' «CERCA MA NON BLOCCARE»: NON CERCA AFFATTO
-- ----------------------------------------------------------------------------
-- La differenza non e' di sfumatura. «Cerca ma non bloccare» lascerebbe il
-- gestionale ad **abbinare da solo** quando trova un solo candidato — e
-- quell'abbinamento e' precisamente quello che Alessio ha deciso di fare
-- dopo, guardando il documento vero. Un abbinamento silenzioso fatto sul
-- suono di un nome e' la strada per cui in lista finisce «Sale marino di
-- Trapani» quando lui voleva del sale grosso qualunque.
--
-- Quello che si dice finisce in lista **come si e' detto**.
--
-- ⚠️ Il vincolo `item_has_a_name` pretende un ingrediente **oppure** un nome
--    scritto: con questa modifica passa sempre dal secondo, che e' la strada
--    che quel vincolo prevedeva gia'.
-- ============================================================================

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

  return jsonb_build_object('dati', v_dati, 'manca', v_manca);
end $$;

revoke all on function voce_risolvi_dati(text, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- E il ramo che scrive non passa piu' nessun ingrediente
-- ----------------------------------------------------------------------------
-- ⚠️ Il corpo e' ripreso dal DATABASE e cambia solo nel ramo `lista_spesa`.

do $riscrivi$
declare
  v_corpo text := pg_get_functiondef('public.fai_azione_dettata(text,jsonb)'::regprocedure);
  v_vecchio text := 'return jsonb_build_object(''item'', add_shopping_list_item(
        nullif(p_dati->>''ingredient_id'', '''')::uuid,';
  v_nuovo text := 'return jsonb_build_object(''item'', add_shopping_list_item(
        -- 🔴 SEMPRE NULL, ed e'' la decisione del 27/08: la lista della
        --    spesa non accoppia mai col magazzino. Quello che si dice
        --    finisce in lista come si e'' detto, e l''abbinamento si fa
        --    dopo, con la foto del documento quando la merce arriva.
        null,';
begin
  if position(v_vecchio in v_corpo) = 0 then
    raise exception 'Il ramo della lista della spesa non ha la forma attesa: il corpo vivo e'' cambiato e questa sostituzione andrebbe a vuoto.';
  end if;
  execute replace(v_corpo, v_vecchio, v_nuovo);
end $riscrivi$;

revoke all on function fai_azione_dettata(text, jsonb) from public, anon, authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_foto  jsonb;
  v_tit   uuid;
  v_r     jsonb;
  v_righe text[] := '{}';
  v_id    uuid;
  v_nome  text;
begin
  v_foto := foto_righe();
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  -- (1) UN PRODOTTO CHE ESISTE DAVVERO IN MAGAZZINO non ferma piu' niente.
  --     🔴 Il caso e' quello vero: il modello manda il numero del catalogo,
  --        e adesso quel numero viene buttato via invece di essere risolto.
  select name into v_nome from ingredients order by name limit 1;
  v_r := voce_risolvi_dati('lista_spesa', jsonb_build_object(
           'prodotto', 1, 'nome_sentito', v_nome, 'quantita', 2));
  if nullif(v_r->>'manca', '') is not null then
    raise exception 'La lista della spesa si e'' fermata su un prodotto noto: «%»', v_r->>'manca';
  end if;
  if nullif(v_r->'dati'->>'ingredient_id', '') is not null then
    raise exception 'La lista della spesa ha accoppiato col magazzino: doveva non cercare affatto.';
  end if;
  if v_r->'dati'->>'nome_libero' is distinct from v_nome then
    raise exception 'Il nome detto non e'' finito in lista come si e'' detto.';
  end if;

  -- (2) UN NOME CHE IN MAGAZZINO NON C'E' passa come prima.
  v_r := voce_risolvi_dati('lista_spesa', jsonb_build_object(
           'nome_sentito', 'VERIFICA carta forno', 'quantita', 1));
  if nullif(v_r->>'manca', '') is not null then
    raise exception 'Un nome libero si e'' fermato: «%»', v_r->>'manca';
  end if;

  -- (3) L'UNICA COSA CHE PUO' MANCARE E' «cosa».
  v_r := voce_risolvi_dati('lista_spesa', '{}'::jsonb);
  if nullif(v_r->>'manca', '') is null then
    raise exception 'Una riga di lista senza nessun nome e'' passata.';
  end if;

  -- (4) E LA RIGA NASCE DAVVERO, senza ingrediente attaccato.
  v_r := fai_azione_dettata('lista_spesa', jsonb_build_object(
           'nome_libero', 'VERIFICA lista libera', 'quantita', 3, 'unita', 'pz'));
  v_id := (v_r->>'item')::uuid;
  v_righe := v_righe || v_id::text;
  if (select ingredient_id from shopping_list_items where id = v_id) is not null then
    raise exception 'La riga nata a voce porta un ingrediente: doveva restare libera.';
  end if;
  if (select custom_name from shopping_list_items where id = v_id)
     is distinct from 'VERIFICA lista libera' then
    raise exception 'La riga nata a voce non porta il nome detto.';
  end if;

  -- (5) LA ROTTURA CHE SI PUO' FARE A MANO: se qualcuno rimettesse
  --     l'identificativo nei dati, non deve arrivare in tabella.
  v_r := fai_azione_dettata('lista_spesa', jsonb_build_object(
           'nome_libero', 'VERIFICA lista con id',
           'ingredient_id', (select id from ingredients order by name limit 1)));
  v_id := (v_r->>'item')::uuid;
  v_righe := v_righe || v_id::text;
  if (select ingredient_id from shopping_list_items where id = v_id) is not null then
    raise exception 'Un identificativo passato a mano e'' arrivato in tabella.';
  end if;

  delete from shopping_list_items where id::text = any(v_righe);
  delete from deleted_records where record_id = any(v_righe);

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della lista libera');
  raise notice 'verifica: la lista della spesa non cerca piu'' in magazzino, e nessuna riga si ferma';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000006', 'la_lista_della_spesa_e_libera')
on conflict (version) do nothing;
