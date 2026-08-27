-- ============================================================================
-- GLI ELENCHI DI MEMO LI DECIDE LA RLS — 27/08/2026
-- ============================================================================
--
-- ✅ QUINTA VOLTA IN UN GIORNO che `tests/app/permessi.test.js` diventa rossa
--    da sola, e stavolta su **`vocabolari_per_assistente`**, nata poche ore
--    prima: `security definer` senza portiere.
--
-- ----------------------------------------------------------------------------
-- E QUI LA SCELTA NON ERA OVVIA, perché i chiamanti sono TRE con TRE IDENTITÀ
-- ----------------------------------------------------------------------------
--   · `leggi-foto` e `schede-prodotto` chiamano col token del **titolare**;
--   · `voce_catalogo()` la chiama dall'interno di una funzione **proprietaria**
--     — ed è la strada da cui passa anche la Scorciatoia dell'orologio, che
--     arriva come `anon`;
--   · `posta-leggi` la chiama con la chiave di **servizio**, perché è un
--     lavoro pianificato e non ha nessun utente dietro.
--
-- 🔴 UN PORTIERE `is_titolare()` AVREBBE ROTTO IL TERZO. Con la chiave di
--    servizio `auth.uid()` è vuoto, quindi `is_titolare()` è **falso**: la
--    lettura della posta avrebbe perso gli elenchi **in silenzio**, e sarebbe
--    ricaduta sul ramo «non disponibili» — cioè MEMO avrebbe lasciato la
--    categoria vuota su ogni prodotto nuovo letto da una fattura. Sarebbe
--    stata una cura peggiore del difetto, come il portiere che avrebbe rotto
--    il carico in cucina la notte scorsa.
--
-- ⚠️ QUINDI SI TOGLIE IL MOTIVO PER CUI COMPARE, invece di spiegarlo: la
--    funzione diventa `security invoker` e **chi può leggere lo decide la
--    RLS**, che è l'unico posto dove quella regola vive. Il servizio la
--    scavalca per costruzione, il titolare e lo staff hanno il `select` sul
--    catalogo delle categorie, e dentro `voce_catalogo()` — che è
--    proprietaria — vale tutto.
--
-- ----------------------------------------------------------------------------
-- E L'AIUTO INTERNO SPARISCE, non resta spento
-- ----------------------------------------------------------------------------
-- `elenco_vocabolario` era `security definer` e chiuso a tutti: chiamandola da
-- una funzione `invoker` avrebbe risposto **permesso negato**. Si potrebbe
-- aprirla — e allora sarebbe LEI a comparire nella rete. Il suo lavoro sono
-- tre righe: **si fonde dentro** e la funzione si toglie.
--
-- ⚠️ Non si lascia in giro inutilizzata: *«una colonna spenta, fra tre mesi,
--    qualcuno la riaccende credendo di riparare qualcosa»* (14/08), e vale
--    identico per una funzione.
--
-- rete-guardie: vocabolari_per_assistente — il portiere si toglie apposta: la chiama anche `posta-leggi` con la chiave di servizio, dove `is_titolare()` è falso, e un portiere le farebbe perdere gli elenchi in silenzio. Chi può leggere lo decide la RLS del catalogo delle categorie.
-- ============================================================================

create or replace function vocabolari_per_assistente()
returns jsonb
language sql
stable
-- ⚠️ `security invoker` (il predefinito, scritto per essere letto): vedi
--    l'intestazione. Non e' una dimenticanza.
set search_path to 'public'
as $$
  select jsonb_build_object(
    -- LE CATEGORIE: solo le accese, ed e' l'eccezione voluta — proporre una
    -- categoria spenta rimetterebbe in circolo una cosa che Alessio ha
    -- deciso di non usare piu'.
    'categorie_prodotto', (
      select coalesce(jsonb_agg(jsonb_build_object('codice', c.codice, 'nome', c.nome)
                                order by c.ordine, c.nome), '[]'::jsonb)
        from categorie_proponibili() c),
    -- Gli altri elenchi arrivano dalla rete dei vocabolari, cioe' dal
    -- catalogo del database: non c'e' un secondo posto da tenere d'accordo.
    -- ⚠️ Vuoto (non un array vuoto) dove quella colonna non ha un
    --    vocabolario: «non ci sono valori ammessi» e «non lo so» sono due
    --    cose diverse.
    'unita',             (select to_jsonb(v.valori) from vocabolari_chiusi() v
                           where v.tabella = 'ingredients' and v.colonna = 'unit' limit 1),
    'allergeni',         (select to_jsonb(v.valori) from vocabolari_chiusi() v
                           where v.tabella = 'ingredients' and v.colonna = 'allergens' limit 1),
    'conservazione',     (select to_jsonb(v.valori) from vocabolari_chiusi() v
                           where v.tabella = 'ingredients' and v.colonna = 'storage_type' limit 1),
    'categorie_ricetta', (select to_jsonb(v.valori) from vocabolari_chiusi() v
                           where v.tabella = 'recipes' and v.colonna = 'category' limit 1),
    'verso_cassa',       (select to_jsonb(v.valori) from vocabolari_chiusi() v
                           where v.tabella = 'cash_movements' and v.colonna = 'direction' limit 1),
    'mezzi_cassa',       (select to_jsonb(v.valori) from vocabolari_chiusi() v
                           where v.tabella = 'cash_movements' and v.colonna = 'mezzo' limit 1),
    'tipi_documento',    (select to_jsonb(v.valori) from vocabolari_chiusi() v
                           where v.tabella = 'cash_movements' and v.colonna = 'tipo_documento' limit 1)
  );
