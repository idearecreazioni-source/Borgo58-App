-- =====================================================================
-- LE FONDAMENTA DELLA CHAT DI MEMO — 14/11/2026
-- =====================================================================
--
-- Prima di applicare: confrontare con il database vivo i corpi di
-- `consumi_ai()` e `fonti_ai_scoperte()`. Il primo parte dall'ultima
-- definizione nel repository (`20261010000003`); il secondo da
-- `20260829000003`. Qui cambia soltanto l'aggiunta della chat di MEMO.
-- `spesa_ai_del_mese()` non si riscrive: legge gia' `consumi_ai()` e
-- conserva quindi sia il suo corpo sia i permessi vivi.
--
-- La chat e' solo di Alessio. Non esiste ancora una schermata ne' una
-- funzione online: questa migrazione prepara dati, tetto e freno che le
-- PR 4-5 useranno, senza aprire una porta allo staff o ad anon.
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LO STORICO DELLA CHAT
-- ---------------------------------------------------------------------
create table if not exists memo_conversazioni (
  id                uuid primary key default gen_random_uuid(),
  aperta_da_percorso text,
  aperta_da_modulo   text,
  titolo             text,
  creata_il          timestamptz not null default now(),
  chiusa_il          timestamptz,
  creata_da          uuid default auth.uid() references auth.users(id) on delete set null
);

comment on table memo_conversazioni is
  'Le conversazioni della chat di MEMO. Conserva dove Alessio l''ha aperta per dare contesto alla domanda; la chat resta riservata al titolare.';
comment on column memo_conversazioni.aperta_da_percorso is
  'Il percorso della schermata da cui Alessio ha aperto MEMO. Vuoto se la conversazione non nasce da una schermata.';
comment on column memo_conversazioni.aperta_da_modulo is
  'Il nome leggibile del modulo da cui Alessio ha aperto MEMO. Non e'' un permesso: serve solo al contesto della conversazione.';
comment on column memo_conversazioni.chiusa_il is
  'Quando la conversazione e'' stata chiusa. Vuoto significa che puo'' continuare.';

create table if not exists memo_messaggi (
  id              uuid primary key default gen_random_uuid(),
  conversazione_id uuid not null references memo_conversazioni(id) on delete cascade,
  ruolo           text not null,
  testo           text not null,
  strumenti       jsonb not null default '[]'::jsonb,
  risultati       jsonb not null default '[]'::jsonb,
  dettatura_id    uuid references dettature(id) on delete set null,
  modello         text,
  token_ingresso  integer not null default 0,
  token_uscita    integer not null default 0,
  costo_euro      numeric(10,5) not null default 0,
  stato           text not null default 'in_corso',
  creato_il       timestamptz not null default now(),
  constraint memo_messaggio_ruolo_noto
    check (ruolo in ('alessio', 'memo', 'strumento', 'avviso')),
  constraint memo_messaggio_stato_noto
    check (stato in ('in_corso', 'fatto', 'interrotto', 'tetto', 'errore')),
  constraint memo_messaggio_testo_sensato
    check (length(btrim(testo)) between 1 and 4000),
  constraint memo_messaggio_costo_sensato
    check (costo_euro >= 0 and costo_euro <= 1),
  constraint memo_messaggio_token_sensato
    check (token_ingresso >= 0 and token_uscita >= 0)
);

comment on table memo_messaggi is
  'Le parole della chat di MEMO, il costo di ogni chiamata e soltanto i risultati ridotti degli strumenti. Non e'' un deposito dei dati letti: quelli restano nelle loro tabelle.';
comment on column memo_messaggi.strumenti is
  'Gli strumenti chiesti o usati per questo messaggio, in forma leggibile dalla chat. Parte vuoto quando nessuno strumento serve.';
comment on column memo_messaggi.risultati is
  'Risultati ridotti degli strumenti: riferimenti e numeri necessari a spiegare la risposta, mai una seconda copia estesa dei dati del gestionale.';
comment on constraint memo_messaggio_testo_sensato on memo_messaggi is
  'Un messaggio deve contenere testo vero e non supera 4.000 caratteri: oltre e'' una risposta o una richiesta da spezzare, non una riga da nascondere.';
comment on constraint memo_messaggio_costo_sensato on memo_messaggi is
  'Un messaggio della chat non puo'' costare meno di zero ne'' piu'' di 1 euro. Oltre sarebbe un giro anomalo e si ferma prima di falsare il tetto mensile.';

