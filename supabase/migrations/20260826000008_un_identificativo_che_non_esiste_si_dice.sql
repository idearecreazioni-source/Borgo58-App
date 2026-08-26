-- ============================================================================
-- UN IDENTIFICATIVO CHE NON ESISTE SI DICE — 26/08/2026
-- ============================================================================
--
-- 🔴 IL DIFETTO, letto nel corpo vivo di `voce_risolvi_dati` prima di
--    toccare niente. La funzione traduce il numero detto a voce
--    nell'identificativo della riga («il prodotto 12» → quell'ingrediente),
--    e **quando l'identificativo arriva gia' scritto lo prende cosi' com'e'**,
--    senza chiedersi se quella riga esista.
--
--    Il controllo di esistenza c'era solo sull'altra strada, quella che
--    parte dal numero: `voce_prodotto_numero`, `voce_frigorifero_numero`,
--    `voce_pulizia_numero` restituiscono vuoto se il numero non trova
--    niente. Sulla strada dell'identificativo gia' scritto, no.
--
--    Le due strade non sono simmetriche per un motivo: la seconda serve a
--    riprendere in mano un'azione rimasta in attesa. Ma da li' passano
--    anche i dati che un modello ha proposto — e un modello un
--    identificativo se lo puo' inventare.
--
-- ----------------------------------------------------------------------------
-- COSA SI VEDEVA, E PERCHE' NON AIUTA NESSUNO
-- ----------------------------------------------------------------------------
-- L'azione arrivava fino in fondo e moriva con l'errore tecnico della
-- funzione sottostante. Per la merce buttata, MISURATO sul progetto di
-- prova rimettendo la funzione com'era e rifacendo il giro intero:
--
--     stato: fallita | errore: «Giacenza insufficiente: disponibili 0, richiesti 2»
--
-- che e' una frase sulla giacenza **di un prodotto che non esiste**. In
-- cucina non dice niente a nessuno, e soprattutto manda a cercare la cosa
-- sbagliata: uno va a guardare il magazzino invece di guardare il nome.
--
-- E l'azione finiva `fallita`, cioe' fuori dagli occhi di Alessio, mentre
-- il modulo ha gia' la strada giusta per questo caso: `manca` valorizzato,
-- `sicuro` che decade a falso, azione **in attesa** con una frase in
-- italiano. E' la decisione del 26/08 in DECISIONI.md — *quando non trova
-- il prodotto nominato mette QUELLA RIGA da parte e la chiede alla fine* —
-- che valeva per il nome e non valeva per l'identificativo.
--
-- ----------------------------------------------------------------------------
-- DUE COSE CHE QUESTA MIGRAZIONE DECIDE
-- ----------------------------------------------------------------------------
--
-- 1. SI GUARDA CHE LA RIGA ESISTA, NON CHE SIA ATTIVA. Un frigo spento o
--    una pulizia tolta dal piano restano righe vere: se Alessio conferma
--    oggi una temperatura misurata ieri su un frigo nel frattempo
--    disattivato, quella misura va scritta, non persa. ⚠️ La strada del
--    NUMERO invece continua a guardare i soli attivi, ed e' giusto: li' si
--    sta scegliendo adesso, e non ha senso proporre un frigo spento.
--
-- 2. L'IDENTIFICATIVO SBAGLIATO SI TOGLIE DAI DATI, non si lascia li'.
--    Se restasse, la riga in attesa porterebbe addosso un identificativo
--    che non punta a niente, e il primo che la conferma ricadrebbe
--    esattamente nell'errore di prima.
--
-- ----------------------------------------------------------------------------
-- COSA ABBIAMO ROVESCIATO
-- ----------------------------------------------------------------------------
-- Niente di deciso da Alessio. Questa migrazione **estende** la sua
-- decisione del 26/08 al caso che non era coperto: la riga si mette da
-- parte anche quando a mancare non e' il nome ma la riga stessa.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- La funzione — corpo ripreso dal DATABASE VIVO
-- ----------------------------------------------------------------------------
-- 🔴 Preso con `pg_get_functiondef` dalla produzione. Cambia in un punto
--    solo: dopo aver ricavato l'identificativo — da qualunque delle due
--    strade — si controlla che la riga ci sia.
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
  -- 🔴 «Non l'ho trovato» e «me l'avevi dato e non c'e'» sono due fatti
  --    diversi, e la frase deve dire quale dei due: nel primo caso il
  --    nome non e' stato riconosciuto, nel secondo qualcosa e' stato
  --    cancellato — o inventato da un modello.
  v_perso   boolean := false;
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

  return jsonb_build_object('dati', v_dati, 'manca', v_manca);
end $funzione$;

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- ⚠️ Gli identificativi di cio' che creo stanno in un ARRAY, e la pulizia
--    cancella solo quelli. Il controllo finale conta le RIGHE, non le
--    lapidi: `dettature` non e' una tabella tracciata.
do $verifica$
declare
  v_tit     uuid;
  v_ris     jsonb;
  v_finto   uuid := gen_random_uuid();
  v_dett    uuid[] := '{}';
  v_pre     integer;
  v_post    integer;
  v_a       azioni_dettate%rowtype;
  v_scritto jsonb;
