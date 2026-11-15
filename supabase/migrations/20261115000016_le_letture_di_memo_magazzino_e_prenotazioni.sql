-- =====================================================================
-- LE LETTURE DI MEMO COME LE PAGINE: MAGAZZINO E PRENOTAZIONI — 15/11/2026
-- =====================================================================
--
-- Dal rapporto del revisore (RAPPORTO_revisore_letture_MEMO_15-11.md):
--   · MAGAZZINO: «sotto soglia» era solo `below_threshold`; la pagina
--     (`sottoScorta`) lo vuole anche `tenuto_in_magazzino`: un prodotto che
--     si è deciso di non tenere non è mai sotto scorta (era il «55 contro 54»
--     già annotato nel codice della pagina).
--   · PRENOTAZIONI: conteggio e totale contavano tutte le prenotazioni di
--     sempre, annullate e rifiutate comprese. La pagina dei coperti conta solo
--     le confermate e le in attesa («escluse rifiutate/annullate»): ora
--     conteggio = prenotazioni valide e totale = coperti delle valide; le
--     valide vengono per prime (le altre si vedono dopo, con lo stato).
--
-- La verifica contiene anche il caso della BANCA (un movimento da abbinare, uno
-- abbinato, uno ignorato): i movimenti di banca si caricano solo da file e non
-- si cancellano dal client, quindi non si possono provare dalla prova dei
-- Controlli; qui si provano dentro una transazione che si annulla.
--
-- rete-portieri: 20261115000016 chiama memo_leggi_magazzino — la verifica impersona il titolare prima della lettura.
-- rete-portieri: 20261115000016 chiama memo_leggi_prenotazioni — la verifica impersona il titolare prima della lettura.
-- rete-portieri: 20261115000016 chiama memo_leggi_banca — la verifica impersona il titolare prima della lettura.
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