create table if not exists memo_riferimenti (
  conversazione_id uuid not null references memo_conversazioni(id) on delete cascade,
  rif             text not null,
  tabella         text not null,
  riga_id         uuid not null,
  primary key (conversazione_id, rif),
  constraint memo_riferimento_non_vuoto check (length(btrim(rif)) > 0)
);

comment on table memo_riferimenti is
  'I riferimenti brevi usati da MEMO dentro una conversazione. Collegano una riga del gestionale senza mostrare il suo identificativo tecnico nella chat.';
comment on column memo_riferimenti.rif is
  'Il riferimento breve e leggibile solo nel contesto della sua conversazione, per esempio una lettera o un numero.';

create index if not exists idx_memo_conversazioni_creata_da_data
  on memo_conversazioni (creata_da, creata_il desc);
create index if not exists idx_memo_messaggi_conversazione_data
  on memo_messaggi (conversazione_id, creato_il);
create index if not exists idx_memo_riferimenti_riga
  on memo_riferimenti (tabella, riga_id);

alter table memo_conversazioni enable row level security;
alter table memo_messaggi enable row level security;
alter table memo_riferimenti enable row level security;

drop policy if exists memo_conversazioni_titolare on memo_conversazioni;
create policy memo_conversazioni_titolare on memo_conversazioni
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

drop policy if exists memo_messaggi_titolare on memo_messaggi;
create policy memo_messaggi_titolare on memo_messaggi
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

drop policy if exists memo_riferimenti_titolare on memo_riferimenti;
create policy memo_riferimenti_titolare on memo_riferimenti
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ---------------------------------------------------------------------
-- 2. CHAT, VOCE E CATALOGO DELLE AZIONI
-- ---------------------------------------------------------------------
alter table dettature drop constraint if exists dettatura_provenienza_nota;
alter table dettature
  add constraint dettatura_provenienza_nota
  check (provenienza in ('app', 'scorciatoia', 'chat'));
comment on constraint dettatura_provenienza_nota on dettature is
  'Le strade da cui una dettatura puo'' arrivare sono l''app, una Scorciatoia oppure la chat di MEMO. Una strada nuova va dichiarata qui: altrimenti qualcuno scriverebbe un appunto senza una porta riconoscibile.';

alter table tipi_azione_vocale
  add column if not exists in_chat boolean not null default false;
comment on column tipi_azione_vocale.in_chat is
  'Vero quando MEMO puo'' proporre questa azione nella chat. Falso finche'' la PR 8 non avra'' costruito la proposta e il suo si'' esplicito.';

-- ---------------------------------------------------------------------
-- 3. IL CONTO UNICO COMPRENDE ANCHE LA CHAT
-- ---------------------------------------------------------------------
-- Corpo ripreso dall'ultima definizione nel repository (`20261010000003`):
-- il ramo finale aggiunge solo `memo_messaggi`. I permessi erano stati
-- chiusi dalla `20260829000004` e restano identici.
create or replace function consumi_ai()
returns table(fonte text, quando timestamptz, modello text,
              token_domanda integer, token_risposta integer,
              costo_euro numeric, costo_noto boolean)
language sql
stable
security definer
set search_path = public
as $funzione$
  select 'foto'::text, l.creato_il, l.modello, l.token_domanda, l.token_risposta,
         l.costo_euro, l.costo_euro is not null
    from letture_foto l
  union all
  select 'voce', d.creato_il, d.modello, d.token_domanda, d.token_risposta,
         d.costo_euro, d.costo_euro is not null
    from dettature d
  union all
  select 'archivio', a.creato_il, a.modello, a.token_domanda, a.token_risposta,
         case when c.modello is null then null
              else round(a.token_domanda::numeric / 1000000 * c.euro_milione_in
                       + a.token_risposta::numeric / 1000000 * c.euro_milione_out, 5) end,
         c.modello is not null
    from domande_archivio a
    left join costo_modello_ai c on c.modello = a.modello
  union all
  select 'posta', p.proposta_il, p.proposta_modello,
         p.proposta_token_domanda, p.proposta_token_risposta,
         case when c.modello is null
               or p.proposta_token_domanda is null
               or p.proposta_token_risposta is null then null
              else round(p.proposta_token_domanda::numeric / 1000000 * c.euro_milione_in
                       + p.proposta_token_risposta::numeric / 1000000 * c.euro_milione_out, 5) end,
         (c.modello is not null
          and p.proposta_token_domanda is not null
          and p.proposta_token_risposta is not null)
    from posta_ricevuta p
    left join costo_modello_ai c on c.modello = p.proposta_modello
   where p.proposta_il is not null
  union all
  select 'ricetta', r.creato_il, r.modello, r.token_domanda, r.token_risposta,
         case when r.modello is null or c.modello is not null then r.costo_euro end,
         (r.modello is null or c.modello is not null)
    from letture_ricetta r
    left join costo_modello_ai c on c.modello = r.modello
  union all
  select 'chat', m.creato_il, m.modello, m.token_ingresso, m.token_uscita,
         m.costo_euro, m.costo_euro is not null
    from memo_messaggi m;
