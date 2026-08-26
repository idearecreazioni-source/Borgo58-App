-- ============================================================================
-- IL GUARDIANO GUARDA LE RIGHE, NON LE LAPIDI — 26/08/2026
-- ============================================================================
--
-- 🔴 LA STORIA, in tre righe. Stamattina una verifica ha lasciato una riga
--    di prova nel gestionale vero: si era segnata l'identificativo in una
--    **variabile riusata**, ha cancellato due volte l'ultima e ha mancato
--    la prima. Il controllo finale non se n'e' accorto perche' contava le
--    **lapidi** (`deleted_records`), e `dettature` non e' una tabella
--    tracciata: zero lapidi prima, zero dopo, e una riga rimasta in mezzo
--    ai dati veri.
--
--    La lezione e' gia' scritta nel file delle trappole. Ma **una lezione
--    scritta non e' un guardiano riparato**, e questa migrazione ripara il
--    guardiano.
--
-- ----------------------------------------------------------------------------
-- 🔴 QUANTO E' GRANDE IL BUCO — misurato sul gestionale vero, non stimato
-- ----------------------------------------------------------------------------
-- Le tabelle di `public` sono **119**. Quelle che finiscono nel registro
-- delle cancellazioni — cioe' quelle con il trigger `trg_log_delete` — sono
-- **21**. Le altre **98 non ci finiscono**, e su quelle un controllo che
-- conta le lapidi non puo' dire assolutamente niente: risponde «zero» che
-- ci sia un residuo o che non ci sia.
--
-- ⚠️ E le 21 non sono un elenco sbagliato: sono le tabelle di soldi, fisco,
--    lavoro e documenti, scelte apposta l'08/08. Il difetto non e' che il
--    registro sia corto — e' che **un controllo dei residui si appoggiava a
--    un registro fatto per un'altra domanda**. Il registro risponde a «cosa
--    e' stato cancellato dai dati che contano»; una verifica deve sapere
--    «e' rimasto in giro qualcosa di mio», che e' un'altra cosa.
--
-- ----------------------------------------------------------------------------
-- COME FUNZIONA — una fotografia, non un registro
-- ----------------------------------------------------------------------------
--     v_foto := foto_righe();                    -- all'inizio
--     ... la verifica fa il suo lavoro e ripulisce ...
--     perform pretendi_nessun_residuo(v_foto, 'nome della verifica');
--
-- Il guardiano confronta le righe di **tutte** le tabelle prima e dopo, e
-- se qualcuna non torna le **nomina tutte insieme** — dirne una per volta
-- fa scoprire la seconda dopo aver risolto la prima, e alla terza si smette
-- di leggere.
--
-- ----------------------------------------------------------------------------
-- ⚠️ IL LIMITE, DICHIARATO PERCHE' CONTA PIU' DELLA CURA
-- ----------------------------------------------------------------------------
-- Conta le RIGHE, quindi NON vede due cose:
--   · una riga creata e una cancellata nella stessa tabella si compensano;
--   · una riga **modificata** e lasciata modificata non cambia nessun conto
--     — ed e' successo davvero il 14/08, con due tavoli rimasti spostati in
--     mezzo ai divani e la verifica che dichiarava zero residui.
-- Per il secondo caso la regola resta quella: si salva la **riga intera**
-- prima e la si riscrive intera dopo. Questo guardiano non la sostituisce,
-- e non finge di farlo.
--
-- ----------------------------------------------------------------------------
-- COSA ABBIAMO ROVESCIATO
-- ----------------------------------------------------------------------------
-- Si rovescia una pratica, non una decisione di Alessio: «una verifica
-- dimostra di essersi ripulita contando le lapidi prima e dopo» (16/08).
-- ⚠️ **La ragione di allora vale ancora ed e' intatta**: sulle 21 tabelle
-- tracciate quel controllo dice una cosa vera e in piu' — dice che la
-- verifica non ha cancellato per sbaglio un dato vero. Non si toglie: si
-- affianca. Quello che cambia e' che **non e' piu' l'unico**, perche' sulle
-- altre 98 tabelle non poteva dire niente e sembrava dire «tutto a posto».
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Quali tabelle finiscono nel registro, e quali no — dal CATALOGO
-- ----------------------------------------------------------------------------
-- ⚠️ L'elenco non e' scritto a mano da nessuna parte: se domani si aggiunge
--    una tabella al registro, questa risposta cambia da sola. Un elenco
--    scritto a mano sarebbe scaduto il giorno dopo — e' quello che e'
--    successo alla verifica dei vincoli muti.
create or replace function tabelle_non_tracciate()
returns table(tabella text)
language sql
stable security definer
set search_path to 'public'
as $funzione$
  select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and not exists (
       select 1 from pg_trigger t
        where t.tgrelid = c.oid and not t.tgisinternal
          and pg_get_triggerdef(t.oid) ilike '%log_deleted_record%')
   order by 1;
