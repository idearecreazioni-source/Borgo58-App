-- =====================================================================
-- GLI AVVISI DELLA BANCA SI RACCOLGONO, SENZA SCRIVERE NIENTE — 12/11/2026
-- =====================================================================
--
-- PR «B1» del piano «avvisi banca e posta» del 12/11, approvato da Alessio
-- con tutte le scelte consigliate.
--
-- L'11/11 Alessio ha chiesto a Credem di mandare gli avvisi dei movimenti a
-- `banca@…resend.app`. Senza questa migrazione quelle mail entrano nella
-- Posta come tutte le altre: passano da MEMO (che si paga), finiscono in
-- «Da decidere» e non servono a niente, perché un movimento della banca non
-- è un documento da archiviare.
--
-- Il lettore degli avvisi (B2) si scrive SOLO quando avremo visto le mail
-- vere: il formato non lo conosciamo, e un movimento indovinato è peggio di
-- nessun movimento. Per una o due settimane, quindi, le mail si RACCOLGONO
-- e basta:
--
--   · `service_settings.casella_avvisi_banca`: la parte prima della
--     chiocciola della casella degli avvisi («banca»). Configurabile e
--     non scritta nel codice: Prova e work ricevono a indirizzi tecnici
--     diversi, e la parte locale è l'unica cosa che hanno in comune. NULL
--     = nessuna casella degli avvisi (la deviazione si spegne).
--   · il controllo PRIMA DI SALVARE la mail (`posta_filtra_in_arrivo`, la
--     stessa funzione della 20261111000001, rifatta qui con create or
--     replace) ha un ramo nuovo, PRIMA delle regole di `posta_filtri`: una
--     mail arrivata alla casella della banca nasce «scartata», con la nota
--     che dice perché. `posta-leggi` legge solo le «da leggere»: niente
--     MEMO, niente spesa, niente Telegram.
--   · `avvisi_banca`: la copia di ogni avviso (mittente, mittente com'è
--     arrivato, oggetto, testo, data), con stato «raccolto». La scrive un
--     trigger DOPO il salvataggio, non prima.
--     🔴 Trappola 1 del piano: un trigger BEFORE scatta anche sulla mail
--        doppia che `on conflict (messaggio_id) do nothing` poi scarta, e
--        Resend riconsegna le mail. Un trigger AFTER scatta solo sulle
--        righe entrate davvero. In più `messaggio_id` è unico anche qui.
--   · il recupero delle mail di banca@ GIÀ arrivate: si copiano, e quelle
--     ancora aperte si chiudono come fa `aggiungi_filtro_posta` (la mail
--     va fra le scartate, le sue proposte aperte diventano «no»).
--
-- ⚠️ LA PEC DELLO SDI E IL GESTORE PEC NON SI DEVIANO MAI, nemmeno se
--    arrivassero alla casella della banca: è la stessa regola del filtro.
--
-- ⚠️ LE INTESTAZIONI (List-Unsubscribe, List-Id, Precedence,
--    Authentication-Results, la firma DKIM): la colonna c'è, ma oggi resta
--    vuota. `posta-in-arrivo` non le riceve dal webhook e non è chiaro se
--    la lettura della mail da Resend le porti: si verifica dal vivo su una
--    mail vera prima di scriverle (vedi la scheda). Non si inventa un campo.
--
-- ⚠️ La copia NON si cancella con la mail: la posta scartata sparisce dopo
--    `mesi_conservazione_posta`, e il legame si svuota (`on delete set
--    null`). L'avviso resta, perché è un pezzo dell'estratto conto.
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. QUAL È LA CASELLA DEGLI AVVISI
-- ---------------------------------------------------------------------------
alter table service_settings
  add column if not exists casella_avvisi_banca text default 'banca';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'service_settings_casella_avvisi_banca_check') then
    alter table service_settings add constraint service_settings_casella_avvisi_banca_check
      check (casella_avvisi_banca is null or casella_avvisi_banca ~ '^[a-z0-9][a-z0-9._+-]*$');
  end if;
end $$;

comment on column service_settings.casella_avvisi_banca is
  'La parte prima della chiocciola della casella dove la banca manda gli avvisi dei movimenti (12/11/2026): «banca» per banca@…resend.app. Quelle mail non passano da MEMO e si raccolgono in avvisi_banca. NULL: nessuna casella degli avvisi (la deviazione si spegne).';