$funzione$;

revoke all on function consumi_ai() from public, anon, authenticated;
comment on function consumi_ai() is
  'Tutto cio'' che e'' costato all''assistente, in un posto solo: foto, voce, archivio, posta, ricetta e chat. Un costo che il listino non sa calcolare resta VUOTO e dichiarato, mai zero.';

create or replace function fonti_ai_scoperte()
returns table(tabella text, colonne text)
language sql
stable
security definer
set search_path = public
as $funzione$
  select c.table_name::text,
         string_agg(c.column_name, ', ' order by c.column_name)::text
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.column_name in ('modello', 'proposta_modello')
     and c.table_name <> 'costo_modello_ai'
     and not exists (
       select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'consumi_ai'
          and pg_get_functiondef(p.oid) like '%' || c.table_name || '%')
   group by c.table_name;
$funzione$;

revoke all on function fonti_ai_scoperte() from public, anon, authenticated;
comment on function fonti_ai_scoperte() is
  'Rete diagnostica: nomina una tabella che registra modello e token ma che consumi_ai non conta. Vuota significa che ogni fonte nota entra nel tetto unico.';

-- Archivio e Posta usano gia' Opus. Non esisteva un prezzo nel repository,
-- quindi questo e' prudenziale: va confrontato con la prima fattura vera.
insert into costo_modello_ai (modello, euro_milione_in, euro_milione_out, nota)
values (
  'claude-opus-5', 15.0000, 75.0000,
  'Prezzo PROVVISORIO, da confermare con la prima fattura: 15 euro per milione di token in ingresso e 75 euro in uscita, scelto prudenzialmente finche'' il listino usato dall''account non e'' verificato.'
)
on conflict (modello) do nothing;

-- ---------------------------------------------------------------------
-- 4. IL FRENO ORARIO DELLA CHAT
-- ---------------------------------------------------------------------
create or replace function memo_limite_messaggi(p_utente uuid)
returns table(superato boolean, quante integer, tetto integer, frase text)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_tetto constant integer := 60;
  v_n     integer;
begin
  if not is_titolare() then
    raise exception 'La chat di MEMO e'' riservata al titolare.';
  end if;

  -- Come per voce_limite_dettature, si conta il gesto di Alessio, non i
  -- passi interni di MEMO: una domanda puo' produrre strumenti senza
  -- diventare piu' costosa per il freno orario.
  select count(*) into v_n
    from memo_messaggi m
    join memo_conversazioni c on c.id = m.conversazione_id
   where c.creata_da = p_utente
     and m.ruolo = 'alessio'
     and m.creato_il > now() - interval '1 hour';

  return query select
    v_n >= v_tetto,
    v_n,
    v_tetto,
    'Sono gia'' arrivati ' || v_tetto ||
    ' messaggi nella chat nell''ultima ora: mi fermo per non consumare oltre il previsto.';
end $funzione$;

comment on function memo_limite_messaggi(uuid) is
  'Risponde a una domanda sola: Alessio ha gia'' mandato 60 messaggi alla chat di MEMO nell''ultima ora? La soglia vive qui, viene restituita insieme alla risposta e ferma il sessantunesimo messaggio.';