$funzione$;

comment on function tabelle_non_tracciate() is
  'Le tabelle di public che NON finiscono nel registro delle cancellazioni. Su queste, contare le lapidi prima e dopo non dice niente: risponde zero comunque. Misurato il 26/08/2026: 98 su 119.';

revoke all on function tabelle_non_tracciate() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. La fotografia
-- ----------------------------------------------------------------------------
create or replace function foto_righe()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $funzione$
declare
  r     record;
  v_n   bigint;
  v_out jsonb := '{}'::jsonb;
begin
  for r in
    select c.relname as t
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
     order by 1
  loop
    execute format('select count(*) from public.%I', r.t) into v_n;
    v_out := v_out || jsonb_build_object(r.t, v_n);
  end loop;
  return v_out;
end $funzione$;

comment on function foto_righe() is
  'Quante righe ha ogni tabella di public, adesso. Si chiama all''inizio di una verifica e si ridà a `pretendi_nessun_residuo` alla fine. ⚠️ Conta le righe: non vede una riga creata e una cancellata che si compensano, ne'' una riga MODIFICATA e lasciata modificata.';

revoke all on function foto_righe() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Il confronto, e il rifiuto che nomina tutto
-- ----------------------------------------------------------------------------
create or replace function residui_rispetto_a(p_foto jsonb)
returns table(tabella text, prima bigint, adesso bigint, differenza bigint)
language plpgsql
stable security definer
set search_path to 'public'
as $funzione$
declare
  v_ora jsonb := foto_righe();
  k     text;
begin
  -- ⚠️ Si cammina sull'unione delle due fotografie: una tabella NATA nel
  --    frattempo non c'e' nella prima, e una tabella sparita non c'e'
  --    nella seconda. Guardando una sola delle due, uno dei due casi
  --    passerebbe in silenzio.
  for k in
    select x from jsonb_object_keys(p_foto) x
    union
    select x from jsonb_object_keys(v_ora) x
  loop
    if coalesce((p_foto->>k)::bigint, -1) is distinct from coalesce((v_ora->>k)::bigint, -1) then
      tabella     := k;
      prima       := (p_foto->>k)::bigint;
      adesso      := (v_ora->>k)::bigint;
      differenza  := coalesce(adesso, 0) - coalesce(prima, 0);
      return next;
    end if;
  end loop;
end $funzione$;

comment on function residui_rispetto_a(jsonb) is
  'Quali tabelle hanno un numero di righe diverso da quello della fotografia. Vale su TUTTE le tabelle, tracciate e non: e'' la differenza con il controllo che contava le lapidi, che sulle 98 non tracciate rispondeva zero comunque.';

revoke all on function residui_rispetto_a(jsonb) from public, anon, authenticated;

create or replace function pretendi_nessun_residuo(p_foto jsonb, p_dove text default 'questa verifica')
returns void
language plpgsql
stable security definer
set search_path to 'public'
as $funzione$
declare
  v_righe text := '';
  r       record;
  v_n     integer := 0;
begin
  -- 🔴 Le nomina TUTTE insieme: dirne una per volta fa scoprire la seconda
  --    dopo aver risolto la prima, e alla terza si smette di leggere.
  for r in select * from residui_rispetto_a(p_foto) loop
    v_n := v_n + 1;
    v_righe := v_righe || format('%s%s: erano %s, sono %s (%s%s)',
      case when v_n > 1 then ' · ' else '' end,
      r.tabella, coalesce(r.prima::text, '(non c''era)'), coalesce(r.adesso::text, '(non c''e'' piu'')'),
      case when r.differenza > 0 then '+' else '' end, r.differenza);
  end loop;

  if v_n > 0 then
    raise exception '% ha lasciato % tabelle diverse da come le ha trovate — %', p_dove, v_n, v_righe;
  end if;
end $funzione$;

