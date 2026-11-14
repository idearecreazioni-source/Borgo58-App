-- =====================================================================
-- LA PROIEZIONE CONTA LE FATTURE (13/11/2026) — pezzo 5b di 5
-- =====================================================================
--
-- Piano approvato da Alessio il 13/11 («sì, approvo»): il ricavo di una
-- fattura SENZA TAVOLO (un evento, un catering) entra nei numeri del mese
-- alla DATA DELLA FATTURA. Fino a oggi `misure_del_mese` leggeva solo i
-- conti dei tavoli: una fattura così non esisteva per la Proiezione, per i
-- consuntivi e per l'andamento dell'anno.
--
-- ⚠️ UN EURO SI CONTA UNA VOLTA: la fattura di un conto del tavolo NON si
--    aggiunge, perché il suo ricavo è già il conto (letto qui sopra da
--    sempre). Solo `order_id is null`.
-- ⚠️ IL TOTALE, IVA COMPRESA, come i conti: i ricavi del mese qui sono
--    «quello che è stato incassato», e un conto si legge col suo totale.
--
-- La funzione è ripresa da 20260819000006 con un solo blocco in più (le
-- fatture) e le due righe che dicono «misurato» anche quando nel mese ci
-- sono solo fatture.
--
-- Idempotente. Si auto-registra. Verifica annullata, zero residui.

