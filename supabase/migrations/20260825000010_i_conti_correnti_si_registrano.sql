-- ============================================================================
-- I CONTI CORRENTI SI REGISTRANO DA UNA SCHERMATA — 25/08/2026
-- ============================================================================
--
-- 🔴 LA VIA D'USCITA DEL RIFIUTO. Da stamattina un movimento di banca
--    senza conto viene respinto, e il messaggio dice «aprilo da Cassa →
--    Conti correnti». Ma quella schermata NON ESISTEVA: misurato, in
--    tutto `src/` nessun file nominava `conti_bancari` — la tabella c'era
--    dal 15/08 e non la leggeva ne' la scriveva nessuno.
--
-- ⚠️ UN RIFIUTO SENZA GESTO D'USCITA E' UN VICOLO CIECO, ed e' un difetto
--    a se' in questo progetto (regola del 16/08). Senza questa meta', il
--    primo bonifico vero avrebbe fermato il gestionale mandando Alessio
--    in una schermata che non c'e'.
--
-- ⚠️ PERCHE' UNA FUNZIONE E NON DUE `update` DALLA SCHERMATA. Segnare il
--    conto di sempre vuol dire togliere il segno agli altri e metterlo a
--    questo: due scritture che devono riuscire insieme. Fatte in fila dal
--    browser, se la seconda non parte si resta **senza nessun conto di
--    sempre** — e da quel momento ogni pagamento di fattura viene
--    respinto, senza che nessuno capisca perche'. Qui e' una transazione
--    sola. E' una tabella sola, quindi non passa dal corridoio: stessa
--    forma di `collega_articoli` e `rimanda_avviso`.
-- ============================================================================

create or replace function imposta_conto_predefinito(p_conto_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_conto conti_bancari%rowtype;
begin
  -- `security definer` gira senza RLS: il portiere va rimesso dentro.
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' scegliere il conto principale.'
      using errcode = 'P0001';
  end if;

  select * into v_conto from conti_bancari where id = p_conto_id;
  if v_conto.id is null then
    raise exception 'Questo conto non esiste piu''.' using errcode = 'P0001';
  end if;

  -- ⚠️ Un conto spento non puo' essere quello di sempre: i movimenti ci
  --    finirebbero sopra senza che compaia da nessuna parte. Meglio un
  --    rifiuto adesso che un saldo che non torna fra un mese.
  if not v_conto.attivo then
    raise exception 'Il conto «%» e'' spento: riaccendilo prima di renderlo il conto principale.', v_conto.nome
      using errcode = 'P0001';
  end if;

  -- Prima si toglie, poi si mette: l'ordine non e' indifferente, perche'
  -- l'indice ammette un solo conto principale attivo per societa'.
  update conti_bancari
     set predefinito = false
   where entity_id = v_conto.entity_id and predefinito and id <> p_conto_id;

  update conti_bancari set predefinito = true where id = p_conto_id;
end;
$function$;

revoke all on function imposta_conto_predefinito(uuid) from public, anon, authenticated;
grant execute on function imposta_conto_predefinito(uuid) to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_ent       uuid;
  v_titolare  uuid;
  v_a         uuid;
  v_b         uuid;
  v_preesist  uuid[];
  v_ok        boolean;
  v_n         integer;
begin
  select id into v_ent from entities order by created_at limit 1;
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_ent is null or v_titolare is null then
    raise exception 'Manca la societa'' o il titolare: impossibile verificare.';
  end if;

  -- ⚠️ La funzione ha un portiere: senza claims risponde «solo il
  --    titolare», e la verifica proverebbe il rifiuto invece della
  --    regola. Si impersona, come fanno gli altri blocchi.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select array_agg(id) into v_preesist
    from conti_bancari where entity_id = v_ent and predefinito and attivo;

  insert into conti_bancari (entity_id, nome, attivo, predefinito)
  values (v_ent, 'ZZ verifica conto uno', true, false) returning id into v_a;
  insert into conti_bancari (entity_id, nome, attivo, predefinito)
  values (v_ent, 'ZZ verifica conto due', true, false) returning id into v_b;

  -- Il primo diventa quello di sempre — e toglie il segno a chi ce l'aveva
  perform imposta_conto_predefinito(v_a);
  if not (select predefinito from conti_bancari where id = v_a) then
    raise exception 'Il conto non e'' diventato quello di sempre';
  end if;
  select count(*) into v_n
    from conti_bancari where entity_id = v_ent and predefinito and attivo;
  if v_n <> 1 then
    raise exception 'I conti «di sempre» attivi sono %, non uno', v_n;
  end if;

  -- Si passa all'altro senza dover togliere il primo a mano
  perform imposta_conto_predefinito(v_b);
  if (select predefinito from conti_bancari where id = v_a) then
    raise exception 'Il conto di prima e'' rimasto «di sempre»: sono due';
  end if;
  if not (select predefinito from conti_bancari where id = v_b) then
    raise exception 'Il secondo conto non e'' diventato quello di sempre';
  end if;

  -- Un conto spento non lo diventa
  update conti_bancari set attivo = false, predefinito = false where id = v_a;
  v_ok := false;
  begin
    perform imposta_conto_predefinito(v_a);
    raise exception 'ATTESO RIFIUTO: un conto spento e'' diventato quello di sempre';
  exception
    when sqlstate 'P0001' then
      if sqlerrm like 'ATTESO RIFIUTO%' then raise; end if;
      if sqlerrm not like '%e'' spento%' then
        raise exception 'Rifiutato con la frase sbagliata: «%»', sqlerrm;
      end if;
      v_ok := true;
  end;
  if not v_ok then
    raise exception 'Il conto spento non e'' stato rifiutato';
  end if;

  -- Pulizia — per identificativo, e i conti di prima tornano com'erano
  delete from conti_bancari where id in (v_a, v_b);
  update conti_bancari set predefinito = true
   where id = any(coalesce(v_preesist, array[]::uuid[]));

  select count(*) into v_n
    from conti_bancari where entity_id = v_ent and predefinito and attivo;
  if v_n <> coalesce(array_length(v_preesist, 1), 0) then
    raise exception 'I conti «di sempre» non sono tornati com''erano';
  end if;

  raise notice 'Il conto principale si sceglie in un gesto solo, e uno spento non lo diventa.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260825000010', 'i_conti_correnti_si_registrano')
on conflict (version) do nothing;
