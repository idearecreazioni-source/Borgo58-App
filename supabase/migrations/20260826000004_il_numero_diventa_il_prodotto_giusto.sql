-- ============================================================================
-- I COMANDI VOCALI — il numero diventa il prodotto giusto — 26/08/2026
-- ============================================================================
--
-- 🔴 DUE DIFETTI TROVATI COLLAUDANDO CON L'API VERA, non rileggendo.
--
-- 1. LE TRE FUNZIONI CHE TRADUCONO UN NUMERO DEL CATALOGO
--    NELL'IDENTIFICATIVO VERO NON ERANO CHIAMABILI DA NESSUNO. Le avevo
--    scritte con il `revoke` e senza il `grant` che va accanto: nemmeno il
--    titolare poteva usarle. Misurato: `has_function_privilege` diceva
--    `false` per `authenticated` e per `anon` su tutte e tre.
--
-- 2. 🔴 E IL DIFETTO CHE CONTA DI PIU' NON E' QUELLO: il rifiuto veniva
--    INGHIOTTITO. Chi chiamava leggeva l'errore e restituiva «non ho
--    trovato» — quindi a schermo cinque prodotti riconosciuti benissimo
--    («bottarga di tonno», «caciocavallo ragusano», «busiate trafilate»)
--    comparivano tutti con la frase «Non ho trovato questo prodotto in
--    magazzino». Un permesso mancante travestito da magazzino vuoto:
--    ⚠️ e' la famiglia di *«non vuol dire che e' vuota: vuol dire che non
--    lo so»*, la stessa che questo progetto insegue da nove giorni.
--
-- ----------------------------------------------------------------------------
-- LA CURA NON E' IL `grant` MANCANTE
-- ----------------------------------------------------------------------------
-- Il permesso si potrebbe concedere e finirebbe li'. Ma quel giro era
-- sbagliato in un modo piu' profondo: la NUMERAZIONE la faceva il database
-- e la TRADUZIONE la chiedeva chi stava fuori, con un giro di rete per
-- ogni cosa detta — cinque prodotti, cinque chiamate — e ogni chiamata era
-- un posto in cui un rifiuto poteva travestirsi da risposta.
--
-- ⚠️ Ora la traduzione avviene DENTRO la funzione che registra la
--    dettatura: chi numera e chi ritraduce sono lo stesso codice nella
--    stessa transazione, quindi non possono divergere nemmeno se domani
--    un prodotto viene rinominato mentre qualcuno sta parlando. Le tre
--    traduttrici restano private, e adesso e' giusto che lo siano.
--
-- ⚠️ E QUANDO IL NUMERO NON C'E', LA DIFFERENZA SI DICE: «non ho capito
--    quale prodotto» e «il gestionale non e' riuscito a cercarlo» sono due
--    frasi diverse, perche' sono due problemi diversi.
--
-- 🔴 TERZO DIFETTO, dallo stesso collaudo: «aggiungi alla lista le busiate
--    trafilate» FALLIVA con «Serve un ingrediente o un nome articolo».
--    L'assistente aveva riconosciuto il prodotto e mandato il suo numero;
--    non risolvendosi, restava una riga senza ne' prodotto ne' nome. Ora
--    ogni azione porta con se' anche IL NOME COME E' STATO SENTITO, e sulla
--    lista della spesa quel nome basta: una riga scritta a mano li' dentro
--    e' una riga legittima, non un ripiego.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Il numero del catalogo diventa l'identificativo vero
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
    v_n := nullif(v_dati->>'prodotto', '')::integer;
    if v_n is not null then
      select voce_prodotto_numero(v_n) into v_id;
    end if;
    if v_id is not null then
      v_dati := v_dati || jsonb_build_object('ingredient_id', v_id);
    elsif p_tipo = 'lista_spesa' then
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
    v_dati := v_dati - 'prodotto';
  end if;

  if p_tipo = 'temperatura' then
    v_n := nullif(v_dati->>'frigorifero', '')::integer;
    if v_n is not null then
      select voce_frigorifero_numero(v_n) into v_id;
    end if;
    if v_id is not null then
      v_dati := v_dati || jsonb_build_object('equipment_id', v_id);
    else
      -- 🔴 Il frigo non si indovina MAI: quel registro va all'ASP.
      v_manca := 'Non hai detto quale frigo: dimmelo e la scrivo.';
    end if;
    v_dati := v_dati - 'frigorifero';
  end if;

  if p_tipo = 'pulizia' then
    v_n := nullif(v_dati->>'pulizia', '')::integer;
    if v_n is not null then
      select voce_pulizia_numero(v_n) into v_id;
    end if;
    if v_id is not null then
      v_dati := v_dati || jsonb_build_object('task_id', v_id);
    else
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

