-- ---------------------------------------------------------------------
-- Dove stiamo andando: il piano sovrapposto ai numeri veri
-- ---------------------------------------------------------------------
-- Chiesto da Alessio il 15/08/2026, guardando la consegna del Blocco 3 e
-- dicendo che non era quello che si aspettava:
--
--   «mi aspettavo un documento che si sovrappone alla previsione e mi
--    dice in che direzione stiamo andando su ogni dato inserito. […] se
--    ho fatto delle previsioni basandomi su un food cost al 30% e poi
--    invece è al 40% c'è un grave problema da attenzionare. […] una cosa
--    è accorgersi di tutto ciò dopo due mesi di lavoro, una cosa è farlo
--    dopo un anno quando ho già bruciato i margini di guadagno.»
--
-- Aveva ragione anche sul mandato: il §4 del Blocco 3 chiedeva «proiezione
-- a fine anno mantenendo la rotta attuale», e la consegna di stanotte
-- aveva costruito solo il confronto mese per mese. Questo è il pezzo che
-- mancava.
--
-- ⚠️ COME SI PROIETTA — e la regola è di Alessio, che ha corretto la mia.
-- Io avevo scritto: «finora sei al 120% del piano, quindi proietto anche
-- i mesi che restano al 120%». Lui:
--
--   «se a febbraio siamo a +20% vorrei che la stima aggiornata mi
--    mostrasse un resoconto di fine anno che considera il 20% in più dei
--    SOLI DUE MESI TRASCORSI, non che questo 20% venga calcolato come
--    stima su tutto l'anno. Partiamo da una proiezione ideale teorica in
--    modo da avere una direzione da mantenere nella realtà.»
--
-- Quindi: **quello che è successo davvero, più quello che resta da fare
-- come era previsto.** Il piano non è una scommessa da correggere ogni
-- mese: è la rotta da tenere, e la stima aggiornata dice dove si arriva
-- se da domani la si tiene.
--
-- La sua regola è più prudente della mia e toglie di mezzo un problema
-- che la mia aveva: due mesi buoni non gonfiano un anno intero. Nel suo
-- piano agosto vale quattro volte gennaio, e un ritmo misurato d'inverno
-- proiettato sull'estate avrebbe prodotto un numero **sbagliato con
-- l'aria di essere giusto** — il modo di fallire che questo progetto
-- continua a incontrare.
--
-- ⚠️ E SI PROIETTA SOLO CIÒ CHE SI MISURA. Le voci che nessun modulo
-- misura ancora (food cost senza ricette, costi fissi senza causali
-- marcate) restano **quelle del piano, dichiarate tali** — mai
-- estrapolate da un buco. Un buco estrapolato è un buco moltiplicato.
--
-- Idempotente (§7 punto 3).

-- =====================================================================
-- 1. Quanto anno è passato, e quanto ne è misurato
-- =====================================================================
-- Serve a tre funzioni diverse, quindi vive in un posto solo: la parte
-- di anno trascorsa non può essere calcolata in tre modi.
create or replace function anno_trascorso(p_anno integer)
returns table (mesi_interi integer, mese_in_corso integer, quota_mese numeric)
language plpgsql
stable
set search_path = public
as $function$
declare
  v_anno_ora  integer := extract(year from now())::integer;
  v_mese_ora  integer := extract(month from now())::integer;
  v_giorni    integer;
begin
  if p_anno < v_anno_ora then
    return query select 12, 0, 0::numeric;   -- anno finito
  elsif p_anno > v_anno_ora then
    return query select 0, 0, 0::numeric;    -- anno non ancora cominciato
  else
    v_giorni := extract(day from (make_date(p_anno, v_mese_ora, 1) + interval '1 month - 1 day'))::integer;
    return query select
      v_mese_ora - 1,
      v_mese_ora,
      least(extract(day from now())::numeric, v_giorni) / v_giorni;
  end if;
end;
$function$;

revoke all on function anno_trascorso(integer) from public, anon, authenticated;
grant execute on function anno_trascorso(integer) to authenticated;