create or replace function memo_leggi_magazzino(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with tutte as (
    select v.ingredient_id as rid, v.ingredient_name as titolo,
           jsonb_build_object('quantita', v.current_quantity, 'unita', v.unit, 'soglia', v.stock_minimum_threshold,
             'sotto_soglia', (v.below_threshold and v.tenuto_in_magazzino), 'tenuto_in_magazzino', v.tenuto_in_magazzino, 'prossima_scadenza', v.nearest_expiry, 'mondo', v.mondo) as dettaglio,
           count(*) over () as n, 0::numeric as tot
      from v_stock_levels v
     where p_cerca is null or v.ingredient_name ilike '%' || p_cerca || '%'
  )
  select t.rid, t.titolo, t.dettaglio, t.n::integer, t.tot from tutte t
   order by t.titolo, t.rid limit 50;
end $fn$;

create or replace function memo_leggi_prenotazioni(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with righe as (
    select r.id, coalesce(nullif(r.customer_name, ''), 'Prenotazione') as titolo, r.reservation_date as ord1, r.reservation_time as ord2,
           (r.status in ('confermata', 'richiesta_in_attesa')) as vale, coalesce(r.party_size, 0) as coperti,
           jsonb_build_object(
             'data_prenotazione', r.reservation_date, 'ora_prenotazione', r.reservation_time,
             'persone', r.party_size, 'stato', r.status, 'tipo', r.type,
             'ha_note', nullif(btrim(coalesce(r.notes, '')), '') is not null,
             'tavoli', coalesce((select jsonb_agg(pt.etichetta_al_momento order by pt.etichetta_al_momento)
                                  from prenotazione_tavoli pt where pt.reservation_id = r.id), '[]'::jsonb)
           ) as dettaglio
      from reservations r
     where p_cerca is null
        or coalesce(r.customer_name, '') ilike '%' || p_cerca || '%'
        or coalesce(r.customer_phone, '') ilike '%' || p_cerca || '%'
        or coalesce(r.customer_email, '') ilike '%' || p_cerca || '%'
  ) select id, titolo, dettaglio, (count(*) filter (where vale) over ())::integer, (coalesce(sum(coperti) filter (where vale) over (), 0))::numeric from righe
   order by vale desc, (ord1 >= (now() at time zone 'Europe/Rome')::date) desc,
            case when ord1 >= (now() at time zone 'Europe/Rome')::date then ord1 end asc,
            case when ord1 >= (now() at time zone 'Europe/Rome')::date then ord2 end asc,
            ord1 desc, ord2 desc, id limit 50;
end $fn$;

revoke all on function memo_leggi_magazzino(text), memo_leggi_prenotazioni(text) from public, anon, authenticated;
grant execute on function memo_leggi_magazzino(text), memo_leggi_prenotazioni(text) to authenticated;

do $verifica$
declare
  v_foto jsonb := foto_righe(); v_titolare uuid; v_srls uuid; v_conto uuid; v_cm uuid;
  v_n integer; v_cont integer; v_tot numeric; v_primo text; v_ing uuid;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select id into v_srls from entities where entity_type = 'srls' limit 1;
  if v_titolare is null or v_srls is null then raise exception 'VERIFICA: servono un titolare e Borgo 58.'; end if;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- 1. PRENOTAZIONI: confermata (4) + in attesa (2) valgono; annullata (8) e rifiutata (3) no.
    insert into reservations (customer_name, reservation_date, reservation_time, party_size, status, type)
    values ('ZZ conf', current_date + 2, '20:00', 4, 'confermata', 'prenotazione'),
           ('ZZ attesa', current_date + 2, '20:30', 2, 'richiesta_in_attesa', 'prenotazione'),
           ('ZZ annullata', current_date + 2, '21:00', 8, 'annullata', 'prenotazione'),
           ('ZZ rifiutata', current_date + 2, '21:30', 3, 'rifiutata', 'prenotazione');
    set local role authenticated;
    select count(*), max(l.conteggio), max(l.totale) into v_n, v_cont, v_tot from memo_leggi_prenotazioni('ZZ ') l;
    if v_n <> 4 or v_cont <> 2 or v_tot <> 6 then
      raise exception 'VERIFICA (1): prenotazioni % righe, valide %, coperti % (attesi 4, 2, 6).', v_n, v_cont, v_tot;
    end if;
    select l.dati->>'stato' into v_primo from memo_leggi_prenotazioni('ZZ ') l limit 1;
    if v_primo not in ('confermata', 'richiesta_in_attesa') then
      raise exception 'VERIFICA (1b): la prima prenotazione non e'' una valida (%).', v_primo;
    end if;
    reset role;

    -- 2. MAGAZZINO: un prodotto sotto soglia ma non tenuto in magazzino non e' sotto soglia.
    insert into ingredients (entity_id, name, category, unit, stock_minimum_threshold, tenuto_in_magazzino)
    values (v_srls, 'ZZ non tenuto', 'verdura', 'kg', 5, false) returning id into v_ing;
    set local role authenticated;
    select (l.dati->>'sotto_soglia')::boolean::text into v_primo from memo_leggi_magazzino('ZZ non tenuto') l limit 1;
    if v_primo is distinct from 'false' then
      raise exception 'VERIFICA (2): un prodotto non tenuto risulta sotto soglia (%).', v_primo;
    end if;
    reset role;

    -- 3. BANCA: da abbinare + abbinato contano, l'ignorato resta fuori, il da abbinare viene prima.
    insert into conti_bancari (entity_id, nome) values (v_srls, 'ZZ conto prova') returning id into v_conto;
    insert into cash_movements (entity_id, direction, amount, movement_date, mezzo, business_purpose)
    values (v_srls, 'entrata', 200, current_date, 'cassa', 'ZZ abbinamento') returning id into v_cm;
    insert into movimenti_banca (conto_id, impronta, data_contabile, data_valuta, importo, descrizione, flusso, cash_movement_id)
    values (v_conto, 'ZZ-B1', current_date, current_date, 200, 'ZZ abbinato', 'entrata', v_cm);
    insert into movimenti_banca (conto_id, impronta, data_contabile, data_valuta, importo, descrizione, flusso)
    values (v_conto, 'ZZ-B2', current_date, current_date, 50, 'ZZ da abbinare', 'entrata');
    insert into movimenti_banca (conto_id, impronta, data_contabile, data_valuta, importo, descrizione, flusso, ignorato_il, ignorato_perche)
    values (v_conto, 'ZZ-B3', current_date, current_date, -10, 'ZZ ignorato', 'uscita', now(), 'prova');
    set local role authenticated;
    select count(*), max(l.conteggio), max(l.totale) into v_n, v_cont, v_tot from memo_leggi_banca('ZZ conto prova') l;
    if v_n <> 2 or v_cont <> 2 or v_tot <> 250 then
      raise exception 'VERIFICA (3): banca % righe, conteggio %, totale % (attesi 2, 2, 250).', v_n, v_cont, v_tot;
    end if;
    select l.dati->>'stato' into v_primo from memo_leggi_banca('ZZ conto prova') l limit 1;
    if v_primo <> 'da abbinare' then
      raise exception 'VERIFICA (3b): la prima riga di banca non e'' da abbinare (%).', v_primo;
    end if;
    reset role;
    raise exception 'ZZ_ANNULLA';
  exception when others then reset role; if sqlerrm <> 'ZZ_ANNULLA' then raise; end if; end;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica di magazzino, prenotazioni e banca');
  raise notice 'Fatto: magazzino e prenotazioni contano come le pagine; la banca lascia fuori gli ignorati. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261115000016', 'le_letture_di_memo_magazzino_e_prenotazioni') on conflict (version) do nothing;