comment on function voce_risolvi_dati(text, jsonb) is
  'Traduce i numeri del catalogo negli identificativi veri, e dice che cosa manca quando la traduzione non riesce. Sta nel database e non in chi chiama, perche'' chi NUMERA e chi RITRADUCE devono essere lo stesso codice: se divergessero, un prodotto verrebbe scambiato per un altro senza nessun errore.';

revoke all on function voce_risolvi_dati(text, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. La registrazione traduce da sé
-- ----------------------------------------------------------------------------
-- ⚠️ Corpo ripreso dal DATABASE VIVO e cambiato in due punti: la
--    traduzione dei numeri, e il motivo che ne esce quando non riesce.
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
  v_risolto  jsonb;
  v_manca    text;
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

    -- 🔴 QUI SI TRADUCE, e non fuori: chi numera e chi ritraduce sono lo
    --    stesso codice nella stessa transazione.
    v_risolto := voce_risolvi_dati(v_tipo, v_dati);
    v_dati    := v_risolto->'dati';
    v_manca   := nullif(v_risolto->>'manca', '');
    if v_manca is not null then
      -- ⚠️ Quello che manca VINCE su qualunque sicurezza dichiarata: il
      --    modello puo' essere sicuro di aver capito «bottarga», e il
      --    gestionale non averla in magazzino. Sono due cose diverse.
      v_sicuro := false;
      v_motivo := coalesce(v_motivo, v_manca);
    end if;

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

revoke all on function scrivi_dettatura(uuid, text, text, jsonb, text, text, integer, integer, text)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Confermare una cosa rimasta indietro traduce anche lei
-- ----------------------------------------------------------------------------
-- ⚠️ Serve perche' Alessio puo' correggere il numero del prodotto e
--    riprovare: senza, la correzione resterebbe un numero che nessuno
--    ritraduce.
create or replace function esegui_azione_dettata(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_a      azioni_dettate%rowtype;
  v_ris    jsonb;
  v_risolto jsonb;
  v_dati   jsonb;
  v_manca  text;
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

  v_risolto := voce_risolvi_dati(v_a.tipo, v_a.dati);
  v_dati    := v_risolto->'dati';
  v_manca   := nullif(v_risolto->>'manca', '');
  if v_manca is not null then
    raise exception '%', v_manca;
  end if;

  v_ris := fai_azione_dettata(v_a.tipo, v_dati);

  update azioni_dettate
     set stato = 'eseguita', eseguita_il = now(), dati = v_dati,
         risultato = v_ris, errore = null, motivo = null
   where id = p_id;

  return jsonb_build_object('frase', v_a.frase, 'risultato', v_ris);
end $funzione$;

revoke all on function esegui_azione_dettata(uuid) from public, anon, authenticated;
grant execute on function esegui_azione_dettata(uuid) to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_tit    uuid;
  v_entita uuid;
  v_ing    uuid;
  v_frigo  uuid;
  v_n      integer;
  v_ris    jsonb;
  v_a      azioni_dettate%rowtype;
  v_dett   uuid;
  v_numero integer;
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

  -- Roba nostra. ⚠️ Il nome comincia per zeta apposta: il catalogo si
  -- ordina per nome, quindi questo prodotto finisce in fondo e il suo
  -- numero e' il piu' alto — cosi' la prova non dipende da quanti
  -- prodotti ci sono.
  insert into ingredients (entity_id, name, category, unit, alimentare)
  values (v_entita, 'ZZZ-VERIFICA-numero', 'verdura', 'kg', true)
  returning id into v_ing;

  select count(*) into v_numero from ingredients;

  -- ------------------------------------------------------------------
  -- (A) IL NUMERO DIVENTA L'IDENTIFICATIVO GIUSTO.
  --     🔴 Il controllo che vale di piu': prima di questa migrazione
  --     restituiva sempre «non trovato», perche' la funzione che traduce
  --     non era chiamabile da nessuno.
  -- ------------------------------------------------------------------
  v_ris := voce_risolvi_dati('giacenza', jsonb_build_object('prodotto', v_numero, 'quanto_ce', 3));
  if (v_ris->'dati'->>'ingredient_id')::uuid is distinct from v_ing then
    raise exception 'Il numero % non ha dato il prodotto giusto: % invece di %',
      v_numero, v_ris->'dati'->>'ingredient_id', v_ing;
  end if;
  if nullif(v_ris->>'manca', '') is not null then
    raise exception 'Un prodotto trovato risulta mancante: %', v_ris->>'manca';
  end if;

  -- ------------------------------------------------------------------
  -- (B) Un numero che non esiste dice CHE COSA non ha trovato, col nome
  --     che ha sentito. ⚠️ «Non ho trovato bottarga» e «non ho capito
  --     di cosa parlavi» sono due frasi diverse perche' sono due
  --     problemi diversi.
  -- ------------------------------------------------------------------
  v_ris := voce_risolvi_dati('giacenza',
    jsonb_build_object('prodotto', 999999, 'nome_sentito', 'bottarga di tonno'));
  if nullif(v_ris->>'manca', '') is null then
    raise exception 'Un numero inesistente non ha prodotto nessun motivo';
  end if;
  if v_ris->>'manca' not like '%bottarga di tonno%' then
    raise exception 'Il motivo non dice che cosa non ha trovato: %', v_ris->>'manca';
  end if;

  -- ------------------------------------------------------------------
  -- (C) SULLA LISTA DELLA SPESA il nome sentito BASTA.
  --     🔴 Era il terzo difetto del collaudo: «aggiungi le busiate
  --     trafilate» falliva con «serve un ingrediente o un nome».
  -- ------------------------------------------------------------------
  v_ris := voce_risolvi_dati('lista_spesa',
    jsonb_build_object('prodotto', 999999, 'nome_sentito', 'busiate trafilate'));
  if v_ris->'dati'->>'nome_libero' <> 'busiate trafilate' then
    raise exception 'Il nome sentito non e'' diventato una riga di lista: %', v_ris->'dati';
  end if;
  if nullif(v_ris->>'manca', '') is not null then
    raise exception 'Una riga di lista con un nome scritto a mano risulta incompleta: %', v_ris->>'manca';
  end if;

  -- ------------------------------------------------------------------
  -- (D) IL GIRO INTERO: una dettatura col numero si esegue da se'.
  -- ------------------------------------------------------------------
  v_ris := registra_dettatura(
    'di quella verdura ce ne sono tre chili',
    jsonb_build_array(jsonb_build_object('tipo', 'giacenza', 'sicuro', true,
      'dati', jsonb_build_object('prodotto', v_numero, 'quanto_ce', 3, 'nome_sentito', 'quella verdura'),
      'frase', 'ZZZ-VERIFICA-numero: ce ne sono 3 kg')),
    'capita', 'claude-sonnet-5', 100, 20, null);
  v_dett := (v_ris->>'dettatura_id')::uuid;

  if (v_ris->>'eseguite')::integer <> 1 then
    select * into v_a from azioni_dettate where dettatura_id = v_dett;
    raise exception 'La giacenza col numero non si e'' salvata da se'': % — %', v_a.stato, coalesce(v_a.errore, v_a.motivo);
  end if;

  select coalesce(sum(sl.quantity_remaining), 0) into v_n
    from stock_lots sl where sl.ingredient_id = v_ing;
  if v_n <> 3 then
    raise exception 'La giacenza non e'' arrivata in magazzino: % invece di 3', v_n;
  end if;

  -- ------------------------------------------------------------------
  -- Pulizia — per identificativo, solo roba nostra.
  -- ------------------------------------------------------------------
  delete from dettature where id = v_dett;
  delete from rettifiche_giacenza where ingredient_id = v_ing;
  delete from stock_consumptions where ingredient_id = v_ing;
  delete from stock_lots where ingredient_id = v_ing;
  delete from ingredients where id = v_ing;

  select count(*) into v_n from ingredients where name = 'ZZZ-VERIFICA-numero';
  if v_n <> 0 then
    raise exception 'E'' rimasto il prodotto della verifica';
  end if;

  select count(*) into v_lapidi_post from deleted_records;
  if v_lapidi_post <> v_lapidi_pre then
    raise exception 'La verifica ha lasciato % lapidi', v_lapidi_post - v_lapidi_pre;
  end if;

  perform set_config('request.jwt.claims', null, true);

  raise notice 'Il numero del catalogo diventa il prodotto giusto, un numero che non esiste dice quale nome non ha trovato, e sulla lista della spesa il nome sentito basta da solo.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260826000004', 'il_numero_diventa_il_prodotto_giusto')
on conflict (version) do nothing;
