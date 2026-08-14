-- ---------------------------------------------------------------------
-- La rotta: scenari versionati, e congelati sul serio
-- ---------------------------------------------------------------------
-- Blocco 3, secondo pezzo. Dal mandato:
--
--   «Scenari versionati e congelati: la previsione di partenza si carica
--    e NON SI RITOCCA MAI — le riproiezioni sono scenari nuovi, datati,
--    confrontabili tra loro e con la partenza.»
--
-- ⚠️ DOVE STA LA GARANZIA, ed è il punto che verrà controllato per primo.
-- «Congelato» non è un'etichetta né un pulsante grigio nella schermata:
-- sono due trigger che rifiutano ogni `update` e ogni `delete` su uno
-- scenario chiuso **e su tutte le sue righe**. Una previsione che si può
-- ritoccare dopo aver visto come è andata non è una previsione: è una
-- giustificazione. E se la garanzia vivesse nel codice della schermata,
-- basterebbe un secondo punto di scrittura — o il browser — per aggirarla.
--
-- ⚠️ E I NUMERI SI FOTOGRAFANO, non si ricalcolano. Congelare scrive i
-- dodici mesi calcolati dentro `scenario_risultati` e non li rilegge mai
-- più dal calcolo. Il motivo non è la velocità: gli ingressi sono già
-- immutabili, ma **la formula no** — se un domani si correggesse un
-- arrotondamento, uno scenario chiuso a maggio comincerebbe a raccontare
-- numeri diversi da quelli su cui Alessio aveva deciso. È lo stesso
-- principio del costo congelato sul lotto di una produzione e del prezzo
-- del coperto fotografato sul conto.
--
-- ⚠️ IL FOGLIO DI ALESSIO NON ENTRA QUI DENTRO. Vincolo suo del
-- 14/08/2026: il repository è pubblico, quindi nessun numero del piano
-- vive in una migrazione. Lo scenario di partenza si carica **dalla
-- schermata**, leggendo il file dal suo computer. Questa migrazione crea
-- il posto dove metterlo e la verifica gira su numeri inventati apposta.
--
-- Il calcolo, invece, vive QUI e non nella schermata: la Proiezione,
-- l'importazione e il confronto col foglio devono dire lo stesso numero
-- (stessa regola di `orderTotals()` e di `pianta_del_giorno()`).
--
-- Idempotente (§7 punto 3).

-- =====================================================================
-- 1. Lo scenario e i suoi ingressi
-- =====================================================================
create table if not exists scenari_proiezione (
  id                             uuid primary key default gen_random_uuid(),
  entity_id                      uuid not null references entities(id) on delete restrict,
  nome                           text not null,
  tipo                           text not null default 'riproiezione'
                                   check (tipo in ('partenza', 'riproiezione')),
  anno                           integer not null,
  scenario_padre_id              uuid references scenari_proiezione(id) on delete set null,
  -- Da dove viene: il NOME del file, mai il suo contenuto.
  origine                        text,
  versione_foglio                text,

  -- Parametri di sala, per coperto
  scontrino_food                 numeric(10,2) not null,
  scontrino_beverage             numeric(10,2) not null,
  food_cost_percento             numeric(6,4)  not null,
  beverage_cost_percento         numeric(6,4)  not null,
  lavanderia_coperto             numeric(10,2) not null default 0,
  pagamenti_elettronici_percento numeric(6,4)  not null default 0,
  commissione_pos_percento       numeric(6,4)  not null default 0,

  -- Personale e struttura
  ore_giorno                     numeric(5,2)  not null default 8,
  pressione_personale            numeric(6,4)  not null default 0,

  -- Sotto l'EBITDA
  ammortamenti_annui             numeric(12,2) not null default 0,
  finanziamento_importo          numeric(12,2) not null default 0,
  finanziamento_tasso            numeric(6,4)  not null default 0,
  finanziamento_anni             integer       not null default 0,

  -- ⚠️ L'aliquota unica del foglio di Alessio (una sola percentuale su
  -- tutto) si conserva SOLO per sapere da dove veniva il suo numero.
  -- NESSUN calcolo la legge: le imposte le fa `calcola_imposte()`, che è
  -- il motore unico. La verifica di questa migrazione lo controlla
  -- leggendo il corpo delle funzioni — una promessa non basta.
  aliquota_foglio_informativa    numeric(6,4),

  -- I totali che il foglio dichiarava: servono a confrontare, mai a calcolare.
  controlli                      jsonb,

  -- Riempiti dal congelamento, mai dall'applicazione
  bep_solo_sala                  integer,
  bep_con_accessorie             integer,
  imponibile                     numeric(14,2),
  imposte                        numeric(14,2),
  utile_netto                    numeric(14,2),
  imposte_parametri              jsonb,

  note                           text,
  creato_il                      timestamptz not null default now(),
  creato_da                      uuid,
  congelato_il                   timestamptz,

  constraint scenario_scontrino_sopra_il_costo check (
    scontrino_food + scontrino_beverage
      - (scontrino_food * food_cost_percento + scontrino_beverage * beverage_cost_percento + lavanderia_coperto) > 0
  )
);

comment on table scenari_proiezione is
  'Una previsione, con dentro i suoi ingressi. Congelata non si tocca piu'': i trigger rifiutano update e delete. Le riproiezioni sono scenari NUOVI che puntano al padre, cosi'' si confrontano invece di sostituirsi.';
comment on column scenari_proiezione.aliquota_foglio_informativa is
  'Solo memoria di come il foglio Excel stimava le imposte (aliquota unica). NESSUNA funzione la legge: le imposte le calcola calcola_imposte(), motore unico.';

create table if not exists scenario_personale (
  id            uuid primary key default gen_random_uuid(),
  scenario_id   uuid not null references scenari_proiezione(id) on delete cascade,
  ruolo         text not null,
  netto_orario  numeric(10,2) not null check (netto_orario >= 0),
  netto_giorno  numeric(10,2) not null check (netto_giorno >= 0)
);

create table if not exists scenario_extra (
  id             uuid primary key default gen_random_uuid(),
  scenario_id    uuid not null references scenari_proiezione(id) on delete cascade,
  tipo           text not null,
  giornate_anno  numeric(10,2) not null check (giornate_anno >= 0),
  tariffa_giorno numeric(10,2) not null check (tariffa_giorno >= 0),
  pressione      numeric(6,4)  not null default 0,
  -- Le giornate degli extra sugli eventi non sono un dato: sono gli
  -- eventi dell'anno. Tenerle come numero fisso vorrebbe dire che
  -- cambiando gli eventi in un mese il costo degli extra resta indietro.
  da_eventi      boolean not null default false
);

create table if not exists scenario_costi_fissi (
  id          uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references scenari_proiezione(id) on delete cascade,
  voce        text not null,
  euro_mese   numeric(12,2) not null check (euro_mese >= 0)
);

