-- =====================================================================
-- UNA PREVISIONE CHIUSA SI LEGGE, NON SI MODIFICA
-- 25/08/2026 — la prova del sigillo, dove ci si può ripulire
-- =====================================================================
-- 🔴 NASCE DA UNA RICHIESTA DI ALESSIO: *«un dato che esiste e non si può
-- guardare è un dato che non c'è. La protezione riguarda la MODIFICA, non
-- la lettura.»* Fino a oggi le voci di costo fisso di una previsione
-- congelata non comparivano da nessuna schermata: il dettaglio mostrava
-- solo il totale, e il modulo di modifica si rifiuta di aprirsi. Per
-- sapere di cosa fosse fatto quel totale bisognava chiederlo al database.
--
-- ⚠️ QUESTA MIGRAZIONE NON CAMBIA NIENTE: la schermata legge già, perché
-- la policy è `for all using (is_titolare())` e in Postgres **non
-- esistono trigger sulla lettura**. Quello che aggiunge è la **prova**
-- che sia così, e che resti così.
--
-- 🔴 E STA IN UNA MIGRAZIONE E NON IN UNA PROVA AUTOMATICA, per una
-- ragione misurata e non di stile. `scenari_proiezione` è tracciata:
-- cancellare la previsione di prova lascia una **lapide** nel registro
-- delle cancellazioni, che dal client **nessuno può ripulire**. Una prova
-- automatica gira a ogni `npm run test:app` e ne lascerebbe una ogni
-- volta, per sempre — misurato provandolo: il registro del progetto di
-- prova è passato da 1683 a 1684, e quella riga è stata tolta a mano.
-- ⚠️ È la decisione già scritta in CLAUDE.md dal 15/08: *«il sigillo non
-- si prova nelle prove automatiche ma dentro le migrazioni, che girano
-- come proprietarie e si ripuliscono per intero»*. Qui si onora.
-- =====================================================================

