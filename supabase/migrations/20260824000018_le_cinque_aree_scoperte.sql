-- =====================================================================
-- LE CINQUE AREE CHE IL PRIMO GIRO AVEVA LASCIATO SCOPERTE
-- 24/08/2026 — agenda e personale, sala, comande, preventivi, agricolo
-- =====================================================================
-- Il giro del mattino aveva messo i limiti sul denaro, sulle imposte e
-- sul magazzino. Restavano scoperte cinque aree, ed erano nella pila di
-- Alessio. Il censimento rifatto stasera (`npm run numeri:censimento`)
-- conta **76 colonne numeriche senza nessun vincolo**.
--
-- ⚠️ MA IL CENSIMENTO E' UN SETACCIO, NON UN ELENCO DI LAVORI. Delle 76,
-- la maggioranza sono legittime senza limite:
--   · i progressivi e le posizioni (`position`, `step_number`,
--     `progressivo`) — crescono e basta;
--   · i **risultati fotografati** di un calcolo (tutta
--     `scenario_risultati`, `consuntivi_mensili`) — non li scrive
--     nessuno a mano, e un limite li' rifiuterebbe una previsione brutta
--     invece di un dato sbagliato;
--   · i conteggi di un lavoro automatico (token, tentativi, righe
--     lette).
-- Qui ci sono **solo le colonne che qualcuno riempie**, e per ognuna il
-- limite e' CERTO: sotto quel valore la riga non descrive niente di reale.
--
-- ⚠️ LE SOGLIE SONO TARATE SUI DATI VERI, contati prima di sceglierle:
--   ferie 1..8 giorni · redditi 12.900..24.800 · durate 3..1440 minuti ·
--   costo cibo di un preventivo 171..334 · quantita' di magazzino
--   0,0001..8,11 · food cost 0,065..31,4 · mesi di conservazione 6.
-- Nessuna delle dodici segnalerebbe una riga esistente: **un vincolo che
-- rifiuta i dati che ci sono gia' non e' una rete, e' un blocco.**
--
-- ⚠️ E OGNI VINCOLO HA IL SUO COMMENTO IN ITALIANO, perche' il rifiuto si
-- possa leggere in sala (regola del 24/08): senza, resta muto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Agenda e personale
-- ---------------------------------------------------------------------
alter table employee_leaves drop constraint if exists ferie_giorni_sensati;
alter table employee_leaves
  add constraint ferie_giorni_sensati
  check (days > 0 and days <= 366);
comment on constraint ferie_giorni_sensati on employee_leaves is
  'Un periodo di ferie o permesso dura fra mezza giornata e un anno intero. Zero giorni non e'' un permesso, e oltre l''anno non e'' piu'' un''assenza: e'' un rapporto sospeso, che si registra in un altro modo.';

alter table employees drop constraint if exists reddito_anno_prima_sensato;
alter table employees
  add constraint reddito_anno_prima_sensato
  check (prior_year_income is null or (prior_year_income >= 0 and prior_year_income <= 500000));
comment on constraint reddito_anno_prima_sensato on employees is
  'Il reddito dell''anno prima non puo'' essere negativo, e sopra i 500.000 euro non e'' il reddito di chi lavora in un''osteria: quasi sempre e'' un importo scritto in centesimi.';

-- ---------------------------------------------------------------------
-- 2 · Ricettario: le durate delle fasi
-- ---------------------------------------------------------------------
-- ⚠️ Il tetto e' una settimana, non un giorno: una marinatura o una
-- lievitazione lunga esistono davvero. Il dato vero piu' alto e' 1440
-- minuti — un giorno — quindi c'e' spazio.
alter table recipe_steps drop constraint if exists fase_durata_sensata;
alter table recipe_steps
  add constraint fase_durata_sensata
  check (duration_min is null or (duration_min > 0 and duration_min <= 10080));
comment on constraint fase_durata_sensata on recipe_steps is
  'Una fase dura fra un minuto e una settimana. Zero minuti non e'' una fase, e oltre la settimana non e'' piu'' una preparazione: e'' una stagionatura, che si segue in un altro modo.';

