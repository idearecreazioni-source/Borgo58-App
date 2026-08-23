-- =====================================================================
-- LA TEMPERATURA ATTESA NON E' LA TEMPERATURA MISURATA
-- 23/08/2026
-- =====================================================================
-- Blocco 3 del mandato del 23/08. Reperto di Alessio:
--
--   *«Come fa a sapere a che temperatura sono gli ingredienti che
--    arrivano? Dovrebbe sapere a che temperatura DOVREBBERO essere, non
--    quella effettiva che puo' solo essere misurata a mano.»*
--
-- Ha ragione, e sotto lo stesso nome ci sono due dati di natura diversa:
--
--   · LA TEMPERATURA ATTESA e' una **norma** (0-4 °C per il pesce fresco).
--     Sta sulla scheda del prodotto, l'assistente la compila, Alessio la
--     corregge. Non descrive nessun fatto avvenuto.
--   · LA TEMPERATURA MISURATA si legge **con la sonda**, al ricevimento,
--     ogni volta, e finisce nel registro HACCP.
--
-- 🔴 E IL REGISTRO HACCP ATTESTA MISURAZIONI: se li' dentro finisse un
-- numero indovinato da una macchina, quel registro direbbe il falso — e in
-- un'ispezione risponde chi l'ha firmato, cioe' Alessio.
--
-- ---------------------------------------------------------------------
-- ✅ LA MISURA PRIMA DELLA CURA: il rischio NON si e' realizzato
-- ---------------------------------------------------------------------
-- Chiesto al codice vivo dove finisce oggi quel campo. Le funzioni che lo
-- nominano sono quattro — `create_ingredient`, `prodotti_da_compilare`,
-- `applica_scheda_prodotto`, `tocca_campo_confermato` — e **nessuna scrive
-- in `haccp_goods_receiving`**. Il registro prende la temperatura da un
-- parametro che compila una **persona**: il campo «Temp. °C» della
-- conferma del carico, e quello del registro a mano. Nessuno dei due e'
-- precompilato.
--
-- ⚠️ Quindi non c'era niente da scollegare. Il difetto era **nel nome e
-- nel posto**: un campo chiamato «Temperatura ricevimento (HACCP)»,
-- compilato dall'assistente, che *sembra* un dato del registro. E la
-- distanza fra «sembra» e «e'» la copre chiunque legga in fretta.
--
-- ⚠️ E si e' misurato anche quanto costa cambiarlo adesso: **0 prodotti su
-- 127 hanno quel campo compilato**. Oggi e' un rinomino; fra sei mesi
-- sarebbe lo stesso rinomino piu' un dubbio su ogni riga gia' scritta.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Il nome
-- ---------------------------------------------------------------------
do $rinomina$
begin
  if exists (
    select 1 from information_schema.columns
     where table_name = 'ingredients' and column_name = 'haccp_receiving_temp'
  ) then
    alter table ingredients rename column haccp_receiving_temp to temperatura_attesa;
    raise notice 'Colonna rinominata: haccp_receiving_temp -> temperatura_attesa';
  else
    raise notice 'Gia'' rinominata.';
  end if;
end $rinomina$;

comment on column ingredients.temperatura_attesa is
  'A che temperatura DOVREBBE arrivare questo prodotto: una norma (es. «0-4 °C» per il pesce fresco), non una misurazione. La compila l''assistente e la corregge Alessio. ⚠️ NON e'' e non deve diventare il numero che finisce nel registro HACCP di ricevimento: quello si legge con la sonda, ogni volta, e lo scrive una persona. Un registro che attesta misurazioni mai fatte dice il falso, e a un''ispezione risponde chi l''ha firmato.';


-- ---------------------------------------------------------------------
-- 2. Le quattro funzioni che la nominano
-- ---------------------------------------------------------------------
-- ⚠️ `alter table … rename column` NON tocca il corpo delle funzioni: si
-- riscrivono, e si riscrivono partendo da quello VIVO — mai a memoria.
-- E' la trappola in cui questo progetto e' cascato il 18/08 e di nuovo
-- stamattina, perdendo un portiere.
do $riscrivi$
declare
  v_nome text;
  v_def  text;
  v_fatte integer := 0;
