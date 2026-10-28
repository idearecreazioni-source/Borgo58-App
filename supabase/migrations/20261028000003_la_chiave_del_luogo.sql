-- =====================================================================
-- LA CHIAVE DEL LUOGO — 28/10/2026, con i promemoria per luogo
-- (20261028000001).
-- =====================================================================
--
-- 🔴 COME ARRIVA IL PROMEMORIA. Il gestionale e' un sito, e un sito chiuso
--    non sa dove si trova il telefono. Lo sa l'iPhone: un'automazione
--    dell'app Comandi «quando arrivo a Casa» chiama la funzione online
--    `promemoria-luogo`, che chiede qui (`luogo_promemoria`) gli impegni
--    aperti di quel posto e li mostra in una notifica.
--
-- 🔴 UNA CHIAVE SUA, NON QUELLA DELLA VOCE. `chiavi_voce` apre le
--    dettature, che scrivono nel gestionale e spendono sull'account
--    dell'assistente. Questa sta dentro un'automazione del telefono e
--    serve solo a LEGGERE i titoli degli impegni di un luogo: poteri
--    diversi, chiavi diverse. Se si perde il telefono se ne revoca una
--    senza toccare l'altra.
--
-- ⚠️ STESSA FORMA DI `chiavi_voce` (20260826000001): la chiave in chiaro
--    si vede una volta sola quando nasce, il database ne tiene solo
--    l'impronta sha256, si revoca dal gestionale. Tutto riservato al
--    titolare.
--
-- ⚠️ IL FRENO (Contratto §4, ogni funzione aperta ad `anon` ne ha uno):
--    30 letture all'ora per chiave, poi si ferma e lo dice. L'arrivo a casa
--    scatta poche volte al giorno; trenta in un'ora vogliono dire che la
--    chiave la sta usando qualcun altro, e `usi` lo fa vedere.
--    ⚠️ Scoperto, dichiarato come per la voce: nessun freno sui tentativi
--    FALLITI di indovinare una chiave (24 byte casuali). Un freno globale
--    sui fallimenti permetterebbe a un estraneo di spegnere i promemoria di
--    Alessio sbagliando apposta: e' il prezzo che oggi si sceglie di non
--    pagare.

-- ---------------------------------------------------------------------
-- 1. La tabella delle chiavi
-- ---------------------------------------------------------------------
create table if not exists chiavi_luogo (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  impronta      text not null unique,
  utente_id     uuid not null references auth.users(id) on delete cascade,
  creata_il     timestamptz not null default now(),
  revocata_il   timestamptz,
  ultimo_uso    timestamptz,
  usi           integer not null default 0,
  finestra_da   timestamptz,
  finestra_usi  integer not null default 0
);

comment on table chiavi_luogo is
  'Le chiavi con cui un''automazione dell''iPhone («quando arrivo a Casa») legge i promemoria di un luogo. La chiave in chiaro NON e'' conservata: c''e'' solo la sua impronta, e la chiave si vede una volta sola quando nasce. Serve solo a leggere: non scrive e non usa la voce.';
comment on column chiavi_luogo.impronta is
  'L''impronta della chiave (sha256). Da un''impronta non si risale alla chiave.';
comment on column chiavi_luogo.usi is
  'Quante volte il telefono ha chiesto i promemoria con questa chiave. Se cresce quando Alessio non si muove, qualcun altro ce l''ha.';
comment on column chiavi_luogo.finestra_da is
  'Inizio dell''ora in cui si contano le letture per il freno (30 all''ora).';

comment on constraint chiavi_luogo_impronta_key on chiavi_luogo is
  'Due chiavi non possono avere la stessa impronta: se succedesse, una chiave aprirebbe anche l''altra.';

create index if not exists idx_chiavi_luogo_attive on chiavi_luogo (impronta) where revocata_il is null;

alter table chiavi_luogo enable row level security;
drop policy if exists chiavi_luogo_titolare on chiavi_luogo;
create policy chiavi_luogo_titolare on chiavi_luogo
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

revoke all on table chiavi_luogo from anon;

-- ---------------------------------------------------------------------
-- 2. Creare, elencare, revocare (solo il titolare)
-- ---------------------------------------------------------------------
create or replace function public.crea_chiave_luogo(p_nome text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_chiave text;
  v_id     uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' creare una chiave.';
  end if;
  if nullif(btrim(coalesce(p_nome, '')), '') is null then
    raise exception 'Dai un nome a questa chiave: serve a sapere quale togliere se un giorno perdi il telefono.';
  end if;

  -- 🔴 La chiave si vede una volta sola: da qui il database ne tiene la
  --    sola impronta. `extensions.` per esteso: pgcrypto vive li', e
  --    `search_path` e' `public` (stessa trappola di `crea_chiave_voce`).
  v_chiave := replace(replace(encode(extensions.gen_random_bytes(24), 'base64'), '/', '_'), '+', '-');

  insert into chiavi_luogo (nome, impronta, utente_id)
  values (btrim(p_nome), encode(extensions.digest(v_chiave, 'sha256'), 'hex'), auth.uid())
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'nome', btrim(p_nome), 'chiave', v_chiave);
end $function$;

