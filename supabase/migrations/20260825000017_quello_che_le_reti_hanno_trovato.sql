-- ============================================================================
-- QUELLO CHE LE RETI HANNO TROVATO — 25/08/2026
-- ============================================================================
--
-- 🔴 QUATTRO DIFETTI, E NON LI HA TROVATI UNA RILETTURA: li hanno trovati
--    le prove che questo progetto tiene accese, diventate rosse da sole
--    appena le due migrazioni dell'assistente sono entrate. E' il lavoro
--    per cui esistono, ed e' anche la ragione per cui vanno guardate
--    quando cambiano colore invece di essere spente.
--
--    1. `applica_lettura_etichetta` scrive DUE tabelle (`ingredients` e
--       `allergeni_prodotto`) e il gestionale la chiamava **dritta dal
--       browser**. E' la regola B4 del Contratto Architetturale: ogni
--       scrittura multi-tabella passa dal corridoio. Non e' una
--       formalita' — meta' scrittura riuscita qui vorrebbe dire un
--       prodotto con gli allergeni cambiati e nessuna origine, cioe' un
--       elenco che sembra letto da un'etichetta e non lo e'.
--    2. `impostazioni_ai_una_riga` era un vincolo MUTO: se scattasse,
--       risponderebbe in inglese col nome del vincolo.
--    3. `letture_foto.costo_euro` non era classificata nel censimento
--       delle unita': una colonna numerica legata a un ingrediente che
--       nessuno ha dichiarato «si converte» o «non si converte».
--    4. `origine_dell_insieme` e `allergeni_con_origine` scavalcano la
--       RLS senza chiedere chi sei. Delle due, **una sola deve restare**.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Il vincolo che non parlava
-- ----------------------------------------------------------------------------
comment on constraint impostazioni_ai_una_riga on impostazioni_ai is
  'Il tetto di spesa dell''assistente e'' un''impostazione del locale: ce n''e'' una sola. Se questo rifiuto compare, qualcuno sta provando a scriverne una seconda.';

-- ----------------------------------------------------------------------------
-- 2. L'aiuto interno esce dalla porta di servizio
-- ----------------------------------------------------------------------------
-- ⚠️ `origine_dell_insieme` la chiama SOLO il trigger che tiene aggiornato
--    il riflesso, e quel trigger gira come proprietario: non ha bisogno
--    del permesso di nessun utente. Concederlo era una riga di troppo, e
--    ogni riga di troppo in quell'elenco lo fa crescere in silenzio —
--    che e' precisamente cio' che il controllo del 13/08 esiste per
--    impedire.
--
-- ⚠️ `allergeni_con_origine` invece RESTA, ed e' una decisione: la deve
--    poter chiamare chi e' in sala col cliente davanti che chiede di
--    un'allergia. Non espone prezzi ne' costi — solo quali allergeni ha
--    un prodotto, cosa che la sala vede gia', e da dove vengono.
revoke execute on function origine_dell_insieme(uuid) from authenticated;

