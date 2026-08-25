-- ============================================================================
-- I COMANDI VOCALI — «buttata» non restituisce niente — 26/08/2026
-- ============================================================================
--
-- 🔴 DIFETTO MIO, TROVATO PARLANDO DAVVERO. Dettando «buttane mezzo chilo
--    di ricotta di pecora che e' andata a male», il gestionale trovava il
--    prodotto giusto, capiva la quantita' giusta, e poi falliva con
--    *«invalid input syntax for type json»*. La causa e' banale:
--    `record_stock_consumption` restituisce **void**, e io scrivevo
--    `return record_stock_consumption(...)` da una funzione che dichiara
--    di restituire jsonb.
--
-- ----------------------------------------------------------------------------
-- 🔴 MA LA COSA CHE VALE DI PIU' E' PERCHE' LA VERIFICA NON L'AVEVA PRESO
-- ----------------------------------------------------------------------------
-- La verifica della `…0002` PROVAVA quel ramo: dettava «butta due chili di
-- una cosa che non c'e'» e controllava che l'azione fallisse. Falliva, e la
-- prova era verde.
--
-- ⚠️ Ma falliva PER LA RAGIONE SBAGLIATA: non perche' il prodotto non
--    esisteva — cioe' la cosa che si voleva provare — ma perche' il tipo di
--    ritorno era sbagliato. **Le due cause producono lo stesso rosso**, e
--    una prova che guarda solo «e' fallito?» non le distingue.
--
-- ⚠️ E' la trappola del caso vuoto (17/08) in una forma nuova: li' si
--    provava su dati che non avevano niente da fare, qui si prova un
--    fallimento senza guardare **di che fallimento si tratta**. La regola
--    che ne esce vale oltre questo caso: *quando una prova si aspetta un
--    rifiuto, deve guardare CHE COSA dice il rifiuto* — altrimenti
--    qualunque rottura, anche una che non c'entra niente, la fa passare.
--
-- ⚠️ Qui la verifica prova il ramo su un prodotto VERO CON GIACENZA VERA,
--    perche' e' il solo modo di percorrerlo fino in fondo. Il prodotto se
--    lo crea lei (regola del 16/08: il perimetro di una prova e' fatto di
--    roba che la prova ha creato — quella volta FEFO prese da un lotto di
--    Alessio e la giacenza vera rimase corta di due).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- E UN SECONDO DIFETTO, PIU' GROSSO, TROVATO DALLA VERIFICA DI QUESTA STESSA
-- MIGRAZIONE
-- ----------------------------------------------------------------------------
-- 🔴 CONFERMARE UNA COSA RIMASTA IN ATTESA SAREBBE FALLITO SEMPRE.
--    `voce_risolvi_dati` cerca il NUMERO del catalogo; quando conferma,
--    `esegui_azione_dettata` le passa dei dati in cui il numero non c'e'
--    piu' — c'e' gia' l'identificativo, tradotto la prima volta. Quindi
--    rispondeva «non ho capito di quale prodotto stavi parlando» **su
--    un'azione in cui il prodotto era scritto per esteso**.
--
-- ⚠️ Il difetto non riguarda solo la conferma: riguarda ogni strada che
--    porti un identificativo gia' risolto. Ora la regola e' semplice — se
--    l'identificativo c'e' gia', non serve nessun numero — e vale per
--    tutti e tre i cataloghi.
--
-- ⚠️ E NON L'HA TROVATO UNA RILETTURA: l'ha trovato una verifica che si
--    aspettava un fallimento e ha guardato QUALE. Attesa «fallita»,
--    ottenuta «in attesa»: due esiti diversi che una prova distratta
--    avrebbe letto tutti e due come «non e' andata».
-- ----------------------------------------------------------------------------
create or replace function voce_risolvi_dati(p_tipo text, p_dati jsonb)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $funzione$
declare
  v_dati    jsonb := coalesce(p_dati, '{}'::jsonb);
  v_n       integer;
  v_id      uuid;
  v_sentito text := nullif(btrim(coalesce(v_dati->>'nome_sentito', '')), '');
  v_manca   text := null;