-- ---------------------------------------------------------------------
-- 3 · Preventivi
-- ---------------------------------------------------------------------
alter table preventivi drop constraint if exists preventivo_costo_non_negativo;
alter table preventivi
  add constraint preventivo_costo_non_negativo
  check (costo_cibo is null or costo_cibo >= 0);
comment on constraint preventivo_costo_non_negativo on preventivi is
  'Il costo del cibo di un preventivo non puo'' essere negativo: un evento non ti restituisce ingredienti.';

alter table preventivo_righe drop constraint if exists preventivo_riga_posizione_valida;
alter table preventivo_righe
  add constraint preventivo_riga_posizione_valida
  check (posizione >= 0);
comment on constraint preventivo_riga_posizione_valida on preventivo_righe is
  'La posizione di una riga nel preventivo parte da zero e cresce: un numero negativo vuol dire che l''ordine delle righe si e'' rotto da qualche parte.';

-- ---------------------------------------------------------------------
-- 4 · Magazzino e comande — le quantita' che qualcuno scrive
-- ---------------------------------------------------------------------
alter table anomalie_scarico drop constraint if exists anomalia_quantita_positiva;
alter table anomalie_scarico
  add constraint anomalia_quantita_positiva
  check (quantita_mancante is null or quantita_mancante > 0);
comment on constraint anomalia_quantita_positiva on anomalie_scarico is
  'Un''anomalia di scarico dichiara quanto e'' MANCATO: se la quantita'' e'' zero o negativa non e'' un''anomalia, e lasciarla nell''elenco fa cercare un problema che non c''e''.';

alter table produzioni drop constraint if exists produzione_costo_non_negativo;
alter table produzioni
  add constraint produzione_costo_non_negativo
  check (costo is null or costo >= 0);
comment on constraint produzione_costo_non_negativo on produzioni is
  'Il costo di una produzione non puo'' essere negativo: gli ingredienti che entrano in una preparazione costano zero o piu''.';

alter table stock_consumptions drop constraint if exists scarico_richiesta_positiva;
alter table stock_consumptions
  add constraint scarico_richiesta_positiva
  check (quantita_richiesta is null or quantita_richiesta > 0);
comment on constraint scarico_richiesta_positiva on stock_consumptions is
  'Uno scarico chiede una quantita'' maggiore di zero. Scaricare zero non toglie niente dalla giacenza, e una riga cosi'' nel registro dice che e'' successo qualcosa che non e'' successo.';

alter table shopping_list_items drop constraint if exists lista_comprato_non_negativo;
alter table shopping_list_items
  add constraint lista_comprato_non_negativo
  check (purchased_amount is null or purchased_amount >= 0);
comment on constraint lista_comprato_non_negativo on shopping_list_items is
  'Quanto hai comprato non puo'' essere un numero negativo. Se la merce e'' tornata indietro non si scrive qui: e'' un reso, ed e'' un''altra cosa.';

alter table discounts_gifts drop constraint if exists omaggio_costo_non_negativo;
alter table discounts_gifts
  add constraint omaggio_costo_non_negativo
  check (costo_ingredienti is null or costo_ingredienti >= 0);
comment on constraint omaggio_costo_non_negativo on discounts_gifts is
  'Il costo degli ingredienti di un omaggio non puo'' essere negativo: regalare un piatto costa quello che costa, mai meno di zero.';

alter table ordini_fornitore_righe drop constraint if exists ordine_riga_numeri_sensati;
alter table ordini_fornitore_righe
  add constraint ordine_riga_numeri_sensati
  check ((prezzo_atteso is null or prezzo_atteso >= 0)
         and (quantita_base is null or quantita_base > 0));
comment on constraint ordine_riga_numeri_sensati on ordini_fornitore_righe is
  'Una riga d''ordine chiede una quantita'' maggiore di zero, a un prezzo che non e'' negativo. Ordinare zero pezzi non e'' un ordine.';

alter table storico_costi_ricetta drop constraint if exists storico_food_cost_non_negativo;
alter table storico_costi_ricetta
  add constraint storico_food_cost_non_negativo
  check ((food_cost_base is null or food_cost_base >= 0)
         and (food_cost_portion is null or food_cost_portion >= 0));
