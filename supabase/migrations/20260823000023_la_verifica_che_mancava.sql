-- =====================================================================
-- LA VERIFICA CHE MANCAVA — quello che due migrazioni non hanno chiuso
-- 23/08/2026
-- =====================================================================
-- 🔴 REGOLA DI ALESSIO, scritta stasera e valida da qui in avanti:
--
--   *«Le migrazioni gia' applicate non si riscrivono mai: il file racconta
--   cosa e' successo quel giorno, e correggerlo lo rende una bugia per chi
--   ricostruira' da zero fra un anno. Si sistema con una migrazione NUOVA,
--   che aggiunge invece di riscrivere.»*
--
-- Quindi qui dentro non si tocca nessun file di ieri: si finisce il lavoro
-- che due di loro hanno lasciato aperto applicandole in produzione.
--
-- ---------------------------------------------------------------------
-- COSA ERA RIMASTO APERTO
-- ---------------------------------------------------------------------
-- **`20260823000006`** si e' fermata a meta' in produzione: aveva
-- rinominato la colonna e non aveva ancora riscritto le funzioni che la
-- nominavano — quattro funzioni puntavano a una colonna sparita. E' stata
-- rimessa in piedi e poi applicata per intero, ma nessuno ha piu'
-- **controllato** che sia atterrata tutta. La sezione 1 lo controlla.
--
-- **`20260823000012`** ha fatto il suo lavoro (il controllo sulle
-- quantita' troppo piccole c'e', identico sui due database) ma **non si e'
-- registrata**: la sua verifica si e' fermata. La sezione 2 rifa' quella
-- verifica come andava scritta, e — solo se passa — la registra.
--
-- ---------------------------------------------------------------------
-- 🔴 PERCHE' QUELLA VERIFICA SI FERMAVA, e la regola che ne esce
-- ---------------------------------------------------------------------
-- Prendeva **in prestito un prodotto vero misurato in chili**:
--
--     insert into recipe_ingredients (...)
--     select v_ric, i.id, 0.00003, 'kg' from ingredients i
--      where i.active and i.unit = 'kg' limit 1;
--
-- In produzione i prodotti sono **zero**: la select non trova niente,
-- l'insert non tocca nessuna riga, nessun rifiuto scatta — e il controllo
-- legge «non e' successo niente» come «la regola non funziona».
--
-- ⚠️ E' la **trappola del caso vuoto** (17/08) dentro una verifica, unita
-- alla regola del 16/08: *il perimetro di una prova dev'essere fatto di
-- roba che la prova ha creato.* Qui c'era gia' un prodotto in chili
-- costruito dalla verifica stessa — bastava usare quello.
--
-- ⚠️ E anche la RICETTA era in prestito (`select id from recipes limit 1`):
-- in produzione ce n'erano, quindi non si e' visto. Su un database senza
-- ricette l'intero blocco sarebbe stato **saltato in silenzio**, e la
-- verifica sarebbe passata verde senza provare niente. Qui si costruisce
-- tutto: ricetta, prodotto in chili, e prodotto in grammi.
-- =====================================================================

do $verifica$
declare
  v_ente     uuid;
  v_ric      uuid;
  v_kg       uuid;
  v_riga     uuid;
  v_motivo   text;
  v_passato  boolean;
  v_lapidi   integer;
  v_lapidi2  integer;
  v_n        integer;
  v_vecchio  integer;
  v_nuovo    integer;
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_ente from entities order by created_at limit 1;
  if v_ente is null then raise exception 'Nessuna societa'': non posso verificare.'; end if;

  -- ===================================================================
  -- 1. LA 006 E' ATTERRATA TUTTA
  -- ===================================================================
  -- ⚠️ Il difetto che si vuole escludere e' preciso: **una colonna
  -- rinominata e una funzione che nomina ancora quella di prima**. Non
  -- da' nessun errore finche' qualcuno non chiama quella funzione, e
  -- allora fallisce in faccia a chi sta lavorando.
  if not exists (
    select 1 from information_schema.columns
     where table_name = 'ingredients' and column_name = 'temperatura_attesa'
  ) then
    raise exception 'La colonna temperatura_attesa non c''e'': la 006 non e'' atterrata.';
  end if;

  -- Le funzioni che nominano il nome VECCHIO, escluso il parametro.
  -- ⚠️ `p_haccp_receiving_temp` resta com'e' PER SCELTA della 006:
  -- rinominarlo romperebbe le chiamate per nome che il corridoio fa dal
  -- browser. Quindi si cerca il nome vecchio **non preceduto da `p_`** —
  -- ed e' la stessa distinzione che faceva lei.
  select count(*) into v_vecchio
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and pg_get_functiondef(p.oid) ~ '(?<!p_)haccp_receiving_temp';
  if v_vecchio <> 0 then
    raise exception '% funzioni nominano ancora la colonna vecchia: chiamarle fallirebbe.', v_vecchio;
  end if;

  select count(*) into v_nuovo
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and pg_get_functiondef(p.oid) like '%temperatura_attesa%';
  if v_nuovo = 0 then
    raise exception 'Nessuna funzione nomina la colonna nuova: la 006 non ha riscritto niente.';
  end if;
  raise notice 'La 006 e'' atterrata tutta: % funzioni col nome nuovo, 0 col vecchio.', v_nuovo;

  -- ===================================================================
  -- 2. LA VERIFICA DELLA 012, RIFATTA CON ROBA PROPRIA
  -- ===================================================================
  insert into recipes (name, category, recipe_type, portions_yield)
  values ('ZZ verifica grammo', 'secondo', 'piatto_finito', 1)
  returning id into v_ric;

  insert into ingredients (entity_id, name, category, unit, current_price)
  values (v_ente, 'ZZ verifica in chili', 'spezie_aromi', 'kg', 12.5000)
  returning id into v_kg;

  -- ===== 2a. Una quantita' che il campo NON sa conservare viene respinta,
  -- =====     e il rifiuto propone la via d'uscita giusta per i CHILI:
  -- =====     passare ai grammi.
  v_motivo := null;
  v_passato := false;
  begin
    insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
    values (v_ric, v_kg, 0.00003, 'kg')
    returning id into v_riga;
    v_passato := true;
  exception when sqlstate 'P0001' then
    v_motivo := sqlerrm;
  end;

  if v_passato then
    delete from recipe_ingredients where id = v_riga;
    raise exception 'Una quantita'' che il campo non sa conservare e'' stata scritta lo stesso.';
  end if;
  if v_motivo is null then
    raise exception 'Su un prodotto in chili la soglia non viene fatta rispettare.';
  end if;
  if v_motivo not like '%in grammi%' then
    raise exception 'A un prodotto in chili non viene proposta l''unita'' piu'' piccola: %', v_motivo;
  end if;

  -- ===== 2b. E il rifiuto NON e' «tutto cio' che e' piccolo»: una
  -- =====     quantita' che il campo conserva deve passare.
  -- ⚠️ Senza questa, la prova sarebbe contenta anche di un controllo che
  -- rifiuta sempre — che e' un modo di rompere il gestionale, non di
  -- proteggerlo.
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_ric, v_kg, 0.0371, 'kg')
  returning id into v_riga;
  select count(*) into v_n from recipe_ingredients where id = v_riga and quantity = 0.0371;
  if v_n <> 1 then
    raise exception 'Una quantita'' che il campo conserva e'' stata cambiata o rifiutata.';
  end if;
  delete from recipe_ingredients where id = v_riga;

  -- ===== pulizia: solo roba creata qui dentro, riconosciuta per
  -- ===== identificativo (regola del 23/08 sulle pulizie).
  delete from recipe_ingredients where recipe_id = v_ric;
  delete from recipes where id = v_ric;
  delete from ingredients where id = v_kg;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'La verifica della 012 e'' passata: la quantita'' che sparirebbe viene respinta, quella che regge no.';
