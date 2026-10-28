-- =====================================================================
-- LA VOCE SA DIRE DOVE — 28/10/2026, con i promemoria per luogo
-- (20261028000001). Alessio: «quando arrivo a casa ricordami di pesare
-- la mamma».
-- =====================================================================
--
-- 🔴 IL RAMO `promemoria` DI `fai_azione_dettata` SCRIVE ANCHE IL LUOGO.
--    Fino a qui leggeva solo le chiavi che conosceva: un «luogo» capito
--    dall'assistente sarebbe caduto in silenzio, e il promemoria sarebbe
--    nato senza casa — cioe' non sarebbe mai stato ricordato.
--
-- ⚠️ CHI SCRIVE NON SI FIDA DI CHI CHIAMA, come per l'ora (10/09/2026):
--    il luogo passa da una lista scritta qui, non dal vincolo. Un luogo
--    che non e' fra quelli ammessi (l'assistente che sente «garage») NON
--    fa fallire la dettatura: l'impegno nasce lo stesso, senza luogo. Far
--    perdere tutto per un luogo mancato toglierebbe il titolo, che invece
--    e' stato capito — la stessa scelta fatta per l'ora non capita.
--
-- ⚠️ IL CORPO SI TOCCA SUL POSTO, non si riscrive: si prende quello vivo
--    con `pg_get_functiondef` e si sostituiscono DUE pezzi esatti, che
--    devono comparire una volta sola (la stessa forma della
--    20261025000042). Se il corpo vivo e' cambiato e i pezzi non ci sono,
--    la migrazione si ferma e lo dice, invece di scrivere a meta'.
--    Corpo letto il 28/10/2026: produzione e progetto di prova identici.

do $fai$
declare
  v_def      text := replace(pg_get_functiondef('public.fai_azione_dettata(text,jsonb)'::regprocedure), E'\r', '');
  v_colonne  text := E'                         origine_modulo, remind_at, due_time)';
  v_ritorno  text := E'      return jsonb_build_object(''task_id'', v_id, ''avviso'', v_avviso, ''ora'', v_ora_imp);';
  v_valori   text := E'        v_avviso,\n        v_ora_imp::time)\n      returning id into v_id;';
  v_quante   integer;
begin
  if v_def like '%-- 28/10/2026: il luogo%' then
    return;  -- gia' applicata: idempotente
  end if;
  foreach v_quante in array array[
    (length(v_def) - length(replace(v_def, v_colonne, ''))) / length(v_colonne),
    (length(v_def) - length(replace(v_def, v_ritorno, ''))) / length(v_ritorno),
    (length(v_def) - length(replace(v_def, v_valori, ''))) / length(v_valori)]
  loop
    if v_quante <> 1 then
      raise exception 'fai_azione_dettata nel database non ha il ramo «promemoria» che questa migrazione si aspetta: guarda il corpo vivo prima di toccarla.';
    end if;
  end loop;

  v_def := replace(v_def, v_colonne,
    E'                         origine_modulo, remind_at, due_time, luogo)');
  v_def := replace(v_def, v_valori,
    E'        v_avviso,\n        v_ora_imp::time,'
    || E'\n        -- 28/10/2026: il luogo, solo se e'' uno di quelli ammessi;'
    || E'\n        -- un luogo sconosciuto non ferma la dettatura, si lascia vuoto.'
    || E'\n        case lower(btrim(coalesce(p_dati->>''luogo'', '''')))'
    || E'\n          when ''casa'' then ''casa'''
    || E'\n          when ''ristorante'' then ''ristorante'''
    || E'\n        end)'
    || E'\n      returning id into v_id;');
  v_def := replace(v_def, v_ritorno,
    E'      return jsonb_build_object(''task_id'', v_id, ''avviso'', v_avviso, ''ora'', v_ora_imp,'
    || E'\n                                ''luogo'', (select luogo from tasks where id = v_id));');
  execute v_def;
end $fai$;

revoke all on function fai_azione_dettata(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_r        jsonb;
  v_luogo    text;
  v_titolo   text;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'VERIFICA: serve un titolare per questa verifica.';
  end if;

  if has_function_privilege('authenticated', 'fai_azione_dettata(text, jsonb)', 'execute')
     or has_function_privilege('anon', 'fai_azione_dettata(text, jsonb)', 'execute') then
    raise exception 'VERIFICA: fai_azione_dettata e'' aperta a chi non deve.';
  end if;

  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- (1) «quando arrivo a casa ricordami di pesare la mamma»: l'impegno
    --     nasce di casa, e la risposta lo dice.
    v_r := fai_azione_dettata('promemoria',
      jsonb_build_object('titolo', 'PROVA pesare la mamma', 'luogo', 'Casa'));
    select luogo into v_luogo from tasks where id = (v_r->>'task_id')::uuid;
    if v_luogo is distinct from 'casa' or v_r->>'luogo' is distinct from 'casa' then
      raise exception 'VERIFICA (1): il promemoria di casa ha il luogo «%» (risposta «%»).', v_luogo, v_r->>'luogo';
    end if;

    -- (2) Un luogo sconosciuto non ferma la dettatura: nasce senza luogo.
    v_r := fai_azione_dettata('promemoria',
      jsonb_build_object('titolo', 'PROVA in garage', 'luogo', 'garage'));
    select luogo, title into v_luogo, v_titolo from tasks where id = (v_r->>'task_id')::uuid;
    if v_titolo is distinct from 'PROVA in garage' or v_luogo is not null then
      raise exception 'VERIFICA (2): con «garage» l''impegno e'' «%» col luogo «%».', v_titolo, v_luogo;
    end if;

    -- (3) Senza luogo, come prima.
    v_r := fai_azione_dettata('promemoria', jsonb_build_object('titolo', 'PROVA senza luogo'));
    select luogo into v_luogo from tasks where id = (v_r->>'task_id')::uuid;
    if v_luogo is not null then
      raise exception 'VERIFICA (3): un promemoria senza luogo ha il luogo «%».', v_luogo;
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica del luogo a voce');

  raise notice 'Fatto: un promemoria dettato tiene il luogo se e'' casa o ristorante, nasce senza luogo se ne sente un altro, e senza luogo resta com''era. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261028000002', 'la_voce_sa_dire_dove')
on conflict (version) do nothing;