comment on constraint service_settings_casella_avvisi_banca_check on service_settings is
  'La casella degli avvisi della banca si scrive come la parte prima della chiocciola: minuscole, cifre, punto, trattino, più o trattino basso (per esempio «banca»).';

-- ---------------------------------------------------------------------------
-- 2. QUESTA MAIL È UN AVVISO DELLA BANCA?
-- ---------------------------------------------------------------------------
create or replace function posta_e_avviso_banca(p_casella text, p_mittente text, p_mittente_busta text)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  -- La casella può arrivare come «Banca <banca@x.resend.app>»: si legge
  -- l'indirizzo come per il mittente, poi la parte prima della chiocciola.
  select coalesce((
           select s.casella_avvisi_banca is not null
              and position('@' in coalesce(posta_indirizzo(p_casella), '')) > 1
              and split_part(posta_indirizzo(p_casella), '@', 1) = s.casella_avvisi_banca
             from service_settings s
            where s.id = 1), false)
     -- ⚠️ La PEC dello SdI e il gestore PEC restano fuori, anche scritti
     --    in modo strano (stessa doppia protezione di posta_regola_per).
     and not coalesce(posta_protetta(posta_indirizzo(p_mittente)), false)
     and not coalesce(posta_protetta(posta_indirizzo(p_mittente_busta)), false)
     and coalesce(lower(p_mittente), '') not like '%fatturapa.it%'
     and coalesce(lower(p_mittente_busta), '') not like '%fatturapa.it%'
     and coalesce(lower(p_mittente), '') not like '%posta-certificata@%'
     and coalesce(lower(p_mittente_busta), '') not like '%posta-certificata@%';
$$;
comment on function posta_e_avviso_banca(text, text, text) is
  'Una mail arrivata alla casella degli avvisi della banca (service_settings.casella_avvisi_banca), che non sia la PEC dello SdI o del gestore (12/11/2026). La chiamano i due trigger della posta.';
