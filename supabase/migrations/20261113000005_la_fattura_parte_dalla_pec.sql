-- =====================================================================
-- LA FATTURA PARTE DALLA PEC (13/11/2026) — pezzo 3 di 5
-- =====================================================================
--
-- Piano approvato da Alessio il 13/11 (PIANO_fatture_emesse_13-11.md),
-- via al pezzo 3 dato da Alessio («Si parti»).
--
-- La fattura parte dalla PEC di Borgo 58 verso lo SdI. La spedisce la
-- funzione `fattura-spedisci`; qui c'è quello che le serve nel database:
--
--   1. `service_settings.sdi_pec`: l'indirizzo PEC dello SdI. La PRIMA
--      volta si scrive a sdi01@pec.fatturapa.it; lo SdI risponde da un
--      indirizzo suo (sdiNN) che d'ora in poi va usato — lo aggiornerà il
--      pezzo 4, quando legge le ricevute.
--   2. `fatture_emesse_invii`: ogni file spedito (o provato a spedire),
--      col suo PROGRESSIVO. ⚠️ Lo SdI scarta un nome di file che ha già
--      visto, anche per il rinvio di una fattura scartata: ogni invio ha
--      un progressivo suo, da una sequenza, mai riusato. Qui resta anche
--      l'XML esatto che è partito.
--   3. `prepara_invio_fattura()`: numera la bozza (con `emetti_fattura`),
--      o riapre una «da inviare» / «scartata» ricalcolando i totali, e
--      apre l'invio col progressivo nuovo. Tutto o niente.
--   4. `chiudi_invio_fattura()`: com'è andata. Partito → la fattura è
--      «inviata»; fallito → resta «da inviare», col numero, e si rimanda.
--   5. `sblocca_invio_fattura()`: un invio rimasto «in partenza» (la PEC
--      si è interrotta DOPO aver ricevuto il messaggio, o la funzione si è
--      fermata) non si rimanda da solo — sarebbe un doppione allo SdI. Il
--      titolare guarda nella posta inviata della PEC e dice com'è andata.
--
-- ⚠️ SU PROVA E A CASA NON PARTE NIENTE: la funzione spedisce davvero solo
--    quando gira sul progetto di produzione. Altrove l'invio è «simulato»
--    e lo dice. Lo decide la funzione dall'ambiente, mai il chiamante.
--
-- Idempotente. Si auto-registra. Verifica annullata, zero residui.

-- ---------------------------------------------------------------------
-- 1. L'INDIRIZZO DELLO SDI
-- ---------------------------------------------------------------------
alter table service_settings add column if not exists sdi_pec text not null default 'sdi01@pec.fatturapa.it';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'service_settings_sdi_pec_forma') then
    alter table service_settings add constraint service_settings_sdi_pec_forma
      check (sdi_pec ~* '^sdi[0-9]{2}@pec\.fatturapa\.it$');
  end if;
end $$;

comment on constraint service_settings_sdi_pec_forma on service_settings is
  'L''indirizzo dello SdI è della forma sdiNN@pec.fatturapa.it (per esempio sdi01@pec.fatturapa.it).';
comment on column service_settings.sdi_pec is
  'La PEC dello SdI a cui mandare le fatture ai clienti (13/11/2026). La prima volta sdi01; dopo, quella da cui lo SdI ha risposto.';

-- ---------------------------------------------------------------------
-- 2. GLI INVII
-- ---------------------------------------------------------------------
create sequence if not exists fatture_emesse_invii_progressivo_seq;

create table if not exists fatture_emesse_invii (
  id           uuid primary key default gen_random_uuid(),
  fattura_id   uuid not null,
  progressivo  text not null,
  nome_file    text not null,
  destinatario text not null,
  stato        text not null default 'in_partenza',
  xml          text,
  errore       text,
  creato_il    timestamptz not null default now(),
  concluso_il  timestamptz,
  constraint fatture_emesse_invii_fattura_id_fkey foreign key (fattura_id) references fatture_emesse(id) on delete restrict,
  constraint fatture_emesse_invii_progressivo_unico unique (progressivo),
  constraint fatture_emesse_invii_nome_file_unico unique (nome_file),
  constraint fatture_emesse_invii_progressivo_forma check (progressivo ~ '^[0-9A-Z]{5}$'),
  constraint fatture_emesse_invii_stato_check check (stato = any (array['in_partenza', 'partito', 'simulato', 'fallito'])),
  constraint fatture_emesse_invii_concluso check ((stato = 'in_partenza') = (concluso_il is null))
);

