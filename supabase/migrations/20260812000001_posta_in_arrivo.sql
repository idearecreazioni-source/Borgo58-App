-- ---------------------------------------------------------------------
-- La posta in arrivo entra nel gestionale — primo pezzo: dove atterra
-- ---------------------------------------------------------------------
-- Idea di Alessio dell'11/08, ampliata il 12/08: far entrare le email del
-- locale nel gestionale, farle leggere all'AI e archiviare da sole quelle
-- che vanno conservate. Casella `info@`, le due PEC e — decisione del
-- 12/08 — anche la casella Gmail del gestionale.
--
-- QUESTA MIGRAZIONE FA SOLO LA PRIMA META': il posto dove la posta
-- atterra e la regola di chi la può vedere. La lettura dell'AI e la
-- schermata di conferma vengono dopo, e possono arrivare senza toccare
-- queste tabelle.
--
-- ---------------------------------------------------------------------
-- LE TRE COSE CHE QUESTA MIGRAZIONE DECIDE
-- ---------------------------------------------------------------------
--
-- 1. LA POSTA NON DIVENTA UN DOCUMENTO DA SOLA. Entra in una sala
--    d'aspetto (`posta_ricevuta`), con accanto una proposta — che
--    documento sembra, di chi, di quanto, quando scade — e ci resta
--    finché Alessio non conferma. È la regola che lui ha posto per
--    primo: *il sistema propone, Alessio conferma*. Un importo letto
--    male in una fattura è peggio di nessuna automazione, perché ci si
--    fida e non si ricontrolla.
--
-- 2. ENTRA TUTTO, QUINDI SI CANCELLA DA SOLO. Sua decisione dell'11/08:
--    nessun filtro all'ingresso. Ma se entra tutto entrano anche
--    pubblicità e messaggi personali, e conservarli per sempre
--    significherebbe costruire un archivio di dati altrui che nessuno ha
--    chiesto. Quello che **non** diventa un documento sparisce da solo
--    dopo `mesi_conservazione_posta` (3 di partenza), esattamente come
--    le richieste dei clienti rifiutate. Quello che Alessio archivia
--    resta: l'ha scelto lui.
--
-- 3. IL MITTENTE È UN DATO PERSONALE. Chi scrive al locale non ha
--    acconsentito a stare in un database: `posta_ricevuta` è leggibile
--    **solo dal titolare**, come le tabelle di soldi e di lavoro, e la
--    pulizia automatica cancella la riga per intero — indirizzo,
--    oggetto, testo — senza lasciarne copia nel registro delle
--    cancellazioni. Stessa tensione già risolta per le richieste dei
--    clienti (20260810000004), stessa soluzione.
--
-- Idempotente (§7 punto 3), con verifica finale che solleva eccezione.

-- ---------------------------------------------------------------------
-- 1. La sala d'aspetto
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'stato_posta') then
    create type stato_posta as enum (
      'da_leggere',    -- appena arrivata, l'AI non l'ha ancora vista
      'proposta',      -- l'AI ha proposto qualcosa, aspetta Alessio
      'archiviata',    -- Alessio ha confermato: è diventata un documento
      'scartata'       -- Alessio ha detto no (o era pubblicità)
    );
  end if;
end $$;