begin
  select count(*) into v_pre from dettature;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Non c''e'' nessun titolare: questa verifica non puo'' girare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- ------------------------------------------------------------------
  -- (A) I TRE CASI, uno per uno: identificativo inventato.
  --     Deve tornare `manca` valorizzato E l'identificativo tolto dai dati.
  -- ------------------------------------------------------------------
  v_ris := voce_risolvi_dati('merce_buttata',
    jsonb_build_object('ingredient_id', v_finto, 'quanto', 2));
  if nullif(v_ris->>'manca', '') is null then
    raise exception 'Un prodotto inventato e'' passato senza che niente mancasse: %', v_ris;
  end if;
  if v_ris->'dati' ? 'ingredient_id' then
    raise exception 'L''identificativo inventato e'' rimasto nei dati: %', v_ris->'dati';
  end if;
  raise notice 'prodotto inventato: «%»', v_ris->>'manca';

  v_ris := voce_risolvi_dati('temperatura',
    jsonb_build_object('equipment_id', v_finto, 'gradi', 4));
  if nullif(v_ris->>'manca', '') is null then
    raise exception 'Un frigo inventato e'' passato senza che niente mancasse: %', v_ris;
  end if;
  if v_ris->'dati' ? 'equipment_id' then
    raise exception 'L''identificativo del frigo inventato e'' rimasto nei dati: %', v_ris->'dati';
  end if;
  raise notice 'frigo inventato: «%»', v_ris->>'manca';

  v_ris := voce_risolvi_dati('pulizia', jsonb_build_object('task_id', v_finto));
  if nullif(v_ris->>'manca', '') is null then
    raise exception 'Una pulizia inventata e'' passata senza che niente mancasse: %', v_ris;
  end if;
  if v_ris->'dati' ? 'task_id' then
    raise exception 'L''identificativo della pulizia inventata e'' rimasto nei dati: %', v_ris->'dati';
  end if;
  raise notice 'pulizia inventata: «%»', v_ris->>'manca';

  -- ------------------------------------------------------------------
  -- (B) UN IDENTIFICATIVO BUONO DEVE ANCORA PASSARE.
  --     🔴 Senza questo, un controllo che rifiuta tutto sembrerebbe
  --     funzionare benissimo.
  -- ------------------------------------------------------------------
  if exists (select 1 from haccp_equipment) then
    v_ris := voce_risolvi_dati('temperatura', jsonb_build_object(
      'equipment_id', (select id from haccp_equipment order by name limit 1), 'gradi', 4));
    if nullif(v_ris->>'manca', '') is not null then
      raise exception 'Un frigo VERO e'' stato rifiutato: %', v_ris->>'manca';
    end if;
    if not (v_ris->'dati' ? 'equipment_id') then
      raise exception 'Un frigo vero ha perso il proprio identificativo: %', v_ris->'dati';
    end if;
  else
    raise notice 'nessun frigo in anagrafica: il caso «identificativo buono» non e'' stato provato qui';
  end if;

  -- ------------------------------------------------------------------
  -- (C) IL GIRO INTERO: la riga finisce IN ATTESA, non FALLITA.
  --     E' il difetto vero — prima moriva con l'errore della giacenza.
  -- ------------------------------------------------------------------
  v_scritto := scrivi_dettatura(v_tit, 'buttane due chili', 'app',
    jsonb_build_array(jsonb_build_object(
      'tipo', 'merce_buttata', 'sicuro', true,
      'frase', 'Butta 2 kg di un prodotto che non esiste',
      -- ⚠️ Il campo si chiama `quantita`, come lo legge `fai_azione_dettata`.
      --    Scrivendolo `quanto` la prova passerebbe lo stesso ma proverebbe
      --    un'altra cosa: si fermerebbe prima, su una quantita' vuota.
      'dati', jsonb_build_object('ingredient_id', v_finto, 'quantita', 2))),
    'capita', null, 0, 0, null);
  v_dett := v_dett || (v_scritto->>'dettatura_id')::uuid;

  select * into v_a from azioni_dettate
   where dettatura_id = (v_scritto->>'dettatura_id')::uuid;

  if v_a.stato <> 'in_attesa' then
    raise exception 'Un prodotto inesistente ha prodotto un''azione «%» invece che in attesa (errore: %)',
      v_a.stato, v_a.errore;
  end if;
  if v_a.sicuro then
    raise exception 'Un prodotto inesistente e'' rimasto marcato sicuro.';
  end if;
  raise notice 'giro intero: stato %, motivo «%»', v_a.stato, v_a.motivo;

  -- ------------------------------------------------------------------
  -- PULIZIA — solo per identificativo, tenuti in elenco.
  -- ------------------------------------------------------------------
  delete from dettature where id = any(v_dett);
  select count(*) into v_post from dettature;
  if v_post <> v_pre then
    raise exception 'Residuo in dettature: erano %, sono %.', v_pre, v_post;
  end if;
  raise notice 'identificativi: create % dettature, tolte tutte. dettature % -> %',
    array_length(v_dett, 1), v_pre, v_post;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260826000008', 'un_identificativo_che_non_esiste_si_dice') on conflict (version) do nothing;
