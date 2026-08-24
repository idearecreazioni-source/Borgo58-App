-- =====================================================================
-- IL PORTIERE SULLE LINEE DELLA PREVISIONE
-- 24/08/2026 — coda della 20260824000029
-- =====================================================================
-- 🔴 DIFETTO MIO, TROVATO DA UNA RETE DEL PROGETTO e non rileggendo:
-- `linee_della_previsione` è nata `security definer` **senza portiere**, e
-- la prova dei permessi è diventata rossa da sola — che è esattamente il
-- lavoro per cui esiste (l'elenco delle funzioni che scavalcano la RLS non
-- deve crescere in silenzio, regola del 13/08).
--
-- ⚠️ E IL VERDETTO GIUSTO NON ERA «DICHIARARLA», che sarebbe stata la cosa
-- comoda: quella funzione restituisce **prezzi medi e costi percentuali**
-- delle linee di una previsione — cioè i margini che Alessio si aspetta da
-- ogni ramo della sua attività. È roba del titolare, come tutto il resto
-- della Proiezione.
--
-- ⚠️ La differenza con `finger_bissabili`, che invece resta aperta alla
-- sala, è il contenuto: là passa un prezzo di VENDITA che il cameriere
-- legge già sul menu; qui passa un margine. La regola non è «le funzioni
-- della Proiezione sono chiuse» — è **cosa esce da quella porta**.
--
-- ⚠️ E chi non deve vedere riceve un RIFIUTO, non un elenco vuoto: una
-- schermata vuota è una rassicurazione falsa (13/08).
-- =====================================================================

-- ⚠️ Il corpo viene dal DATABASE VIVO: cambia solo l'aggiunta del portiere,
-- e per aggiungerlo il linguaggio passa da `sql` a `plpgsql` — una `sql`
-- non può sollevare un'eccezione prima di leggere.
create or replace function public.linee_della_previsione(p_scenario_id uuid)
returns table (
  id           uuid,
  codice       text,
  linea        text,
  forma        text,
  quantita     numeric,
  prezzo_medio numeric,
  costo_percento numeric,
  a_zero       boolean
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if not is_titolare() then
    raise exception 'La Proiezione è riservata al titolare.';
  end if;

  return query
  select a.id,
         a.codice,
         a.linea,
         forma_della_linea(a.forma, a.base),
         a.quantita,
         a.prezzo_medio,
         a.costo_percento,
         -- ⚠️ «A ZERO» È UN'INFORMAZIONE, non un buco: chef table e
         -- barattoli non partono da subito, e *zero previsto e zero reale
         -- è un allineamento perfetto, non un fallimento* (Alessio).
         coalesce(a.quantita, 0) = 0 or coalesce(a.prezzo_medio, 0) = 0
    from scenario_linee_accessorie a
   where a.scenario_id = p_scenario_id
   order by a.linea;
end $function$;

revoke all on function public.linee_della_previsione(uuid) from public, anon, authenticated;
grant execute on function public.linee_della_previsione(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica — nei DUE versi
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare  uuid;
  v_staff     uuid;
  v_scenario  uuid;
  v_lapidi    integer;
  v_lapidi2   integer;
  v_rifiutato boolean;
  v_quante    integer;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role <> 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;

  select id into v_scenario from scenari_proiezione limit 1;

  -- (a) IL TITOLARE LEGGE. ⚠️ Non basta che la funzione esista: si CHIAMA,
  --     perché Postgres accetta un corpo che nomina funzioni inesistenti e
  --     se ne accorge solo eseguendolo (lezione del 17/08).
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  if v_scenario is not null then
    select count(*) into v_quante from linee_della_previsione(v_scenario);
    raise notice 'Il titolare legge % linee.', v_quante;
  end if;

  -- (b) LO STAFF RICEVE UN RIFIUTO, ed è la ragione di questa migrazione.
  if v_staff is null then
    raise notice 'Nessun utente non-titolare: il portiere NON e'' stato esercitato qui.';
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_rifiutato := false;
    begin
      perform * from linee_della_previsione(coalesce(v_scenario, gen_random_uuid()));
    exception when others then
      v_rifiutato := true;
    end;
    if not v_rifiutato then
      raise exception 'Lo staff puo'' ancora leggere i margini delle linee della previsione.';
    end if;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  end if;

  -- (c) LA PROPRIETÀ: nessuna funzione della Proiezione resta senza
  --     portiere. ⚠️ Si guarda l'elenco che il database costruisce da sé,
  --     non un nome scritto a mano — così una funzione nuova domani finisce
  --     nella stessa rete invece di dover essere ricordata.
  select count(*) into v_quante
    from funzioni_senza_portiere() f
   where f.nome in ('linee_della_previsione', 'pareggio_previsione', 'calcola_proiezione');
  if v_quante > 0 then
    raise exception '% funzioni della Proiezione scavalcano ancora la RLS senza chiedere chi sei.', v_quante;
  end if;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Le linee della previsione chiedono chi sei.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000031', 'il_portiere_sulle_linee') on conflict (version) do nothing;
