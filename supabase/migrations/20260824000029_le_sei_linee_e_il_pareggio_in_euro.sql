-- =====================================================================
-- LE SEI LINEE IN TRE FORME, E IL PAREGGIO IN EURO
-- 24/08/2026 — blocco 4 del mandato del collaudo
-- Disegno chiuso da Alessio in docs/mandati/20260824_le_linee_della_previsione.md
-- =====================================================================
-- Sei linee, tre forme:
--   · A COPERTO   — sala (com'è oggi), lunch, chef table, lounge apericena
--   · A FORFAIT   — eventi: quanti al mese, quanto si incassa in media
--   · A PEZZO     — barattoli trasformati: quanti pezzi, prezzo medio
--
-- 🔴 LA MISURA HA RIDOTTO IL LAVORO, e va detto perché il mandato temeva
-- il contrario («più largo di come sembra», e nominava dieci funzioni).
-- Chiesto al database chi tocca davvero `scenario_linee_accessorie`: sono
-- **tre** — `calcola_proiezione`, `crea_scenario_proiezione`,
-- `aggiorna_scenario_proiezione`. Le altre sette passano da quelle.
--
-- 🔴 E LA MISURA HA TROVATO IL NODO VERO, che il mandato non nominava: in
-- produzione c'è **una previsione CONGELATA** («Previsione di partenza»,
-- 2027) con dodici mesi, dodici risultati fotografati e quattro linee. Le
-- sue righe sono sigillate da un trigger — *«una previsione che si può
-- ritoccare dopo aver visto com'è andata non è una previsione»* (15/08).
--
-- ⚠️ QUINDI LE RIGHE VECCHIE NON SI TOCCANO, e i vincoli nuovi nascono
-- `not valid`: valgono da qui in avanti e lasciano stare ciò che è già
-- sigillato. Non è una scappatoia — è il contrario: sanare quelle righe
-- avrebbe richiesto di spegnere il sigillo, cioè di decidere al posto di
-- Alessio che una previsione congelata si può riscrivere.
--
-- ⚠️ E IL PREZZO È DICHIARATO: per un anno il gestionale leggerà due
-- forme, quella vecchia (`base`) e quella nuova (`forma`). La conversione
-- sta in **un posto solo** (`forma_della_linea`), così le due letture non
-- possono divergere. Il giorno che la previsione di partenza non servirà
-- più, si toglie la colonna vecchia e la funzione con lei.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Le tre forme e i codici delle linee
-- ---------------------------------------------------------------------
alter table scenario_linee_accessorie add column if not exists codice text;
alter table scenario_linee_accessorie add column if not exists forma  text;

comment on column scenario_linee_accessorie.codice is
  'Quale delle linee e'': lunch, chef_table, lounge, eventi, barattoli. La SALA non e'' qui — vive nelle colonne dello scenario, com''era.';
comment on column scenario_linee_accessorie.forma is
  'Come si conta questa linea: a_coperto (persone x scontrino), a_forfait (quanti eventi x incasso medio), a_pezzo (quanti pezzi x prezzo medio).';

-- ⚠️ `not valid`: il vincolo vale sulle righe NUOVE e non rilegge quelle
-- che ci sono già. È l'unico modo di imporre il vocabolario senza toccare
-- una previsione sigillata.
alter table scenario_linee_accessorie drop constraint if exists linea_codice_noto;
alter table scenario_linee_accessorie
  add constraint linea_codice_noto
  check (codice is null or codice in ('lunch', 'chef_table', 'lounge', 'eventi', 'barattoli'))
  not valid;

comment on constraint linea_codice_noto on scenario_linee_accessorie is
  'Le linee della previsione sono cinque oltre alla sala: lunch, chef table, lounge apericena, eventi, barattoli trasformati. Una linea nuova si aggiunge qui, non si inventa scrivendone il nome.';

alter table scenario_linee_accessorie drop constraint if exists linea_forma_nota;
alter table scenario_linee_accessorie
  add constraint linea_forma_nota
  check (forma is null or forma in ('a_coperto', 'a_forfait', 'a_pezzo'))
  not valid;

comment on constraint linea_forma_nota on scenario_linee_accessorie is
  'Una linea si conta in uno di tre modi: a coperto, a forfait, a pezzo. Un barattolo non e'' un coperto, e forzarlo in quella forma direbbe una cosa falsa su come si vende.';

