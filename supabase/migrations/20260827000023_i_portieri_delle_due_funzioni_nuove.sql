-- ============================================================================
-- I PORTIERI DELLE DUE FUNZIONI NUOVE — 27/08/2026
-- ============================================================================
--
-- ✅ LA RETE È DIVENTATA ROSSA DA SOLA, e ha fatto il suo lavoro.
--    `tests/app/permessi.test.js` conta le funzioni che scavalcano la RLS
--    senza chiedere chi sei: **23 attese, 25 trovate**. Le due in più sono
--    `prezzo_ultima_versione` e `andamento_prezzo`, nate poche ore prima con
--    la `20260827000018`. Nessuna rilettura le aveva viste.
--
-- ⚠️ È la seconda volta in un giorno che questa rete prende un difetto che
--    il codice sembrava non avere: la prima era `caparre_trattenute`, la
--    mattina dello stesso 27/08.
--
-- ----------------------------------------------------------------------------
-- DUE FUNZIONI, DUE CURE DIVERSE — e la differenza è chi le chiama
-- ----------------------------------------------------------------------------
-- **`prezzo_ultima_versione` viene CHIUSA.** La chiama solo il trigger del
-- riflesso, che gira come proprietario e non ha bisogno del permesso di
-- nessun utente. Non le serve un portiere: le serve **non essere
-- eseguibile**. Stessa cura di `origine_dell_insieme` il 25/08.
--
-- 🔴 E UN PORTIERE LÌ AVREBBE ROTTO IL GESTIONALE IN CUCINA. Dentro una
--    funzione `security definer`, `auth.uid()` resta quello di **chi
--    chiama**: quindi `is_titolare()` sarebbe FALSO quando è lo staff a
--    registrare una consegna, e il riflesso avrebbe **rifiutato**. Il carico
--    fatto in cucina non avrebbe mosso il prezzo — e la cura sarebbe stata
--    peggiore del difetto.
--
-- **`andamento_prezzo` riceve un portiere che RIFIUTA.** Mostra prezzi
-- d'acquisto — media, minimo, massimo, variazione — cioè esattamente ciò che
-- `varianti_ingrediente` protegge dal 13/08.
--
-- ⚠️ E RIFIUTA, non filtra. Un `where is_titolare()` avrebbe risposto
--    ZERO RIGHE a chi non deve vedere, e zero righe si leggono «questo
--    ingrediente non ha storico» — una rassicurazione falsa. È il difetto
--    trovato la mattina stessa su `caparre_trattenute`, e non si ripete la
--    sera.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. La chiave interna si chiude
-- ----------------------------------------------------------------------------
revoke all on function prezzo_ultima_versione(uuid) from public, anon, authenticated;

comment on function prezzo_ultima_versione(uuid) is
  'Il prezzo dell''ULTIMA versione entrata in magazzino per questo '
  'ingrediente, fra quelle che sono state PAGATE. Vuoto se nessun lotto porta '
  'un costo maggiore di zero — e vuoto NON e'' zero. I lotti a costo zero '
  '(regali, raccolta propria) sono esclusi apposta: decisione del 17/08/2026. '
  '⚠️ NON E'' ESEGUIBILE DA NESSUN UTENTE: la chiama solo il trigger del '
  'riflesso, che gira come proprietario. Un portiere qui rifiuterebbe quando '
  'e'' lo staff a registrare una consegna, perche'' dentro un `security '
  'definer` `auth.uid()` resta quello di chi chiama.';

