-- =====================================================================
-- LE LETTURE DI MEMO DICONO QUELLO CHE DICONO LE PAGINE — 15/11/2026
-- =====================================================================
--
-- Il 15/11 Alessio ha chiesto alla chat «quante voci ci sono nel piano?»:
-- 69 voci e 98.586,80 €, mentre la pagina diceva 63 voci e 77.620,80 €.
-- Un revisore (Fable 5.2) ha confrontato le undici letture con le pagine
-- (RAPPORTO_revisore_letture_MEMO_15-11.md). Questa migrazione corregge
-- quelle che non coincidevano. Le funzioni si riscrivono per intero perché
-- il difetto era nella loro forma (la 20261114000012, 15 e le 20261115000010,
-- 11 sono già applicate e non si riscrivono):
--
--   1. PIANO: l'elenco è fatto dalle voci «foglia» (quelle che non hanno
--      sottovoci vive), come la pagina. La voce madre ha cifra, speso e rate
--      calcolati dalle sottovoci: contarla insieme a loro la conta due volte.
--      Una sottovoce porta il nome della madre, così «la cucina» si trova.
--   2. FATTURE FORNITORI: «da pagare» vale solo per le fatture non pagate
--      (`da_pagare()` è importo meno note di credito e non guarda lo stato);
--      prima vengono le non pagate.
--   3. CASSA: ogni riga dice il soggetto, e conteggio e totale sono per
--      soggetto (Borgo 58 e la tasca personale non si mescolano).
--   4. BANCA: niente «saldo» dai movimenti caricati (non è il saldo, manca
--      quello di partenza); i movimenti ignorati restano fuori, come nella
--      scheda a parte della pagina; prima i movimenti da abbinare.
--   5. HACCP: prima le non conformità aperte e le temperature fuori soglia;
--      la ricerca non guarda più i nomi dei campi.
--   6. AGENDA e MAGAZZINO: il «totale» non vuol dire niente (un conteggio
--      ripetuto, unità diverse sommate): è zero, e lo dice la descrizione
--      dello strumento.
--
-- rete-portieri: 20261115000013 chiama memo_leggi_piano — la verifica impersona il titolare prima della lettura.
-- rete-portieri: 20261115000013 chiama memo_leggi_fatture_fornitori — la verifica impersona il titolare prima della lettura.
-- rete-portieri: 20261115000013 chiama memo_leggi_cassa — la verifica impersona il titolare prima della lettura.
-- rete-portieri: 20261115000013 chiama memo_leggi_banca — la verifica impersona il titolare prima della lettura.
-- rete-portieri: 20261115000013 chiama memo_leggi_haccp — la verifica impersona il titolare prima della lettura.
-- rete-portieri: 20261115000013 chiama memo_leggi_agenda — la verifica impersona il titolare prima della lettura.
-- rete-portieri: 20261115000013 chiama memo_leggi_magazzino — la verifica impersona il titolare prima della lettura.
--
-- rete-guardie: memo_leggi_banca — il «saldo dai movimenti caricati» si toglie apposta: non e' il saldo e nessuna pagina lo mostra
-- rete-guardie: memo_leggi_piano — le voci madri escono dall'elenco apposta: la loro cifra e' gia' la somma delle sottovoci
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

