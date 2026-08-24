-- =====================================================================
-- LA SCALA SI PROVA CON ROBA PROPRIA
-- 25/08/2026 — chiude la 20260824000033, che si e' fermata in produzione
-- =====================================================================
-- 🔴 COSA E' SUCCESSO, misurato applicando e non dedotto. La `…033` si e'
-- fermata cosi':
--
--   ERROR: Nessuna previsione libera: la rete non puo' essere provata
--          rompendola, e una rete mai vista scattare non si sa se scatta.
--
-- Aveva ragione a fermarsi: una rete che nessuno ha visto scattare non si
-- sa se scatta. Ma il suo PERIMETRO era sbagliato — cercava una previsione
-- libera **fra quelle di Alessio**, e in produzione ce n'e' una sola ed e'
-- congelata. E' la regola del 16/08: *il perimetro di una prova dev'essere
-- fatto di roba che la prova ha creato*.
--
-- 🔴 E SI E' FERMATA DOPO LE DDL. Il messaggio dello strumento dice che una
-- migrazione che fallisce non lascia niente a meta': non e' vero quando il
-- blocco che fallisce sta in fondo. Misurato in produzione col connettore
-- in sola lettura, non dedotto:
--   · la colonna `scenario_linee_accessorie.scala`        → C'E'
--   · il vincolo `linea_scala_nota`                        → C'E'
--   · `scala_del_calcolo(text)`, `scale_che_non_tornano()` → CI SONO
--   · la riga in `applied_migrations`                      → ASSENTE
-- E' la stessa trappola scritta in CLAUDE.md §8 il 23/08, **ricomparsa**.
--
-- ⚠️ LA `…033` NON SI RISCRIVE (regola del 23/08): si registra qui, dopo
-- aver rifatto il suo controllo con roba propria. E' lo stesso schema con
-- cui la `…032` ha registrato la `…030` e la `20260823000023` la `…012`.
--
-- ⚠️ DEBITO DICHIARATO, perche' nessuna rete lo copre: su una RICOSTRUZIONE
-- DA ZERO la `…033` gira prima di questa e si fermerebbe di nuovo, perche'
-- a quel punto non esiste nessuna previsione. Va saltata, come la `…030`:
--     npm run migra -- --salta 20260824000030 --salta 20260824000033
-- Questa migrazione non puo' ripararlo da se': verrebbe dopo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Si constata che il lavoro della `…033` c'e' davvero
-- ---------------------------------------------------------------------
-- ⚠️ SI CONSTATA, NON SI RISCRIVE. Ricopiare qui il corpo di due funzioni
-- gia' vive sarebbe una riscrittura a memoria, ed e' il difetto in cui
-- questo progetto e' caduto cinque volte. Se manca qualcosa ci si ferma e
-- lo si dice: uno zero non e' una risposta.
do $constatazione$
declare
  v_mancano text[] := array[]::text[];
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'scenario_linee_accessorie'
       and column_name = 'scala')
  then v_mancano := v_mancano || 'colonna scenario_linee_accessorie.scala'; end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.scenario_linee_accessorie'::regclass
       and conname = 'linea_scala_nota')
  then v_mancano := v_mancano || 'vincolo linea_scala_nota'; end if;

  if to_regprocedure('public.scala_del_calcolo(text)') is null
  then v_mancano := v_mancano || 'funzione scala_del_calcolo(text)'; end if;

  if to_regprocedure('public.scale_che_non_tornano()') is null
  then v_mancano := v_mancano || 'funzione scale_che_non_tornano()'; end if;

  if array_length(v_mancano, 1) is not null then
    raise exception 'Il lavoro della 20260824000033 non e'' in questo database: manca %.', array_to_string(v_mancano, ', ');
  end if;

  raise notice 'Il lavoro della 20260824000033 c''e'' tutto: colonna, vincolo e le due funzioni.';
end $constatazione$;

