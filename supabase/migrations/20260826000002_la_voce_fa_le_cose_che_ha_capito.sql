-- ============================================================================
-- I COMANDI VOCALI — quello che ha capito, lo fa — 26/08/2026
-- ============================================================================
--
-- La migrazione accanto ha costruito il magazzino: le azioni, la loro
-- natura, il registro. Questa costruisce i GESTI: registrare una dettatura,
-- eseguire un'azione, annullarla, e le due porte da cui si entra.
--
-- ----------------------------------------------------------------------------
-- LE QUATTRO COSE CHE QUESTA MIGRAZIONE DECIDE
-- ----------------------------------------------------------------------------
--
-- 1. 🔴 L'ESECUZIONE PASSA DALLE FUNZIONI CHE GIA' ESISTONO, mai da una
--    copia. Allineare una giacenza a voce e allinearla col dito devono
--    fare la STESSA identica cosa — compresi i controlli, le partite
--    toccate e le tracce lasciate. Una seconda strada per lo stesso fatto
--    e' il difetto che questo progetto ha gia' pagato tre volte.
--
-- 2. 🔴 LA CHIAVE E' L'AUTENTICAZIONE, e va guardata in faccia.
--    `registra_dettatura_da_chiave` gira come proprietaria del database e,
--    riconosciuta l'impronta, IMPERSONA l'utente a cui la chiave
--    appartiene per la durata di quella sola transazione. E' il modo in
--    cui una Scorciatoia — che non ha e non puo' avere un accesso al
--    gestionale — arriva a fare le stesse cose e con gli stessi controlli.
--    ⚠️ Detto altrimenti: CHI HA LA CHIAVE PUO' FARE QUELLO CHE FA
--    ALESSIO DALLA VOCE. Per questo la chiave si revoca in un tocco, ha un
--    freno orario, e il conteggio degli usi e' li' per far vedere se
--    cresce quando lui non ha parlato.
--
-- 3. ⚠️ IL CATALOGO SI MANDA AL MODELLO NUMERATO, non con gli
--    identificativi lunghi. Centotrenta identificativi da trentasei
--    caratteri sono piu' di mille parole di domanda a ogni frase detta —
--    e sono anche mille occasioni di ricopiarne uno storto. Il modello
--    risponde con un numero, e il database lo ritraduce.
--
-- 4. ⚠️ UN'AZIONE NON SCADE MAI. `azioni_dettate_in_attesa()` dice da
--    quanti giorni una cosa aspetta, e non ne butta via nessuna. Il
--    mandato lo chiede in una riga sola e la ragione e' tutta li': buttare
--    via una dettatura fatta in cella gli farebbe smettere di usare la
--    voce, e a quel punto non serve piu' niente di tutto questo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Il catalogo che il modello guarda per riconoscere le cose
-- ----------------------------------------------------------------------------
-- ⚠️ SOLO CIO' CHE SERVE A RICONOSCERE UN NOME DETTO: i prodotti, i
--    frigoriferi, le pulizie previste. Non i prezzi, non le giacenze, non
--    i fornitori: quello che non serve a capire una frase non si manda a
--    nessuno.
create or replace function voce_catalogo()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $funzione$
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
    ), '[]'::jsonb)
  ) into v_out;

  return v_out;
end $funzione$;

comment on function voce_catalogo() is
  'I nomi che la voce deve saper riconoscere — prodotti, frigoriferi, pulizie previste — numerati. Il numero e'' quello con cui il modello risponde, e il database lo ritraduce nell''identificativo vero: mandare centotrenta identificativi lunghi a ogni frase costerebbe piu'' della frase stessa.';

revoke all on function voce_catalogo() from public, anon, authenticated;
grant execute on function voce_catalogo() to authenticated;

-- Le stesse tre traduzioni, dal numero all'identificativo. Vivono qui e non
-- in chi chiama, perche' l'ordinamento con cui si numera e quello con cui si
-- ritraduce devono essere LO STESSO: se divergessero, un prodotto verrebbe
-- scambiato per un altro senza nessun errore.
create or replace function voce_prodotto_numero(p_n integer)
returns uuid
language sql
stable security definer
set search_path to 'public'
as $funzione$
  select r.id from (
    select row_number() over (order by i.name) as n, i.id from ingredients i
  ) r where r.n = p_n;
$funzione$;

create or replace function voce_frigorifero_numero(p_n integer)
returns uuid
language sql
stable security definer
set search_path to 'public'
as $funzione$
  select r.id from (
    select row_number() over (order by e.name) as n, e.id
      from haccp_equipment e where e.active
  ) r where r.n = p_n;
$funzione$;

create or replace function voce_pulizia_numero(p_n integer)
returns uuid
language sql
stable security definer
set search_path to 'public'
as $funzione$
  select r.id from (
    select row_number() over (order by c.name) as n, c.id
      from haccp_cleaning_tasks c where c.active
  ) r where r.n = p_n;
$funzione$;

