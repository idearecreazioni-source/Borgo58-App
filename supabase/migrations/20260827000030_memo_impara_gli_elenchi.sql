-- ============================================================================
-- MEMO IMPARA GLI ELENCHI — 27/08/2026
-- ============================================================================
--
-- **Il seguito obbligato delle categorie che diventano dati**, e il mandato lo
-- dice con parole che vale la pena ripetere: *«se le categorie diventano
-- modificabili, MEMO deve riceverle dall'elenco VERO, altrimenti continua a
-- proporre le vecchie e sbaglia senza dirlo. Quindi il lavoro non è il
-- pulsante: è il modo in cui MEMO impara le liste di Alessio.»*
--
-- ----------------------------------------------------------------------------
-- DOVE VIVEVANO GLI ELENCHI DI MEMO, MISURATO
-- ----------------------------------------------------------------------------
-- Le categorie dei prodotti stavano scritte a mano in **quattro posti dentro
-- le funzioni online**, oltre al database:
--   1. `leggi-foto`      — nel prompt, riga 92
--   2. `ascolta-voce`    — nel prompt, riga 113
--   3. `posta-leggi`     — nel prompt, riga 212
--   4. `posta-leggi`     — **in un insieme che VALIDA**, righe 442-444
--
-- 🔴 IL QUARTO È IL PEGGIORE, e non somiglia agli altri tre. I primi tre
--    *propongono*: al massimo MEMO non conosce una categoria nuova e ne
--    sceglie un'altra. Il quarto **sostituisce**:
--
--        categoria: CATEGORIE_VALIDE.has(categoria) ? categoria : "altro"
--
--    Quindi una categoria che Alessio ha appena aggiunto, letta
--    correttamente da MEMO su una fattura, sarebbe stata **scambiata con
--    «altro»** — nessun errore, nessun avviso, e il prodotto in una
--    categoria che nessuno ha scelto. È la stessa forma del difetto del
--    27/08 sul menu a tendina, spostata nella funzione online.
--
-- ----------------------------------------------------------------------------
-- GLI ELENCHI SI CHIEDONO, E LA FONTE È LA RETE DEI VOCABOLARI
-- ----------------------------------------------------------------------------
-- `vocabolari_per_assistente()` non contiene nessun elenco: li **ricava** da
-- `vocabolari_chiusi()`, cioè dal catalogo del database. Non può divergere
-- per costruzione — non c'è un secondo posto da tenere d'accordo.
--
-- ⚠️ LE CATEGORIE SONO L'ECCEZIONE VOLUTA: a MEMO si danno solo le **ACCESE**
--    (`categorie_proponibili()`), non tutte le legali. Proporre una categoria
--    che Alessio ha spento vorrebbe dire rimettere in circolo una cosa che
--    ha deciso di non usare più. Legale e proponibile sono due cose diverse.
--
-- ⚠️ E UN ELENCO CHE NON ARRIVA NON SI SOSTITUISCE CON UNO SCRITTO A MANO:
--    quella sarebbe di nuovo una seconda verità, e per di più una che entra
--    in gioco **proprio nel momento in cui il database non risponde** —
--    cioè quando nessuno la sta guardando. Se la lettura fallisce, la
--    funzione online lo dice a MEMO e MEMO lascia il campo vuoto: il
--    database mette «altro», che è una risposta dichiarata invece di una
--    inventata.
-- ============================================================================

create or replace function vocabolari_per_assistente()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_out jsonb;
begin
  -- ⚠️ Aperta a tutto lo staff perche' le funzioni online la chiamano col
  --    token di chi sta usando il gestionale, e MEMO lo usa oggi solo
  --    Alessio ma le foto della merce le fara' chi riceve. Non espone
  --    niente: sono gli elenchi dei valori ammessi, cioe' cio' che ogni
  --    menu a tendina del gestionale mostra gia'.
  v_out := jsonb_build_object(
    -- LE CATEGORIE: solo le accese, ed e' l'eccezione voluta.
    'categorie_prodotto', (
      select coalesce(jsonb_agg(jsonb_build_object('codice', c.codice, 'nome', c.nome)
                                order by c.ordine, c.nome), '[]'::jsonb)
        from categorie_proponibili() c),
    'unita',              elenco_vocabolario('ingredients', 'unit'),
    'allergeni',          elenco_vocabolario('ingredients', 'allergens'),
    'conservazione',      elenco_vocabolario('ingredients', 'storage_type'),
    'categorie_ricetta',  elenco_vocabolario('recipes', 'category'),
    'verso_cassa',        elenco_vocabolario('cash_movements', 'direction'),
    'mezzi_cassa',        elenco_vocabolario('cash_movements', 'mezzo'),
    'tipi_documento',     elenco_vocabolario('cash_movements', 'tipo_documento')
  );
  return v_out;
end;
$$;