-- ---------------------------------------------------------------------
-- 2 · La conversione, in un posto solo
-- ---------------------------------------------------------------------
-- ⚠️ STA QUI E NON SPARSA NEI CALCOLI: finché la previsione sigillata
-- esiste, due letture della stessa riga devono dare la stessa forma. Una
-- `case` ripetuta in tre funzioni è la premessa di tre risposte diverse.
--
-- ⚠️ E LA DEDUZIONE È DICHIARATA: `per_evento` era il forfait, tutto il
-- resto era «a giornata» — che nel foglio vero comprendeva sia coperti
-- (lounge, chef table) sia pezzi (barattoli). Non potendo distinguerli
-- all'indietro, ciò che è vecchio e non è forfait si legge **a coperto**:
-- è il verso che lascia il calcolo identico a com'era.
create or replace function public.forma_della_linea(p_forma text, p_base text)
returns text
language sql
immutable
as $function$
  select coalesce(
    p_forma,
    case when p_base = 'per_evento' then 'a_forfait' else 'a_coperto' end
  );
$function$;

comment on function public.forma_della_linea(text, text) is
  'Come si conta una linea, leggendo la forma nuova se c''e'' e deducendola dalla base vecchia se no. Serve finche'' esistono previsioni congelate scritte prima del 24/08/2026.';

