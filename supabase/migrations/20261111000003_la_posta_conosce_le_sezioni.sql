-- =====================================================================
-- LA POSTA CONOSCE LE SEZIONI DELL'ARCHIVIO, E MEMO AVVISA SULLE RATE
-- 11/11/2026 (PR8b)
-- =====================================================================
--
-- 1. 🔴 LA SEZIONE INVENTATA. L'11/11 Alessio ha premuto «Archivia» su
--    una proposta della Posta con una sezione che non esiste: errore
--    `documents_doc_type_fkey` e avviso Telegram. La causa era a monte:
--    `posta-leggi` chiede gli elenchi chiusi a `vocabolari_per_assistente()`
--    con la chiave di servizio, che non ha il permesso di chiamarla (la
--    funzione è «security invoker» e la chiave di servizio non legge le
--    tabelle degli elenchi, apposta: 20260812000003). La chiamata falliva
--    in silenzio, quindi:
--      · il modello non riceveva l'elenco delle sezioni, e ne inventava;
--      · il filtro che doveva svuotare una sezione inventata lasciava
--        passare tutto («elenco non letto → si passa com'è»).
--    Si apre una porta sola, come per la fattura già registrata
--    (20261108000002): `vocabolari_per_la_posta()`, che restituisce gli
--    stessi elenchi chiusi e niente altro, solo alla chiave di servizio.
--    Sono vocabolari (categorie, sezioni, unità), non dati del locale.
--
-- 2. MEMO AVVISA QUANDO LE RATE NON TORNANO PIÙ (prova con Alessio, 11/11):
--    cambiando il previsto di una voce che ha delle rate, la voce restava
--    con la ✗ senza che l'appunto lo dicesse. Ora l'appunto lo dice. Non
--    blocca: in quale mese vanno i soldi in più lo sa solo Alessio.
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

create or replace function vocabolari_per_la_posta()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select vocabolari_per_assistente();
$$;
comment on function vocabolari_per_la_posta() is
  'Gli elenchi chiusi (categorie, sezioni dell''archivio, unità…) per posta-leggi, che li chiede con la chiave di servizio (11/11/2026). Gli stessi di vocabolari_per_assistente(), e niente altro.';
revoke all on function vocabolari_per_la_posta() from public, anon, authenticated;
grant execute on function vocabolari_per_la_posta() to service_role;

-- ---------------------------------------------------------------------------
-- L'avviso sulle rate, nel corpo vivo di voce_risolvi_piano
-- ---------------------------------------------------------------------------
do $rate$
declare
  v_def    text := replace(pg_get_functiondef('public.voce_risolvi_piano(text,jsonb,text)'::regprocedure), E'\r', '');
  v_ancora text := E'''prima_nota'', (select nota from piano_voci where id = (v_voce->>''id'')::uuid));';
  v_quante integer;
begin
  if v_def like '%avviso_rate%' then
    return;  -- già fatto
  end if;
  v_quante := (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora);
  if v_quante <> 1 then
    raise exception 'voce_risolvi_piano nel database non ha l''anteprima «prima_nota» una volta sola (%): guarda il corpo vivo.', v_quante;
  end if;
  v_def := replace(v_def, v_ancora, v_ancora
    || E'\n      -- 11/11/2026: se il previsto cambia e le rate non lo fanno più,'
    || E'\n      -- l''appunto lo dice (non blocca: il mese lo sceglie Alessio).'
    || E'\n      if v_imp is not null and v_imp > 0 and exists (select 1 from piano_rate r where r.voce_id = (v_voce->>''id'')::uuid)'
    || E'\n         and (select sum(r.importo) from piano_rate r where r.voce_id = (v_voce->>''id'')::uuid) <> v_imp then'
    || E'\n        v_dati := v_dati || jsonb_build_object(''avviso_rate'','
    || E'\n          ''le rate di questa voce fanno '' || euro((select sum(r.importo) from piano_rate r where r.voce_id = (v_voce->>''id'')::uuid))'
    || E'\n          || '': dopo il sì sistemale da «Modifica» nella pagina del piano'');'
    || E'\n      end if;');
  execute v_def;
end $rate$;

revoke all on function voce_risolvi_piano(text, jsonb, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione che si annulla
-- ---------------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_voce     uuid;
  v_n        integer;
  v_r        jsonb;
  v_v        jsonb;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'VERIFICA: serve un titolare.';
  end if;
  if has_function_privilege('authenticated', 'vocabolari_per_la_posta()', 'execute')
     or has_function_privilege('anon', 'vocabolari_per_la_posta()', 'execute')
     or not has_function_privilege('service_role', 'vocabolari_per_la_posta()', 'execute') then
    raise exception 'VERIFICA: la porta degli elenchi per la posta non è come deve.';
  end if;

  begin  -- <<< la sotto-transazione che verrà annullata
    -- 1. Con la chiave di servizio gli elenchi arrivano, con le sezioni.
    set local role service_role;
    v_v := vocabolari_per_la_posta();
    reset role;
    if jsonb_array_length(coalesce(v_v->'sezioni_archivio', '[]'::jsonb)) = 0 then
      raise exception 'VERIFICA (1): con la chiave di servizio le sezioni dell''archivio non arrivano (%).', left(v_v::text, 200);
    end if;

    -- 2. Il previsto cambia, le rate no: l'appunto avvisa; senza rate, niente.
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    insert into piano_voci (gruppo, ordine, descrizione, importo_ivato, aliquota_iva, stato)
    values ('D', 998, 'ZZ voce rate verifica', 1000, 22, 'stimato')
    returning id into v_voce;
    insert into piano_rate (voce_id, mese_rel, importo) values (v_voce, 0, 600), (v_voce, 1, 400);
    v_r := voce_risolvi_dati('piano_voce_aggiorna', jsonb_build_object('voce_id', v_voce, 'importo', 1200));
    if coalesce(v_r->'dati'->>'avviso_rate', '') not like '%rate di questa voce fanno%' then
      raise exception 'VERIFICA (2): cambiando il previsto, l''appunto non avvisa sulle rate (%).', v_r;
    end if;
    if v_r->>'manca' is not null then
      raise exception 'VERIFICA (2): l''avviso sulle rate blocca il sì (%).', v_r->>'manca';
    end if;
    v_r := voce_risolvi_dati('piano_voce_aggiorna', jsonb_build_object('voce_id', v_voce, 'importo', 1000));
    if v_r->'dati' ? 'avviso_rate' then
      raise exception 'VERIFICA (2): con le rate che tornano, l''appunto avvisa lo stesso.';
    end if;
    perform set_config('request.jwt.claims', null, true);

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica delle sezioni per la posta e dell''avviso sulle rate');

  raise notice 'Fatto: posta-leggi riceve gli elenchi chiusi (le sezioni dell''archivio) da una porta sola; MEMO avvisa quando il previsto di una voce non torna più con le sue rate. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261111000003', 'la_posta_conosce_le_sezioni')
on conflict (version) do nothing;
