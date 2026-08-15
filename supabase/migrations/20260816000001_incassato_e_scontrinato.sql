-- ---------------------------------------------------------------------
-- Incassato e scontrinato — la differenza si vede
-- ---------------------------------------------------------------------
-- Chiesto da Alessio il 15/08/2026 con una domanda operativa precisa: *«se
-- un collaboratore incassa senza documento fiscale, cosa mi aspetto? e se
-- un cliente vuole la fattura che gli mando domani?»*
--
-- 🔴 LA RISPOSTA ONESTA ERA: **il gestionale non se ne accorge**, e non per
-- una scelta — un conto chiuso porta l'importo, il modo di pagamento e i
-- piatti, e del documento fiscale non c'è traccia. Il pezzo non era mai
-- stato costruito. Un conto incassato e mai scontrinato era, per il
-- gestionale, identico a tutti gli altri.
--
-- =====================================================================
-- DUE TOTALI, NON UNO
-- =====================================================================
-- **Quanto ho incassato** e **quanto ho fiscalizzato** sono due numeri
-- diversi, e la cosa che serve è **la differenza fra i due** con sotto
-- l'elenco dei conti che la compongono. Un numero solo li nasconderebbe
-- entrambi — è la stessa forma del saldo di cassa che escludeva in
-- silenzio gli incassi di sala.
--
-- ⚠️ E la differenza NON sparisce da sola: resta finché non la si chiude,
-- come le fatture da pagare nelle uscite attese. *Un elenco che si svuota
-- da solo è un elenco che non serve a niente.*
--
-- =====================================================================
-- IL TERZO STATO, DI NUOVO, E QUI È QUELLO PIÙ IMPORTANTE
-- =====================================================================
-- La colonna nasce **vuota**, e vuoto vuol dire «nessuno ha ancora detto
-- cosa è stato emesso». NON vuol dire «niente è stato emesso».
--
-- ⚠️ Se il valore predefinito fosse «scontrino», il gestionale
-- dichiarerebbe fiscalizzato tutto ciò che nessuno ha controllato — e la
-- quadratura tornerebbe sempre, per costruzione, proprio nel caso in cui
-- serve che non torni. Sarebbe un numero rassicurante e falso: la stessa
-- forma dell'elenco allergeni vuoto e dello scarto a zero.
--
-- ⚠️ Conseguenza da dire prima che sembri un guasto: **oggi tutti i conti
-- risulteranno da fiscalizzare**, perché il registratore telematico non
-- c'è e quindi nessun conto ha davvero un documento. È vero, non è un
-- difetto. Quando il registratore arriverà, riempirà quella colonna da
-- solo per gli scontrini, e il confronto col suo totale giornaliero sarà
-- la verifica esterna — la regola decisa da Alessio il 15/08: la
-- differenza è un'anomalia da mostrare, mai una seconda versione.
--
-- =====================================================================
-- COSA NON DIVENTA OBBLIGATORIO, E PERCHÉ
-- =====================================================================
-- ⚠️ Chiudere un conto **non richiede** di dire cosa si è emesso. Lezione
-- del 14/08, quando rendere obbligatoria la causale ruppe l'«alla romana»:
-- prima di rendere obbligatorio un campo si cercano tutti i chiamanti che
-- lo lasciavano vuoto — e qui il chiamante è la sala, con un cliente che
-- aspetta. Chi non risponde lascia il conto nell'elenco, che è
-- esattamente il comportamento voluto: **non blocca, ricorda**.
--
-- Idempotente (§7 punto 3), con blocco di verifica e auto-registrazione.
-- ---------------------------------------------------------------------

-- =====================================================================
-- 1. Cosa è stato emesso su un conto
-- =====================================================================
alter table orders
  add column if not exists documento_fiscale text
    check (documento_fiscale is null
           or documento_fiscale in ('scontrino', 'fattura_da_emettere', 'fattura'));
alter table orders add column if not exists documento_numero text;
alter table orders add column if not exists documento_emesso_il date;

comment on column orders.documento_fiscale is
  'Cosa e'' stato emesso per questo conto (16/08/2026). VUOTO = nessuno l''ha ancora detto, NON «niente e'' stato emesso»: il conto resta nell''elenco di quelli da fiscalizzare. «fattura_da_emettere» e'' il cliente che la vuole e la ricevera'' domani.';