create table if not exists posta_ricevuta (
  id              uuid primary key default gen_random_uuid(),

  -- Identificativo assegnato da chi ce l'ha consegnata. Serve a non
  -- registrare due volte lo stesso messaggio: i servizi di posta
  -- ritentano la consegna se non rispondiamo in fretta, ed è normale
  -- ricevere lo stesso avviso due o tre volte.
  messaggio_id    text not null unique,

  casella         text not null,          -- a quale casella del locale era diretta
  mittente        text,                   -- ⚠️ dato personale
  oggetto         text,
  testo           text,                   -- corpo, per la lettura dell'AI
  ricevuta_il     timestamptz not null default now(),

  stato           stato_posta not null default 'da_leggere',

  -- La proposta dell'AI: stessi campi di `documents`, così confermare
  -- significa copiarli e non reinterpretarli.
  proposta_titolo         text,
  proposta_tipo           text,
  proposta_data           date,
  proposta_controparte    text,
  proposta_importo        numeric(12,2),
  proposta_scadenza       date,
  proposta_conservare     boolean,        -- l'AI dice se vale la pena archiviarla
  proposta_motivo         text,           -- perché sì o perché no, in una riga
  proposta_modello        text,           -- quale modello ha risposto
  proposta_token          integer,        -- quanto è costata, per tenerla d'occhio
  proposta_il             timestamptz,

  documento_id    uuid references documents(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table posta_ricevuta is
  'La posta del locale, in attesa di una decisione. Solo il titolare la vede: il mittente non ha acconsentito a stare qui. Ciò che non diventa un documento si cancella da solo (service_settings.mesi_conservazione_posta).';
comment on column posta_ricevuta.messaggio_id is
  'Identificativo del servizio di ricezione. UNIQUE perche'' una consegna ritentata non deve produrre due righe: e'' il freno all''unico varco nuovo aperto verso l''esterno.';
comment on column posta_ricevuta.proposta_conservare is
  'Cosa ne pensa l''AI. Non decide: propone. La riga diventa un documento solo quando Alessio conferma.';

create index if not exists idx_posta_stato on posta_ricevuta(stato, ricevuta_il desc);
create index if not exists idx_posta_ricevuta_il on posta_ricevuta(ricevuta_il);

drop trigger if exists trg_posta_ricevuta_updated_at on posta_ricevuta;
create trigger trg_posta_ricevuta_updated_at before update on posta_ricevuta
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 2. Gli allegati
-- ---------------------------------------------------------------------
-- I file vivono nel bucket `documents`, sotto `posta/`: se poi la mail
-- diventa un documento, il file è già al posto giusto e non va copiato.
-- Copiarlo significherebbe due file identici, e prima o poi due verità.
create table if not exists posta_allegati (
  id           uuid primary key default gen_random_uuid(),
  posta_id     uuid not null references posta_ricevuta(id) on delete cascade,
  file_name    text not null,
  mime         text,
  dimensione   integer,
  storage_path text,
  created_at   timestamptz not null default now()
);

comment on table posta_allegati is
  'Allegati della posta in arrivo. I file stanno nel bucket "documents" sotto posta/: se la mail diventa un documento il file e'' gia'' al posto giusto, senza copie.';

create index if not exists idx_posta_allegati_posta on posta_allegati(posta_id);

alter table posta_allegati enable row level security;
drop policy if exists posta_allegati_titolare on posta_allegati;
create policy posta_allegati_titolare on posta_allegati
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

alter table posta_ricevuta enable row level security;
drop policy if exists posta_ricevuta_titolare on posta_ricevuta;
create policy posta_ricevuta_titolare on posta_ricevuta
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ---------------------------------------------------------------------
-- 3. Per quanto tempo si tiene ciò che non è stato archiviato
-- ---------------------------------------------------------------------
alter table service_settings
  add column if not exists mesi_conservazione_posta integer not null default 3;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'service_settings_posta_check') then
    alter table service_settings add constraint service_settings_posta_check
      check (mesi_conservazione_posta between 1 and 120);
  end if;
end $$;

comment on column service_settings.mesi_conservazione_posta is
  'Dopo quanti mesi si cancella la posta che NON e'' diventata un documento. Tre di partenza: e'' una sala d''aspetto, non un archivio.';

create or replace function pulisci_posta_scaduta()
returns table (posta_cancellate integer)
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_mesi integer;
  n      integer;
begin
  select mesi_conservazione_posta into v_mesi from service_settings where id = 1;
  if v_mesi is null then
    v_mesi := 3;
  end if;

  -- Solo ciò che non è stato archiviato. Una mail diventata documento
  -- resta finché resta il documento: quella l'ha voluta Alessio.
  with tolte as (
    delete from posta_ricevuta
     where stato in ('da_leggere', 'proposta', 'scartata')
       and ricevuta_il < now() - make_interval(months => v_mesi)
    returning 1
  )
  select count(*) into n from tolte;

  insert into stato_lavori (nome, ultimo_successo)
  values ('pulizia_posta', now())
  on conflict (nome) do update set ultimo_successo = excluded.ultimo_successo;

  return query select n;
end
$funzione$;

comment on function pulisci_posta_scaduta() is
  'Cancella la posta non archiviata piu'' vecchia di service_settings.mesi_conservazione_posta. Nessuna copia nel registro delle cancellazioni: il mittente non ha chiesto di stare qui.';

revoke all on function pulisci_posta_scaduta() from public, anon, authenticated;

-- La posta non passa dal registro delle cancellazioni: quel registro
-- conserva una copia integrale della riga, e qui la riga contiene
-- l'indirizzo e il testo di un estraneo. Cancellare per privacy e
-- registrare la cancellazione sono in tensione — stessa scelta fatta per
-- le richieste dei clienti il 10/08.
drop trigger if exists trg_log_delete_posta on posta_ricevuta;

-- Il lavoro notturno, subito dopo quello dei dati clienti.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('pulizia-posta-scaduta')
      where exists (select 1 from cron.job where jobname = 'pulizia-posta-scaduta');
    perform cron.schedule('pulizia-posta-scaduta', '45 4 * * *',
      $cron$select pulisci_posta_scaduta();$cron$);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_id uuid;
  n    integer;
begin
  -- La sala d'aspetto accetta un messaggio e ne rifiuta il doppione.
  insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto)
  values ('PROVA-MIGRAZIONE-1', 'info@borgo58.it', 'prova@example.invalid', 'prova')
  returning id into v_id;

  begin
    insert into posta_ricevuta (messaggio_id, casella) values ('PROVA-MIGRAZIONE-1', 'info@borgo58.it');
    raise exception 'Lo stesso messaggio e'' entrato due volte: una consegna ritentata creerebbe doppioni.';
  exception when unique_violation then
    null; -- è il comportamento voluto
  end;

  -- Gli allegati se ne vanno con la mail.
  insert into posta_allegati (posta_id, file_name) values (v_id, 'finto.pdf');
  delete from posta_ricevuta where id = v_id;
  select count(*) into n from posta_allegati where posta_id = v_id;
  if n <> 0 then
    raise exception 'Cancellata la mail, sono rimasti % allegati orfani.', n;
  end if;

  -- E non ha lasciato copie con dentro il mittente.
  select count(*) into n from deleted_records
   where table_name = 'posta_ricevuta' and record_id = v_id::text;
  if n <> 0 then
    raise exception 'La mail cancellata ha lasciato una copia nel registro: dentro c''e'' l''indirizzo di un estraneo.';
  end if;

  -- La regola di conservazione esiste ed è sensata.
  select mesi_conservazione_posta into n from service_settings where id = 1;
  if n is null or n < 1 then
    raise exception 'La conservazione della posta non e'' stata scritta nelle impostazioni.';
  end if;

  -- Nessuno può eseguire la pulizia dall'esterno.
  if has_function_privilege('anon', 'pulisci_posta_scaduta()', 'execute')
     or has_function_privilege('authenticated', 'pulisci_posta_scaduta()', 'execute') then
    raise exception 'La pulizia della posta e'' eseguibile da un ruolo applicativo.';
  end if;

  -- Solo il titolare vede la posta.
  select count(*) into n from pg_policies
   where tablename in ('posta_ricevuta', 'posta_allegati');
  if n <> 2 then
    raise exception 'Le regole di accesso alla posta sono %, dovevano essere 2.', n;
  end if;

  select count(*) into n from posta_ricevuta where messaggio_id like 'PROVA-MIGRAZIONE%';
  if n <> 0 then
    raise exception 'La prova ha lasciato % righe nel database.', n;
  end if;

  raise notice 'Posta in arrivo: sala d''aspetto pronta, conservazione % mesi, visibile al solo titolare.',
    (select mesi_conservazione_posta from service_settings where id = 1);
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260812000001', 'posta_in_arrivo')
on conflict (version) do nothing;

select
  (select mesi_conservazione_posta from service_settings where id = 1) as mesi_di_conservazione,
  (select count(*) from posta_ricevuta)                                as posta_in_attesa,
  (select count(*) from cron.job where jobname = 'pulizia-posta-scaduta') as lavoro_notturno;
