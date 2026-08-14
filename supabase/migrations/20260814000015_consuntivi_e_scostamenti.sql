-- ---------------------------------------------------------------------
-- I mesi veri: fotografati alla chiusura, e lo scostamento scomposto
-- ---------------------------------------------------------------------
-- Blocco 3, terzo pezzo. Dal mandato:
--
--   «Consuntivi mensili fotografati: alla chiusura del mese i numeri veri
--    si congelano com'erano — mai ricalcolati coi prezzi di dopo.»
--   «Scostamento scomposto, mai solo totale: "sotto di X" deve dire da
--    dove — coperti, scontrino medio, food cost, fissi.»
--
-- ⚠️ IL PRINCIPIO CHE GOVERNA TUTTO IL FILE: mai un numero vero e uno
-- presunto mescolati senza etichetta. Qui è più che una raccomandazione,
-- perché **oggi quasi niente è misurabile**: il Ricettario è vuoto (quindi
-- il food cost reale non esiste), il registratore telematico non c'è, il
-- costo del personale non passa da nessun modulo. Un consuntivo che
-- riempisse quei buchi con gli zeri direbbe che il mese è andato
-- benissimo. Quindi ogni numero porta con sé **da dove viene**, e ciò che
-- non si è potuto misurare resta **vuoto**, non zero.
--
-- ⚠️ SI CONFRONTA SALA CON SALA. La previsione contiene anche le linee
-- accessorie (lounge, chef table, barattoli, eventi), che oggi nessun
-- modulo misura. Confrontarle con un consuntivo fatto di soli conti di
-- sala produrrebbe uno scostamento negativo permanente, che nessuno
-- saprebbe spiegare e che dopo due mesi si smetterebbe di guardare.
--
-- Idempotente (§7 punto 3).

