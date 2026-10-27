-- =====================================================================
-- LA SPESA DA COLLOCARE SI FINISCE A MANO — 27/10/2026
-- =====================================================================
-- 🔴 IL DIFETTO, trovato da Alessio provando la voce sul telefono. Detto
--    «ho speso tre euro di pane», MEMO fa un appunto «spesa da collocare».
--    «Fallo a mano» portava su «Da collocare» (il percorso è dalla
--    20261025000042), ma la spesa lì non c'era ancora — la scrive solo
--    «Approva» — e la schermata non aveva un modo per scriverla. Si
--    arrivava su «Niente da collocare» e basta: un vicolo cieco.
--
-- Da qui «Fallo a mano» apre «Da collocare» con la spesa già scritta,
-- da correggere; salvando, la spesa entra fra quelle da collocare e la
-- cosa detta si chiude, nella stessa transazione (regola B4, come la
-- 20261026000002). La regola dell'11/10 non cambia: NON è contabilità,
-- è l'appunto — dove va lo si sceglie dopo, collocandolo.
--
-- ⚠️ SCRIVE COME «APPROVA», non con una strada sua: i dati dell'azione
--    passano da `voce_risolvi_dati` e poi da `fai_azione_dettata`, come
--    in `approva_appunto`. Cambiano solo i quattro campi che la schermata
--    mostra (importo, data, chi, cosa); natura proposta, mezzo, causale,
--    documento e il dettato originale restano quelli capiti da MEMO.
--
-- ⚠️ SECURITY DEFINER, con il portiere: `scrivi_spesa_da_collocare` e
--    `fai_azione_dettata` non sono concesse a nessuno, ed è giusto così.
--    La chiusura ha il suo portiere dentro `chiudi_azione_a_mano`.
-- =====================================================================

do $prerequisiti$
begin
  -- ⚠️ Nome e argomenti separati: la rete `migrazioni-senza-portieri`
  --    legge «nome(» come una chiamata, e qui le funzioni si nominano soltanto.
  if to_regprocedure('public.chiudi_azione_dalla_schermata' || '(uuid, text, text)') is null then
    raise exception 'FERMO: manca la funzione chiudi_azione_dalla_schermata, che arriva con la 20261026000002.';
  end if;
  if to_regprocedure('public.fai_azione_dettata' || '(text, jsonb)') is null
     or to_regprocedure('public.voce_risolvi_dati' || '(text, jsonb)') is null then
    raise exception 'FERMO: mancano le funzioni che eseguono le cose dette.';
  end if;
  -- La chiusura confronta il percorso: se non portasse qui, ogni salvataggio
  -- verrebbe rifiutato. Il percorso arriva con la 20261025000042.
  if (select percorso from tipi_azione_vocale where tipo = 'spesa_da_collocare') is distinct from '/cassa/da-collocare' then
    raise exception 'FERMO: «spesa da collocare» non porta a /cassa/da-collocare (serve la 20261025000042).';
  end if;
end $prerequisiti$;

-- ---------------------------------------------------------------------
-- 1 · I campi che arrivano alla schermata — inseriti nel corpo vivo
-- ---------------------------------------------------------------------
-- `azione_campi` per «spesa_da_collocare» rispondeva `{}`: la schermata
-- non avrebbe avuto niente da mostrare. Si aggiunge un ramo prima
-- dell'«else null», nel corpo VIVO (confrontato il 27/10 su prova e
-- produzione con `npm run funzione:viva azione_campi`: identici), invece
-- di ricopiare dodici rami da una migrazione vecchia.
-- ⚠️ Il fornitore arriva come NUMERO del catalogo: qui diventa il nome,
--    come nel ramo di `fai_azione_dettata`.
do $campi$
declare
  v_def    text := replace(pg_get_functiondef('public.azione_campi(text,jsonb)'::regprocedure), E'\r', '');
  v_ancora text := E'\n      else null';
  v_quante integer;