create table if not exists scenario_linee_accessorie (
  id             uuid primary key default gen_random_uuid(),
  scenario_id    uuid not null references scenari_proiezione(id) on delete cascade,
  linea          text not null,
  quantita       numeric(10,2) not null check (quantita >= 0),
  prezzo_medio   numeric(10,2) not null check (prezzo_medio >= 0),
  costo_percento numeric(6,4)  not null check (costo_percento >= 0 and costo_percento <= 1),
  base           text not null check (base in ('per_giorno', 'per_evento'))
);

create table if not exists scenario_mesi (
  id                uuid primary key default gen_random_uuid(),
  scenario_id       uuid not null references scenari_proiezione(id) on delete cascade,
  mese              smallint not null check (mese between 1 and 12),
  servizi_settimana numeric(5,2) not null default 0,
  giorni_lavorativi smallint not null check (giorni_lavorativi between 0 and 31),
  giorni_peak       smallint not null check (giorni_peak >= 0),
  coperti_peak      numeric(8,2) not null check (coperti_peak >= 0),
  coperti_feriali   numeric(8,2) not null check (coperti_feriali >= 0),
  eventi_premium    numeric(8,2) not null default 0 check (eventi_premium >= 0),
  unique (scenario_id, mese),
  constraint scenario_mesi_peak_dentro_i_giorni check (giorni_peak <= giorni_lavorativi)
);

-- I dodici mesi calcolati, scritti UNA volta dal congelamento.
-- ⚠️ Le colonne sono `numeric` SENZA precisione dichiarata, e non per
-- distrazione: Postgres pretende che una funzione che restituisce
-- `setof <tabella>` produca il tipo **identico**, decimali compresi, e un
-- `numeric(14,2)` nella tabella contro un `numeric` nel calcolo fa
-- fallire tutto con un messaggio che parla di «struttura». Gli
-- arrotondamenti li fa `calcola_proiezione`, che e' l'unica cosa che
-- scrive qui dentro: la precisione sta dove sta il calcolo, non
-- duplicata nel tipo della colonna.
create table if not exists scenario_risultati (
  scenario_id           uuid not null references scenari_proiezione(id) on delete cascade,
  mese                  smallint not null check (mese between 1 and 12),
  coperti               numeric not null,
  ricavi_sala           numeric not null,
  costi_variabili       numeric not null,
  margine_contribuzione numeric not null,
  personale_fisso       numeric not null,
  personale_extra       numeric not null,
  personale             numeric not null,
  costi_fissi_operativi numeric not null,
  costi_fissi_totali    numeric not null,
  ebitda_sala           numeric not null,
  ricavi_accessori      numeric not null,
  margine_accessori     numeric not null,
  ricavi_totali         numeric not null,
  commissioni_pos       numeric not null,
  margine_totale        numeric not null,
  ebitda                numeric not null,
  ammortamenti          numeric not null,
  ebit                  numeric not null,
  rata_finanziamento    numeric not null,
  ante_imposte          numeric not null,
  primary key (scenario_id, mese)
);

comment on table scenario_risultati is
  'I dodici mesi come sono stati calcolati il giorno del congelamento. Non si ricalcolano: se un domani cambiasse una formula, uno scenario chiuso a maggio comincerebbe a raccontare numeri diversi da quelli su cui si e'' deciso.';

create index if not exists idx_scenari_entita on scenari_proiezione(entity_id, anno);
create index if not exists idx_scenario_mesi on scenario_mesi(scenario_id);
create index if not exists idx_scenario_personale on scenario_personale(scenario_id);
create index if not exists idx_scenario_extra on scenario_extra(scenario_id);
create index if not exists idx_scenario_fissi on scenario_costi_fissi(scenario_id);
create index if not exists idx_scenario_accessorie on scenario_linee_accessorie(scenario_id);

-- =====================================================================
-- 2. Il congelamento — la garanzia, non l'etichetta
-- =====================================================================
create or replace function vieta_scenario_congelato()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_op = 'DELETE' then
    if old.congelato_il is not null then
      raise exception 'Questa previsione e'' chiusa e non si cancella: e'' la rotta su cui hai deciso. Se non serve piu'', creane una nuova.';
    end if;
    return old;
  end if;
  -- L'unico `update` ammesso su uno scenario aperto e' anche quello che
  -- lo chiude: da li' in poi non ne passa piu' nessuno, nemmeno per
  -- riaprirlo.
  if old.congelato_il is not null then
    raise exception 'Questa previsione e'' congelata: non si ritocca. Per cambiare rotta si crea una riproiezione, che resta confrontabile con questa.';
  end if;
  return new;
end;
$function$;

create or replace function vieta_righe_scenario_congelato()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_scenario  uuid;
  v_congelato timestamptz;
begin
  if tg_op = 'DELETE' then v_scenario := old.scenario_id;
  else                      v_scenario := new.scenario_id;
  end if;

  select congelato_il into v_congelato from scenari_proiezione where id = v_scenario;
  if v_congelato is not null then
    raise exception 'Questa previsione e'' congelata: i suoi numeri non si toccano piu''.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

revoke all on function vieta_righe_scenario_congelato() from public, anon, authenticated;

-- ⚠️ Anche una funzione trigger nasce eseguibile da chiunque abbia la
-- chiave pubblica: Postgres concede l'esecuzione a `public` per
-- impostazione predefinita (lezione dell'11/08, 35 funzioni trovate in
-- quello stato). Qui non uscirebbe nessun dato — fuori da un trigger
-- queste due si rifiutano di girare — ma l'elenco di chi può bussare da
-- fuori non deve crescere in silenzio, e una prova automatica diventa
-- rossa se succede. È diventata rossa: queste righe sono la risposta.
revoke all on function vieta_scenario_congelato() from public, anon, authenticated;

do $trigger$
declare t text;
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_scenario_congelato') then
    create trigger trg_scenario_congelato
      before update or delete on scenari_proiezione
      for each row execute function vieta_scenario_congelato();
  end if;

  foreach t in array array[
    'scenario_personale', 'scenario_extra', 'scenario_costi_fissi',
    'scenario_linee_accessorie', 'scenario_mesi', 'scenario_risultati'
  ] loop
    if not exists (select 1 from pg_trigger where tgname = 'trg_righe_scenario_congelato_' || t) then
      execute format(
        'create trigger %I before insert or update or delete on %I for each row execute function vieta_righe_scenario_congelato();',
        'trg_righe_scenario_congelato_' || t, t
      );
    end if;
  end loop;
end $trigger$;

-- =====================================================================
-- 3. RLS — sono i numeri più riservati del gestionale
-- =====================================================================
-- ⚠️ «Solo mio» = RLS vera sul ruolo del titolare, non una voce nascosta
-- allo staff (vincolo di Alessio, 14/08/2026). Una schermata che non
-- mostra il collegamento non impedisce a nessuno di leggere la tabella.
do $rls$
declare t text;
begin
  foreach t in array array[
    'scenari_proiezione', 'scenario_personale', 'scenario_extra',
    'scenario_costi_fissi', 'scenario_linee_accessorie', 'scenario_mesi',
    'scenario_risultati'
  ] loop
    execute format('alter table %I enable row level security;', t);
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_titolare_all') then
      execute format(
        'create policy %I on %I for all to authenticated using ((select is_titolare())) with check ((select is_titolare()));',
        t || '_titolare_all', t
      );
    end if;
  end loop;