end $verifica$;


-- ---------------------------------------------------------------------
-- E ADESSO la 012 puo' risultare applicata
-- ---------------------------------------------------------------------
-- ⚠️ SI REGISTRA SOLO DOPO che la verifica qui sopra e' passata: se si
-- fosse fermata, questa riga non verrebbe mai eseguita. E' la stessa
-- disciplina di ogni altra migrazione — la registrazione e' l'ultima
-- istruzione, non la prima.
--
-- ⚠️ E il nome e' quello vero del file di ieri, non uno nuovo: chi legge
-- il registro deve ritrovare la migrazione che ha davvero fatto quel
-- lavoro.
--
-- ⚠️ Su un database dove la 012 si era registrata da se' (il progetto di
-- prova) questa riga non fa niente, ed e' giusto cosi'.
insert into applied_migrations (version, name)
values ('20260823000012', 'il_grammo_fra_le_unita') on conflict (version) do nothing;

do $conferma$
declare v_n integer;
begin
  select count(*) into v_n from applied_migrations where version = '20260823000012';
  if v_n <> 1 then
    raise exception 'La 012 non risulta registrata nemmeno adesso.';
  end if;
  raise notice 'La 012 risulta applicata: il registro e'' allineato a quello che c''e'' nel database.';
end $conferma$;

insert into applied_migrations (version, name)
values ('20260823000023', 'la_verifica_che_mancava') on conflict (version) do nothing;
