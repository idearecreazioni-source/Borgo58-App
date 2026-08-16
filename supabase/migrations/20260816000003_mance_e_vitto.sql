-- ---------------------------------------------------------------------
-- Mance e vitto del personale — Blocco 5 del mandato
-- ---------------------------------------------------------------------
-- Due cose che si somigliano solo in superficie: **niente delle due è un
-- ricavo del locale**, e per motivi diversi.
--
-- =====================================================================
-- 1. LE MANCE SONO UNA PARTITA DI GIRO
-- =====================================================================
-- Non sono ricavi né costi della società: sono redditi di lavoro dei
-- collaboratori, e per l'azienda un **debito verso il personale** finché
-- non vengono distribuite.
--
-- Il modulo Mance esiste dal 02/08 e sa già raccogliere e distribuire.
-- Quello che mancava è **dove sono quei soldi**, ed è il punto che il
-- mandato chiama per nome: *«se il totale del POS è 1.510 € di cui 60 di
-- mance, i ricavi del giorno sono 1.450»*.
--
-- ⚠️ NEI RICAVI NON C'ERANO GIÀ, e va detto perché cambia cosa c'è da
-- fare. I ricavi si leggono dai conti chiusi (decisione del 15/08) e una
-- mancia non sta su nessun conto: `orderTotals()` somma piatti e coperti,
-- e la chiusura «alla romana» blocca la cifra al totale proprio perché gli
-- spicci in più sono mance (decisione del 09/08). Quindi il difetto non
-- era nei ricavi — era **nei saldi**.
--
-- ⚠️ IL DIFETTO VERO, in due punti:
--   · **Le mance in contanti stanno nel cassetto.** Il conteggio fisico
--     le trova, il saldo atteso no: ogni conteggio avrebbe mostrato
--     un'eccedenza cronica, e la differenza — che dal Blocco 6a genera un
--     movimento vero — avrebbe cominciato a correggere un errore che non
--     c'era.
--   · **Le mance su carta arrivano in banca insieme agli incassi.** Il
--     POS accredita 1.510 e il gestionale ne aspetta 1.450: il saldo banca
--     non tornerebbe **mai**, che è esattamente il motivo per cui il
--     mandato chiede la voce del POS «dal primo giorno».
--
-- Quindi: `mezzo` sulla raccolta E sulla distribuzione. Sulla
-- distribuzione perché senza si dovrebbe **indovinare** da quale forma
-- escono i soldi distribuiti, e un'ipotesi lì dentro sposterebbe il saldo
-- del cassetto senza che nessuno l'abbia deciso.
--
-- =====================================================================
-- 2. IL VITTO È FOOD COST CHE NON GENERA RICAVO
-- =====================================================================
-- La brigata mangia ogni giorno. Se lo scarico non lo distingue, quel cibo
-- gonfia il food cost dei piatti venduti e fa cercare un problema in
-- cucina che non esiste.
--
-- ⚠️ MEZZO PROBLEMA ERA GIÀ RISOLTO, e conviene saperlo invece di
-- ricostruirlo: il food cost del mese si calcola con un `join` su `orders`
-- (`consuntivi e scostamenti`, 14/08), quindi uno scarico **senza conto**
-- è già fuori dal food cost dei piatti venduti. La verifica qui sotto lo
-- controlla invece di darlo per scontato.
--
-- 🔴 QUELLO CHE INVECE NON FUNZIONAVA: `record_stock_consumption` scarica
-- i lotti col metodo FEFO ma **non registra il costo di quello che ha
-- tolto**. Un vitto senza costo non può essere «letto come costo del
-- personale», che è ciò che il mandato chiede — e la stessa cosa vale per
-- lo **spreco**, che da oggi diventa finalmente misurabile in euro.
--
-- ⚠️ Il costo si **fotografa adesso**, come per lo scarico automatico dei
-- conti e per il lotto di una produzione: fra sei mesi, coi prezzi
-- cambiati, non si ricostruisce.
--
-- ⚠️ IL VOCABOLARIO ERA GIÀ CHIUSO — la funzione rifiutava qualunque
-- motivo fuori da `consumo/spreco/rettifica` — e si allarga di uno solo.
-- Testo libero avrebbe prodotto «vitto», «Vitto personale» e «pasto
-- staff», cioè tre totali che non si sommano.
--
-- *(Il trattamento fiscale dei pasti al personale è il quesito L13 per la
-- commercialista. La causale si costruisce comunque: serve al food cost, e
-- quella parte non aspetta nessuno.)*
--
-- Idempotente (§7 punto 3), con blocco di verifica e auto-registrazione.
-- ---------------------------------------------------------------------