-- =====================================================================
-- 1. Un solo calcolo del totale di un conto
-- =====================================================================
-- ⚠️ Il totale di un conto era calcolato in DUE posti: `orderTotals()` per
-- le schermate e, da ieri, dentro `close_order_as_discount_gift` per il
-- registro sconti. Il consuntivo ne avrebbe voluto un terzo. «Tre
-- schermate che ricalcolano da sole finiscono per dire tre numeri
-- diversi»: qui si estrae il conto in una funzione e la chiusura del
-- tavolo comincia a usarla, invece di tenersene una copia.
create or replace function totale_conto(p_order_id uuid)
returns table (
  righe          numeric,
  coperti        integer,
  prezzo_coperto numeric,
  totale         numeric
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_order  orders%rowtype;
  v_righe  numeric;
  v_prezzo numeric;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Conto non trovato';
  end if;

  -- Su un conto gia' chiuso vale il prezzo fotografato allora, non quello
  -- di oggi: stesso principio di order_items.unit_price.
  v_prezzo := coalesce(
    v_order.coperto_unit_price,
    (select coperto_price from service_settings where id = 1),
    0
  );

  select coalesce(sum(quantity * unit_price), 0) into v_righe
    from order_items where order_id = p_order_id and voided_at is null;

  return query select
    v_righe,
    coalesce(v_order.coperti, 0),
    v_prezzo,
    v_righe + coalesce(v_order.coperti, 0) * v_prezzo;
end;
$function$;

comment on function totale_conto is
  'L''unico calcolo del totale di un conto lato database (14/08/2026). Le righe non annullate piu'' i coperti al prezzo fotografato sul conto. Chiusura del tavolo e consuntivo del mese chiamano questa.';

revoke all on function totale_conto(uuid) from public, anon, authenticated;
grant execute on function totale_conto(uuid) to authenticated;

-- La chiusura con sconto/omaggio ora chiede il totale, invece di
-- rifarselo. Il resto della funzione è identico a ieri: cambia solo da
-- dove arriva il numero.
create or replace function close_order_as_discount_gift(
  p_order_id uuid,
  p_is_gift boolean,
  p_collected_amount numeric default 0,
  p_expected_full_amount numeric default null,
  p_causale_id uuid default null,
  p_causale_note text default null,
  p_customer_id uuid default null,
  p_device_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_utente    uuid := auth.uid();
  v_order     orders%rowtype;
  v_conto     record;
  v_incassato numeric(12,2);
  v_dg_id     uuid;
  v_costo     record;
begin
  if v_utente is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_order from orders where id = p_order_id for update;

  if v_order.id is null then
    raise exception 'Conto non trovato';
  end if;

  if v_order.status <> 'aperto' then
    raise exception 'Questo conto e'' gia'' stato chiuso (stato: %). Ricaricare la schermata.', v_order.status;
  end if;

  -- ⚠️ La causale si controlla QUI, dopo il conto e prima di scrivere.
  -- L'ordine non è indifferente: prima si dice se la cosa di cui si parla
  -- esiste, poi se i dati sono completi (14/08/2026).
  if p_causale_id is null then
    raise exception 'Scegli perché: uno sconto o un omaggio senza causale, fra un anno, è un numero che nessuno sa spiegare.';
  end if;
  if not exists (select 1 from cash_causali
                  where id = p_causale_id and kind = 'sconto_omaggio' and active) then
    raise exception 'Quella causale non è più fra quelle degli sconti e omaggi: ricarica la schermata.';
  end if;

  select * into v_conto from totale_conto(p_order_id);

  if p_expected_full_amount is not null
     and abs(p_expected_full_amount - v_conto.totale) > 0.01 then
    raise exception 'Il totale e'' cambiato mentre chiudevi il conto (a schermo %, ora %). Ricarica e riprova.',
      p_expected_full_amount, v_conto.totale;
  end if;

  if p_is_gift then
    v_incassato := 0;
  else
    v_incassato := coalesce(p_collected_amount, 0);
    if v_incassato < 0 then
      raise exception 'L''importo incassato non puo'' essere negativo';
    end if;
    if v_incassato > v_conto.totale then
      raise exception 'L''importo incassato (%) non puo'' superare il totale del conto (%)', v_incassato, v_conto.totale;
    end if;
  end if;

  -- Quanto e' costato, adesso e non domani.
  select * into v_costo from costo_ingredienti_conto(p_order_id);

  insert into discounts_gifts (
    entity_id, type, full_amount, collected_amount,
    causale_id, causale_note, customer_id, device_id, note, created_by,
    costo_ingredienti, righe_valorizzate, righe_senza_costo
  ) values (
    v_order.entity_id,
    case when p_is_gift then 'omaggio' else 'sconto' end::discount_gift_type,
    v_conto.totale,
    v_incassato,
    p_causale_id, p_causale_note, p_customer_id, p_device_id, p_note, v_utente,
    v_costo.costo, coalesce(v_costo.valorizzate, 0), coalesce(v_costo.senza_costo, 0)
  )
  returning id into v_dg_id;

  update orders set
    status             = case when p_is_gift then 'omaggiato' else 'chiuso' end::order_status,
    discount_gift_id   = v_dg_id,
    coperto_unit_price = v_conto.prezzo_coperto,
    closed_at          = now()
  where id = p_order_id;

  -- La merce e' uscita dalla cella anche se il conto non ha incassato.
  perform scarica_magazzino_conto(p_order_id);

  return v_dg_id;
end;
$function$;

revoke all on function close_order_as_discount_gift(uuid, boolean, numeric, numeric, uuid, text, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function close_order_as_discount_gift(uuid, boolean, numeric, numeric, uuid, text, uuid, uuid, text)
  to authenticated;

-- =====================================================================
-- 2. Quali uscite sono «costi fissi»: lo dice lui, non un indovinello
-- =====================================================================
-- ⚠️ Lo scostamento deve confrontare i costi fissi previsti coi costi
-- fissi veri, e i costi fissi veri stanno in prima nota mescolati alla
-- spesa alimentare. Dedurre quali siano dall'etichetta della causale
-- («Utenze sì, Spesa alimentare no») sarebbe una regola scritta da me
-- sulle sue parole: il giorno che ne aggiunge una nuova, finirebbe dalla
-- parte sbagliata in silenzio. Le causali sono dati suoi (14/08), quindi
-- la casella la spunta lui — e finché non ne spunta nessuna il consuntivo
-- dichiara che i fissi non li ha misurati, invece di dire zero.
alter table cash_causali
  add column if not exists conta_nei_fissi boolean not null default false;

comment on column cash_causali.conta_nei_fissi is
  'Se le uscite con questa causale sono costi fissi, per lo scostamento della Proiezione. Nasce spenta: nessuna causale entra nei fissi finche'' non lo decide Alessio.';

-- =====================================================================
-- 3. Il consuntivo del mese, fotografato
-- =====================================================================
create table if not exists consuntivi_mensili (
  id                 uuid primary key default gen_random_uuid(),
  entity_id          uuid not null references entities(id) on delete restrict,
  anno               integer  not null,
  mese               smallint not null check (mese between 1 and 12),
  chiuso_il          timestamptz not null default now(),
  chiuso_da          uuid,
  -- I numeri: VUOTI quando non si sono potuti misurare, mai zero.
  coperti            numeric,
  ricavi             numeric,
  food_cost          numeric,
  fissi              numeric,
  omaggi_costo       numeric,
  omaggi_quanti      integer,
  -- Da dove viene ognuno
  origine_coperti    text not null check (origine_coperti   in ('misurato', 'assente')),
  origine_ricavi     text not null check (origine_ricavi    in ('misurato', 'assente')),
  origine_food_cost  text not null check (origine_food_cost in ('misurato', 'assente')),
  origine_fissi      text not null check (origine_fissi     in ('misurato', 'assente')),
  conti_chiusi       integer not null default 0,
  note               text,
  unique (entity_id, anno, mese)
);

comment on table consuntivi_mensili is
  'Il mese com''era il giorno in cui si e'' chiuso. Non si ricalcola: un consuntivo che cambia coi prezzi di dopo non e'' un consuntivo. Ogni numero dichiara se e'' stato misurato o se manca.';

-- Non si ricalcola: nessun `update`, mai.
create or replace function vieta_riscrittura_consuntivo()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  raise exception 'Un mese chiuso non si ricalcola. Se e'' sbagliato si cancella e si richiude: cosi'' resta scritto che e'' successo.';
end;
$function$;

-- Anche una funzione trigger nasce aperta al mondo (lezione dell'11/08):
-- l'elenco di chi puo' bussare da fuori non cresce in silenzio.
revoke all on function vieta_riscrittura_consuntivo() from public, anon, authenticated;

do $trigger$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_consuntivo_non_si_riscrive') then
    create trigger trg_consuntivo_non_si_riscrive
      before update on consuntivi_mensili
      for each row execute function vieta_riscrittura_consuntivo();
  end if;
  -- Cancellarlo si puo', ma resta la copia: e' una tabella di soldi.
  if not exists (select 1 from pg_trigger
                  where tgname = 'trg_log_delete' and tgrelid = 'consuntivi_mensili'::regclass) then
    create trigger trg_log_delete before delete on consuntivi_mensili
      for each row execute function log_deleted_record();
  end if;
end $trigger$;

-- I periodi che rendono un confronto bugiardo (§6 del mandato): servono
-- dal secondo anno, ma il posto dove scriverli esiste da subito — chi
-- apre a marzo non puo' aspettare marzo dell'anno dopo per accorgersi
-- che avrebbe dovuto segnarselo.
create table if not exists periodi_anomali (
  id        uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete restrict,
  dal       date not null,
  al        date not null,
  tipo      text not null check (tipo in ('apertura', 'chiusura', 'lavori', 'altro')),
  nota      text,
  creato_il timestamptz not null default now(),
  constraint periodo_anomalo_ordinato check (al >= dal)
);

comment on table periodi_anomali is
  'Apertura, chiusure, lavori: i periodi in cui il confronto anno su anno non vale. Servono dal secondo anno, ma si segnano quando succedono — dopo non si ricostruiscono.';

do $rls$
declare t text;
begin
  foreach t in array array['consuntivi_mensili', 'periodi_anomali'] loop
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
-- 4. Cosa si è potuto misurare, di un mese
-- =====================================================================
create or replace function misure_del_mese(p_entity_id uuid, p_anno integer, p_mese integer)
returns table (
  coperti           numeric,
  ricavi            numeric,
  food_cost         numeric,
  fissi             numeric,
  omaggi_costo      numeric,
  omaggi_quanti     integer,
  conti_chiusi      integer,
  origine_coperti   text,
  origine_ricavi    text,
  origine_food_cost text,
  origine_fissi     text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_dal  date;
  v_al   date;
  v_cop  numeric;
  v_ric  numeric;
  v_fc   numeric;
  v_fis  numeric;
  v_conti integer;
  v_causali_marcate integer;
begin
  if not is_titolare() then
    raise exception 'I numeri del mese sono riservati al titolare.';
  end if;

  v_dal := make_date(p_anno, p_mese, 1);
  v_al  := (v_dal + interval '1 month')::date;

  -- I conti chiusi del mese: pagati e omaggiati. Un conto annullato non
  -- e' un mese andato male, e' un tavolo che non ha mangiato.
  select count(*) into v_conti
    from orders o
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and o.closed_at >= v_dal and o.closed_at < v_al;

  select coalesce(sum(o.coperti), 0) into v_cop
    from orders o
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and o.closed_at >= v_dal and o.closed_at < v_al;

  -- ⚠️ I ricavi sono quello che e' stato INCASSATO, non quello che il
  -- conto valeva: un omaggio vale come il piatto ma incassa zero, e uno
  -- sconto incassa meno. Prenderne il valore pieno gonfierebbe i ricavi
  -- proprio nei mesi in cui si e' regalato di piu'.
  select coalesce(sum(
           case
             when o.discount_gift_id is not null
               then coalesce((select dg.collected_amount from discounts_gifts dg where dg.id = o.discount_gift_id), 0)
             else (select t.totale from totale_conto(o.id) t)
           end), 0)
    into v_ric
    from orders o
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and o.closed_at >= v_dal and o.closed_at < v_al;

  -- Il food cost vero: quanto e' costata la merce uscita dalla cella per
  -- quei conti. Con il Ricettario vuoto questo resta zero, ed e' proprio
  -- il caso in cui non va scritto zero.
  select coalesce(sum(sc.costo), 0) into v_fc
    from stock_consumptions sc
    join orders o on o.id = sc.order_id
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and o.closed_at >= v_dal and o.closed_at < v_al;

  select count(*) into v_causali_marcate from cash_causali where conta_nei_fissi and active;
  select coalesce(sum(cm.amount), 0) into v_fis
    from cash_movements cm
    join cash_causali cc on cc.id = cm.causale_id
   where cm.entity_id = p_entity_id
     and cm.direction = 'uscita'
     and cc.conta_nei_fissi
     and cm.movement_date >= v_dal and cm.movement_date < v_al;

  return query select
    case when v_conti > 0 then v_cop end,
    case when v_conti > 0 then v_ric end,
    case when v_fc > 0 then v_fc end,
    case when v_causali_marcate > 0 then v_fis end,
    coalesce((select sum(dg.costo_ingredienti) from discounts_gifts dg
               where dg.entity_id = p_entity_id and dg.type = 'omaggio'
                 and dg.movement_date >= v_dal and dg.movement_date < v_al), 0),
    coalesce((select count(*)::integer from discounts_gifts dg
               where dg.entity_id = p_entity_id and dg.type = 'omaggio'
                 and dg.movement_date >= v_dal and dg.movement_date < v_al), 0),
    v_conti,
    case when v_conti > 0 then 'misurato' else 'assente' end,
    case when v_conti > 0 then 'misurato' else 'assente' end,
    case when v_fc > 0   then 'misurato' else 'assente' end,
    case when v_causali_marcate > 0 then 'misurato' else 'assente' end;
end;
$function$;

revoke all on function misure_del_mese(uuid, integer, integer) from public, anon, authenticated;
grant execute on function misure_del_mese(uuid, integer, integer) to authenticated;

create or replace function chiudi_mese(p_entity_id uuid, p_anno integer, p_mese integer, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  m    record;
  v_id uuid;
begin
  if not is_titolare() then
    raise exception 'Chiudere un mese e'' riservato al titolare.';
  end if;

  -- ⚠️ Un mese si chiude quando e' finito. Chiuderlo prima significa
  -- fotografare meta' mese e chiamarlo consuntivo — e quella foto poi
  -- non si puo' piu' rifare.
  if make_date(p_anno, p_mese, 1) + interval '1 month' > now() then
    raise exception 'Il % non e'' ancora finito: un consuntivo si scrive a mese chiuso, e non si potrebbe piu'' rifare.',
      to_char(make_date(p_anno, p_mese, 1), 'MM/YYYY');
  end if;

  if exists (select 1 from consuntivi_mensili
              where entity_id = p_entity_id and anno = p_anno and mese = p_mese) then
    raise exception 'Il % e'' gia'' stato chiuso.', to_char(make_date(p_anno, p_mese, 1), 'MM/YYYY');
  end if;

  select * into m from misure_del_mese(p_entity_id, p_anno, p_mese);

  insert into consuntivi_mensili (
    entity_id, anno, mese, chiuso_da,
    coperti, ricavi, food_cost, fissi, omaggi_costo, omaggi_quanti, conti_chiusi,
    origine_coperti, origine_ricavi, origine_food_cost, origine_fissi, note
  ) values (
    p_entity_id, p_anno, p_mese, auth.uid(),
    m.coperti, m.ricavi, m.food_cost, m.fissi, m.omaggi_costo, m.omaggi_quanti, m.conti_chiusi,
    m.origine_coperti, m.origine_ricavi, m.origine_food_cost, m.origine_fissi, p_note
  ) returning id into v_id;

  return v_id;
end;
$function$;

comment on function chiudi_mese is
  'Fotografa il mese finito. Una sola tabella, quindi niente corridoio: e'' il calcolo che tocca mezzo gestionale, non la scrittura.';

revoke all on function chiudi_mese(uuid, integer, integer, text) from public, anon, authenticated;
grant execute on function chiudi_mese(uuid, integer, integer, text) to authenticated;

-- =====================================================================
-- 5. Lo scostamento, scomposto
-- =====================================================================
-- ⚠️ «Sotto di X» non serve a niente: quello che serve e' sapere se sono
-- entrate meno persone, se hanno speso meno a testa, se e' costato di
-- piu' quello che si e' cucinato, o se sono cresciuti i fissi — perche'
-- le quattro cose si correggono in quattro modi diversi.
create or replace function scostamento_mensile(
  p_entity_id uuid,
  p_anno integer,
  p_mese integer,
  p_scenario_id uuid
)
returns table (
  voce        text,
  previsto    numeric,
  reale       numeric,
  scostamento numeric,
  misurato    boolean,
  spiegazione text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  p            record;   -- il mese previsto
  c            record;   -- il mese vero
  v_quota      numeric := 1;
  v_parziale   boolean := false;
  v_giorni_mese integer;
  v_trascorsi  integer;
  v_cop_p      numeric;
  v_ric_p      numeric;
  v_fc_p       numeric;
  v_fis_p      numeric;
  v_scontr_p   numeric;
  v_scontr_r   numeric;
begin
  if not is_titolare() then
    raise exception 'La Proiezione e'' riservata al titolare.';
  end if;

  select * into p from proiezione_scenario(p_scenario_id) where mese = p_mese;
  if p.mese is null then
    raise exception 'Questa previsione non ha il mese %.', p_mese;
  end if;

  -- Il mese in corso si confronta rapportato ai giorni trascorsi, e si
  -- dichiara parziale: senza, ogni mese risulterebbe sotto fino al 31.
  v_giorni_mese := extract(day from (make_date(p_anno, p_mese, 1) + interval '1 month - 1 day'))::integer;
  if make_date(p_anno, p_mese, 1) + interval '1 month' > now() then
    v_parziale  := true;
    v_trascorsi := least(greatest(extract(day from now())::integer, 0), v_giorni_mese);
    if make_date(p_anno, p_mese, 1) > now() then v_trascorsi := 0; end if;
    v_quota := v_trascorsi::numeric / v_giorni_mese;
  end if;

  select * into c from consuntivi_mensili
   where entity_id = p_entity_id and anno = p_anno and mese = p_mese;

  -- Mese non ancora chiuso: si guardano le misure dal vivo.
  if c.id is null then
    select null::uuid as id, m.coperti, m.ricavi, m.food_cost, m.fissi,
           m.origine_coperti, m.origine_ricavi, m.origine_food_cost, m.origine_fissi
      into c
      from misure_del_mese(p_entity_id, p_anno, p_mese) m;
  end if;

  v_cop_p := round(p.coperti * v_quota, 2);
  v_ric_p := round(p.ricavi_sala * v_quota, 2);
  v_fc_p  := round(p.costi_variabili * v_quota, 2);
  v_fis_p := round(p.costi_fissi_totali * v_quota, 2);

  v_scontr_p := case when v_cop_p > 0 then round(v_ric_p / v_cop_p, 2) end;
  v_scontr_r := case when coalesce(c.coperti, 0) > 0 then round(c.ricavi / c.coperti, 2) end;

  return query values
    ('Coperti', v_cop_p, c.coperti,
     case when c.coperti is null then null else round(
       (c.coperti - v_cop_p) * coalesce(v_scontr_p, 0), 2) end,
     c.origine_coperti = 'misurato',
     'Quanto pesa, sui ricavi, aver avuto piu'' o meno persone del previsto.'),

    ('Scontrino medio', v_scontr_p, v_scontr_r,
     case when v_scontr_r is null or v_scontr_p is null then null else round(
       (v_scontr_r - v_scontr_p) * c.coperti, 2) end,
     c.origine_ricavi = 'misurato',
     'Quanto pesa aver speso di piu'' o di meno a testa, a parita'' di persone.'),

    ('Food cost', v_fc_p, c.food_cost,
     case when c.food_cost is null then null else round(-(c.food_cost - v_fc_p), 2) end,
     c.origine_food_cost = 'misurato',
     'Quanto e'' costata davvero la merce uscita dalla cella, contro quanto era previsto.'),

    ('Costi fissi', v_fis_p, c.fissi,
     case when c.fissi is null then null else round(-(c.fissi - v_fis_p), 2) end,
     c.origine_fissi = 'misurato',
     'Affitto, utenze e tutto cio'' che non dipende da quanta gente entra.')
  ;
end;
$function$;

revoke all on function scostamento_mensile(uuid, integer, integer, uuid) from public, anon, authenticated;
grant execute on function scostamento_mensile(uuid, integer, integer, uuid) to authenticated;

-- Quanto del mese è confrontabile davvero, e se è una fotografia parziale.
create or replace function stato_confronto_mensile(p_entity_id uuid, p_anno integer, p_mese integer)
returns table (
  parziale         boolean,
  giorni_trascorsi integer,
  giorni_mese      integer,
  mese_chiuso      boolean,
  periodo_anomalo  text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_giorni integer;
  v_dal    date;
begin
  if not is_titolare() then
    raise exception 'La Proiezione e'' riservata al titolare.';
  end if;

  v_dal    := make_date(p_anno, p_mese, 1);
  v_giorni := extract(day from (v_dal + interval '1 month - 1 day'))::integer;

  return query select
    (v_dal + interval '1 month' > now()),
    case
      when v_dal > now() then 0
      when v_dal + interval '1 month' <= now() then v_giorni
      else least(extract(day from now())::integer, v_giorni)
    end,
    v_giorni,
    exists (select 1 from consuntivi_mensili
             where entity_id = p_entity_id and anno = p_anno and mese = p_mese),
    (select string_agg(distinct pa.tipo, ', ') from periodi_anomali pa
      where pa.entity_id = p_entity_id
        and pa.dal < (v_dal + interval '1 month') and pa.al >= v_dal);
end;
$function$;

revoke all on function stato_confronto_mensile(uuid, integer, integer) from public, anon, authenticated;
grant execute on function stato_confronto_mensile(uuid, integer, integer) to authenticated;

-- =====================================================================
-- 6. Il budget degli omaggi
-- =====================================================================
-- Dal mandato: «margine sopra il pareggio del mese ÷ costo reale per
-- coperto = quanti omaggi puoi ancora permetterti restando in pari».
--
-- ⚠️ È il punto in cui la causale obbligatoria di ieri serve a qualcosa:
-- «cortesia» è un investimento che decide lui, «recupero disservizio» è
-- un costo che dice che qualcosa non ha funzionato. Sommati sono un
-- numero che non si sa spiegare.
create or replace function budget_omaggi(
  p_entity_id uuid,
  p_anno integer,
  p_mese integer,
  p_scenario_id uuid
)
returns table (
  margine_disponibile numeric,
  costo_per_coperto   numeric,
  omaggi_possibili    integer,
  omaggi_fatti        integer,
  costo_omaggi_fatti  numeric,
  misurato            boolean,
  avvertenza          text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  p        record;
  m        record;
  v_costo  numeric;
  v_mis    boolean;
  v_marg   numeric;
begin
  if not is_titolare() then
    raise exception 'La Proiezione e'' riservata al titolare.';
  end if;

  select * into p from proiezione_scenario(p_scenario_id) where mese = p_mese;
  if p.mese is null then
    raise exception 'Questa previsione non ha il mese %.', p_mese;
  end if;
  select * into m from misure_del_mese(p_entity_id, p_anno, p_mese);

  -- Il costo di un coperto: quello VERO se la cella lo sa dire, altrimenti
  -- quello previsto — e in quel caso si dichiara.
  if m.origine_food_cost = 'misurato' and coalesce(m.coperti, 0) > 0 then
    v_costo := round(m.food_cost / m.coperti, 2);
    v_mis   := true;
  elsif p.coperti > 0 then
    v_costo := round(p.costi_variabili / p.coperti, 2);
    v_mis   := false;
  else
    v_costo := null;
    v_mis   := false;
  end if;

  -- Il margine sopra il pareggio del mese: l'EBITDA di sala previsto,
  -- sostituito da quello vero appena c'e'.
  v_marg := greatest(p.ebitda_sala, 0);

  return query select
    v_marg,
    v_costo,
    case when coalesce(v_costo, 0) > 0 then floor(v_marg / v_costo)::integer else null end,
    m.omaggi_quanti,
    m.omaggi_costo,
    v_mis,
    case
      when v_costo is null then
        'Non c''e'' ancora modo di sapere quanto costa un coperto: serve almeno un mese con dei conti chiusi.'
      when v_mis then
        'Costo per coperto MISURATO, dalla merce uscita davvero dalla cella.'
      else
        'Costo per coperto PREVISTO, preso dal piano: il Ricettario non ha ancora abbastanza dati per misurarlo. Il numero e'' un ordine di grandezza, non una misura.'
    end;
end;
$function$;

revoke all on function budget_omaggi(uuid, integer, integer, uuid) from public, anon, authenticated;
grant execute on function budget_omaggi(uuid, integer, integer, uuid) to authenticated;

create or replace function omaggi_per_causale(p_entity_id uuid, p_anno integer, p_mese integer)
returns table (causale text, quanti integer, costo numeric)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare v_dal date;
begin
  if not is_titolare() then
    raise exception 'Il registro degli omaggi e'' riservato al titolare.';
  end if;
  v_dal := make_date(p_anno, p_mese, 1);

  return query
  select cc.label, count(*)::integer, coalesce(sum(dg.costo_ingredienti), 0)
    from discounts_gifts dg
    join cash_causali cc on cc.id = dg.causale_id
   where dg.entity_id = p_entity_id
     and dg.movement_date >= v_dal
     and dg.movement_date < (v_dal + interval '1 month')
   group by cc.label
   order by 3 desc;
end;
$function$;

revoke all on function omaggi_per_causale(uuid, integer, integer) from public, anon, authenticated;
grant execute on function omaggi_per_causale(uuid, integer, integer) to authenticated;

-- =====================================================================
-- 7. Verifica (§7 punti 1-3)
-- =====================================================================
do $verifica$
declare
  v_titolare uuid;
  v_staff    uuid;
  v_srls     uuid;
  v_altra    uuid;
  v_conto    uuid;
  v_causale  uuid;
  v_scen     uuid;
  v_cons     uuid;
  v_anno     integer;
  v_mese     integer;
  r          record;
  m          record;
  n          integer;
  respinto   boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  select id into v_srls  from entities where entity_type = 'srls';
  select id into v_altra from entities where entity_type <> 'srls' limit 1;
  if v_titolare is null or v_staff is null or v_srls is null or v_altra is null then
    raise exception 'Servono due entita'', titolare e staff per questa verifica.';
  end if;

  -- Un mese sicuramente finito, e sicuramente non ancora chiuso da nessuno.
  v_anno := 2001; v_mese := 3;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- --- Il totale del conto: un solo calcolo, e la sala lo usa ---
  -- ⚠️ Si legge il CORPO della funzione di chiusura: si potrebbe estrarre
  -- l'aiuto e lasciare il chiamante com'era, e la migrazione passerebbe
  -- col difetto vivo. È il controllo che il 13/08 ha salvato il freno dei
  -- rincari.
  if (select pg_get_functiondef(p.oid) from pg_proc p
        join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'close_order_as_discount_gift')
     not like '%totale_conto(%' then
    raise exception 'La chiusura del tavolo non usa il calcolo unico del conto: ne ha ancora una copia sua.';
  end if;

  select id into v_causale from cash_causali
   where kind = 'sconto_omaggio' and active order by label limit 1;
  if v_causale is null then
    raise exception 'Non c''e'' nessuna causale di sconto/omaggio: la verifica non puo'' girare.';
  end if;

  -- Un conto vero, chiuso dallo STAFF come farebbe in sala.
  insert into orders (entity_id, table_label, status, coperti, coperto_unit_price)
  values (v_srls, '__PROVA CONSUNTIVO__', 'aperto', 4, 5.00)
  returning id into v_conto;
  insert into order_items (order_id, quantity, unit_price, free_text_name, destination)
  values (v_conto, 2, 10.00, 'Piatto di prova', 'cucina');

  select * into r from totale_conto(v_conto);
  if r.totale <> 40.00 then
    raise exception 'Totale atteso 40,00 (2x10 + 4x5), trovato %', r.totale;
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  -- «Alla romana»: incassa meno del totale, la differenza e' uno sconto.
  perform close_order_as_discount_gift(v_conto, false, 36.00, 40.00, v_causale, 'Alla romana: 4 x 9,00');
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select full_amount, collected_amount into r from discounts_gifts
   where causale_note = 'Alla romana: 4 x 9,00';
  if r.full_amount <> 40.00 or r.collected_amount <> 36.00 then
    raise exception 'Lo sconto ha registrato % su % invece di 36 su 40.', r.collected_amount, r.full_amount;
  end if;
  if (select status from orders where id = v_conto) <> 'chiuso' then
    raise exception 'Il conto non risulta chiuso.';
  end if;

  -- La data di chiusura si sposta nel mese della prova, per misurarlo.
  update orders set closed_at = make_date(v_anno, v_mese, 15) where id = v_conto;
  update discounts_gifts set movement_date = make_date(v_anno, v_mese, 15)
   where causale_note = 'Alla romana: 4 x 9,00';

  -- --- Le misure del mese ---
  select * into m from misure_del_mese(v_srls, v_anno, v_mese);
  if m.conti_chiusi <> 1 then raise exception 'Conti chiusi attesi 1, trovati %', m.conti_chiusi; end if;
  if m.coperti <> 4 then raise exception 'Coperti attesi 4, trovati %', m.coperti; end if;
  -- ⚠️ I ricavi sono l'INCASSATO (36), non il valore del conto (40).
  if m.ricavi <> 36.00 then
    raise exception 'Ricavi attesi 36,00 (l''incassato, non il valore del conto), trovati %', m.ricavi;
  end if;
  -- ⚠️ E il food cost, che nessuno ha potuto misurare, deve essere VUOTO.
  if m.food_cost is not null then
    raise exception 'Senza ricette il food cost e'' uscito valorizzato (%): dovrebbe essere vuoto.', m.food_cost;
  end if;
  if m.origine_food_cost <> 'assente' then
    raise exception 'Il food cost non dichiara di essere assente.';
  end if;
  -- ⚠️ E i fissi: nessuna causale e' marcata, quindi VUOTI e non zero.
  if m.fissi is not null then
    raise exception 'Senza causali marcate i fissi sono usciti valorizzati (%).', m.fissi;
  end if;

  -- --- Il consuntivo si fotografa e non si riscrive ---
  v_cons := chiudi_mese(v_srls, v_anno, v_mese, 'prova');
  select * into r from consuntivi_mensili where id = v_cons;
  if r.ricavi <> 36.00 or r.coperti <> 4 then
    raise exception 'Il consuntivo ha fotografato % ricavi e % coperti.', r.ricavi, r.coperti;
  end if;
  if r.food_cost is not null or r.origine_food_cost <> 'assente' then
    raise exception 'Il consuntivo ha riempito il food cost che non c''era.';
  end if;

  respinto := false;
  begin
    update consuntivi_mensili set ricavi = 999 where id = v_cons;
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then raise exception 'Un mese chiuso si e'' lasciato ricalcolare.'; end if;

  respinto := false;
  begin
    perform chiudi_mese(v_srls, v_anno, v_mese);
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then raise exception 'Lo stesso mese si e'' lasciato chiudere due volte.'; end if;

  -- ⚠️ Un mese non finito non si chiude: la fotografia non si rifa'.
  respinto := false;
  begin
    perform chiudi_mese(v_srls, extract(year from now())::integer, extract(month from now())::integer);
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then raise exception 'Si e'' potuto chiudere il mese in corso.'; end if;

  -- --- Lo scostamento, scomposto ---
  -- Una previsione minima per quel mese: 10 coperti al giorno per 10
  -- giorni = 100 coperti, scontrino 50, costo variabile 15.
  v_scen := crea_scenario_proiezione(jsonb_build_object(
    'entity_id', v_srls, 'nome', '__PROVA SCOSTAMENTO__', 'tipo', 'riproiezione', 'anno', v_anno,
    'parametri', jsonb_build_object(
      'scontrinoFood', 40, 'scontrinoBeverage', 10,
      'foodCostPercento', 0.25, 'beverageCostPercento', 0.5,
      'lavanderiaCoperto', 0, 'pagamentiElettroniciPercento', 0,
      'commissionePosPercento', 0, 'oreGiorno', 8, 'pressionePersonale', 0,
      'ammortamentiAnnui', 0, 'finanziamentoImporto', 0,
      'finanziamentoTasso', 0, 'finanziamentoAnni', 0),
    'personale', '[]'::jsonb, 'extra', '[]'::jsonb,
    'costiFissi', jsonb_build_array(jsonb_build_object('voce', 'Affitto', 'euroMese', 1000)),
    'accessorie', '[]'::jsonb,
    'mesi', (select jsonb_agg(jsonb_build_object(
        'mese', g, 'serviziSettimana', 3, 'giorniLavorativi', 10, 'giorniPeak', 0,
        'copertiPeak', 0, 'copertiFeriali', 10, 'eventiPremium', 0))
      from generate_series(1, 12) g)));

  select count(*) into n from scostamento_mensile(v_srls, v_anno, v_mese, v_scen);
  if n <> 4 then raise exception 'Lo scostamento ha % voci invece di 4.', n; end if;

  -- Coperti: previsti 100, reali 4 → 96 in meno, a 50 di scontrino = -4.800.
  select * into r from scostamento_mensile(v_srls, v_anno, v_mese, v_scen) where voce = 'Coperti';
  if r.previsto <> 100 or r.reale <> 4 then
    raise exception 'Coperti: previsti % e reali %', r.previsto, r.reale;
  end if;
  if r.scostamento <> -4800.00 then
    raise exception 'L''effetto dei coperti atteso -4.800, trovato %', r.scostamento;
  end if;
  if not r.misurato then raise exception 'I coperti risultano non misurati.'; end if;

  -- Scontrino: previsto 50, reale 36/4 = 9 → -41 su 4 coperti = -164.
  select * into r from scostamento_mensile(v_srls, v_anno, v_mese, v_scen) where voce = 'Scontrino medio';
  if r.reale <> 9.00 then raise exception 'Scontrino reale atteso 9,00, trovato %', r.reale; end if;
  if r.scostamento <> -164.00 then
    raise exception 'L''effetto dello scontrino atteso -164, trovato %', r.scostamento;
  end if;

  -- ⚠️ Food cost e fissi NON sono misurati: lo scostamento deve restare
  -- VUOTO e dichiararsi tale. Uno zero direbbe «in linea col piano».
  select * into r from scostamento_mensile(v_srls, v_anno, v_mese, v_scen) where voce = 'Food cost';
  if r.scostamento is not null or r.misurato then
    raise exception 'Il food cost non misurato ha prodotto uno scostamento di %', r.scostamento;
  end if;
  select * into r from scostamento_mensile(v_srls, v_anno, v_mese, v_scen) where voce = 'Costi fissi';
  if r.scostamento is not null or r.misurato then
    raise exception 'I fissi non misurati hanno prodotto uno scostamento di %', r.scostamento;
  end if;

  -- Il mese della prova e' finito da un pezzo: non parziale.
  select * into r from stato_confronto_mensile(v_srls, v_anno, v_mese);
  if r.parziale then raise exception 'Un mese del 2001 risulta ancora in corso.'; end if;
  if not r.mese_chiuso then raise exception 'Il mese risulta non chiuso dopo la chiusura.'; end if;
  -- E il mese in corso invece si', con la sua quota di giorni.
  select * into r from stato_confronto_mensile(v_srls,
    extract(year from now())::integer, extract(month from now())::integer);
  if not r.parziale then raise exception 'Il mese in corso non risulta parziale.'; end if;
  if r.giorni_trascorsi > r.giorni_mese or r.giorni_trascorsi < 1 then
    raise exception 'Giorni trascorsi fuori scala: % su %', r.giorni_trascorsi, r.giorni_mese;
  end if;

  -- --- Il budget degli omaggi ---
  select * into r from budget_omaggi(v_srls, v_anno, v_mese, v_scen);
  -- Costo per coperto PREVISTO (1.500 di costi variabili su 100 coperti = 15),
  -- e deve dichiararsi previsto.
  if r.costo_per_coperto <> 15.00 then
    raise exception 'Costo per coperto atteso 15,00, trovato %', r.costo_per_coperto;
  end if;
  if r.misurato then
    raise exception 'Il costo per coperto si dichiara misurato, ma il Ricettario e'' vuoto.';
  end if;
  if r.avvertenza not like '%PREVISTO%' then
    raise exception 'Il budget omaggi non dichiara che il costo e'' previsto: «%»', r.avvertenza;
  end if;
  -- 2.500 di EBITDA di sala previsto su 15 a coperto = 166 omaggi.
  if r.omaggi_possibili <> 166 then
    raise exception 'Omaggi possibili attesi 166, trovati %', r.omaggi_possibili;
  end if;

  -- --- Periodi anomali ---
  insert into periodi_anomali (entity_id, dal, al, tipo, nota)
  values (v_srls, make_date(v_anno, v_mese, 1), make_date(v_anno, v_mese, 20), 'lavori', 'prova');
  select * into r from stato_confronto_mensile(v_srls, v_anno, v_mese);
  if r.periodo_anomalo is null or r.periodo_anomalo not like '%lavori%' then
    raise exception 'Il mese non dichiara di essere stato un periodo anomalo.';
  end if;

  -- --- Lo staff ---
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  respinto := false;
  begin
    perform * from misure_del_mese(v_srls, v_anno, v_mese);
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then raise exception 'Lo staff ha potuto leggere i numeri del mese.'; end if;
  respinto := false;
  begin
    perform chiudi_mese(v_srls, 2001, 4);
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then raise exception 'Lo staff ha potuto chiudere un mese.'; end if;

  -- --- Pulizia ---
  perform set_config('request.jwt.claims', null, true);
  delete from periodi_anomali where nota = 'prova';
  delete from consuntivi_mensili where anno = v_anno and mese = v_mese;
  delete from scenari_proiezione where nome = '__PROVA SCOSTAMENTO__';
  delete from discounts_gifts where causale_note = 'Alla romana: 4 x 9,00';
  delete from stock_consumptions where order_id = v_conto;
  delete from anomalie_scarico where order_id = v_conto;
  delete from order_items where order_id = v_conto;
  delete from orders where id = v_conto;
  -- La copia della cancellazione del consuntivo non serve a nessuno: era
  -- una prova, e lasciarla vorrebbe dire una riga finta in un registro
  -- che serve a ricostruire i fatti veri.
  delete from deleted_records where table_name = 'consuntivi_mensili'
    and (record ->> 'note') = 'prova';

  select count(*) into n from orders where table_label = '__PROVA CONSUNTIVO__';
  if n <> 0 then raise exception 'La prova ha lasciato % conti.', n; end if;
  select count(*) into n from consuntivi_mensili;
  if n <> 0 then raise exception 'La prova ha lasciato % consuntivi.', n; end if;
  select count(*) into n from scenari_proiezione where nome = '__PROVA SCOSTAMENTO__';
  if n <> 0 then raise exception 'La prova ha lasciato % previsioni.', n; end if;
  select count(*) into n from periodi_anomali where nota = 'prova';
  if n <> 0 then raise exception 'La prova ha lasciato % periodi anomali.', n; end if;

  raise notice 'Consuntivi: un solo calcolo del conto (e la sala lo usa), ricavi = incassato, buchi dichiarati vuoti e non zero, mese chiuso non riscrivibile, scostamento scomposto in quattro voci col conto rifatto a mano.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260814000015', 'consuntivi_e_scostamenti')
on conflict (version) do nothing;

select
  (select count(*) from consuntivi_mensili)                          as mesi_chiusi,
  (select count(*) from periodi_anomali)                             as periodi_anomali,
  (select count(*) from cash_causali where conta_nei_fissi and active) as causali_nei_fissi;
