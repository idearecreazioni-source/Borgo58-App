-- =====================================================================
-- Borgo 58 · Il percorso delle funzioni non cambia
-- =====================================================================
-- Il Security Advisor segnala queste funzioni perche' ereditano il
-- search_path della sessione chiamante. Non sono SECURITY DEFINER e non
-- leggono dati riservati per conto di altri, ma fissare il loro percorso
-- evita che un nome non qualificato venga risolto in uno schema inatteso.
--
-- Non si riscrive nessun corpo e non si toccano grant, dati o policy:
-- ALTER FUNCTION aggiunge soltanto la configurazione locale alla funzione.
-- =====================================================================

alter function public.azione_percorso(text) set search_path = public;
alter function public.categoria_task(text) set search_path = public;
alter function public.chiave_gruppo_vocale(text, boolean, jsonb) set search_path = public;
alter function public.forma_della_linea(text, text) set search_path = public;
alter function public.mezzo_del_pagamento(text) set search_path = public;
alter function public.nome_leggibile(text) set search_path = public;
alter function public.normalize_phone(text) set search_path = public;
alter function public.numeri_fuori_intervallo(text, numeric, numeric) set search_path = public;
alter function public.numeri_nel_testo(text) set search_path = public;
alter function public.percento(numeric) set search_path = public;
alter function public.periodo_pulizia(text) set search_path = public;
alter function public.pizzico_trascurabile(numeric) set search_path = public;
alter function public.quantita(numeric) set search_path = public;
alter function public.scala_del_calcolo(text) set search_path = public;
alter function public.scarto_da_dire(numeric, numeric) set search_path = public;

do $verifica$
declare
  v_firme text[] := array[
    'public.azione_percorso(text)',
    'public.categoria_task(text)',
    'public.chiave_gruppo_vocale(text,boolean,jsonb)',
    'public.forma_della_linea(text,text)',
    'public.mezzo_del_pagamento(text)',
    'public.nome_leggibile(text)',
    'public.normalize_phone(text)',
    'public.numeri_fuori_intervallo(text,numeric,numeric)',
    'public.numeri_nel_testo(text)',
    'public.percento(numeric)',
    'public.periodo_pulizia(text)',
    'public.pizzico_trascurabile(numeric)',
    'public.quantita(numeric)',
    'public.scala_del_calcolo(text)',
    'public.scarto_da_dire(numeric,numeric)'
  ];
  v_attese integer := array_length(v_firme, 1);
  v_trovate integer;
begin
  select count(*) into v_trovate
    from pg_proc p
   where p.oid = any(array(select to_regprocedure(f) from unnest(v_firme) f));

  if v_trovate is distinct from v_attese then
    raise exception 'VERIFICA: trovate % funzioni su % da fissare.', v_trovate, v_attese;
  end if;

  if exists (
    select 1
      from unnest(v_firme) f
      join pg_proc p on p.oid = to_regprocedure(f)
     where not exists (
       select 1 from unnest(coalesce(p.proconfig, array[]::text[])) c
        where c = 'search_path=public'
     )
  ) then
    raise exception 'VERIFICA: almeno una funzione conserva search_path modificabile.';
  end if;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260916000001', 'il_percorso_delle_funzioni_non_cambia') on conflict (version) do nothing;
