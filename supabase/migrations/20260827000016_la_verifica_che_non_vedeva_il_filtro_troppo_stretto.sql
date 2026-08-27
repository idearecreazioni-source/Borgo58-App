-- ============================================================================
-- LA VERIFICA CHE NON VEDEVA IL FILTRO TROPPO STRETTO — 27/08/2026
-- ============================================================================
--
-- 🔴 TROVATO DALLA SECONDA ROTTURA, non dalla prima. Il filtro dei vocabolari
--    della `20260827000015` può sbagliare in **due versi**:
--      (a) lascia passare un valore che non esiste → il menu mostra la prima
--          opzione, plausibile e scelta da nessuno;
--      (b) scarta **anche i valori veri** → i campi buoni arrivano vuoti, e
--          il precompilamento smette di servire a qualcosa.
--
--    La verifica prendeva **solo (a)**. Messo un filtro che restituisce
--    sempre vuoto, è passata **VERDE**.
--
-- ----------------------------------------------------------------------------
-- LA RAGIONE, MISURATA
-- ----------------------------------------------------------------------------
--   `null <> 'primo'`                  →  **NULL**, e un `if` su NULL non scatta
--   `null is distinct from 'primo'`    →  **true**
--
-- 🔴 È LA TRAPPOLA DEL 26/08 — *«in SQL il terzo stato non si comporta come
--    un valore: sparisce dai confronti»* — ricomparsa **nello stesso giorno
--    in cui è stata riletta**, e in un posto nuovo: non più in un guardiano
--    sui dati, ma **dentro il blocco di verifica di una migrazione**.
--
-- ⚠️ E il verso in cui è pericolosa è quello peggiore: *ogni volta che una
--    verifica confronta con `<>` un valore che la funzione può restituire
--    VUOTO, quel controllo tace proprio nel caso in cui la funzione ha
--    smesso di rispondere.* Un controllo che non scatta quando il codice si
--    rompe è indistinguibile da uno che approva.
--
-- ⚠️ La `…015` **non si riscrive**: è già applicata (regola del 23/08 —
--    *«il file racconta cosa è successo quel giorno»*). Il controllo buono
--    sta qui, rifatto con roba propria.
-- ============================================================================

do $verifica$
declare
  v_tit uuid;
  v_ris jsonb;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Verifica impossibile: non c''e'' nessun titolare.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  -- ------------------------------------------------------------------
  -- 1. IL VERSO CHE MANCAVA: un valore vero non deve sparire
  -- ------------------------------------------------------------------
  -- ⚠️ `is distinct from` e non `<>`: con `<>` un ritorno VUOTO produce NULL
  --    e l'`if` non scatta — cioè il controllo tace proprio quando serve.
  if valore_del_vocabolario('tasks', 'category', 'fisco_scadenze')
       is distinct from 'fisco_scadenze' then
    raise exception 'Il filtro ha portato via una categoria VERA: i campi buoni arriverebbero vuoti.';
  end if;
  if valore_del_vocabolario('recipes', 'category', 'primo') is distinct from 'primo' then
    raise exception 'Il filtro ha portato via una categoria di ricetta vera.';
  end if;
  if valore_del_vocabolario('cash_movements', 'direction', 'uscita') is distinct from 'uscita' then
    raise exception 'Il filtro ha portato via il verso di un movimento.';
  end if;
  if valore_del_vocabolario('ingredients', 'unit', 'kg') is distinct from 'kg' then
    raise exception 'Il filtro ha portato via l''unita'' di misura.';
  end if;
  if valore_del_vocabolario('tasks', 'title', 'Chiamare Laura')
       is distinct from 'Chiamare Laura' then
    raise exception 'Un campo di testo libero e'' stato filtrato come se avesse un vocabolario.';
  end if;

  -- ------------------------------------------------------------------
  -- 2. E l'altro verso continua a essere preso
  -- ------------------------------------------------------------------
  if valore_del_vocabolario('tasks', 'category', 'fisco') is not null then
    raise exception 'Una categoria che non esiste e'' passata.';
  end if;

  -- ------------------------------------------------------------------
  -- 3. Sulla funzione intera, nei due versi insieme
  -- ------------------------------------------------------------------
  -- ⚠️ Un caso solo non discrimina: serve una riga che porti **insieme** un
  --    valore buono e uno storto, così una cura sbagliata in un verso o
  --    nell'altro si vede subito.
  v_ris := azione_campi('promemoria', jsonb_build_object(
    'titolo', 'Chiamare il commercialista',
    'categoria', 'fisco',            -- storto: deve sparire
    'priorita', 'alta'));            -- vero:   deve restare
  if v_ris ? 'categoria' then
    raise exception 'La categoria fuori elenco e'' arrivata alla schermata: %', v_ris;
  end if;
  if v_ris->>'priorita' is distinct from 'alta' then
    raise exception 'La priorita'' vera e'' sparita insieme a quella storta: %', v_ris;
  end if;
  if v_ris->>'titolo' is distinct from 'Chiamare il commercialista' then
    raise exception 'Il filtro ha toccato un campo che non ha vocabolario: %', v_ris;
  end if;

  raise notice 'Il filtro dei vocabolari e'' provato nei DUE versi: scarta solo lo storto, e i valori veri arrivano tutti.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000016', 'la_verifica_che_non_vedeva_il_filtro_troppo_stretto') on conflict (version) do nothing;