create index if not exists fatture_emesse_invii_fattura_idx on fatture_emesse_invii (fattura_id, creato_il desc);

comment on table fatture_emesse_invii is
  'Ogni file di fattura ai clienti spedito allo SdI, o provato a spedire (13/11/2026): progressivo e nome del file (mai riusati: lo SdI scarta un nome già visto), indirizzo, XML esatto partito, esito. Si scrive solo da prepara_invio_fattura e chiudi_invio_fattura.';
comment on constraint fatture_emesse_invii_fattura_id_fkey on fatture_emesse_invii is
  'L''invio è di una fattura che non esiste, oppure si sta cancellando una fattura che ha già provato a partire.';
comment on constraint fatture_emesse_invii_progressivo_unico on fatture_emesse_invii is
  'Questo progressivo d''invio è già stato usato: lo SdI scarterebbe il file.';
comment on constraint fatture_emesse_invii_nome_file_unico on fatture_emesse_invii is
  'Questo nome di file è già partito: lo SdI lo scarterebbe come doppione.';
comment on constraint fatture_emesse_invii_progressivo_forma on fatture_emesse_invii is
  'Il progressivo d''invio sono 5 lettere maiuscole o cifre.';
comment on constraint fatture_emesse_invii_stato_check on fatture_emesse_invii is
  'Un invio è in partenza, partito, simulato (su Prova o a casa) o fallito.';
comment on constraint fatture_emesse_invii_concluso on fatture_emesse_invii is
  'Un invio in partenza non ha ancora l''ora di fine; uno concluso sì.';

alter table fatture_emesse_invii enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fatture_emesse_invii'
                  and policyname = 'fatture_emesse_invii_titolare_legge') then
    create policy fatture_emesse_invii_titolare_legge on fatture_emesse_invii
      for select using ((select is_titolare()));
  end if;
end $$;
-- Si legge e basta: le scritture passano dalle due funzioni qui sotto.
revoke all on table fatture_emesse_invii from public, anon, authenticated;
grant select on table fatture_emesse_invii to authenticated;
revoke all on sequence fatture_emesse_invii_progressivo_seq from public, anon, authenticated;

-- Un numero in base 36 su 5 caratteri (0 → 00000, 36 → 00010).
create or replace function progressivo_invio_fattura(p_n bigint)
returns text
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_cifre constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  v_n     bigint := p_n;
  v_s     text := '';
begin
  if p_n is null or p_n < 0 or p_n >= 60466176 then  -- 36^5
    raise exception 'Il progressivo d''invio è finito (oltre 60 milioni di file).' using errcode = 'P0001';
  end if;
  for i in 1..5 loop
    v_s := substr(v_cifre, (v_n % 36)::integer + 1, 1) || v_s;
    v_n := v_n / 36;
  end loop;
  return v_s;
end;
$fn$;

comment on function progressivo_invio_fattura(bigint) is
  'Il progressivo d''invio di una fattura elettronica: un numero in base 36 su 5 caratteri, come chiede il nome del file dello SdI (13/11/2026).';

