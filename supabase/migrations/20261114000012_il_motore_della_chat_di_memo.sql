-- =====================================================================
-- IL MOTORE DELLA CHAT DI MEMO — 14/11/2026
-- =====================================================================
-- Prima di applicare: confrontare con il database vivo le funzioni riusate
-- (`piano_speso_per_voce`, `piano_rate_aperte`, `saldo_tesoreria`,
-- `agenda_corsie`, `da_pagare` e `v_stock_levels`). Questa migrazione non
-- ne copia le regole: le richiama o legge la loro vista.
--
-- rete-portieri: 20261114000012_il_motore_della_chat_di_memo.sql chiama memo_leggi_piano — la verifica impersona il titolare prima della lettura.
-- rete-portieri: 20261114000012_il_motore_della_chat_di_memo.sql chiama memo_leggi_cassa — la verifica impersona il titolare prima della lettura.
-- rete-portieri: 20261114000012_il_motore_della_chat_di_memo.sql chiama memo_leggi_fatture_fornitori — la verifica impersona il titolare prima della lettura.
-- rete-portieri: 20261114000012_il_motore_della_chat_di_memo.sql chiama memo_leggi_agenda — la verifica impersona il titolare prima della lettura.
-- rete-portieri: 20261114000012_il_motore_della_chat_di_memo.sql chiama memo_leggi_magazzino — la verifica impersona il titolare prima della lettura.
--
-- Tutte le letture hanno lo stesso contratto: massimo 50 righe, conteggio e
-- totale dichiarati in ogni riga. Gli id servono solo al motore per creare
-- `memo_riferimenti`: non arrivano mai nel testo della chat.
-- =====================================================================

-- Un costo sconosciuto non e' zero. La fondazione iniziale non poteva
-- esprimerlo per il NOT NULL: qui NULL significa precisamente «listino non
-- disponibile», e consumi_ai() lo dichiara gia' con costo_noto = false.
alter table memo_messaggi alter column costo_euro drop not null;
alter table memo_messaggi alter column costo_euro drop default;
comment on column memo_messaggi.costo_euro is
  'Costo del giro del modello. NULL significa che il listino non conosce il modello: non e'' zero e consumi_ai lo dichiara come costo non noto.';