revoke all on function memo_limite_messaggi(uuid) from public, anon, authenticated;
grant execute on function memo_limite_messaggi(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. VERIFICA — SOTTO-TRANSAZIONE, POI ZERO RESIDUI
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto        jsonb := foto_righe();
  v_titolare    uuid;
  v_staff       uuid;
  v_conv        uuid;
  v_speso_prima numeric;
  v_speso_dopo  numeric;
  v_n           integer;
  v_rifiuto     boolean;
  v_freno       record;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles.';
  end if;

  if has_function_privilege('anon', 'memo_limite_messaggi(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'memo_limite_messaggi(uuid)', 'execute')
     or has_function_privilege('authenticated', 'consumi_ai()', 'execute')
     or has_function_privilege('authenticated', 'fonti_ai_scoperte()', 'execute') then
    raise exception 'VERIFICA: le porte delle funzioni della chat o del conto non sono quelle dichiarate.';
  end if;

  begin
    -- Il ruolo basso rende questa una prova RLS vera: il proprietario della
    -- migrazione la scavalcherebbe e direbbe verde anche con le policy spente.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;

    insert into memo_conversazioni (aperta_da_percorso, aperta_da_modulo, titolo)
    values ('/cassa', 'Cassa', 'ZZ verifica chat di MEMO')
    returning id into v_conv;
    insert into memo_riferimenti (conversazione_id, rif, tabella, riga_id)
    values (v_conv, 'A1', 'memo_conversazioni', v_conv);

    select s.speso_euro into v_speso_prima from spesa_ai_del_mese() s;
    insert into memo_messaggi (conversazione_id, ruolo, testo, modello,
                               token_ingresso, token_uscita, costo_euro, stato)
    values (v_conv, 'alessio', 'ZZ verifica costo chat', 'claude-sonnet-5',
            100, 50, 0.12345, 'fatto');
    select s.speso_euro into v_speso_dopo from spesa_ai_del_mese() s;
    if v_speso_dopo <> round(v_speso_prima + 0.12345, 5) then
      raise exception 'VERIFICA (1): spesa_ai_del_mese non ha contato la chat (% invece di %).', v_speso_dopo, round(v_speso_prima + 0.12345, 5);
    end if;

    v_rifiuto := false;
    begin
      insert into memo_messaggi (conversazione_id, ruolo, testo, costo_euro)
      values (v_conv, 'memo', 'ZZ costo fuori limite', 1.00001);
    exception when check_violation then v_rifiuto := true;
    end;
    if not v_rifiuto then
      raise exception 'VERIFICA (2): un messaggio oltre 1 euro e'' passato.';
    end if;

    -- La rete e' chiusa all'app; qui deve trovare il vuoto, perche'
    -- memo_messaggi e' nel corpo di consumi_ai.
    reset role;
    select count(*) into v_n from fonti_ai_scoperte();
    if v_n <> 0 then
      raise exception 'VERIFICA (3): fonti_ai_scoperte ha trovato % fonti, ma la chat e'' gia'' nel conto.', v_n;
    end if;

    -- Lo staff non legge nessuna delle tre tabelle e non ne scrive una riga.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_n from memo_conversazioni where id = v_conv;
    if v_n <> 0 then raise exception 'VERIFICA (4a): lo staff vede la conversazione.'; end if;
    select count(*) into v_n from memo_messaggi where conversazione_id = v_conv;
    if v_n <> 0 then raise exception 'VERIFICA (4b): lo staff vede i messaggi.'; end if;
    select count(*) into v_n from memo_riferimenti where conversazione_id = v_conv;
    if v_n <> 0 then raise exception 'VERIFICA (4c): lo staff vede i riferimenti.'; end if;
    v_rifiuto := false;
    begin
      insert into memo_messaggi (conversazione_id, ruolo, testo)
      values (v_conv, 'alessio', 'ZZ scrittura dello staff');
    exception when insufficient_privilege then v_rifiuto := true;
    end;
    if not v_rifiuto then
      raise exception 'VERIFICA (4d): lo staff ha scritto nella chat.';
    end if;

    -- Sessanta messaggi di Alessio ci sono gia': il prossimo, il 61°, si ferma.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    insert into memo_messaggi (conversazione_id, ruolo, testo)
    select v_conv, 'alessio', 'ZZ messaggio per il freno ' || n
      from generate_series(2, 60) n;
    select * into v_freno from memo_limite_messaggi(v_titolare);
    if not v_freno.superato or v_freno.quante < 60 or v_freno.tetto <> 60 then
      raise exception 'VERIFICA (5): il freno non ferma il sessantunesimo messaggio (%).', row_to_json(v_freno);
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica delle fondamenta della chat di MEMO');
  raise notice 'Fatto: la chat e'' solo del titolare, conta nel tetto AI, una fonte scoperta non resta, il costo oltre un euro si rifiuta e il sessantunesimo messaggio orario si ferma. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261114000011', 'le_fondamenta_della_chat_di_memo')
on conflict (version) do nothing;
