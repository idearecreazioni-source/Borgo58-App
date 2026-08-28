-- ============================================================================
-- I TRE POSTI CHE NOMINAVANO IL CAMPO SENZA NOMINARE LA COLONNA — 28/08/2026
-- ============================================================================
--
-- 🔴 IL CENSIMENTO ERA TROPPO STRETTO, e se ne e' accorto il codice, non una
--    rilettura. Il mandato — e la mia stessa misura — contavano le funzioni
--    che nominano `ingredients.shelf_life_days`: NOVE, identiche in produzione
--    e sulla prova, e la domanda «ce n'e' una decima?» aveva risposta no.
--
--    La risposta era no ALLA DOMANDA SBAGLIATA. In questo progetto la durata
--    ha DUE nomi: la colonna (`shelf_life_days`) e l'etichetta del campo
--    (`'durata'`, `'fonte_durata'`), che vive negli elenchi dei campi che
--    l'assistente puo' compilare. Cercando il secondo nome saltano fuori
--    **altri tre posti**, e nessuno di loro nomina la colonna:
--
--      · marca_campi_dall_assistente — 'durata' fra i campi riconosciuti
--      · applica_scheda_prodotto ..... 'fonte_durata', da dove veniva la durata
--      · tocca_campo_confermato ...... un commento che spiega il `::text` con
--                                      l'esempio di un campo che non c'e' piu'
--
-- ⚠️ E IL PRIMO NON ERA INNOCUO: `marca_campi_dall_assistente` scarta quello
--    che non riconosce, quindi 'durata' rimasta li' e' una promessa che
--    nessuno puo' piu' mantenere. Lo stesso elenco vive nel codice
--    (`CAMPI_PROPONIBILI`), e il commento accanto dice che i due devono
--    restare d'accordo: tolto da una parte sola, si separano in silenzio.
--
-- ⚠️ IL SECONDO E' PEGGIO DEL PRIMO: `fonte_durata` dichiarava **su cosa si
--    reggeva** un numero che non esiste piu'. Sarebbe rimasta a scrivere in
--    `fonti_campi` la provenienza di un dato sparito — cioe' una riga che
--    racconta la storia di una cosa mai avvenuta.
--
-- ----------------------------------------------------------------------------
-- LA LEZIONE, scritta perche' tornera'
-- ----------------------------------------------------------------------------
--    Quando si toglie un dato, il setaccio non si fa sul nome della colonna:
--    si fa su **tutti i nomi con cui quel dato viene chiamato**. Qui erano
--    tre, e due li conosceva solo chi aveva scritto gli elenchi dei campi.
--    E' la stessa famiglia del 27/08 — *una regola tolta vive in piu' posti
--    di quanti se ne toccano togliendola* — vista dal lato del dato invece
--    che della regola.
--
-- ----------------------------------------------------------------------------
-- COSA CAMBIA PER IL LOCALE
-- ----------------------------------------------------------------------------
--    Niente che si veda. Sparisce un campo che l'assistente non poteva piu'
--    compilare e la traccia di dove veniva un numero che non c'e' piu'.
-- ============================================================================

-- rete-guardie: marca_campi_dall_assistente — «durata» esce dai campi che l'assistente puo' compilare: la durata dei prodotti comprati non esiste piu' dal 28/08, e un campo riconosciuto ma non scrivibile e' una promessa che nessuno puo' mantenere
-- rete-guardie: applica_scheda_prodotto — «fonte_durata» esce: dichiarava da dove veniva un numero che non c'e' piu', cioe' la storia di una cosa mai avvenuta
-- rete-guardie: tocca_campo_confermato — il commento non usa piu' «durata» come esempio: spiegava una regola vera con un campo che non esiste piu'