-- ---------------------------------------------------------------------
-- Verifica — la rete provata ROMPENDOLA, su una previsione tutta nostra
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare  uuid;
  v_staff     uuid;
  v_lapidi    integer;
  v_lapidi2   integer;
  v_entita    uuid;
  v_scenario  uuid;
  v_riga      uuid;
  v_quante    integer;
  v_perche    text;
  v_rifiutato boolean;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- (a) LO STATO DI PARTENZA, dichiarato voce per voce prima di toccare
  --     niente: e' l'unico modo per distinguere «la rottura ha prodotto
  --     questa segnalazione» da «c'era gia'».
  raise notice '--- Scale che non tornano, prima di toccare niente ---';
  for v_perche in
    select format('  · %s | %s | %s', r.previsione, r.linea, r.perche)
      from scale_che_non_tornano() r
  loop
    raise notice '%', v_perche;
  end loop;

  -- (b) LA PREVISIONE E' NOSTRA, e per questo la prova vale ovunque —
  --     produzione, progetto di prova, ricostruzione da zero. ⚠️ Il nome
  --     della riga non contiene nessuna parola di ritmo («al mese»,
  --     «/anno»): se ne contenesse una, la rete scatterebbe per il NOME e
  --     la rottura che vogliamo provare passerebbe nascosta dentro
  --     un'altra segnalazione.
  select id into v_entita from entities order by created_at limit 1;
  if v_entita is null then
    raise exception 'Nessuna entita'' fiscale: impossibile costruire una previsione di prova.';
  end if;

  insert into scenari_proiezione (
    entity_id, nome, tipo, anno,
    scontrino_food, scontrino_beverage, food_cost_percento, beverage_cost_percento)
  values (v_entita, 'Verifica della scala 20260825000001', 'riproiezione', 2099,
          25, 8, 0.25, 0.25)
  returning id into v_scenario;

  insert into scenario_linee_accessorie (
    scenario_id, linea, quantita, prezzo_medio, costo_percento, base)
  values (v_scenario, 'Riga di verifica senza ritmo nel titolo', 3, 10, 0.30, 'per_giorno')
  returning id into v_riga;

  -- Lo stato di partenza della NOSTRA riga: non deve segnalare niente.
  select count(*) into v_quante from scale_che_non_tornano() r where r.scenario_id = v_scenario;
  if v_quante <> 0 then
    raise exception 'La riga appena creata segnala gia'' % scale storte: la rottura non discriminerebbe.', v_quante;
  end if;

  -- (c) 🔴 LA ROTTURA APPOSTA. Il calcolo legge questa quantita' «al
  --     giorno» (base per_giorno → forma a_coperto). Dichiarandola «al
  --     mese» le due cose si contraddicono, e la rete deve accorgersene.
  update scenario_linee_accessorie set scala = 'al_mese' where id = v_riga;
  select count(*) into v_quante from scale_che_non_tornano() r where r.scenario_id = v_scenario;
  if v_quante <> 1 then
    raise exception 'ROTTA E NON SEGNALATA: una scala «al mese» su una linea che il calcolo legge al giorno produce % segnalazioni invece di 1.', v_quante;
  end if;
  select r.perche into v_perche from scale_che_non_tornano() r where r.scenario_id = v_scenario;
  raise notice 'Rotta apposta, la rete dice: %', v_perche;

  -- (d) ⚠️ LA CONTROPROVA CHE DISCRIMINA: con la scala giusta deve TACERE.
  --     Una rete che grida sempre si impara a spegnere, ed e' il modo in
  --     cui questo progetto ha gia' perso un guardiano.
  update scenario_linee_accessorie set scala = 'al_giorno' where id = v_riga;
  select count(*) into v_quante from scale_che_non_tornano() r where r.scenario_id = v_scenario;
  if v_quante <> 0 then
    raise exception 'La rete segnala anche con la scala giusta: grida sempre, quindi non serve.';
  end if;

  -- (e) IL VOCABOLARIO MORDE. Il vincolo e' `not valid`, quindi non ha
  --     guardato le righe vecchie — ma su una riga toccata adesso deve
  --     valere, e questa riga e' nostra e nuova.
  v_rifiutato := false;
  begin
    update scenario_linee_accessorie set scala = 'ogni_tanto' where id = v_riga;
  exception when others then
    v_rifiutato := true;
  end;
  if not v_rifiutato then
    raise exception 'Una scala inventata e'' stata accettata: il vocabolario non morde.';
  end if;

  -- (f) IL PORTIERE, col ruolo vero. Le quantita' e i ritmi delle linee
  --     sono numeri della Proiezione: lo staff non li deve leggere.
  select ur.user_id into v_staff from user_roles ur where ur.role <> 'titolare' limit 1;
  if v_staff is null then
    raise notice 'Nessun utente non titolare: il portiere non e'' stato esercitato qui.';
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_rifiutato := false;
    begin
      perform * from scale_che_non_tornano();
    exception when others then
      v_rifiutato := true;
    end;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    if not v_rifiutato then
      raise exception 'Lo staff puo'' leggere le quantita'' e i ritmi delle linee della previsione.';
    end if;
  end if;

  -- (g) SI RIPULISCE CIO' CHE ABBIAMO CREATO, per identificativo — mai
  --     «l'ultima riga». ⚠️ `scenari_proiezione` ha `trg_log_delete`:
  --     cancellare lascerebbe una lapide finta in un registro che nessuno
  --     puo' ripulire dall'app. Si spegne, si cancella, si riaccende — e
  --     si CONTROLLA di averlo riacceso, perche' lasciarlo spento
  --     significa cancellazioni vere che non vengono piu' registrate.
  delete from scenario_linee_accessorie where id = v_riga;
  alter table scenari_proiezione disable trigger trg_log_delete;
  delete from scenari_proiezione where id = v_scenario;
  alter table scenari_proiezione enable trigger trg_log_delete;

  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.scenari_proiezione'::regclass
       and tgname = 'trg_log_delete' and tgenabled <> 'D')
  then
    raise exception 'Il registro delle cancellazioni e'' rimasto spento su scenari_proiezione.';
  end if;

  if exists (select 1 from scenari_proiezione where id = v_scenario)
     or exists (select 1 from scenario_linee_accessorie where id = v_riga) then
    raise exception 'La verifica ha lasciato la propria previsione nel gestionale.';
  end if;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'La rete delle scale scatta rompendola e tace con la scala giusta, provata su roba propria.';
end $verifica$;

-- ---------------------------------------------------------------------
-- La 20260824000033 si registra qui
-- ---------------------------------------------------------------------
-- ⚠️ E si CONTROLLA di averla registrata: un `on conflict do nothing` che
-- non fa niente passerebbe in silenzio.
insert into applied_migrations (version, name)
values ('20260824000033', 'la_scala_di_una_linea_e_un_dato') on conflict (version) do nothing;

do $registrata$
declare v_n integer;
begin
  select count(*) into v_n from applied_migrations where version = '20260824000033';
  if v_n <> 1 then
    raise exception 'La 20260824000033 non risulta registrata: la prossima applicazione si fermerebbe di nuovo.';
  end if;
end $registrata$;

insert into applied_migrations (version, name)
values ('20260825000001', 'la_scala_si_prova_con_roba_propria') on conflict (version) do nothing;
