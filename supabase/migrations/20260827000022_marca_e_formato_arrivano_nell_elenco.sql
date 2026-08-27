-- ============================================================================
-- MARCA E FORMATO ARRIVANO NELL'ELENCO — 27/08/2026
-- ============================================================================
--
-- 🔴 UNA FRASE FALSA DA QUANDO È STATA SCRITTA. In `IngredienteForm.jsx`, sopra
--    la tabella delle versioni, c'è questo commento:
--
--      «Le versioni comprate davvero: marca, formato, fornitore, prezzo per
--       unità.»
--
--    La tabella mostra **descrizione, chi la vende, €/unità, ultima volta**.
--    Marca e formato non ci sono — e non potevano esserci: **quelle colonne
--    non esistevano** prima della `20260827000018`. Il commento non è
--    invecchiato, è **nato descrivendo una cosa che non c'era**.
--
-- ⚠️ È la famiglia del 26/08 («un commento dentro una prova può essere falso
--    dal giorno in cui è stato scritto»), e la cura qui non è cancellare la
--    frase: è **renderla vera**, perché quello che descrive è esattamente il
--    disegno voluto da Alessio il 12/08 e ripreso il 25/08.
--
-- ----------------------------------------------------------------------------
-- E DUE COSE CHE MANCAVANO ALL'ELENCO
-- ----------------------------------------------------------------------------
-- Insieme a marca e formato arriva **quanto ne è entrato**: `articoli_fornitore`
-- ora è collegata ai lotti (`stock_lots.articolo_id`), quindi si può dire
-- quante volte quella versione è stata caricata e quando l'ultima. Serve a
-- distinguere «la compro sempre» da «l'ho provata una volta», che è la
-- domanda con cui si guarda quella tabella.
--
-- ⚠️ `drop` PRIMA di `create`, e non `create or replace`: cambiano le colonne
--    restituite, e Postgres rifiuta un `replace` che cambia il tipo di
--    ritorno. Dopo un `drop` i permessi tornano APERTI AL MONDO (trappola
--    già pagata il 13/08 su `create_ingredient`): si richiudono a mano, e la
--    verifica lo controlla invece di darlo per fatto.
-- ============================================================================

drop function if exists varianti_ingrediente(uuid);