-- =====================================================================
-- Dove stanno le mance
-- =====================================================================
alter table tips_collected
  add column if not exists mezzo text not null default 'contanti'
    check (mezzo in ('contanti', 'carta'));
alter table tip_distributions
  add column if not exists mezzo text not null default 'contanti'
    check (mezzo in ('contanti', 'carta'));

comment on column tips_collected.mezzo is
  'Se la mancia e'' arrivata in contanti (sta nel cassetto) o sulla carta (arriva in banca col resto dell''incasso). Senza, il conteggio del cassetto mostrerebbe un''eccedenza cronica e il saldo banca non tornerebbe mai.';
comment on column tip_distributions.mezzo is
  'Con che forma sono state pagate. Serve a non dover INDOVINARE da quale pentola escono: un''ipotesi qui dentro sposterebbe il saldo del cassetto senza che nessuno l''abbia decisa.';

-- ⚠️ Il default `contanti` non risponde al posto di nessuno: entrambe le
-- tabelle sono VUOTE in produzione e sul progetto di prova (verificato col
-- connettore prima di scrivere). Non c'e' nessuna riga esistente a cui
-- venga attribuita una risposta — che e' la lezione del 14/08.

create or replace function mance_da_distribuire(p_entity_id uuid)
returns table (
  in_contanti numeric,
  su_carta    numeric,
  totale      numeric,
  avvertenza  text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_cont numeric;
  v_cart numeric;
begin
  if not is_titolare() then
    raise exception 'Le mance sono riservate al titolare.';
  end if;

  select
    coalesce((select sum(t.amount) from tips_collected t
               where t.entity_id = p_entity_id and t.mezzo = 'contanti'), 0)
    - coalesce((select sum(d.total_amount) from tip_distributions d
                 where d.entity_id = p_entity_id and d.mezzo = 'contanti'), 0),
    coalesce((select sum(t.amount) from tips_collected t
               where t.entity_id = p_entity_id and t.mezzo = 'carta'), 0)
    - coalesce((select sum(d.total_amount) from tip_distributions d
                 where d.entity_id = p_entity_id and d.mezzo = 'carta'), 0)
    into v_cont, v_cart;

  return query select
    v_cont, v_cart, v_cont + v_cart,
    case when v_cont + v_cart = 0
         then 'Nessuna mancia in attesa di essere distribuita.'
         else 'Queste somme NON sono ricavi del locale: sono dei collaboratori, e la societa'' le tiene finche'' non le distribuisce.'
    end;
end;
$function$;

comment on function mance_da_distribuire is
  'Le mance raccolte e non ancora distribuite (16/08/2026). Sono un DEBITO verso il personale, non un ricavo: separate per forma perche'' quelle in contanti stanno nel cassetto e quelle su carta arrivano in banca.';

revoke all on function mance_da_distribuire(uuid) from public, anon, authenticated;
grant execute on function mance_da_distribuire(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Chi distribuisce deve poter dire in che forma paga
-- ---------------------------------------------------------------------
-- ⚠️ Senza questo, la colonna `mezzo` sulla distribuzione resterebbe
-- sempre al valore predefinito e il conteggio delle mance in cassa
-- sarebbe basato su un'IPOTESI — cioè esattamente quello che il commento
-- in testa a questa migrazione dice di voler evitare.
--
-- ⚠️ Un parametro in più fa una funzione NUOVA (trappola del 12/08 e del
-- 13/08, errore 42725 a runtime): si cancella la vecchia firma e si
-- ricrea. E dopo un `drop` i permessi tornano aperti al mondo, quindi si
-- richiudono qui sotto. Il NOME non cambia, quindi l'elenco del corridoio
-- resta com'è.
-- Si toglie la firma VECCHIA (quattro parametri) e si crea la nuova con
-- `or replace`. ⚠️ Non `create` secco: alla seconda esecuzione il `drop`
-- della vecchia non trova più niente e un `create` fallirebbe con
-- «function already exists» — la migrazione smetterebbe di essere
-- rieseguibile, che è il §7 punto 3.
drop function if exists create_tip_distribution(uuid, date, jsonb, text);

create or replace function create_tip_distribution(
  p_entity_id    uuid,
  p_period_month date,
  p_lines        jsonb,
  p_note         text default null,
  p_mezzo        text default 'contanti'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_id       uuid;
  v_totale   numeric(12,2);
  v_righe    integer;
  v_distinti integer;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' distribuire le mance';
  end if;

  if p_mezzo not in ('contanti', 'carta') then
    raise exception 'Forma di pagamento non valida: %', p_mezzo;
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Nessuna riga da distribuire';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_lines) as r
     where (r->>'amount')::numeric < 0
  ) then
    raise exception 'Un importo negativo non e'' ammesso in una distribuzione';
  end if;

  select count(*), count(distinct (r->>'employee_id')::uuid),
         coalesce(sum((r->>'amount')::numeric), 0)
    into v_righe, v_distinti, v_totale
    from jsonb_array_elements(p_lines) as r
   where (r->>'amount')::numeric > 0;

  if v_righe = 0 then
    raise exception 'Nessun importo da distribuire: tutte le righe sono a zero';
  end if;
  if v_distinti <> v_righe then
    raise exception 'Lo stesso dipendente compare piu'' di una volta nella distribuzione';
  end if;

  -- ⚠️ Non si distribuisce piu' di quello che c'e' in quella forma: le
  -- mance sono un debito verso il personale, e un debito non si paga due
  -- volte. Il controllo e' qui dentro e non nella schermata.
  if v_totale > (select case when p_mezzo = 'contanti' then m.in_contanti else m.su_carta end
                   from mance_da_distribuire(p_entity_id) m) then
    raise exception 'Non ci sono abbastanza mance da distribuire in questa forma.';
  end if;

  insert into tip_distributions (entity_id, period_month, total_amount, note, mezzo)
  values (p_entity_id, p_period_month, v_totale, p_note, p_mezzo)
  returning id into v_id;

  insert into tip_distribution_lines (distribution_id, employee_id, amount)
  select v_id, (r->>'employee_id')::uuid, (r->>'amount')::numeric
    from jsonb_array_elements(p_lines) as r
   where (r->>'amount')::numeric > 0;

  return v_id;
end;
$function$;

comment on function create_tip_distribution is
  'Distribuisce le mance, intestazione e righe nella stessa transazione. Dal 16/08/2026 dice anche IN CHE FORMA si paga: senza, il conteggio delle mance rimaste nel cassetto sarebbe un''ipotesi. E non si distribuisce piu'' di quello che c''e'' in quella forma.';

revoke all on function create_tip_distribution(uuid, date, jsonb, text, text) from public, anon, authenticated;
grant execute on function create_tip_distribution(uuid, date, jsonb, text, text) to authenticated;

-- =====================================================================
-- Il saldo del cassetto comprende le mance in contanti — dichiarate
-- =====================================================================
-- ⚠️ Cambia il tipo restituito, quindi serve `drop` e non `or replace`. E
-- dopo un `drop` i permessi tornano aperti al mondo (trappola del 13/08):
-- si richiudono a mano qui sotto, e la verifica lo controlla.
drop function if exists saldo_tesoreria(uuid);

create function saldo_tesoreria(p_entity_id uuid)
returns table (
  contante_prima_nota   numeric,
  incassi_contanti_sala numeric,
  conti_contanti        integer,
  mance_in_cassa        numeric,
  contante_atteso       numeric,
  di_cui_non_tuo        numeric,
  saldo_banca           numeric,
  ultimo_conteggio_il   date,
  ultima_differenza     numeric,
  avvertenza            text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_pn    numeric;
  v_banca numeric;
  v_sala  numeric;
  v_conti integer;
  v_mance numeric;
  v_data  date;
  v_diff  numeric;
begin
  if not is_titolare() then
    raise exception 'I saldi sono riservati al titolare.';
  end if;

  select coalesce(b.balance, 0), coalesce(b.saldo_banca, 0)
    into v_pn, v_banca
    from v_cash_balance b where b.entity_id = p_entity_id;
  v_pn := coalesce(v_pn, 0);
  v_banca := coalesce(v_banca, 0);

  select coalesce(sum(coalesce(d.collected_amount, t.totale)), 0), count(*)
    into v_sala, v_conti
    from orders o
    left join discounts_gifts d on d.id = o.discount_gift_id
    cross join lateral totale_conto(o.id) t
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and o.payment_method = 'contante';

  -- ⚠️ Le mance in contanti sono FISICAMENTE nel cassetto: se non
  -- entrassero nel teorico, ogni conteggio mostrerebbe un'eccedenza
  -- cronica e la differenza genererebbe un movimento per correggere un
  -- errore che non esiste.
  select m.in_contanti into v_mance from mance_da_distribuire(p_entity_id) m;
  v_mance := greatest(coalesce(v_mance, 0), 0);

  select k.contato_il, k.differenza into v_data, v_diff
    from conteggi_cassa k
   where k.entity_id = p_entity_id
   order by k.contato_il desc, k.created_at desc
   limit 1;

  return query select
    v_pn, v_sala, v_conti, v_mance,
    v_pn + v_sala + v_mance,
    v_mance,
    v_banca, v_data, v_diff,
    (case
       when v_conti = 0 then
         'Nessun conto chiuso in contante: il contante atteso e'' solo quello scritto in prima nota.'
       else
         'Il contante atteso comprende ' || v_conti || ' conti chiusi in contante, letti dalla sala e non riscritti in prima nota.'
     end)
    || ' Gli incassi con carta non sono qui: arrivano in banca dopo qualche giorno, al netto delle commissioni.'
    -- ⚠️ Il numero e il suo limite viaggiano insieme, e qui il limite e'
    -- che una parte di quei soldi non e' del locale.
    || (case when v_mance > 0
             then ' ATTENZIONE: di questo contante ' || to_char(v_mance, 'FM999999990.00')
                  || ' euro sono mance del personale, non tuoi: stanno nel cassetto ma sono un debito.'
             else '' end)
    || (case
          when v_data is null then ' Il cassetto non e'' mai stato contato: finche'' non lo conti, questo e'' un numero teorico.'
          else ' Ultimo conteggio del cassetto: ' || to_char(v_data, 'DD/MM/YYYY') || '.'
        end);
end;
$function$;

comment on function saldo_tesoreria is
  'L''unica risposta a «quanto contante ho e quanto ho in banca» (15/08/2026, esteso il 16/08 con le mance). Gli incassi di sala si LEGGONO dai conti chiusi. Le mance in contanti sono nel cassetto ma NON sono del locale, e la funzione lo dichiara insieme al numero.';

revoke all on function saldo_tesoreria(uuid) from public, anon, authenticated;
grant execute on function saldo_tesoreria(uuid) to authenticated;

-- =====================================================================
-- Il POS in transito comprende le mance su carta
-- =====================================================================
-- ⚠️ Senza, il conto non torna mai: il POS accredita incassi + mance, e il
-- gestionale ne aspetterebbe solo la prima parte. È il caso che il mandato
-- descrive con i numeri — 1.510 accreditati contro 1.450 attesi.
drop function if exists pos_in_transito(uuid);

create function pos_in_transito(p_entity_id uuid)
returns table (
  lordo        numeric,
  mance        numeric,
  commissioni  numeric,
  netto_atteso numeric,
  conti        integer,
  avvertenza   text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_giorni integer;
  v_comm   numeric;
  v_lordo  numeric;
  v_mance  numeric;
  v_conti  integer;
  v_da     date;
begin
  if not is_titolare() then
    raise exception 'I saldi sono riservati al titolare.';
  end if;

  select i.giorni_accredito_pos, i.commissione_pos_percento
    into v_giorni, v_comm
    from impostazioni_tesoreria i where i.entity_id = p_entity_id;

  v_da := case when v_giorni is null then null else current_date - v_giorni end;

  select coalesce(sum(coalesce(d.collected_amount, t.totale)), 0), count(*)
    into v_lordo, v_conti
    from orders o
    left join discounts_gifts d on d.id = o.discount_gift_id
    cross join lateral totale_conto(o.id) t
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and o.payment_method = 'carta'
     and (v_da is null or o.closed_at::date >= v_da);

  select coalesce(sum(tc.amount), 0) into v_mance
    from tips_collected tc
   where tc.entity_id = p_entity_id
     and tc.mezzo = 'carta'
     and (v_da is null or tc.collected_date >= v_da);

  return query select
    v_lordo,
    v_mance,
    case when v_comm is null then null else round((v_lordo + v_mance) * v_comm / 100, 2) end,
    case when v_comm is null then null else round((v_lordo + v_mance) * (100 - v_comm) / 100, 2) end,
    v_conti,
    (case when v_giorni is null
          then 'Non so in quanti giorni accredita la banca, quindi qui c''e'' TUTTO l''incassato con carta, anche quello gia'' arrivato. '
          else 'Incassi con carta degli ultimi ' || v_giorni || ' giorni. ' end)
    || (case when v_comm is null
             then 'E l''importo e'' LORDO: non so quanto trattiene di commissione. Impostali quando la banca risponde (domanda B2).'
             else 'Al netto della commissione del ' || trim(to_char(v_comm, 'FM990.99')) || '%.' end)
    || (case when v_mance > 0
             then ' Comprende ' || to_char(v_mance, 'FM999999990.00')
                  || ' euro di mance: la banca accredita anche quelle, ma non sono ricavi tuoi.'
             else '' end);
end;
$function$;

revoke all on function pos_in_transito(uuid) from public, anon, authenticated;
grant execute on function pos_in_transito(uuid) to authenticated;

-- =====================================================================
-- Il vitto del personale
-- =====================================================================
-- ⚠️ IL VOCABOLARIO ERA CHIUSO IN DUE POSTI, e me ne sono accorto solo
-- applicando: oltre al controllo dentro `record_stock_consumption` c'è un
-- **vincolo sulla tabella**. Aprirne uno solo avrebbe fatto passare la
-- funzione e poi fallire l'inserimento — cioè un errore incomprensibile
-- («violates check constraint») al primo vitto registrato.
--
-- ⚠️ E il vincolo sulla tabella è quello che conta di più, perché vale
-- anche per chi scrive dritto in tabella dal browser. Si ricrea, non si
-- toglie: un vocabolario aperto sarebbe testo libero, cioè tre modi di
-- scrivere «vitto» e tre totali che non si sommano.
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'stock_consumptions'::regclass
       and conname = 'stock_consumptions_reason_check'
       and pg_get_constraintdef(oid) not like '%vitto_personale%'
  ) then
    alter table stock_consumptions drop constraint stock_consumptions_reason_check;
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'stock_consumptions'::regclass
       and conname = 'stock_consumptions_reason_check'
  ) then
    alter table stock_consumptions add constraint stock_consumptions_reason_check
      check (reason in ('consumo', 'spreco', 'rettifica', 'vitto_personale'));
  end if;
end $$;

-- 🔴 La correzione che rende possibile il resto: lo scarico a mano
-- **fotografa il costo** di quello che toglie, come fa da sempre lo
-- scarico automatico dei conti. Senza, un vitto non ha valore e non puo'
-- essere letto come costo del personale — e lo spreco resta un numero di
-- chili che nessuno sa tradurre in euro.
create or replace function record_stock_consumption(
  p_ingredient_id uuid,
  p_quantity      numeric,
  p_reason        text default 'consumo',
  p_note          text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_da_togliere numeric := p_quantity;
  v_lotto       record;
  v_quota       numeric;
  v_disponibile numeric;
  v_costo       numeric := 0;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La quantità deve essere maggiore di zero';
  end if;
  -- Il vocabolario resta CHIUSO e si allarga di uno solo.
  if p_reason not in ('consumo', 'spreco', 'rettifica', 'vitto_personale') then
    raise exception 'Motivo non valido: %', p_reason;
  end if;

  select coalesce(sum(quantity_remaining), 0) into v_disponibile
    from stock_lots where ingredient_id = p_ingredient_id;

  if v_disponibile < p_quantity then
    raise exception 'Giacenza insufficiente: disponibili %, richiesti %', v_disponibile, p_quantity;
  end if;

  for v_lotto in
    select id, quantity_remaining, unit_cost
      from stock_lots
     where ingredient_id = p_ingredient_id and quantity_remaining > 0
     order by expiry_date asc nulls last, received_at asc
     for update
  loop
    exit when v_da_togliere <= 0;
    v_quota := least(v_lotto.quantity_remaining, v_da_togliere);
    update stock_lots set quantity_remaining = quantity_remaining - v_quota
     where id = v_lotto.id;
    -- ⚠️ Il costo si fotografa ADESSO, dai lotti davvero toccati: fra sei
    -- mesi, coi prezzi cambiati, non si ricostruisce. Stesso principio
    -- dello scarico automatico e del costo congelato su una produzione.
    v_costo := v_costo + v_quota * coalesce(v_lotto.unit_cost, 0);
    v_da_togliere := v_da_togliere - v_quota;
  end loop;

  insert into stock_consumptions (ingredient_id, quantity, reason, note, costo)
  values (p_ingredient_id, p_quantity, p_reason, p_note, round(v_costo, 4));
end;
$function$;

comment on function record_stock_consumption is
  'Scarico a mano dal magazzino, FEFO. Dal 16/08/2026 FOTOGRAFA anche il costo di cio'' che toglie: senza, il vitto del personale non avrebbe valore e lo spreco resterebbe un numero di chili. Vocabolario chiuso: consumo, spreco, rettifica, vitto_personale.';

revoke all on function record_stock_consumption(uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function record_stock_consumption(uuid, numeric, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Quanto è costato ciò che non è stato venduto
-- ---------------------------------------------------------------------
create or replace function scarichi_senza_ricavo(
  p_entity_id uuid,
  p_dal       date default null,
  p_al        date default null
)
returns table (
  motivo     text,
  quante     integer,
  costo      numeric,
  senza_costo integer
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_dal date := coalesce(p_dal, date_trunc('month', current_date)::date);
  v_al  date := coalesce(p_al, current_date);
begin
  if not is_titolare() then
    raise exception 'I costi sono riservati al titolare.';
  end if;

  return query
  select sc.reason,
         count(*)::integer,
         coalesce(sum(sc.costo), 0),
         -- ⚠️ Le righe senza costo si contano invece di essere sommate a
         -- zero: uno scarico registrato prima del 16/08 non ha il costo, e
         -- uno zero al posto suo direbbe «non e' costato niente».
         count(*) filter (where sc.costo is null)::integer
    from stock_consumptions sc
   where sc.order_id is null
     and sc.produzione_id is null
     and sc.created_at::date between v_dal and v_al
     and exists (select 1 from ingredients i
                  where i.id = sc.ingredient_id and i.entity_id = p_entity_id)
   group by sc.reason
   order by coalesce(sum(sc.costo), 0) desc;
end;
$function$;

comment on function scarichi_senza_ricavo is
  'Quanto e'' costato cio'' che e'' uscito dalla cella senza essere venduto: vitto del personale, sprechi, rettifiche (16/08/2026). NON entra nel food cost dei piatti venduti, che si calcola sui soli scarichi legati a un conto.';

revoke all on function scarichi_senza_ricavo(uuid, date, date) from public, anon, authenticated;
grant execute on function scarichi_senza_ricavo(uuid, date, date) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_ente     uuid;
  v_titolare uuid;
  v_staff    uuid;
  v_ingr     uuid;
  v_conto    uuid;
  t          record;
  p          record;
  m          record;
  n          integer;
  v_fc       numeric;
  v_ingr_temporaneo boolean := false;
  v_dip      uuid;
  respinto   boolean;
begin
  select id into v_ente from entities where entity_type = 'srls' limit 1;
  if v_ente is null then select id into v_ente from entities limit 1; end if;
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  if v_ente is null or v_titolare is null then
    raise exception 'Prerequisiti mancanti.';
  end if;

  -- ⚠️ Dopo un `drop` i permessi tornano aperti al mondo: si controlla che
  -- siano stati richiusi, invece di fidarsi delle righe scritte sopra.
  if has_function_privilege('anon', 'saldo_tesoreria(uuid)', 'execute') then
    raise exception 'saldo_tesoreria e'' rimasta eseguibile con la chiave pubblica.';
  end if;
  if has_function_privilege('anon', 'pos_in_transito(uuid)', 'execute') then
    raise exception 'pos_in_transito e'' rimasta eseguibile con la chiave pubblica.';
  end if;
  if not has_function_privilege('authenticated', 'saldo_tesoreria(uuid)', 'execute') then
    raise exception 'saldo_tesoreria non e'' piu'' chiamabile dal gestionale.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- ---- Le mance ---------------------------------------------------------
  insert into tips_collected (entity_id, amount, collected_date, mezzo, note)
  values (v_ente, 40, current_date, 'contanti', '__PROVA MANCE__'),
         (v_ente, 60, current_date, 'carta',    '__PROVA MANCE__');

  select * into m from mance_da_distribuire(v_ente);
  if m.in_contanti <> 40 or m.su_carta <> 60 or m.totale <> 100 then
    raise exception 'Le mance da distribuire non tornano: % contanti, % carta.',
      m.in_contanti, m.su_carta;
  end if;

  -- ⚠️ Le mance in contanti stanno nel cassetto, e il saldo lo DICE.
  select * into t from saldo_tesoreria(v_ente);
  if t.mance_in_cassa <> 40 then
    raise exception 'Le mance in contanti non risultano nel cassetto: %.', t.mance_in_cassa;
  end if;
  if t.di_cui_non_tuo <> 40 then
    raise exception 'Il saldo non dichiara quanto non e'' del locale.';
  end if;
  if position('non tuoi' in t.avvertenza) = 0 then
    raise exception 'L''avvertenza non dice che una parte del contante non e'' sua.';
  end if;

  -- ⚠️ E quelle su carta arrivano in banca insieme agli incassi.
  select * into p from pos_in_transito(v_ente);
  if p.mance <> 60 then
    raise exception 'Le mance su carta non risultano in arrivo dal POS: %.', p.mance;
  end if;
  if position('non sono ricavi tuoi' in p.avvertenza) = 0 then
    raise exception 'L''avvertenza del POS non dichiara le mance.';
  end if;

  -- Distribuendone una parte, il debito cala solo su quella forma.
  -- ⚠️ Si distribuisce PASSANDO DALLA FUNZIONE, non scrivendo in tabella:
  -- e' la strada da cui ci arriva il gestionale.
  select id into v_dip from employees limit 1;
  if v_dip is not null then
    -- Non si distribuisce piu' di quello che c'e' in quella forma.
    respinto := false;
    begin
      perform create_tip_distribution(v_ente, date_trunc('month', current_date)::date,
        jsonb_build_array(jsonb_build_object('employee_id', v_dip, 'amount', 999)),
        '__PROVA MANCE__', 'contanti');
    exception when sqlstate 'P0001' then respinto := true;
    end;
    if not respinto then
      raise exception 'Si e'' potuto distribuire piu'' di quanto c''era in contanti.';
    end if;

    perform create_tip_distribution(v_ente, date_trunc('month', current_date)::date,
      jsonb_build_array(jsonb_build_object('employee_id', v_dip, 'amount', 40)),
      '__PROVA MANCE__', 'contanti');
  else
    insert into tip_distributions (entity_id, period_month, total_amount, mezzo, note)
    values (v_ente, date_trunc('month', current_date)::date, 40, 'contanti', '__PROVA MANCE__');
  end if;
  select * into m from mance_da_distribuire(v_ente);
  if m.in_contanti <> 0 or m.su_carta <> 60 then
    raise exception 'La distribuzione ha toccato la forma sbagliata: % / %.',
      m.in_contanti, m.su_carta;
  end if;

  -- ---- Il vitto ---------------------------------------------------------
  -- ⚠️ QUINTA VOLTA CHE SI PRESENTA LA STESSA TRAPPOLA, e stavolta l'ho
  -- vista applicando: in PRODUZIONE ci sono ingredienti con giacenza (i
  -- dati di collaudo del 12-13/08), sul progetto di prova nessuno. Saltando
  -- questa parte quando manca l'ingrediente, il controllo piu' importante
  -- della migrazione — che lo scarico a mano registri finalmente il costo —
  -- avrebbe girato **per la prima volta in produzione**.
  --
  -- Quindi se non c'e' se ne crea uno **temporaneo** e lo si toglie alla
  -- fine. Se c'e', e' roba di Alessio: si aggiunge un lotto proprio, si usa
  -- quello, e non si tocca nient'altro.
  select id into v_ingr from ingredients where entity_id = v_ente limit 1;
  if v_ingr is null then
    insert into ingredients (entity_id, name, category, unit)
    values (v_ente, '__PROVA VITTO ingrediente__', 'altro', 'kg')
    returning id into v_ingr;
    v_ingr_temporaneo := true;
  end if;

  if v_ingr is not null then
    insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at)
    values (v_ingr, 10, 10, 3, now());

    perform record_stock_consumption(v_ingr, 2, 'vitto_personale', '__PROVA VITTO__');

    select costo into v_fc from stock_consumptions
     where note = '__PROVA VITTO__' order by created_at desc limit 1;
    -- 🔴 Il controllo che giustifica meta' di questa migrazione: prima il
    -- costo non veniva registrato affatto.
    if v_fc is null or v_fc <= 0 then
      raise exception 'Lo scarico a mano non ha registrato il costo (%).', v_fc;
    end if;

    select * into t from scarichi_senza_ricavo(v_ente, current_date - 1, current_date + 1);
    if t.motivo is null then
      raise exception 'Il vitto non compare fra gli scarichi senza ricavo.';
    end if;

    -- ⚠️ E NON entra nel food cost dei piatti venduti: quel calcolo si
    -- appoggia a un `join` su `orders`, e questo scarico non ha conto.
    select count(*) into n from stock_consumptions sc
      join orders o on o.id = sc.order_id
     where sc.note = '__PROVA VITTO__';
    if n <> 0 then
      raise exception 'Il vitto del personale risulta legato a un conto.';
    end if;

    delete from stock_consumptions where note = '__PROVA VITTO__';
    delete from stock_lots where ingredient_id = v_ingr and unit_cost = 3 and quantity_received = 10;
    -- Si rimette com'era: se l'ingrediente l'ha creato questa verifica, se
    -- ne va con lei. Se c'era gia', e' di Alessio e resta intatto.
    if v_ingr_temporaneo then
      delete from ingredients where id = v_ingr;
      v_ingr := null;
    end if;
  end if;

  -- Un motivo inventato resta rifiutato.
  respinto := false;
  begin
    perform record_stock_consumption(coalesce(v_ingr, gen_random_uuid()), 1, 'pasto_gratis', null);
  exception when others then respinto := true;
  end;
  if not respinto then
    raise exception 'Un motivo di scarico fuori vocabolario e'' stato accettato.';
  end if;

  -- ---- Il portiere -------------------------------------------------------
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    for n in 1..3 loop
      respinto := false;
      begin
        case n
          when 1 then perform * from mance_da_distribuire(v_ente);
          when 2 then perform * from scarichi_senza_ricavo(v_ente, null, null);
          when 3 then perform * from saldo_tesoreria(v_ente);
        end case;
      exception when sqlstate 'P0001' then respinto := true;
      end;
      if not respinto then
        raise exception 'Lo staff arriva a un numero riservato (controllo %).', n;
      end if;
    end loop;
  end if;

  -- ---- Pulizia ------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  delete from tip_distribution_lines where distribution_id in
    (select id from tip_distributions where note = '__PROVA MANCE__');
  delete from tip_distributions where note = '__PROVA MANCE__';
  delete from tips_collected where note = '__PROVA MANCE__';

  select count(*) into n from tips_collected where note = '__PROVA MANCE__';
  if n <> 0 then raise exception 'La verifica ha lasciato % mance.', n; end if;
  select count(*) into n from stock_consumptions where note = '__PROVA VITTO__';
  if n <> 0 then raise exception 'La verifica ha lasciato % scarichi.', n; end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Mance e vitto: le mance non sono ricavi e il saldo lo dice, il vitto ha un costo e non entra nel food cost dei piatti venduti.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260816000003', 'mance_e_vitto')
on conflict (version) do nothing;

select
  (select count(*) from tips_collected)                                    as mance_raccolte,
  (select count(*) from tip_distributions)                                 as distribuzioni,
  (select count(*) from stock_consumptions where reason = 'vitto_personale') as scarichi_vitto,
  (select count(*) from stock_consumptions where order_id is null and costo is null) as scarichi_senza_costo;