end $rls$;

-- =====================================================================
-- 4. Il calcolo — in un posto solo
-- =====================================================================
-- ⚠️ NON è concesso a nessun client: chi guarda passa da
-- `proiezione_scenario()`, che su una previsione congelata restituisce i
-- numeri FOTOGRAFATI. Se questa fosse chiamabile dal browser, «congelato»
-- vorrebbe dire soltanto «non lo tocca la schermata».
-- Le costanti dell'anno, ricavate una volta sola dagli ingressi.
--
-- ⚠️ Stanno in una funzione loro perché servono a DUE conti — i dodici
-- mesi e il pareggio — e il pareggio non può ricavarsele sommando i mesi:
-- i mesi sono arrotondati uno per uno, e la somma di dodici arrotondamenti
-- non è il costo dell'anno. È la stessa ragione per cui il conto di un
-- tavolo si calcola in un posto solo.
create or replace function costanti_scenario(p_scenario_id uuid)
returns table (
  giorni       integer,
  eventi       numeric,
  pers_fisso   numeric,   -- al mese
  extra_anno   numeric,
  fissi_mese   numeric,
  scontrino    numeric,
  costo_coperto numeric,
  amm_mese     numeric,
  rata         numeric
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  s        scenari_proiezione%rowtype;
  v_giorni integer;
  v_eventi numeric;
  v_i      numeric;
  v_n      integer;
  v_rata   numeric;
begin
  select * into s from scenari_proiezione where id = p_scenario_id;
  if s.id is null then
    raise exception 'Questa previsione non esiste.';
  end if;

  select coalesce(sum(m.giorni_lavorativi), 0), coalesce(sum(m.eventi_premium), 0)
    into v_giorni, v_eventi
  from scenario_mesi m where m.scenario_id = p_scenario_id;

  if v_giorni = 0 then
    raise exception 'Questa previsione non ha nessun giorno di apertura: non c''e'' niente da calcolare.';
  end if;

  -- La rata del finanziamento: la formula della rata costante. Con
  -- importo o durata a zero non c'e' nessuna rata, e con tasso zero si
  -- divide semplicemente il capitale.
  v_n := s.finanziamento_anni * 12;
  if s.finanziamento_importo <= 0 or v_n = 0 then
    v_rata := 0;
  elsif s.finanziamento_tasso = 0 then
    v_rata := round(s.finanziamento_importo / v_n, 2);
  else
    v_i := s.finanziamento_tasso / 12;
    v_rata := round(s.finanziamento_importo * v_i / (1 - power(1 + v_i, -v_n)), 2);
  end if;

  return query select
    v_giorni,
    v_eventi,
    -- Il netto del mese e' il netto di una giornata per le giornate
    -- dell'anno (aperture + eventi) diviso dodici; sopra ci va la
    -- pressione fiscale e contributiva. Si arrotonda ruolo per ruolo.
    coalesce((select sum(round(p.netto_giorno * (v_giorni + v_eventi) / 12 * (1 + s.pressione_personale), 0))
                from scenario_personale p where p.scenario_id = p_scenario_id), 0),
    coalesce((select sum(round((case when e.da_eventi then v_eventi else e.giornate_anno end)
                               * e.tariffa_giorno * (1 + e.pressione), 0))
                from scenario_extra e where e.scenario_id = p_scenario_id), 0),
    coalesce((select round(sum(f.euro_mese), 0)
                from scenario_costi_fissi f where f.scenario_id = p_scenario_id), 0),
    s.scontrino_food + s.scontrino_beverage,
    s.scontrino_food * s.food_cost_percento
      + s.scontrino_beverage * s.beverage_cost_percento
      + s.lavanderia_coperto,
    round(s.ammortamenti_annui / 12, 0),
    v_rata;
end;
$function$;

revoke all on function costanti_scenario(uuid) from public, anon, authenticated;

create or replace function calcola_proiezione(p_scenario_id uuid)
returns setof scenario_risultati
language plpgsql
stable
security definer
set search_path = public
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
           coalesce(sum(case when a.base = 'per_giorno'
                             then a.quantita * a.prezzo_medio * m.giorni_lavorativi
                             else m.eventi_premium * a.prezzo_medio end), 0) as ricavi,
           coalesce(sum(case when a.base = 'per_giorno'
                             then a.quantita * a.prezzo_medio * m.giorni_lavorativi
                             else m.eventi_premium * a.prezzo_medio end
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

revoke all on function calcola_proiezione(uuid) from public, anon, authenticated;

-- Quello che guardano le schermate: fotografia se congelata, calcolo se aperta.
create or replace function proiezione_scenario(p_scenario_id uuid)
returns setof scenario_risultati
language plpgsql
stable
security definer
set search_path = public
as $function$
declare v_congelato timestamptz;
begin
  if not is_titolare() then
    raise exception 'La Proiezione e'' riservata al titolare.';
  end if;

  select congelato_il into v_congelato from scenari_proiezione where id = p_scenario_id;
  if not found then
    raise exception 'Questa previsione non esiste.';
  end if;

  if v_congelato is not null then
    return query select * from scenario_risultati where scenario_id = p_scenario_id order by mese;
  else
    return query select * from calcola_proiezione(p_scenario_id);
  end if;
end;
$function$;

revoke all on function proiezione_scenario(uuid) from public, anon, authenticated;
grant execute on function proiezione_scenario(uuid) to authenticated;

-- =====================================================================
-- 5. Il riepilogo dell'anno, pareggio e imposte
-- =====================================================================
create or replace function riepilogo_calcolato(p_scenario_id uuid)
returns table (
  coperti            numeric,
  ricavi_sala        numeric,
  ricavi_accessori   numeric,
  ricavi_totali      numeric,
  margine_totale     numeric,
  personale          numeric,
  costi_fissi        numeric,
  ebitda_sala        numeric,
  ebitda             numeric,
  ammortamenti       numeric,
  ebit               numeric,
  ante_imposte       numeric,
  bep_solo_sala      integer,
  bep_con_accessorie integer,
  imponibile         numeric,
  imposte            numeric,
  utile_netto        numeric,
  avvertenza_imposte text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  s            scenari_proiezione%rowtype;
  k            record;
  t            record;
  v_mdc_cop    numeric;
  v_fissi      numeric;
  v_imposte    record;
  v_ha_fiscali boolean;
  v_tot        numeric;
  v_netto      numeric;
  v_avvertenza text;
begin
  select * into s from scenari_proiezione where id = p_scenario_id;
  if s.id is null then raise exception 'Questa previsione non esiste.'; end if;
  select * into k from costanti_scenario(p_scenario_id);

  select coalesce(sum(r.coperti), 0)               as coperti,
         coalesce(sum(r.ricavi_sala), 0)           as ricavi_sala,
         coalesce(sum(r.ricavi_accessori), 0)      as ricavi_accessori,
         coalesce(sum(r.ricavi_totali), 0)         as ricavi_totali,
         coalesce(sum(r.margine_totale), 0)        as margine_totale,
         coalesce(sum(r.margine_accessori), 0)     as margine_accessori,
         coalesce(sum(r.personale), 0)             as personale,
         coalesce(sum(r.costi_fissi_operativi), 0) as fissi_operativi,
         coalesce(sum(r.costi_fissi_totali), 0)    as costi_fissi,
         coalesce(sum(r.ebitda_sala), 0)           as ebitda_sala,
         coalesce(sum(r.ebitda), 0)                as ebitda,
         coalesce(sum(r.ammortamenti), 0)          as ammortamenti,
         coalesce(sum(r.ebit), 0)                  as ebit,
         coalesce(sum(r.ante_imposte), 0)          as ante_imposte
    into t
  from calcola_proiezione(p_scenario_id) r;

  -- Il margine che ogni coperto lascia dopo il suo costo diretto: e' il
  -- denominatore del pareggio.
  v_mdc_cop := k.scontrino - k.costo_coperto;

  -- ⚠️ I fissi del pareggio sono quelli DELL'ANNO, non la somma dei
  -- dodici mesi arrotondati: gli arrotondamenti mensili sono una comodita'
  -- di lettura, e farci sopra un pareggio vorrebbe dire far dipendere il
  -- numero di coperti da servire da come si scrivono i decimi.
  v_fissi := k.pers_fisso * 12 + k.extra_anno + k.fissi_mese * 12;

  -- ⚠️ Le imposte NON si sommano mese per mese. Il foglio lo faceva, e
  -- cosi' i mesi in perdita non compensavano quelli in utile: usciva un
  -- totale piu' alto del dovuto. Le imposte sono annuali, e qui le
  -- calcola il motore unico — non una seconda semplificazione.
  --
  -- ⚠️ E se i parametri fiscali per questa entita' non ci sono ancora
  -- (l'azienda agricola, o un ripristino da zero), la Proiezione NON si
  -- ferma tutta: EBITDA, EBIT e pareggio non dipendono dalle imposte, e
  -- nasconderli perche' manca un'aliquota sarebbe togliere l'unica cosa
  -- che serve. Le imposte restano **vuote e dichiarate vuote** — mai uno
  -- zero, che a schermo si legge «non pago niente».
  v_ha_fiscali := exists (select 1 from fiscal_settings where entity_id = s.entity_id);

  if v_ha_fiscali then
    select * into v_imposte from calcola_imposte(s.entity_id, t.ante_imposte, t.personale);
    v_tot        := v_imposte.totale;
    v_netto      := round(t.ante_imposte - v_imposte.totale, 2);
    v_avvertenza := v_imposte.avvertenza;
  else
    v_tot        := null;
    v_netto      := null;
    v_avvertenza := 'Per questa attivita'' non ci sono ancora i parametri fiscali: le imposte non sono calcolate. Si impostano dal Simulatore.';
  end if;

  return query select
    t.coperti, t.ricavi_sala, t.ricavi_accessori, t.ricavi_totali, t.margine_totale,
    t.personale, t.costi_fissi, t.ebitda_sala, t.ebitda, t.ammortamenti, t.ebit, t.ante_imposte,
    ceil(v_fissi / v_mdc_cop)::integer,
    ceil(greatest(v_fissi - t.margine_accessori, 0) / v_mdc_cop)::integer,
    t.ante_imposte,
    v_tot,
    v_netto,
    v_avvertenza;
end;
$function$;

revoke all on function riepilogo_calcolato(uuid) from public, anon, authenticated;

create or replace function riepilogo_scenario(p_scenario_id uuid)
returns table (
  coperti            numeric,
  ricavi_sala        numeric,
  ricavi_accessori   numeric,
  ricavi_totali      numeric,
  margine_totale     numeric,
  personale          numeric,
  costi_fissi        numeric,
  ebitda_sala        numeric,
  ebitda             numeric,
  ammortamenti       numeric,
  ebit               numeric,
  ante_imposte       numeric,
  bep_solo_sala      integer,
  bep_con_accessorie integer,
  imponibile         numeric,
  imposte            numeric,
  utile_netto        numeric,
  avvertenza_imposte text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare s scenari_proiezione%rowtype;
begin
  if not is_titolare() then
    raise exception 'La Proiezione e'' riservata al titolare.';
  end if;

  select * into s from scenari_proiezione where id = p_scenario_id;
  if s.id is null then raise exception 'Questa previsione non esiste.'; end if;

  if s.congelato_il is null then
    return query select * from riepilogo_calcolato(p_scenario_id);
    return;
  end if;

  -- Congelata: si legge cio' che e' stato scritto quel giorno.
  return query
  select coalesce(sum(r.coperti), 0), coalesce(sum(r.ricavi_sala), 0),
         coalesce(sum(r.ricavi_accessori), 0), coalesce(sum(r.ricavi_totali), 0),
         coalesce(sum(r.margine_totale), 0), coalesce(sum(r.personale), 0),
         coalesce(sum(r.costi_fissi_totali), 0), coalesce(sum(r.ebitda_sala), 0),
         coalesce(sum(r.ebitda), 0), coalesce(sum(r.ammortamenti), 0),
         coalesce(sum(r.ebit), 0), coalesce(sum(r.ante_imposte), 0),
         s.bep_solo_sala, s.bep_con_accessorie,
         s.imponibile, s.imposte, s.utile_netto,
         coalesce(s.imposte_parametri ->> 'avvertenza',
                  'Imposte come stimate il giorno del congelamento.')
    from scenario_risultati r where r.scenario_id = p_scenario_id;
end;
$function$;

revoke all on function riepilogo_scenario(uuid) from public, anon, authenticated;
grant execute on function riepilogo_scenario(uuid) to authenticated;

-- =====================================================================
-- 6. Il confronto col foglio — il collaudo, fatto dalla macchina
-- =====================================================================
-- ⚠️ Il criterio di accettazione del mandato è «stessi input → stessi
-- numeri». Farlo una volta a mano non basta: sarebbe vero il giorno
-- dell'importazione e mai più. Qui il confronto è una funzione, gira a
-- ogni apertura della schermata di importazione, e dice **riga per riga**
-- dove il gestionale non riproduce il foglio.
create or replace function confronto_col_foglio(p_scenario_id uuid)
returns table (voce text, dal_foglio numeric, calcolato numeric, differenza numeric)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  s scenari_proiezione%rowtype;
  t record;
  r record;
begin
  if not is_titolare() then
    raise exception 'La Proiezione e'' riservata al titolare.';
  end if;

  select * into s from scenari_proiezione where id = p_scenario_id;
  if s.id is null then raise exception 'Questa previsione non esiste.'; end if;
  if s.controlli is null then return; end if;

  select coalesce(sum(x.coperti), 0)               as coperti,
         coalesce(sum(x.ricavi_sala), 0)           as ricavi_sala,
         coalesce(sum(x.costi_variabili), 0)       as costi_variabili,
         coalesce(sum(x.margine_contribuzione), 0) as mdc,
         coalesce(sum(x.personale), 0)             as personale,
         coalesce(sum(x.costi_fissi_operativi), 0) as fissi,
         coalesce(sum(x.ebitda_sala), 0)           as ebitda_sala,
         coalesce(sum(x.ricavi_accessori), 0)      as ricavi_accessori,
         coalesce(sum(x.margine_accessori), 0)     as margine_accessori,
         coalesce(sum(x.ricavi_totali), 0)         as ricavi_totali,
         coalesce(sum(x.commissioni_pos), 0)       as pos,
         coalesce(sum(x.margine_totale), 0)        as margine_totale,
         coalesce(sum(x.ebitda), 0)                as ebitda,
         coalesce(sum(x.ammortamenti), 0)          as ammortamenti,
         coalesce(sum(x.ebit), 0)                  as ebit
    into t
  from proiezione_scenario(p_scenario_id) x;

  select * into r from riepilogo_scenario(p_scenario_id);

  return query
  select v.voce, v.dal_foglio, v.calcolato, round(v.calcolato - v.dal_foglio, 2)
  from (values
    ('Coperti in sala',                (s.controlli ->> 'copertiSala')::numeric,         t.coperti),
    ('Ricavi di sala',                 (s.controlli ->> 'ricaviSala')::numeric,          t.ricavi_sala),
    ('Costi variabili di sala',        (s.controlli ->> 'costiVariabiliSala')::numeric,  t.costi_variabili),
    ('Margine di contribuzione',       (s.controlli ->> 'margineContribuzione')::numeric,t.mdc),
    ('Personale (somma dei mesi)',     (s.controlli ->> 'personaleAnnuo')::numeric,      t.personale),
    ('Costi fissi operativi',          (s.controlli ->> 'costiFissiAnnui')::numeric,     t.fissi),
    ('EBITDA della sola sala',         (s.controlli ->> 'ebitdaSala')::numeric,          t.ebitda_sala),
    ('Ricavi delle linee accessorie',  (s.controlli ->> 'ricaviAccessori')::numeric,     t.ricavi_accessori),
    ('Margine delle linee accessorie', (s.controlli ->> 'margineAccessori')::numeric,    t.margine_accessori),
    ('Ricavi totali',                  (s.controlli ->> 'ricaviTotali')::numeric,        t.ricavi_totali),
    ('Commissioni POS',                (s.controlli ->> 'commissioniPos')::numeric,      t.pos),
    ('Margine totale',                 (s.controlli ->> 'margineTotale')::numeric,       t.margine_totale),
    ('EBITDA complessivo',             (s.controlli ->> 'ebitdaComplessivo')::numeric,   t.ebitda),
    ('Ammortamenti',                   (s.controlli ->> 'ammortamenti')::numeric,        t.ammortamenti),
    ('EBIT',                           (s.controlli ->> 'ebit')::numeric,                t.ebit),
    ('Pareggio con la sola sala',      (s.controlli ->> 'bepSoloSala')::numeric,         r.bep_solo_sala::numeric),
    ('Pareggio con le accessorie',     (s.controlli ->> 'bepConAccessorie')::numeric,    r.bep_con_accessorie::numeric)
  ) as v(voce, dal_foglio, calcolato)
  where v.dal_foglio is not null;
end;
$function$;

revoke all on function confronto_col_foglio(uuid) from public, anon, authenticated;
grant execute on function confronto_col_foglio(uuid) to authenticated;

-- =====================================================================
-- 7. Creare e congelare — dal corridoio, sono più tabelle insieme
-- =====================================================================
create or replace function crea_scenario_proiezione(p_dati jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_id    uuid;
  v_ente  uuid;
  n       integer;
  v_par   jsonb := p_dati -> 'parametri';
begin
  if not is_titolare() then
    raise exception 'La Proiezione e'' riservata al titolare.';
  end if;

  v_ente := coalesce((p_dati ->> 'entity_id')::uuid,
                     (select id from entities where entity_type = 'srls'));
  if v_ente is null then
    raise exception 'Non so a quale entita'' appartiene questa previsione.';
  end if;

  if jsonb_array_length(coalesce(p_dati -> 'mesi', '[]'::jsonb)) <> 12 then
    raise exception 'Una previsione ha dodici mesi: ne sono arrivati %.',
      jsonb_array_length(coalesce(p_dati -> 'mesi', '[]'::jsonb));
  end if;

  -- Una sola previsione di PARTENZA per anno: la seconda non sarebbe una
  -- partenza, sarebbe una riproiezione che non lo dice.
  if coalesce(p_dati ->> 'tipo', 'riproiezione') = 'partenza' then
    select count(*) into n from scenari_proiezione
     where entity_id = v_ente and anno = (p_dati ->> 'anno')::integer and tipo = 'partenza';
    if n > 0 then
      raise exception 'Per il % c''e'' gia'' una previsione di partenza. Quella nuova e'' una riproiezione, e resta confrontabile con la prima.',
        (p_dati ->> 'anno')::integer;
    end if;
  end if;

  insert into scenari_proiezione (
    entity_id, nome, tipo, anno, scenario_padre_id, origine, versione_foglio,
    scontrino_food, scontrino_beverage, food_cost_percento, beverage_cost_percento,
    lavanderia_coperto, pagamenti_elettronici_percento, commissione_pos_percento,
    ore_giorno, pressione_personale,
    ammortamenti_annui, finanziamento_importo, finanziamento_tasso, finanziamento_anni,
    aliquota_foglio_informativa, controlli, note, creato_da
  ) values (
    v_ente,
    coalesce(nullif(trim(p_dati ->> 'nome'), ''), 'Previsione senza nome'),
    coalesce(p_dati ->> 'tipo', 'riproiezione'),
    (p_dati ->> 'anno')::integer,
    nullif(p_dati ->> 'scenario_padre_id', '')::uuid,
    p_dati ->> 'origine',
    p_dati ->> 'versione_foglio',
    (v_par ->> 'scontrinoFood')::numeric,
    (v_par ->> 'scontrinoBeverage')::numeric,
    (v_par ->> 'foodCostPercento')::numeric,
    (v_par ->> 'beverageCostPercento')::numeric,
    coalesce((v_par ->> 'lavanderiaCoperto')::numeric, 0),
    coalesce((v_par ->> 'pagamentiElettroniciPercento')::numeric, 0),
    coalesce((v_par ->> 'commissionePosPercento')::numeric, 0),
    coalesce((v_par ->> 'oreGiorno')::numeric, 8),
    coalesce((v_par ->> 'pressionePersonale')::numeric, 0),
    coalesce((v_par ->> 'ammortamentiAnnui')::numeric, 0),
    coalesce((v_par ->> 'finanziamentoImporto')::numeric, 0),
    coalesce((v_par ->> 'finanziamentoTasso')::numeric, 0),
    coalesce((v_par ->> 'finanziamentoAnni')::integer, 0),
    (v_par ->> 'aliquotaFoglioInformativa')::numeric,
    p_dati -> 'controlli',
    p_dati ->> 'note',
    auth.uid()
  ) returning id into v_id;

  insert into scenario_personale (scenario_id, ruolo, netto_orario, netto_giorno)
  select v_id, x ->> 'ruolo', (x ->> 'nettoOrario')::numeric, (x ->> 'nettoGiorno')::numeric
    from jsonb_array_elements(coalesce(p_dati -> 'personale', '[]'::jsonb)) x;

  insert into scenario_extra (scenario_id, tipo, giornate_anno, tariffa_giorno, pressione, da_eventi)
  select v_id, x ->> 'tipo', (x ->> 'giornateAnno')::numeric, (x ->> 'tariffaGiorno')::numeric,
         coalesce((x ->> 'pressione')::numeric, 0), coalesce((x ->> 'daEventi')::boolean, false)
    from jsonb_array_elements(coalesce(p_dati -> 'extra', '[]'::jsonb)) x;

  insert into scenario_costi_fissi (scenario_id, voce, euro_mese)
  select v_id, x ->> 'voce', (x ->> 'euroMese')::numeric
    from jsonb_array_elements(coalesce(p_dati -> 'costiFissi', '[]'::jsonb)) x;

  insert into scenario_linee_accessorie (scenario_id, linea, quantita, prezzo_medio, costo_percento, base)
  select v_id, x ->> 'linea', (x ->> 'quantita')::numeric, (x ->> 'prezzoMedio')::numeric,
         (x ->> 'costoPercento')::numeric, coalesce(x ->> 'base', 'per_giorno')
    from jsonb_array_elements(coalesce(p_dati -> 'accessorie', '[]'::jsonb)) x;

  insert into scenario_mesi (
    scenario_id, mese, servizi_settimana, giorni_lavorativi, giorni_peak,
    coperti_peak, coperti_feriali, eventi_premium
  )
  select v_id, (x ->> 'mese')::smallint, coalesce((x ->> 'serviziSettimana')::numeric, 0),
         (x ->> 'giorniLavorativi')::smallint, (x ->> 'giorniPeak')::smallint,
         (x ->> 'copertiPeak')::numeric, (x ->> 'copertiFeriali')::numeric,
         coalesce((x ->> 'eventiPremium')::numeric, 0)
    from jsonb_array_elements(p_dati -> 'mesi') x;

  return v_id;
end;
$function$;

comment on function crea_scenario_proiezione is
  'Crea una previsione con tutti i suoi ingressi in una transazione sola (Contratto B4): sei tabelle che devono esistere insieme, altrimenti resta una previsione a meta'' che sembra buona.';

revoke all on function crea_scenario_proiezione(jsonb) from public, anon, authenticated;
grant execute on function crea_scenario_proiezione(jsonb) to authenticated;

create or replace function congela_scenario(p_scenario_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $function$
declare
  s   scenari_proiezione%rowtype;
  r   record;
  imp record;
begin
  if not is_titolare() then
    raise exception 'La Proiezione e'' riservata al titolare.';
  end if;

  select * into s from scenari_proiezione where id = p_scenario_id for update;
  if s.id is null then raise exception 'Questa previsione non esiste.'; end if;
  if s.congelato_il is not null then
    raise exception 'Questa previsione era gia'' chiusa il %.', to_char(s.congelato_il, 'DD/MM/YYYY');
  end if;

  -- ⚠️ L'ORDINE CONTA: prima si scrivono i risultati, poi si chiude. Il
  -- trigger che vieta le scritture guarda `congelato_il`, quindi
  -- invertendo i due passi il congelamento rifiuterebbe se stesso. Ed e'
  -- il motivo per cui NON serve nessuna scappatoia nel trigger — una
  -- scappatoia sarebbe anche la strada per aggirarlo.
  insert into scenario_risultati select * from calcola_proiezione(p_scenario_id);

  select * into r from riepilogo_calcolato(p_scenario_id);

  -- I parametri fiscali di OGGI, fotografati: domani possono cambiare, e
  -- questa previsione deve continuare a dire su cosa si reggeva. Se non
  -- ce ne sono, si fotografa anche quello — «non c'erano» e' un fatto
  -- che fra un anno spiega perche' le imposte sono vuote.
  if exists (select 1 from fiscal_settings where entity_id = s.entity_id) then
    select * into imp from calcola_imposte(s.entity_id, r.ante_imposte, r.personale);
    update scenari_proiezione set
      imposte_parametri = jsonb_build_object(
        'aliquota_ires', imp.aliquota_ires,
        'aliquota_irap', imp.aliquota_irap,
        'maxideduzione_attiva', imp.maxideduzione_attiva,
        'deduzione_extra', imp.deduzione_extra,
        'confermati_da_laura', imp.confermati_da_laura,
        'avvertenza', imp.avvertenza
      )
    where id = p_scenario_id;
  else
    update scenari_proiezione set
      imposte_parametri = jsonb_build_object('avvertenza', r.avvertenza_imposte)
    where id = p_scenario_id;
  end if;

  update scenari_proiezione set
    bep_solo_sala      = r.bep_solo_sala,
    bep_con_accessorie = r.bep_con_accessorie,
    imponibile         = r.imponibile,
    imposte            = r.imposte,
    utile_netto        = r.utile_netto,
    congelato_il       = now()
  where id = p_scenario_id;

  return (select congelato_il from scenari_proiezione where id = p_scenario_id);
end;
$function$;

comment on function congela_scenario is
  'Chiude una previsione: scrive i dodici mesi come sono oggi e poi la sigilla. Da li'' in poi i trigger rifiutano ogni modifica — una previsione ritoccabile dopo i fatti non e'' una previsione.';

revoke all on function congela_scenario(uuid) from public, anon, authenticated;
grant execute on function congela_scenario(uuid) to authenticated;

-- =====================================================================
-- 8. Verifica (§7 punti 1-3)
-- =====================================================================
-- ⚠️ I numeri qui sotto sono INVENTATI apposta e non hanno niente a che
-- vedere col piano di Alessio: il repository è pubblico. Sono scelti
-- perché il conto si possa rifare a mente.
do $verifica$
declare
  v_titolare uuid;
  v_staff    uuid;
  v_ente     uuid;
  v_id       uuid;
  v_dati     jsonb;
  r          record;
  x          record;
  n          integer;
  respinto   boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  -- ⚠️ Si lavora sulla SECONDA entita', non sulla S.r.l.s.: cosi' la
  -- verifica puo' creare e togliere i parametri fiscali senza avvicinarsi
  -- a quelli veri di Alessio, e prova gli stessi due casi tanto in
  -- produzione (dove la S.r.l.s. i parametri ce li ha) quanto sul
  -- progetto di prova (dove non li ha nessuno).
  select id into v_ente from entities where entity_type <> 'srls' limit 1;
  if v_titolare is null or v_staff is null or v_ente is null then
    raise exception 'Servono due entita'', titolare e staff per questa verifica.';
  end if;
  if exists (select 1 from fiscal_settings where entity_id = v_ente) then
    raise exception 'La seconda entita'' ha gia'' dei parametri fiscali: la verifica non li tocca.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- Uno scenario minimo: 10 giorni al mese, 10 coperti al giorno, tutti
  -- feriali. Scontrino 50 (40 food + 10 beverage), food cost 25%,
  -- beverage cost 50%, niente lavanderia: costo variabile 15 a coperto.
  -- Un solo costo fisso da 1.000 al mese. Niente personale, niente extra,
  -- niente accessorie, niente POS.
  v_dati := jsonb_build_object(
    'entity_id', v_ente, 'nome', '__PROVA SCENARIO__', 'tipo', 'riproiezione', 'anno', 2099,
    'parametri', jsonb_build_object(
      'scontrinoFood', 40, 'scontrinoBeverage', 10,
      'foodCostPercento', 0.25, 'beverageCostPercento', 0.5,
      'lavanderiaCoperto', 0, 'pagamentiElettroniciPercento', 0,
      'commissionePosPercento', 0, 'oreGiorno', 8, 'pressionePersonale', 0,
      'ammortamentiAnnui', 1200, 'finanziamentoImporto', 0,
      'finanziamentoTasso', 0, 'finanziamentoAnni', 0
    ),
    'personale', '[]'::jsonb,
    'extra', '[]'::jsonb,
    'costiFissi', jsonb_build_array(jsonb_build_object('voce', 'Affitto', 'euroMese', 1000)),
    'accessorie', '[]'::jsonb,
    'mesi', (select jsonb_agg(jsonb_build_object(
        'mese', g, 'serviziSettimana', 3, 'giorniLavorativi', 10, 'giorniPeak', 0,
        'copertiPeak', 0, 'copertiFeriali', 10, 'eventiPremium', 0))
      from generate_series(1, 12) g)
  );

  v_id := crea_scenario_proiezione(v_dati);

  -- Il calcolo, rifatto a mente: 100 coperti al mese, 5.000 di ricavi,
  -- 1.500 di costi variabili, 3.500 di margine, 1.000 di fissi →
  -- 2.500 di EBITDA al mese, 100 di ammortamenti → 2.400 di EBIT.
  select * into x from proiezione_scenario(v_id) where mese = 1;
  if x.coperti <> 100    then raise exception 'Coperti attesi 100, trovati %', x.coperti; end if;
  if x.ricavi_sala <> 5000 then raise exception 'Ricavi attesi 5.000, trovati %', x.ricavi_sala; end if;
  if x.costi_variabili <> 1500 then raise exception 'Costi variabili attesi 1.500, trovati %', x.costi_variabili; end if;
  if x.ebitda <> 2500 then raise exception 'EBITDA atteso 2.500, trovato %', x.ebitda; end if;
  if x.ammortamenti <> 100 then raise exception 'Ammortamenti attesi 100, trovati %', x.ammortamenti; end if;
  if x.ebit <> 2400 then raise exception 'EBIT atteso 2.400, trovato %', x.ebit; end if;

  select count(*) into n from proiezione_scenario(v_id);
  if n <> 12 then raise exception 'La previsione ha % mesi invece di 12.', n; end if;

  -- Il pareggio: 12.000 di fissi all'anno diviso 35 di margine per
  -- coperto = 342,86 → 343 coperti, arrotondati PER ECCESSO (con 342 non
  -- si pareggia).
  select * into r from riepilogo_scenario(v_id);
  if r.bep_solo_sala <> 343 then
    raise exception 'Pareggio atteso 343 coperti, trovato %', r.bep_solo_sala;
  end if;
  if r.ebitda <> 30000 then raise exception 'EBITDA annuo atteso 30.000, trovato %', r.ebitda; end if;
  if r.ante_imposte <> 28800 then
    raise exception 'Ante imposte atteso 28.800, trovato %', r.ante_imposte;
  end if;
  if r.avvertenza_imposte is null or r.avvertenza_imposte = '' then
    raise exception 'Il riepilogo non porta con se'' l''avvertenza sulle imposte.';
  end if;

  -- ⚠️ SENZA PARAMETRI FISCALI le imposte devono restare VUOTE, non zero:
  -- uno zero a schermo si legge «non pago niente», ed e' la stessa forma
  -- dell'elenco allergeni vuoto e dello scarto a zero. Il resto della
  -- previsione deve invece esserci tutto.
  if r.imposte is not null or r.utile_netto is not null then
    raise exception 'Senza parametri fiscali sono uscite comunque delle imposte (% e %).',
      r.imposte, r.utile_netto;
  end if;
  if r.avvertenza_imposte not like '%parametri fiscali%' then
    raise exception 'Le imposte mancano ma la schermata non saprebbe dire perche'': «%»', r.avvertenza_imposte;
  end if;
  if r.ebitda <> 30000 then
    raise exception 'Senza parametri fiscali si e'' perso anche l''EBITDA.';
  end if;

  -- E con i parametri, il conto torna a mano: 28.800 di imponibile,
  -- 24%% di IRES = 6.912, 3,9%% di IRAP = 1.123,20.
  insert into fiscal_settings (entity_id, ires_rate, irap_rate) values (v_ente, 24, 3.9);
  select * into r from riepilogo_scenario(v_id);
  if r.imposte <> 8035.20 then
    raise exception 'Imposte attese 8.035,20, trovate %', r.imposte;
  end if;
  if r.utile_netto <> 20764.80 then
    raise exception 'Utile netto atteso 20.764,80, trovato %', r.utile_netto;
  end if;

  -- ⚠️ Senza linee accessorie i due pareggi devono COINCIDERE: se
  -- differissero, il secondo starebbe sottraendo un margine che non c'e'.
  if r.bep_con_accessorie <> r.bep_solo_sala then
    raise exception 'Senza accessorie i due pareggi differiscono: % e %',
      r.bep_solo_sala, r.bep_con_accessorie;
  end if;

  -- Finche' e' aperta, si modifica.
  update scenari_proiezione set note = 'ancora aperta' where id = v_id;
  update scenario_mesi set coperti_feriali = 11 where scenario_id = v_id and mese = 1;
  select * into x from proiezione_scenario(v_id) where mese = 1;
  if x.coperti <> 110 then
    raise exception 'Una previsione aperta non ha recepito la modifica: % coperti', x.coperti;
  end if;
  update scenario_mesi set coperti_feriali = 10 where scenario_id = v_id and mese = 1;

  -- === IL CONGELAMENTO, che è ciò che verrà controllato ===
  perform congela_scenario(v_id);

  select count(*) into n from scenario_risultati where scenario_id = v_id;
  if n <> 12 then raise exception 'Il congelamento ha scritto % mesi invece di 12.', n; end if;

  respinto := false;
  begin
    update scenari_proiezione set note = 'ritoccata dopo' where id = v_id;
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then raise exception 'Una previsione congelata si e'' lasciata modificare.'; end if;

  respinto := false;
  begin
    update scenario_mesi set coperti_feriali = 99 where scenario_id = v_id and mese = 1;
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then raise exception 'Le righe di una previsione congelata si sono lasciate modificare.'; end if;

  respinto := false;
  begin
    update scenario_risultati set ebitda = 999999 where scenario_id = v_id and mese = 1;
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then raise exception 'I risultati congelati si sono lasciati riscrivere.'; end if;

  respinto := false;
  begin
    delete from scenario_mesi where scenario_id = v_id and mese = 1;
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then raise exception 'Le righe di una previsione congelata si sono lasciate cancellare.'; end if;

  respinto := false;
  begin
    insert into scenario_costi_fissi (scenario_id, voce, euro_mese) values (v_id, 'aggiunto dopo', 10);
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then raise exception 'A una previsione congelata si e'' potuta aggiungere una voce.'; end if;

  respinto := false;
  begin
    update scenari_proiezione set congelato_il = null where id = v_id;
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then raise exception 'Una previsione congelata si e'' lasciata riaprire.'; end if;

  -- ⚠️ E il calcolo non deve piu' essere raggiungibile dall'esterno: se
  -- lo fosse, «congelato» vorrebbe dire solo «non lo tocca la schermata».
  if has_function_privilege('authenticated', 'calcola_proiezione(uuid)', 'execute') then
    raise exception 'Il calcolo grezzo e'' ancora chiamabile da un utente: il congelamento sarebbe aggirabile.';
  end if;

  -- ⚠️ L'aliquota del foglio non deve essere letta da NESSUN calcolo.
  -- Controllato leggendo il corpo delle funzioni, non sulla parola: e' lo
  -- stesso controllo che il 13/08 ha impedito di correggere un aiuto
  -- lasciando il chiamante com'era.
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('calcola_proiezione', 'riepilogo_calcolato', 'riepilogo_scenario', 'congela_scenario')
     and pg_get_functiondef(p.oid) like '%aliquota_foglio_informativa%';
  if n > 0 then
    raise exception 'Una funzione di calcolo legge l''aliquota del foglio: sarebbe un secondo motore fiscale.';
  end if;

  -- Lo staff non deve vedere niente di tutto questo, e deve riceverne un
  -- rifiuto invece di un elenco vuoto.
  --
  -- ⚠️ Qui si prova il PORTIERE della funzione, non la policy RLS: dentro
  -- una migrazione si gira come proprietario delle tabelle, e il
  -- proprietario la RLS la scavalca per costruzione. Provarla qui darebbe
  -- un verde che non vuol dire niente — «mai dichiarare verificata una
  -- RLS senza una riga che quell'utente non deve vedere» (§5 punto 2). La
  -- policy la prova `tests/app/proiezione.test.js`, che passa da
  -- PostgREST col token vero dello staff.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  respinto := false;
  begin
    perform * from proiezione_scenario(v_id);
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then raise exception 'Lo staff ha potuto leggere la Proiezione.'; end if;
  respinto := false;
  begin
    perform crea_scenario_proiezione(v_dati);
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then raise exception 'Lo staff ha potuto creare una previsione.'; end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- ⚠️ L'ULTIMA PROVA: il sigillo tiene anche contro chi ha scritto la
  -- migrazione. Nemmeno la pulizia di questa verifica riesce a passare
  -- dalla porta normale.
  respinto := false;
  begin
    delete from scenario_risultati where scenario_id = v_id;
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then raise exception 'I risultati congelati si sono lasciati cancellare.'; end if;

  respinto := false;
  begin
    delete from scenari_proiezione where id = v_id;
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then raise exception 'Una previsione congelata si e'' lasciata cancellare.'; end if;

  -- Per togliere di mezzo la prova bisogna spegnere i trigger, ed e'
  -- proprio questo a dimostrare che dall'applicazione non si passa.
  perform set_config('request.jwt.claims', null, true);
  alter table scenari_proiezione        disable trigger trg_scenario_congelato;
  alter table scenario_personale        disable trigger trg_righe_scenario_congelato_scenario_personale;
  alter table scenario_extra            disable trigger trg_righe_scenario_congelato_scenario_extra;
  alter table scenario_costi_fissi      disable trigger trg_righe_scenario_congelato_scenario_costi_fissi;
  alter table scenario_linee_accessorie disable trigger trg_righe_scenario_congelato_scenario_linee_accessorie;
  alter table scenario_mesi             disable trigger trg_righe_scenario_congelato_scenario_mesi;
  alter table scenario_risultati        disable trigger trg_righe_scenario_congelato_scenario_risultati;

  delete from scenari_proiezione where nome = '__PROVA SCENARIO__';

  alter table scenari_proiezione        enable trigger trg_scenario_congelato;
  alter table scenario_personale        enable trigger trg_righe_scenario_congelato_scenario_personale;
  alter table scenario_extra            enable trigger trg_righe_scenario_congelato_scenario_extra;
  alter table scenario_costi_fissi      enable trigger trg_righe_scenario_congelato_scenario_costi_fissi;
  alter table scenario_linee_accessorie enable trigger trg_righe_scenario_congelato_scenario_linee_accessorie;
  alter table scenario_mesi             enable trigger trg_righe_scenario_congelato_scenario_mesi;
  alter table scenario_risultati        enable trigger trg_righe_scenario_congelato_scenario_risultati;

  -- ⚠️ Riaccenderli va CONTROLLATO, non dato per fatto: lasciarne uno
  -- spento vorrebbe dire che da domani le previsioni congelate si
  -- possono ritoccare, e nessuno se ne accorgerebbe. È la lezione del
  -- trigger delle notifiche rimasto spento dopo un collaudo.
  select count(*) into n from pg_trigger
   where tgname in (
     'trg_scenario_congelato',
     'trg_righe_scenario_congelato_scenario_personale',
     'trg_righe_scenario_congelato_scenario_extra',
     'trg_righe_scenario_congelato_scenario_costi_fissi',
     'trg_righe_scenario_congelato_scenario_linee_accessorie',
     'trg_righe_scenario_congelato_scenario_mesi',
     'trg_righe_scenario_congelato_scenario_risultati')
     and tgenabled = 'D';
  if n > 0 then
    raise exception 'Sono rimasti % trigger del congelamento spenti.', n;
  end if;

  delete from fiscal_settings where entity_id = v_ente;

  select count(*) into n from scenari_proiezione where nome = '__PROVA SCENARIO__';
  if n <> 0 then raise exception 'La prova ha lasciato % previsioni nel database.', n; end if;
  select count(*) into n from scenario_risultati where scenario_id = v_id;
  if n <> 0 then raise exception 'La prova ha lasciato % mesi congelati nel database.', n; end if;
  if exists (select 1 from fiscal_settings where entity_id = v_ente) then
    raise exception 'La prova ha lasciato dei parametri fiscali sulla seconda entita''.';
  end if;

  raise notice 'Scenari: calcolo rifatto a mano, pareggio arrotondato per eccesso, e il congelamento respinge modifica, cancellazione, aggiunta e riapertura — anche da dentro il database.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260814000014', 'la_rotta_scenari_congelati')
on conflict (version) do nothing;

select
  (select count(*) from scenari_proiezione)                             as previsioni,
  (select count(*) from scenari_proiezione where congelato_il is not null) as congelate,
  (select count(*) from scenario_risultati)                             as mesi_fotografati;
