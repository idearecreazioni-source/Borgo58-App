-- =====================================================================
-- IL MOTORE DELLA CHAT DI MEMO: CONTEGGI E TOTALI SU TUTTE LE RIGHE — 14/11/2026
-- =====================================================================
--
-- La 20261114000012 è già applicata e non si riscrive. La revisione ha
-- trovato che `conteggio` e `totale` erano calcolati DOPO il taglio a 50
-- righe: non potevano mai dire «ce ne sono di più» e il totale copriva solo
-- le prime 50. Qui le cinque letture contano e sommano TUTTE le righe che
-- rispondono alla ricerca, poi restituiscono le prime 50.
--
-- Due ritocchi in più: le fatture ancora da pagare vengono PRIMA di quelle
-- saldate (altrimenti le 50 righe se le prendono le più vecchie, già pagate),
-- e il saldo della cassa si calcola solo per le 50 righe restituite.
--
-- rete-portieri: 20261114000015 chiama memo_leggi_piano — la verifica impersona il titolare prima della lettura.
-- rete-portieri: 20261114000015 chiama memo_leggi_cassa — la verifica impersona il titolare prima della lettura.
-- rete-portieri: 20261114000015 chiama memo_leggi_fatture_fornitori — la verifica impersona il titolare prima della lettura.
-- rete-portieri: 20261114000015 chiama memo_leggi_agenda — la verifica impersona il titolare prima della lettura.
-- rete-portieri: 20261114000015 chiama memo_leggi_magazzino — la verifica impersona il titolare prima della lettura.
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