CREATE OR REPLACE FUNCTION public.misure_del_mese(p_entity_id uuid, p_anno integer, p_mese integer)
 RETURNS TABLE(coperti numeric, ricavi numeric, food_cost numeric, fissi numeric, omaggi_costo numeric, omaggi_quanti integer, conti_chiusi integer, origine_coperti text, origine_ricavi text, origine_food_cost text, origine_fissi text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dal  date;
  v_al   date;
  v_cop  numeric;
  v_ric  numeric;
  v_fc   numeric;
  v_fis  numeric;
  v_conti integer;
  v_fatt  numeric;
  v_fatture integer;
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
     and serata_di_servizio(o.closed_at) >= v_dal and serata_di_servizio(o.closed_at) < v_al;

  select coalesce(sum(o.coperti), 0) into v_cop
    from orders o
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and serata_di_servizio(o.closed_at) >= v_dal and serata_di_servizio(o.closed_at) < v_al;

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
     and serata_di_servizio(o.closed_at) >= v_dal and serata_di_servizio(o.closed_at) < v_al;

  -- 🔴 LE FATTURE SENZA TAVOLO (13/11/2026, pezzo 5b): un evento, un
  --    catering fatturato non ha un conto, e qui non esisteva. Si contano
  --    alla DATA DELLA FATTURA (deciso da Alessio), col totale incassato,
  --    come i conti. ⚠️ SOLO senza tavolo: la fattura di un conto è gia'
  --    il conto qui sopra, e contarla di nuovo raddoppierebbe il ricavo.
  --    Numerate (uscite), comprese le scartate che si correggono e
  --    ripartono col loro numero.
  select coalesce(sum(fe.totale), 0), count(*) into v_fatt, v_fatture
    from fatture_emesse fe
   where fe.entity_id = p_entity_id
     and fe.order_id is null
     and fe.numero is not null
     and fe.data >= v_dal and fe.data < v_al;
  v_ric := v_ric + v_fatt;

  -- Il food cost vero: quanto e' costata la merce uscita dalla cella per
  -- quei conti. Con il Ricettario vuoto questo resta zero, ed e' proprio
  -- il caso in cui non va scritto zero.
  select coalesce(sum(sc.costo), 0) into v_fc
    from stock_consumptions sc
    join orders o on o.id = sc.order_id
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and serata_di_servizio(o.closed_at) >= v_dal and serata_di_servizio(o.closed_at) < v_al;

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
    case when v_conti > 0 or v_fatture > 0 then v_ric end,
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
    case when v_conti > 0 or v_fatture > 0 then 'misurato' else 'assente' end,
    case when v_fc > 0   then 'misurato' else 'assente' end,
    case when v_causali_marcate > 0 then 'misurato' else 'assente' end;
end;
$function$;

comment on function misure_del_mese(uuid, integer, integer) is
  'I numeri veri di un mese: coperti, ricavi incassati (conti dei tavoli più, dal 13/11/2026, le fatture ai clienti SENZA tavolo alla data della fattura), food cost, fissi, omaggi. Solo il titolare.';
revoke all on function misure_del_mese(uuid, integer, integer) from public, anon, authenticated;
grant execute on function misure_del_mese(uuid, integer, integer) to authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione che si annulla
-- ---------------------------------------------------------------------
--   (1) una fattura senza tavolo, uscita, entra nei ricavi del suo mese
--       col suo totale, e il mese risulta «misurato»;
--   (2) una bozza no;
--   (3) la fattura del conto di un tavolo NON aggiunge niente.
do $verifica$
declare
  v_foto      jsonb := foto_righe();
  v_titolare  uuid;
  v_srls      uuid;
  v_cli       uuid;
  v_ord       uuid;
  v_f         uuid;
  v_prima     numeric;
  v_dopo      numeric;
  v_m         record;
  v_anno      integer := extract(year from oggi_a_roma())::integer;
  v_mese      integer := extract(month from oggi_a_roma())::integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select id into v_srls from entities where entity_type = 'srls' limit 1;
  if v_titolare is null or v_srls is null then
    raise exception 'VERIFICA: servono un titolare e Borgo 58.';
  end if;

  begin  -- <<< la sotto-transazione che verrà annullata
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    select coalesce(ricavi, 0) into v_prima from misure_del_mese(v_srls, v_anno, v_mese);

    insert into clienti_fattura (denominazione, partita_iva, indirizzo, cap, comune, provincia)
    values ('ZZ Ditta dei ricavi srl', '01234567897', 'Via Prova 8', '84043', 'Agropoli', 'SA')
    returning id into v_cli;

    -- (2) una bozza non conta
    insert into fatture_emesse (entity_id, cliente_id, data) values (v_srls, v_cli, oggi_a_roma()) returning id into v_f;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario)
    values (v_f, 1, 'ZZ Catering', 1, 250.00);
    select coalesce(ricavi, 0) into v_dopo from misure_del_mese(v_srls, v_anno, v_mese);
    if v_dopo <> v_prima then
      raise exception 'VERIFICA (2): una bozza è entrata nei ricavi del mese.';
    end if;

    -- (1) uscita: conta col suo totale
    update fatture_emesse set numero = 999999, stato = 'inviata', imponibile = 227.27, imposta = 22.73, totale = 250.00
     where id = v_f;
    select * into v_m from misure_del_mese(v_srls, v_anno, v_mese);
    if coalesce(v_m.ricavi, 0) <> v_prima + 250.00 or v_m.origine_ricavi <> 'misurato' then
      raise exception 'VERIFICA (1): la fattura senza tavolo non è entrata nei ricavi del mese col suo totale (prima %, dopo %).', v_prima, v_m.ricavi;
    end if;

    -- (3) la fattura di un conto non aggiunge niente oltre al conto
    insert into orders (entity_id, table_label, coperti, status, closed_at, documento_fiscale)
    values (v_srls, 'ZZ3', 1, 'chiuso', now(), 'fattura_da_emettere') returning id into v_ord;
    select coalesce(ricavi, 0) into v_prima from misure_del_mese(v_srls, v_anno, v_mese);
    insert into fatture_emesse (entity_id, cliente_id, data, order_id) values (v_srls, v_cli, oggi_a_roma(), v_ord) returning id into v_f;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario)
    values (v_f, 1, 'ZZ Cena', 1, 70.00);
    update fatture_emesse set numero = 999998, stato = 'inviata', imponibile = 63.64, imposta = 6.36, totale = 70.00
     where id = v_f;
    select coalesce(ricavi, 0) into v_dopo from misure_del_mese(v_srls, v_anno, v_mese);
    if v_dopo <> v_prima then
      raise exception 'VERIFICA (3): la fattura del conto di un tavolo ha aggiunto % ai ricavi: sarebbe contata due volte.', v_dopo - v_prima;
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dei ricavi delle fatture');

  raise notice 'Fatto: una fattura senza tavolo uscita entra nei ricavi del suo mese col suo totale; una bozza no; la fattura di un conto non aggiunge niente. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261113000008', 'la_proiezione_conta_le_fatture')
on conflict (version) do nothing;