-- L'aiuto che pesca UN elenco dalla rete dei vocabolari.
-- ⚠️ Restituisce `null` — non un array vuoto — quando quella colonna non ha
--    un vocabolario chiuso: un array vuoto direbbe a MEMO «non ci sono
--    valori ammessi», che e' un'altra cosa da «non lo so».
create or replace function elenco_vocabolario(p_tabella text, p_colonna text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select to_jsonb(v.valori)
    from vocabolari_chiusi() v
   where v.tabella = p_tabella and v.colonna = p_colonna
   limit 1;
$$;

revoke all on function elenco_vocabolario(text, text) from public, anon, authenticated;
revoke all on function vocabolari_per_assistente() from public, anon, authenticated;
grant execute on function vocabolari_per_assistente() to authenticated;

comment on function elenco_vocabolario(text, text) is
  'Un solo elenco chiuso, preso da `vocabolari_chiusi()`. Vuoto (non un array '
  'vuoto) se quella colonna non ha un vocabolario: «non ci sono valori '
  'ammessi» e «non lo so» sono due cose diverse. ⚠️ NON eseguibile da nessun '
  'utente: la chiama solo `vocabolari_per_assistente()`.';

comment on function vocabolari_per_assistente() is
  'Gli elenchi chiusi che servono a MEMO, ricavati dal catalogo del database e '
  'mai scritti a mano: cosi'' non possono divergere. ⚠️ Delle categorie si '
  'danno solo le ACCESE: proporre una categoria spenta rimetterebbe in circolo '
  'una cosa che Alessio ha deciso di non usare piu''. Prima del 27/08/2026 '
  'quegli elenchi vivevano scritti a mano in QUATTRO posti dentro le funzioni '
  'online, e uno dei quattro non li proponeva — li VALIDAVA, sostituendo con '
  '«altro» qualunque categoria nuova.';

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_foto  jsonb;
  v_tit   uuid;
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

  v_r := vocabolari_per_assistente();

  -- 1. Gli elenchi ci sono tutti e nessuno e' vuoto
  if jsonb_array_length(v_r->'categorie_prodotto') < 15 then
    raise exception 'Le categorie per MEMO sono troppo poche: %', jsonb_array_length(v_r->'categorie_prodotto');
  end if;
  if not (v_r->'unita' ? 'kg') then
    raise exception 'Le unita'' non arrivano: %', v_r->'unita';
  end if;
  if not (v_r->'allergeni' ? 'glutine') then
    raise exception 'Gli allergeni non arrivano: %', v_r->'allergeni';
  end if;
  if not (v_r->'conservazione' ? 'dispensa') then
    raise exception 'La conservazione non arriva: %', v_r->'conservazione';
  end if;
  if not (v_r->'categorie_ricetta' ? 'antipasto') then
    raise exception 'Le categorie delle ricette non arrivano: %', v_r->'categorie_ricetta';
  end if;
  if not (v_r->'verso_cassa' ? 'uscita') then
    raise exception 'Il verso dei movimenti non arriva: %', v_r->'verso_cassa';
  end if;
  if not (v_r->'mezzi_cassa' ? 'cassa') then
    raise exception 'I mezzi di cassa non arrivano: %', v_r->'mezzi_cassa';
  end if;

  -- 2. 🔴 UNA CATEGORIA AGGIUNTA DA ALESSIO ARRIVA A MEMO DA SOLA, ed e' il
  --    guadagno del blocco: prima non ci sarebbe arrivata mai.
  v_r := aggiungi_categoria_ingrediente('Conserve di verifica 20260827000030');
  v_mie_c := v_mie_c || (v_r->>'codice');

  v_r := vocabolari_per_assistente();
  select count(*) into v_n
    from jsonb_array_elements(v_r->'categorie_prodotto') e
   where e->>'codice' = 'conserve_di_verifica_20260827000030';
  if v_n <> 1 then
    raise exception 'Una categoria aggiunta non arriva a MEMO';
  end if;

  -- 3. E UNA CATEGORIA SPENTA NON ARRIVA: legale non vuol dire proponibile
  update categorie_ingrediente set attiva = false
   where codice = 'conserve_di_verifica_20260827000030';
  v_r := vocabolari_per_assistente();
  select count(*) into v_n
    from jsonb_array_elements(v_r->'categorie_prodotto') e
   where e->>'codice' = 'conserve_di_verifica_20260827000030';
  if v_n <> 0 then
    raise exception 'Una categoria spenta viene ancora proposta a MEMO';
  end if;

  -- 4. L'aiuto interno non e' eseguibile da nessun utente
  perform set_config('request.jwt.claims', null, true);
  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'elenco_vocabolario'
     and (has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute')
       or has_function_privilege('public', p.oid, 'execute'));
  if v_n <> 0 then
    raise exception 'L''aiuto interno degli elenchi e'' eseguibile da un utente';
  end if;

  delete from categorie_ingrediente where codice = any(v_mie_c);
  perform pretendi_nessun_residuo(v_foto, 'MEMO impara gli elenchi');

  raise notice 'MEMO riceve gli elenchi dal database: una categoria aggiunta da Alessio gli arriva da sola, una spenta non gli arriva piu''.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000030', 'memo_impara_gli_elenchi') on conflict (version) do nothing;