-- --- marca_campi_dall_assistente ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.marca_campi_dall_assistente(p_ingredient_id uuid, p_campi text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_noti  text[] := array['nome','categoria','unita','conservazione','temperatura','stagionalita'];
  v_buoni text[];
  v_scartati text[];
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' segnare i campi di una scheda.';
  end if;

  -- ⚠️ UN VOCABOLARIO CHIUSO, e serve: un nome di campo scritto storto
  --    entrerebbe in un elenco che la schermata legge, e li' comparirebbe
  --    una marcatura su un campo che non esiste — muta e mai spiegabile.
  select coalesce(array_agg(x order by x), '{}') into v_buoni
    from unnest(coalesce(p_campi, '{}')) x where x = any(v_noti);
  select coalesce(array_agg(x order by x), '{}') into v_scartati
    from unnest(coalesce(p_campi, '{}')) x where x <> all(v_noti);

  update ingredients
     set campi_dall_assistente = v_buoni
   where id = p_ingredient_id;

  if not found then
    raise exception 'Questo prodotto non esiste piu''.';
  end if;

  return jsonb_build_object('segnati', to_jsonb(v_buoni), 'scartati', to_jsonb(v_scartati));
end $function$;

-- --- applica_scheda_prodotto ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.applica_scheda_prodotto(p_ingredient_id uuid, p_campi jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ing        ingredients%rowtype;
  v_allergeni  allergen[] := '{}';
  v_mesi       month_code[] := '{}';
  v_scartati   text[] := '{}';
  v_x          text;
  v_scritti    text[] := '{}';
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' compilare la scheda di un prodotto';
  end if;

  select * into v_ing from ingredients where id = p_ingredient_id for update;
  if not found then
    raise exception 'Questo prodotto non esiste piu''';
  end if;

  -- Gli allergeni si scrivono solo se nessuno li ha ancora guardati:
  -- una stima non sovrascrive mai un'etichetta letta ne' una conferma.
  if v_ing.origine_allergeni is null and p_campi ? 'allergeni' then
    for v_x in select jsonb_array_elements_text(p_campi->'allergeni')
    loop
      begin
        v_allergeni := v_allergeni || v_x::allergen;
      exception when others then
        v_scartati := v_scartati || v_x;
      end;
    end loop;
    update ingredients
       set allergens = v_allergeni,
           origine_allergeni = 'stimati'
     where id = p_ingredient_id;
    v_scritti := v_scritti || 'allergeni'::text;
  end if;

  if coalesce(array_length(v_ing.seasonality, 1), 0) = 0 and p_campi ? 'stagionalita' then
    for v_x in select jsonb_array_elements_text(p_campi->'stagionalita')
    loop
      begin
        v_mesi := v_mesi || v_x::month_code;
      exception when others then
        v_scartati := v_scartati || v_x;
      end;
    end loop;
    if array_length(v_mesi, 1) > 0 then
      update ingredients set seasonality = v_mesi where id = p_ingredient_id;
      v_scritti := v_scritti || 'stagionalita'::text;
    end if;
  end if;

  if v_ing.storage_type is null and nullif(p_campi->>'conservazione', '') is not null then
    begin
      update ingredients
         set storage_type = (p_campi->>'conservazione')::storage_type
       where id = p_ingredient_id;
      v_scritti := v_scritti || 'conservazione'::text;
    exception when others then
      v_scartati := v_scartati || (p_campi->>'conservazione');
    end;
  end if;

  if v_ing.temperatura_attesa is null and nullif(p_campi->>'temperatura', '') is not null then
    update ingredients
       set temperatura_attesa = p_campi->>'temperatura'
     where id = p_ingredient_id;
    v_scritti := v_scritti || 'temperatura'::text;
  end if;

  -- Lo scarto: zero e' il valore di partenza e vuol dire «non lo so»,
  -- non «non si scarta niente». Sopra il 95% e' quasi certamente un
  -- errore del modello, e sfalserebbe il costo di ogni piatto.
  -- 🔴 LO SCARTO NON SI SCRIVE PIU' QUI (23/08/2026, decisione di
  -- Alessio). Se il modello lo mandasse lo stesso, si dichiara come
  -- scartato invece di finire nel costo dei piatti.
  if (p_campi->>'scarto_percento') is not null then
    v_scartati := v_scartati || 'scarto (non si indovina: lo dice la preparazione)'::text;
  end if;

  -- 🔴 «NON E' UN ALIMENTO» (23/08/2026). Solo in questa direzione:
  -- marcarlo alimento non farebbe niente, marcarlo non-alimento lo toglie
  -- dal Ricettario — e quello si vede. E si scrive solo se nessuno ha gia'
  -- deciso il contrario a mano.
  if (p_campi->>'alimentare') = 'false' and v_ing.alimentare
     and not ('alimentare' = any (coalesce(v_ing.campi_da_confermare, '{}'::text[]))) then
    update ingredients set alimentare = false where id = p_ingredient_id;
    v_scritti := v_scritti || 'alimentare'::text;
  end if;

  -- Da dove viene cio' che la macchina ha proposto. Non cambia il valore:
  -- dichiara su cosa si regge.
  if nullif(p_campi->>'fonte_stagionalita', '') is not null then
    update ingredients
       set fonti_campi = fonti_campi
             || jsonb_strip_nulls(jsonb_build_object(
                  'stagionalita', nullif(p_campi->>'fonte_stagionalita', '')))
     where id = p_ingredient_id;
  end if;

  -- 🔴 IL SEGNO (23/08/2026). Prima questa riga scriveva solo QUANDO la
  -- macchina aveva compilato; adesso scrive anche COSA, cosi' che a schermo
  -- si veda quale numero e' una stima e quale l'ha guardato Alessio.
  --
  -- ⚠️ Gli allergeni restano fuori dalla lista, e non e' una dimenticanza:
  -- ce l'hanno gia' una loro (`origine_allergeni`), con tre stati invece di
  -- due perche' li' esiste l'etichetta, che e' la fonte legale. Metterli
  -- anche qui vorrebbe dire due posti che dicono la stessa cosa e possono
  -- contraddirsi — che in questo progetto e' un difetto, non una comodita'.
  update ingredients
     set campi_compilati_il = now(),
         campi_da_confermare = coalesce((
           select array_agg(distinct x order by x)
             from unnest(campi_da_confermare || v_scritti) x
            where x <> 'allergeni'
         ), '{}')
   where id = p_ingredient_id;

  return jsonb_build_object(
    'id', p_ingredient_id,
    'scritti', to_jsonb(v_scritti),
    'scartati', to_jsonb(v_scartati));
end
$function$;

-- --- tocca_campo_confermato ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.tocca_campo_confermato()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_tolti text[] := '{}';
begin
  -- ⚠️ Solo se il VALORE cambia davvero: un salvataggio che riscrive lo
  -- stesso numero non e' uno sguardo. Ed e' la differenza fra «l'ha
  -- confermato» e «ha premuto Salva».
  -- ⚠️ IL `::text` NON E' PIGNOLERIA: senza, Postgres legge una parola come
  -- un letterale di ARRAY e si ferma con «malformed array literal». Trovato
  -- applicando, non rileggendo — la verifica chiama la funzione, e una
  -- funzione che si crea non e' una funzione che funziona (17/08).
  if new.seasonality is distinct from old.seasonality then v_tolti := v_tolti || 'stagionalita'::text; end if;
  if new.storage_type is distinct from old.storage_type then v_tolti := v_tolti || 'conservazione'::text; end if;
  if new.temperatura_attesa is distinct from old.temperatura_attesa then v_tolti := v_tolti || 'temperatura'::text; end if;
  if new.waste_percentage_default is distinct from old.waste_percentage_default then v_tolti := v_tolti || 'scarto'::text; end if;

  -- 🔴 AGGIUNTI IL 25/08: i campi che una lettura d'etichetta puo'
  -- proporre e che prima nessuno sorvegliava. Senza queste due righe, il
  -- nome e la categoria resterebbero marcati «l'ha messi l'assistente»
  -- anche dopo che Alessio li ha riscritti — cioe' la marcatura direbbe
  -- il falso proprio nel caso in cui serve.
  if new.name is distinct from old.name then v_tolti := v_tolti || 'nome'::text; end if;
  if new.category is distinct from old.category then v_tolti := v_tolti || 'categoria'::text; end if;
  if new.unit is distinct from old.unit then v_tolti := v_tolti || 'unita'::text; end if;

  -- 🔴 AGGIUNTO IL 27/08: la mano che tocca gli allergeni si registra da
  --    se'. Chi sa da dove vengono lo DICHIARA scrivendo anche l'origine;
  --    chi cambia il solo elenco e' una persona che ha guardato.
  if new.allergens is distinct from old.allergens
     and new.origine_allergeni is not distinct from old.origine_allergeni then
    new.origine_allergeni := 'confermati';
    v_tolti := v_tolti || 'allergeni'::text;
  end if;

  if array_length(v_tolti, 1) > 0 then
    new.campi_da_confermare := coalesce((
      select array_agg(x order by x)
        from unnest(new.campi_da_confermare) x
       where x <> all (v_tolti)
    ), '{}');

    new.campi_dall_assistente := coalesce((
      select array_agg(x order by x)
        from unnest(new.campi_dall_assistente) x
       where x <> all (v_tolti)
    ), '{}');
  end if;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------
-- Verifica — provata ROMPENDOLA in due modi diversi
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_lapidi   bigint;
  v_lapidi2  bigint;
  v_n        integer;
  v_nomi     text;
  v_ing      uuid;
  v_miei     uuid[] := '{}';
  v_fonti    jsonb;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Serve un titolare per verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select count(*) into v_lapidi from deleted_records;

  -- (a) 🔴 IL SETACCIO SUL SECONDO NOME. E' il controllo che questa
  --     migrazione esiste per rendere possibile: nessuna funzione nomina piu'
  --     il CAMPO «durata», come nessuna nominava piu' la COLONNA.
  select count(*), coalesce(string_agg(p.proname, ', '), '')
    into v_n, v_nomi
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and (pg_get_functiondef(p.oid) like '%''durata''%'
          or pg_get_functiondef(p.oid) like '%fonte_durata%');
  if v_n <> 0 then
    raise exception 'Nominano ancora il campo «durata»: %', v_nomi;
  end if;

  -- (b) E NEMMENO LA COLONNA, che la `…004` aveva gia' tolto. ⚠️ Si
  --     ricontrolla perche' questa migrazione riscrive tre funzioni: se una
  --     fosse stata ripresa da un corpo vecchio, la colonna tornerebbe a
  --     comparire e nessun errore lo direbbe.
  select count(*), coalesce(string_agg(p.proname, ', '), '')
    into v_n, v_nomi
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and pg_get_functiondef(p.oid) like '%shelf_life_days%';
  if v_n <> 0 then
    raise exception 'E'' tornata a comparire shelf_life_days in: %', v_nomi;
  end if;

  -- (c) LE FUNZIONI RISPONDONO. Un corpo che si crea non e' un corpo che
  --     funziona (17/08): si CHIAMANO.
  v_ing := (create_ingredient(
    (select id from entities order by created_at limit 1),
    'PROVA CAMPO DURATA 28082026', 'altro', 'kg', 1
  )->>'id')::uuid;
  v_miei := v_miei || v_ing;

  -- (d) UNA FONTE DI STAGIONALITA' SI SCRIVE ANCORA. ⚠️ Serve perche' la
  --     sostituzione ha riscritto proprio quel blocco: togliendo un ramo di
  --     troppo, le fonti smetterebbero di essere registrate **senza nessun
  --     errore** — e nessuno se ne accorgerebbe finche' qualcuno non cerca
  --     da dove viene un dato.
  perform applica_scheda_prodotto(
    v_ing,
    jsonb_build_object('fonte_stagionalita', 'prova 28082026')
  );
  select fonti_campi into v_fonti from ingredients where id = v_ing;
  if v_fonti->>'stagionalita' is distinct from 'prova 28082026' then
    raise exception 'La fonte della stagionalita'' non viene piu'' scritta: %', coalesce(v_fonti::text, '<vuoto>');
  end if;

  -- (e) E UNA FONTE DELLA DURATA NON SI SCRIVE PIU'. ⚠️ E' il verso opposto
  --     di (d), e senza di lui (d) sarebbe verde anche se il blocco fosse
  --     rimasto com'era.
  perform applica_scheda_prodotto(
    v_ing,
    jsonb_build_object('fonte_durata', 'non deve entrare 28082026')
  );
  select fonti_campi into v_fonti from ingredients where id = v_ing;
  if v_fonti ? 'durata' then
    raise exception 'La fonte della durata viene ancora scritta: %', v_fonti::text;
  end if;

  delete from ingredients where id = any(v_miei);

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Il campo «durata» e'' uscito anche dai tre posti che non nominavano la colonna.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260828000005', 'il_campo_durata_esce_dai_tre_posti') on conflict (version) do nothing;