revoke all on function public.forma_della_linea(text, text) from public, anon, authenticated;
grant execute on function public.forma_della_linea(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3 · Il calcolo, che ora legge la forma
-- ---------------------------------------------------------------------
-- ⚠️ CORPO PRESO DAL DATABASE VIVO (regola del 18/08): cambia il modo di
-- distinguere le forme e il resto resta identico. In particolare **i
-- numeri non cambiano** su nessuna previsione esistente — è la proprietà
-- che la verifica controlla per prima.
--
-- 🔴 E «A PEZZO» SI CONTA COME PRIMA, di proposito: quantità al giorno per
-- prezzo per giorni lavorati. Alessio ha chiesto che un barattolo **non
-- sia un coperto**, e infatti non lo è — ma la formula per contare quanti
-- se ne vendono in un mese è la stessa. Quello che cambia è che ora il
-- gestionale SA che sono pezzi: serve al pareggio in coperti di sala, che
-- deve contare solo ciò che è a coperto, e servirà al consuntivo.
--
-- rete-guardie: calcola_proiezione — la parola `per_giorno` sparisce
-- APPOSTA. Era il modo vecchio di distinguere le forme: `base =
-- 'per_giorno'` da una parte, tutto il resto (cioè il forfait) dall'altra.
-- Ora la domanda si fa a `forma_della_linea()`, che risponde con una delle
-- tre forme e sa leggere sia la colonna nuova sia quella vecchia. Il ramo
-- non è stato tolto: è stato spostato in una funzione, e la verifica qui
-- sotto controlla che i numeri della previsione esistente non si muovano
-- di un centesimo.
create or replace function public.calcola_proiezione(p_scenario_id uuid)
returns setof scenario_risultati
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  s             scenari_proiezione%rowtype;
  k             record;
  v_giorni      integer;
  v_pers_fisso  numeric;
  v_extra_anno  numeric;
  v_fissi_mese  numeric;
  v_scontrino   numeric;
  v_cv          numeric;
  v_amm_mese    numeric;
  v_rata        numeric;
begin
  select * into s from scenari_proiezione where id = p_scenario_id;
  if s.id is null then
    raise exception 'Questa previsione non esiste.';
  end if;

  select * into k from costanti_scenario(p_scenario_id);
  v_giorni     := k.giorni;
  v_pers_fisso := k.pers_fisso;
  v_extra_anno := k.extra_anno;
  v_fissi_mese := k.fissi_mese;
  v_scontrino  := k.scontrino;
  v_cv         := k.costo_coperto;
  v_amm_mese   := k.amm_mese;
  v_rata       := k.rata;

  return query
  with acc as (
    select m.mese,
           coalesce(sum(case when forma_della_linea(a.forma, a.base) = 'a_forfait'
                             then m.eventi_premium * a.prezzo_medio
                             else a.quantita * a.prezzo_medio * m.giorni_lavorativi end), 0) as ricavi,
           coalesce(sum(case when forma_della_linea(a.forma, a.base) = 'a_forfait'
                             then m.eventi_premium * a.prezzo_medio
                             else a.quantita * a.prezzo_medio * m.giorni_lavorativi end
                        * (1 - a.costo_percento)), 0) as margine
      from scenario_mesi m
      left join scenario_linee_accessorie a on a.scenario_id = p_scenario_id
     where m.scenario_id = p_scenario_id
     group by m.mese
  ),
  b as (
    select m.mese,
           (m.giorni_peak * m.coperti_peak
             + (m.giorni_lavorativi - m.giorni_peak) * m.coperti_feriali) as coperti,
           m.giorni_lavorativi,
           acc.ricavi  as acc_ricavi,
           acc.margine as acc_margine
      from scenario_mesi m join acc on acc.mese = m.mese
     where m.scenario_id = p_scenario_id
  ),
  c as (
    select b.*,
           round(b.coperti * v_scontrino, 2) as ricavi_sala,
           round(b.coperti * v_cv, 2)        as costi_var,
           round(v_extra_anno * b.giorni_lavorativi::numeric / v_giorni, 0) as pers_extra
      from b
  ),
  d as (
    select c.*,
           c.ricavi_sala - c.costi_var                as mdc,
           v_pers_fisso + c.pers_extra                as pers,
           round(c.ricavi_sala + c.acc_ricavi, 2)     as ricavi_totali
      from c
  ),
  e as (
    select d.*,
           d.pers + v_fissi_mese as fissi_totali,
           round(d.ricavi_totali * s.pagamenti_elettronici_percento * s.commissione_pos_percento, 0) as pos
      from d
  )
  select p_scenario_id,
         e.mese::smallint,
         round(e.coperti, 2),
         e.ricavi_sala,
         e.costi_var,
         e.mdc,
         v_pers_fisso,
         e.pers_extra,
         e.pers,
         v_fissi_mese,
         e.fissi_totali,
         e.mdc - e.fissi_totali,
         round(e.acc_ricavi, 2),
         round(e.acc_margine, 2),
         e.ricavi_totali,
         e.pos,
         round(e.mdc + e.acc_margine - e.pos, 2),
         round(e.mdc + e.acc_margine - e.pos - e.fissi_totali, 2),
         v_amm_mese,
         round(e.mdc + e.acc_margine - e.pos - e.fissi_totali - v_amm_mese, 2),
         v_rata,
         round(e.mdc + e.acc_margine - e.pos - e.fissi_totali - v_amm_mese - v_rata, 2)
    from e
   order by e.mese;
end;
$function$;

-- ---------------------------------------------------------------------
-- 4 · Le linee di una previsione, con la loro forma leggibile
-- ---------------------------------------------------------------------
-- ⚠️ Serve alla schermata, e restituisce la forma **risolta**: se la
-- calcolasse il client, il giorno che la deduzione cambia ci sarebbero due
-- risposte alla stessa domanda.
create or replace function public.linee_della_previsione(p_scenario_id uuid)
returns table (
  id           uuid,
  codice       text,
  linea        text,
  forma        text,
  quantita     numeric,
  prezzo_medio numeric,
  costo_percento numeric,
  a_zero       boolean
)
language sql
stable security definer
set search_path to 'public'
as $function$
  select a.id,
         a.codice,
         a.linea,
         forma_della_linea(a.forma, a.base),
         a.quantita,
         a.prezzo_medio,
         a.costo_percento,
         -- ⚠️ «A ZERO» È UN'INFORMAZIONE, non un buco: chef table e
         -- barattoli non partono da subito, e *zero previsto e zero reale
         -- è un allineamento perfetto, non un fallimento* (Alessio). La
         -- schermata deve poterlo dire invece di mostrare una riga vuota
         -- che sembra dimenticata.
         coalesce(a.quantita, 0) = 0 or coalesce(a.prezzo_medio, 0) = 0
    from scenario_linee_accessorie a
   where a.scenario_id = p_scenario_id
   order by a.linea;
$function$;

comment on function public.linee_della_previsione(uuid) is
  'Le linee di una previsione con la forma con cui si contano e se sono a zero. Una linea a zero e'' una scelta dichiarata, non una riga da riempire.';

revoke all on function public.linee_della_previsione(uuid) from public, anon, authenticated;
grant execute on function public.linee_della_previsione(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5 · Il pareggio in EURO
-- ---------------------------------------------------------------------
-- 🔴 LA RICHIESTA, con le sue parole: *«il pareggio si calcola sul totale,
-- in EURO di ricavo, e sotto — come informazione — quanti coperti di sala
-- servirebbero se le altre linee vanno come previsto. Non più "servono
-- 2915 coperti": con sei linee a scontrini diversi quel numero non vuol
-- dire niente»*.
--
-- ⚠️ E IL SECONDO NUMERO È **CONDIZIONATO**, che è il punto 3 delle regole
-- comuni: vale solo se le altre linee vanno come previsto. Esce insieme
-- alla frase che lo dice, così i due non possono separarsi — la stessa
-- forma di `calcola_imposte()`, che restituisce il numero e il suo limite.
--
-- ⚠️ Il pareggio in euro si calcola **a mix costante**: quanto ricavo
-- totale serve perché il margine copra i fissi, dato il peso che le linee
-- hanno in questa previsione. Cambiando il mix cambia il numero, ed è
-- giusto: un euro di barattoli e un euro di coperti non lasciano lo stesso
-- margine.
create or replace function public.pareggio_previsione(p_scenario_id uuid)
returns table (
  pareggio_euro          numeric,
  ricavi_previsti        numeric,
  margine_su_ricavi      numeric,
  coperti_sala_se_altre  integer,
  frase                  text
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  k          record;
  t          record;
  v_fissi    numeric;
  v_mdc_cop  numeric;
  v_rapporto numeric;
begin
  if not is_titolare() then
    raise exception 'La Proiezione è riservata al titolare.';
  end if;

  select * into k from costanti_scenario(p_scenario_id);

  select coalesce(sum(r.ricavi_totali), 0)     as ricavi,
         coalesce(sum(r.margine_totale), 0)    as mdc_sala,
         coalesce(sum(r.margine_accessori), 0) as mdc_acc
    into t
    from calcola_proiezione(p_scenario_id) r;

  -- ⚠️ I fissi dell'ANNO, non la somma dei dodici mesi arrotondati: gli
  -- arrotondamenti mensili sono una comodità di lettura, e farci sopra un
  -- pareggio farebbe dipendere il numero da come si scrivono i decimi.
  v_fissi   := k.pers_fisso * 12 + k.extra_anno + k.fissi_mese * 12;
  v_mdc_cop := k.scontrino - k.costo_coperto;

  -- Quanto margine lascia un euro di ricavo, col mix di questa previsione.
  v_rapporto := case when t.ricavi > 0
                     then (t.mdc_sala + t.mdc_acc) / t.ricavi
                     else null end;

  return query
  select
    -- ⚠️ Niente pareggio se il conto non si può fare: uno zero qui si
    -- leggerebbe «pareggi subito», che è il contrario del vero.
    case when coalesce(v_rapporto, 0) > 0 then round(v_fissi / v_rapporto, 2) else null end,
    round(t.ricavi, 2),
    case when v_rapporto is null then null else round(v_rapporto * 100, 1) end,
    case when coalesce(v_mdc_cop, 0) > 0
         then ceil(greatest(v_fissi - t.mdc_acc, 0) / v_mdc_cop)::integer
         else null end,
    case
      when coalesce(v_rapporto, 0) <= 0 then
        'Questa previsione non ha ricavi: senza, non si può dire dove sta il pareggio.'
      when coalesce(v_mdc_cop, 0) <= 0 then
        'Un coperto non lascia margine: il pareggio in coperti di sala non si può calcolare.'
      else
        'I coperti di sala valgono solo se le altre linee vanno come previsto: sono quello che manca dopo il margine delle altre, non il pareggio.'
    end;
end $function$;

comment on function public.pareggio_previsione(uuid) is
  'Dove sta il pareggio, in euro di ricavo totale. E quanti coperti di sala servirebbero SE le altre linee vanno come previsto — un numero condizionato, che esce con la frase che lo dice.';

revoke all on function public.pareggio_previsione(uuid) from public, anon, authenticated;
grant execute on function public.pareggio_previsione(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6 · Le due operazioni del corridoio scrivono codice e forma
-- ---------------------------------------------------------------------
-- ⚠️ Solo la riga delle linee cambia, in tutte e due: il resto è il corpo
-- vivo, ripreso dal database e non riscritto.
do $corridoio$
declare
  v_corpo text;
  v_nome  text;
begin
  foreach v_nome in array array['crea_scenario_proiezione', 'aggiorna_scenario_proiezione']
  loop
    select pg_get_functiondef(p.oid) into v_corpo
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_nome and p.prokind = 'f';

    if v_corpo is null then
      raise exception 'La funzione % non esiste: non posso riscriverla.', v_nome;
    end if;

    -- ⚠️ SI CONTROLLA CHE LA SOSTITUZIONE ABBIA MORSO. Un `replace` che
    -- non trova niente restituisce il testo com'era, e la migrazione
    -- passerebbe verde senza aver cambiato nulla — è la stessa forma della
    -- sanatoria muta del 17/08, che si scoprì solo perché dichiarava
    -- quante righe aveva toccato.
    --
    -- ⚠️ MA «GIÀ FATTO» NON È «NON TROVATO», e la differenza l'ha insegnata
    -- questa migrazione stessa: al primo tentativo il blocco è passato e la
    -- verifica dopo si è fermata su altro, quindi rieseguendola la riga
    -- vecchia non c'era più. Un controllo che non distingue i due casi
    -- rende la migrazione non rieseguibile — e una migrazione che si può
    -- applicare una volta sola non regge una ricostruzione da zero.
    if position('costo_percento, base, codice, forma)' in v_corpo) > 0 then
      raise notice '% scrive gia'' codice e forma: lasciata com''e''.', v_nome;
      continue;
    end if;

    if position('scenario_linee_accessorie (scenario_id, linea, quantita, prezzo_medio, costo_percento, base)' in v_corpo) = 0 then
      raise exception 'In % non trovo la riga delle linee accessorie da riscrivere.', v_nome;
    end if;

    v_corpo := replace(v_corpo,
      'scenario_linee_accessorie (scenario_id, linea, quantita, prezzo_medio, costo_percento, base)',
      'scenario_linee_accessorie (scenario_id, linea, quantita, prezzo_medio, costo_percento, base, codice, forma)');

    v_corpo := replace(v_corpo,
      E'(x ->> \'costoPercento\')::numeric, coalesce(x ->> \'base\', \'per_giorno\')',
      E'(x ->> \'costoPercento\')::numeric, coalesce(x ->> \'base\', \'per_giorno\'),\n         nullif(x ->> \'codice\', \'\'), nullif(x ->> \'forma\', \'\')');

    execute v_corpo;
  end loop;
end $corridoio$;

-- ---------------------------------------------------------------------
-- Verifica — nei DUE versi
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare   uuid;
  v_lapidi     integer;
  v_lapidi2    integer;
  v_scenario   uuid;
  v_prima      numeric;
  v_dopo       numeric;
  v_p          record;
  v_rifiutato  boolean;
  v_quante     integer;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into v_scenario from scenari_proiezione order by creato_il limit 1;

  if v_scenario is null then
    raise notice 'Nessuna previsione su questo database: i numeri non sono stati confrontati.';
  else
    -- (a) 🔴 LA PROPRIETÀ CHE CONTA PIÙ DI TUTTE: i numeri di una previsione
    --     ESISTENTE non devono muoversi di un centesimo. Cambiare il modo
    --     di distinguere le forme non è cambiare quanto si prevede di
    --     incassare, e su una previsione **congelata** un numero che si
    --     sposta sarebbe un sigillo rotto.
    --     ⚠️ Si confronta col FOTOGRAFATO (`scenario_risultati`), non con
    --     un altro calcolo: fotografare i risultati serve esattamente a
    --     questo (15/08).
    select coalesce(sum(ricavi_totali), 0) into v_prima
      from scenario_risultati where scenario_id = v_scenario;
    select coalesce(sum(r.ricavi_totali), 0) into v_dopo
      from calcola_proiezione(v_scenario) r;

    if v_prima > 0 and round(v_prima, 2) <> round(v_dopo, 2) then
      raise exception
        'I ricavi della previsione sono cambiati: erano % e ora sono %. Il calcolo nuovo non e'' equivalente al vecchio.',
        v_prima, v_dopo;
    end if;

    -- 🔴 E SE IL FOTOGRAFATO NON C'È, QUESTO CONTROLLO NON HA MISURATO
    -- NIENTE — si dichiara invece di far finta. È la trappola del caso
    -- vuoto (17/08) nella sua forma più insidiosa: sul progetto di prova le
    -- previsioni **non sono congelate e non hanno risultati fotografati**,
    -- mentre in produzione ce n'è una congelata con dodici. Il controllo
    -- che conta di più girerebbe per la prima volta sui dati veri.
    if v_prima = 0 then
      raise notice 'Nessun risultato fotografato su questo database: il confronto coi numeri di prima NON ha misurato niente. Il caso si costruisce qui sotto.';
    else
      raise notice 'Ricavi della previsione, prima e dopo: % / %.', round(v_prima, 2), round(v_dopo, 2);
    end if;

    -- (a-bis) 🔴 IL CASO SI COSTRUISCE, e questa è la prova vera di
    --     equivalenza: la stessa previsione calcolata due volte — una con
    --     le righe **senza** `forma` (come sono quelle vecchie, dove la
    --     forma si deduce) e una con la `forma` scritta esplicitamente.
    --     Se i due numeri divergono, la deduzione non è equivalente e ogni
    --     previsione già scritta comincerebbe a raccontare numeri diversi.
    --     ⚠️ Si fa su una previsione NON congelata: su una sigillata sarebbe
    --     il trigger a rifiutare, e giustamente.
    if not exists (select 1 from scenari_proiezione where id = v_scenario and congelato_il is not null)
       and exists (select 1 from scenario_linee_accessorie where scenario_id = v_scenario) then

      update scenario_linee_accessorie set forma = null where scenario_id = v_scenario;
      select coalesce(sum(r.ricavi_totali), 0) into v_prima
        from calcola_proiezione(v_scenario) r;

      update scenario_linee_accessorie
         set forma = case when base = 'per_evento' then 'a_forfait' else 'a_coperto' end
       where scenario_id = v_scenario;
      select coalesce(sum(r.ricavi_totali), 0) into v_dopo
        from calcola_proiezione(v_scenario) r;

      if round(v_prima, 2) <> round(v_dopo, 2) then
        raise exception
          'La forma dedotta e quella scritta danno numeri diversi: % contro %.', v_prima, v_dopo;
      end if;

      -- ⚠️ E LA CONTROPROVA CHE DISCRIMINA: cambiando la forma per davvero,
      --     i numeri DEVONO muoversi. Senza questa, un calcolo che ignora
      --     del tutto la forma passerebbe il controllo qui sopra — e
      --     passerebbe per il motivo sbagliato.
      update scenario_linee_accessorie set forma = 'a_forfait' where scenario_id = v_scenario;
      select coalesce(sum(r.ricavi_totali), 0) into v_dopo
        from calcola_proiezione(v_scenario) r;
      if round(v_prima, 2) = round(v_dopo, 2) then
        raise exception
          'Mettendo tutte le linee a forfait i ricavi non cambiano: il calcolo non guarda la forma.';
      end if;

      -- Si rimette com'era: le righe vecchie non avevano `forma`.
      update scenario_linee_accessorie set forma = null where scenario_id = v_scenario;
      raise notice 'Forma dedotta e forma scritta danno lo stesso numero (%), e cambiandola davvero il numero si muove.', round(v_prima, 2);
    end if;

    -- (b) Le linee vecchie si leggono con una forma, anche senza `forma`.
    select count(*) into v_quante
      from linee_della_previsione(v_scenario) l where l.forma is null;
    if v_quante > 0 then
      raise exception '% linee non hanno una forma leggibile.', v_quante;
    end if;

    -- (c) IL PAREGGIO IN EURO, e la frase che lo accompagna.
    select * into v_p from pareggio_previsione(v_scenario);
    if v_p.pareggio_euro is null or v_p.pareggio_euro <= 0 then
      raise exception 'Il pareggio in euro non e'' stato calcolato: %.', coalesce(v_p.pareggio_euro::text, 'vuoto');
    end if;
    if v_p.frase is null then
      raise exception 'Il numero dei coperti esce senza la frase che lo dichiara condizionato.';
    end if;
    raise notice 'Pareggio: % € di ricavo (margine %%% dei ricavi), oppure % coperti di sala se le altre linee tengono.',
      v_p.pareggio_euro, v_p.margine_su_ricavi, v_p.coperti_sala_se_altre;

    -- (d) ⚠️ IL PAREGGIO DEVE COPRIRE ESATTAMENTE I FISSI: a quel livello di
    --     ricavo, il margine dev'essere pari ai costi fissi dell'anno. Senza
    --     questo controllo una formula sbagliata darebbe un numero
    --     plausibile — è la forma dello scarto a zero.
    --
    -- 🔴 E IL CONTROLLO SBAGLIATO L'HO SCRITTO PRIMA IO: usava
    --     `margine_su_ricavi`, che è arrotondato a un decimale **per la
    --     lettura**. Su un pareggio da 130.000 € un decimo di punto vale
    --     65 €, e la tolleranza era di 1. La verifica si è fermata dicendo
    --     «la formula non torna» mentre a non tornare era lei.
    --     ⚠️ La regola generale: **un controllo non si fa su un numero
    --     arrotondato per essere mostrato.** Il rapporto si ricalcola
    --     esatto dalla stessa fonte del pareggio.
    if v_p.ricavi_previsti > 0 then
      declare
        v_esatto numeric;
        v_fissi  numeric;
      begin
        select (coalesce(sum(r.margine_totale), 0) + coalesce(sum(r.margine_accessori), 0))
               / nullif(sum(r.ricavi_totali), 0)
          into v_esatto
          from calcola_proiezione(v_scenario) r;
        select k.pers_fisso * 12 + k.extra_anno + k.fissi_mese * 12
          into v_fissi from costanti_scenario(v_scenario) k;

        if abs(v_p.pareggio_euro * v_esatto - v_fissi) > 0.5 then
          raise exception
            'A % € di ricavo il margine sarebbe % e i fissi sono %: il pareggio non copre i costi fissi.',
            v_p.pareggio_euro, round(v_p.pareggio_euro * v_esatto, 2), round(v_fissi, 2);
        end if;
      end;
    end if;
  end if;

  -- (e) IL VOCABOLARIO MORDE SULLE RIGHE NUOVE. ⚠️ Provato sul caso che lo
  --     fa scattare, non sul vuoto: si prova a scrivere una linea con un
  --     codice inventato, e dev'essere respinta.
  if v_scenario is not null and not exists (
    select 1 from scenari_proiezione where id = v_scenario and congelato_il is not null
  ) then
    v_rifiutato := false;
    begin
      insert into scenario_linee_accessorie (scenario_id, linea, quantita, prezzo_medio, costo_percento, base, codice, forma)
      values (v_scenario, '__VERIFICA__', 1, 1, 0, 'per_giorno', 'gelateria', 'a_coperto');
    exception when others then
      v_rifiutato := true;
    end;
    if not v_rifiutato then
      delete from scenario_linee_accessorie where linea = '__VERIFICA__';
      raise exception 'Una linea con un codice inventato e'' stata accettata.';
    end if;
  else
    raise notice 'La previsione e'' congelata: il vocabolario delle linee nuove non e'' stato esercitato qui.';
  end if;

  -- (f) IL PORTIERE del pareggio, col ruolo vero.
  if exists (select 1 from user_roles where role <> 'titolare') then
    perform set_config('request.jwt.claims',
      json_build_object('sub', (select user_id from user_roles where role <> 'titolare' limit 1),
                        'role', 'authenticated')::text, true);
    v_rifiutato := false;
    begin
      perform * from pareggio_previsione(coalesce(v_scenario, gen_random_uuid()));
    exception when others then
      v_rifiutato := true;
    end;
    if not v_rifiutato then
      raise exception 'Lo staff puo'' leggere il pareggio della previsione.';
    end if;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  end if;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Le linee hanno una forma, e il pareggio si dice in euro.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000029', 'le_sei_linee_e_il_pareggio_in_euro') on conflict (version) do nothing;
