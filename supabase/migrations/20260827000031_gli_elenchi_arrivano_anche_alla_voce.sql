-- ============================================================================
-- GLI ELENCHI ARRIVANO ANCHE ALLA VOCE — 27/08/2026
-- ============================================================================
--
-- Seconda metà del Blocco 2: MEMO deve ricevere gli elenchi VERI, non quelli
-- di ieri. Nella foto e nella posta gli arrivano già; qui arrivano alla
-- **voce**, che è la porta dove Alessio detta con le mani occupate.
--
-- ----------------------------------------------------------------------------
-- PERCHÉ DENTRO IL CATALOGO E NON DA UNA CHIAMATA A PARTE
-- ----------------------------------------------------------------------------
-- `ascolta-voce` ha **due porte**: quella dell'app, che parla col token di
-- Alessio, e quella della **Scorciatoia dell'orologio**, che parla con la
-- chiave anonima e una chiave di scorciatoia.
--
-- 🔴 Una seconda RPC concessa a `authenticated` avrebbe risposto **no** alla
--    Scorciatoia: da quella porta MEMO sarebbe rimasto senza elenchi, e
--    avrebbe lasciato la categoria vuota **esattamente dove serve di più**.
--    È la famiglia del 26/08 — *«due porte che portano allo stesso posto, e
--    il controllo su quella che non agisce»* — letta al contrario: qui il
--    dato va messo dove passano **tutt'e due**.
--
-- `voce_apri_sessione` chiama `voce_catalogo()`, e `voce_catalogo()` gira come
-- proprietaria: mettendo gli elenchi lì dentro arrivano a entrambe le porte,
-- **senza un secondo giro di rete** e senza un permesso nuovo da concedere.
--
-- ⚠️ Il corpo è preso dal PROGETTO DI PROVA, non dalla produzione: là ci sono
--    migrazioni in attesa di push, e `funzione:viva` senza `--prova` legge il
--    gestionale vero (precisazione del 27/08).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.voce_catalogo()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_out jsonb;
begin
  if not is_titolare() then
    raise exception 'Il catalogo della voce e'' riservato al titolare.';
  end if;

  select jsonb_build_object(
    'prodotti', coalesce((
      select jsonb_agg(jsonb_build_object('n', r.n, 'nome', r.name, 'unita', r.unit) order by r.n)
        from (select row_number() over (order by i.name) as n, i.name, i.unit::text as unit
                from ingredients i) r
    ), '[]'::jsonb),
    'frigoriferi', coalesce((
      select jsonb_agg(jsonb_build_object('n', r.n, 'nome', r.name) order by r.n)
        from (select row_number() over (order by e.name) as n, e.name
                from haccp_equipment e where e.active) r
    ), '[]'::jsonb),
    'pulizie', coalesce((
      select jsonb_agg(jsonb_build_object('n', r.n, 'nome', r.name) order by r.n)
        from (select row_number() over (order by c.name) as n, c.name
                from haccp_cleaning_tasks c where c.active) r
    ), '[]'::jsonb),
    'causali', coalesce((
      select jsonb_agg(jsonb_build_object('n', r.n, 'nome', r.label, 'verso', r.kind) order by r.n)
        from (select row_number() over (order by c.kind, c.label) as n, c.label, c.kind
                from cash_causali c
               where c.active and c.kind in ('entrata', 'uscita')) r
    ), '[]'::jsonb),
    'fornitori', coalesce((
      select jsonb_agg(jsonb_build_object('n', r.n, 'nome', r.name) order by r.n)
        from (select row_number() over (order by s.name) as n, s.name from suppliers s) r
    ), '[]'::jsonb),
    'conti_correnti', coalesce((
      select jsonb_agg(jsonb_build_object('nome', b.nome) order by b.nome)
        from conti_bancari b where b.attivo
    ), '[]'::jsonb),
    -- 🔴 GLI ELENCHI DI ALESSIO ARRIVANO QUI (27/08/2026), e non da una
    --    chiamata a parte: la porta della Scorciatoia parla come `anon`, e
    --    una seconda RPC concessa a `authenticated` le risponderebbe di no —
    --    quindi da quella porta MEMO resterebbe senza elenchi proprio dove
    --    Alessio detta con le mani occupate. Il catalogo passa da qui in
    --    entrambe le porte, e questa funzione gira come proprietaria.
    'vocabolari', vocabolari_per_assistente()
  ) into v_out;

  return v_out;
end $function$;
revoke all on function voce_catalogo() from public, anon, authenticated;
grant execute on function voce_catalogo() to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_foto  jsonb;
  v_tit   uuid;
  v_cat   jsonb;
  v_r     jsonb;
  v_mie_c text[] := '{}';
  v_n     integer;
begin
  v_foto := foto_righe();

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Verifica impossibile: nessun titolare configurato';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- 1. Gli elenchi sono nel catalogo della voce
  v_cat := voce_catalogo();
  if v_cat->'vocabolari' is null then
    raise exception 'Il catalogo della voce non porta gli elenchi';
  end if;
  if jsonb_array_length(v_cat->'vocabolari'->'categorie_prodotto') < 15 then
    raise exception 'Le categorie non arrivano alla voce: %',
      jsonb_array_length(v_cat->'vocabolari'->'categorie_prodotto');
  end if;

  -- 2. E il catalogo di prima non si e' perso per strada: e' il controllo
  --    che dice se la riscrittura ha annullato qualcosa (lezione del 18/08).
  if v_cat->'prodotti' is null or v_cat->'frigoriferi' is null
     or v_cat->'pulizie' is null or v_cat->'causali' is null
     or v_cat->'fornitori' is null or v_cat->'conti_correnti' is null then
    raise exception 'La riscrittura ha perso un pezzo del catalogo: %',
      (select string_agg(k, ', ') from jsonb_object_keys(v_cat) k);
  end if;

  -- 3. 🔴 UNA CATEGORIA AGGIUNTA DA ALESSIO ARRIVA ALLA VOCE DA SOLA
  v_r := aggiungi_categoria_ingrediente('Conserve di verifica 20260827000031');
  v_mie_c := v_mie_c || (v_r->>'codice');

  v_cat := voce_catalogo();
  select count(*) into v_n
    from jsonb_array_elements(v_cat->'vocabolari'->'categorie_prodotto') e
   where e->>'codice' = 'conserve_di_verifica_20260827000031';
  if v_n <> 1 then
    raise exception 'Una categoria aggiunta non arriva al catalogo della voce';
  end if;

  -- 4. Il portiere del catalogo e' ancora al suo posto
  perform set_config('request.jwt.claims', null, true);
  begin
    perform voce_catalogo();
    raise exception 'Il catalogo della voce risponde a chi non e'' il titolare';
  exception
    when others then
      if sqlerrm not like '%riservato al titolare%' then
        raise exception 'Il rifiuto del catalogo dice la cosa sbagliata: %', sqlerrm;
      end if;
  end;

  delete from categorie_ingrediente where codice = any(v_mie_c);
  perform pretendi_nessun_residuo(v_foto, 'gli elenchi arrivano anche alla voce');

  raise notice 'Il catalogo della voce porta gli elenchi di Alessio, e una categoria aggiunta gli arriva da sola — da tutt''e due le porte, perche'' passano entrambe da qui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000031', 'gli_elenchi_arrivano_anche_alla_voce') on conflict (version) do nothing;
