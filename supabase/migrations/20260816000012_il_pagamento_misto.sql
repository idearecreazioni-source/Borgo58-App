-- =====================================================================
-- Il pagamento misto
-- =====================================================================
-- Blocco 9 del mandato di correzione (16/08/2026), deciso da Alessio.
--
-- IL DIFETTO: un conto ha **un solo modo di pagamento**. Se due persone
-- dividono e una paga in contanti e l'altra con la carta, l'app non sa
-- dirlo — e **nessuna riconciliazione con la banca potra' mai tornare**,
-- perche' il POS accredita una cifra che il gestionale non ha mai
-- registrato.
--
-- Si fa adesso, prima che entrino i conti veri: cambiarlo dopo, con lo
-- storico dentro, costa molto di piu'.
--
-- ⚠️ COME SI PAGA DAVVERO IN SALA — chiesto ad Alessio prima di
-- disegnare, perche' le due strade si registrano in modo diverso e non si
-- indovinano: *«una sola [passata sul POS] per la sua parte»*. Quindi il
-- conto si divide in QUOTE, ognuna col suo mezzo e il suo importo, e la
-- somma fa l'incassato. **Non esiste il giro di restituzione** — carta
-- passata per il totale e contante reso — che avrebbe richiesto di
-- registrare un'uscita di cassa mai avvenuta.
--
-- ⚠️ REGOLA CHE NON SI TOCCA (mandato): *i ricavi restano i conti chiusi,
-- unica fonte. Il pagamento misto ripartisce LO STESSO incasso, non ne
-- crea un secondo.* Per questo `totale_conto()` non e' stata sfiorata, e
-- le quote si confrontano con l'INCASSATO — che per un conto scontato o
-- omaggiato e' `collected_amount`, non il valore del conto: un omaggio
-- vale come il piatto e incassa zero.
--
-- ⚠️ E UNA SOLA FONTE, NON DUE. `order_payments` diventa il posto dove
-- vive il come-e'-stato-pagato; `orders.payment_method` resta ma diventa
-- un **riflesso scritto solo da un trigger**, mai dall'applicazione. E'
-- la stessa forma di `order_tables.conto_aperto` (14/08): una proiezione
-- che esiste perche' serve a chi legge, e che nessuno puo' far divergere
-- dalla verita' scrivendoci sopra. Tenere due posti che dicono il mezzo
-- di pagamento sarebbe esattamente cio' che questo mandato passa il tempo
-- a togliere (regola 6).
--
-- ⚠️ Stato di partenza VERO, letto col connettore prima di scrivere: in
-- produzione c'e' **UN conto chiuso** («Divano 3», 15/08, contante,
-- 5,00). La sanatoria gli scrive la sua quota unica — senza, quel conto
-- sparirebbe dal contante atteso nel momento in cui la tesoreria smette
-- di guardare `payment_method`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Le quote
-- ---------------------------------------------------------------------
create table if not exists order_payments (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  mezzo      text not null check (mezzo in ('contante', 'carta')),
  importo    numeric(12,2) not null check (importo > 0),
  created_at timestamptz not null default now()
);

comment on table order_payments is
  'Come e'' stato pagato un conto, quota per quota (16/08/2026, Blocco 9). Un conto pagato in un modo solo ha UNA riga: non e'' un caso speciale, e'' il caso con una quota. ⚠️ E'' l''unica fonte del mezzo di pagamento: orders.payment_method ne e'' il riflesso, scritto da un trigger.';

comment on column order_payments.importo is
  'Quanto e'' stato pagato con questo mezzo. ⚠️ La somma delle quote di un conto deve fare l''INCASSATO — che per un conto scontato o omaggiato e'' collected_amount, non il valore del conto. Controllato da incasso_conto() e dalla quadratura, non lasciato alla buona volonta''.';

create index if not exists idx_order_payments_conto on order_payments(order_id);