begin
  for v_nome, v_def in
    select p.proname, pg_get_functiondef(p.oid)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and pg_get_functiondef(p.oid) like '%haccp_receiving_temp%'
  loop
    -- Il PARAMETRO delle funzioni resta com'e' (`p_haccp_receiving_temp`):
    -- rinominarlo romperebbe le chiamate per nome che il corridoio fa dal
    -- client. Cambia solo il nome della COLONNA.
    v_def := regexp_replace(v_def, '(?<!p_)haccp_receiving_temp', 'temperatura_attesa', 'g');
    execute v_def;
    v_fatte := v_fatte + 1;
  end loop;
  raise notice 'Funzioni riscritte col nome nuovo: %', v_fatte;
end $riscrivi$;


-- ---------------------------------------------------------------------
-- 3. Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_n        integer;
  v_ente     uuid;
  v_ing      uuid;
  v_tit      uuid;
  v_temp     text;
  v_lapidi   integer;
  v_lapidi_2 integer;
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_ente from entities order by created_at limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;

  -- 1. Il nome vecchio non esiste piu' da nessuna parte.
  select count(*) into v_n from information_schema.columns
   where table_name = 'ingredients' and column_name = 'haccp_receiving_temp';
  if v_n <> 0 then
    raise exception 'La colonna vecchia c''e'' ancora.';
  end if;

  select count(*) into v_n
    from pg_proc p join pg_namespace nn on nn.oid = p.pronamespace
   where nn.nspname = 'public'
     and pg_get_functiondef(p.oid) ~ '(?<!p_)haccp_receiving_temp';
  if v_n <> 0 then
    raise exception '% funzioni nominano ancora la colonna vecchia: si romperebbero alla prima chiamata.', v_n;
  end if;

  -- 2. 🔴 IL CONTROLLO CHE VALE PIU' DI TUTTI: nessuna funzione che scrive
  --    nel registro HACCP legge la temperatura attesa. Non e' un sospetto
  --    da rileggere ogni volta: e' una domanda al catalogo.
  select count(*) into v_n
    from pg_proc p join pg_namespace nn on nn.oid = p.pronamespace
   where nn.nspname = 'public'
     and pg_get_functiondef(p.oid) like '%haccp_goods_receiving%'
     and pg_get_functiondef(p.oid) like '%temperatura_attesa%';
  if v_n <> 0 then
    raise exception 'Ci sono % funzioni che scrivono nel registro HACCP e leggono la temperatura attesa: il registro attesterebbe una misurazione mai fatta.', v_n;
  end if;

  -- 3. Il giro dell'assistente continua a funzionare col nome nuovo.
  insert into ingredients (name, unit, category, entity_id, alimentare)
  values ('ZZ temperatura', 'kg', 'pesce', v_ente, true) returning id into v_ing;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  perform applica_scheda_prodotto(v_ing, jsonb_build_object('temperatura', '0-4 °C'));

  select temperatura_attesa into v_temp from ingredients where id = v_ing;
  if v_temp is distinct from '0-4 °C' then
    raise exception 'L''assistente non riesce piu'' a scrivere la temperatura attesa: %.', v_temp;
  end if;

  -- 4. E il prodotto non compare piu' fra quelli a cui manca.
  if exists (select 1 from prodotti_da_compilare() p
              where p.id = v_ing and 'temperatura' = any (p.mancano)) then
    raise exception 'Il prodotto risulta ancora senza temperatura attesa.';
  end if;

  perform set_config('request.jwt.claims', null, true);

  delete from ingredients where id = v_ing;
  select count(*) into v_lapidi_2 from deleted_records;
  if v_lapidi_2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi.', v_lapidi_2 - v_lapidi;
  end if;

  raise notice 'Verifica passata: il nome e'' spaccato, le funzioni seguono, e nessuna scrittura nel registro HACCP legge la temperatura attesa.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260823000006', 'la_temperatura_attesa_e_quella_misurata') on conflict (version) do nothing;