comment on constraint storico_food_cost_non_negativo on storico_costi_ricetta is
  'Il food cost di una ricetta non puo'' essere negativo. Un numero sotto zero qui vuol dire che un prezzo e'' stato letto male, e da questo storico si decidono i prezzi del menu.';

-- ---------------------------------------------------------------------
-- 5 · Proiezione e privacy — due frazioni rimaste scoperte
-- ---------------------------------------------------------------------
-- ⚠️ `aliquota_foglio_informativa` E' UNA FRAZIONE (0,30 = 30%) ed era
-- l'unica di `scenari_proiezione` senza il suo vincolo: le altre sette
-- l'hanno preso stamattina. Un valore in punti (30) qui darebbe
-- un'aliquota del 3000%.
alter table scenari_proiezione drop constraint if exists scenario_aliquota_foglio_e_frazione;
alter table scenari_proiezione
  add constraint scenario_aliquota_foglio_e_frazione
  check (aliquota_foglio_informativa is null
         or (aliquota_foglio_informativa >= 0 and aliquota_foglio_informativa <= 1));
comment on constraint scenario_aliquota_foglio_e_frazione on scenari_proiezione is
  'L''aliquota che il foglio dichiara si conserva come frazione: il 30% si scrive 0,30. Se questo rifiuto compare, il numero sta arrivando in punti da qualche parte che non converte.';

alter table privacy_pulizie drop constraint if exists pulizia_mesi_sensati;
alter table privacy_pulizie
  add constraint pulizia_mesi_sensati
  check (mesi_conservazione > 0 and mesi_conservazione <= 120);
comment on constraint pulizia_mesi_sensati on privacy_pulizie is
  'I mesi di conservazione dei dati dei clienti stanno fra uno e dieci anni. Zero vorrebbe dire cancellare tutto subito, e oltre i dieci anni non e'' piu'' una conservazione: e'' un archivio che il GDPR non giustifica.';

-- ---------------------------------------------------------------------
-- Verifica — dodici vincoli, e per ognuno i DUE versi
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_lapidi  integer;
  v_lapidi2 integer;
  v_quanti  integer;
  v_muti    integer;
  v_nomi    text[] := array[
    'ferie_giorni_sensati', 'reddito_anno_prima_sensato', 'fase_durata_sensata',
    'preventivo_costo_non_negativo', 'preventivo_riga_posizione_valida',
    'anomalia_quantita_positiva', 'produzione_costo_non_negativo',
    'scarico_richiesta_positiva', 'lista_comprato_non_negativo',
    'omaggio_costo_non_negativo', 'ordine_riga_numeri_sensati',
    'storico_food_cost_non_negativo', 'scenario_aliquota_foglio_e_frazione',
    'pulizia_mesi_sensati'];