-- ---------------------------------------------------------------------
-- 3. PREPARARE L'INVIO
-- ---------------------------------------------------------------------
create or replace function prepara_invio_fattura(p_fattura uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_f          fatture_emesse%rowtype;
  v_e          entities%rowtype;
  v_imponibile numeric(12,2);
  v_imposta    numeric(12,2);
  v_prog       text;
  v_nome       text;
  v_dest       text;
  v_invio      uuid;
  v_vecchio    fatture_emesse_invii%rowtype;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare manda le fatture.' using errcode = '42501';
  end if;

  select * into v_f from fatture_emesse where id = p_fattura for update;
  if not found then
    raise exception 'Questa fattura non c''è più: rileggi la pagina.' using errcode = 'P0002';
  end if;
  if v_f.stato not in ('bozza', 'da_inviare', 'scartata') then
    raise exception 'La fattura % è già partita: aspetta la risposta dello SdI.', v_f.numero || '/' || v_f.anno
      using errcode = 'P0001';
  end if;

  -- Due «Manda» insieme non partono due volte.
  -- ⚠️ E UN INVIO RIMASTO A METÀ NON SI CHIUDE DA SOLO: la funzione può
  --    essersi fermata DOPO che la mail era partita. Rimandare farebbe un
  --    doppione allo SdI. Si ferma tutto e si guarda nella posta inviata
  --    della PEC (la ricevuta dello SdI, col pezzo 4, lo chiuderà da sé).
  select * into v_vecchio from fatture_emesse_invii
   where fattura_id = p_fattura and stato = 'in_partenza'
   order by creato_il desc limit 1;
  if found then
    if v_vecchio.creato_il > now() - interval '10 minutes' then
      raise exception 'Questa fattura sta già partendo: aspetta un minuto e rileggi la pagina.' using errcode = 'P0001';
    end if;
    raise exception 'Un invio di questa fattura (file %) si è fermato a metà: prima di rimandarla bisogna guardare nella posta inviata della PEC se è partito. Chiedi all''assistenza.',
      v_vecchio.nome_file using errcode = 'P0001';
  end if;

  if v_f.stato = 'bozza' then
    -- Lo SdI scarta una fattura con la data nel futuro.
    if v_f.data > oggi_a_roma() then
      raise exception 'La data della fattura (%) è nel futuro: lo SdI la scarterebbe. Metti la data di oggi o di prima.',
        to_char(v_f.data, 'DD/MM/YYYY') using errcode = 'P0001';
    end if;
    perform emetti_fattura(p_fattura);
  elsif v_f.stato = 'scartata' then
    -- Dopo lo scarto si sono potute correggere le righe: i totali si rifanno.
    select coalesce(sum(t.imponibile), 0), coalesce(sum(t.imposta), 0)
      into v_imponibile, v_imposta
      from totali_fattura(p_fattura) t;
    if v_imponibile + v_imposta <= 0 then
      raise exception 'Il totale della fattura deve essere più di zero.' using errcode = 'P0001';
    end if;
    update fatture_emesse
       set stato = 'da_inviare', imponibile = v_imponibile, imposta = v_imposta,
           totale = v_imponibile + v_imposta
     where id = p_fattura;
  end if;

  select * into v_f from fatture_emesse where id = p_fattura;
  select * into v_e from entities where id = v_f.entity_id;
  select sdi_pec into v_dest from service_settings where id = 1;
  if v_dest is null then
    raise exception 'Mancano le impostazioni del servizio: non so a che indirizzo dello SdI scrivere.' using errcode = 'P0001';
  end if;

  v_prog := progressivo_invio_fattura(nextval('fatture_emesse_invii_progressivo_seq'));
  v_nome := 'IT' || v_e.vat_number || '_' || v_prog || '.xml';
  insert into fatture_emesse_invii (fattura_id, progressivo, nome_file, destinatario)
  values (p_fattura, v_prog, v_nome, v_dest)
  returning id into v_invio;

  return jsonb_build_object(
    'invio_id', v_invio,
    'progressivo', v_prog,
    'nome_file', v_nome,
    'destinatario', v_dest,
    'numero', v_f.numero,
    'anno', v_f.anno,
    'totale', v_f.totale);
end;
$fn$;

comment on function prepara_invio_fattura(uuid) is
  'Prepara la spedizione di una fattura ai clienti (13/11/2026): numera la bozza con emetti_fattura (rifiuta la data nel futuro), o riprende una da inviare o scartata rifacendo i totali, e apre un invio col progressivo nuovo. Un solo invio in partenza per volta. La chiama la funzione fattura-spedisci.';

revoke all on function prepara_invio_fattura(uuid) from public, anon;
grant execute on function prepara_invio_fattura(uuid) to authenticated;
revoke all on function progressivo_invio_fattura(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. COM'È ANDATA
-- ---------------------------------------------------------------------
create or replace function chiudi_invio_fattura(p_invio uuid, p_esito text, p_xml text, p_errore text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_i fatture_emesse_invii%rowtype;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare manda le fatture.' using errcode = '42501';
  end if;
  if p_esito is null or p_esito not in ('partito', 'simulato', 'fallito') then
    raise exception 'L''esito di un invio è partito, simulato o fallito.' using errcode = 'P0001';
  end if;
  if p_esito <> 'fallito' and nullif(btrim(p_xml), '') is null then
    raise exception 'Un invio partito deve lasciare il file che è partito.' using errcode = 'P0001';
  end if;

  select * into v_i from fatture_emesse_invii where id = p_invio for update;
  if not found then
    raise exception 'Questo invio non esiste.' using errcode = 'P0002';
  end if;
  if v_i.stato <> 'in_partenza' then
    raise exception 'Questo invio è già concluso (%).', v_i.stato using errcode = 'P0001';
  end if;

  update fatture_emesse_invii
     set stato = p_esito, xml = nullif(p_xml, ''), errore = nullif(btrim(p_errore), ''), concluso_il = now()
   where id = p_invio;

  if p_esito <> 'fallito' then
    update fatture_emesse
       set stato = 'inviata', nome_file = v_i.nome_file, inviata_il = now(),
           esito_note = case when p_esito = 'simulato'
                             then 'Invio simulato: su Prova o a casa la fattura non parte davvero.'
                             else null end
     where id = v_i.fattura_id;
  end if;
end;
$fn$;

comment on function chiudi_invio_fattura(uuid, text, text, text) is
  'Chiude un invio di fattura ai clienti (13/11/2026): partito o simulato → la fattura è inviata, col nome del file; fallito → resta da inviare col suo numero, e si rimanda. La chiama la funzione fattura-spedisci.';

revoke all on function chiudi_invio_fattura(uuid, text, text, text) from public, anon;
grant execute on function chiudi_invio_fattura(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. SBLOCCARE UN INVIO RIMASTO A METÀ
-- ---------------------------------------------------------------------
create or replace function sblocca_invio_fattura(p_invio uuid, p_partito boolean)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_i fatture_emesse_invii%rowtype;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare sblocca un invio.' using errcode = '42501';
  end if;
  if p_partito is null then
    raise exception 'Di'' se nella posta inviata della PEC la fattura c''è o no.' using errcode = 'P0001';
  end if;
  select * into v_i from fatture_emesse_invii where id = p_invio for update;
  if not found then
    raise exception 'Questo invio non esiste.' using errcode = 'P0002';
  end if;
  if v_i.stato <> 'in_partenza' then
    raise exception 'Questo invio è già concluso (%).', v_i.stato using errcode = 'P0001';
  end if;
  -- Uno appena partito sta ancora lavorando: non si tocca.
  if v_i.creato_il > now() - interval '10 minutes' then
    raise exception 'Questo invio è partito da meno di 10 minuti: aspetta, potrebbe essere ancora in corso.' using errcode = 'P0001';
  end if;

  update fatture_emesse_invii
     set stato = case when p_partito then 'partito' else 'fallito' end,
         errore = case when p_partito
                       then 'Sbloccato dal titolare: trovato nella posta inviata della PEC.'
                       else 'Sbloccato dal titolare: NON c''è nella posta inviata della PEC.' end,
         concluso_il = now()
   where id = p_invio;
  if p_partito then
    update fatture_emesse
       set stato = 'inviata', nome_file = v_i.nome_file, inviata_il = v_i.creato_il
     where id = v_i.fattura_id;
  end if;
end;
$fn$;

comment on function sblocca_invio_fattura(uuid, boolean) is
  'Sblocca un invio di fattura ai clienti rimasto in partenza da più di 10 minuti (13/11/2026): il titolare ha guardato nella posta inviata della PEC. Partito → la fattura è inviata; non partito → l''invio è fallito e la fattura si può rimandare.';

revoke all on function sblocca_invio_fattura(uuid, boolean) from public, anon;
grant execute on function sblocca_invio_fattura(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione che si annulla
-- ---------------------------------------------------------------------
--   (1) una bozza con la data nel futuro non parte e non prende il numero;
--   (2) prepara: la bozza prende il numero, l'invio il progressivo e il
--       nome giusto, verso sdi01;
--   (3) due «Manda» insieme: il secondo è rifiutato; un invio fermo a
--       metà da più di 10 minuti blocca il rinvio (potrebbe essere partito);
--       il titolare lo sblocca dopo aver guardato la posta inviata;
--   (4) fallito: la fattura resta da inviare col numero; rimandata prende
--       un progressivo NUOVO;
--   (5) partito: la fattura è inviata col nome del file, e non riparte;
--   (6) scartata e corretta: riparte coi totali rifatti, progressivo nuovo;
--   (7) da fuori non si scrive negli invii; lo staff non prepara;
--   (8) il progressivo in base 36; ogni vincolo nuovo ha la sua frase.
do $verifica$
declare
  v_foto      jsonb := foto_righe();
  v_titolare  uuid;
  v_staff     uuid;
  v_srls      uuid;
  v_cli       uuid;
  v_f         uuid;
  v_g         uuid;
  v_p         jsonb;
  v_p2        jsonb;
  v_ok        boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role <> 'titolare' limit 1;
  select id into v_srls from entities where entity_type = 'srls' limit 1;
  if v_titolare is null or v_srls is null then
    raise exception 'VERIFICA: servono un titolare e Borgo 58.';
  end if;

  begin  -- <<< la sotto-transazione che verrà annullata
    update entities set vat_number = '01343950869', legal_name = 'Borgo 58 S.r.l.s.',
           sede_indirizzo = 'Via Prova 58', sede_cap = '84043', sede_comune = 'Agropoli', sede_provincia = 'SA'
     where id = v_srls;
    update service_settings set sdi_pec = 'sdi01@pec.fatturapa.it' where id = 1;

    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;

    insert into clienti_fattura (denominazione, partita_iva, indirizzo, cap, comune, provincia)
    values ('ZZ Ditta della spedizione srl', '01234567897', 'Via Prova 5', '84043', 'Agropoli', 'SA')
    returning id into v_cli;

    -- (1) data nel futuro
    insert into fatture_emesse (entity_id, cliente_id, data) values (v_srls, v_cli, oggi_a_roma() + 1) returning id into v_f;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario)
    values (v_f, 1, 'ZZ Cena', 2, 55.00);
    v_ok := false;
    begin
      perform prepara_invio_fattura(v_f);
    exception when others then
      v_ok := sqlerrm like 'La data della fattura % è nel futuro%';
    end;
    if not v_ok or exists (select 1 from fatture_emesse where id = v_f and numero is not null) then
      raise exception 'VERIFICA (1): una bozza con la data nel futuro è partita o ha preso il numero.';
    end if;
    update fatture_emesse set data = oggi_a_roma() where id = v_f;

    -- (2) prepara
    v_p := prepara_invio_fattura(v_f);
    if (v_p->>'numero')::integer is null
       or v_p->>'progressivo' !~ '^[0-9A-Z]{5}$'
       or v_p->>'nome_file' <> 'IT01343950869_' || (v_p->>'progressivo') || '.xml'
       or v_p->>'destinatario' <> 'sdi01@pec.fatturapa.it'
       or (v_p->>'totale')::numeric <> 110.00
       or not exists (select 1 from fatture_emesse where id = v_f and stato = 'da_inviare') then
      raise exception 'VERIFICA (2): la preparazione non ha dato numero, progressivo, nome o indirizzo giusti: %', v_p;
    end if;

    -- (3) due insieme
    v_ok := false;
    begin
      perform prepara_invio_fattura(v_f);
    exception when others then
      v_ok := sqlerrm like 'Questa fattura sta già partendo%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (3): un secondo «Manda» è passato mentre il primo era in partenza.';
    end if;
    reset role;
    update fatture_emesse_invii set creato_il = now() - interval '1 hour' where id = (v_p->>'invio_id')::uuid;
    set local role authenticated;
    v_ok := false;
    begin
      perform prepara_invio_fattura(v_f);
    exception when others then
      v_ok := sqlerrm like 'Un invio di questa fattura (file %) si è fermato a metà%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (3): un invio fermo a metà non ha bloccato il rinvio.';
    end if;
    -- … e il titolare lo sblocca dopo aver guardato la posta inviata: «non
    --    c'è» → fallito, e la fattura si rimanda (punto 4 qui sotto lo fa
    --    con un invio nuovo). Prima, uno sblocco di un invio concluso no.
    perform sblocca_invio_fattura((v_p->>'invio_id')::uuid, false);
    if not exists (select 1 from fatture_emesse_invii where id = (v_p->>'invio_id')::uuid and stato = 'fallito') then
      raise exception 'VERIFICA (3): lo sblocco «non è partita» non ha chiuso l''invio come fallito.';
    end if;
    v_ok := false;
    begin
      perform sblocca_invio_fattura((v_p->>'invio_id')::uuid, true);
    exception when others then
      v_ok := sqlerrm like 'Questo invio è già concluso%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (3): si è sbloccato un invio già concluso.';
    end if;

    -- (4) fallito (già chiuso dallo sblocco qui sopra), poi rimandata con
    --     un progressivo nuovo
    if not exists (select 1 from fatture_emesse where id = v_f and stato = 'da_inviare' and numero = (v_p->>'numero')::integer) then
      raise exception 'VERIFICA (4): dopo un invio fallito la fattura non è rimasta da inviare col suo numero.';
    end if;
    v_p2 := prepara_invio_fattura(v_f);
    if v_p2->>'progressivo' = v_p->>'progressivo' or v_p2->>'numero' <> v_p->>'numero' then
      raise exception 'VERIFICA (4): il rinvio ha riusato il progressivo o ha cambiato numero.';
    end if;

    -- (5) partito
    perform chiudi_invio_fattura((v_p2->>'invio_id')::uuid, 'partito', '<ZZ/>', null);
    if not exists (select 1 from fatture_emesse where id = v_f and stato = 'inviata'
                     and nome_file = v_p2->>'nome_file' and inviata_il is not null) then
      raise exception 'VERIFICA (5): dopo l''invio la fattura non è inviata col nome del file.';
    end if;
    v_ok := false;
    begin
      perform prepara_invio_fattura(v_f);
    exception when others then
      v_ok := sqlerrm like 'La fattura % è già partita%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (5): una fattura già inviata è ripartita.';
    end if;
    v_ok := false;
    begin
      perform chiudi_invio_fattura((v_p2->>'invio_id')::uuid, 'partito', '<ZZ/>', null);
    exception when others then
      v_ok := sqlerrm like 'Questo invio è già concluso%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (5): un invio concluso si è chiuso due volte.';
    end if;

    -- (6) scartata, corretta, rimandata coi totali rifatti
    reset role;
    update fatture_emesse set stato = 'scartata' where id = v_f;  -- lo farà il pezzo 4
    set local role authenticated;
    delete from fatture_emesse_righe where fattura_id = v_f;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario)
    values (v_f, 1, 'ZZ Cena corretta', 2, 60.50);
    v_p := prepara_invio_fattura(v_f);
    if (v_p->>'totale')::numeric <> 121.00 or not exists (select 1 from fatture_emesse where id = v_f and stato = 'da_inviare' and totale = 121.00 and imponibile = 110.00) then
      raise exception 'VERIFICA (6): la scartata corretta non ha i totali rifatti (2 × 60,50 IVA inclusa = 110 + 11).';
    end if;
    if v_p->>'progressivo' in (v_p2->>'progressivo') then
      raise exception 'VERIFICA (6): il rinvio dopo lo scarto ha riusato un progressivo.';
    end if;

    -- (7) da fuori non si scrive negli invii; lo staff non prepara
    v_ok := false;
    begin
      update fatture_emesse_invii set stato = 'partito' where id = (v_p->>'invio_id')::uuid;
    exception when insufficient_privilege then
      v_ok := true;
    end;
    if not v_ok then
      raise exception 'VERIFICA (7): da fuori si è scritto negli invii.';
    end if;
    if v_staff is not null then
      insert into fatture_emesse (entity_id, cliente_id) values (v_srls, v_cli) returning id into v_g;
      perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
      v_ok := false;
      begin
        perform prepara_invio_fattura(v_g);
      exception when insufficient_privilege then
        v_ok := true;
      end;
      if not v_ok then
        raise exception 'VERIFICA (7): lo staff ha preparato un invio.';
      end if;
      perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    end if;
    reset role;

    -- (8) base 36 e frasi
    if progressivo_invio_fattura(0) <> '00000' or progressivo_invio_fattura(36) <> '00010'
       or progressivo_invio_fattura(60466175) <> 'ZZZZZ' then
      raise exception 'VERIFICA (8): il progressivo in base 36 è sbagliato.';
    end if;
    if exists (select 1 from vincoli_senza_frase() v
                where v.tabella = 'fatture_emesse_invii' or v.conname = 'service_settings_sdi_pec_forma') then
      raise exception 'VERIFICA (8): un vincolo nuovo è senza frase.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della spedizione delle fatture');

  raise notice 'Fatto: la bozza prende il numero e l''invio il suo progressivo; due invii insieme no; un fallito resta da inviare e riparte con un progressivo nuovo; un partito è inviato e non riparte; la scartata corretta riparte coi totali rifatti; da fuori e lo staff non scrivono. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261113000005', 'la_fattura_parte_dalla_pec')
on conflict (version) do nothing;