create function varianti_ingrediente(p_ingredient_id uuid)
returns table (
  articolo_id     uuid,
  descrizione     text,
  marca           text,
  formato         text,
  nome_esteso     text,
  fornitore       text,
  fornitore_id    uuid,
  unita_fattura   text,
  fattore         numeric,
  prezzo          numeric,
  ultima_volta    timestamptz,
  acquisti        integer,
  carichi         integer,
  ultimo_carico   timestamptz,
  stesso_di       uuid
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' vedere i prezzi d''acquisto';
  end if;

  return query
  select a.id,
         a.descrizione,
         a.marca,
         a.formato,
         a.nome_esteso,
         s.name,
         a.supplier_id,
         a.unita_fattura,
         a.fattore,
         ultimo.price,
         ultimo.recorded_at,
         coalesce(conta.n, 0)::integer,
         coalesce(lotti.n, 0)::integer,
         lotti.ultimo,
         a.stesso_di
    from articoli_fornitore a
    left join suppliers s on s.id = a.supplier_id
    left join lateral (
      select ph.price, ph.recorded_at
        from price_history ph
       where ph.articolo_id = a.id
       order by ph.recorded_at desc
       limit 1
    ) ultimo on true
    left join lateral (
      select count(*) as n from price_history ph where ph.articolo_id = a.id
    ) conta on true
    -- Quante volte quella versione e'' entrata davvero, e quando l'ultima.
    left join lateral (
      select count(*) as n, max(l.received_at) as ultimo
        from stock_lots l where l.articolo_id = a.id
    ) lotti on true
   where a.ingredient_id = p_ingredient_id
     and not a.ignora
   -- Dalla piu' conveniente: e' la domanda che si fa guardando questa
   -- tabella. Chi non ha ancora un prezzo sta in fondo, non in cima.
   order by ultimo.price asc nulls last, a.descrizione;
end
$$;

revoke all on function varianti_ingrediente(uuid) from public, anon, authenticated;
grant execute on function varianti_ingrediente(uuid) to authenticated;

comment on function varianti_ingrediente(uuid) is
  'Le VERSIONI di un ingrediente — marca, formato, chi la vende, prezzo per '
  'unita'', quante volte e'' entrata — dalla piu'' conveniente. E'' la tabella '
  'disegnata da Alessio il 12/08/2026: «vedo tutte le versioni di olio che ho '
  'comprato e scelgo consapevolmente cosa continuare a comprare». Marca e '
  'formato sono arrivati il 27/08/2026, quando le colonne sono nate.';

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- ⚠️ Costruisce tutto quello che le serve: gira su un gestionale vuoto.
do $verifica$
declare
  v_foto     jsonb;
  v_tit      uuid;
  v_ente     uuid;
  v_ing      uuid;
  v_art      uuid;
  v_lotto    uuid;
  v_miei_ing uuid[] := '{}';
  v_miei_art uuid[] := '{}';
  v_miei_lot uuid[] := '{}';
  v_r        record;
  v_n        integer;
begin
  v_foto := foto_righe();

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  if v_tit is null or v_ente is null then
    raise exception 'Verifica impossibile: manca il titolare o la societa''';
  end if;

  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'Olio di verifica 20260827000022', 'olio_condimenti', 'l')
  returning id into v_ing;
  v_miei_ing := v_miei_ing || v_ing;

  insert into articoli_fornitore (supplier_id, descrizione, chiave, ingredient_id,
                                  marca, formato, nome_esteso, unita_fattura, fattore)
  values (null, 'OLIO VERIFICA LATTINA 5 L 20260827000022',
          chiave_articolo('OLIO VERIFICA LATTINA 5 L 20260827000022'), v_ing,
          'Marca di verifica', 'lattina da 5 L', 'olio extra vergine', 'lattina', 5)
  returning id into v_art;
  v_miei_art := v_miei_art || v_art;

  insert into stock_lots (ingredient_id, articolo_id, quantity_received,
                          quantity_remaining, unit_cost, received_at)
  values (v_ing, v_art, 5, 5, 8.90, now() - interval '3 days')
  returning id into v_lotto;
  v_miei_lot := v_miei_lot || v_lotto;

  insert into stock_lots (ingredient_id, articolo_id, quantity_received,
                          quantity_remaining, unit_cost, received_at)
  values (v_ing, v_art, 5, 5, 9.20, now() - interval '1 day')
  returning id into v_lotto;
  v_miei_lot := v_miei_lot || v_lotto;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  select * into v_r from varianti_ingrediente(v_ing);

  if v_r.marca is distinct from 'Marca di verifica' then
    raise exception 'La marca non arriva nell''elenco: %', v_r.marca;
  end if;
  if v_r.formato is distinct from 'lattina da 5 L' then
    raise exception 'Il formato non arriva nell''elenco: %', v_r.formato;
  end if;
  if v_r.nome_esteso is distinct from 'olio extra vergine' then
    raise exception 'Il nome per esteso non arriva nell''elenco: %', v_r.nome_esteso;
  end if;
  if v_r.carichi <> 2 then
    raise exception 'I carichi di quella versione dovrebbero essere 2, sono %', v_r.carichi;
  end if;
  if v_r.ultimo_carico is null then
    raise exception 'L''ultimo carico di quella versione non arriva';
  end if;

  -- ⚠️ Il portiere: dopo un `drop` i permessi tornano aperti al mondo, e la
  --    funzione mostra PREZZI D'ACQUISTO. Si controlla, non si spera.
  perform set_config('request.jwt.claims', null, true);
  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'varianti_ingrediente'
     and (has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('public', p.oid, 'execute'));
  if v_n <> 0 then
    raise exception 'Dopo il drop la funzione dei prezzi e'' rimasta aperta al mondo';
  end if;

  -- ------------------------------------------------------------------
  -- Si riporta via tutto, per identificativo
  -- ------------------------------------------------------------------
  delete from stock_lots where id = any(v_miei_lot);
  delete from articoli_fornitore where id = any(v_miei_art);
  delete from price_history where ingredient_id = any(v_miei_ing);
  delete from ingredients where id = any(v_miei_ing);
  delete from deleted_records where record_id = any((v_miei_ing || v_miei_art || v_miei_lot)::text[]);

  perform pretendi_nessun_residuo(v_foto, 'marca e formato nell''elenco delle versioni');

  raise notice 'Marca, formato e nome per esteso arrivano nell''elenco delle versioni, insieme a quante volte quella versione e'' entrata. Il portiere e'' al suo posto dopo il drop.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000022', 'marca_e_formato_arrivano_nell_elenco') on conflict (version) do nothing;