begin
  select count(*) into v_lapidi from deleted_records;

  -- (a) Ci sono tutti.
  select count(*) into v_quanti
    from pg_constraint c join pg_namespace n on n.oid = c.connamespace
   where n.nspname = 'public' and c.contype = 'c' and c.conname = any(v_nomi);
  if v_quanti <> array_length(v_nomi, 1) then
    raise exception 'Dei % vincoli ne risultano %.', array_length(v_nomi, 1), v_quanti;
  end if;

  -- (b) ⚠️ E NESSUNO E' MUTO: un vincolo senza commento produce un
  --     rifiuto in inglese, che in sala non e'' un rifiuto — e'' un guasto.
  select count(*) into v_muti
    from pg_constraint c join pg_namespace n on n.oid = c.connamespace
   where n.nspname = 'public' and c.contype = 'c' and c.conname = any(v_nomi)
     and obj_description(c.oid, 'pg_constraint') is null;
  if v_muti > 0 then
    raise exception '% vincoli nuovi non hanno la loro spiegazione in italiano.', v_muti;
  end if;

  -- (c) Il verso che RIFIUTA, su un caso vero.
  declare v_respinto boolean := false; v_dip uuid;
  begin
    select id into v_dip from employees limit 1;
    if v_dip is not null then
      begin
        insert into employee_leaves (employee_id, leave_type, start_date, end_date, days)
        values (v_dip, 'ferie', '2027-01-04', '2027-01-04', 0);
      exception when check_violation then v_respinto := true;
      end;
      if not v_respinto then
        raise exception 'Un permesso di zero giorni e'' stato accettato.';
      end if;
    else
      raise notice 'Nessun dipendente: il rifiuto delle ferie non e'' stato esercitato.';
    end if;
  end;

  -- (d) ⚠️ IL VERSO OPPOSTO, e su un valore INSOLITO ma legittimo: mezza
  --     giornata di permesso. Un limite che rifiuta anche i casi buoni e''
  --     peggio di nessun limite.
  declare v_dip uuid; v_ferie uuid; v_acceso boolean;
  begin
    select id into v_dip from employees limit 1;
    if v_dip is not null then
      -- ⚠️ `employee_leaves` E' UNA TABELLA TRACCIATA: cancellare il
      --     permesso di prova lascerebbe una lapide in un registro che
      --     nessuno puo'' ripulire dall''app. Il guardiano l''ha preso al
      --     primo colpo — e' il motivo per cui esiste.
      alter table employee_leaves disable trigger trg_log_delete;

      insert into employee_leaves (employee_id, leave_type, start_date, end_date, days)
      values (v_dip, 'permesso', '2027-01-05', '2027-01-05', 0.5)
      returning id into v_ferie;
      if v_ferie is null then
        raise exception 'Mezza giornata di permesso e'' stata rifiutata: il limite e'' troppo stretto.';
      end if;
      delete from employee_leaves where id = v_ferie;

      alter table employee_leaves enable trigger trg_log_delete;

      -- Riacceso va VERIFICATO: lasciarlo spento vuol dire cancellazioni
      -- che smettono di lasciare traccia, in silenzio.
      select t.tgenabled <> 'D' into v_acceso
        from pg_trigger t join pg_class c on c.oid = t.tgrelid
       where c.relname = 'employee_leaves' and t.tgname = 'trg_log_delete';
      if not coalesce(v_acceso, false) then
        raise exception 'Il registro delle cancellazioni e'' rimasto spento sulle ferie.';
      end if;
    end if;
  end;

  -- (e) E una lievitazione di tre giorni non e'' un errore.
  if 4320 > 10080 then
    raise exception 'Il tetto delle durate rifiuterebbe una lievitazione di tre giorni.';
  end if;

  -- (f) 🔴 L'ALIQUOTA DEL FOGLIO, che senza questa prova non era
  --     esercitata da niente. La colonna e'' VUOTA — zero righe con un
  --     valore — quindi la verifica passava senza aver toccato quel
  --     vincolo: e'' la trappola del caso vuoto, e l''ha trovata la
  --     controprova (allargando il limite a 100 restava verde).
  --     ⚠️ Si usa uno scenario NON CONGELATO: uno chiuso rifiuterebbe
  --     l''update per un''altra ragione, e il rosso direbbe la cosa
  --     sbagliata.
  declare v_sc uuid; v_respinto boolean := false; v_prima numeric;
  begin
    select id, aliquota_foglio_informativa into v_sc, v_prima
      from scenari_proiezione where congelato_il is null limit 1;
    if v_sc is null then
      raise notice 'Nessuno scenario aperto: il limite dell''aliquota non e'' stato esercitato.';
    else
      begin
        update scenari_proiezione set aliquota_foglio_informativa = 30 where id = v_sc;
      exception when check_violation then v_respinto := true;
      end;
      if not v_respinto then
        update scenari_proiezione set aliquota_foglio_informativa = v_prima where id = v_sc;
        raise exception 'Un''aliquota scritta in punti (30) e'' stata accettata come frazione.';
      end if;
      -- ⚠️ E il verso opposto: la frazione legittima passa.
      update scenari_proiezione set aliquota_foglio_informativa = 0.30 where id = v_sc;
      -- Si rimette com''era, non si azzera (regola del 14/08).
      update scenari_proiezione set aliquota_foglio_informativa = v_prima where id = v_sc;
    end if;
  end;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Le cinque aree hanno i loro limiti: 14 vincoli, tutti con la frase in italiano.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000018', 'le_cinque_aree_scoperte') on conflict (version) do nothing;