create or replace function public.revoca_chiave_luogo(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_nome text;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' revocare una chiave.';
  end if;
  update chiavi_luogo set revocata_il = now()
   where id = p_id and revocata_il is null
   returning nome into v_nome;
  if v_nome is null then
    raise exception 'Questa chiave non c''e'', oppure era gia'' stata tolta.';
  end if;
  return jsonb_build_object('nome', v_nome);
end $function$;

create or replace function public.chiavi_luogo_elenco()
returns table(id uuid, nome text, creata_il timestamptz, ultimo_uso timestamptz,
              usi integer, revocata_il timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not is_titolare() then
    raise exception 'Le chiavi sono riservate al titolare.';
  end if;
  return query
  select c.id, c.nome, c.creata_il, c.ultimo_uso, c.usi, c.revocata_il
    from chiavi_luogo c order by c.revocata_il nulls first, c.creata_il desc;
end $function$;

revoke all on function public.crea_chiave_luogo(text) from public, anon, authenticated;
revoke all on function public.revoca_chiave_luogo(uuid) from public, anon, authenticated;
revoke all on function public.chiavi_luogo_elenco() from public, anon, authenticated;
grant execute on function public.crea_chiave_luogo(text) to authenticated;
grant execute on function public.revoca_chiave_luogo(uuid) to authenticated;
grant execute on function public.chiavi_luogo_elenco() to authenticated;

-- ---------------------------------------------------------------------
-- 3. Cosa c'e' da fare in questo posto (la legge il telefono)
-- ---------------------------------------------------------------------
-- ⚠️ APERTA AD `anon` PER FORZA, come `voce_apri_sessione`: un'automazione
--    dell'iPhone non ha un accesso al gestionale. Il portiere e' la chiave.
-- ⚠️ SECURITY DEFINER SCAVALCA LA RLS: i filtri (luogo, aperti) sono scritti
--    qui a mano, e la chiave deve appartenere al titolare.
-- ⚠️ Nessuna data nel filtro, deciso da Alessio: un promemoria per luogo e'
--    una cosa chiesta sul momento («quando arrivo a casa ricordami di…»),
--    e va ricordata ogni volta che si arriva finche' non si spunta.
create or replace function public.luogo_promemoria(p_chiave text, p_luogo text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_riga   chiavi_luogo%rowtype;
  v_luogo  text := lower(btrim(coalesce(p_luogo, '')));
  v_elenco jsonb;
  v_quanti integer;
begin
  if nullif(btrim(coalesce(p_chiave, '')), '') is null then
    raise exception 'Manca la chiave.';
  end if;

  -- rete-guardie: luogo_promemoria — il rifiuto del luogo sconosciuto non ripete piu' il testo ricevuto e viene prima della chiave
  -- ⚠️ Il luogo si guarda PRIMA della chiave (revisione di sicurezza,
  --    28/10): dopo, la differenza fra i due rifiuti direbbe a chi prova se
  --    la chiave che ha in mano vale. E il testo ricevuto non si ripete.
  if v_luogo not in ('casa', 'ristorante') then
    raise exception 'Questo luogo non lo conosco: i luoghi sono casa e ristorante.';
  end if;

  select * into v_riga from chiavi_luogo
   where impronta = encode(extensions.digest(p_chiave, 'sha256'), 'hex') and revocata_il is null
   for update;
  if not found then
    -- Non si dice se non esiste o se e' stata revocata: lo vorrebbe
    -- sapere solo chi la sta indovinando.
    raise exception 'Questa chiave non vale.';
  end if;

  -- Il freno: 30 letture all'ora per chiave.
  if v_riga.finestra_da is null or v_riga.finestra_da < now() - interval '1 hour' then
    update chiavi_luogo set finestra_da = now(), finestra_usi = 1,
                            ultimo_uso = now(), usi = usi + 1
     where id = v_riga.id;
  elsif v_riga.finestra_usi >= 30 then
    raise exception 'Troppe richieste con questa chiave nell''ultima ora: riprovo piu'' tardi.';
  else
    update chiavi_luogo set finestra_usi = finestra_usi + 1,
                            ultimo_uso = now(), usi = usi + 1
     where id = v_riga.id;
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_riga.utente_id, 'role', 'authenticated')::text, true);
  if not is_titolare() then
    raise exception 'La chiave appartiene a un accesso che non e'' il titolare.';
  end if;

  select count(*) into v_quanti
    from tasks where luogo = v_luogo and status <> 'completato';

  select coalesce(jsonb_agg(jsonb_build_object('titolo', x.title) order by x.ordine), '[]'::jsonb)
    into v_elenco
    from (select t.title,
                 row_number() over (order by t.preferito desc, t.created_at asc) as ordine
            from tasks t
           where t.luogo = v_luogo and t.status <> 'completato'
           order by t.preferito desc, t.created_at asc
           limit 20) x;

  return jsonb_build_object('luogo', v_luogo, 'quanti', v_quanti, 'impegni', v_elenco);
end $function$;

comment on function public.luogo_promemoria(text, text) is
  'Gli impegni aperti di un luogo (casa o ristorante), per la notifica che l''iPhone mostra all''arrivo. Si entra con una chiave di chiavi_luogo; 30 letture all''ora per chiave.';

revoke all on function public.luogo_promemoria(text, text) from public, anon, authenticated;
grant execute on function public.luogo_promemoria(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_k        jsonb;
  v_r        jsonb;
  v_fermo    boolean;
  i          integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles.';
  end if;

  -- Le porte: la lettura e' aperta ad anon, la gestione delle chiavi no.
  if not has_function_privilege('anon', 'luogo_promemoria(text, text)', 'execute')
     or has_function_privilege('anon', 'crea_chiave_luogo(text)', 'execute')
     or has_function_privilege('anon', 'revoca_chiave_luogo(uuid)', 'execute')
     or has_function_privilege('anon', 'chiavi_luogo_elenco()', 'execute')
     or has_table_privilege('anon', 'chiavi_luogo', 'select') then
    raise exception 'VERIFICA: i permessi delle chiavi del luogo non sono quelli dichiarati.';
  end if;

  begin
    -- (1) Lo staff non crea chiavi.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_fermo := false;
    begin
      perform crea_chiave_luogo('PROVA staff');
    exception when others then v_fermo := true;
    end;
    if not v_fermo then
      raise exception 'VERIFICA (1): lo staff ha creato una chiave.';
    end if;

    -- (2) Il titolare la crea, e il database ne tiene solo l'impronta.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    v_k := crea_chiave_luogo('PROVA telefono');
    if exists (select 1 from chiavi_luogo where impronta = v_k->>'chiave') then
      raise exception 'VERIFICA (2): la chiave e'' conservata in chiaro.';
    end if;

    insert into tasks (title, priority, status, category, visibile_staff, luogo)
    values ('PROVA pesare la mamma', 'media', 'da_fare', 'altro', false, 'casa'),
           ('PROVA al ristorante', 'media', 'da_fare', 'altro', true, 'ristorante'),
           ('PROVA gia fatto a casa', 'media', 'completato', 'altro', true, 'casa'),
           ('PROVA senza luogo', 'media', 'da_fare', 'altro', true, null);

    -- (3) Con la chiave giusta, a casa: solo gli aperti di casa — anche
    --     quello riservato al titolare, perche' la chiave e' sua.
    perform set_config('request.jwt.claims', null, true);
    v_r := luogo_promemoria(v_k->>'chiave', 'Casa');
    if not (v_r->'impegni' @> '[{"titolo": "PROVA pesare la mamma"}]'::jsonb)
       or v_r::text like '%PROVA al ristorante%'
       or v_r::text like '%PROVA gia fatto a casa%'
       or v_r::text like '%PROVA senza luogo%' then
      raise exception 'VERIFICA (3): a casa ho letto %.', v_r;
    end if;

    -- (4) Chiave sbagliata, luogo sconosciuto: rifiutati.
    v_fermo := false;
    begin
      perform luogo_promemoria('non-e-una-chiave', 'casa');
    exception when others then v_fermo := sqlerrm = 'Questa chiave non vale.';
    end;
    if not v_fermo then
      raise exception 'VERIFICA (4a): una chiave sbagliata non e'' stata respinta come tale.';
    end if;
    v_fermo := false;
    begin
      perform luogo_promemoria(v_k->>'chiave', 'garage');
    exception when others then v_fermo := sqlerrm like 'Questo luogo non lo conosco%';
    end;
    if not v_fermo then
      raise exception 'VERIFICA (4b): un luogo sconosciuto non e'' stato respinto.';
    end if;

    -- (5) Il freno: alla trentunesima lettura nell'ora si ferma.
    for i in 1..29 loop
      perform luogo_promemoria(v_k->>'chiave', 'casa');
    end loop;
    v_fermo := false;
    begin
      perform luogo_promemoria(v_k->>'chiave', 'casa');
    exception when others then v_fermo := sqlerrm like 'Troppe richieste%';
    end;
    if not v_fermo then
      raise exception 'VERIFICA (5): il freno delle 30 letture non ha fermato la trentunesima.';
    end if;

    -- (6) Revocata, non vale piu'.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    perform revoca_chiave_luogo((v_k->>'id')::uuid);
    perform set_config('request.jwt.claims', null, true);
    v_fermo := false;
    begin
      perform luogo_promemoria(v_k->>'chiave', 'casa');
    exception when others then v_fermo := sqlerrm = 'Questa chiave non vale.';
    end;
    if not v_fermo then
      raise exception 'VERIFICA (6): una chiave revocata vale ancora.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della chiave del luogo');

  raise notice 'Fatto: la chiave del luogo la crea solo il titolare e se ne tiene l''impronta; con la chiave si leggono solo gli aperti di quel luogo; chiave sbagliata, luogo sconosciuto, trentunesima lettura e chiave revocata sono respinti. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261028000003', 'la_chiave_del_luogo')
on conflict (version) do nothing;
