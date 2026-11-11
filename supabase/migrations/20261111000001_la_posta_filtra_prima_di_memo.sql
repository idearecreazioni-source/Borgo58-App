-- =====================================================================
-- LA POSTA FILTRA LE MAIL INUTILI PRIMA DI MEMO — 11/11/2026
-- =====================================================================
--
-- Alessio, l'11/11: «oggi ho tolto diverse mail inutili che dovremmo poter
-- filtrare prima di spendere soldi con memo». Erano quasi tutte avvisi
-- automatici: Credem (accesso a Business On, al mobile banking, «MYBOX:
-- Nuovi documenti disponibili») e Aruba (l'inoltro automatico impostato).
-- Ognuna passava dal modello, si pagava, e finiva fra le scartate.
--
-- E la sua precisazione, che decide la forma: «la credem manda una mail
-- inutile ogni volta che accedo all'internet banking ma non tutte le mail
-- della credem sono inutili». Quindi una regola è MITTENTE + TIPO DI
-- OGGETTO, e il mittente intero solo quando lo sceglie lui.
--
--   · `posta_filtri`: le regole. Il tipo di oggetto è l'oggetto ripulito
--     (minuscole, senza «R:»/«Fwd:», numeri e date al posto di «#»): due
--     avvisi di accesso a orari diversi sono lo stesso tipo.
--   · un controllo PRIMA DI SALVARE la mail (trigger su `posta_ricevuta`):
--     se una regola la prende, nasce già «scartata», con la regola
--     accanto. `posta-leggi` legge solo le «da leggere», quindi il modello
--     non la vede e non si spende niente. Nessuna funzione online cambia.
--   · la mail filtrata NON sparisce: resta fra le tolte, si vede nella
--     scheda «Sistemate» col bollino «Filtrata», e si rimette da leggere
--     con un tocco se il filtro ha sbagliato.
--   · `aggiungi_filtro_posta`: il tasto «Ignora le mail come questa» della
--     Posta. Solo il titolare.
--
-- ⚠️ LA PEC DELLO SDI E IL GESTORE PEC NON SI FILTRANO MAI: né al salvataggio
--    né come regola nuova. Una fattura fermata qui non arriverebbe più.
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. COME SI LEGGONO MITTENTE E OGGETTO
-- ---------------------------------------------------------------------------
create or replace function posta_indirizzo(p_mittente text)
returns text
language sql
immutable
set search_path = public
as $$
  -- «Credem <businesson@credem.it>» → «businesson@credem.it».
  select nullif(lower(btrim(coalesce(substring(p_mittente from '<([^<>]+)>'), p_mittente, ''))), '');
$$;

create or replace function posta_tipo_oggetto(p_oggetto text)
returns text
language sql
immutable
set search_path = public
as $$
  -- Minuscole, senza «posta certificata:», «r:», «re:», «fw:», «fwd:» davanti,
  -- ogni gruppo di cifre diventa «#», gli spazi uno solo.
  select nullif(btrim(regexp_replace(regexp_replace(
           regexp_replace(lower(coalesce(p_oggetto, '')),
                          '^(\s*(posta certificata|r|re|fw|fwd|i|inoltro)\s*:\s*)+', ''),
           '[0-9]+', '#', 'g'),
         '\s+', ' ', 'g')), '');
$$;

create or replace function posta_protetta(p_indirizzo text)
returns boolean
language sql
immutable
set search_path = public
as $$
  -- Lo SdI scrive da «sdiNN@pec.fatturapa.it»; il gestore PEC incarta da
  -- «posta-certificata@…». Questi non si filtrano mai.
  select coalesce(p_indirizzo, '') like '%fatturapa.it'
      or coalesce(p_indirizzo, '') like 'posta-certificata@%';
$$;

revoke all on function posta_indirizzo(text) from public, anon;
revoke all on function posta_tipo_oggetto(text) from public, anon;
revoke all on function posta_protetta(text) from public, anon;
grant execute on function posta_indirizzo(text) to authenticated;
grant execute on function posta_tipo_oggetto(text) to authenticated;
grant execute on function posta_protetta(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. LE REGOLE
-- ---------------------------------------------------------------------------
create table if not exists posta_filtri (
  id            uuid primary key default gen_random_uuid(),
  mittente      text not null check (mittente = lower(btrim(mittente)) and mittente like '%@%'),
  -- Vuoto = tutto da questo mittente (solo se scelto apposta).
  oggetto_tipo  text check (oggetto_tipo is null or length(btrim(oggetto_tipo)) >= 3),
  nota          text,
  creato_il     timestamptz not null default now(),
  constraint posta_filtri_mai_la_pec check (not posta_protetta(mittente))
);
create unique index if not exists posta_filtri_unico on posta_filtri (mittente, coalesce(oggetto_tipo, ''));

comment on table posta_filtri is
  'Le mail che la Posta mette da parte prima di MEMO, senza spesa (11/11/2026): mittente + tipo di oggetto (contenuto nell''oggetto ripulito), oppure tutto il mittente se oggetto_tipo è vuoto. Solo il titolare.';
comment on constraint posta_filtri_mai_la_pec on posta_filtri is
  'La PEC dello SdI e il gestore PEC non si filtrano: una fattura fermata qui non arriverebbe più.';

alter table posta_filtri enable row level security;
drop policy if exists posta_filtri_titolare on posta_filtri;
create policy posta_filtri_titolare on posta_filtri
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));
revoke all on posta_filtri from anon;
grant select, delete on posta_filtri to authenticated;

alter table posta_ricevuta add column if not exists filtrata_da uuid references posta_filtri(id) on delete set null;
comment on column posta_ricevuta.filtrata_da is
  'La regola che ha messo da parte questa mail prima di MEMO. Vuota se la regola è stata tolta dopo.';

-- ---------------------------------------------------------------------------
-- 3. IL CONTROLLO PRIMA DI SALVARE
-- ---------------------------------------------------------------------------
create or replace function posta_regola_per(p_mittente text, p_oggetto text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select f.id
    from posta_filtri f
   where not posta_protetta(posta_indirizzo(p_mittente))
     and f.mittente = posta_indirizzo(p_mittente)
     and (f.oggetto_tipo is null
          or position(f.oggetto_tipo in coalesce(posta_tipo_oggetto(p_oggetto), '')) > 0)
   -- La regola più stretta vince: si dice quella giusta nella Posta.
   order by (f.oggetto_tipo is null), length(coalesce(f.oggetto_tipo, '')) desc
   limit 1;
$$;
revoke all on function posta_regola_per(text, text) from public, anon, authenticated;

create or replace function posta_filtra_in_arrivo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_regola uuid;
  v_f      posta_filtri%rowtype;
begin
  if new.stato is distinct from 'da_leggere' then
    return new;
  end if;
  v_regola := posta_regola_per(new.mittente, new.oggetto);
  if v_regola is null then
    return new;
  end if;
  select * into v_f from posta_filtri where id = v_regola;
  new.stato := 'scartata';
  new.filtrata_da := v_regola;
  new.lettura_note := 'Filtrata prima di MEMO, senza spesa: '
    || case when v_f.oggetto_tipo is null then 'tutte le mail da ' || v_f.mittente
            else 'da ' || v_f.mittente || ' con «' || v_f.oggetto_tipo || '» nell''oggetto' end
    || '.';
  return new;
end $$;
revoke all on function posta_filtra_in_arrivo() from public, anon, authenticated;

drop trigger if exists trg_posta_filtra_in_arrivo on posta_ricevuta;
create trigger trg_posta_filtra_in_arrivo before insert on posta_ricevuta
  for each row execute function posta_filtra_in_arrivo();

-- ---------------------------------------------------------------------------
-- 4. IL TASTO «IGNORA LE MAIL COME QUESTA»
-- ---------------------------------------------------------------------------
create or replace function aggiungi_filtro_posta(p_posta_id uuid, p_tutto_mittente boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m     posta_ricevuta%rowtype;
  v_ind   text;
  v_tipo  text;
  v_id    uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare decide quali mail ignorare.';
  end if;
  select * into v_m from posta_ricevuta where id = p_posta_id for update;
  if not found then
    raise exception 'Questa mail non c''è più.';
  end if;
  v_ind := posta_indirizzo(v_m.mittente);
  if v_ind is null or v_ind not like '%@%' then
    raise exception 'Non riesco a leggere l''indirizzo del mittente: questa mail non si può filtrare.';
  end if;
  if posta_protetta(v_ind) then
    raise exception 'Le mail dello SdI e della PEC non si filtrano: ci arrivano le fatture.';
  end if;
  if coalesce(p_tutto_mittente, false) then
    v_tipo := null;
  else
    v_tipo := posta_tipo_oggetto(v_m.oggetto);
    if v_tipo is null or length(v_tipo) < 3 then
      raise exception 'Questa mail non ha un oggetto da riconoscere: si può ignorare solo tutto il mittente.';
    end if;
  end if;

  select id into v_id from posta_filtri
   where mittente = v_ind and coalesce(oggetto_tipo, '') = coalesce(v_tipo, '');
  if v_id is null then
    insert into posta_filtri (mittente, oggetto_tipo, nota)
    values (v_ind, v_tipo, 'Dalla Posta: «' || left(coalesce(v_m.oggetto, ''), 120) || '»')
    returning id into v_id;
  end if;

  -- Questa mail va subito con le filtrate (se era ancora aperta).
  update posta_ricevuta
     set stato = 'scartata', filtrata_da = v_id
   where id = p_posta_id and stato in ('da_leggere', 'proposta');

  return jsonb_build_object('filtro_id', v_id, 'mittente', v_ind, 'oggetto_tipo', v_tipo);
end $$;

comment on function aggiungi_filtro_posta(uuid, boolean) is
  'Il tasto «Ignora le mail come questa» della Posta (11/11/2026): una regola mittente + tipo di oggetto, oppure tutto il mittente se scelto apposta; mai la PEC dello SdI. Mette da parte anche questa mail. Due tabelle: dal corridoio.';
revoke all on function aggiungi_filtro_posta(uuid, boolean) from public, anon, authenticated;
grant execute on function aggiungi_filtro_posta(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4bis. IL MODELLO PIÙ CARO SOLO PER I MITTENTI CONOSCIUTI
-- ---------------------------------------------------------------------------
-- Per `posta-leggi` (chiave di servizio, che le tabelle dei fornitori non le
-- legge, apposta: 20260812000003): risponde solo sì o no. Conosciuto = la
-- PEC dello SdI o del gestore, oppure l'indirizzo (o il dominio, se non è
-- una casella pubblica tipo gmail) di un fornitore in anagrafica.
create or replace function mittente_conosciuto_per_la_posta(p_mittente text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with m as (select posta_indirizzo(p_mittente) as ind)
  select coalesce(posta_protetta(m.ind), false)
      or exists (
           select 1 from suppliers s
            where nullif(btrim(s.contact_email), '') is not null
              and (lower(btrim(s.contact_email)) = m.ind
                   or (split_part(lower(btrim(s.contact_email)), '@', 2) = split_part(m.ind, '@', 2)
                       and split_part(m.ind, '@', 2) not in (
                         'gmail.com', 'libero.it', 'hotmail.it', 'hotmail.com', 'outlook.it', 'outlook.com',
                         'yahoo.it', 'yahoo.com', 'icloud.com', 'virgilio.it', 'alice.it', 'tiscali.it',
                         'pec.it', 'legalmail.it', 'pec.aruba.it', 'arubapec.it'))))
    from m;
$$;
comment on function mittente_conosciuto_per_la_posta(text) is
  'Per posta-leggi (11/11/2026): il mittente è lo SdI, il gestore PEC o un fornitore in anagrafica? Decide se usare il modello più caro. Solo la chiave di servizio.';
revoke all on function mittente_conosciuto_per_la_posta(text) from public, anon, authenticated;
grant execute on function mittente_conosciuto_per_la_posta(text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. LE REGOLE DI PARTENZA (scelte da Alessio l'11/11)
-- ---------------------------------------------------------------------------
insert into posta_filtri (mittente, oggetto_tipo, nota)
values
  ('businesson@credem.it', 'notifica accesso business on', 'Avviso di accesso a Business On (regola di partenza, 11/11)'),
  ('businesson@credem.it', 'accesso mobile banking', 'Avviso di accesso al mobile banking (regola di partenza, 11/11)'),
  ('businesson@credem.it', 'mybox: nuovi documenti disponibili', 'Solo un avviso, i documenti sono in banca (Alessio, 11/11)'),
  ('comunicazioni@staff.aruba.it', 'inoltro automatico è stato impostato', 'Avviso di Aruba sull''inoltro (regola di partenza, 11/11)')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione che si annulla
-- ---------------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_id       uuid;
  v_r        jsonb;
  v_stato    text;
  v_respinto boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff.';
  end if;

  -- Le letture.
  if posta_indirizzo('Credem <BusinessOn@Credem.it>') <> 'businesson@credem.it'
     or posta_indirizzo('info@esempio.it') <> 'info@esempio.it' then
    raise exception 'VERIFICA: l''indirizzo non si legge.';
  end if;
  if posta_tipo_oggetto('R: Fwd: Notifica Accesso del 10/11/2026 ore 09:32') <> 'notifica accesso del #/#/# ore #:#' then
    raise exception 'VERIFICA: il tipo di oggetto non è quello atteso (%).', posta_tipo_oggetto('R: Fwd: Notifica Accesso del 10/11/2026 ore 09:32');
  end if;
  if not posta_protetta('sdi38@pec.fatturapa.it') or not posta_protetta('posta-certificata@pec.aruba.it')
     or posta_protetta('businesson@credem.it') then
    raise exception 'VERIFICA: la protezione della PEC non risponde come deve.';
  end if;
  if has_function_privilege('authenticated', 'posta_regola_per(text, text)', 'execute')
     or has_function_privilege('anon', 'aggiungi_filtro_posta(uuid, boolean)', 'execute') then
    raise exception 'VERIFICA: una porta del filtro è aperta a chi non deve.';
  end if;

  begin  -- <<< la sotto-transazione che verrà annullata
    -- 1. Le regole di partenza prendono l'avviso, non la mail vera di Credem.
    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-FILTRO-1', 'info@verifica', 'Credem <businesson@credem.it>', 'Notifica accesso Business On del 11/11/2026 10:02', 'da_leggere')
    returning stato into v_stato;
    if v_stato <> 'scartata' then raise exception 'VERIFICA (1): l''avviso di accesso non è stato filtrato.'; end if;
    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-FILTRO-2', 'info@verifica', 'Credem <businesson@credem.it>', 'Estratto conto di ottobre', 'da_leggere')
    returning stato into v_stato;
    if v_stato <> 'da_leggere' then raise exception 'VERIFICA (1): la mail vera di Credem è stata filtrata.'; end if;
    if (select lettura_note from posta_ricevuta where messaggio_id = 'ZZ-FILTRO-1') not like 'Filtrata prima di MEMO%' then
      raise exception 'VERIFICA (1): la mail filtrata non dice perché.';
    end if;

    -- 2. La PEC dello SdI non si filtra, nemmeno con una regola scritta a mano.
    v_respinto := false;
    begin
      insert into posta_filtri (mittente, oggetto_tipo) values ('sdi38@pec.fatturapa.it', null);
    exception when check_violation then v_respinto := true;
    end;
    if not v_respinto then raise exception 'VERIFICA (2): una regola sulla PEC dello SdI è stata accettata.'; end if;

    -- 3. Il tasto: tipo di oggetto, poi la mail successiva dello stesso tipo è presa.
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-FILTRO-3', 'info@verifica', 'Newsletter <news@zz-verifica.it>', 'Le offerte della settimana 45', 'proposta')
    returning id into v_id;
    v_r := aggiungi_filtro_posta(v_id, false);
    if v_r->>'oggetto_tipo' <> 'le offerte della settimana #'
       or (select stato from posta_ricevuta where id = v_id) <> 'scartata' then
      raise exception 'VERIFICA (3): il tasto non ha fatto la regola attesa (%).', v_r;
    end if;
    reset role;
    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-FILTRO-4', 'info@verifica', 'news@zz-verifica.it', 'Le offerte della settimana 46', 'da_leggere')
    returning stato into v_stato;
    if v_stato <> 'scartata' then raise exception 'VERIFICA (3): la mail dello stesso tipo non è stata filtrata.'; end if;
    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-FILTRO-5', 'info@verifica', 'news@zz-verifica.it', 'La tua fattura di novembre', 'da_leggere')
    returning stato into v_stato;
    if v_stato <> 'da_leggere' then raise exception 'VERIFICA (3): una mail di altro tipo dello stesso mittente è stata filtrata.'; end if;

    -- 4. Lo SdI si rifiuta anche dal tasto; lo staff non può.
    set local role authenticated;
    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-FILTRO-6', 'pec@verifica', 'sdi38@pec.fatturapa.it', 'Invio File 1', 'proposta')
    returning id into v_id;
    v_respinto := false;
    begin
      perform aggiungi_filtro_posta(v_id, true);
    exception when raise_exception then v_respinto := sqlerrm like '%non si filtrano%';
    end;
    if not v_respinto then raise exception 'VERIFICA (4): il tasto ha filtrato lo SdI.'; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_respinto := false;
    begin
      perform aggiungi_filtro_posta(v_id, false);
    exception when raise_exception then v_respinto := sqlerrm like '%titolare%';
    end;
    if not v_respinto then raise exception 'VERIFICA (4): lo staff ha aggiunto un filtro.'; end if;
    reset role;
    perform set_config('request.jwt.claims', null, true);

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica del filtro della posta');

  raise notice 'Fatto: le mail inutili si mettono da parte prima di MEMO, senza spesa, per mittente + tipo di oggetto (o tutto il mittente, se scelto); la PEC dello SdI non si filtra mai; quattro regole di partenza. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261111000001', 'la_posta_filtra_prima_di_memo')
on conflict (version) do nothing;