-- =====================================================================
-- 2. Il confronto a oggi, mese per mese, solo dove c'è qualcosa da confrontare
-- =====================================================================
-- Di ogni mese si prende il consuntivo se è stato chiuso, altrimenti la
-- misura dal vivo: un mese fotografato non si ricalcola mai (è il
-- principio del Blocco 3), un mese ancora aperto non ha altro da dare.
--
-- ⚠️ SI CONFRONTA SOLO CIÒ CHE HA UN CORRISPETTIVO, e la prima stesura
-- sbagliava proprio qui. Avevo scritto che una voce è «misurata» solo se
-- TUTTI i mesi trascorsi ce l'hanno — ragionevole a prima vista, e
-- sbagliato per costruzione: **Borgo 58 apre a marzo 2027**, quindi
-- gennaio e febbraio non avranno conti perché il locale non esisteva, e
-- con quella regola l'intero anno avrebbe detto «non misurato» per
-- sempre. Il difetto l'ha trovato la verifica di questa migrazione.
--
-- La regola giusta: ogni voce si accumula **solo nei mesi in cui è
-- misurata**, e il piano si somma **sugli stessi mesi**. Così il
-- confronto è fra cose paragonabili dal primo mese, e i mesi senza dati
-- non entrano né da una parte né dall'altra.
create or replace function confronto_a_oggi(p_entity_id uuid, p_anno integer, p_scenario_id uuid)
returns table (
  mesi_trascorsi   integer,
  coperti_reale    numeric, coperti_previsto  numeric, coperti_mesi integer,
  ricavi_reale     numeric, ricavi_previsto   numeric, ricavi_mesi  integer,
  food_reale       numeric, food_previsto     numeric, food_mesi    integer,
  food_ricavi_reale numeric, food_ricavi_previsto numeric,
  fissi_reale      numeric, fissi_previsto    numeric, fissi_mesi   integer
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  t        record;
  c        record;
  m        record;
  p        record;
  i        integer;
  v_fino   integer;
  v_quota  numeric;
  -- reale / previsto / quanti mesi, per ogni voce
  cr numeric := 0; cp numeric := 0; cn integer := 0;
  rr numeric := 0; rp numeric := 0; rn integer := 0;
  fr numeric := 0; fp numeric := 0; fn integer := 0;
  frr numeric := 0; frp numeric := 0;   -- ricavi nei soli mesi col food cost
  sr numeric := 0; sp numeric := 0; sn integer := 0;
  -- cosa dice il mese: valore e origine
  v_cop numeric; v_ric numeric; v_fc numeric; v_fis numeric;
  o_cop text;    o_ric text;    o_fc text;    o_fis text;
begin
  if not is_titolare() then
    raise exception 'I numeri dell''anno sono riservati al titolare.';
  end if;

  select * into t from anno_trascorso(p_anno);
  v_fino := t.mesi_interi + case when t.mese_in_corso > 0 then 1 else 0 end;

  if v_fino = 0 then
    return query select 0, 0::numeric,0::numeric,0, 0::numeric,0::numeric,0,
                          0::numeric,0::numeric,0, 0::numeric,0::numeric,
                          0::numeric,0::numeric,0;
    return;
  end if;

  for i in 1..v_fino loop
    select * into c from consuntivi_mensili
     where entity_id = p_entity_id and anno = p_anno and mese = i;

    if c.id is not null then
      v_cop := c.coperti; v_ric := c.ricavi; v_fc := c.food_cost; v_fis := c.fissi;
      o_cop := c.origine_coperti; o_ric := c.origine_ricavi;
      o_fc  := c.origine_food_cost; o_fis := c.origine_fissi;
    else
      select * into m from misure_del_mese(p_entity_id, p_anno, i);
      v_cop := m.coperti; v_ric := m.ricavi; v_fc := m.food_cost; v_fis := m.fissi;
      o_cop := m.origine_coperti; o_ric := m.origine_ricavi;
      o_fc  := m.origine_food_cost; o_fis := m.origine_fissi;
    end if;

    select * into p from proiezione_scenario(p_scenario_id) where mese = i;
    -- Del mese in corso il piano vale per la parte trascorsa: il resto
    -- non e' ancora successo, ne' da una parte ne' dall'altra.
    v_quota := case when i = t.mese_in_corso then t.quota_mese else 1 end;

    if o_cop = 'misurato' then
      cr := cr + coalesce(v_cop, 0);
      cp := cp + coalesce(p.coperti, 0) * v_quota;
      cn := cn + 1;
    end if;
    if o_ric = 'misurato' then
      rr := rr + coalesce(v_ric, 0);
      rp := rp + coalesce(p.ricavi_sala, 0) * v_quota;
      rn := rn + 1;
    end if;
    if o_fc = 'misurato' then
      fr := fr + coalesce(v_fc, 0);
      fp := fp + coalesce(p.costi_variabili, 0) * v_quota;
      -- ⚠️ I ricavi accanto al food cost servono al RAPPORTO, e devono
      -- venire dagli stessi mesi: un food cost di marzo diviso i ricavi
      -- di tutto l'anno non e' una percentuale, e' un numero.
      frr := frr + coalesce(v_ric, 0);
      frp := frp + coalesce(p.ricavi_sala, 0) * v_quota;
      fn := fn + 1;
    end if;
    if o_fis = 'misurato' then
      sr := sr + coalesce(v_fis, 0);
      sp := sp + coalesce(p.costi_fissi_totali, 0) * v_quota;
      sn := sn + 1;
    end if;
  end loop;

  return query select v_fino, cr, cp, cn, rr, rp, rn, fr, fp, fn, frr, frp, sr, sp, sn;
end;
$function$;

revoke all on function confronto_a_oggi(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function confronto_a_oggi(uuid, integer, uuid) to authenticated;

-- =====================================================================
-- 3. Il documento che si sovrappone al piano
-- =====================================================================
-- Una riga per ogni cosa che Alessio vuole tenere d'occhio: cosa aveva
-- previsto **per il periodo trascorso**, cosa è successo davvero, di
-- quanto si discosta, e dove va a finire l'anno se il ritmo resta questo.
--
-- ⚠️ Il food cost compare DUE volte, in euro e in percentuale sui ricavi,
-- e la seconda è quella che conta: «30% previsto, 40% reale» è il
-- segnale, «12.000 invece di 9.000» lo si legge come «abbiamo venduto di
-- più». Un rapporto sbagliato non si vede guardando un totale.
create or replace function andamento_anno(p_entity_id uuid, p_anno integer, p_scenario_id uuid)
returns table (
  indicatore       text,
  unita            text,
  previsto_a_oggi  numeric,
  reale_a_oggi     numeric,
  scarto_percento  numeric,
  previsto_anno    numeric,
  proiettato_anno  numeric,
  misurato         boolean,
  peggiora         boolean,
  spiegazione      text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  d        record;   -- il confronto a oggi, voce per voce
  a        record;   -- il piano intero
  v_scmp   numeric;  -- scontrino medio previsto
  v_scmr   numeric;  -- scontrino medio reale
  v_fcp    numeric;  -- food cost % previsto
  v_fcr    numeric;  -- food cost % reale
begin
  if not is_titolare() then
    raise exception 'La Proiezione e'' riservata al titolare.';
  end if;

  select * into d from confronto_a_oggi(p_entity_id, p_anno, p_scenario_id);

  select coalesce(sum(x.coperti), 0)            as coperti,
         coalesce(sum(x.ricavi_sala), 0)        as ricavi,
         coalesce(sum(x.costi_variabili), 0)    as costi_variabili,
         coalesce(sum(x.costi_fissi_totali), 0) as fissi
    into a
  from proiezione_scenario(p_scenario_id) x;

  v_scmp := case when d.coperti_previsto > 0 then d.ricavi_previsto / d.coperti_previsto end;
  v_scmr := case when d.coperti_reale    > 0 then d.ricavi_reale    / d.coperti_reale end;
  -- Il rapporto si fa sui ricavi degli STESSI mesi in cui c'e' il food cost.
  v_fcp  := case when d.food_ricavi_previsto > 0 then d.food_previsto / d.food_ricavi_previsto * 100 end;
  v_fcr  := case when d.food_ricavi_reale    > 0 then d.food_reale    / d.food_ricavi_reale * 100 end;

  return query
  select v.indicatore, v.unita,
         round(v.prev, 2), round(v.reale, 2),
         -- Lo scarto è in percentuale sul previsto, tranne dove la voce È
         -- già una percentuale: lì la differenza si legge in punti.
         case
           when not v.mis then null
           when v.unita = 'percento' then round(v.reale - v.prev, 2)
           when v.prev is null or v.prev = 0 then null
           else round((v.reale - v.prev) / v.prev * 100, 2)
         end,
         round(v.anno, 2),
         -- ⚠️ La stima aggiornata è: **quello che è successo, più quello
         -- che resta da fare come era previsto**. Non si estrapola nessun
         -- ritmo sui mesi futuri (regola di Alessio, 15/08/2026). Le voci
         -- che sono già rapporti — food cost sui ricavi, scontrino medio —
         -- non si sommano: si ricavano dalle voci che le compongono, e le
         -- ricompone chi legge la riga corrispondente.
         case when not v.mis then round(v.anno, 2)
              when v.unita = 'percento' or v.indicatore = 'Scontrino medio' then null
              else round(v.reale + (v.anno - v.prev), 2) end,
         v.mis,
         -- Su ricavi e coperti «sotto» è peggio; su food cost e costi
         -- fissi è il contrario. Senza questa distinzione un colore
         -- direbbe la cosa opposta di quella che serve.
         case when not v.mis then false
              when v.unita = 'percento' then v.reale > v.prev
              when v.al_ribasso then v.reale > v.prev
              else v.reale < v.prev end,
         v.spiega
  from (values
    ('Coperti', 'numero', d.coperti_previsto, d.coperti_reale, a.coperti, d.coperti_mesi > 0, false,
     'Quante persone sono entrate davvero, contro quante ne avevi previste per questo periodo.'),
    ('Ricavi di sala', 'euro', d.ricavi_previsto, d.ricavi_reale, a.ricavi, d.ricavi_mesi > 0, false,
     'Quello che hai incassato, non quello che i conti valevano.'),
    ('Scontrino medio', 'euro', v_scmp, v_scmr,
     case when a.coperti > 0 then a.ricavi / a.coperti end, d.ricavi_mesi > 0, false,
     'Quanto spende una persona. Cala anche quando i coperti crescono, e allora il totale non lo fa vedere.'),
    ('Food cost', 'euro', d.food_previsto, d.food_reale, a.costi_variabili, d.food_mesi > 0, true,
     'Quanto e'' costata la merce uscita davvero dalla cella.'),
    ('Food cost sui ricavi', 'percento', v_fcp, v_fcr,
     case when a.ricavi > 0 then a.costi_variabili / a.ricavi * 100 end, d.food_mesi > 0, true,
     'E'' il numero che conta: se avevi previsto il 30%% e sei al 40%%, o alzi i prezzi o cambi materia prima. Su un totale non si vede.'),
    ('Costi fissi', 'euro', d.fissi_previsto, d.fissi_reale, a.fissi, d.fissi_mesi > 0, true,
     'Affitto, utenze e tutto cio'' che non dipende da quanta gente entra.')
  ) as v(indicatore, unita, prev, reale, anno, mis, al_ribasso, spiega);
end;
$function$;

revoke all on function andamento_anno(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function andamento_anno(uuid, integer, uuid) to authenticated;

-- =====================================================================
-- 4. Dove va a finire l'anno, imposte comprese
-- =====================================================================
-- ⚠️ Le imposte proiettate escono dal MOTORE UNICO, come tutte le altre
-- del gestionale: se questa funzione se le calcolasse da sé, ci sarebbe
-- di nuovo una seconda risposta alla stessa domanda. E si porta dietro la
-- stessa avvertenza, perché un numero e il suo limite non si separano.
create or replace function proiezione_fine_anno(p_entity_id uuid, p_anno integer, p_scenario_id uuid)
returns table (
  ricavi_piano        numeric,
  ricavi_proiettati   numeric,
  food_piano          numeric,
  food_proiettato     numeric,
  fissi_piano         numeric,
  fissi_proiettati    numeric,
  ante_imposte_piano  numeric,
  ante_imposte_proiettato numeric,
  imposte_piano       numeric,
  imposte_proiettate  numeric,
  voci_misurate       integer,
  voci_totali         integer,
  avvertenza          text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  d        record;
  a        record;
  v_mis    integer := 0;   -- quante voci sono davvero misurate
  v_ric    numeric;
  v_food   numeric;
  v_fis    numeric;
  v_ante_p numeric;
  v_ante_x numeric;
  imp_p    record;
  imp_x    record;
  v_ha     boolean;
  -- ⚠️ Scalari e non campi del record: un record non ancora assegnato non
  -- si puo' nominare nemmeno dentro un ramo che non verra' percorso —
  -- plpgsql si ferma con «not assigned yet», che parla di tuple e fa
  -- cercare un errore di struttura dove c'e' solo un ramo non preso.
  v_imp_p  numeric;
  v_imp_x  numeric;
  v_avv    text;
begin
  if not is_titolare() then
    raise exception 'La Proiezione e'' riservata al titolare.';
  end if;

  select * into d from confronto_a_oggi(p_entity_id, p_anno, p_scenario_id);
  select coalesce(sum(x.ricavi_sala), 0)        as ricavi,
         coalesce(sum(x.costi_variabili), 0)    as costi_variabili,
         coalesce(sum(x.costi_fissi_totali), 0) as fissi,
         coalesce(sum(x.margine_accessori), 0)  as margine_accessori,
         coalesce(sum(x.commissioni_pos), 0)    as pos,
         coalesce(sum(x.ammortamenti), 0)       as ammortamenti,
         coalesce(sum(x.rata_finanziamento), 0) as rata,
         coalesce(sum(x.ante_imposte), 0)       as ante_imposte,
         coalesce(sum(x.personale), 0)          as personale
    into a
  from proiezione_scenario(p_scenario_id) x;

  -- ⚠️ QUELLO CHE È SUCCESSO + QUELLO CHE RESTA DA FARE COME PREVISTO.
  -- Nessun ritmo estrapolato sui mesi futuri: il piano e' la rotta da
  -- tenere, e questa stima dice dove si arriva se da domani la si tiene
  -- (regola di Alessio, 15/08/2026). Una voce non misurata resta al
  -- piano per intero: da un buco non si proietta niente.
  v_ric  := a.ricavi;
  v_food := a.costi_variabili;
  v_fis  := a.fissi;

  if d.ricavi_mesi > 0 then
    v_ric := round(d.ricavi_reale + (a.ricavi - d.ricavi_previsto), 2);
    v_mis := v_mis + 1;
  end if;
  if d.food_mesi > 0 then
    v_food := round(d.food_reale + (a.costi_variabili - d.food_previsto), 2);
    v_mis := v_mis + 1;
  end if;
  if d.fissi_mesi > 0 then
    v_fis := round(d.fissi_reale + (a.fissi - d.fissi_previsto), 2);
    v_mis := v_mis + 1;
  end if;

  -- Le linee accessorie restano quelle del piano: nessun modulo le
  -- misura, e proiettarle col ritmo della sala vorrebbe dire far salire
  -- un numero che nessuno ha visto.
  v_ante_p := a.ante_imposte;
  v_ante_x := round(v_ric - v_food + a.margine_accessori - a.pos - v_fis - a.ammortamenti - a.rata, 2);

  v_ha := exists (select 1 from fiscal_settings where entity_id = p_entity_id);
  if v_ha then
    select * into imp_p from calcola_imposte(p_entity_id, v_ante_p, a.personale);
    select * into imp_x from calcola_imposte(p_entity_id, v_ante_x, a.personale);
    v_imp_p := imp_p.totale;
    v_imp_x := imp_x.totale;
    v_avv   := imp_x.avvertenza;
  else
    v_avv := 'Per questa attivita'' non ci sono ancora i parametri fiscali: le imposte non sono calcolate.';
  end if;

  if v_mis = 0 then
    v_avv := 'Nessuna voce e'' ancora misurata: questa NON e'' una stima aggiornata, e'' il piano ripetuto. ' || v_avv;
  else
    v_avv := 'Stima a fine anno: quello che e'' successo finora piu'' quello che resta da fare come lo avevi '
          || 'previsto. I mesi futuri restano al piano — nessun andamento viene esteso in avanti. '
          || 'Le voci non ancora misurate restano quelle del piano. ' || v_avv;
  end if;

  return query select
    a.ricavi, v_ric,
    a.costi_variabili, v_food,
    a.fissi, v_fis,
    v_ante_p, v_ante_x,
    v_imp_p, v_imp_x,
    v_mis, 3,
    v_avv;
end;
$function$;

revoke all on function proiezione_fine_anno(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function proiezione_fine_anno(uuid, integer, uuid) to authenticated;

-- =====================================================================
-- 5. Una previsione chiusa si butta intera, o non si tocca affatto
-- =====================================================================
-- ⚠️ CAMBIA UNA REGOLA CONSEGNATA IERI, e va detto per intero. Il blocco
-- di ieri rifiutava anche la CANCELLAZIONE di una previsione chiusa. Se
-- n'è accorta una prova automatica, che non riusciva a ripulirsi dietro e
-- lasciava una previsione nel database a ogni giro — ma il difetto vero
-- non era della prova: **nemmeno Alessio avrebbe potuto togliere una
-- previsione chiusa per sbaglio** (il file sbagliato, l'anno sbagliato).
-- Sarebbe rimasta nel suo elenco per sempre, confondibile con quella
-- buona.
--
-- La regola nuova separa due cose che ieri erano una sola:
--   · **ritoccare** una previsione chiusa resta impossibile, sempre, in
--     ogni sua parte — ed è quello che il mandato chiedeva;
--   · **buttarla via intera** si può, ed è un gesto che resta scritto:
--     la testata e i dodici mesi congelati finiscono in `deleted_records`
--     come per le altre tabelle di soldi.
--
-- ⚠️ Non è un indebolimento travestito: cancellare una previsione non la
-- rende ricalcolabile, e non permette di correggerne un pezzo lasciando
-- il resto. O c'è tutta com'era, o non c'è.
--
-- ⚠️ Conseguenza da conoscere: `20260814000014` contiene una verifica che
-- pretende il rifiuto della cancellazione. Una ricostruzione da zero le
-- applica in ordine e funziona (quella regola era vera quel giorno);
-- rieseguire quella migrazione DA SOLA dopo questa fallirebbe. Non si
-- corregge il file già applicato: girerebbe a chi controlla un file
-- diverso da quello che ha prodotto lo stato reale (Contratto §8).
create or replace function vieta_scenario_congelato()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  -- Buttare via l'intera previsione si puo': resta la copia nel registro
  -- delle cancellazioni. Correggerne un pezzo no, mai.
  if tg_op = 'DELETE' then
    return old;
  end if;
  if old.congelato_il is not null then
    raise exception 'Questa previsione e'' congelata: non si ritocca. Per cambiare rotta si crea una riproiezione, che resta confrontabile con questa. Se e'' sbagliata si butta via intera.';
  end if;
  return new;
end;
$function$;

revoke all on function vieta_scenario_congelato() from public, anon, authenticated;

create or replace function vieta_righe_scenario_congelato()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_scenario uuid;
  v_esiste   boolean;
  v_congelato timestamptz;
begin
  if tg_op = 'DELETE' then v_scenario := old.scenario_id;
  else                      v_scenario := new.scenario_id;
  end if;

  select congelato_il, true into v_congelato, v_esiste
    from scenari_proiezione where id = v_scenario;

  -- ⚠️ Se la testata non c'e' piu', questa riga sta sparendo INSIEME a
  -- lei: e' la cascata di una previsione buttata via intera, ed e'
  -- ammessa. Se invece la testata c'e' ed e' congelata, qualcuno sta
  -- cercando di togliere un pezzo lasciando il resto — e quello no.
  if not coalesce(v_esiste, false) then
    return old;
  end if;

  if v_congelato is not null then
    raise exception 'Questa previsione e'' congelata: i suoi numeri non si toccano piu''.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

revoke all on function vieta_righe_scenario_congelato() from public, anon, authenticated;

-- Il gesto resta scritto — ma solo quando c'è qualcosa da ricordare.
--
-- ⚠️ Il registro delle cancellazioni **non si può ripulire da nessuno**:
-- ha la sola lettura, ed è giusto così (un registro cancellabile non è un
-- registro). La conseguenza è che ciò che ci finisce dentro ci resta per
-- sempre, quindi non ci deve finire rumore: una previsione ancora
-- **aperta** è lavoro in corso, e buttarla via è come cancellare una
-- bozza. Si registra solo la cancellazione di una previsione **chiusa**,
-- che è una decisione presa e poi ritirata.
--
-- Per lo stesso motivo NON si registrano i dodici mesi congelati uno per
-- uno: sarebbero dodici righe di dettaglio a ogni cancellazione, e i
-- numeri che contano (pareggio, imposte, utile) stanno già nella riga
-- della previsione.
do $tracce$
begin
  -- Se una stesura precedente aveva messo il registro sui risultati, si toglie.
  if exists (select 1 from pg_trigger
              where tgname = 'trg_log_delete' and tgrelid = 'scenario_risultati'::regclass) then
    drop trigger trg_log_delete on scenario_risultati;
  end if;

  -- Si ricrea sempre invece di saltarlo se c'e': la condizione «solo se
  -- congelata» e' parte del trigger, non del suo nome, e un `if not
  -- exists` lascerebbe in piedi la versione senza condizione — che
  -- registrerebbe anche le bozze, in silenzio.
  drop trigger if exists trg_log_delete on scenari_proiezione;
  create trigger trg_log_delete before delete on scenari_proiezione
    for each row when (old.congelato_il is not null)
    execute function log_deleted_record();
end $tracce$;

-- =====================================================================
-- 6. Costruire e correggere una previsione a mano
-- =====================================================================
-- ⚠️ IL PEZZO CHE MANCAVA, e l'errore era mio: la consegna di stanotte
-- aveva una sola porta d'ingresso, il foglio Excel. Alessio se ne e'
-- accorto subito («ora sono vincolato a un file esterno»), e aveva
-- ragione: i numeri vivono nel gestionale, ma non c'era modo di
-- scriverli o correggerli senza passare da un file.
--
-- Aggiorna una previsione APERTA: le righe figlie si rifanno da capo
-- invece di essere modificate una per una — sei tabelle in una
-- transazione sola (B4), come la creazione. Su una previsione chiusa
-- fallisce da sé: la respingono i trigger, non un controllo qui dentro.
create or replace function aggiorna_scenario_proiezione(p_scenario_id uuid, p_dati jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_par jsonb := p_dati -> 'parametri';
  s     scenari_proiezione%rowtype;
begin
  if not is_titolare() then
    raise exception 'La Proiezione e'' riservata al titolare.';
  end if;

  select * into s from scenari_proiezione where id = p_scenario_id for update;
  if s.id is null then
    raise exception 'Questa previsione non esiste.';
  end if;
  if s.congelato_il is not null then
    raise exception 'Questa previsione e'' chiusa: non si ritocca. Per cambiare rotta creane una nuova, che resta confrontabile con questa.';
  end if;

  if jsonb_array_length(coalesce(p_dati -> 'mesi', '[]'::jsonb)) <> 12 then
    raise exception 'Una previsione ha dodici mesi: ne sono arrivati %.',
      jsonb_array_length(coalesce(p_dati -> 'mesi', '[]'::jsonb));
  end if;

  update scenari_proiezione set
    nome                           = coalesce(nullif(trim(p_dati ->> 'nome'), ''), nome),
    anno                           = coalesce((p_dati ->> 'anno')::integer, anno),
    note                           = p_dati ->> 'note',
    scontrino_food                 = (v_par ->> 'scontrinoFood')::numeric,
    scontrino_beverage             = (v_par ->> 'scontrinoBeverage')::numeric,
    food_cost_percento             = (v_par ->> 'foodCostPercento')::numeric,
    beverage_cost_percento         = (v_par ->> 'beverageCostPercento')::numeric,
    lavanderia_coperto             = coalesce((v_par ->> 'lavanderiaCoperto')::numeric, 0),
    pagamenti_elettronici_percento = coalesce((v_par ->> 'pagamentiElettroniciPercento')::numeric, 0),
    commissione_pos_percento       = coalesce((v_par ->> 'commissionePosPercento')::numeric, 0),
    ore_giorno                     = coalesce((v_par ->> 'oreGiorno')::numeric, 8),
    pressione_personale            = coalesce((v_par ->> 'pressionePersonale')::numeric, 0),
    ammortamenti_annui             = coalesce((v_par ->> 'ammortamentiAnnui')::numeric, 0),
    finanziamento_importo          = coalesce((v_par ->> 'finanziamentoImporto')::numeric, 0),
    finanziamento_tasso            = coalesce((v_par ->> 'finanziamentoTasso')::numeric, 0),
    finanziamento_anni             = coalesce((v_par ->> 'finanziamentoAnni')::integer, 0)
  where id = p_scenario_id;

  delete from scenario_personale        where scenario_id = p_scenario_id;
  delete from scenario_extra            where scenario_id = p_scenario_id;
  delete from scenario_costi_fissi      where scenario_id = p_scenario_id;
  delete from scenario_linee_accessorie where scenario_id = p_scenario_id;
  delete from scenario_mesi             where scenario_id = p_scenario_id;

  insert into scenario_personale (scenario_id, ruolo, netto_orario, netto_giorno)
  select p_scenario_id, x ->> 'ruolo', (x ->> 'nettoOrario')::numeric, (x ->> 'nettoGiorno')::numeric
    from jsonb_array_elements(coalesce(p_dati -> 'personale', '[]'::jsonb)) x;

  insert into scenario_extra (scenario_id, tipo, giornate_anno, tariffa_giorno, pressione, da_eventi)
  select p_scenario_id, x ->> 'tipo', (x ->> 'giornateAnno')::numeric, (x ->> 'tariffaGiorno')::numeric,
         coalesce((x ->> 'pressione')::numeric, 0), coalesce((x ->> 'daEventi')::boolean, false)
    from jsonb_array_elements(coalesce(p_dati -> 'extra', '[]'::jsonb)) x;

  insert into scenario_costi_fissi (scenario_id, voce, euro_mese)
  select p_scenario_id, x ->> 'voce', (x ->> 'euroMese')::numeric
    from jsonb_array_elements(coalesce(p_dati -> 'costiFissi', '[]'::jsonb)) x;

  insert into scenario_linee_accessorie (scenario_id, linea, quantita, prezzo_medio, costo_percento, base)
  select p_scenario_id, x ->> 'linea', (x ->> 'quantita')::numeric, (x ->> 'prezzoMedio')::numeric,
         (x ->> 'costoPercento')::numeric, coalesce(x ->> 'base', 'per_giorno')
    from jsonb_array_elements(coalesce(p_dati -> 'accessorie', '[]'::jsonb)) x;

  insert into scenario_mesi (
    scenario_id, mese, servizi_settimana, giorni_lavorativi, giorni_peak,
    coperti_peak, coperti_feriali, eventi_premium
  )
  select p_scenario_id, (x ->> 'mese')::smallint, coalesce((x ->> 'serviziSettimana')::numeric, 0),
         (x ->> 'giorniLavorativi')::smallint, (x ->> 'giorniPeak')::smallint,
         (x ->> 'copertiPeak')::numeric, (x ->> 'copertiFeriali')::numeric,
         coalesce((x ->> 'eventiPremium')::numeric, 0)
    from jsonb_array_elements(p_dati -> 'mesi') x;

  return p_scenario_id;
end;
$function$;

comment on function aggiorna_scenario_proiezione is
  'Corregge una previsione APERTA rifacendo le righe figlie: sei tabelle in una transazione (B4). Su una previsione chiusa la respingono i trigger, non un controllo scritto qui.';

revoke all on function aggiorna_scenario_proiezione(uuid, jsonb) from public, anon, authenticated;
grant execute on function aggiorna_scenario_proiezione(uuid, jsonb) to authenticated;

-- =====================================================================
-- 6. Verifica (§7 punti 1-3)
-- =====================================================================
do $verifica$
declare
  v_titolare uuid;
  v_staff    uuid;
  v_ente     uuid;
  v_id       uuid;
  v_conto    uuid;
  v_causale  uuid;
  v_anno     integer := extract(year from now())::integer;
  v_mese     integer := extract(month from now())::integer;
  v_dati     jsonb;
  r          record;
  x          record;
  n          integer;
  respinto   boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  select id into v_ente from entities where entity_type <> 'srls' limit 1;
  if v_titolare is null or v_staff is null or v_ente is null then
    raise exception 'Servono due entita'', titolare e staff per questa verifica.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- Un piano piatto: 10 giorni al mese, 10 coperti al giorno, scontrino
  -- 50, costo variabile 15, mille di fissi. Cosi' i conti si rifanno a
  -- mente anche sui cumulati.
  v_dati := jsonb_build_object(
    'entity_id', v_ente, 'nome', '__PROVA ANDAMENTO__', 'tipo', 'riproiezione', 'anno', v_anno,
    'parametri', jsonb_build_object(
      'scontrinoFood', 40, 'scontrinoBeverage', 10,
      'foodCostPercento', 0.25, 'beverageCostPercento', 0.5,
      'lavanderiaCoperto', 0, 'pagamentiElettroniciPercento', 0, 'commissionePosPercento', 0,
      'oreGiorno', 8, 'pressionePersonale', 0,
      'ammortamentiAnnui', 0, 'finanziamentoImporto', 0, 'finanziamentoTasso', 0, 'finanziamentoAnni', 0),
    'personale', '[]'::jsonb, 'extra', '[]'::jsonb,
    'costiFissi', jsonb_build_array(jsonb_build_object('voce', 'Affitto', 'euroMese', 1000)),
    'accessorie', '[]'::jsonb,
    'mesi', (select jsonb_agg(jsonb_build_object(
        'mese', g, 'serviziSettimana', 3, 'giorniLavorativi', 10, 'giorniPeak', 0,
        'copertiPeak', 0, 'copertiFeriali', 10, 'eventiPremium', 0))
      from generate_series(1, 12) g));

  v_id := crea_scenario_proiezione(v_dati);

  -- --- Correggere a mano una previsione aperta ---
  v_dati := jsonb_set(v_dati, '{parametri,scontrinoFood}', '50'::jsonb);
  perform aggiorna_scenario_proiezione(v_id, v_dati);
  select * into x from proiezione_scenario(v_id) where mese = 1;
  if x.ricavi_sala <> 6000 then
    raise exception 'Dopo la correzione i ricavi del mese attesi 6.000, trovati %', x.ricavi_sala;
  end if;
  -- Le righe figlie si rifanno, e non si duplicano.
  select count(*) into n from scenario_mesi where scenario_id = v_id;
  if n <> 12 then raise exception 'Dopo la correzione i mesi sono %, non 12.', n; end if;
  select count(*) into n from scenario_costi_fissi where scenario_id = v_id;
  if n <> 1 then raise exception 'Dopo la correzione le voci di costo fisso sono %, non 1.', n; end if;
  -- Rimesso com'era, per far tornare i conti a mente.
  v_dati := jsonb_set(v_dati, '{parametri,scontrinoFood}', '40'::jsonb);
  perform aggiorna_scenario_proiezione(v_id, v_dati);

  -- --- Senza niente di misurato, NON e' una proiezione ---
  select * into r from proiezione_fine_anno(v_ente, v_anno, v_id);
  if r.voci_misurate <> 0 then
    raise exception 'Senza dati veri risultano % voci misurate.', r.voci_misurate;
  end if;
  if r.ricavi_proiettati <> r.ricavi_piano then
    raise exception 'Senza dati veri la proiezione si e'' scostata dal piano.';
  end if;
  if r.avvertenza not like '%NON e%stima aggiornata%' then
    raise exception 'Non viene dichiarato che senza misure non c''e'' nessuna stima: «%»', r.avvertenza;
  end if;

  -- --- Con dei numeri veri: si somma il fatto, non si estende il ritmo ---
  insert into orders (entity_id, table_label, status, coperti, coperto_unit_price)
  values ((select id from entities where entity_type = 'srls'), '__PROVA ANDAMENTO__', 'aperto', 10, 0)
  returning id into v_conto;
  insert into order_items (order_id, quantity, unit_price, free_text_name, destination)
  values (v_conto, 1, 600.00, 'Prova andamento', 'cucina');

  perform close_order_paid(v_conto, 'contante', 0);
  update orders set closed_at = make_date(v_anno, 1, 15) where id = v_conto;

  -- ⚠️ Il conto sta sulla S.r.l.s., la previsione sull'altra entita': i
  -- due mondi non devono mescolarsi, e questo lo dimostra.
  select * into r from proiezione_fine_anno(v_ente, v_anno, v_id);
  if r.voci_misurate <> 0 then
    raise exception 'I conti di un''altra attivita'' sono finiti nella proiezione.';
  end if;

  -- ⚠️ LA REGOLA DI ALESSIO, sui numeri veri della S.r.l.s.: quello che e'
  -- successo piu' quello che resta da fare come previsto. Il piano di
  -- questa prova fa 6.000 di ricavi al mese, 72.000 l'anno; il conto
  -- vero di gennaio ne ha incassati 600.
  --
  -- La stima aggiornata NON deve essere 72.000 moltiplicato per il
  -- rapporto fra 600 e quello che il piano si aspettava finora: deve
  -- essere 600 piu' tutto il piano che resta.
  declare
    v_srls  uuid := (select id from entities where entity_type = 'srls');
    v_id2   uuid;
    v_atteso numeric;
    v_anno_piano numeric;
    cp      record;
  begin
    v_id2 := crea_scenario_proiezione(jsonb_set(v_dati, '{entity_id}', to_jsonb(v_srls::text)));
    select * into cp from confronto_a_oggi(v_srls, v_anno, v_id2);
    select * into r  from proiezione_fine_anno(v_srls, v_anno, v_id2);

    -- ⚠️ Un mese solo ha dei conti (gennaio), e SOLO quello entra nel
    -- confronto: e' la correzione che questa verifica ha imposto — un
    -- locale che apre a marzo non deve risultare «non misurato» per
    -- sempre solo perche' a gennaio era chiuso.
    if cp.ricavi_mesi <> 1 then
      raise exception 'I mesi con ricavi misurati sono %, atteso 1.', cp.ricavi_mesi;
    end if;

    -- L'alias non puo' chiamarsi «x»: nel blocco c'e' gia' una variabile
    -- con quel nome, e Postgres non sa a quale delle due ci si riferisce.
    select coalesce(sum(pr.ricavi_sala), 0) into v_anno_piano
      from proiezione_scenario(v_id2) pr;

    v_atteso := round(600 + (v_anno_piano - cp.ricavi_previsto), 2);
    if r.ricavi_proiettati <> v_atteso then
      raise exception 'Stima dei ricavi attesa % (600 incassati + il piano che resta), trovata %',
        v_atteso, r.ricavi_proiettati;
    end if;
    if r.ricavi_proiettati > r.ricavi_piano then
      raise exception 'Un solo conto da 600 ha fatto salire la stima dell''anno sopra il piano: il ritmo e'' stato esteso in avanti.';
    end if;
    if r.avvertenza not like '%nessun andamento viene esteso in avanti%' then
      raise exception 'La stima non dichiara di non estendere l''andamento: «%»', r.avvertenza;
    end if;

    -- E la stessa cosa nella riga dell'indicatore.
    select * into x from andamento_anno(v_srls, v_anno, v_id2) where indicatore = 'Ricavi di sala';
    if x.proiettato_anno <> v_atteso then
      raise exception 'L''indicatore dei ricavi proietta % invece di %', x.proiettato_anno, v_atteso;
    end if;
    if not x.peggiora then
      raise exception 'Incassare meno del previsto non risulta un peggioramento.';
    end if;

    -- --- Una previsione chiusa: si butta intera, non si sfoglia ---
    perform congela_scenario(v_id2);

    respinto := false;
    begin
      update scenari_proiezione set nome = 'ritoccata' where id = v_id2;
    exception when sqlstate 'P0001' then respinto := true;
    end;
    if not respinto then raise exception 'Una previsione chiusa si e'' lasciata ritoccare.'; end if;

    respinto := false;
    begin
      delete from scenario_mesi where scenario_id = v_id2 and mese = 1;
    exception when sqlstate 'P0001' then respinto := true;
    end;
    if not respinto then
      raise exception 'Si e'' potuto togliere un pezzo da una previsione chiusa lasciando il resto.';
    end if;

    -- Intera invece si', e resta scritto.
    delete from scenari_proiezione where id = v_id2;
    if exists (select 1 from scenari_proiezione where id = v_id2) then
      raise exception 'Una previsione chiusa non si e'' lasciata buttare via.';
    end if;
    select count(*) into n from deleted_records
     where table_name = 'scenari_proiezione' and (record ->> 'id') = v_id2::text;
    if n <> 1 then
      raise exception 'La cancellazione della previsione non e'' finita nel registro (% righe).', n;
    end if;
    -- ⚠️ E una previsione ancora APERTA se ne va senza lasciare traccia:
    -- e' una bozza, e un registro pieno di bozze cancellate e' un registro
    -- che si smette di leggere.
    declare v_bozza uuid;
    begin
      v_bozza := crea_scenario_proiezione(jsonb_set(
        jsonb_set(v_dati, '{entity_id}', to_jsonb(v_srls::text)), '{nome}', '"__PROVA BOZZA__"'));
      delete from scenari_proiezione where id = v_bozza;
      select count(*) into n from deleted_records where (record ->> 'id') = v_bozza::text;
      if n <> 0 then
        raise exception 'La cancellazione di una previsione aperta ha lasciato % righe nel registro.', n;
      end if;
    end;

    -- La prova non lascia lapidi finte in un registro che serve ai fatti
    -- veri — e questo e' l'unico posto da cui si possa fare, perche' il
    -- registro ha la sola lettura per tutti gli altri.
    delete from deleted_records
     where (record ->> 'id') = v_id2::text or (record ->> 'scenario_id') = v_id2::text;
  end;

  -- Lo staff non deve vedere niente di tutto questo.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  respinto := false;
  begin
    perform * from andamento_anno(v_ente, v_anno, v_id);
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then raise exception 'Lo staff ha potuto vedere l''andamento dell''anno.'; end if;
  respinto := false;
  begin
    perform aggiorna_scenario_proiezione(v_id, v_dati);
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then raise exception 'Lo staff ha potuto correggere una previsione.'; end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- --- L'indicatore che Alessio ha chiesto per nome ---
  select count(*) into n from andamento_anno(v_ente, v_anno, v_id);
  if n <> 6 then raise exception 'L''andamento ha % indicatori invece di 6.', n; end if;
  select * into r from andamento_anno(v_ente, v_anno, v_id) where indicatore = 'Food cost sui ricavi';
  if r.unita <> 'percento' then
    raise exception 'Il food cost sui ricavi non e'' espresso in percentuale.';
  end if;
  -- 15 di costo variabile su 50 di scontrino = 30% previsto.
  if round(r.previsto_anno, 2) <> 30.00 then
    raise exception 'Food cost previsto atteso 30%%, trovato %', r.previsto_anno;
  end if;
  -- Non misurato: niente scarto inventato.
  if r.misurato or r.scarto_percento is not null then
    raise exception 'Un food cost non misurato ha prodotto uno scarto.';
  end if;

  -- ⚠️ Il verso del segnale: su food cost e fissi «sopra» e' peggio, su
  -- ricavi e coperti e' meglio. Senza, un colore direbbe l'opposto.
  select * into r from andamento_anno(v_ente, v_anno, v_id) where indicatore = 'Costi fissi';
  if r.peggiora then raise exception 'Senza misure i costi fissi risultano gia'' in peggioramento.'; end if;

  -- --- Pulizia ---
  perform set_config('request.jwt.claims', null, true);
  delete from scenari_proiezione where nome = '__PROVA ANDAMENTO__';
  delete from stock_consumptions where order_id = v_conto;
  delete from anomalie_scarico where order_id = v_conto;
  delete from order_items where order_id = v_conto;
  delete from orders where id = v_conto;

  select count(*) into n from scenari_proiezione where nome = '__PROVA ANDAMENTO__';
  if n <> 0 then raise exception 'La prova ha lasciato % previsioni.', n; end if;
  select count(*) into n from orders where table_label = '__PROVA ANDAMENTO__';
  if n <> 0 then raise exception 'La prova ha lasciato % conti.', n; end if;

  raise notice 'Andamento: sei indicatori, il food cost anche in percentuale, la stima = quello che e'' successo piu'' il piano che resta (nessun ritmo esteso in avanti), solo i mesi con dati entrano nel confronto, e una previsione chiusa si butta intera ma non si sfoglia.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260815000001', 'dove_stiamo_andando')
on conflict (version) do nothing;

select
  (select count(*) from scenari_proiezione)                             as previsioni,
  (select count(*) from consuntivi_mensili)                             as mesi_chiusi,
  (select count(*) from cash_causali where conta_nei_fissi and active)  as causali_nei_fissi;