comment on column orders.documento_emesso_il is
  'Quando il documento e'' stato davvero emesso. Puo'' essere un giorno diverso dalla chiusura del conto: e'' il caso della fattura preparata il giorno dopo.';

-- Un documento emesso ha una data; una fattura ancora da fare non ce l'ha.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_documento_coerente') then
    alter table orders add constraint orders_documento_coerente
      check (
        documento_fiscale is distinct from 'fattura'
        or documento_emesso_il is not null
      );
  end if;
end $$;

create index if not exists idx_orders_da_fiscalizzare
  on orders(entity_id, closed_at)
  where status in ('chiuso', 'omaggiato')
    and (documento_fiscale is null or documento_fiscale = 'fattura_da_emettere');

-- =====================================================================
-- 2. Incassato contro fiscalizzato
-- =====================================================================
-- ⚠️ L'incassato si calcola come ovunque: dove c'e' uno sconto o un omaggio
-- vale l'INCASSATO e non il valore del conto (regola del 15/08 sui
-- ricavi). Un omaggio incassa zero, quindi non ha niente da fiscalizzare
-- come corrispettivo e resta fuori dal conteggio per costruzione — non per
-- una condizione scritta a mano che qualcuno potrebbe dimenticare.
create or replace function quadratura_fiscale(
  p_entity_id uuid,
  p_dal       date default null,
  p_al        date default null
)
returns table (
  incassato          numeric,
  fiscalizzato       numeric,
  da_fiscalizzare    numeric,
  quanti_da_fare     integer,
  fatture_da_emettere numeric,
  quante_fatture     integer,
  dal                date,
  al                 date,
  avvertenza         text
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
    raise exception 'La quadratura fiscale e'' riservata al titolare.';
  end if;

  return query
  with conti as (
    select o.documento_fiscale,
           coalesce(d.collected_amount, t.totale) as incasso
      from orders o
      left join discounts_gifts d on d.id = o.discount_gift_id
      cross join lateral totale_conto(o.id) t
     where o.entity_id = p_entity_id
       and o.status in ('chiuso', 'omaggiato')
       and o.closed_at::date between v_dal and v_al
  ),
  reali as (select * from conti where incasso > 0)
  select
    coalesce((select sum(incasso) from reali), 0),
    coalesce((select sum(incasso) from reali
               where documento_fiscale in ('scontrino', 'fattura')), 0),
    coalesce((select sum(incasso) from reali
               where documento_fiscale is null or documento_fiscale = 'fattura_da_emettere'), 0),
    coalesce((select count(*) from reali
               where documento_fiscale is null or documento_fiscale = 'fattura_da_emettere'), 0)::integer,
    coalesce((select sum(incasso) from reali where documento_fiscale = 'fattura_da_emettere'), 0),
    coalesce((select count(*) from reali where documento_fiscale = 'fattura_da_emettere'), 0)::integer,
    v_dal, v_al,
    -- Il numero e il suo limite viaggiano insieme.
    (case
       when (select count(*) from reali) = 0 then
         'Nessun conto incassato nel periodo.'
       when (select count(*) from reali
              where documento_fiscale is null or documento_fiscale = 'fattura_da_emettere') = 0 then
         'Tutti i conti incassati del periodo hanno il loro documento.'
       else
         (select count(*) from reali
           where documento_fiscale is null or documento_fiscale = 'fattura_da_emettere')
         || ' conti incassati non hanno ancora un documento fiscale. Restano in elenco finche'' non lo emetti: non spariscono da soli.'
     end)
    || ' Gli omaggi non sono contati: non incassano niente, quindi non c''e'' corrispettivo da emettere.'
    || (case
          when exists (select 1 from reali where documento_fiscale = 'scontrino') then ''
          else ' Finche'' non c''e'' il registratore telematico nessuno scontrino puo'' essere battuto, quindi e'' normale che qui risulti tutto da fare.'
        end);
end;
$function$;

comment on function quadratura_fiscale is
  'Due totali, non uno: quanto e'' stato incassato e quanto e'' stato fiscalizzato (16/08/2026). La differenza non sparisce da sola — resta finche'' non la si chiude, come le fatture da pagare.';

revoke all on function quadratura_fiscale(uuid, date, date) from public, anon, authenticated;
grant execute on function quadratura_fiscale(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------
-- L'elenco: senza, «N conti senza documento» è un rimprovero senza porta.
-- ---------------------------------------------------------------------
create or replace function conti_da_fiscalizzare(
  p_entity_id uuid,
  p_dal       date default null,
  p_al        date default null
)
returns table (
  order_id    uuid,
  chiuso_il   timestamptz,
  tavolo      text,
  incasso     numeric,
  pagamento   text,
  stato       text,
  coperti     integer
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
    raise exception 'La quadratura fiscale e'' riservata al titolare.';
  end if;

  return query
  select o.id, o.closed_at, o.table_label,
         coalesce(d.collected_amount, t.totale),
         coalesce(o.payment_method::text, 'non indicato'),
         coalesce(o.documento_fiscale, 'da dire'),
         o.coperti
    from orders o
    left join discounts_gifts d on d.id = o.discount_gift_id
    cross join lateral totale_conto(o.id) t
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and o.closed_at::date between v_dal and v_al
     and coalesce(d.collected_amount, t.totale) > 0
     and (o.documento_fiscale is null or o.documento_fiscale = 'fattura_da_emettere')
   order by o.closed_at desc;
end;
$function$;

revoke all on function conti_da_fiscalizzare(uuid, date, date) from public, anon, authenticated;
grant execute on function conti_da_fiscalizzare(uuid, date, date) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_ente     uuid;
  v_titolare uuid;
  v_staff    uuid;
  v_c1       uuid;
  v_c2       uuid;
  v_c3       uuid;
  t          record;
  n          integer;
  respinto   boolean;
begin
  select id into v_ente from entities where entity_type = 'srls' limit 1;
  if v_ente is null then select id into v_ente from entities limit 1; end if;
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  if v_ente is null or v_titolare is null then
    raise exception 'Prerequisiti mancanti.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- Tre conti chiusi nello stesso giorno: uno scontrinato, uno con la
  -- fattura da fare domani, uno che nessuno ha detto.
  insert into orders (entity_id, table_label, status, payment_method, coperti,
                      coperto_unit_price, opened_at, closed_at, note, documento_fiscale,
                      documento_emesso_il)
  values (v_ente, '__PROVA FISC A__', 'chiuso', 'contante', 2, 5,
          make_date(2092,6,1), make_date(2092,6,1), '__PROVA FISCALE__', 'scontrino', make_date(2092,6,1))
  returning id into v_c1;
  insert into order_items (order_id, free_text_name, destination, quantity, unit_price)
  values (v_c1, 'Piatto', 'cucina', 1, 40);   -- 40 + 10 coperti = 50

  insert into orders (entity_id, table_label, status, payment_method, coperti,
                      coperto_unit_price, opened_at, closed_at, note, documento_fiscale)
  values (v_ente, '__PROVA FISC B__', 'chiuso', 'carta', 0, 5,
          make_date(2092,6,1), make_date(2092,6,1), '__PROVA FISCALE__', 'fattura_da_emettere')
  returning id into v_c2;
  insert into order_items (order_id, free_text_name, destination, quantity, unit_price)
  values (v_c2, 'Piatto', 'cucina', 1, 30);

  insert into orders (entity_id, table_label, status, payment_method, coperti,
                      coperto_unit_price, opened_at, closed_at, note)
  values (v_ente, '__PROVA FISC C__', 'chiuso', 'contante', 0, 5,
          make_date(2092,6,1), make_date(2092,6,1), '__PROVA FISCALE__')
  returning id into v_c3;
  insert into order_items (order_id, free_text_name, destination, quantity, unit_price)
  values (v_c3, 'Piatto', 'cucina', 1, 20);

  select * into t from quadratura_fiscale(v_ente, make_date(2092,6,1), make_date(2092,6,30));
  if t.incassato <> 100 then
    raise exception 'L''incassato e'' % invece di 100.', t.incassato;
  end if;
  if t.fiscalizzato <> 50 then
    raise exception 'Il fiscalizzato e'' % invece di 50.', t.fiscalizzato;
  end if;
  if t.da_fiscalizzare <> 50 or t.quanti_da_fare <> 2 then
    raise exception 'Da fiscalizzare: % su % conti, attesi 50 su 2.',
      t.da_fiscalizzare, t.quanti_da_fare;
  end if;
  -- ⚠️ La fattura promessa e' contata a parte: e' un impegno preso con un
  -- cliente, non una dimenticanza, e confonderle toglie l'informazione.
  if t.fatture_da_emettere <> 30 or t.quante_fatture <> 1 then
    raise exception 'Le fatture da emettere sono % su %, attese 30 su 1.',
      t.fatture_da_emettere, t.quante_fatture;
  end if;

  select count(*) into n from conti_da_fiscalizzare(v_ente, make_date(2092,6,1), make_date(2092,6,30));
  if n <> 2 then
    raise exception 'L''elenco mostra % conti invece di 2.', n;
  end if;

  -- ---- Si sistema dopo, ed e' il caso normale --------------------------
  update orders set documento_fiscale = 'fattura',
                    documento_numero = '1/2092',
                    documento_emesso_il = make_date(2092,6,2)
   where id = v_c2;

  select * into t from quadratura_fiscale(v_ente, make_date(2092,6,1), make_date(2092,6,30));
  if t.fiscalizzato <> 80 or t.quanti_da_fare <> 1 then
    raise exception 'Dopo l''emissione della fattura: fiscalizzato %, da fare %.',
      t.fiscalizzato, t.quanti_da_fare;
  end if;

  -- ⚠️ Una fattura non si puo' dichiarare emessa senza dire quando: e' un
  -- vincolo, perche' quella data e' la sola cosa che distingue «fatta» da
  -- «promessa».
  respinto := false;
  begin
    update orders set documento_fiscale = 'fattura', documento_emesso_il = null
     where id = v_c3;
  exception when check_violation then respinto := true;
  end;
  if not respinto then
    raise exception 'Una fattura risulta emessa senza data di emissione.';
  end if;

  -- ---- Un omaggio non ha corrispettivo da emettere ---------------------
  update orders set status = 'omaggiato', payment_method = null where id = v_c3;
  insert into discounts_gifts (entity_id, type, full_amount, collected_amount,
                               causale_id, created_by)
  select v_ente, 'omaggio', 20, 0, c.id, v_titolare
    from cash_causali c where c.kind = 'sconto_omaggio' limit 1;
  update orders set discount_gift_id = (select id from discounts_gifts
                                         where entity_id = v_ente and collected_amount = 0
                                         order by created_at desc limit 1)
   where id = v_c3;

  select * into t from quadratura_fiscale(v_ente, make_date(2092,6,1), make_date(2092,6,30));
  if t.quanti_da_fare <> 0 then
    raise exception 'Un omaggio (incasso zero) risulta da fiscalizzare.';
  end if;
  if position('Gli omaggi non sono contati' in t.avvertenza) = 0 then
    raise exception 'L''avvertenza non dichiara che gli omaggi restano fuori.';
  end if;

  -- ---- Il portiere ------------------------------------------------------
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    respinto := false;
    begin
      perform * from quadratura_fiscale(v_ente, null, null);
    exception when sqlstate 'P0001' then respinto := true;
    end;
    if not respinto then
      raise exception 'Lo staff legge la quadratura fiscale.';
    end if;
    respinto := false;
    begin
      perform * from conti_da_fiscalizzare(v_ente, null, null);
    exception when sqlstate 'P0001' then respinto := true;
    end;
    if not respinto then
      raise exception 'Lo staff legge l''elenco dei conti da fiscalizzare.';
    end if;
  end if;

  -- ---- Pulizia -----------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  update orders set discount_gift_id = null where note = '__PROVA FISCALE__';
  delete from discounts_gifts where entity_id = v_ente and collected_amount = 0
     and full_amount = 20;
  delete from order_items where order_id in (select id from orders where note = '__PROVA FISCALE__');
  delete from stock_consumptions where order_id in (select id from orders where note = '__PROVA FISCALE__');
  delete from anomalie_scarico where order_id in (select id from orders where note = '__PROVA FISCALE__');
  delete from orders where note = '__PROVA FISCALE__';

  select count(*) into n from orders where note = '__PROVA FISCALE__';
  if n <> 0 then
    raise exception 'La verifica ha lasciato % conti.', n;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Incassato e scontrinato: due totali, la differenza in elenco, e la fattura promessa contata a parte.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260816000001', 'incassato_e_scontrinato')
on conflict (version) do nothing;

select
  (select count(*) from orders where status in ('chiuso','omaggiato'))          as conti_chiusi,
  (select count(*) from orders where status in ('chiuso','omaggiato')
     and documento_fiscale is null)                                             as senza_documento,
  (select count(*) from orders where documento_fiscale = 'fattura_da_emettere') as fatture_promesse;
