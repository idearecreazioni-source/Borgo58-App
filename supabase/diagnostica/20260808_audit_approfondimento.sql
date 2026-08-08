-- =====================================================================
-- AUDIT — approfondimento mirato. SOLA LETTURA.
-- =====================================================================
-- Il riepilogo ha dato: 22 letture aperte allo staff, 7 viste che
-- bypassano la RLS, 35 chiavi esterne senza indice. Elencarle tutte non
-- serve: servono le risposte a tre domande precise.

-- 1. FUGA DI DATI: c'e' una tabella con dati economici o personali che lo
--    staff puo' leggere per intero? Questo blocco DEVE essere vuoto.
--    (E' esattamente il caso di Agenda/tasks del 04/08: la tabella c'era
--    da sempre, la lettura era aperta, e dentro c'erano i dati dei
--    dipendenti.)
select
  'A. LETTURA APERTA SU DATI SENSIBILI' as controllo,
  p.tablename::text as oggetto,
  'policy ' || p.policyname as dettaglio
from pg_policies p
where p.schemaname = 'public' and p.cmd = 'SELECT' and p.qual = 'true'
  and p.tablename in (
    'employees','employee_documents','employee_leaves','payslips',
    'tips_collected','tip_distributions','tip_distribution_lines',
    'cash_movements','cash_causali','discounts_gifts','deductible_expenses',
    'fiscal_settings','entities','suppliers','ingredients','price_history',
    'supplier_invoices','documents','intercompany_cessions','menu_items','menus'
  )

union all

-- 2. Le viste che scavalcano la RLS e sono leggibili dallo staff: quali
--    sono. Le "_display" sono volute (espongono solo colonne sicure). Una
--    vista di economia qui dentro (costi, food cost, margini, saldi)
--    sarebbe invece una fuga.
select
  'B. VISTA LEGGIBILE DALLO STAFF',
  c.relname::text,
  case
    when c.relname like '%\_display' then 'prevista dal disegno (§3.18)'
    when c.relname like 'v\_%cost%' or c.relname like 'v\_%econom%'
      or c.relname like 'v\_cash%' or c.relname like 'v\_tips%'
      then 'DA CONTROLLARE: sembra una vista economica'
    else 'da controllare a occhio'
  end
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
  and coalesce(array_to_string(c.reloptions, ','), '') not like '%security_invoker=true%'
  and has_table_privilege('authenticated', c.oid, 'SELECT')

union all

-- 3. Chiavi esterne senza indice, raggruppate per tabella. Non vanno
--    indicizzate tutte: su una tabella che restera' piccola (entita',
--    dipendenti, causali) un indice in piu' e' peso inutile. Contano
--    quelle che crescono a ogni servizio.
select
  'C. FK SENZA INDICE — ' ||
    case when ct.conrelid::regclass::text in
      ('order_items','orders','cash_movements','haccp_temperature_logs',
       'haccp_cleaning_logs','haccp_goods_receiving','stock_lots',
       'stock_movements','price_history','tasks','reservations','documents')
    then 'TABELLA CHE CRESCE' else 'tabella piccola' end,
  ct.conrelid::regclass::text,
  string_agg(a.attname, ', ' order by a.attname)
from pg_constraint ct
join pg_attribute a on a.attrelid = ct.conrelid and a.attnum = ct.conkey[1]
where ct.contype = 'f' and ct.connamespace = 'public'::regnamespace
  and array_length(ct.conkey, 1) = 1
  and not exists (select 1 from pg_index i where i.indrelid = ct.conrelid and i.indkey[0] = ct.conkey[1])
group by 1, 2

order by 1, 2;