begin
  if v_def ~ 'when ''spesa_da_collocare''' then
    return;
  end if;
  v_quante := (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora);
  if v_quante <> 1 then
    raise exception 'azione_campi nel database non ha un solo «else null» (%): guarda il corpo vivo prima di toccarla.', v_quante;
  end if;
  v_def := replace(v_def, v_ancora,
    E'\n      -- La spesa da collocare (27/10/2026): i quattro campi che la schermata mostra.'
    || E'\n      when ''spesa_da_collocare'' then jsonb_strip_nulls(jsonb_build_object('
    || E'\n        ''importo'',     nullif(p_dati->>''importo'', ''''),'
    || E'\n        ''data'',        nullif(p_dati->>''data'', ''''),'
    || E'\n        ''controparte'', coalesce(nullif(btrim(coalesce(p_dati->>''controparte'', '''')), ''''),'
    || E'\n          (select s.name from suppliers s'
    || E'\n            where coalesce(p_dati->>''fornitore'', '''') ~ ''^[0-9]+$'''
    || E'\n              and s.id = voce_fornitore_numero((p_dati->>''fornitore'')::integer))),'
    || E'\n        ''descrizione'', nullif(p_dati->>''descrizione'', '''')))'
    || E'\n'
    || v_ancora);
  execute v_def;
end $campi$;

revoke all on function azione_campi(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2 · Scrivere la spesa e chiudere la cosa detta, insieme
-- ---------------------------------------------------------------------
-- ⚠️ CHIUDE PER PRIMA, SCRIVE DOPO, come la 20261026000002: stessi
--    lucchetti di `approva_appunto`, quindi un «Approva» e un salvataggio
--    insieme danno un rifiuto e mai due spese.
-- ⚠️ Un campo che la schermata manda VUOTO vuol dire «non lo so»: si
--    toglie, non si lascia quello di MEMO. Un campo che non manda resta
--    quello capito.
create or replace function annota_spesa_dettata_a_mano(p_azione_dettata_id uuid, p_campi jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c     jsonb := coalesce(p_campi, '{}'::jsonb);
  v_dati  jsonb;
  v_ris   jsonb;
  v_k     text;
begin
  if not is_titolare() then
    raise exception 'Mettere una spesa fra quelle da collocare e'' riservato al titolare.';
  end if;
  if jsonb_typeof(v_c) <> 'object' then
    raise exception 'I campi della spesa non si leggono.';
  end if;

  perform chiudi_azione_dalla_schermata(p_azione_dettata_id, '/cassa/da-collocare',
    'la spesa non e'' stata messa fra quelle da collocare.');

  select dati into v_dati from azioni_dettate where id = p_azione_dettata_id;
  -- ⚠️ «Cosa manca» qui non ferma, a differenza di approva_appunto: la
  --    scheda serve proprio a riempire quello che MEMO non aveva capito, e
  --    per una spesa da collocare ogni campo è facoltativo. Il minimo lo
  --    pretende il vincolo spesa_ha_qualcosa.
  v_ris  := voce_risolvi_dati('spesa_da_collocare', coalesce(v_dati, '{}'::jsonb));
  v_dati := coalesce(v_ris->'dati', v_dati, '{}'::jsonb);

  foreach v_k in array array['importo', 'data', 'controparte', 'descrizione'] loop
    if v_c ? v_k then
      v_dati := (v_dati - v_k) || jsonb_build_object(v_k, nullif(btrim(coalesce(v_c->>v_k, '')), ''));
    end if;
  end loop;
  -- Chi ha scritto (o cancellato) il nome a mano decide lui: il numero del
  -- fornitore capito da MEMO non deve rimetterlo.
  if v_c ? 'controparte' then
    v_dati := v_dati - 'fornitore';
  end if;

  v_ris := fai_azione_dettata('spesa_da_collocare', jsonb_strip_nulls(v_dati));
  return (v_ris->>'spesa_da_collocare_id')::uuid;
end $$;

comment on function annota_spesa_dettata_a_mano(uuid, jsonb) is
  '«Fallo a mano» di una spesa detta a MEMO: la mette fra quelle da collocare, con i campi corretti dalla schermata, e chiude la cosa detta nella stessa transazione. Non e'' contabilita'': si colloca dopo.';

revoke all on function annota_spesa_dettata_a_mano(uuid, jsonb) from public, anon, authenticated;
grant execute on function annota_spesa_dettata_a_mano(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 3 · Verifica — tutto provato e annullato
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto    jsonb := foto_righe();
  v_tit     uuid;
  v_staff   uuid;
  v_det     uuid;
  v_det2    uuid;
  v_det3    uuid;
  v_az      uuid;
  v_az2     uuid;
  v_az3     uuid;
  v_app     uuid;
  v_sp      uuid;
  v_s       spese_da_collocare%rowtype;
  v_campi   jsonb;
  v_n       integer;
  v_rifiuto boolean;
begin
  if has_function_privilege('anon', 'annota_spesa_dettata_a_mano(uuid, jsonb)', 'execute') then
    raise exception 'VERIFICA: annota_spesa_dettata_a_mano e'' aperta a chi non e'' entrato.';
  end if;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_tit is null then
    raise exception 'VERIFICA: non c''e'' nessun titolare con cui provare.';
  end if;

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

    insert into dettature (testo, provenienza, esito)
    values ('prova migrazione: la spesa da collocare si finisce a mano', 'app', 'capita') returning id into v_det;

    insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
    values (v_det, 1, 'spesa_da_collocare',
            jsonb_build_object('importo', '3', 'descrizione', 'ZZ pane', 'mezzo', 'cassa',
                               'natura_proposta', 'prima_nota', 'testo_originale', 'ZZ ho speso tre euro di pane'),
            true, 'ZZ verifica spesa', 'prova', 'in_attesa')
    returning id, appunto_id into v_az, v_app;

    -- (1) La schermata riceve i campi capiti.
    v_campi := azione_a_mano(v_az)->'campi';
    if v_campi->>'importo' is distinct from '3' or v_campi->>'descrizione' is distinct from 'ZZ pane' then
      raise exception 'VERIFICA: la schermata non riceve importo e descrizione capiti (%).', v_campi;
    end if;

    -- (2) Il giro completo: la spesa c'è con i campi corretti, il resto è
    --     quello capito, la cosa detta è finita a mano.
    v_sp := annota_spesa_dettata_a_mano(v_az, jsonb_build_object('importo', '3,50', 'descrizione', 'ZZ pane e grissini'));
    select * into v_s from spese_da_collocare where id = v_sp;
    if not found or v_s.importo <> 3.50 or v_s.descrizione <> 'ZZ pane e grissini' then
      raise exception 'VERIFICA: la spesa non e'' stata scritta con i campi corretti a mano.';
    end if;
    if v_s.provenienza <> 'voce' or v_s.stato <> 'da_collocare' or v_s.mezzo_proposto is distinct from 'cassa'
       or v_s.natura_proposta is distinct from 'prima_nota' or v_s.testo_originale is distinct from 'ZZ ho speso tre euro di pane' then
      raise exception 'VERIFICA: si e'' perso qualcosa di quello che MEMO aveva capito.';
    end if;
    if (select stato from azioni_dettate where id = v_az) is distinct from 'fatta_a_mano' then
      raise exception 'VERIFICA: la cosa detta non si e'' chiusa insieme alla spesa.';
    end if;
    if (select stato from appunti_vocali where id = v_app) is distinct from 'approvato' then
      raise exception 'VERIFICA: chiusa l''unica riga, l''appunto e'' rimasto aperto.';
    end if;

    -- (3) 🔴 Il doppione: la seconda volta si rifiuta e non scrive.
    select count(*) into v_n from spese_da_collocare where descrizione like 'ZZ pane%';
    v_rifiuto := false;
    begin
      perform annota_spesa_dettata_a_mano(v_az, '{}'::jsonb);
    exception when others then
      -- Solo il rifiuto giusto conta: un altro errore vorrebbe dire funzione rotta.
      v_rifiuto := sqlerrm like '%gia'' finita a mano%';
      if not v_rifiuto then raise; end if;
    end;
    if not v_rifiuto or (select count(*) from spese_da_collocare where descrizione like 'ZZ pane%') <> v_n then
      raise exception 'VERIFICA: la stessa spesa detta e'' entrata due volte.';
    end if;

    -- (4) Un campo svuotato a mano resta vuoto, e il resto resta quello capito.
    --     (Un dettato nuovo: il primo appunto ormai è chiuso.)
    insert into dettature (testo, provenienza, esito)
    values ('prova migrazione: campo svuotato', 'app', 'capita') returning id into v_det2;
    insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
    values (v_det2, 1, 'spesa_da_collocare',
            jsonb_build_object('importo', '7', 'descrizione', 'ZZ caffe', 'controparte', 'ZZ bar'),
            true, 'ZZ verifica vuoto', 'prova', 'in_attesa')
    returning id into v_az2;
    v_sp := annota_spesa_dettata_a_mano(v_az2, jsonb_build_object('controparte', ''));
    select * into v_s from spese_da_collocare where id = v_sp;
    if v_s.controparte is not null or v_s.importo <> 7 or v_s.descrizione <> 'ZZ caffe' then
      raise exception 'VERIFICA: un campo svuotato a mano non e'' rimasto vuoto, o si e'' perso il resto.';
    end if;

    -- (5) Una cosa detta di un altro tipo non si chiude da qui.
    insert into dettature (testo, provenienza, esito)
    values ('prova migrazione: tipo sbagliato', 'app', 'capita') returning id into v_det3;
    insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
    values (v_det3, 1, 'movimento_cassa', '{}'::jsonb, true, 'ZZ verifica tipo', 'prova', 'in_attesa')
    returning id into v_az3;
    v_rifiuto := false;
    begin
      perform annota_spesa_dettata_a_mano(v_az3, jsonb_build_object('importo', '1', 'descrizione', 'ZZ tipo'));
    exception when others then
      v_rifiuto := sqlerrm like '%non si finisce da questa schermata%';
      if not v_rifiuto then raise; end if;
    end;
    if not v_rifiuto or (select stato from azioni_dettate where id = v_az3) <> 'in_attesa' then
      raise exception 'VERIFICA: un movimento di cassa detto si e'' chiuso da «Da collocare».';
    end if;

    -- (6) Chi non e' il titolare viene fermato.
    if v_staff is not null then
      perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
      v_rifiuto := false;
      begin
        perform annota_spesa_dettata_a_mano(v_az3, '{}'::jsonb);
      exception when others then
        v_rifiuto := sqlerrm like '%riservato al titolare%';
        if not v_rifiuto then raise; end if;
      end;
      if not v_rifiuto then
        raise exception 'VERIFICA: lo staff ha messo una spesa da collocare.';
      end if;
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della spesa da collocare finita a mano');

  raise notice 'Fatto: «Fallo a mano» di una spesa da collocare la scrive con i campi corretti e chiude la cosa detta in una transazione; la seconda volta viene rifiutata. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261027000002', 'la_spesa_da_collocare_si_finisce_a_mano')
on conflict (version) do nothing;
