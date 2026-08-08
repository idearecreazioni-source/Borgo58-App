-- =====================================================================
-- AUDIT DELLE FONDAMENTA — riepilogo compatto. SOLA LETTURA.
-- =====================================================================
-- Stesse domande della versione lunga, ma raggruppate: una riga per
-- categoria, con l'elenco degli oggetti dentro. Serve a leggere il quadro
-- in un colpo d'occhio invece di scorrere decine di righe.

with problemi as (

  select 1 as ordine, 'Tabelle SENZA RLS (grave)' as categoria, c.relname::text as oggetto
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity

  union all
  select 2, 'RLS attiva ma SENZA POLICY (tabella muta)', c.relname::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)

  union all
  select 3, 'Lettura aperta a tutto lo staff (da guardare)', p.tablename::text
  from pg_policies p
  where p.schemaname = 'public' and p.cmd = 'SELECT' and p.qual = 'true'

  union all
  select 4, 'Viste che bypassano la RLS e sono leggibili dallo staff', c.relname::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and coalesce(array_to_string(c.reloptions, ','), '') not like '%security_invoker=true%'
    and has_table_privilege('authenticated', c.oid, 'SELECT')

  union all
  select 5, 'Chiavi esterne senza indice (lentezza futura)',
         ct.conrelid::regclass::text || '.' || a.attname
  from pg_constraint ct
  join pg_attribute a on a.attrelid = ct.conrelid and a.attnum = ct.conkey[1]
  where ct.contype = 'f' and ct.connamespace = 'public'::regnamespace
    and array_length(ct.conkey, 1) = 1
    and not exists (select 1 from pg_index i where i.indrelid = ct.conrelid and i.indkey[0] = ct.conkey[1])

  union all
  select 6, 'Tabelle senza chiave primaria', c.relname::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and not exists (select 1 from pg_constraint k where k.conrelid = c.oid and k.contype = 'p')
)
select
  categoria,
  count(*) as quanti,
  string_agg(oggetto, ', ' order by oggetto) as elenco
from problemi
group by ordine, categoria
order by ordine;
