-- =====================================================================
-- GLI EVENTI SI CONTANO A PARTE (14/11/2026)
-- =====================================================================
--
-- Deciso da Alessio il 14/11: «gli eventi si contano con gli eventi, non con
-- lo scontrino medio dei normali servizi».
--
-- 🔴 IL PROBLEMA, che la 20261113000008 aveva creato: metteva il ricavo delle
--    fatture senza tavolo dentro `misure_del_mese.ricavi`. Quel numero è la
--    base dei «Ricavi di sala», e lo scontrino medio dell'andamento dell'anno
--    è ricavi / coperti: una fattura da 5.000 € per un evento alzava lo
--    scontrino medio dei servizi normali senza un coperto in più, e il
--    confronto col piano (che parla solo di sala) segnava «sopra il
--    previsto» a torto.
--
-- ⚠️ LA CURA TOCCA IL MINIMO: `ricavi` torna a essere quello di prima di ieri
--    (i soli conti dei tavoli), quindi scontrino medio, confronto col piano,
--    consuntivi congelati e chiusura dell'anno non cambiano di un euro. Gli
--    eventi sono una colonna in più, `ricavi_eventi`, con il numero delle
--    fatture, e la pagina dell'andamento mensile li mostra a parte.
--
-- Una funzione non può cambiare le colonne che restituisce: si elimina e si
-- ricrea (i permessi si rimettono qui sotto). La chiamano solo funzioni che
-- leggono le colonne per NOME, e funzioni del titolare.
--
-- Idempotente. Si auto-registra. Verifica annullata, zero residui.

drop function if exists public.misure_del_mese(uuid, integer, integer);

CREATE FUNCTION public.misure_del_mese(p_entity_id uuid, p_anno integer, p_mese integer)
 RETURNS TABLE(coperti numeric, ricavi numeric, food_cost numeric, fissi numeric, omaggi_costo numeric, omaggi_quanti integer, conti_chiusi integer, origine_coperti text, origine_ricavi text, origine_food_cost text, origine_fissi text, ricavi_eventi numeric, eventi_quanti integer)
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

  -- 🔴 GLI EVENTI SI CONTANO A PARTE (14/11/2026, deciso da Alessio: «gli
  --    eventi si contano con gli eventi, non con lo scontrino medio dei
  --    normali servizi»). Le fatture ai clienti SENZA tavolo (un evento, un
  --    catering) sono qui nella colonna `ricavi_eventi`, alla data della
  --    fattura e col totale, e NON nei `ricavi`: i `ricavi` restano quelli
  --    dei conti di sala, e con loro lo scontrino medio, il confronto col
  --    piano e i mesi congelati.
  --    ⚠️ SOLO senza tavolo: la fattura di un conto è già il conto.
  select coalesce(sum(fe.totale), 0), count(*) into v_fatt, v_fatture
    from fatture_emesse fe
   where fe.entity_id = p_entity_id
     and fe.order_id is null
     and fe.numero is not null
     and fe.data >= v_dal and fe.data < v_al;

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
    case when v_causali_marcate > 0 then 'misurato' else 'assente' end,
    v_fatt, v_fatture;
end;
$function$;

comment on function misure_del_mese(uuid, integer, integer) is
  'I numeri veri di un mese: coperti, ricavi incassati dai conti dei tavoli (con cui si calcolano lo scontrino medio e il confronto col piano), food cost, fissi, omaggi; e, a parte, i ricavi degli eventi (le fatture ai clienti senza tavolo, alla data della fattura). Solo il titolare.';
revoke all on function misure_del_mese(uuid, integer, integer) from public, anon, authenticated;
grant execute on function misure_del_mese(uuid, integer, integer) to authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione che si annulla
-- ---------------------------------------------------------------------
--   (1) una fattura senza tavolo uscita NON entra nei ricavi: entra in
--       ricavi_eventi, col suo totale e il suo conteggio;
--   (2) una bozza non conta da nessuna parte;
--   (3) la fattura del conto di un tavolo non aggiunge niente a nessuna
--       delle due.
do $verifica$
declare
  v_foto      jsonb := foto_righe();
  v_titolare  uuid;
  v_srls      uuid;
  v_cli       uuid;
  v_ord       uuid;
  v_f         uuid;
  v_prima     record;
  v_dopo      record;
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
    select * into v_prima from misure_del_mese(v_srls, v_anno, v_mese);

    insert into clienti_fattura (denominazione, partita_iva, indirizzo, cap, comune, provincia)
    values ('ZZ Ditta degli eventi srl', '01234567897', 'Via Prova 9', '84043', 'Agropoli', 'SA')
    returning id into v_cli;

    -- (2) una bozza non conta
    insert into fatture_emesse (entity_id, cliente_id, data) values (v_srls, v_cli, oggi_a_roma()) returning id into v_f;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario)
    values (v_f, 1, 'ZZ Catering', 1, 250.00);
    select * into v_dopo from misure_del_mese(v_srls, v_anno, v_mese);
    if v_dopo.ricavi_eventi <> v_prima.ricavi_eventi or v_dopo.ricavi is distinct from v_prima.ricavi then
      raise exception 'VERIFICA (2): una bozza è entrata nei numeri del mese.';
    end if;

    -- (1) uscita: negli eventi, non nei ricavi di sala
    update fatture_emesse set numero = 999999, stato = 'inviata', imponibile = 227.27, imposta = 22.73, totale = 250.00
     where id = v_f;
    select * into v_dopo from misure_del_mese(v_srls, v_anno, v_mese);
    if v_dopo.ricavi_eventi <> v_prima.ricavi_eventi + 250.00 or v_dopo.eventi_quanti <> v_prima.eventi_quanti + 1 then
      raise exception 'VERIFICA (1): la fattura senza tavolo non è entrata in ricavi_eventi col suo totale.';
    end if;
    if v_dopo.ricavi is distinct from v_prima.ricavi or v_dopo.origine_ricavi is distinct from v_prima.origine_ricavi then
      raise exception 'VERIFICA (1): la fattura di un evento ha toccato i ricavi di sala (e con loro lo scontrino medio).';
    end if;

    -- (3) la fattura di un conto non aggiunge niente
    insert into orders (entity_id, table_label, coperti, status, closed_at, documento_fiscale)
    values (v_srls, 'ZZ4', 1, 'chiuso', now(), 'fattura_da_emettere') returning id into v_ord;
    select * into v_prima from misure_del_mese(v_srls, v_anno, v_mese);
    insert into fatture_emesse (entity_id, cliente_id, data, order_id) values (v_srls, v_cli, oggi_a_roma(), v_ord) returning id into v_f;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario)
    values (v_f, 1, 'ZZ Cena', 1, 70.00);
    update fatture_emesse set numero = 999998, stato = 'inviata', imponibile = 63.64, imposta = 6.36, totale = 70.00
     where id = v_f;
    select * into v_dopo from misure_del_mese(v_srls, v_anno, v_mese);
    if v_dopo.ricavi_eventi <> v_prima.ricavi_eventi or v_dopo.ricavi is distinct from v_prima.ricavi then
      raise exception 'VERIFICA (3): la fattura del conto di un tavolo ha aggiunto qualcosa: sarebbe contata due volte.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica degli eventi a parte');

  raise notice 'Fatto: le fatture senza tavolo sono in ricavi_eventi e non nei ricavi di sala (né nello scontrino medio); una bozza e la fattura di un conto non aggiungono niente. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261114000002', 'gli_eventi_si_contano_a_parte')
on conflict (version) do nothing;