revoke all on function posta_e_avviso_banca(text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. GLI AVVISI RACCOLTI
-- ---------------------------------------------------------------------------
create table if not exists avvisi_banca (
  id              uuid primary key default gen_random_uuid(),
  -- La mail da cui viene. Si svuota quando la pulizia della posta la
  -- cancella: l'avviso resta.
  posta_id        uuid constraint avvisi_banca_posta_id_fkey references posta_ricevuta(id) on delete set null,
  -- 🔴 Unico: una consegna ripetuta di Resend non fa due avvisi, anche se la
  --    mail di partenza non c'è più.
  messaggio_id    text not null constraint avvisi_banca_messaggio_id_key unique,
  casella         text not null,
  mittente        text,                   -- ⚠️ dato personale (di solito la banca)
  mittente_busta  text,
  oggetto         text,
  testo           text,
  -- Le poche intestazioni utili (List-Unsubscribe, List-Id, Precedence,
  -- Authentication-Results, DKIM d=). Vuote finché non si verifica dal
  -- vivo che Resend le dia.
  intestazioni    jsonb,
  ricevuta_il     timestamptz not null,
  stato           text not null default 'raccolto',
  -- Cosa ne ha fatto il lettore (B2): il movimento, o perché non l'ha capito.
  nota            text,
  creato_il       timestamptz not null default now(),
  -- I quattro momenti di un avviso, dal piano del 12/11: raccolto (oggi,
  -- nessuno l'ha letto), registrato (è diventato un movimento in Banca),
  -- non_capito (il lettore non era sicuro e non ha scritto niente),
  -- ignorato (non era un movimento: saldo, comunicazione).
  constraint avvisi_banca_stato_check check (stato in ('raccolto', 'registrato', 'non_capito', 'ignorato'))
);
create index if not exists idx_avvisi_banca_posta on avvisi_banca (posta_id);
create index if not exists idx_avvisi_banca_ricevuta_il on avvisi_banca (ricevuta_il desc);

comment on table avvisi_banca is
  'Gli avvisi dei movimenti mandati dalla banca alla sua casella (12/11/2026): la copia di ogni mail, raccolta senza scrivere niente in Banca né in prima nota. Il lettore arriva quando si conosce il formato vero. Solo il titolare la legge; la scrivono i trigger della posta.';
comment on column avvisi_banca.messaggio_id is
  'L''identificativo della mail dato da chi l''ha consegnata: unico, così una consegna ripetuta non fa due avvisi.';
comment on column avvisi_banca.casella is 'La casella a cui è arrivato l''avviso.';
comment on column avvisi_banca.ricevuta_il is 'Quando è arrivata la mail dell''avviso.';
comment on column avvisi_banca.stato is
  'raccolto (nessuno l''ha ancora letto), registrato (è diventato un movimento in Banca), non_capito (il lettore non era sicuro e non ha scritto niente), ignorato (non era un movimento).';
comment on column avvisi_banca.intestazioni is
  'Le poche intestazioni utili della mail (List-Unsubscribe, List-Id, Precedence, Authentication-Results, DKIM d=). Vuote finché non si verifica dal vivo che il servizio di posta le dia (12/11/2026).';
comment on constraint avvisi_banca_stato_check on avvisi_banca is
  'Un avviso della banca è raccolto, registrato (è diventato un movimento), non capito oppure ignorato: nessun altro stato.';
comment on constraint avvisi_banca_messaggio_id_key on avvisi_banca is
  'Questo avviso della banca è già stato raccolto: la stessa mail consegnata due volte non fa due avvisi.';
comment on constraint avvisi_banca_posta_id_fkey on avvisi_banca is
  'La mail di questo avviso della banca non c''è più.';

alter table avvisi_banca enable row level security;
drop policy if exists avvisi_banca_titolare_legge on avvisi_banca;
create policy avvisi_banca_titolare_legge on avvisi_banca
  for select to authenticated
  using ((select is_titolare()));
-- Dal browser si legge e basta: la scrivono i trigger (proprietario).
revoke all on avvisi_banca from anon, authenticated, service_role;
grant select on avvisi_banca to authenticated;

-- ---------------------------------------------------------------------------
-- 4. IL CONTROLLO PRIMA DI SALVARE: IL RAMO DELLA BANCA VIENE PRIMA
-- ---------------------------------------------------------------------------
create or replace function posta_filtra_in_arrivo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_regola uuid;
  v_f      posta_filtri%rowtype;
begin
  if new.stato is distinct from 'da_leggere' then
    return new;
  end if;

  -- 12/11/2026: la casella degli avvisi della banca, PRIMA delle regole.
  -- Un avviso preso anche da una regola direbbe la regola sbagliata, e
  -- togliendo la regola tornerebbe a passare da MEMO.
  if posta_e_avviso_banca(new.casella, new.mittente, new.mittente_busta) then
    new.stato := 'scartata';
    new.lettura_note := 'Avviso della banca: va in Banca, non in MEMO. Senza spesa; la copia è fra gli avvisi della banca.';
    return new;
  end if;

  v_regola := posta_regola_per(new.mittente, new.oggetto);
  if v_regola is null then
    return new;
  end if;
  select * into v_f from posta_filtri where id = v_regola;
  new.stato := 'scartata';
  new.filtrata_da := v_regola;
  new.lettura_note := 'Filtrata prima di MEMO, senza spesa: ' || posta_regola_in_italiano(v_f) || '.';
  return new;
end $$;
revoke all on function posta_filtra_in_arrivo() from public, anon, authenticated;
-- Il trigger BEFORE resta quello della 20261111000001: cambia solo la funzione.

-- ---------------------------------------------------------------------------
-- 5. LA COPIA, DOPO IL SALVATAGGIO
-- ---------------------------------------------------------------------------
create or replace function posta_copia_avviso_banca()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- 🔴 AFTER INSERT apposta (trappola 1 del piano): la mail doppia che
  --    `on conflict do nothing` scarta non arriva fin qui.
  if posta_e_avviso_banca(new.casella, new.mittente, new.mittente_busta) then
    insert into avvisi_banca (posta_id, messaggio_id, casella, mittente, mittente_busta, oggetto, testo, ricevuta_il)
    values (new.id, new.messaggio_id, new.casella, new.mittente, new.mittente_busta, new.oggetto, new.testo, new.ricevuta_il)
    on conflict (messaggio_id) do nothing;
  end if;
  return null;
end $$;
comment on function posta_copia_avviso_banca() is
  'Copia in avvisi_banca la mail arrivata alla casella degli avvisi della banca (12/11/2026). Trigger AFTER INSERT: le consegne doppie scartate non fanno copie.';
revoke all on function posta_copia_avviso_banca() from public, anon, authenticated;

drop trigger if exists trg_posta_copia_avviso_banca on posta_ricevuta;
create trigger trg_posta_copia_avviso_banca after insert on posta_ricevuta
  for each row execute function posta_copia_avviso_banca();

-- ---------------------------------------------------------------------------
-- 6. IL RECUPERO DEGLI AVVISI GIÀ ARRIVATI
-- ---------------------------------------------------------------------------
-- Si copiano tutti, in qualunque stato siano (sono pezzi dell'estratto
-- conto); quelli ancora aperti si chiudono come fa `aggiungi_filtro_posta`.
-- Si leggono le tabelle e basta: una migrazione non ha un utente.
insert into avvisi_banca (posta_id, messaggio_id, casella, mittente, mittente_busta, oggetto, testo, ricevuta_il)
select r.id, r.messaggio_id, r.casella, r.mittente, r.mittente_busta, r.oggetto, r.testo, r.ricevuta_il
  from posta_ricevuta r
 where posta_e_avviso_banca(r.casella, r.mittente, r.mittente_busta)
on conflict (messaggio_id) do nothing;

update posta_azioni a
   set stato = 'rifiutata', decisa_il = now()
  from posta_ricevuta r
 where a.posta_id = r.id
   and a.stato = 'proposta'
   and r.stato in ('da_leggere', 'proposta')
   and posta_e_avviso_banca(r.casella, r.mittente, r.mittente_busta);

update posta_ricevuta r
   set stato = 'scartata',
       lettura_note = 'Avviso della banca: va in Banca, non in MEMO. Tolta dalle mail da decidere il 12/11/2026; la copia è fra gli avvisi della banca.'
 where r.stato in ('da_leggere', 'proposta')
   and posta_e_avviso_banca(r.casella, r.mittente, r.mittente_busta);

-- ---------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione che si annulla
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_stato    text;
  v_note     text;
  v_filtro   uuid;
  v_n        integer;
  v_respinto boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff.';
  end if;

  -- Le porte: nessuna funzione nuova si chiama da fuori, la tabella si
  -- legge solo da chi ha fatto il login (e la RLS la lascia al titolare).
  if has_function_privilege('authenticated', 'posta_e_avviso_banca(text, text, text)', 'execute')
     or has_function_privilege('authenticated', 'posta_copia_avviso_banca()', 'execute')
     or has_function_privilege('anon', 'posta_e_avviso_banca(text, text, text)', 'execute') then
    raise exception 'VERIFICA: una funzione degli avvisi della banca è aperta a chi non deve.';
  end if;
  if has_table_privilege('anon', 'avvisi_banca', 'select')
     or has_table_privilege('authenticated', 'avvisi_banca', 'insert')
     or has_table_privilege('authenticated', 'avvisi_banca', 'update')
     or has_table_privilege('authenticated', 'avvisi_banca', 'delete') then
    raise exception 'VERIFICA: avvisi_banca si scrive dal browser, o la legge chi non ha fatto il login.';
  end if;

  -- Il recupero: nessuna mail della banca resta da decidere, e ognuna ha la copia.
  if exists (select 1 from posta_ricevuta r
              where r.stato in ('da_leggere', 'proposta')
                and posta_e_avviso_banca(r.casella, r.mittente, r.mittente_busta)) then
    raise exception 'VERIFICA: una mail della banca è ancora fra quelle da decidere.';
  end if;
  if exists (select 1 from posta_ricevuta r
              where posta_e_avviso_banca(r.casella, r.mittente, r.mittente_busta)
                and not exists (select 1 from avvisi_banca a where a.messaggio_id = r.messaggio_id)) then
    raise exception 'VERIFICA: una mail della banca già arrivata non è stata copiata.';
  end if;

  begin  -- <<< la sotto-transazione che verrà annullata
    -- ⚠️ Le prove usano «banca», qualunque sia il valore vivo: Alessio può
    --    averla cambiata o spenta, e la verifica non deve dipenderne
    --    (revisione ecc:database-reviewer, 12/11). Si annulla con il resto.
    update service_settings set casella_avvisi_banca = 'banca' where id = 1;

    -- Le letture della casella.
    if not posta_e_avviso_banca('banca@zz-verifica.resend.app', 'Credem <businesson@credem.it>', null)
       or not posta_e_avviso_banca('Banca <BANCA@zz-verifica.resend.app>', 'businesson@credem.it', null)
       or posta_e_avviso_banca('info@zz-verifica.resend.app', 'businesson@credem.it', null)
       or posta_e_avviso_banca('bancaria@zz-verifica.resend.app', 'businesson@credem.it', null)
       or posta_e_avviso_banca('banca@zz-verifica.resend.app', 'sdi38@pec.fatturapa.it', 'posta-certificata@pec.aruba.it')
       or posta_e_avviso_banca(null, 'businesson@credem.it', null) then
      raise exception 'VERIFICA: la casella degli avvisi della banca non si riconosce come deve.';
    end if;

    -- 1. Come la chiave di servizio (la strada vera di posta-in-arrivo):
    --    l'avviso nasce scartato, con la nota, e la consegna doppia non
    --    fa una seconda copia.
    set local role service_role;
    insert into posta_ricevuta (messaggio_id, casella, mittente, mittente_busta, oggetto, testo, stato)
    values ('ZZ-BANCA-1', 'banca@zz-verifica.resend.app', 'Credem <businesson@credem.it>', 'businesson@credem.it',
            'ZZ verifica: addebito sul conto', 'Testo inventato della verifica.', 'da_leggere')
    on conflict (messaggio_id) do nothing
    returning stato, lettura_note into v_stato, v_note;
    if v_stato is distinct from 'scartata' or coalesce(v_note, '') not like 'Avviso della banca: va in Banca, non in MEMO%' then
      raise exception 'VERIFICA (1): l''avviso della banca non è nato scartato con la sua nota (%, %).', v_stato, v_note;
    end if;
    insert into posta_ricevuta (messaggio_id, casella, mittente, mittente_busta, oggetto, testo, stato)
    values ('ZZ-BANCA-1', 'banca@zz-verifica.resend.app', 'Credem <businesson@credem.it>', 'businesson@credem.it',
            'ZZ verifica: addebito sul conto', 'Testo inventato della verifica.', 'da_leggere')
    on conflict (messaggio_id) do nothing;
    -- La chiave di servizio non legge gli avvisi.
    v_respinto := false;
    begin
      perform 1 from avvisi_banca limit 1;
    exception when insufficient_privilege then v_respinto := true;
    end;
    if not v_respinto then raise exception 'VERIFICA (1): la chiave di servizio legge gli avvisi della banca.'; end if;
    reset role;

    select count(*) into v_n from avvisi_banca where messaggio_id = 'ZZ-BANCA-1';
    if v_n <> 1 then
      raise exception 'VERIFICA (1): l''avviso consegnato due volte ha % copie invece di una.', v_n;
    end if;
    if (select stato from avvisi_banca where messaggio_id = 'ZZ-BANCA-1') <> 'raccolto'
       or (select posta_id from avvisi_banca where messaggio_id = 'ZZ-BANCA-1')
          is distinct from (select id from posta_ricevuta where messaggio_id = 'ZZ-BANCA-1')
       or (select testo from avvisi_banca where messaggio_id = 'ZZ-BANCA-1') <> 'Testo inventato della verifica.' then
      raise exception 'VERIFICA (1): la copia dell''avviso non è quella attesa.';
    end if;

    -- 2. La stessa Credem che scrive a info@: non si tocca, e non si copia.
    --    ⚠️ Una regola scritta da Alessio su Prova potrebbe prenderla: si
    --    pretende che, se non è più da leggere, l'abbia presa una regola
    --    (filtrata_da) e non il ramo della banca.
    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-BANCA-2', 'info@zz-verifica.resend.app', 'Credem <businesson@credem.it>', 'ZZ verifica: comunicazione sul conto', 'da_leggere')
    returning stato, filtrata_da, lettura_note into v_stato, v_filtro, v_note;
    if coalesce(v_note, '') like 'Avviso della banca%'
       or (v_stato <> 'da_leggere' and v_filtro is null) then
      raise exception 'VERIFICA (2): una mail di Credem a info@ è stata deviata (%).', v_stato;
    end if;
    if exists (select 1 from avvisi_banca where messaggio_id = 'ZZ-BANCA-2') then
      raise exception 'VERIFICA (2): una mail di Credem a info@ è stata copiata fra gli avvisi.';
    end if;

    -- 3. Il ramo della banca viene PRIMA delle regole: un avviso che una
    --    regola di partenza prenderebbe dice «avviso della banca», non la regola.
    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-BANCA-3', 'banca@zz-verifica.resend.app', 'businesson@credem.it', 'Notifica accesso Business On del 12/11/2026 10:02', 'da_leggere')
    returning stato, filtrata_da, lettura_note into v_stato, v_filtro, v_note;
    if v_stato <> 'scartata' or v_filtro is not null or coalesce(v_note, '') not like 'Avviso della banca%' then
      raise exception 'VERIFICA (3): sulla casella della banca ha deciso una regola invece del ramo della banca (%).', v_note;
    end if;

    -- 4. La PEC dello SdI non si devia, nemmeno arrivata alla casella della banca.
    insert into posta_ricevuta (messaggio_id, casella, mittente, mittente_busta, oggetto, stato)
    values ('ZZ-BANCA-4', 'banca@zz-verifica.resend.app', 'sdi38@pec.fatturapa.it', 'posta-certificata@pec.aruba.it', 'Invio File 1', 'da_leggere')
    returning stato into v_stato;
    if v_stato <> 'da_leggere' or exists (select 1 from avvisi_banca where messaggio_id = 'ZZ-BANCA-4') then
      raise exception 'VERIFICA (4): la PEC dello SdI è stata deviata come un avviso della banca.';
    end if;

    -- 5. Chi legge: il titolare sì, lo staff niente, la chiave pubblica è respinta.
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_n from avvisi_banca where messaggio_id = 'ZZ-BANCA-1';
    if v_n <> 1 then raise exception 'VERIFICA (5): il titolare non vede l''avviso.'; end if;
    v_respinto := false;
    begin
      insert into avvisi_banca (messaggio_id, casella, ricevuta_il) values ('ZZ-BANCA-5', 'banca@zz-verifica', now());
    exception when insufficient_privilege then v_respinto := true;
    end;
    if not v_respinto then raise exception 'VERIFICA (5): il titolare scrive un avviso dal browser.'; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    select count(*) into v_n from avvisi_banca;
    if v_n <> 0 then raise exception 'VERIFICA (5): lo staff vede % avvisi della banca.', v_n; end if;
    reset role;
    perform set_config('request.jwt.claims', null, true);
    set local role anon;
    v_respinto := false;
    begin
      perform 1 from avvisi_banca limit 1;
    exception when insufficient_privilege then v_respinto := true;
    end;
    if not v_respinto then raise exception 'VERIFICA (5): la chiave pubblica legge gli avvisi della banca.'; end if;
    reset role;

    -- 6. Casella NULL nelle impostazioni: la deviazione si spegne.
    update service_settings set casella_avvisi_banca = null where id = 1;
    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-BANCA-6', 'banca@zz-verifica.resend.app', 'businesson@credem.it', 'ZZ verifica: addebito', 'da_leggere')
    returning stato, filtrata_da, lettura_note into v_stato, v_filtro, v_note;
    if coalesce(v_note, '') like 'Avviso della banca%'
       or (v_stato <> 'da_leggere' and v_filtro is null)
       or exists (select 1 from avvisi_banca where messaggio_id = 'ZZ-BANCA-6') then
      raise exception 'VERIFICA (6): con la casella vuota la mail è stata deviata lo stesso.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica degli avvisi della banca');

  raise notice 'Fatto: le mail alla casella «%» non passano da MEMO, nascono scartate e si copiano una volta sola in avvisi_banca; % avvisi già arrivati recuperati. Provato e annullato: zero residui.',
    (select casella_avvisi_banca from service_settings where id = 1), (select count(*) from avvisi_banca);
end $verifica$;

insert into applied_migrations (version, name)
values ('20261112000008', 'gli_avvisi_della_banca_si_raccolgono')
on conflict (version) do nothing;