do $verifica$
declare
  v_titolare uuid;
  v_lapidi   integer;
  v_lapidi2  integer;
  v_entita   uuid;
  v_scenario uuid;
  v_quante   integer;
  v_somma    numeric;
  v_rifiutato boolean;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into v_entita from entities order by created_at limit 1;
  if v_entita is null then
    raise exception 'Nessuna entita'' fiscale: impossibile costruire una previsione di prova.';
  end if;

  -- (a) UNA PREVISIONE TUTTA NOSTRA, completa abbastanza da poter essere
  --     chiusa. ⚠️ I dodici mesi non sono una formalita': senza, il
  --     congelamento viene respinto («nessun giorno di apertura»), e la
  --     prova si fermerebbe prima di provare quello che deve.
  insert into scenari_proiezione (
    entity_id, nome, tipo, anno,
    scontrino_food, scontrino_beverage, food_cost_percento, beverage_cost_percento)
  values (v_entita, '_prova sigillo 20260825000004', 'riproiezione', 2097, 25, 8, 0.25, 0.25)
  returning id into v_scenario;

  insert into scenario_mesi (scenario_id, mese, servizi_settimana, giorni_lavorativi,
                             giorni_peak, coperti_peak, coperti_feriali, eventi_premium)
  select v_scenario, g, 5, 22, 8, 30, 20, 0 from generate_series(1, 12) g;

  insert into scenario_costi_fissi (scenario_id, voce, euro_mese)
  values (v_scenario, 'Voce di prova A', 300), (v_scenario, 'Voce di prova B', 120);

  -- (b) SI CHIUDE. Da qui in avanti niente si puo' piu' cambiare.
  perform congela_scenario(v_scenario);
  if not exists (select 1 from scenari_proiezione where id = v_scenario and congelato_il is not null) then
    raise exception 'La previsione di prova non risulta chiusa: il resto non proverebbe niente.';
  end if;

  -- (c) 🔴 LA META' NUOVA: LE VOCI SI LEGGONO LO STESSO.
  select count(*), sum(euro_mese) into v_quante, v_somma
    from scenario_costi_fissi where scenario_id = v_scenario;
  if v_quante <> 2 or v_somma <> 420 then
    raise exception 'Su una previsione chiusa le voci non si leggono: % righe, somma %.', v_quante, v_somma;
  end if;

  -- (d) 🔴 E IL SIGILLO TIENE, nei due versi. Senza questo, «si legge»
  --     sarebbe indistinguibile da «la tabella e' stata aperta».
  v_rifiutato := false;
  begin
    update scenario_costi_fissi set euro_mese = 999 where scenario_id = v_scenario;
  exception when others then
    v_rifiutato := true;
  end;
  if not v_rifiutato then
    raise exception 'Una voce di una previsione CHIUSA e'' stata modificata.';
  end if;

  v_rifiutato := false;
  begin
    delete from scenario_costi_fissi where scenario_id = v_scenario;
  exception when others then
    v_rifiutato := true;
  end;
  if not v_rifiutato then
    raise exception 'Una voce di una previsione CHIUSA e'' stata cancellata.';
  end if;

  -- E i numeri non si sono mossi.
  select sum(euro_mese) into v_somma from scenario_costi_fissi where scenario_id = v_scenario;
  if v_somma <> 420 then
    raise exception 'Il sigillo ha respinto ma qualcosa e'' cambiato lo stesso: somma %.', v_somma;
  end if;

  -- (e) SI RIPULISCE. ⚠️ I trigger del congelamento vietano di toccare le
  --     righe, quindi si spengono per la sola pulizia e si riaccendono —
  --     controllandolo. E `trg_log_delete` su `scenari_proiezione` va
  --     spento anche lui: e' esattamente la lapide che una prova
  --     automatica non saprebbe togliersi di dosso.
  -- ⚠️ ANCHE `scenario_risultati`, trovato applicando: il congelamento
  --     FOTOGRAFA i risultati in quella tabella, quindi la previsione di
  --     prova ne ha una riga — e il sigillo protegge anche lei. I nomi dei
  --     trigger sono stati chiesti al catalogo, non ricordati.
  alter table scenario_costi_fissi disable trigger trg_righe_scenario_congelato_scenario_costi_fissi;
  alter table scenario_mesi disable trigger trg_righe_scenario_congelato_scenario_mesi;
  alter table scenario_risultati disable trigger trg_righe_scenario_congelato_scenario_risultati;
  alter table scenari_proiezione disable trigger trg_scenario_congelato;
  alter table scenari_proiezione disable trigger trg_log_delete;

  delete from scenario_costi_fissi where scenario_id = v_scenario;
  delete from scenario_mesi where scenario_id = v_scenario;
  delete from scenario_risultati where scenario_id = v_scenario;
  delete from scenari_proiezione where id = v_scenario;

  alter table scenario_costi_fissi enable trigger trg_righe_scenario_congelato_scenario_costi_fissi;
  alter table scenario_mesi enable trigger trg_righe_scenario_congelato_scenario_mesi;
  alter table scenario_risultati enable trigger trg_righe_scenario_congelato_scenario_risultati;
  alter table scenari_proiezione enable trigger trg_scenario_congelato;
  alter table scenari_proiezione enable trigger trg_log_delete;

  -- ⚠️ SI CONTROLLA DI AVERLI RIACCESI TUTTI E CINQUE: lasciarne uno
  --     spento vorrebbe dire che da domani una previsione chiusa si puo'
  --     ritoccare, e non se ne accorgerebbe nessuno.
  select count(*) into v_quante
    from pg_trigger
   where tgname in ('trg_righe_scenario_congelato_scenario_costi_fissi',
                    'trg_righe_scenario_congelato_scenario_mesi',
                    'trg_righe_scenario_congelato_scenario_risultati',
                    'trg_scenario_congelato', 'trg_log_delete')
     and tgrelid in ('public.scenario_costi_fissi'::regclass,
                     'public.scenario_mesi'::regclass,
                     'public.scenario_risultati'::regclass,
                     'public.scenari_proiezione'::regclass)
     and tgenabled <> 'D';
  if v_quante <> 5 then
    raise exception 'Solo % dei cinque trigger sono riaccesi: il sigillo o il registro sono rimasti spenti.', v_quante;
  end if;

  if exists (select 1 from scenari_proiezione where id = v_scenario) then
    raise exception 'La verifica ha lasciato la propria previsione nel gestionale.';
  end if;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Una previsione chiusa si legge (2 voci, 420) e non si modifica.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260825000004', 'una_previsione_chiusa_si_legge') on conflict (version) do nothing;