create or replace function memo_leggi_piano(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with foglie as (
    select v.id as rid, v.descrizione as nome, m.descrizione as nome_madre,
           v.gruppo as gr, v.ordine as ord, v.importo_ivato as prev,
           jsonb_build_object('gruppo', v.gruppo, 'sottovoce_di', m.descrizione,
             'previsto', v.importo_ivato, 'stato', v.stato,
             'speso', coalesce(s.speso, 0), 'impegnato', coalesce(s.impegnato, 0),
             'rate_aperte', coalesce((select sum(r.aperto) from piano_rate_aperte() r where r.voce_id = v.id), 0)) as dettaglio
      from piano_voci v
      left join piano_voci m on m.id = v.madre_id
      left join piano_speso_per_voce() s on s.voce_id = v.id
     where v.archiviata_il is null
       and not exists (select 1 from piano_voci f where f.madre_id = v.id and f.archiviata_il is null)
       and (p_cerca is null
            or v.descrizione ilike '%' || p_cerca || '%'
            or coalesce(m.descrizione, '') ilike '%' || p_cerca || '%')
  ), conto as (
    select f.*, count(*) over () as n, coalesce(sum(f.prev) over (), 0) as tot from foglie f
  )
  select c.rid, c.nome || coalesce(' (' || c.nome_madre || ')', ''), c.dettaglio, c.n::integer, c.tot
    from conto c
   order by c.gr, c.ord, c.rid limit 50;
end $fn$;

create or replace function memo_leggi_fatture_fornitori(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with tutte as (
    select i.id as rid, i.due_date as scad, i.invoice_date as dt, i.status as st,
           coalesce(s.name, 'Fornitore') || coalesce(' · fattura ' || i.invoice_number, '') as titolo,
           case when i.status = 'da_pagare' then da_pagare(i) else 0 end as aperto,
           jsonb_build_object('fornitore', s.name, 'numero', i.invoice_number, 'data', i.invoice_date,
             'scadenza', i.due_date, 'stato', i.status, 'totale_fattura', i.amount,
             'da_pagare', case when i.status = 'da_pagare' then da_pagare(i) else 0 end) as dettaglio
      from supplier_invoices i left join suppliers s on s.id = i.supplier_id
     where p_cerca is null or coalesce(s.name, '') ilike '%' || p_cerca || '%' or coalesce(i.invoice_number, '') ilike '%' || p_cerca || '%'
  ), conto as (
    select t.*, count(*) over () as n, coalesce(sum(t.aperto) over (), 0) as tot from tutte t
  )
  select c.rid, c.titolo, c.dettaglio, c.n::integer, c.tot from conto c
   order by (c.st = 'da_pagare') desc, c.scad nulls last, c.dt desc, c.rid limit 50;
end $fn$;

create or replace function memo_leggi_cassa(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with tutte as (
    select m.id as rid, m.entity_id as ent, e.name as soggetto, m.movement_date as dt, m.created_at as creato,
           coalesce(nullif(m.business_purpose, ''), c.label, 'Movimento di cassa') as titolo,
           m.direction as verso, m.amount as importo, c.label as causale,
           m.business_purpose as descrizione, m.mezzo as mezzo,
           count(*) over (partition by m.entity_id) as n,
           coalesce(sum(case when m.direction = 'entrata' then m.amount else -m.amount end) over (partition by m.entity_id), 0) as tot
      from cash_movements m
      left join entities e on e.id = m.entity_id
      left join cash_causali c on c.id = m.causale_id
     where p_cerca is null or coalesce(m.business_purpose, '') ilike '%' || p_cerca || '%' or coalesce(c.label, '') ilike '%' || p_cerca || '%'
  ), prime as (
    select * from tutte order by dt desc, creato desc, rid limit 50
  )
  select p.rid, p.titolo,
         jsonb_build_object('soggetto', p.soggetto, 'data', p.dt, 'verso', p.verso, 'importo', p.importo,
           'causale', p.causale, 'descrizione', p.descrizione, 'mezzo', p.mezzo,
           'saldo', (select to_jsonb(s) from saldo_tesoreria(p.ent) s)),
         p.n::integer, p.tot
    from prime p order by p.dt desc, p.creato desc, p.rid;
end $fn$;

create or replace function memo_leggi_banca(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with tutte as (
    select m.id as rid, coalesce(nullif(m.descrizione, ''), 'Movimento di banca') as titolo, m.importo as imp,
           m.data_contabile as ord1, m.caricato_il as ord2, (m.cash_movement_id is not null) as abbinato,
           jsonb_build_object(
             'conto', c.nome, 'data_contabile', m.data_contabile, 'data_valuta', m.data_valuta,
             'importo', m.importo, 'descrizione', m.descrizione,
             'riferimento_banca', m.riferimento_banca,
             'stato', case when m.cash_movement_id is not null then 'abbinato'
                           when m.ignorato_il is not null then 'ignorato'
                           else 'da abbinare' end
           ) as dettaglio
      from movimenti_banca m
      join conti_bancari c on c.id = m.conto_id
     where (m.ignorato_il is null or m.cash_movement_id is not null)
       and (p_cerca is null
            or c.nome ilike '%' || p_cerca || '%'
            or coalesce(m.descrizione, '') ilike '%' || p_cerca || '%'
            or coalesce(m.riferimento_banca, '') ilike '%' || p_cerca || '%')
  ), conto as (
    select t.*, count(*) over () as n, coalesce(sum(t.imp) over (), 0) as tot from tutte t
  )
  select c.rid, c.titolo, c.dettaglio, c.n::integer, c.tot from conto c
   order by c.abbinato asc, c.ord1 desc, c.ord2 desc, c.rid limit 50;
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
     where p_cerca is null or titolo ilike '%' || p_cerca || '%' or (select string_agg(j.value, ' ') from jsonb_each_text(dettaglio) j) ilike '%' || p_cerca || '%'
  ) select id, titolo, dettaglio, count(*) over ()::integer, count(*) over ()::numeric from righe
   order by case when dettaglio->>'registro' = 'non conformita' and coalesce(dettaglio->>'risolta', 'false') <> 'true' then 0
                 when dettaglio->>'registro' = 'temperature' and dettaglio->>'conforme' = 'false' then 1
                 else 2 end,
            quando desc, id limit 50;
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
  select t.rid, t.titolo, t.dettaglio, t.n::integer, 0::numeric from tutte t
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
           count(*) over () as n, 0::numeric as tot
      from v_stock_levels v
     where p_cerca is null or v.ingredient_name ilike '%' || p_cerca || '%'
  )
  select t.rid, t.titolo, t.dettaglio, t.n::integer, t.tot from tutte t
   order by t.titolo, t.rid limit 50;
end $fn$;

revoke all on function memo_leggi_piano(text), memo_leggi_fatture_fornitori(text), memo_leggi_cassa(text), memo_leggi_banca(text), memo_leggi_haccp(text), memo_leggi_agenda(text), memo_leggi_magazzino(text) from public, anon, authenticated;
grant execute on function memo_leggi_piano(text), memo_leggi_fatture_fornitori(text), memo_leggi_cassa(text), memo_leggi_banca(text), memo_leggi_haccp(text), memo_leggi_agenda(text), memo_leggi_magazzino(text) to authenticated;

-- Verifica: gli stessi casi difficili del 15/11 (sottovoci, fatture pagate) e
-- il confronto col conteggio che fa la pagina. Annulla tutto.
do $verifica$
declare
  v_foto jsonb := foto_righe();
  v_titolare uuid; v_srls uuid; v_madre uuid; v_forn uuid;
  v_n integer; v_cont integer; v_tot numeric; v_primo text; v_pagina integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select id into v_srls from entities where entity_type = 'srls' limit 1;
  if v_titolare is null or v_srls is null then raise exception 'VERIFICA: servono un titolare e Borgo 58.'; end if;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- 1. PIANO: una madre con due sottovoci vale una volta sola.
    insert into piano_voci (gruppo, ordine, descrizione, importo_ivato, aliquota_iva, stato)
    values ('D', 991, 'ZZ madre confronto', 1, 22, 'stimato') returning id into v_madre;
    insert into piano_voci (gruppo, ordine, descrizione, importo_ivato, aliquota_iva, stato, madre_id)
    values ('D', 992, 'ZZ figlia uno', 10, 22, 'stimato', v_madre), ('D', 993, 'ZZ figlia due', 20, 22, 'stimato', v_madre);
    set local role authenticated;
    select count(*), max(l.conteggio), max(l.totale) into v_n, v_cont, v_tot from memo_leggi_piano('ZZ madre confronto') l;
    if v_n <> 2 or v_cont <> 2 or v_tot <> 30 then
      raise exception 'VERIFICA (1): piano con sottovoci: % righe, conteggio %, totale % (attesi 2, 2, 30).', v_n, v_cont, v_tot;
    end if;
    reset role;
    -- Il conteggio di MEMO senza ricerca = le voci vive che non hanno sottovoci vive (come la pagina).
    select count(*) into v_pagina from piano_voci v
     where v.archiviata_il is null
       and not exists (select 1 from piano_voci f where f.madre_id = v.id and f.archiviata_il is null);
    set local role authenticated;
    select max(l.conteggio) into v_cont from memo_leggi_piano(null) l;
    if v_cont is distinct from v_pagina then
      raise exception 'VERIFICA (1b): MEMO conta % voci, la pagina % .', v_cont, v_pagina;
    end if;
    reset role;

    -- 2. FATTURE FORNITORI: la pagata non entra nel «da pagare».
    insert into suppliers (entity_id, name) values (v_srls, 'ZZ fornitore confronto') returning id into v_forn;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, due_date, amount)
    values (v_srls, v_forn, 'ZZ-CONF-1', current_date, current_date, 100);
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, due_date, amount, status, paid_at)
    values (v_srls, v_forn, 'ZZ-CONF-2', current_date, current_date, 50, 'pagata', now());
    set local role authenticated;
    select count(*), max(l.conteggio), max(l.totale)
      into v_n, v_cont, v_tot from memo_leggi_fatture_fornitori('ZZ fornitore confronto') l;
    select l2.dati->>'stato' into v_primo from memo_leggi_fatture_fornitori('ZZ fornitore confronto') l2 limit 1;
    if v_n <> 2 or v_cont <> 2 or v_tot <> 100 or v_primo <> 'da_pagare' then
      raise exception 'VERIFICA (2): fatture fornitori: % righe, conteggio %, da pagare % (attesi 2, 2, 100), prima % .', v_n, v_cont, v_tot, v_primo;
    end if;
    reset role;

    -- 3-6. Le altre letture girano e non cambiano forma.
    set local role authenticated;
    perform * from memo_leggi_cassa(null);
    perform * from memo_leggi_banca(null);
    perform * from memo_leggi_haccp(null);
    perform * from memo_leggi_agenda(null);
    perform * from memo_leggi_magazzino(null);
    if pg_get_functiondef('public.memo_leggi_banca(text)'::regprocedure) like '%saldo_conto_dai_movimenti_caricati%' then
      raise exception 'VERIFICA (4): la banca da ancora un saldo che non e'' il saldo.';
    end if;
    reset role;
    raise exception 'ZZ_ANNULLA';
  exception when others then reset role; if sqlerrm <> 'ZZ_ANNULLA' then raise; end if; end;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica delle letture di MEMO come le pagine');
  raise notice 'Fatto: le letture di MEMO contano come le pagine (voci foglia, fatture non pagate, un soggetto alla volta). Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261115000013', 'le_letture_di_memo_come_le_pagine') on conflict (version) do nothing;
