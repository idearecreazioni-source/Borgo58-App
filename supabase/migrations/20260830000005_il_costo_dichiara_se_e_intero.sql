-- =====================================================================
-- IL COSTO DICHIARA SE E' INTERO, DOVE ALESSIO L'HA VISTO — 30/08/2026
-- =====================================================================
--
-- 🔴 LA MIGRAZIONE PRIMA DI QUESTA HA REGISTRATO IL FATTO; questa lo porta
-- **dove il difetto e' stato visto**. Alessio non ha letto «costata 0,00 €»
-- nell'elenco delle produzioni fatte: l'ha letto **dentro la voce
-- «Busiate trafilate»**, nello storico che serve a fare il paragone mentre
-- si registra. Se la risposta arrivasse solo nell'elenco in fondo, la
-- correzione sarebbe nella schermata sbagliata — ed e' il difetto del
-- 18/08, *la cura nata dove il difetto e' stato visto invece che dove
-- morde*, letto al contrario.
--
-- ⚠️ SI AGGIUNGE UNA COLONNA A UNA FUNZIONE CHE RESTITUISCE UNA TABELLA, e
-- questo in Postgres NON si fa con `create or replace`: si deve buttare e
-- rifare. 🔴 E UNA FUNZIONE RIFATTA NASCE APERTA A TUTTI (trappole del 24 e
-- del 27/08). Quindi i permessi si MISURANO prima e si rimettono dopo:
-- misurato il 30/08 — `anon` no, `authenticated` si', `service_role` no —
-- e la verifica qui sotto lo ricontrolla invece di crederci.
--
-- ⚠️ E la colonna nuova ha TRE risposte come la sua sorella: «completo»,
-- «parziale» e VUOTA per le produzioni registrate prima di stanotte, che
-- nessuno ha contato.

drop function if exists riepilogo_preparazioni();

CREATE OR REPLACE FUNCTION public.riepilogo_preparazioni()
 RETURNS TABLE(recipe_id uuid, nome text, unita text, resa_in_ricetta numeric, quante_volte integer, ultima_il timestamp with time zone, resa_ultima numeric, resa_media numeric, costo_ultimo numeric, costo_precedente numeric, costo_stato text, in_lista boolean, ricorre_ogni integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with fatte as (
    select p.recipe_id,
           p.creato_il,
           p.quantita_ottenuta,
           p.dosi,
           p.costo,
           p.costo_stato,
           row_number() over (partition by p.recipe_id order by p.creato_il desc) as quanto_recente
      from produzioni p
  ),
  riassunto as (
    select f.recipe_id,
           count(*)::integer as quante,
           max(f.creato_il) as ultima,
           -- ⚠️ La resa si misura PER DOSE, non per produzione: una doppia
           -- dose che rende il doppio ha la stessa resa di una singola, e
           -- mediare le quantità direbbe che rende di più.
           round(avg(f.quantita_ottenuta / nullif(f.dosi, 0)), 4) as media_per_dose
      from fatte f
     group by f.recipe_id
  )
  select r.id,
         r.name,
         r.yield_unit,
         r.yield_quantity,
         coalesce(ri.quante, 0),
         ri.ultima,
         round((select f.quantita_ottenuta / nullif(f.dosi, 0)
                  from fatte f where f.recipe_id = r.id and f.quanto_recente = 1), 4),
         ri.media_per_dose,
         case when (select is_titolare())
              then (select f.costo from fatte f where f.recipe_id = r.id and f.quanto_recente = 1)
         end,
         case when (select is_titolare())
              then (select f.costo from fatte f where f.recipe_id = r.id and f.quanto_recente = 2)
         end,
         -- 🔴 SE QUEL COSTO E' INTERO (30/08). Vuoto vuol dire «non lo so»:
         --    o la produzione e' di prima di stanotte, o non ce n'e' nessuna.
         --    ⚠️ Sta dentro lo stesso `case` degli altri due perche' e' una
         --    proprieta' di un numero che vede solo il titolare: dirla a chi
         --    il numero non lo vede sarebbe rumore senza appiglio.
         case when (select is_titolare())
              then (select f.costo_stato from fatte f where f.recipe_id = r.id and f.quanto_recente = 1)
         end,
         exists (select 1 from preparazioni_da_fare d where d.recipe_id = r.id),
         (select ric.ogni_giorni from preparazioni_ricorrenti ric
           where ric.recipe_id = r.id and ric.attiva)
    from recipes r
    left join riassunto ri on ri.recipe_id = r.id
   where r.recipe_type = 'preparazione'
   -- ⚠️ ALFABETICO, ed è una scelta esplicita di Alessio contro «le più
   -- frequenti in cima»: un elenco che si riordina da solo non si impara
   -- mai a memoria.
   order by r.name;
$function$;

-- ⚠️ I PERMESSI, RIMESSI COME ERANO E NON COME SEMBRAVA NATURALE. Misurati
--    sul database il 30/08 prima del drop: solo `authenticated`.
revoke all on function riepilogo_preparazioni() from public, anon, authenticated;
grant execute on function riepilogo_preparazioni() to authenticated;

do $verifica$
declare
  v_foto  jsonb := foto_righe();
  v_tit   uuid;
  v_col   integer;
  v_n     integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Manca il titolare: impossibile verificare.'; end if;

  -- (1) LA COLONNA C'E' DAVVERO NELLA FIRMA. Se il drop e il create fossero
  --     andati storti in mezzo, questo e' il solo posto che se ne accorge.
  -- ⚠️ SI CHIEDE A `pg_proc`, non a `information_schema.columns`: quella
  --    elenca le colonne delle TABELLE, e una funzione che restituisce una
  --    tabella non ci compare. Trovato applicando: il controllo diceva che
  --    la colonna non c'era mentre c'era.
  select count(*) into v_col
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'riepilogo_preparazioni'
     and 'costo_stato' = any(p.proargnames);
  if v_col <> 1 then
    raise exception 'La colonna «costo_stato» non e'' comparsa nel riepilogo delle preparazioni.';
  end if;

  -- (2) I PERMESSI SONO TORNATI QUELLI DI PRIMA, e non piu' larghi.
  if not has_function_privilege('authenticated', 'riepilogo_preparazioni()', 'execute') then
    raise exception 'Il riepilogo delle preparazioni non e'' piu'' leggibile da chi usa il gestionale.';
  end if;
  if has_function_privilege('anon', 'riepilogo_preparazioni()', 'execute') then
    raise exception 'Il riepilogo delle preparazioni e'' diventato leggibile con la chiave pubblica.';
  end if;

  -- (3) E LA FUNZIONE RISPONDE. Un corpo che si crea non e' un corpo che
  --     funziona (17/08): qui si CHIAMA, dal ruolo vero del titolare.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_n from riepilogo_preparazioni();
  perform set_config('request.jwt.claims', null, true);
  raise notice 'Il riepilogo risponde: % preparazioni.', v_n;

  perform pretendi_nessun_residuo(v_foto, 'la verifica del costo che dichiara se e'' intero');
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260830000005', 'il_costo_dichiara_se_e_intero') on conflict (version) do nothing;
