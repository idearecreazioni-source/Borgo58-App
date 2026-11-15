-- =====================================================================
-- FATTURE FORNITORI: IL DEBITO È PER SOCIETÀ — 15/11/2026
-- =====================================================================
--
-- La pagina delle fatture fornitori lo dice nel suo codice: «Due società,
-- due debiti — mai un totale solo» (la S.r.l.s. e l'azienda agricola sono
-- due soggetti fiscali distinti, e un numero che le somma non è il debito
-- di nessuna delle due). La lettura di MEMO, dopo la 20261115000013, sommava
-- ancora tutte le società insieme. Ora ogni riga dice la società, e
-- conteggio e totale valgono PER SOCIETÀ (come la cassa).
--
-- rete-portieri: 20261115000015 chiama memo_leggi_fatture_fornitori — la verifica impersona il titolare prima della lettura.
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

create or replace function memo_leggi_fatture_fornitori(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with tutte as (
    select i.id as rid, i.entity_id as ent, e.name as societa, i.due_date as scad, i.invoice_date as dt, i.status as st,
           coalesce(s.name, 'Fornitore') || coalesce(' · fattura ' || i.invoice_number, '') as titolo,
           case when i.status = 'da_pagare' then da_pagare(i) else 0 end as aperto,
           jsonb_build_object('societa', e.name, 'fornitore', s.name, 'numero', i.invoice_number, 'data', i.invoice_date,
             'scadenza', i.due_date, 'stato', i.status, 'totale_fattura', i.amount,
             'da_pagare', case when i.status = 'da_pagare' then da_pagare(i) else 0 end) as dettaglio
      from supplier_invoices i
      left join suppliers s on s.id = i.supplier_id
      left join entities e on e.id = i.entity_id
     where p_cerca is null or coalesce(s.name, '') ilike '%' || p_cerca || '%' or coalesce(i.invoice_number, '') ilike '%' || p_cerca || '%'
  ), conto as (
    select t.*, count(*) over (partition by t.ent) as n, coalesce(sum(t.aperto) over (partition by t.ent), 0) as tot from tutte t
  )
  select c.rid, c.titolo, c.dettaglio, c.n::integer, c.tot from conto c
   order by (c.st = 'da_pagare') desc, c.scad nulls last, c.dt desc, c.rid limit 50;
end $fn$;

revoke all on function memo_leggi_fatture_fornitori(text) from public, anon, authenticated;
grant execute on function memo_leggi_fatture_fornitori(text) to authenticated;

do $verifica$
declare
  v_foto jsonb := foto_righe(); v_titolare uuid; v_srls uuid; v_forn uuid; v_tot numeric;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select id into v_srls from entities where entity_type = 'srls' limit 1;
  if v_titolare is null or v_srls is null then raise exception 'VERIFICA: servono un titolare e Borgo 58.'; end if;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    insert into suppliers (entity_id, name) values (v_srls, 'ZZ fornitore per societa') returning id into v_forn;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, due_date, amount)
    values (v_srls, v_forn, 'ZZ-SOC-1', current_date, current_date, 70), (v_srls, v_forn, 'ZZ-SOC-2', current_date, current_date, 30);
    set local role authenticated;
    select max(l.totale) into v_tot from memo_leggi_fatture_fornitori('ZZ fornitore per societa') l;
    if v_tot <> 100 then raise exception 'VERIFICA: il debito della societa non e'' 100 (%).', v_tot; end if;
    if not exists (select 1 from memo_leggi_fatture_fornitori('ZZ fornitore per societa') l where l.dati->>'societa' is not null) then
      raise exception 'VERIFICA: la riga non dice la societa.';
    end if;
    reset role;
    raise exception 'ZZ_ANNULLA';
  exception when others then reset role; if sqlerrm <> 'ZZ_ANNULLA' then raise; end if; end;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica del debito per societa');
  raise notice 'Fatto: le fatture fornitori di MEMO contano il debito per societa. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261115000015', 'le_fatture_fornitori_di_memo_per_societa') on conflict (version) do nothing;
