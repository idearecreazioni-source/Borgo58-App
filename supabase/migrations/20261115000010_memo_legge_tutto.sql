-- =====================================================================
-- MEMO LEGGE TUTTO — 15/11/2026
-- =====================================================================
-- Prima di applicare: confrontare con il database vivo le funzioni riusate
-- e le viste `v_recipe_costs` e `v_haccp_temperature_logs`. Questa
-- migrazione non ne copia i calcoli: legge le stesse fonti delle schermate.
--
-- Ogni lettura restituisce al massimo 50 righe; conteggio e totale sono
-- ripetuti su ogni riga. Gli identificativi servono soltanto a MEMO per i
-- riferimenti brevi e non arrivano mai al modello.
-- =====================================================================

create or replace function memo_leggi_banca(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with righe as (
    select m.id, coalesce(nullif(m.descrizione, ''), 'Movimento di banca') as titolo, m.importo,
           jsonb_build_object(
             'conto', c.nome, 'data_contabile', m.data_contabile, 'data_valuta', m.data_valuta,
             'importo', m.importo, 'descrizione', m.descrizione,
             'riferimento_banca', m.riferimento_banca,
             'stato', case when m.ignorato_il is not null then 'ignorato'
                           when m.cash_movement_id is not null then 'abbinato'
                           else 'da abbinare' end,
             'saldo_conto_dai_movimenti_caricati', coalesce((
               select sum(t.importo) from movimenti_banca t where t.conto_id = m.conto_id
             ), 0)
           ) as dettaglio
      from movimenti_banca m
      join conti_bancari c on c.id = m.conto_id
     where p_cerca is null
        or c.nome ilike '%' || p_cerca || '%'
        or coalesce(m.descrizione, '') ilike '%' || p_cerca || '%'
        or coalesce(m.riferimento_banca, '') ilike '%' || p_cerca || '%'
     order by m.data_contabile desc, m.caricato_il desc, m.id
     limit 50
  ) select id, titolo, dettaglio, count(*) over ()::integer, coalesce(sum(importo) over (), 0) from righe;
end $fn$;

create or replace function memo_leggi_prenotazioni(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with righe as (
    select r.id, coalesce(nullif(r.customer_name, ''), 'Prenotazione') as titolo,
           jsonb_build_object(
             'data_prenotazione', r.reservation_date, 'ora_prenotazione', r.reservation_time,
             'persone', r.party_size, 'stato', r.status, 'tipo', r.type,
             'telefono', r.customer_phone, 'email', r.customer_email, 'note', r.notes,
             'tavoli', coalesce((select jsonb_agg(pt.etichetta_al_momento order by pt.etichetta_al_momento)
                                  from prenotazione_tavoli pt where pt.reservation_id = r.id), '[]'::jsonb)
           ) as dettaglio
      from reservations r
     where p_cerca is null
        or coalesce(r.customer_name, '') ilike '%' || p_cerca || '%'
        or coalesce(r.customer_phone, '') ilike '%' || p_cerca || '%'
        or coalesce(r.customer_email, '') ilike '%' || p_cerca || '%'
     order by r.reservation_date, r.reservation_time, r.id
     limit 50
  ) select id, titolo, dettaglio, count(*) over ()::integer, count(*) over ()::numeric from righe;
end $fn$;

create or replace function memo_leggi_haccp(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with tutte as (
    select t.id, t.recorded_at as quando, t.equipment_name || ' · temperatura' as titolo,
           jsonb_build_object('registro', 'temperature', 'attrezzatura', t.equipment_name,
             'temperatura', t.recorded_temp_c, 'rilevata_il', t.recorded_at,
             'minimo', t.target_min_c, 'massimo', t.target_max_c,
             'conforme', t.is_compliant, 'nota', t.note, 'rimedio', t.corrective_action) as dettaglio
      from v_haccp_temperature_logs t
    union all
    select n.id, n.detected_at, 'Non conformita · ' || n.category,
           jsonb_build_object('registro', 'non conformita', 'categoria', n.category,
             'descrizione', n.description, 'rilevata_il', n.detected_at,
             'risolta', n.resolved, 'risolta_il', n.resolved_at,
             'rimedio', n.corrective_action, 'nota', n.note)
      from haccp_non_conformities n
    union all
    select g.id, g.received_at, 'Ricevimento merci · ' || g.product_description,
           jsonb_build_object('registro', 'ricevimento merci', 'prodotto', g.product_description,
             'ricevuto_il', g.received_at, 'temperatura', g.temperature_c,
             'imballo_integro', g.packaging_ok, 'conforme', g.conformity, 'nota', g.note)
      from haccp_goods_receiving g
    union all
    select l.id, l.completed_at, 'Pulizia · ' || t.name,
           jsonb_build_object('registro', 'pulizie', 'attivita', t.name, 'area', t.area,
             'frequenza', t.frequency, 'completata_il', l.completed_at, 'nota', l.note)
      from haccp_cleaning_logs l join haccp_cleaning_tasks t on t.id = l.task_id
    union all
    select p.id, p.performed_at, 'Disinfestazione · ' || p.type,
           jsonb_build_object('registro', 'disinfestazione', 'tipo', p.type,
             'eseguita_il', p.performed_at, 'eseguita_da', p.performed_by,
             'riscontro', p.findings, 'nota', p.note)
      from haccp_pest_control_logs p
  ), righe as (
    select * from tutte
     where p_cerca is null or titolo ilike '%' || p_cerca || '%' or dettaglio::text ilike '%' || p_cerca || '%'
     order by quando desc, id
     limit 50
  ) select id, titolo, dettaglio, count(*) over ()::integer, count(*) over ()::numeric from righe;
end $fn$;

create or replace function memo_leggi_costo_piatti(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with righe as (
    select r.id, r.name, c.food_cost_portion,
           jsonb_build_object('tipo', r.recipe_type, 'categoria', r.category,
             'porzioni', c.portions_yield, 'costo_ricetta', c.food_cost_base,
             'costo_porzione', c.food_cost_portion, 'in_carta', r.in_carta,
             'pronta_per_carta', r.pronta_per_carta, 'ritirata_il', r.ritirata_il) as dettaglio
      from recipes r
      join v_recipe_costs c on c.recipe_id = r.id
     where p_cerca is null or r.name ilike '%' || p_cerca || '%'
     order by r.name, r.id
     limit 50
  ) select id, name, dettaglio, count(*) over ()::integer, coalesce(sum(food_cost_portion) over (), 0) from righe;
end $fn$;

create or replace function memo_leggi_documenti(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with righe as (
    select d.id, d.title, d.amount,
           jsonb_build_object('tipo', d.doc_type, 'controparti', d.counterparties,
             'importo', d.amount, 'data_documento', d.document_date,
             'data_scadenza', d.expiry_date, 'nome_file', d.file_name,
             'ha_file', d.storage_path is not null, 'nota', d.note) as dettaglio
      from documents d
     where p_cerca is null
        or d.title ilike '%' || p_cerca || '%'
        or coalesce(d.doc_type, '') ilike '%' || p_cerca || '%'
        or coalesce(d.counterparties, '') ilike '%' || p_cerca || '%'
     order by d.document_date desc nulls last, d.created_at desc, d.id
     limit 50
  ) select id, title, dettaglio, count(*) over ()::integer, coalesce(sum(amount) over (), 0) from righe;
end $fn$;

create or replace function memo_leggi_fatture_clienti(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with righe as (
    select f.id,
           coalesce(nullif(c.denominazione, ''), nullif(trim(concat_ws(' ', c.nome, c.cognome)), ''), 'Cliente')
             || coalesce(' · fattura ' || f.numero::text, ' · bozza') as titolo,
           f.totale,
           jsonb_build_object('cliente', coalesce(nullif(c.denominazione, ''), nullif(trim(concat_ws(' ', c.nome, c.cognome)), '')),
             'numero', f.numero, 'stato', f.stato, 'imponibile', f.imponibile,
             'imposta', f.imposta, 'totale', f.totale, 'data_fattura', f.data,
             'emessa_il', f.emessa_il, 'inviata_il', f.inviata_il,
             'esito_il', f.esito_il, 'esito', f.esito_note, 'modalita_pagamento', f.modalita_pagamento) as dettaglio
      from fatture_emesse f
      join clienti_fattura c on c.id = f.cliente_id
     where p_cerca is null
        or coalesce(c.denominazione, '') ilike '%' || p_cerca || '%'
        or concat_ws(' ', c.nome, c.cognome) ilike '%' || p_cerca || '%'
        or coalesce(f.numero::text, '') ilike '%' || p_cerca || '%'
     order by f.data desc, f.numero desc nulls first, f.id
     limit 50
  ) select id, titolo, dettaglio, count(*) over ()::integer, coalesce(sum(totale) over (), 0) from righe;
end $fn$;

revoke all on function memo_leggi_banca(text), memo_leggi_prenotazioni(text), memo_leggi_haccp(text), memo_leggi_costo_piatti(text), memo_leggi_documenti(text), memo_leggi_fatture_clienti(text) from public, anon, authenticated;
grant execute on function memo_leggi_banca(text), memo_leggi_prenotazioni(text), memo_leggi_haccp(text), memo_leggi_costo_piatti(text), memo_leggi_documenti(text), memo_leggi_fatture_clienti(text) to authenticated;

-- Verifica interna: lo staff e' respinto; ogni elenco e' entro 50 righe e
-- dichiara conteggio e totale coerenti. Non lascia niente: l'eccezione
-- finale annulla anche il contesto di ruolo e la foto controlla i residui.
do $verifica$
declare
  v_foto jsonb := foto_righe(); v_titolare uuid; v_staff uuid; v_n integer;
  v_totale numeric; v_dichiarato numeric; v_conteggio integer; v_no boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null or v_staff is null then raise exception 'VERIFICA: servono un titolare e uno staff.'; end if;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*), coalesce(sum((dati->>'importo')::numeric), 0), coalesce(max(totale), 0), coalesce(max(conteggio), 0)
      into v_n, v_totale, v_dichiarato, v_conteggio from memo_leggi_banca(null);
    if v_n > 50 or v_n <> v_conteggio or v_totale <> v_dichiarato then raise exception 'VERIFICA: banca senza limite, conteggio o totale.'; end if;
    select count(*), count(*)::numeric, coalesce(max(totale), 0), coalesce(max(conteggio), 0)
      into v_n, v_totale, v_dichiarato, v_conteggio from memo_leggi_prenotazioni(null);
    if v_n > 50 or v_n <> v_conteggio or v_totale <> v_dichiarato then raise exception 'VERIFICA: prenotazioni senza limite, conteggio o totale.'; end if;
    select count(*), count(*)::numeric, coalesce(max(totale), 0), coalesce(max(conteggio), 0)
      into v_n, v_totale, v_dichiarato, v_conteggio from memo_leggi_haccp(null);
    if v_n > 50 or v_n <> v_conteggio or v_totale <> v_dichiarato then raise exception 'VERIFICA: HACCP senza limite, conteggio o totale.'; end if;
    select count(*), coalesce(sum((dati->>'costo_porzione')::numeric), 0), coalesce(max(totale), 0), coalesce(max(conteggio), 0)
      into v_n, v_totale, v_dichiarato, v_conteggio from memo_leggi_costo_piatti(null);
    if v_n > 50 or v_n <> v_conteggio or v_totale <> v_dichiarato then raise exception 'VERIFICA: costo piatti senza limite, conteggio o totale.'; end if;
    select count(*), coalesce(sum((dati->>'importo')::numeric), 0), coalesce(max(totale), 0), coalesce(max(conteggio), 0)
      into v_n, v_totale, v_dichiarato, v_conteggio from memo_leggi_documenti(null);
    if v_n > 50 or v_n <> v_conteggio or v_totale <> v_dichiarato then raise exception 'VERIFICA: documenti senza limite, conteggio o totale.'; end if;
    select count(*), coalesce(sum((dati->>'totale')::numeric), 0), coalesce(max(totale), 0), coalesce(max(conteggio), 0)
      into v_n, v_totale, v_dichiarato, v_conteggio from memo_leggi_fatture_clienti(null);
    if v_n > 50 or v_n <> v_conteggio or v_totale <> v_dichiarato then raise exception 'VERIFICA: fatture clienti senza limite, conteggio o totale.'; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_no := false; begin perform * from memo_leggi_banca(null); exception when raise_exception then v_no := true; end;
    if not v_no then raise exception 'VERIFICA: lo staff ha letto la banca dalla chat.'; end if;
    raise exception 'ZZ_ANNULLA';
  exception when others then if sqlerrm <> 'ZZ_ANNULLA' then raise; end if; end;
  reset role; perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica di MEMO legge tutto');
end $verifica$;

insert into applied_migrations (version, name)
values ('20261115000010', 'memo_legge_tutto') on conflict (version) do nothing;