create or replace function memo_leggi_piano(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with tutte as (
    select v.id as rid, v.descrizione as titolo, v.gruppo as gr, v.ordine as ord,
           jsonb_build_object('gruppo', v.gruppo, 'previsto', v.importo_ivato,
             'stato', v.stato, 'speso', coalesce(s.speso, 0), 'impegnato', coalesce(s.impegnato, 0),
             'rate_aperte', coalesce((select sum(r.aperto) from piano_rate_aperte() r where r.voce_id = v.id), 0)) as dettaglio,
           count(*) over () as n, coalesce(sum(v.importo_ivato) over (), 0) as tot
      from piano_voci v left join piano_speso_per_voce() s on s.voce_id = v.id
     where v.archiviata_il is null and (p_cerca is null or v.descrizione ilike '%' || p_cerca || '%')
  )
  select t.rid, t.titolo, t.dettaglio, t.n::integer, t.tot from tutte t
   order by t.gr, t.ord, t.rid limit 50;
end $fn$;

create or replace function memo_leggi_cassa(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with tutte as (
    select m.id as rid, m.entity_id as ent, m.movement_date as dt, m.created_at as creato,
           coalesce(nullif(m.business_purpose, ''), c.label, 'Movimento di cassa') as titolo,
           m.direction as verso, m.amount as importo, c.label as causale,
           m.business_purpose as descrizione, m.mezzo as mezzo,
           count(*) over () as n,
           coalesce(sum(case when m.direction = 'entrata' then m.amount else -m.amount end) over (), 0) as tot
      from cash_movements m left join cash_causali c on c.id = m.causale_id
     where p_cerca is null or coalesce(m.business_purpose, '') ilike '%' || p_cerca || '%' or coalesce(c.label, '') ilike '%' || p_cerca || '%'
  ), prime as (
    select * from tutte order by dt desc, creato desc, rid limit 50
  )
  select p.rid, p.titolo,
         jsonb_build_object('data', p.dt, 'verso', p.verso, 'importo', p.importo,
           'causale', p.causale, 'descrizione', p.descrizione, 'mezzo', p.mezzo,
           'saldo', (select to_jsonb(s) from saldo_tesoreria(p.ent) s)),
         p.n::integer, p.tot
    from prime p order by p.dt desc, p.creato desc, p.rid;
end $fn$;

create or replace function memo_leggi_fatture_fornitori(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with tutte as (
    select i.id as rid, i.due_date as scad, i.invoice_date as dt,
           coalesce(s.name, 'Fornitore') || coalesce(' · fattura ' || i.invoice_number, '') as titolo,
           da_pagare(i) as aperto,
           jsonb_build_object('fornitore', s.name, 'numero', i.invoice_number, 'data', i.invoice_date,
             'scadenza', i.due_date, 'stato', i.status, 'totale_fattura', i.amount, 'da_pagare', da_pagare(i)) as dettaglio
      from supplier_invoices i left join suppliers s on s.id = i.supplier_id
     where p_cerca is null or coalesce(s.name, '') ilike '%' || p_cerca || '%' or coalesce(i.invoice_number, '') ilike '%' || p_cerca || '%'
  ), conto as (
    select t.*, count(*) over () as n, coalesce(sum(t.aperto) over (), 0) as tot from tutte t
  )
  select c.rid, c.titolo, c.dettaglio, c.n::integer, c.tot from conto c
   order by (coalesce(c.aperto, 0) > 0) desc, c.scad nulls last, c.dt desc, c.rid limit 50;
end $fn$;

create or replace function memo_leggi_agenda(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with tutte as (
    select a.id as rid, a.title as titolo, a.due_date as scad, a.due_time as ora,
           jsonb_build_object('data', a.due_date, 'ora', a.due_time, 'corsia', a.corsia,
             'categoria', a.category, 'descrizione', a.description) as dettaglio,
           count(*) over () as n
      from agenda_corsie() a
     where p_cerca is null or a.title ilike '%' || p_cerca || '%' or coalesce(a.description, '') ilike '%' || p_cerca || '%'
  )
  select t.rid, t.titolo, t.dettaglio, t.n::integer, t.n::numeric from tutte t
   order by t.scad nulls last, t.ora nulls last, t.rid limit 50;
end $fn$;

create or replace function memo_leggi_magazzino(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with tutte as (
    select v.ingredient_id as rid, v.ingredient_name as titolo,
           jsonb_build_object('quantita', v.current_quantity, 'unita', v.unit, 'soglia', v.stock_minimum_threshold,
             'sotto_soglia', v.below_threshold, 'prossima_scadenza', v.nearest_expiry, 'mondo', v.mondo) as dettaglio,
           count(*) over () as n, coalesce(sum(v.current_quantity) over (), 0) as tot
      from v_stock_levels v
     where p_cerca is null or v.ingredient_name ilike '%' || p_cerca || '%'
  )
  select t.rid, t.titolo, t.dettaglio, t.n::integer, t.tot from tutte t
   order by t.titolo, t.rid limit 50;
end $fn$;

revoke all on function memo_leggi_piano(text) from public, anon, authenticated;
revoke all on function memo_leggi_cassa(text) from public, anon, authenticated;
revoke all on function memo_leggi_fatture_fornitori(text) from public, anon, authenticated;
revoke all on function memo_leggi_agenda(text) from public, anon, authenticated;
revoke all on function memo_leggi_magazzino(text) from public, anon, authenticated;
grant execute on function memo_leggi_piano(text), memo_leggi_cassa(text), memo_leggi_fatture_fornitori(text), memo_leggi_agenda(text), memo_leggi_magazzino(text) to authenticated;

-- Verifica: con più di 50 righe il conteggio e il totale dicono la verità,
-- e lo staff continua a ricevere un rifiuto.
do $verifica$
declare
  v_foto jsonb := foto_righe(); v_titolare uuid; v_staff uuid;
  v_n integer; v_conteggio integer; v_totale numeric; v_no boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null or v_staff is null then raise exception 'VERIFICA: servono un titolare e uno staff.'; end if;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    insert into piano_voci (gruppo, ordine, descrizione, importo_ivato, aliquota_iva, stato)
    select 'D', 5000 + g, 'ZZ voce conteggio ' || g, 10, 22, 'stimato' from generate_series(1, 55) g;
    set local role authenticated;
    select count(*), max(l.conteggio), max(l.totale) into v_n, v_conteggio, v_totale from memo_leggi_piano('ZZ voce conteggio') l;
    if v_n <> 50 or v_conteggio <> 55 or v_totale <> 550 then
      raise exception 'VERIFICA (1): con 55 righe risultano % righe, conteggio %, totale % (attesi 50, 55, 550).', v_n, v_conteggio, v_totale;
    end if;
    perform * from memo_leggi_cassa(null);
    perform * from memo_leggi_fatture_fornitori(null);
    perform * from memo_leggi_agenda(null);
    perform * from memo_leggi_magazzino(null);
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_no := false; begin perform * from memo_leggi_cassa(null); exception when raise_exception then v_no := true; end;
    if not v_no then raise exception 'VERIFICA (2): lo staff ha letto la cassa dalla chat.'; end if;
    reset role;
    raise exception 'ZZ_ANNULLA';
  exception when others then reset role; if sqlerrm <> 'ZZ_ANNULLA' then raise; end if; end;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dei conteggi della chat di MEMO');
  raise notice 'Fatto: la chat conta e somma tutte le righe, non solo le prime 50; le fatture da pagare vengono prima. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261114000015', 'il_motore_della_chat_conta_tutto') on conflict (version) do nothing;