comment on function pretendi_nessun_residuo(jsonb, text) is
  'Si ferma se qualcosa e'' rimasto in giro rispetto alla fotografia di partenza, nominando TUTTE le tabelle che non tornano. Non dipende dal registro delle cancellazioni: e'' il guardiano che stamattina, guardando le lapidi, non ha visto una riga di prova rimasta in produzione.';

revoke all on function pretendi_nessun_residuo(jsonb, text) from public, anon, authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- 🔴 UN MISURATORE NUOVO SI PROVA PRIMA SU UN CASO DI CUI SI CONOSCE GIA'
--    LA RISPOSTA. Un guardiano che risponde «zero» al primo colpo non ha
--    ancora detto niente: quindi qui si costruisce APPOSTA un residuo, in
--    una tabella che nel registro non c'e', e ci si fa dire che c'e'.
do $verifica$
declare
  v_tit     uuid;
  v_foto    jsonb;
  v_lapidi  integer;
  v_dett    uuid[] := '{}';
  v_d       uuid;
  v_n       integer;
  v_visto   boolean;
  v_msg     text;
  v_non_tr  integer;
  v_tot     integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Non c''e'' nessun titolare: questa verifica non puo'' girare.';
  end if;

  select count(*) into v_non_tr from tabelle_non_tracciate();
  select count(*) into v_tot from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r';
  raise notice 'tabelle di public: %, non tracciate: %', v_tot, v_non_tr;

  -- ⚠️ La prova ha senso solo se `dettature` e' davvero fuori dal registro:
  --    se un giorno ce la mettessero dentro, questa verifica proverebbe
  --    un'altra cosa senza dirlo.
  if not exists (select 1 from tabelle_non_tracciate() where tabella = 'dettature') then
    raise exception '`dettature` risulta tracciata: questa verifica sceglierebbe il caso sbagliato.';
  end if;

  -- ------------------------------------------------------------------
  -- (A) IL CASO DI CUI CONOSCO GIA' LA RISPOSTA: un residuo costruito.
  -- ------------------------------------------------------------------
  select count(*) into v_lapidi from deleted_records;
  v_foto := foto_righe();

  insert into dettature (testo, provenienza, esito, creato_da)
  values ('residuo costruito apposta per provare il guardiano', 'app', 'capita', v_tit)
  returning id into v_d;
  v_dett := v_dett || v_d;

  select count(*) into v_n from residui_rispetto_a(v_foto);
  if v_n <> 1 then
    raise exception 'Il guardiano doveva vedere UNA tabella cambiata, e ne vede %.', v_n;
  end if;
  if not exists (select 1 from residui_rispetto_a(v_foto) where tabella = 'dettature' and differenza = 1) then
    raise exception 'Il guardiano non ha riconosciuto il residuo in dettature: %',
      (select string_agg(tabella || ' ' || differenza, ', ') from residui_rispetto_a(v_foto));
  end if;

  -- 🔴 E deve FERMARE, non solo saperlo.
  v_visto := false;
  begin
    perform pretendi_nessun_residuo(v_foto, 'la prova del guardiano');
  exception when others then
    v_visto := true;
    v_msg   := sqlerrm;
  end;
  if not v_visto then
    raise exception 'Il guardiano ha visto il residuo e non ha fermato niente.';
  end if;
  raise notice 'col residuo il guardiano dice: %', v_msg;

  -- ------------------------------------------------------------------
  -- (B) LA CONTROPROVA CHE VALE DI PIU': il guardiano VECCHIO, quello
  --     che conta le lapidi, con lo stesso residuo davanti tace.
  --     🔴 E' la dimostrazione del buco, non un ragionamento su di esso.
  -- ------------------------------------------------------------------
  if (select count(*) from deleted_records) <> v_lapidi then
    raise exception 'Le lapidi sono cambiate: questa controprova non dimostrerebbe niente.';
  end if;
  raise notice 'con lo stesso residuo davanti, le lapidi sono % prima e % dopo: il guardiano vecchio tace',
    v_lapidi, (select count(*) from deleted_records);

  -- ------------------------------------------------------------------
  -- (C) TOLTO IL RESIDUO, DEVE TACERE. Un guardiano che grida sempre
  --     viene spento.
  -- ------------------------------------------------------------------
  delete from dettature where id = any(v_dett);
  perform pretendi_nessun_residuo(v_foto, 'la prova del guardiano');
  raise notice 'tolto il residuo, il guardiano tace';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260826000010', 'il_guardiano_guarda_le_righe_non_le_lapidi') on conflict (version) do nothing;