alter table order_payments enable row level security;
do $$
begin
  -- Chiudere un conto e' lavoro di sala: la lettura e la scrittura
  -- seguono `orders`, che e' condivisa. La cancellazione resta al
  -- titolare, come per le altre tabelle di soldi.
  if not exists (select 1 from pg_policies where schemaname='public'
                   and tablename='order_payments' and policyname='order_payments_rw') then
    create policy order_payments_rw on order_payments
      for all to authenticated using (true) with check (true);
  end if;
end $$;
revoke all on table order_payments from public, anon;
grant select, insert, update, delete on order_payments to authenticated;

-- ⚠️ Tabella di soldi: entra nel registro delle cancellazioni.
drop trigger if exists trg_log_delete on order_payments;
create trigger trg_log_delete before delete on order_payments
  for each row execute function log_deleted_record();

-- ---------------------------------------------------------------------
-- 2. L'incassato di un conto, in un posto solo
-- ---------------------------------------------------------------------
-- Serviva gia' a tre funzioni della tesoreria, ognuna col suo
-- `coalesce(d.collected_amount, t.totale)` ricopiato. Ora e' uno.
create or replace function incasso_conto(p_order_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $funzione$
  select coalesce(d.collected_amount, t.totale)
    from orders o
    left join discounts_gifts d on d.id = o.discount_gift_id
    cross join lateral totale_conto(o.id) t
   where o.id = p_order_id;
$funzione$;

comment on function incasso_conto is
  'Quanto e'' entrato davvero da un conto: l''incassato, non il valore. Per un omaggio e'' zero — vale come il piatto e non porta un euro (regola del 15/08 sui ricavi). Le quote di pagamento si confrontano con questo.';

revoke all on function incasso_conto(uuid) from public, anon, authenticated;
grant execute on function incasso_conto(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Il riflesso su orders.payment_method
-- ---------------------------------------------------------------------
-- ⚠️ Scritto SOLO da qui. L'applicazione non lo tocca piu': se lo
-- toccasse, potrebbe dire una cosa che le quote smentiscono, ed e' il
-- difetto che questa migrazione chiude.
create or replace function riflette_mezzo_pagamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $trigger$
declare
  v_conto  uuid;
  v_mezzi  integer;
  v_unico  text;
begin
  v_conto := coalesce(new.order_id, old.order_id);

  select count(distinct mezzo), min(mezzo)
    into v_mezzi, v_unico
    from order_payments where order_id = v_conto;

  update orders
     set payment_method = case
           when v_mezzi = 0 then null
           when v_mezzi = 1 then v_unico::order_payment_method
           else 'misto'::order_payment_method
         end
   where id = v_conto;

  return coalesce(new, old);
end;
$trigger$;

comment on function riflette_mezzo_pagamento is
  'Tiene orders.payment_method allineato alle quote di order_payments (16/08/2026, Blocco 9). E'' una PROIEZIONE, come order_tables.conto_aperto: esiste perche'' serve a chi legge un conto, e nessuno puo'' farla divergere dalla verita'' scrivendoci sopra.';

revoke all on function riflette_mezzo_pagamento() from public, anon, authenticated;

drop trigger if exists trg_mezzo_pagamento on order_payments;
create trigger trg_mezzo_pagamento
  after insert or update or delete on order_payments
  for each row execute function riflette_mezzo_pagamento();

-- ---------------------------------------------------------------------
-- 4. La sanatoria: i conti gia' chiusi hanno la loro quota
-- ---------------------------------------------------------------------
-- ⚠️ Senza, quei conti sparirebbero dal contante atteso nell'istante in
-- cui la tesoreria smette di guardare `payment_method` — un saldo che
-- cala da solo, e nessuno saprebbe perche'. In produzione e' un conto
-- solo, ma la regola vale per qualunque ripristino.
insert into order_payments (order_id, mezzo, importo)
select o.id, o.payment_method::text, incasso_conto(o.id)
  from orders o
 where o.status in ('chiuso', 'omaggiato')
   and o.payment_method in ('contante', 'carta')
   and incasso_conto(o.id) > 0
   and not exists (select 1 from order_payments p where p.order_id = o.id);

-- ---------------------------------------------------------------------
-- 5. Chiudere un conto sapendo che le quote possono essere piu' d'una
-- ---------------------------------------------------------------------
create or replace function close_order_paid(
  p_order_id           uuid,
  p_payment_method     text default null,
  p_coperto_unit_price numeric default null,
  p_pagamenti          jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_order   orders%rowtype;
  v_prezzo  numeric(12,2);
  v_incasso numeric(12,2);
  v_somma   numeric(12,2);
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Conto non trovato';
  end if;
  if v_order.status <> 'aperto' then
    raise exception 'Questo conto e'' gia'' stato chiuso (stato: %). Ricaricare la schermata.', v_order.status;
  end if;

  v_prezzo := coalesce(
    p_coperto_unit_price,
    v_order.coperto_unit_price,
    (select coperto_price from service_settings where id = 1),
    0
  );

  update orders set
    status             = 'chiuso',
    coperto_unit_price = v_prezzo,
    closed_at          = now()
  where id = p_order_id;

  -- L'incassato si legge DOPO aver fissato il prezzo del coperto: prima
  -- sarebbe il totale calcolato col listino di oggi invece che con quello
  -- fotografato sul conto.
  v_incasso := incasso_conto(p_order_id);

  if p_pagamenti is null then
    -- Il caso di sempre: un mezzo solo, una quota sola. Non e' un caso
    -- speciale — e' il caso con una quota.
    if p_payment_method is null or p_payment_method not in ('contante', 'carta') then
      raise exception 'Metodo di pagamento non valido: %', coalesce(p_payment_method, '(vuoto)');
    end if;
    if v_incasso > 0 then
      insert into order_payments (order_id, mezzo, importo)
      values (p_order_id, p_payment_method, v_incasso);
    end if;
  else
    if jsonb_typeof(p_pagamenti) <> 'array' or jsonb_array_length(p_pagamenti) = 0 then
      raise exception 'La divisione del pagamento non contiene nessuna quota.';
    end if;

    insert into order_payments (order_id, mezzo, importo)
    select p_order_id, q->>'mezzo', (q->>'importo')::numeric
      from jsonb_array_elements(p_pagamenti) as q
     where (q->>'importo')::numeric > 0;

    select coalesce(sum(importo), 0) into v_somma
      from order_payments where order_id = p_order_id;

    -- ⚠️ IL CONTROLLO CHE REGGE TUTTO. Una divisione che non fa il totale
    -- crea un conto che dice 40 e ne registra 35: i ricavi restano giusti
    -- (si leggono dal conto), ma la cassa e la banca non torneranno mai
    -- piu', e la differenza non avrebbe nessun posto dove comparire.
    -- Un centesimo di tolleranza perche' dividere per tre non da' un
    -- numero tondo; oltre, si rifiuta.
    if abs(v_somma - v_incasso) > 0.01 then
      raise exception
        'Le quote fanno % euro, il conto ne fa %: la divisione deve tornare al centesimo.',
        to_char(v_somma, 'FM999999990.00'), to_char(v_incasso, 'FM999999990.00');
    end if;
  end if;

  perform scarica_magazzino_conto(p_order_id);
end;
$funzione$;

comment on function close_order_paid(uuid, text, numeric, jsonb) is
  'Chiude un conto pagato, registra COME e'' stato pagato — una quota o piu'' — e fa scendere la giacenza, in una transazione (pagamento misto: 16/08/2026, Blocco 9). Le quote devono fare l''incassato al centesimo: una divisione che non torna sarebbe cassa e banca che non tornano piu''.';

revoke all on function close_order_paid(uuid, text, numeric, jsonb) from public, anon, authenticated;
grant execute on function close_order_paid(uuid, text, numeric, jsonb) to authenticated;

-- La firma vecchia a tre parametri non serve piu': tenerla vorrebbe dire
-- due funzioni sovrapposte e una chiamata per nome ambigua (42725, a
-- runtime — lezione del 12/08 su `register_stock_delivery`).
drop function if exists close_order_paid(uuid, text, numeric);

-- ---------------------------------------------------------------------
-- 6. E la tesoreria legge le quote
-- ---------------------------------------------------------------------
-- ⚠️ RISCRITTA DALLA DEFINIZIONE VERA, non dal file del 15/08 — e la
-- differenza non era teorica: la migrazione delle mance di stamattina
-- (`20260816000003`) ha aggiunto a questa funzione tre colonne
-- (`mance_in_cassa`, `di_cui_non_tuo`, e `mance` sull'altra). Riscriverla
-- dal file vecchio avrebbe **tolto le mance dal contante atteso** senza
-- che niente lo dicesse. Postgres l'ha rifiutata perche' le colonne non
-- combaciavano; se avessero combaciato, sarebbe passata.
-- *Una funzione si riscrive da com'e' adesso, non da come l'avevo
-- lasciata.*
create or replace function saldo_tesoreria(p_entity_id uuid)
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

  -- ⚠️ Dal 16/08 si sommano le QUOTE in contante, non i conti «chiusi in
  -- contante»: un conto pagato meta' e meta' portava zero contante nel
  -- cassetto teorico, e il conteggio avrebbe mostrato un'eccedenza che
  -- nessuno sapeva spiegare.
  select coalesce(sum(p.importo), 0), count(distinct p.order_id)
    into v_sala, v_conti
    from order_payments p
    join orders o on o.id = p.order_id
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and p.mezzo = 'contante';

  -- ⚠️ Le mance in contanti sono FISICAMENTE nel cassetto (16/08, Blocco 5
  -- del mandato personale): se non entrassero nel teorico, ogni conteggio
  -- mostrerebbe un'eccedenza cronica.
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
         'Nessun conto chiuso con contante: il contante atteso e'' solo quello scritto in prima nota.'
       else
         'Il contante atteso comprende la parte in contanti di ' || v_conti || ' conti chiusi, letta dalla sala e non riscritta in prima nota.'
     end)
    || ' Gli incassi con carta non sono qui: arrivano in banca dopo qualche giorno, al netto delle commissioni.'
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
  'L''unica risposta a «quanto contante ho e quanto ho in banca». Dal 16/08/2026 somma le QUOTE in contante dei conti chiusi (Blocco 9): un conto pagato meta'' contanti e meta'' carta contribuisce per la sua parte, non per tutto o per niente.';

revoke all on function saldo_tesoreria(uuid) from public, anon, authenticated;
grant execute on function saldo_tesoreria(uuid) to authenticated;

create or replace function pos_in_transito(p_entity_id uuid)
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

  -- ⚠️ Le QUOTE con carta, non i conti «chiusi con carta»: un conto pagato
  -- meta' e meta' portava zero al POS, e il giorno dell'accredito la
  -- banca avrebbe versato una cifra che il gestionale non aspettava.
  select coalesce(sum(p.importo), 0), count(distinct p.order_id)
    into v_lordo, v_conti
    from order_payments p
    join orders o on o.id = p.order_id
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and p.mezzo = 'carta'
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

comment on function pos_in_transito is
  'Quanto deve ancora arrivare dal POS. Dal 16/08/2026 somma le QUOTE con carta (Blocco 9): un conto pagato meta'' contanti e meta'' carta contribuisce per la sua parte. I due parametri del POS nascono VUOTI, e finche'' lo sono l''importo e'' dichiarato lordo invece di essere corretto con un numero inventato.';

revoke all on function pos_in_transito(uuid) from public, anon, authenticated;
grant execute on function pos_in_transito(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. La quadratura: quote che non fanno l'incassato
-- ---------------------------------------------------------------------
-- ⚠️ Il vincolo dentro `close_order_paid` impedisce di nascere sbagliati.
-- Questa mostra cio' che nessun vincolo puo' impedire: un conto chiuso
-- prima del 16/08, o una quota tolta a mano dopo. Stessa forma di
-- `quadratura_pagamenti()` per le fatture.
create or replace function conti_senza_quadratura(p_entity_id uuid)
returns table (
  order_id   uuid,
  tavolo     text,
  chiuso_il  timestamptz,
  incassato  numeric,
  quote      numeric,
  differenza numeric
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  if not is_titolare() then
    raise exception 'La quadratura degli incassi e'' riservata al titolare.';
  end if;

  return query
  select o.id, o.table_label, o.closed_at,
         incasso_conto(o.id),
         coalesce((select sum(p.importo) from order_payments p where p.order_id = o.id), 0),
         incasso_conto(o.id)
           - coalesce((select sum(p.importo) from order_payments p where p.order_id = o.id), 0)
    from orders o
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and abs(
           incasso_conto(o.id)
             - coalesce((select sum(p.importo) from order_payments p where p.order_id = o.id), 0)
         ) > 0.01
   order by o.closed_at desc;
end;
$funzione$;

comment on function conti_senza_quadratura is
  'I conti chiusi in cui le quote di pagamento non fanno l''incassato (16/08/2026, Blocco 9). Dovrebbe restare vuota: nascere sbagliati lo impedisce close_order_paid. Serve per cio'' che nessun vincolo puo'' impedire — un conto chiuso prima di questa migrazione, o una quota tolta a mano dopo.';

revoke all on function conti_senza_quadratura(uuid) from public, anon, authenticated;
grant execute on function conti_senza_quadratura(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 8. Verifica sul campo (§5 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  e1 uuid; v_tav uuid;
  c_uno uuid; c_misto uuid; c_storto uuid;
  v_mezzo text; v_n integer;
  v_cassa_prima numeric; v_cassa_dopo numeric;
  v_carta_prima numeric; v_carta_dopo numeric;
  respinto boolean;
  n integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into e1 from entities order by created_at limit 1;
  insert into dining_tables (label, tipo, larghezza_cm, profondita_cm, x, y)
  values ('__PB9__', 'tavolo', 90, 90, 4500, 4500) returning id into v_tav;

  select contante_atteso into v_cassa_prima from saldo_tesoreria(e1);
  select lordo into v_carta_prima from pos_in_transito(e1);

  -- ===== Un mezzo solo: la quota e' una, e nulla cambia per chi usa l'app.
  insert into orders (entity_id, table_label, status, coperti, coperto_unit_price)
  values (e1, '__Prova B9 uno__', 'aperto', 0, 0) returning id into c_uno;
  insert into order_items (order_id, free_text_name, destination, quantity, unit_price, sent_at)
  values (c_uno, '__PB9 piatto__', 'cucina', 1, 30.00, now());

  perform close_order_paid(c_uno, 'contante', 0);
  select count(*), min(mezzo) into v_n, v_mezzo from order_payments where order_id = c_uno;
  if v_n <> 1 or v_mezzo <> 'contante' then
    raise exception 'Un conto pagato in un modo solo ha % quote (%).', v_n, v_mezzo;
  end if;
  if (select payment_method::text from orders where id = c_uno) <> 'contante' then
    raise exception 'Il riflesso su orders non dice «contante».';
  end if;

  -- ===== Misto: 30 in contanti e 20 con la carta su un conto da 50.
  insert into orders (entity_id, table_label, status, coperti, coperto_unit_price)
  values (e1, '__Prova B9 misto__', 'aperto', 0, 0) returning id into c_misto;
  insert into order_items (order_id, free_text_name, destination, quantity, unit_price, sent_at)
  values (c_misto, '__PB9 piatto__', 'cucina', 1, 50.00, now());

  perform close_order_paid(c_misto, null, 0,
    '[{"mezzo":"contante","importo":30},{"mezzo":"carta","importo":20}]'::jsonb);

  select count(*) into v_n from order_payments where order_id = c_misto;
  if v_n <> 2 then
    raise exception 'Il conto misto ha % quote invece di 2.', v_n;
  end if;
  if (select payment_method::text from orders where id = c_misto) <> 'misto' then
    raise exception 'Il riflesso su orders non dice «misto»: %.',
      (select payment_method::text from orders where id = c_misto);
  end if;

  -- ⚠️ IL CONTROLLO CHE VALE DI PIU': il contante cresce di 30 e la carta
  -- di 20, non di 50 e 0. Prima del 16/08 un conto misto sarebbe finito
  -- tutto da una parte sola.
  select contante_atteso into v_cassa_dopo from saldo_tesoreria(e1);
  select lordo into v_carta_dopo from pos_in_transito(e1);
  if v_cassa_dopo - v_cassa_prima <> 60.00 then
    raise exception 'Il contante atteso e'' cresciuto di % invece di 60 (30 del primo conto + 30 della quota).',
      v_cassa_dopo - v_cassa_prima;
  end if;
  if v_carta_dopo - v_carta_prima <> 20.00 then
    raise exception 'La carta in arrivo e'' cresciuta di % invece di 20.', v_carta_dopo - v_carta_prima;
  end if;

  -- ===== Una divisione che non torna e' respinta.
  insert into orders (entity_id, table_label, status, coperti, coperto_unit_price)
  values (e1, '__Prova B9 storto__', 'aperto', 0, 0) returning id into c_storto;
  insert into order_items (order_id, free_text_name, destination, quantity, unit_price, sent_at)
  values (c_storto, '__PB9 piatto__', 'cucina', 1, 40.00, now());

  respinto := false;
  begin
    perform close_order_paid(c_storto, null, 0,
      '[{"mezzo":"contante","importo":30},{"mezzo":"carta","importo":5}]'::jsonb);
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then
    raise exception 'Una divisione che non fa il totale e'' stata accettata: cassa e banca non tornerebbero mai piu''.';
  end if;
  -- E il rifiuto non lascia mezzo lavoro: il conto e'' ancora aperto.
  if (select status::text from orders where id = c_storto) <> 'aperto' then
    raise exception 'Il conto rifiutato e'' rimasto chiuso a meta''.';
  end if;

  -- ===== La quadratura non trova niente, ed e' il suo mestiere.
  if exists (select 1 from conti_senza_quadratura(e1)) then
    raise exception 'La quadratura trova conti storti subito dopo la sanatoria.';
  end if;

  -- ===== Togliendo tutte le quote, il riflesso torna vuoto.
  delete from order_payments where order_id = c_uno;
  if (select payment_method from orders where id = c_uno) is not null then
    raise exception 'Tolte le quote, il riflesso continua a dire un mezzo di pagamento.';
  end if;

  -- PULIZIA
  delete from orders where id in (c_uno, c_misto, c_storto);
  delete from dining_tables where id = v_tav;
  delete from deleted_records
   where table_name in ('order_payments', 'order_items')
     and record->>'order_id' in (c_uno::text, c_misto::text, c_storto::text);

  select count(*) into n from orders where table_label like '\_\_Prova B9%';
  if n <> 0 then raise exception 'La verifica ha lasciato % conti.', n; end if;
  select count(*) into n from dining_tables where label = '__PB9__';
  if n <> 0 then raise exception 'La verifica ha lasciato % sagome.', n; end if;
  select count(*) into n from deleted_records
   where record->>'order_id' in (c_uno::text, c_misto::text, c_storto::text);
  if n <> 0 then raise exception 'La verifica ha lasciato % lapidi nel registro.', n; end if;

  -- E il saldo e' tornato dov'era: la prova non sposta i numeri veri.
  select contante_atteso into v_cassa_dopo from saldo_tesoreria(e1);
  if v_cassa_dopo <> v_cassa_prima then
    raise exception 'Il contante atteso e'' rimasto spostato di %.', v_cassa_dopo - v_cassa_prima;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Blocco 9: un conto si paga in piu'' modi, e ogni quota va dove deve.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260816000012', 'il_pagamento_misto')
on conflict (version) do nothing;

select
  (select count(*) from order_payments)                                            as quote_registrate,
  (select count(*) from orders where status in ('chiuso','omaggiato'))             as conti_chiusi,
  (select count(*) from orders o where o.status in ('chiuso','omaggiato')
     and not exists (select 1 from order_payments p where p.order_id = o.id)
     and incasso_conto(o.id) > 0)                                                  as conti_chiusi_senza_quote,
  (select count(*) from pg_trigger where tgname = 'trg_log_delete' and not tgisinternal) as tabelle_tracciate;