-- ----------------------------------------------------------------------------
-- 2. L'andamento riceve il suo portiere
-- ----------------------------------------------------------------------------
create or replace function andamento_prezzo(
  p_ingredient_id uuid,
  p_articolo_id uuid default null
) returns table (
  quante        integer,
  primo         numeric,
  ultimo        numeric,
  medio         numeric,
  minimo        numeric,
  massimo       numeric,
  dal           timestamptz,
  al            timestamptz,
  variazione    numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  -- ⚠️ RIFIUTA, non filtra: un elenco vuoto si leggerebbe «questo
  --    ingrediente non ha storico», che e'' una rassicurazione falsa.
  if not (select is_titolare()) then
    raise exception 'Solo il titolare puo'' vedere l''andamento dei prezzi d''acquisto';
  end if;

  return query
  with righe as (
    select ph.price, ph.recorded_at
      from price_history ph
     where ph.ingredient_id = p_ingredient_id
       and (p_articolo_id is null or ph.articolo_id = p_articolo_id)
  ), estremi as (
    select
      (select r.price from righe r order by r.recorded_at asc  limit 1) as primo,
      (select r.price from righe r order by r.recorded_at desc limit 1) as ultimo
  )
  select
    count(*)::integer,
    e.primo,
    e.ultimo,
    round(avg(r.price), 4),
    min(r.price),
    max(r.price),
    min(r.recorded_at),
    max(r.recorded_at),
    -- ⚠️ La variazione si misura dal PIU'' VECCHIO, non dal minimo: un numero
    --    scelto per fare effetto e'' un numero di cui non ci si fida
    --    (regola del 12/08 sulla sorveglianza dei rincari).
    case when e.primo is null or e.primo = 0 then null
         else round((e.ultimo - e.primo) / e.primo * 100, 2) end
  from righe r cross join estremi e
  group by e.primo, e.ultimo
  having count(*) > 0;
end;
$$;

revoke all on function andamento_prezzo(uuid, uuid) from public, anon, authenticated;
grant execute on function andamento_prezzo(uuid, uuid) to authenticated;

comment on function andamento_prezzo(uuid, uuid) is
  'Media, estremi e variazione dei prezzi di un ingrediente, o di una sua '
  'sola versione se si passa `p_articolo_id`. Legge `price_history`: nessun '
  'numero viene conservato, cosi'' non puo'' divergere. Restituisce ZERO RIGHE '
  'quando non c''e'' nessuno storico — chi chiama deve dire «non lo so», non '
  'mostrare zeri. Solo il titolare: sono prezzi d''acquisto, e chi non deve '
  'vederli riceve un RIFIUTO, non un elenco vuoto.';

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_foto     jsonb;
  v_tit      uuid;
  v_staff    uuid;
  v_ente     uuid;
  v_ing      uuid;
  v_miei_ing uuid[] := '{}';
  v_n        integer;
  v_scoperte text[];
begin
  v_foto := foto_righe();

  select user_id into v_tit   from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role <> 'titolare' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  if v_tit is null or v_ente is null then
    raise exception 'Verifica impossibile: manca il titolare o la societa''';
  end if;

  -- ------------------------------------------------------------------
  -- 1. La chiave interna non e' eseguibile da nessun utente
  -- ------------------------------------------------------------------
  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'prezzo_ultima_versione'
     and (has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute')
       or has_function_privilege('public', p.oid, 'execute'));
  if v_n <> 0 then
    raise exception 'La chiave interna del riflesso e'' rimasta eseguibile da un utente';
  end if;

  -- ------------------------------------------------------------------
  -- 2. IL RIFLESSO CONTINUA A FUNZIONARE senza quel permesso, ed e'
  --    il controllo che conta: chiudere una funzione che serve a un
  --    trigger e' il modo piu' facile di spegnere il trigger.
  -- ------------------------------------------------------------------
  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'Portiere di verifica 20260827000023', 'altro', 'kg')
  returning id into v_ing;
  v_miei_ing := v_miei_ing || v_ing;

  -- ⚠️ Con i claims dello STAFF: e' il caso in cui un portiere avrebbe
  --    rotto il carico in cucina.
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  end if;

  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost)
  values (v_ing, 4, 4, 3.30);

  perform set_config('request.jwt.claims', null, true);

  select count(*) into v_n from ingredients
   where id = v_ing and current_price = 3.30 and prezzo_da = 'prodotto';
  if v_n <> 1 then
    raise exception 'Il riflesso ha smesso di funzionare dopo la chiusura della sua chiave interna';
  end if;

  -- ------------------------------------------------------------------
  -- 3. L'andamento RIFIUTA lo staff, e non risponde vuoto
  -- ------------------------------------------------------------------
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    begin
      perform * from andamento_prezzo(v_ing);
      raise exception 'Lo staff ha ottenuto l''andamento dei prezzi d''acquisto';
    exception
      when others then
        if sqlerrm not like '%Solo il titolare%' then
          raise exception 'Il rifiuto dell''andamento dice la cosa sbagliata: %', sqlerrm;
        end if;
    end;
    perform set_config('request.jwt.claims', null, true);
  end if;

  -- ------------------------------------------------------------------
  -- 4. ...e il titolare si', altrimenti il portiere sarebbe un muro
  -- ------------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  perform update_ingredient_price(v_ing, 4.40, 'manuale', 'verifica portiere');
  select count(*) into v_n from andamento_prezzo(v_ing);
  if v_n <> 1 then
    raise exception 'Il titolare non ottiene l''andamento: % righe', v_n;
  end if;

  -- ------------------------------------------------------------------
  -- 5. E la rete non ha piu' niente da dire sulle due
  -- ⚠️ Si resta col titolare: `funzioni_senza_portiere()` ha essa stessa
  --    un portiere, e azzerare i claims prima di chiamarla la fa rifiutare
  --    — trappola del 16/08, «dentro una migrazione non si chiamano le
  --    funzioni dell'app che hanno un portiere» senza dargli un'identita'.
  -- ------------------------------------------------------------------
  select coalesce(array_agg(nome order by nome), '{}') into v_scoperte
    from funzioni_senza_portiere()
   where nome in ('prezzo_ultima_versione', 'andamento_prezzo');
  if array_length(v_scoperte, 1) is not null then
    raise exception 'La rete segnala ancora: %', array_to_string(v_scoperte, ', ');
  end if;
  perform set_config('request.jwt.claims', null, true);

  -- ------------------------------------------------------------------
  -- Si riporta via tutto, per identificativo
  -- ------------------------------------------------------------------
  delete from stock_lots where ingredient_id = any(v_miei_ing);
  delete from price_history where ingredient_id = any(v_miei_ing);
  delete from ingredients where id = any(v_miei_ing);
  delete from deleted_records where record_id = any(v_miei_ing::text[]);

  perform pretendi_nessun_residuo(v_foto, 'i portieri delle due funzioni nuove');

  raise notice 'La chiave interna del riflesso e'' chiusa e il riflesso funziona ancora — anche con i permessi dello staff. L''andamento dei prezzi RIFIUTA chi non e'' il titolare invece di rispondere vuoto.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000023', 'i_portieri_delle_due_funzioni_nuove') on conflict (version) do nothing;