-- ----------------------------------------------------------------------------
-- 3. Il costo di una lettura non si converte con l'unita' del prodotto
-- ----------------------------------------------------------------------------
-- ⚠️ Corpo ripreso VIVO dal database: nessuna migrazione l'aveva toccata
--    dopo quella che l'ha creata, e lo si e' controllato invece di darlo
--    per scontato. Cambia una riga sola.
create or replace function colonne_unita_non_classificate()
returns table (tabella text, colonna text)
language sql
stable
set search_path = public
as $$
  with conosciute(t, c) as (values
    -- si convertono: quantita'
    ('ingredients','stock_minimum_threshold'),
    ('recipe_ingredients','quantity'),
    ('stock_lots','quantity_received'), ('stock_lots','quantity_remaining'),
    ('stock_consumptions','quantity'), ('stock_consumptions','quantita_richiesta'),
    ('shopping_list_items','quantity_needed'), ('shopping_list_items','quantita_arrivata'),
    ('anomalie_scarico','quantita_mancante'),
    ('ordini_fornitore_righe','quantita_base'),
    ('rettifiche_giacenza','atteso'), ('rettifiche_giacenza','dichiarato'),
    ('rettifiche_giacenza','differenza'),
    ('intercompany_cessions','quantity'),
    ('crops','harvested_quantity'),
    ('produzioni','quantita_ottenuta'), ('produzioni','resa_attesa'),
    -- si convertono: prezzi per unita' (si dividono) e il fattore
    ('ingredients','current_price'),
    ('stock_lots','unit_cost'),
    ('price_history','price'),
    ('intercompany_cessions','unit_price'),
    ('ordini_fornitore_righe','prezzo_atteso'),
    ('articoli_fornitore','fattore'),
    -- NON si convertono, e la ragione e' la stessa per tutte: sono euro
    -- gia' spesi, percentuali o conteggi, e non cambiano con l'unita' di
    -- misura del prodotto.
    ('ingredients','waste_percentage_default'), ('recipe_ingredients','waste_percentage'),
    ('stock_consumptions','costo'), ('produzioni','costo'), ('produzioni','dosi'),
    ('intercompany_cessions','total_amount'), ('intercompany_cessions','vat_rate'),
    ('shopping_list_items','purchased_amount'),
    ('rettifiche_giacenza','valore'),
    -- ⚠️ Il costo di una foto letta e' in EURO GIA' SPESI: se domani un
    -- prodotto passasse da chili a pezzi, quei centesimi resterebbero
    -- quelli. Non si converte.
    ('letture_foto','costo_euro'),
    -- ⚠️ La quantita' dell'ordine e' nell'unita' del FORNITORE (2 casse):
    -- e' quantita_base a parlare la lingua dell'ingrediente.
    ('ordini_fornitore_righe','quantita')
  )
  select c.table_name::text, c.column_name::text
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
     and t.table_type = 'BASE TABLE'
   where c.table_schema = 'public'
     and c.data_type = 'numeric'
     and c.table_name in (
       select table_name from information_schema.columns
        where table_schema = 'public' and column_name = 'ingredient_id')
     and not exists (select 1 from conosciute k
                      where k.t = c.table_name and k.c = c.column_name)
   order by 1, 2;
$$;

comment on function colonne_unita_non_classificate() is
  'Le colonne numeriche legate a un ingrediente che nessuno ha ancora dichiarato «si converte» o «non si converte» (23/08/2026, esteso il 25/08). Deve essere vuota: una colonna nuova che resta fuori e'' un numero che cambia significato in silenzio quando cambia l''unita''.';

revoke all on function colonne_unita_non_classificate() from public, anon, authenticated;
grant execute on function colonne_unita_non_classificate() to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_tit uuid;
  v_n   integer;
  v_txt text;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare in user_roles.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- (A) Il vincolo adesso parla italiano.
  select obj_description(c.oid, 'pg_constraint') into v_txt
    from pg_constraint c join pg_class t on t.oid = c.conrelid
   where t.relname = 'impostazioni_ai' and c.conname = 'impostazioni_ai_una_riga';
  if coalesce(v_txt, '') = '' then
    raise exception 'Il vincolo del tetto e'' ancora muto: se scattasse risponderebbe in inglese';
  end if;

  -- (B) Il censimento delle unita' e' di nuovo vuoto.
  --     ⚠️ UNA PROPRIETA', non un numero: «nessuna colonna resta non
  --     classificata» resta vera domani, un conteggio no.
  select count(*) into v_n from colonne_unita_non_classificate();
  if v_n <> 0 then
    raise exception 'Restano % colonne numeriche non classificate: %', v_n,
      (select string_agg(tabella || '.' || colonna, ', ') from colonne_unita_non_classificate());
  end if;

  -- (C) L'aiuto interno non e' piu' eseguibile da un utente qualunque,
  --     ma il riflesso continua a funzionare — ed e' il verso che conta:
  --     togliere un permesso e rompere il trigger sarebbe peggio del
  --     permesso di troppo.
  if has_function_privilege('authenticated', 'origine_dell_insieme(uuid)', 'execute') then
    raise exception 'origine_dell_insieme e'' ancora eseguibile da un utente qualunque';
  end if;
  if not has_function_privilege('authenticated', 'allergeni_con_origine(uuid)', 'execute') then
    raise exception 'allergeni_con_origine non e'' piu'' eseguibile dalla sala: il cameriere resterebbe senza';
  end if;

  perform set_config('request.jwt.claims', null, true);

  raise notice 'Le reti sono rientrate: il vincolo parla italiano, nessuna colonna resta non classificata, e l''aiuto interno non e'' piu'' una porta aperta.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260825000017', 'quello_che_le_reti_hanno_trovato')
on conflict (version) do nothing;
