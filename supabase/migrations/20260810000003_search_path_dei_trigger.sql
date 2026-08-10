-- =====================================================================
-- I trigger funzionano anche quando il search_path è vuoto
-- =====================================================================
-- Difetto trovato il 10/08/2026 ripristinando davvero una copia di
-- sicurezza sul progetto di prova, e localizzato dal validatore:
-- `set_task_visibility` chiama `is_titolare()` e
-- `task_origin_visible_to_staff()` senza nome di schema, ma la funzione
-- non fissa il proprio `search_path`. Nell'uso normale non si vede — il
-- search_path della sessione contiene `public` — ma un ripristino lo
-- azzera (`select pg_catalog.set_config('search_path', '', false)` è la
-- prima riga di ogni file prodotto da pg_dump), e da quel momento il
-- trigger non trova più le funzioni che chiama: ogni promemoria rimesso
-- fa fallire il ripristino.
--
-- Il giorno in cui serve ripristinare non è il giorno in cui scoprirlo.
--
-- Si sistemano ENTRAMBE le funzioni trigger che ne erano prive. La
-- seconda (`set_updated_at`) usa solo `now()`, che vive in `pg_catalog` e
-- si trova sempre: non era rotta. La si fissa lo stesso perché così la
-- regola diventa verificabile in blocco — "nessuna funzione trigger senza
-- search_path" — invece di restare "nessuna tranne una, e ricordarsi
-- perché". Una regola con un'eccezione non è controllabile da una query.
--
-- Nessun cambiamento di comportamento nell'app: le due funzioni fanno
-- esattamente quello che facevano.

alter function public.set_task_visibility() set search_path = public;
alter function public.set_updated_at() set search_path = public;

-- ---------------------------------------------------------------------
-- Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  n     integer;
  v_id  uuid;
begin
  -- 1. La regola, in blocco: nessuna funzione trigger senza search_path.
  select count(*) into n
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.prorettype = 'trigger'::regtype
    and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%';
  if n > 0 then
    raise exception 'Restano % funzioni trigger senza search_path fissato.', n;
  end if;

  -- 2. La prova che conta: la scena esatta del guasto. Con il search_path
  --    azzerato — come lo imposta un ripristino — inserire un promemoria
  --    deve funzionare. Prima di questa migrazione qui si fermava con
  --    "function is_titolare() does not exist".
  perform set_config('search_path', '', true);

  insert into public.tasks (title, priority, status)
  values ('__PROVA_SEARCH_PATH__', 'media', 'da_fare')
  returning id into v_id;

  delete from public.tasks where id = v_id;

  perform set_config('search_path', 'public', true);

  -- 3. Pulizia verificata: la prova non lascia niente dietro di sé.
  select count(*) into n from tasks where title = '__PROVA_SEARCH_PATH__';
  if n <> 0 then
    raise exception 'La prova ha lasciato % promemoria nel database.', n;
  end if;

  raise notice 'Trigger a prova di search_path vuoto: un ripristino non si ferma più sui promemoria.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260810000003', 'search_path_dei_trigger')
on conflict (version) do nothing;

-- Riepilogo: devono essere zero.
select count(*) as funzioni_trigger_senza_search_path
from pg_proc p
join pg_namespace ns on ns.oid = p.pronamespace
where ns.nspname = 'public'
  and p.prorettype = 'trigger'::regtype
  and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%';