create or replace function memo_leggi_piano(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with righe as (
    select v.id, v.descrizione, v.importo_ivato,
           jsonb_build_object('gruppo', v.gruppo, 'previsto', v.importo_ivato,
             'stato', v.stato, 'speso', coalesce(s.speso, 0), 'impegnato', coalesce(s.impegnato, 0),
             'rate_aperte', coalesce((select sum(r.aperto) from piano_rate_aperte() r where r.voce_id = v.id), 0)) as dettaglio
      from piano_voci v left join piano_speso_per_voce() s on s.voce_id = v.id
     where v.archiviata_il is null and (p_cerca is null or v.descrizione ilike '%' || p_cerca || '%')
     order by v.gruppo, v.ordine, v.id limit 50
  ) select id, descrizione, dettaglio, count(*) over ()::integer, coalesce(sum(importo_ivato) over (), 0) from righe;
end $fn$;

create or replace function memo_leggi_cassa(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with righe as (
    select m.id, coalesce(nullif(m.business_purpose, ''), c.label, 'Movimento di cassa') as titolo,
           case when m.direction = 'entrata' then m.amount else -m.amount end as firmato,
           jsonb_build_object('data', m.movement_date, 'verso', m.direction, 'importo', m.amount,
             'causale', c.label, 'descrizione', m.business_purpose, 'mezzo', m.mezzo,
             'saldo', (select to_jsonb(s) from saldo_tesoreria(m.entity_id) s)) as dettaglio
      from cash_movements m left join cash_causali c on c.id = m.causale_id
     where p_cerca is null or coalesce(m.business_purpose, '') ilike '%' || p_cerca || '%' or coalesce(c.label, '') ilike '%' || p_cerca || '%'
     order by m.movement_date desc, m.created_at desc, m.id limit 50
  ) select id, titolo, dettaglio, count(*) over ()::integer, coalesce(sum(firmato) over (), 0) from righe;
end $fn$;

create or replace function memo_leggi_fatture_fornitori(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with righe as (
    select i.id, coalesce(s.name, 'Fornitore') || coalesce(' · fattura ' || i.invoice_number, '') as titolo,
           da_pagare(i) as aperto,
           jsonb_build_object('fornitore', s.name, 'numero', i.invoice_number, 'data', i.invoice_date,
             'scadenza', i.due_date, 'stato', i.status, 'totale_fattura', i.amount, 'da_pagare', da_pagare(i)) as dettaglio
      from supplier_invoices i left join suppliers s on s.id = i.supplier_id
     where p_cerca is null or coalesce(s.name, '') ilike '%' || p_cerca || '%' or coalesce(i.invoice_number, '') ilike '%' || p_cerca || '%'
     order by i.due_date nulls last, i.invoice_date desc, i.id limit 50
  ) select id, titolo, dettaglio, count(*) over ()::integer, coalesce(sum(aperto) over (), 0) from righe;
end $fn$;

create or replace function memo_leggi_agenda(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with righe as (
    select a.id, a.title,
           jsonb_build_object('data', a.due_date, 'ora', a.due_time, 'corsia', a.corsia,
             'categoria', a.category, 'descrizione', a.description) as dettaglio
      from agenda_corsie() a
     where p_cerca is null or a.title ilike '%' || p_cerca || '%' or coalesce(a.description, '') ilike '%' || p_cerca || '%'
     order by a.due_date nulls last, a.due_time nulls last, a.id limit 50
  ) select id, title, dettaglio, count(*) over ()::integer, count(*) over ()::numeric from righe;
end $fn$;

create or replace function memo_leggi_magazzino(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with righe as (
    select v.ingredient_id, v.ingredient_name, v.current_quantity,
           jsonb_build_object('quantita', v.current_quantity, 'unita', v.unit, 'soglia', v.stock_minimum_threshold,
             'sotto_soglia', v.below_threshold, 'prossima_scadenza', v.nearest_expiry, 'mondo', v.mondo) as dettaglio
      from v_stock_levels v
     where p_cerca is null or v.ingredient_name ilike '%' || p_cerca || '%'
     order by v.ingredient_name, v.ingredient_id limit 50
  ) select ingredient_id, ingredient_name, dettaglio, count(*) over ()::integer, coalesce(sum(current_quantity) over (), 0) from righe;
end $fn$;

revoke all on function memo_leggi_piano(text) from public, anon, authenticated;
revoke all on function memo_leggi_cassa(text) from public, anon, authenticated;
revoke all on function memo_leggi_fatture_fornitori(text) from public, anon, authenticated;
revoke all on function memo_leggi_agenda(text) from public, anon, authenticated;
revoke all on function memo_leggi_magazzino(text) from public, anon, authenticated;
grant execute on function memo_leggi_piano(text), memo_leggi_cassa(text), memo_leggi_fatture_fornitori(text), memo_leggi_agenda(text), memo_leggi_magazzino(text) to authenticated;

-- Verifica interna: titolare legge 50 righe al massimo e ciascun totale e'
-- coerente con le righe restituite; lo staff riceve un rifiuto. Le funzioni
-- non scrivono, ma la foto e l'annullamento mantengono la forma comune.
do $verifica$
declare v_foto jsonb := foto_righe(); v_titolare uuid; v_staff uuid; v_n integer; v_no boolean;
        v_totale numeric; v_dichiarato numeric; v_conteggio integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null or v_staff is null then raise exception 'VERIFICA: servono un titolare e uno staff.'; end if;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*), coalesce(sum((dati->>'previsto')::numeric), 0), coalesce(max(totale), 0), coalesce(max(conteggio), 0)
      into v_n, v_totale, v_dichiarato, v_conteggio from memo_leggi_piano(null);
    if v_n > 50 or v_n <> v_conteggio or v_totale <> v_dichiarato then raise exception 'VERIFICA: piano senza limite, conteggio o totale corretto.'; end if;
    select count(*), coalesce(sum(case when dati->>'verso' = 'entrata' then (dati->>'importo')::numeric else -(dati->>'importo')::numeric end), 0), coalesce(max(totale), 0), coalesce(max(conteggio), 0)
      into v_n, v_totale, v_dichiarato, v_conteggio from memo_leggi_cassa(null);
    if v_n > 50 or v_n <> v_conteggio or v_totale <> v_dichiarato then raise exception 'VERIFICA: cassa senza limite, conteggio o totale corretto.'; end if;
    select count(*), coalesce(sum((dati->>'da_pagare')::numeric), 0), coalesce(max(totale), 0), coalesce(max(conteggio), 0)
      into v_n, v_totale, v_dichiarato, v_conteggio from memo_leggi_fatture_fornitori(null);
    if v_n > 50 or v_n <> v_conteggio or v_totale <> v_dichiarato then raise exception 'VERIFICA: fatture senza limite, conteggio o totale corretto.'; end if;
    select count(*), count(*)::numeric, coalesce(max(totale), 0), coalesce(max(conteggio), 0)
      into v_n, v_totale, v_dichiarato, v_conteggio from memo_leggi_agenda(null);
    if v_n > 50 or v_n <> v_conteggio or v_totale <> v_dichiarato then raise exception 'VERIFICA: agenda senza limite, conteggio o totale corretto.'; end if;
    select count(*), coalesce(sum((dati->>'quantita')::numeric), 0), coalesce(max(totale), 0), coalesce(max(conteggio), 0)
      into v_n, v_totale, v_dichiarato, v_conteggio from memo_leggi_magazzino(null);
    if v_n > 50 or v_n <> v_conteggio or v_totale <> v_dichiarato then raise exception 'VERIFICA: magazzino senza limite, conteggio o totale corretto.'; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_no := false; begin perform * from memo_leggi_cassa(null); exception when raise_exception then v_no := true; end;
    if not v_no then raise exception 'VERIFICA: lo staff ha letto la cassa dalla chat.'; end if;
    raise exception 'ZZ_ANNULLA';
  exception when others then if sqlerrm <> 'ZZ_ANNULLA' then raise; end if; end;
  reset role; perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica del motore della chat di MEMO');
end $verifica$;

insert into applied_migrations (version, name)
values ('20261114000012', 'il_motore_della_chat_di_memo') on conflict (version) do nothing;