begin
  if p_tipo in ('giacenza', 'merce_buttata', 'lista_spesa') then
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
    end if;
    if v_id is null then
      -- 🔴 Il frigo non si indovina MAI: quel registro va all'ASP.
      v_manca := 'Non hai detto quale frigo: dimmelo e la scrivo.';
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
    end if;
    if v_id is null then
      v_manca := case
        when v_sentito is not null then
          'Non ho trovato «' || v_sentito || '» fra le pulizie del piano.'
        else
          'Non ho capito quale pulizia del piano intendevi.'
      end;
    end if;
    v_dati := v_dati - 'pulizia';
  end if;

  return jsonb_build_object('dati', v_dati, 'manca', v_manca);
end $funzione$;

revoke all on function voce_risolvi_dati(text, jsonb) from public, anon, authenticated;

-- ⚠️ Corpo ripreso dal DATABASE VIVO e cambiato in un ramo solo.
create or replace function fai_azione_dettata(p_tipo text, p_dati jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_id  uuid;
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

    else
      raise exception 'Questa cosa il gestionale non la sa ancora fare a voce (%). Si fa a mano come sempre.', p_tipo;
  end case;
end $funzione$;

revoke all on function fai_azione_dettata(text, jsonb) from public, anon, authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_tit    uuid;
  v_entita uuid;
  v_ing    uuid;
  v_lotto  uuid;
  v_dett   uuid;
  v_ris    jsonb;
  v_a      azioni_dettate%rowtype;
  v_n      integer;
  v_numero integer;
  v_giac   numeric;
  v_lapidi_pre integer;
  v_lapidi_post integer;
begin
  select count(*) into v_lapidi_pre from deleted_records;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Non c''e'' nessun titolare: questa verifica non puo'' girare.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  select id into v_entita from entities where entity_type = 'srls' limit 1;

  -- ⚠️ IL PRODOTTO E' NOSTRO E HA UNA GIACENZA NOSTRA. E' l'unico modo di
  --    percorrere il ramo fino in fondo: con un prodotto senza partite lo
  --    scarico si ferma prima, e il difetto del tipo di ritorno non si
  --    incontrerebbe mai. Il nome comincia per zeta perche' il catalogo
  --    si ordina per nome e il numero sia il piu' alto.
  insert into ingredients (entity_id, name, category, unit, alimentare)
  values (v_entita, 'ZZZ-VERIFICA-buttata', 'latticini', 'kg', true)
  returning id into v_ing;

  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at)
  values (v_ing, 5, 5, 4.00, now() - interval '1 day')
  returning id into v_lotto;

  select count(*) into v_numero from ingredients;

  -- ------------------------------------------------------------------
  -- (A) IL RAMO PERCORSO FINO IN FONDO: la merce si butta davvero.
  --     🔴 Prima di questa migrazione qui usciva «invalid input syntax
  --     for type json».
  -- ------------------------------------------------------------------
  v_ris := registra_dettatura(
    'buttane due chili che sono andati a male',
    jsonb_build_array(jsonb_build_object('tipo', 'merce_buttata', 'sicuro', true,
      'dati', jsonb_build_object('prodotto', v_numero, 'quantita', 2,
                                 'nome_sentito', 'quella roba', 'note', 'andata a male'),
      'frase', 'Buttati 2 kg')),
    'capita', 'claude-sonnet-5', 100, 20, null);
  v_dett := (v_ris->>'dettatura_id')::uuid;

  select * into v_a from azioni_dettate where dettatura_id = v_dett;
  if v_a.stato <> 'eseguita' then
    raise exception 'La merce buttata non e'' passata: % — %', v_a.stato, coalesce(v_a.errore, v_a.motivo);
  end if;

  -- E la giacenza e' scesa DAVVERO: 5 meno 2 fa 3.
  select coalesce(sum(sl.quantity_remaining), 0) into v_giac
    from stock_lots sl where sl.ingredient_id = v_ing;
  if v_giac <> 3 then
    raise exception 'La giacenza non e'' scesa: % invece di 3', v_giac;
  end if;

  -- E ha lasciato la sua riga nello scarico, col motivo giusto.
  select count(*) into v_n from stock_consumptions
   where ingredient_id = v_ing and reason = 'spreco';
  if v_n <> 1 then
    raise exception 'Lo scarico per spreco non e'' stato registrato: % righe', v_n;
  end if;

  -- ------------------------------------------------------------------
  -- (B) UN RIFIUTO SI GUARDA IN FACCIA.
  --     🔴 La regola che questa migrazione insegna: quando una prova si
  --     aspetta un fallimento, deve guardare CHE COSA dice — altrimenti
  --     qualunque rottura estranea la fa passare. Qui il prodotto non
  --     esiste, e il messaggio deve parlare di quello, non di JSON.
  -- ------------------------------------------------------------------
  v_ris := registra_dettatura(
    'butta due chili di una cosa che non c''e''',
    jsonb_build_array(jsonb_build_object('tipo', 'merce_buttata', 'sicuro', true,
      'dati', jsonb_build_object('ingredient_id', '00000000-0000-0000-0000-000000000000', 'quantita', 2),
      'frase', 'Buttati 2 kg di un prodotto che non esiste')),
    'capita', 'claude-sonnet-5', 100, 20, null);

  select * into v_a from azioni_dettate
   where dettatura_id = (v_ris->>'dettatura_id')::uuid;
  if v_a.stato <> 'fallita' then
    raise exception 'Buttare un prodotto inesistente non e'' fallito: %', v_a.stato;
  end if;
  if v_a.errore ilike '%json%' then
    raise exception 'Il rifiuto parla di JSON invece che del prodotto: %', v_a.errore;
  end if;

  delete from dettature where id = (v_ris->>'dettatura_id')::uuid;

  -- ------------------------------------------------------------------
  -- (C) CONFERMARE UNA COSA RIMASTA IN ATTESA.
  --     🔴 Il secondo difetto di questa migrazione: l'identificativo era
  --     gia' scritto nella riga, e chi risolveva cercava il numero — che
  --     li' non c'e' piu'. Rispondeva «non ho capito quale prodotto» su
  --     un'azione in cui il prodotto era scritto per esteso.
  -- ------------------------------------------------------------------
  v_ris := registra_dettatura(
    'di quella roba ce ne sono quattro chili',
    jsonb_build_array(jsonb_build_object('tipo', 'giacenza', 'sicuro', false,
      'dati', jsonb_build_object('prodotto', v_numero, 'quanto_ce', 4),
      'frase', 'Quattro chili', 'motivo', 'Non ero sicuro')),
    'capita', 'claude-sonnet-5', 100, 20, null);
  v_dett := (v_ris->>'dettatura_id')::uuid;

  select * into v_a from azioni_dettate where dettatura_id = v_dett;
  if v_a.stato <> 'in_attesa' then
    raise exception 'La giacenza non sicura non e'' rimasta in attesa: %', v_a.stato;
  end if;
  if nullif(v_a.dati->>'ingredient_id', '') is null then
    raise exception 'Il prodotto non e'' stato tradotto nella riga in attesa: %', v_a.dati;
  end if;

  perform esegui_azione_dettata(v_a.id);

  select * into v_a from azioni_dettate where id = v_a.id;
  if v_a.stato <> 'eseguita' then
    raise exception 'Confermare una cosa in attesa non ha funzionato: % — %',
      v_a.stato, coalesce(v_a.errore, v_a.motivo);
  end if;

  select coalesce(sum(sl.quantity_remaining), 0) into v_giac
    from stock_lots sl where sl.ingredient_id = v_ing;
  if v_giac <> 4 then
    raise exception 'La conferma non ha portato la giacenza a 4: %', v_giac;
  end if;

  delete from dettature where id = v_dett;

  -- ------------------------------------------------------------------
  -- Pulizia — per identificativo, solo roba nostra.
  -- ------------------------------------------------------------------
  delete from dettature where id = v_dett;
  delete from rettifiche_giacenza where ingredient_id = v_ing;
  delete from stock_consumptions where ingredient_id = v_ing;
  delete from stock_lots where ingredient_id = v_ing;
  delete from ingredients where id = v_ing;

  select count(*) into v_n from ingredients where name = 'ZZZ-VERIFICA-buttata';
  if v_n <> 0 then
    raise exception 'E'' rimasto il prodotto della verifica';
  end if;

  select count(*) into v_lapidi_post from deleted_records;
  if v_lapidi_post <> v_lapidi_pre then
    raise exception 'La verifica ha lasciato % lapidi', v_lapidi_post - v_lapidi_pre;
  end if;

  perform set_config('request.jwt.claims', null, true);

  raise notice 'Buttare la merce a voce funziona davvero: la giacenza scende da 5 a 3, lo scarico resta registrato come spreco, e un prodotto che non esiste viene rifiutato parlando del prodotto invece che di JSON.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260826000005', 'buttare_la_merce_non_restituisce_niente')
on conflict (version) do nothing;