revoke all on function voce_prodotto_numero(integer) from public, anon, authenticated;
revoke all on function voce_frigorifero_numero(integer) from public, anon, authenticated;
revoke all on function voce_pulizia_numero(integer) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Fare davvero un'azione — il cuore, e sta in un posto solo
-- ----------------------------------------------------------------------------
-- 🔴 NON RIFA' NIENTE DI QUELLO CHE ESISTE GIA'. Ogni ramo chiama la
--    funzione che il gestionale usa gia' per quel gesto: cosi' i controlli,
--    le partite toccate e le tracce lasciate sono le stesse che si hanno
--    col dito. ⚠️ E quando una di quelle funzioni cambiera', questa
--    cambiera' insieme a lei senza che nessuno se ne ricordi.
create or replace function fai_azione_dettata(p_tipo text, p_dati jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_id  uuid;
  v_out jsonb;
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
      return record_stock_consumption(
        (p_dati->>'ingredient_id')::uuid,
        (p_dati->>'quantita')::numeric,
        'spreco',
        coalesce(nullif(p_dati->>'note', ''), 'Buttata, detto a voce'));

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

comment on function fai_azione_dettata(text, jsonb) is
  'Fa davvero quello che la voce ha capito, chiamando per ogni caso la funzione che il gestionale usa gia'' per quel gesto. Non e'' un doppione di quelle: e'' il posto da cui si scelgono. Non e'' concessa a nessuno — ci si arriva solo da `esegui_azione_dettata` o da `registra_dettatura`, che sanno chi sta chiedendo.';

revoke all on function fai_azione_dettata(text, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Registrare una dettatura, ed eseguire quello che si puo'
-- ----------------------------------------------------------------------------
-- Il lavoro vero sta qui, e le due porte (l'app col suo accesso, la
-- Scorciatoia con la chiave) lo chiamano tutte e due. Una regola sola.
create or replace function scrivi_dettatura(
  p_utente         uuid,
  p_testo          text,
  p_provenienza    text,
  p_azioni         jsonb,
  p_esito          text,
  p_modello        text,
  p_token_domanda  integer,
  p_token_risposta integer,
  p_messaggio      text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_prezzo   costo_modello_ai%rowtype;
  v_costo    numeric := 0;
  v_msg      text := p_messaggio;
  v_dettatura uuid;
  v_azione   jsonb;
  v_i        integer := 0;
  v_tipo     text;
  v_sicuro   boolean;
  v_dati     jsonb;
  v_frase    text;
  v_motivo   text;
  v_stato    text;
  v_ris      jsonb;
  v_err      text;
  v_fatte    integer := 0;
  v_attesa   integer := 0;
  v_id       uuid;
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
    v_i := v_i + 1;
    v_tipo   := v_azione->>'tipo';
    v_sicuro := coalesce((v_azione->>'sicuro')::boolean, false);
    v_dati   := coalesce(v_azione->'dati', '{}'::jsonb);
    v_frase  := nullif(btrim(coalesce(v_azione->>'frase', '')), '');
    v_motivo := nullif(btrim(coalesce(v_azione->>'motivo', '')), '');
    v_ris    := null;
    v_err    := null;

    -- ⚠️ Una frase vuota non e' ammessa dal vincolo, e non deve esserlo:
    --    Alessio si troverebbe un riquadro vuoto da approvare. Se il
    --    modello non l'ha scritta, la scrive il database col titolo del
    --    tipo — brutta ma leggibile, che e' meglio di niente.
    if v_frase is null then
      select t.titolo into v_frase from tipi_azione_vocale t where t.tipo = v_tipo;
      v_frase := coalesce(v_frase, 'Una cosa che non ho capito');
    end if;

    -- 🔴 IL PRINCIPIO, chiesto alla funzione che lo custodisce. Qui non si
    --    riscrive nessun criterio: si domanda.
    if azione_si_esegue_da_se(v_tipo, v_sicuro) then
      begin
        v_ris := fai_azione_dettata(v_tipo, v_dati);
        v_stato := 'eseguita';
        v_fatte := v_fatte + 1;
      exception when others then
        -- ⚠️ Una che fallisce NON porta giu' le altre: se un prodotto non
        --    c'e' piu', le altre quattro cose dette in quella frase sono
        --    ancora buone. Il motivo resta scritto accanto.
        v_stato := 'fallita';
        v_err   := sqlerrm;
        v_attesa := v_attesa + 1;
      end;
    else
      v_stato := 'in_attesa';
      v_attesa := v_attesa + 1;
      if v_motivo is null then
        v_motivo := case
          when not v_sicuro then 'Non ero sicuro: guardala tu.'
          else 'Questa la guardi sempre tu prima che venga scritta.'
        end;
      end if;
    end if;

    insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro,
                                frase, motivo, stato, eseguita_il, risultato, errore)
    values (v_dettatura, v_i, v_tipo, v_dati, v_sicuro,
            v_frase, v_motivo, v_stato,
            case when v_stato = 'eseguita' then now() end, v_ris, v_err)
    returning id into v_id;
  end loop;

  return jsonb_build_object(
    'dettatura_id', v_dettatura,
    'costo_euro',   v_costo,
    'nel_listino',  v_prezzo.modello is not null,
    'azioni',       v_i,
    'eseguite',     v_fatte,
    'da_guardare',  v_attesa);
end $funzione$;

comment on function scrivi_dettatura(uuid, text, text, jsonb, text, text, integer, integer, text) is
  'Registra una dettatura e le azioni che ne sono uscite, eseguendo quelle che il criterio dice di eseguire. E'' il lavoro vero, e sta in un posto solo: le due porte — l''app col suo accesso e la Scorciatoia con la chiave — chiamano questa. Non e'' concessa a nessuno direttamente.';

revoke all on function scrivi_dettatura(uuid, text, text, jsonb, text, text, integer, integer, text)
  from public, anon, authenticated;

-- --- Porta 1: l'app aperta, con l'accesso di chi la usa -----------------
create or replace function registra_dettatura(
  p_testo          text,
  p_azioni         jsonb default '[]'::jsonb,
  p_esito          text default 'capita',
  p_modello        text default null,
  p_token_domanda  integer default 0,
  p_token_risposta integer default 0,
  p_messaggio      text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' usare i comandi vocali.';
  end if;
  return scrivi_dettatura(auth.uid(), p_testo, 'app', p_azioni, p_esito,
                          p_modello, p_token_domanda, p_token_risposta, p_messaggio);
end $funzione$;

revoke all on function registra_dettatura(text, jsonb, text, text, integer, integer, text)
  from public, anon, authenticated;
grant execute on function registra_dettatura(text, jsonb, text, text, integer, integer, text)
  to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Le chiavi — e la porta che si apre con loro
-- ----------------------------------------------------------------------------
create or replace function crea_chiave_voce(p_nome text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_chiave text;
  v_id     uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' creare una chiave.';
  end if;
  if nullif(btrim(coalesce(p_nome, '')), '') is null then
    raise exception 'Dai un nome a questa chiave: serve a sapere quale togliere se un giorno perdi il telefono.';
  end if;

  -- 🔴 LA CHIAVE SI VEDE UNA VOLTA SOLA. Da qui in poi il database ne
  --    conserva la sola impronta, e da un'impronta non si torna indietro.
  -- ⚠️ `extensions.` scritto per esteso, e serve: pgcrypto su Supabase vive
  --    nello schema `extensions`, e ogni funzione di questo progetto ha
  --    `search_path = public`. Senza la qualifica il rifiuto arriva solo a
  --    tempo di esecuzione — la funzione si crea benissimo e si rompe la
  --    prima volta che qualcuno la usa.
  v_chiave := replace(replace(encode(extensions.gen_random_bytes(24), 'base64'), '/', '_'), '+', '-');

  insert into chiavi_voce (nome, impronta, utente_id)
  values (btrim(p_nome), encode(extensions.digest(v_chiave, 'sha256'), 'hex'), auth.uid())
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'nome', btrim(p_nome), 'chiave', v_chiave);
end $funzione$;

comment on function crea_chiave_voce(text) is
  'Crea una chiave per la Scorciatoia e la restituisce IN CHIARO una volta sola: nel database ne resta la sola impronta. Se si perde non si recupera — se ne fa un''altra e si revoca la vecchia, che e'' anche cio'' che si fa se il telefono viene smarrito.';

revoke all on function crea_chiave_voce(text) from public, anon, authenticated;
grant execute on function crea_chiave_voce(text) to authenticated;

create or replace function revoca_chiave_voce(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare v_nome text;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' revocare una chiave.';
  end if;
  update chiavi_voce set revocata_il = now()
   where id = p_id and revocata_il is null
   returning nome into v_nome;
  if v_nome is null then
    raise exception 'Questa chiave non c''e'', oppure era gia'' stata tolta.';
  end if;
  return jsonb_build_object('nome', v_nome);
end $funzione$;

revoke all on function revoca_chiave_voce(uuid) from public, anon, authenticated;
grant execute on function revoca_chiave_voce(uuid) to authenticated;

-- --- Il freno, e sta prima di tutto il resto ---------------------------
-- ⚠️ Il Contratto §4 pretende un freno anti-abuso su ogni funzione esposta
--    al ruolo anonimo: un indirizzo raggiungibile da fuori riceve invii
--    automatici come norma, non come eccezione. Qui il tetto e' per CHIAVE
--    e per ora, e serve a due cose diverse: fermare chi la chiave l'ha
--    rubata, e fermare una Scorciatoia impazzita che rimanda la stessa
--    frase in circolo — perche' ogni giro si paga.
create or replace function voce_apri_sessione(p_chiave text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_riga   chiavi_voce%rowtype;
  v_ultima integer;
  v_spesa  record;
  v_cat    jsonb;
begin
  if nullif(btrim(coalesce(p_chiave, '')), '') is null then
    raise exception 'Manca la chiave.';
  end if;

  select * into v_riga from chiavi_voce
   where impronta = encode(extensions.digest(p_chiave, 'sha256'), 'hex') and revocata_il is null;
  if not found then
    -- ⚠️ Non si dice se la chiave non esiste o se e' stata revocata: sono
    --    due informazioni utili solo a chi sta provando a indovinarla.
    raise exception 'Questa chiave non vale.';
  end if;

  select count(*) into v_ultima from dettature d
   where d.creato_da = v_riga.utente_id
     and d.provenienza = 'scorciatoia'
     and d.creato_il > now() - interval '1 hour';
  if v_ultima >= 60 then
    raise exception 'Sono gia'' arrivate 60 dettature nell''ultima ora da questa strada: mi fermo. Se non sei stato tu, togli la chiave dal gestionale.';
  end if;

  update chiavi_voce set ultimo_uso = now(), usi = usi + 1 where id = v_riga.id;

  -- 🔴 DA QUI IN POI SI E' LUI. La chiave e' l'autenticazione, e i claims
  --    valgono per questa transazione soltanto (`true` = local).
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_riga.utente_id, 'role', 'authenticated')::text, true);

  if not is_titolare() then
    raise exception 'La chiave appartiene a un accesso che non e'' il titolare: i comandi vocali sono solo suoi.';
  end if;

  select * into v_spesa from spesa_ai_del_mese();
  v_cat := voce_catalogo();

  return jsonb_build_object(
    'utente',   v_riga.utente_id,
    'chiave',   v_riga.nome,
    'catalogo', v_cat,
    'spesa',    to_jsonb(v_spesa));
end $funzione$;

comment on function voce_apri_sessione(text) is
  'Apre una dettatura arrivata da fuori: riconosce la chiave, la frena se ne arrivano troppe in un''ora, e restituisce il catalogo dei nomi e lo stato della spesa. E'' aperta al ruolo anonimo per forza — una Scorciatoia non ha un accesso al gestionale — e per questo il freno e'' qui e non altrove.';

revoke all on function voce_apri_sessione(text) from public, anon, authenticated;
grant execute on function voce_apri_sessione(text) to anon, authenticated;

-- --- Porta 2: da fuori, con la chiave ----------------------------------
create or replace function registra_dettatura_da_chiave(
  p_chiave         text,
  p_testo          text,
  p_azioni         jsonb default '[]'::jsonb,
  p_esito          text default 'capita',
  p_modello        text default null,
  p_token_domanda  integer default 0,
  p_token_risposta integer default 0,
  p_messaggio      text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_riga chiavi_voce%rowtype;
begin
  select * into v_riga from chiavi_voce
   where impronta = encode(extensions.digest(p_chiave, 'sha256'), 'hex') and revocata_il is null;
  if not found then
    raise exception 'Questa chiave non vale.';
  end if;

  -- 🔴 Da qui in poi si e' lui, per questa transazione soltanto: e' cio'
  --    che permette alle funzioni sottostanti di fare i loro controlli sul
  --    ruolo vero invece che su un anonimo.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_riga.utente_id, 'role', 'authenticated')::text, true);

  if not is_titolare() then
    raise exception 'La chiave appartiene a un accesso che non e'' il titolare.';
  end if;

  return scrivi_dettatura(v_riga.utente_id, p_testo, 'scorciatoia', p_azioni, p_esito,
                          p_modello, p_token_domanda, p_token_risposta, p_messaggio);
end $funzione$;

comment on function registra_dettatura_da_chiave(text, text, jsonb, text, text, integer, integer, text) is
  'La porta da cui entra una dettatura fatta col telefono o con l''orologio. La chiave e'' l''autenticazione: riconosciuta, la funzione impersona l''utente a cui appartiene per la sola durata di questa transazione, cosi'' i controlli sottostanti guardano il ruolo vero.';

revoke all on function registra_dettatura_da_chiave(text, text, jsonb, text, text, integer, integer, text)
  from public, anon, authenticated;
grant execute on function registra_dettatura_da_chiave(text, text, jsonb, text, text, integer, integer, text)
  to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Confermare, annullare, e vedere cosa aspetta
-- ----------------------------------------------------------------------------
create or replace function esegui_azione_dettata(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_a   azioni_dettate%rowtype;
  v_ris jsonb;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' confermare quello che ha dettato.';
  end if;

  select * into v_a from azioni_dettate where id = p_id for update;
  if not found then
    raise exception 'Questa cosa da confermare non c''e'' piu''.';
  end if;
  if v_a.stato = 'eseguita' then
    raise exception 'Questa era gia'' stata fatta.';
  end if;
  if v_a.stato = 'annullata' then
    raise exception 'Questa l''avevi annullata. Se la vuoi, ridettala.';
  end if;

  v_ris := fai_azione_dettata(v_a.tipo, v_a.dati);

  update azioni_dettate
     set stato = 'eseguita', eseguita_il = now(), risultato = v_ris, errore = null, motivo = null
   where id = p_id;

  return jsonb_build_object('frase', v_a.frase, 'risultato', v_ris);
end $funzione$;

comment on function esegui_azione_dettata(uuid) is
  'Alessio guarda una cosa che aveva dettato e dice di si''. Passa per la stessa funzione con cui vengono eseguite quelle sicure: non esiste una seconda strada per lo stesso gesto.';

revoke all on function esegui_azione_dettata(uuid) from public, anon, authenticated;
grant execute on function esegui_azione_dettata(uuid) to authenticated;

create or replace function annulla_azione_dettata(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare v_a azioni_dettate%rowtype;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' annullare quello che ha dettato.';
  end if;

  select * into v_a from azioni_dettate where id = p_id for update;
  if not found then
    raise exception 'Questa cosa non c''e'' piu''.';
  end if;
  -- ⚠️ Una cosa gia' FATTA non si annulla da qui, e non e' una svista:
  --    disfarla vuol dire tornare nel modulo che l'ha registrata — dove
  --    ci sono i controlli, le tracce e la via di ritorno giusta. Un
  --    «annulla» che cancellasse la riga qui lascerebbe in piedi l'effetto
  --    e farebbe sparire la sola cosa che lo spiega.
  if v_a.stato = 'eseguita' then
    raise exception 'Questa e'' gia'' stata fatta: per disfarla si passa dal modulo dove e'' finita — % .', v_a.frase;
  end if;

  update azioni_dettate set stato = 'annullata', motivo = 'Annullata da Alessio' where id = p_id;
  return jsonb_build_object('frase', v_a.frase);
end $funzione$;

revoke all on function annulla_azione_dettata(uuid) from public, anon, authenticated;
grant execute on function annulla_azione_dettata(uuid) to authenticated;

-- ⚠️ NIENTE SCADE. Questa restituisce tutto quello che aspetta, con
--    l'anzianita' accanto: e' il ricordarglielo il giorno dopo che il
--    mandato chiede, e si fa mostrando invece che cancellando.
create or replace function azioni_dettate_in_attesa()
returns table(
  id           uuid,
  dettatura_id uuid,
  tipo         text,
  titolo       text,
  natura       text,
  dati         jsonb,
  sicuro       boolean,
  frase        text,
  motivo       text,
  stato        text,
  errore       text,
  testo_detto  text,
  quando       timestamptz,
  giorni       integer
)
language plpgsql
stable security definer
set search_path to 'public'
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Le cose dettate sono riservate al titolare.';
  end if;

  return query
  select a.id, a.dettatura_id, a.tipo, t.titolo, t.natura, a.dati, a.sicuro,
         a.frase, a.motivo, a.stato, a.errore, d.testo, a.creato_il,
         (((now() at time zone 'Europe/Rome')::date) - ((a.creato_il at time zone 'Europe/Rome')::date))::integer
    from azioni_dettate a
    join tipi_azione_vocale t on t.tipo = a.tipo
    join dettature d on d.id = a.dettatura_id
   where a.stato in ('in_attesa', 'fallita')
   order by a.creato_il, a.progressivo;
end $funzione$;

comment on function azioni_dettate_in_attesa() is
  'Tutto quello che Alessio ha dettato e non ha ancora guardato, con da quanti giorni aspetta. NON scade e non si butta via niente: buttare una dettatura fatta in cella e'' la cosa che gli farebbe smettere di usare la voce.';

revoke all on function azioni_dettate_in_attesa() from public, anon, authenticated;
grant execute on function azioni_dettate_in_attesa() to authenticated;

create or replace function dettature_recenti(p_giorni integer default 7)
returns table(
  id          uuid,
  testo       text,
  provenienza text,
  esito       text,
  costo_euro  numeric,
  quando      timestamptz,
  azioni      integer,
  eseguite    integer,
  in_attesa   integer
)
language plpgsql
stable security definer
set search_path to 'public'
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Le dettature sono riservate al titolare.';
  end if;

  return query
  select d.id, d.testo, d.provenienza, d.esito, d.costo_euro, d.creato_il,
         count(a.*)::integer,
         count(a.*) filter (where a.stato = 'eseguita')::integer,
         count(a.*) filter (where a.stato in ('in_attesa', 'fallita'))::integer
    from dettature d
    left join azioni_dettate a on a.dettatura_id = d.id
   where d.creato_il > now() - make_interval(days => greatest(coalesce(p_giorni, 7), 1))
   group by d.id
   order by d.creato_il desc
   limit 200;
end $funzione$;

revoke all on function dettature_recenti(integer) from public, anon, authenticated;
grant execute on function dettature_recenti(integer) to authenticated;

create or replace function chiavi_voce_elenco()
returns table(
  id          uuid,
  nome        text,
  creata_il   timestamptz,
  ultimo_uso  timestamptz,
  usi         integer,
  revocata_il timestamptz
)
language plpgsql
stable security definer
set search_path to 'public'
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Le chiavi sono riservate al titolare.';
  end if;
  return query
  select c.id, c.nome, c.creata_il, c.ultimo_uso, c.usi, c.revocata_il
    from chiavi_voce c order by c.revocata_il nulls first, c.creata_il desc;
end $funzione$;

revoke all on function chiavi_voce_elenco() from public, anon, authenticated;
grant execute on function chiavi_voce_elenco() to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- ⚠️ Il perimetro e' fatto di roba creata qui dentro, e si cancella per
--    identificativo. L'ingrediente su cui si prova lo scarico e'
--    NOSTRO, non uno di Alessio: la lezione del 16/08, quando FEFO prese
--    da un lotto vero e la giacenza rimase corta di due senza che nessuno
--    scarico lo spiegasse.
do $verifica$
declare
  v_tit      uuid;
  v_ing      uuid;
  v_frigo    uuid;
  v_pulizia  uuid;
  v_ris      jsonb;
  v_dett     uuid;
  v_azione   uuid;
  v_n        integer;
  v_ok       boolean;
  v_chiave   text;
  v_chiave_id uuid;
  v_cat      jsonb;
  v_tasks    uuid[];
  v_lapidi_pre integer;
  v_lapidi_post integer;
  v_giacenza numeric;
  v_entita   uuid;
begin
  select count(*) into v_lapidi_pre from deleted_records;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Non c''e'' nessun titolare: questa verifica non puo'' girare.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- Roba nostra, creata qui.
  -- ⚠️ L'entita' si CHIEDE al database invece di scriverla: un
  --    identificativo ricopiato a mano e' un numero che invecchia, e su
  --    una ricostruzione da zero non sarebbe lo stesso.
  select id into v_entita from entities where entity_type = 'srls' limit 1;
  if v_entita is null then
    raise exception 'Non c''e'' nessuna societa'': questa verifica non puo'' girare.';
  end if;

  insert into ingredients (entity_id, name, category, unit, alimentare)
  values (v_entita, 'VERIFICA-voce-pomodoro', 'verdura', 'kg', true)
  returning id into v_ing;

  insert into haccp_equipment (name, storage_type, target_min_c, target_max_c)
  values ('VERIFICA-voce-cella', 'frigo_0_4', 0, 4)
  returning id into v_frigo;

  insert into haccp_cleaning_tasks (name, area, frequency)
  values ('VERIFICA-voce-pavimenti', 'cucina', 'giornaliera')
  returning id into v_pulizia;

  -- ------------------------------------------------------------------
  -- (A) UNA FILZA IN UNA VOLTA SOLA: quattro cose dette insieme, e il
  --     criterio le divide da se'.
  --     🔴 Il numero degli elementi non e' di comodo: servono almeno una
  --     misura sicura, una misura NON sicura e una creazione sicura,
  --     altrimenti la prova non distingue il criterio da un «esegui
  --     sempre» o da un «non eseguire mai».
  -- ------------------------------------------------------------------
  v_ris := registra_dettatura(
    'pomodori quattro chili, la cella a tre gradi, ricordami di chiamare il fornitore, e segna cinquanta euro di cassa',
    jsonb_build_array(
      jsonb_build_object('tipo', 'giacenza', 'sicuro', true,
        'dati', jsonb_build_object('ingredient_id', v_ing, 'quanto_ce', 4),
        'frase', 'Pomodori: ce ne sono 4 kg'),
      jsonb_build_object('tipo', 'temperatura', 'sicuro', false,
        'dati', jsonb_build_object('gradi', 3),
        'frase', 'Temperatura 3 gradi', 'motivo', 'Non hai detto quale frigo'),
      jsonb_build_object('tipo', 'promemoria', 'sicuro', true,
        'dati', jsonb_build_object('titolo', 'VERIFICA-voce chiamare il fornitore'),
        'frase', 'Promemoria: chiamare il fornitore'),
      jsonb_build_object('tipo', 'movimento_cassa', 'sicuro', true,
        'dati', jsonb_build_object('importo', 50),
        'frase', 'Cassa: 50 euro')),
    'capita', 'claude-sonnet-5', 1200, 300, null);

  v_dett := (v_ris->>'dettatura_id')::uuid;

  if (v_ris->>'azioni')::integer <> 4 then
    raise exception 'Le azioni registrate sono % invece di 4', v_ris->>'azioni';
  end if;
  -- Due eseguite: la giacenza e il promemoria. La temperatura no (non
  -- sicura), il movimento di cassa no (e' una creazione, per sempre).
  if (v_ris->>'eseguite')::integer <> 2 then
    raise exception 'Le azioni eseguite da se'' sono % invece di 2', v_ris->>'eseguite';
  end if;

  -- 🔴 IL CONTROLLO CHE VALE PIU' DEGLI ALTRI: la creazione SICURA non e'
  --    stata eseguita. E' il caso in cui il criterio sembra un di piu' e
  --    invece e' tutto.
  select count(*) into v_n from azioni_dettate
   where dettatura_id = v_dett and tipo = 'movimento_cassa' and stato = 'in_attesa';
  if v_n <> 1 then
    raise exception 'Il movimento di cassa non e'' rimasto in attesa: e'' il caso che il criterio esiste per fermare';
  end if;

  -- E la giacenza e' scesa davvero, non solo «registrata».
  select coalesce(sum(sl.quantity_remaining), 0) into v_giacenza
    from stock_lots sl where sl.ingredient_id = v_ing;
  if v_giacenza <> 4 then
    raise exception 'La giacenza dettata non e'' arrivata in magazzino: % invece di 4', v_giacenza;
  end if;

  -- ------------------------------------------------------------------
  -- (B) Una temperatura in attesa NON si esegue finche' manca il frigo,
  --     e appena il frigo c'e' si esegue.
  -- ------------------------------------------------------------------
  select id into v_azione from azioni_dettate
   where dettatura_id = v_dett and tipo = 'temperatura';

  v_ok := false;
  begin
    perform esegui_azione_dettata(v_azione);
    raise exception 'ATTESO RIFIUTO: temperatura eseguita senza frigo';
  exception
    when others then
      if sqlerrm like 'ATTESO RIFIUTO%' then raise; end if;
      if sqlerrm not like '%quale frigo%' then
        raise exception 'Il rifiuto non parla del frigo: %', sqlerrm;
      end if;
      v_ok := true;
  end;
  if not v_ok then
    raise exception 'Una temperatura senza frigo e'' finita nel registro HACCP';
  end if;

  update azioni_dettate
     set dati = dati || jsonb_build_object('equipment_id', v_frigo)
   where id = v_azione;
  perform esegui_azione_dettata(v_azione);

  select count(*) into v_n from haccp_temperature_logs where equipment_id = v_frigo;
  if v_n <> 1 then
    raise exception 'La temperatura non e'' arrivata nel registro: % righe', v_n;
  end if;

  -- ------------------------------------------------------------------
  -- (C) Una cosa gia' fatta non si annulla da qui.
  -- ------------------------------------------------------------------
  v_ok := false;
  begin
    perform annulla_azione_dettata(v_azione);
    raise exception 'ATTESO RIFIUTO: annullata una cosa gia'' fatta';
  exception
    when others then
      if sqlerrm like 'ATTESO RIFIUTO%' then raise; end if;
      v_ok := true;
  end;
  if not v_ok then
    raise exception 'Una cosa gia'' fatta si e'' potuta annullare da qui';
  end if;

  -- ------------------------------------------------------------------
  -- (D) La pulizia e la nota che non ha capito.
  -- ------------------------------------------------------------------
  v_ris := registra_dettatura(
    'ho lavato i pavimenti, e poi quella cosa la'' del coso',
    jsonb_build_array(
      jsonb_build_object('tipo', 'pulizia', 'sicuro', true,
        'dati', jsonb_build_object('task_id', v_pulizia),
        'frase', 'Pulizia dei pavimenti: fatta'),
      jsonb_build_object('tipo', 'nota_non_capita', 'sicuro', true,
        'dati', jsonb_build_object('sentito', 'quella cosa la'' del coso'),
        'frase', 'Non ho capito: «quella cosa la'' del coso»')),
    'capita', 'claude-sonnet-5', 900, 120, null);

  if (v_ris->>'eseguite')::integer <> 2 then
    raise exception 'La pulizia o la nota non si sono salvate da se'': %', v_ris->>'eseguite';
  end if;
  select count(*) into v_n from haccp_cleaning_logs where task_id = v_pulizia;
  if v_n <> 1 then
    raise exception 'La pulizia non e'' arrivata nel registro';
  end if;
  select count(*) into v_n from tasks
   where origine_modulo = 'voce' and description like '%del coso%';
  if v_n <> 1 then
    raise exception 'La nota di quello che non ha capito non c''e''';
  end if;

  -- ------------------------------------------------------------------
  -- (E) Una che fallisce NON porta giu' le altre.
  --     ⚠️ Si costruisce apposta: un prodotto che non esiste.
  -- ------------------------------------------------------------------
  v_ris := registra_dettatura(
    'butta due chili di una cosa che non c''e'', e ricordami di ordinare il pane',
    jsonb_build_array(
      jsonb_build_object('tipo', 'merce_buttata', 'sicuro', true,
        'dati', jsonb_build_object('ingredient_id', '00000000-0000-0000-0000-000000000000', 'quantita', 2),
        'frase', 'Buttati 2 kg di un prodotto che non esiste'),
      jsonb_build_object('tipo', 'promemoria', 'sicuro', true,
        'dati', jsonb_build_object('titolo', 'VERIFICA-voce ordinare il pane'),
        'frase', 'Promemoria: ordinare il pane')),
    'capita', 'claude-sonnet-5', 800, 100, null);

  if (v_ris->>'eseguite')::integer <> 1 then
    raise exception 'Una caduta si e'' portata giu'' anche l''altra: eseguite %', v_ris->>'eseguite';
  end if;
  select count(*) into v_n from azioni_dettate a
    join dettature d on d.id = a.dettatura_id
   where d.id = (v_ris->>'dettatura_id')::uuid and a.stato = 'fallita' and a.errore is not null;
  if v_n <> 1 then
    raise exception 'La caduta non ha lasciato scritto perche''';
  end if;

  -- ------------------------------------------------------------------
  -- (F) La chiave: nasce, apre, e revocata non apre piu'.
  -- ------------------------------------------------------------------
  v_ris := crea_chiave_voce('VERIFICA-voce');
  v_chiave := v_ris->>'chiave';
  v_chiave_id := (v_ris->>'id')::uuid;
  if length(v_chiave) < 20 then
    raise exception 'La chiave e'' troppo corta per essere una chiave: %', length(v_chiave);
  end if;
  -- 🔴 La chiave in chiaro non deve stare da nessuna parte nel database.
  select count(*) into v_n from chiavi_voce where id = v_chiave_id and impronta = v_chiave;
  if v_n <> 0 then
    raise exception 'La chiave in chiaro e'' finita nel database';
  end if;

  -- Si apre da anonimi: e' il punto del blocco.
  perform set_config('request.jwt.claims', null, true);
  v_cat := voce_apri_sessione(v_chiave);
  if jsonb_array_length(v_cat->'catalogo'->'prodotti') < 1 then
    raise exception 'Il catalogo aperto con la chiave e'' vuoto';
  end if;

  v_ris := registra_dettatura_da_chiave(v_chiave,
    'ricordami di controllare il freezer',
    jsonb_build_array(jsonb_build_object('tipo', 'promemoria', 'sicuro', true,
      'dati', jsonb_build_object('titolo', 'VERIFICA-voce controllare il freezer'),
      'frase', 'Promemoria: controllare il freezer')),
    'capita', 'claude-sonnet-5', 500, 80, null);
  if (v_ris->>'eseguite')::integer <> 1 then
    raise exception 'La dettatura entrata con la chiave non ha fatto niente';
  end if;
  select count(*) into v_n from dettature where id = (v_ris->>'dettatura_id')::uuid and provenienza = 'scorciatoia';
  if v_n <> 1 then
    raise exception 'La dettatura della chiave non risulta arrivata dalla Scorciatoia';
  end if;

  -- Una chiave inventata non apre niente.
  v_ok := false;
  begin
    perform voce_apri_sessione('questa-chiave-non-esiste-per-niente');
    raise exception 'ATTESO RIFIUTO: chiave inventata accettata';
  exception
    when others then
      if sqlerrm like 'ATTESO RIFIUTO%' then raise; end if;
      v_ok := true;
  end;
  if not v_ok then raise exception 'Una chiave inventata ha aperto la porta'; end if;

  -- Revocata, non apre piu'.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  perform revoca_chiave_voce(v_chiave_id);
  perform set_config('request.jwt.claims', null, true);
  v_ok := false;
  begin
    perform voce_apri_sessione(v_chiave);
    raise exception 'ATTESO RIFIUTO: chiave revocata accettata';
  exception
    when others then
      if sqlerrm like 'ATTESO RIFIUTO%' then raise; end if;
      v_ok := true;
  end;
  if not v_ok then raise exception 'Una chiave revocata apre ancora'; end if;

  -- ------------------------------------------------------------------
  -- (G) Niente scade: quello che aspetta si vede, con l'anzianita'.
  -- ------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_n from azioni_dettate_in_attesa();
  if v_n < 2 then
    raise exception 'Le cose che aspettano dovrebbero essere almeno 2, sono %', v_n;
  end if;

  -- ------------------------------------------------------------------
  -- Pulizia — solo roba nostra, per identificativo.
  -- ------------------------------------------------------------------
  select array_agg(id) into v_tasks from tasks where origine_modulo = 'voce';
  delete from tasks where id = any(v_tasks);
  delete from haccp_cleaning_logs where task_id = v_pulizia;
  delete from haccp_temperature_logs where equipment_id = v_frigo;
  delete from haccp_non_conformities where description like '%VERIFICA-voce%';
  delete from dettature where id in (
    select d.id from dettature d where d.creato_il > now() - interval '5 minutes'
      and d.testo like 'VERIFICA%' );
  delete from dettature where testo in (
    'pomodori quattro chili, la cella a tre gradi, ricordami di chiamare il fornitore, e segna cinquanta euro di cassa',
    'ho lavato i pavimenti, e poi quella cosa la'' del coso',
    'butta due chili di una cosa che non c''e'', e ricordami di ordinare il pane',
    'ricordami di controllare il freezer');
  delete from chiavi_voce where id = v_chiave_id;
  delete from rettifiche_giacenza where ingredient_id = v_ing;
  delete from stock_consumptions where ingredient_id = v_ing;
  delete from stock_lots where ingredient_id = v_ing;
  delete from ingredients where id = v_ing;
  delete from haccp_cleaning_tasks where id = v_pulizia;
  delete from haccp_equipment where id = v_frigo;

  select count(*) into v_n from dettature where creato_da = v_tit
    and creato_il > now() - interval '5 minutes';
  if v_n <> 0 then
    raise exception 'Sono rimaste % dettature della verifica', v_n;
  end if;

  perform set_config('request.jwt.claims', null, true);

  raise notice 'La voce fa le cose: una filza di quattro produce due gesti fatti e due da guardare, la temperatura senza frigo si rifiuta con la sua frase, una caduta non porta giu'' le altre, e una chiave revocata non apre piu''.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260826000002', 'la_voce_fa_le_cose_che_ha_capito')
on conflict (version) do nothing;