$$;

revoke all on function vocabolari_per_assistente() from public, anon, authenticated;
grant execute on function vocabolari_per_assistente() to authenticated;

comment on function vocabolari_per_assistente() is
  'Gli elenchi chiusi che servono a MEMO, ricavati dal catalogo del database e '
  'mai scritti a mano: cosi'' non possono divergere. Delle categorie si danno '
  'solo le ACCESE. ⚠️ `security invoker`: la chiamano tre pezzi con tre '
  'identita'' diverse — il titolare dalla foto, il proprietario dal catalogo '
  'della voce, la chiave di SERVIZIO dalla lettura della posta — e un portiere '
  '`is_titolare()` avrebbe fatto perdere gli elenchi al terzo in silenzio. Chi '
  'puo'' leggere lo decide la RLS del catalogo delle categorie.';

-- L'aiuto interno non serve piu': il suo lavoro e' dentro la funzione.
drop function if exists elenco_vocabolario(text, text);

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_foto  jsonb;
  v_tit   uuid;
  v_staff uuid;
  v_r     jsonb;
  v_cat   jsonb;
  v_n     integer;
begin
  v_foto := foto_righe();

  select user_id into v_tit   from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role <> 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Verifica impossibile: nessun titolare configurato';
  end if;

  -- 1. Non scavalca piu' la RLS, e l'aiuto interno non c'e' piu'
  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'vocabolari_per_assistente' and p.prosecdef;
  if v_n <> 0 then
    raise exception 'La funzione degli elenchi scavalca ancora la RLS';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'elenco_vocabolario') then
    raise exception 'L''aiuto interno e'' rimasto in giro spento';
  end if;

  -- 2. IL TITOLARE li vede
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  v_r := vocabolari_per_assistente();
  if jsonb_array_length(v_r->'categorie_prodotto') < 15 then
    raise exception 'Il titolare non vede le categorie: %', jsonb_array_length(v_r->'categorie_prodotto');
  end if;
  if not (v_r->'allergeni' ? 'glutine') then
    raise exception 'Il titolare non vede gli allergeni: %', v_r->'allergeni';
  end if;

  -- 3. 🔴 LA CHIAVE DI SERVIZIO li vede, ed e' il controllo che un portiere
  --    avrebbe fatto fallire: senza claims, `is_titolare()` e' falso.
  perform set_config('request.jwt.claims', null, true);
  v_r := vocabolari_per_assistente();
  if jsonb_array_length(v_r->'categorie_prodotto') < 15 then
    raise exception 'Senza un utente (la lettura della posta) gli elenchi si svuotano: %',
      jsonb_array_length(v_r->'categorie_prodotto');
  end if;

  -- 4. E LO STAFF li vede: le foto della merce le fara' chi riceve
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_r := vocabolari_per_assistente();
    if jsonb_array_length(v_r->'categorie_prodotto') < 15 then
      raise exception 'Lo staff non vede le categorie: %', jsonb_array_length(v_r->'categorie_prodotto');
    end if;
    perform set_config('request.jwt.claims', null, true);
  end if;

  -- 5. E il catalogo della voce continua a portarli
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  v_cat := voce_catalogo();
  if jsonb_array_length(v_cat->'vocabolari'->'categorie_prodotto') < 15 then
    raise exception 'Il catalogo della voce ha perso gli elenchi';
  end if;
  perform set_config('request.jwt.claims', null, true);

  perform pretendi_nessun_residuo(v_foto, 'gli elenchi di MEMO li decide la RLS');

  raise notice 'Gli elenchi arrivano a tutti e tre i chiamanti: il titolare, lo staff, e la chiave di servizio della lettura posta — che un portiere avrebbe lasciato senza.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000032', 'gli_elenchi_di_memo_li_decide_la_rls') on conflict (version) do nothing;
