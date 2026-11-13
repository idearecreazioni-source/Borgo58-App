-- =====================================================================
-- LE FATTURE AI CLIENTI HANNO UN ARCHIVIO (13/11/2026) — pezzo 1 di 5
-- =====================================================================
--
-- Piano approvato da Alessio il 13/11/2026 («Sì, approvo»):
-- Ricerche attrezzatura/PIANO_fatture_emesse_13-11.md. work emetterà le
-- fatture ai clienti e le spedirà dalla PEC borgo58@pec.it allo SDI
-- (abbonamento Aruba FE Base: niente invio da programmi). Solo la S.r.l.s.
-- emette. Nel 2026 nessuna fattura: la prima sarà la 1/2027.
--
-- QUESTO PEZZO È SOLO L'ARCHIVIO — nessuna schermata, nessuna spedizione:
--   1. i dati che mancano alla società per stare in fattura (sede, REA,
--      capitale, socio unico, PEC, IBAN) — colonne nuove su `entities`,
--      tutte facoltative: le compila Alessio una volta;
--   2. `clienti_fattura`: chi chiede fattura, con i dati fiscali (P.IVA o
--      codice fiscale, indirizzo, codice destinatario o PEC). Tabella a
--      parte e non colonne su `customers`, perché `customers` ha il
--      telefono come chiave e una ditta che chiede fattura spesso non è
--      «il cliente del tavolo» (si collega, se c'è, con `customer_id`);
--   3. `fatture_emesse` + `fatture_emesse_righe`: la fattura, le righe con
--      l'aliquota IVA (in PUNTI, 10 e non 0,10) o la natura dell'esenzione;
--   4. `emetti_fattura()`: dà il numero. Il numero NON si dà alla bozza ma
--      quando la fattura esce: così una bozza buttata non lascia un buco.
--      Progressivo per società e per anno, sotto lucchetto, e la data non
--      può essere prima dell'ultima fattura già numerata dello stesso anno
--      (la numerazione deve seguire le date);
--   5. le guardie: numero, anno, data e società non cambiano più dopo il
--      numero; una fattura numerata non si cancella (si storna con una
--      nota di credito — un pezzo futuro); le righe si toccano solo in
--      bozza o dopo uno scarto dello SDI (che permette di rimandare la
--      stessa fattura corretta, con lo stesso numero e la stessa data).
--
-- ⚠️ SOLO IL TITOLARE, su tutte e tre le tabelle (stessa forma del piano
--    dell'investimento, 20261107000001): RLS «for all» con is_titolare().
-- ⚠️ I vocabolari chiusi (stato, modalità di pagamento, natura) hanno il
--    loro specchio in src/lib/constants.js, iscritto in
--    src/lib/calcoli/vocabolari.js.
--
-- Idempotente. Si auto-registra. Verifica annullata, zero residui.

-- ---------------------------------------------------------------------
-- 1. LA SOCIETÀ: i dati che una fattura pretende
-- ---------------------------------------------------------------------
alter table entities add column if not exists sede_indirizzo   text;
alter table entities add column if not exists sede_cap         text;
alter table entities add column if not exists sede_comune      text;
alter table entities add column if not exists sede_provincia   text;
alter table entities add column if not exists sede_nazione     text not null default 'IT';
alter table entities add column if not exists rea_ufficio      text;
alter table entities add column if not exists rea_numero       text;
alter table entities add column if not exists capitale_sociale numeric(12,2);
alter table entities add column if not exists socio_unico      text;
alter table entities add column if not exists pec              text;
alter table entities add column if not exists iban             text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'entities_sede_cap_forma') then
    alter table entities add constraint entities_sede_cap_forma
      check (sede_cap is null or sede_cap ~ '^[0-9]{5}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'entities_sede_provincia_forma') then
    alter table entities add constraint entities_sede_provincia_forma
      check (sede_provincia is null or sede_provincia ~ '^[A-Z]{2}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'entities_sede_nazione_forma') then
    alter table entities add constraint entities_sede_nazione_forma
      check (sede_nazione ~ '^[A-Z]{2}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'entities_rea_ufficio_forma') then
    alter table entities add constraint entities_rea_ufficio_forma
      check (rea_ufficio is null or rea_ufficio ~ '^[A-Z]{2}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'entities_capitale_non_negativo') then
    alter table entities add constraint entities_capitale_non_negativo
      check (capitale_sociale is null or capitale_sociale >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'entities_socio_unico_check') then
    alter table entities add constraint entities_socio_unico_check
      check (socio_unico is null or socio_unico = any (array['SU', 'SM']));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'entities_pec_forma') then
    alter table entities add constraint entities_pec_forma
      check (pec is null or pec ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'entities_iban_forma') then
    alter table entities add constraint entities_iban_forma
      check (iban is null or iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$');
  end if;
end $$;

comment on constraint entities_sede_cap_forma on entities is
  'Il CAP della sede sono 5 cifre (per esempio 84043).';
comment on constraint entities_sede_provincia_forma on entities is
  'La provincia della sede è la sigla di due lettere maiuscole (per esempio SA).';
comment on constraint entities_sede_nazione_forma on entities is
  'La nazione della sede è la sigla di due lettere maiuscole (IT per l''Italia).';
comment on constraint entities_rea_ufficio_forma on entities is
  'L''ufficio del REA è la sigla della provincia della Camera di commercio, due lettere maiuscole (per esempio SA).';
comment on constraint entities_capitale_non_negativo on entities is
  'Il capitale sociale non può essere negativo.';
comment on constraint entities_socio_unico_check on entities is
  'Socio unico si indica con SU (un solo socio) o SM (più soci).';
comment on constraint entities_pec_forma on entities is
  'La PEC della società non sembra un indirizzo email: controlla che ci sia una sola @ e il dominio (per esempio borgo58@pec.it).';
comment on constraint entities_iban_forma on entities is
  'L''IBAN va scritto tutto attaccato e in maiuscolo (per esempio IT60X0542811101000000123456).';

-- ---------------------------------------------------------------------
-- 2. CHI CHIEDE FATTURA
-- ---------------------------------------------------------------------
create table if not exists clienti_fattura (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid,
  denominazione       text,
  nome                text,
  cognome             text,
  partita_iva         text,
  codice_fiscale      text,
  indirizzo           text not null,
  cap                 text not null,
  comune              text not null,
  provincia           text,
  nazione             text not null default 'IT',
  codice_destinatario text,
  pec                 text,
  email               text,
  note                text,
  attivo              boolean not null default true,
  creato_il           timestamptz not null default now(),
  aggiornato_il       timestamptz not null default now(),
  constraint clienti_fattura_customer_id_fkey foreign key (customer_id) references customers(id) on delete set null,
  constraint clienti_fattura_con_un_nome check (
    nullif(btrim(denominazione), '') is not null
    or (nullif(btrim(nome), '') is not null and nullif(btrim(cognome), '') is not null)),
  constraint clienti_fattura_con_un_codice check (
    nullif(btrim(partita_iva), '') is not null or nullif(btrim(codice_fiscale), '') is not null),
  constraint clienti_fattura_partita_iva_forma check (
    partita_iva is null or nazione <> 'IT' or partita_iva ~ '^[0-9]{11}$'),
  constraint clienti_fattura_codice_fiscale_forma check (
    codice_fiscale is null or codice_fiscale ~ '^([A-Z0-9]{16}|[0-9]{11})$'),
  constraint clienti_fattura_cap_forma check (nazione <> 'IT' or cap ~ '^[0-9]{5}$'),
  constraint clienti_fattura_provincia_forma check (provincia is null or provincia ~ '^[A-Z]{2}$'),
  constraint clienti_fattura_nazione_forma check (nazione ~ '^[A-Z]{2}$'),
  constraint clienti_fattura_codice_destinatario_forma check (
    codice_destinatario is null or codice_destinatario ~ '^[A-Z0-9]{7}$'),
  constraint clienti_fattura_pec_forma check (pec is null or pec ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$')
);

comment on table clienti_fattura is
  'Chi chiede fattura, con i dati fiscali (13/11/2026). A parte da `customers`, che ha il telefono come chiave: una ditta che chiede fattura spesso non è «il cliente del tavolo»; se lo è, si collega con customer_id. Senza codice destinatario né PEC la fattura va col codice 0000000 e il cliente la trova nel suo cassetto fiscale.';
comment on constraint clienti_fattura_customer_id_fkey on clienti_fattura is
  'Il cliente collegato non esiste più nell''anagrafica dei clienti del locale.';
comment on constraint clienti_fattura_con_un_nome on clienti_fattura is
  'Serve il nome di chi riceve la fattura: la ragione sociale per una ditta, oppure nome e cognome per una persona.';
comment on constraint clienti_fattura_con_un_codice on clienti_fattura is
  'Per fare la fattura serve la partita IVA del cliente oppure il suo codice fiscale.';
comment on constraint clienti_fattura_partita_iva_forma on clienti_fattura is
  'La partita IVA italiana sono 11 cifre, senza «IT» davanti e senza spazi.';
comment on constraint clienti_fattura_codice_fiscale_forma on clienti_fattura is
  'Il codice fiscale sono 16 caratteri maiuscoli (persona) oppure 11 cifre (ditta), senza spazi.';
comment on constraint clienti_fattura_cap_forma on clienti_fattura is
  'Il CAP italiano sono 5 cifre.';
comment on constraint clienti_fattura_provincia_forma on clienti_fattura is
  'La provincia è la sigla di due lettere maiuscole (per esempio SA).';
comment on constraint clienti_fattura_nazione_forma on clienti_fattura is
  'La nazione è la sigla di due lettere maiuscole (IT per l''Italia).';
comment on constraint clienti_fattura_codice_destinatario_forma on clienti_fattura is
  'Il codice destinatario sono 7 caratteri, lettere maiuscole e cifre (per esempio KRRH6B9). Se il cliente non lo sa, lascialo vuoto.';
comment on constraint clienti_fattura_pec_forma on clienti_fattura is
  'La PEC del cliente non sembra un indirizzo email: controlla che ci sia una sola @ e il dominio.';

-- ---------------------------------------------------------------------
-- 3. LE FATTURE E LE LORO RIGHE
-- ---------------------------------------------------------------------
create table if not exists fatture_emesse (
  id                  uuid primary key default gen_random_uuid(),
  entity_id           uuid not null,
  cliente_id          uuid not null,
  data                date not null default current_date,
  anno                integer generated always as (extract(year from data)::integer) stored,
  numero              integer,
  stato               text not null default 'bozza',
  order_id            uuid,
  preventivo_id       uuid,
  modalita_pagamento  text not null default 'MP05',
  causale             text,
  imponibile          numeric(12,2),
  imposta             numeric(12,2),
  totale              numeric(12,2),
  emessa_il           timestamptz,
  nome_file           text,
  identificativo_sdi  text,
  inviata_il          timestamptz,
  esito_il            timestamptz,
  esito_note          text,
  creato_il           timestamptz not null default now(),
  aggiornato_il       timestamptz not null default now(),
  constraint fatture_emesse_entity_id_fkey foreign key (entity_id) references entities(id),
  constraint fatture_emesse_cliente_id_fkey foreign key (cliente_id) references clienti_fattura(id),
  constraint fatture_emesse_order_id_fkey foreign key (order_id) references orders(id) on delete set null,
  constraint fatture_emesse_preventivo_id_fkey foreign key (preventivo_id) references preventivi(id) on delete set null,
  constraint fatture_emesse_stato_check check (stato = any (array[
    'bozza', 'da_inviare', 'inviata', 'consegnata', 'messa_a_disposizione', 'scartata'])),
  constraint fatture_emesse_modalita_pagamento_check check (modalita_pagamento = any (array[
    'MP01', 'MP02', 'MP05', 'MP08'])),
  constraint fatture_emesse_numero_quando_esce check ((stato = 'bozza') = (numero is null)),
  constraint fatture_emesse_numero_positivo check (numero is null or numero > 0),
  constraint fatture_emesse_numero_unico unique (entity_id, anno, numero)
);

comment on table fatture_emesse is
  'Le fatture che work emette ai clienti (13/11/2026). Il numero si dà quando la fattura esce (emetti_fattura), non alla bozza: una bozza buttata non lascia buchi. Progressivo per società e per anno.';
comment on constraint fatture_emesse_entity_id_fkey on fatture_emesse is
  'La società che emette la fattura non esiste.';
comment on constraint fatture_emesse_cliente_id_fkey on fatture_emesse is
  'Il cliente della fattura non esiste, oppure ha delle fatture e non si può cancellare: disattivalo invece.';
comment on constraint fatture_emesse_order_id_fkey on fatture_emesse is
  'Il conto del tavolo collegato alla fattura non esiste.';
comment on constraint fatture_emesse_preventivo_id_fkey on fatture_emesse is
  'Il preventivo collegato alla fattura non esiste.';
comment on constraint fatture_emesse_stato_check on fatture_emesse is
  'Una fattura è in bozza, da inviare, inviata, consegnata, messa a disposizione oppure scartata dallo SDI.';
comment on constraint fatture_emesse_modalita_pagamento_check on fatture_emesse is
  'Il pagamento della fattura è in contanti, assegno, bonifico oppure carta.';
comment on constraint fatture_emesse_numero_quando_esce on fatture_emesse is
  'Il numero lo ha solo una fattura uscita dalla bozza: si dà con «Emetti», non a mano.';
comment on constraint fatture_emesse_numero_positivo on fatture_emesse is
  'Il numero di una fattura parte da 1.';
comment on constraint fatture_emesse_numero_unico on fatture_emesse is
  'Questo numero di fattura è già stato usato quest''anno: i numeri non si ripetono.';

create table if not exists fatture_emesse_righe (
  id              uuid primary key default gen_random_uuid(),
  fattura_id      uuid not null,
  posizione       integer not null,
  descrizione     text not null,
  quantita        numeric(12,3) not null default 1,
  prezzo_unitario numeric(12,2) not null,
  aliquota_iva    numeric(5,2) not null default 10,
  natura          text,
  constraint fatture_emesse_righe_fattura_id_fkey foreign key (fattura_id) references fatture_emesse(id) on delete cascade,
  constraint fatture_emesse_righe_posizione_unica unique (fattura_id, posizione),
  constraint fatture_emesse_righe_posizione_positiva check (posizione > 0),
  constraint fatture_emesse_righe_con_descrizione check (nullif(btrim(descrizione), '') is not null),
  constraint fatture_emesse_righe_quantita_positiva check (quantita > 0),
  constraint fatture_emesse_righe_aliquota_nota check (aliquota_iva in (0, 4, 5, 10, 22)),
  constraint fatture_emesse_righe_natura_check check (natura is null or natura = any (array[
    'N1', 'N2.1', 'N2.2', 'N3.1', 'N3.2', 'N3.3', 'N3.4', 'N3.5', 'N3.6', 'N4', 'N5',
    'N6.1', 'N6.2', 'N6.3', 'N6.4', 'N6.5', 'N6.6', 'N6.7', 'N6.8', 'N6.9', 'N7'])),
  constraint fatture_emesse_righe_natura_solo_senza_iva check ((aliquota_iva = 0) = (natura is not null))
);

comment on table fatture_emesse_righe is
  'Le righe di una fattura ai clienti (13/11/2026). Aliquota IVA in punti (10, non 0,10): 10% di partenza per la somministrazione, finché la commercialista non conferma le eccezioni.';
comment on constraint fatture_emesse_righe_fattura_id_fkey on fatture_emesse_righe is
  'La fattura di questa riga non esiste.';
comment on constraint fatture_emesse_righe_posizione_unica on fatture_emesse_righe is
  'Due righe della stessa fattura non possono avere lo stesso numero di riga.';
comment on constraint fatture_emesse_righe_posizione_positiva on fatture_emesse_righe is
  'Le righe della fattura si contano da 1.';
comment on constraint fatture_emesse_righe_con_descrizione on fatture_emesse_righe is
  'Ogni riga della fattura dice cosa si fattura (per esempio «Cena del 12/01, 4 persone»).';
comment on constraint fatture_emesse_righe_quantita_positiva on fatture_emesse_righe is
  'La quantità di una riga deve essere più di zero.';
comment on constraint fatture_emesse_righe_aliquota_nota on fatture_emesse_righe is
  'L''IVA di una riga è 22, 10, 5, 4 oppure 0 (in percentuale).';
comment on constraint fatture_emesse_righe_natura_check on fatture_emesse_righe is
  'Il motivo per cui una riga è senza IVA va scelto dall''elenco ufficiale (N1…N7).';
comment on constraint fatture_emesse_righe_natura_solo_senza_iva on fatture_emesse_righe is
  'Una riga con IVA a 0 deve dire perché è senza IVA (il motivo, «natura»); una riga con IVA non lo dice.';

create index if not exists fatture_emesse_cliente_idx on fatture_emesse (cliente_id);
create index if not exists fatture_emesse_order_idx on fatture_emesse (order_id) where order_id is not null;
create index if not exists fatture_emesse_preventivo_idx on fatture_emesse (preventivo_id) where preventivo_id is not null;
create index if not exists clienti_fattura_customer_idx on clienti_fattura (customer_id) where customer_id is not null;

-- ---------------------------------------------------------------------
-- 4. LE GUARDIE
-- ---------------------------------------------------------------------
create or replace function fatture_emesse_guardia()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
-- ⚠️ CHI È «DA FUORI» SI RICONOSCE DA current_user, NON DA UN SEGNALE
--    (revisione del 13/11). Un segnale di sessione (set_config) lo può
--    accendere anche il client; current_user invece dentro emetti_fattura
--    (security definer) è il proprietario, e da fuori è `authenticated`.
--    Le funzioni dei pezzi 3 e 4 (spedizione, ricevute dello SDI) saranno
--    anch'esse security definer o service_role: passano per la stessa porta.
as $fn$
declare
  v_da_fuori boolean := current_user in ('authenticated', 'anon');
begin
  if tg_op = 'DELETE' then
    if old.numero is not null then
      raise exception 'La fattura % del % è già uscita e non si cancella: per toglierla serve una nota di credito.',
        old.numero, to_char(old.data, 'DD/MM/YYYY')
        using errcode = 'P0001';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    -- Una fattura nasce bozza, senza numero e senza totali congelati.
    if new.numero is not null or new.stato <> 'bozza' or new.emessa_il is not null
       or new.imponibile is not null or new.imposta is not null or new.totale is not null then
      raise exception 'Una fattura nuova nasce in bozza: il numero e i totali li dà «Emetti».'
        using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- UPDATE
  if old.numero is not null and (
       new.numero is distinct from old.numero
       or new.data is distinct from old.data
       or new.entity_id is distinct from old.entity_id) then
    raise exception 'La fattura % è già uscita: numero, data e società non cambiano più.', old.numero
      using errcode = 'P0001';
  end if;
  if v_da_fuori then
    if old.numero is null and (new.numero is not null or new.stato <> 'bozza'
         or new.emessa_il is not null or new.imponibile is not null
         or new.imposta is not null or new.totale is not null) then
      raise exception 'Il numero di una fattura si dà con «Emetti», non a mano.'
        using errcode = 'P0001';
    end if;
    if old.numero is not null then
      -- Uscita: da fuori non si tocca. Dopo uno scarto dello SDI si
      -- correggono solo cliente, causale e modo di pagamento; stato e
      -- totali li rifà la funzione che la rimanda.
      if old.stato <> 'scartata'
         or new.stato is distinct from old.stato
         or new.imponibile is distinct from old.imponibile
         or new.imposta is distinct from old.imposta
         or new.totale is distinct from old.totale
         or new.emessa_il is distinct from old.emessa_il
         or new.nome_file is distinct from old.nome_file
         or new.identificativo_sdi is distinct from old.identificativo_sdi
         or new.inviata_il is distinct from old.inviata_il
         or new.esito_il is distinct from old.esito_il
         or new.esito_note is distinct from old.esito_note
         or new.order_id is distinct from old.order_id
         or new.preventivo_id is distinct from old.preventivo_id then
        raise exception 'La fattura % è già uscita e da qui non si cambia: dopo uno scarto dello SDI si correggono solo cliente, causale e pagamento.', old.numero
          using errcode = 'P0001';
      end if;
    end if;
  end if;
  new.aggiornato_il := now();
  return new;
end;
$fn$;

comment on function fatture_emesse_guardia() is
  'Una fattura nasce bozza; numerata non si cancella e non cambia numero, data o società; da fuori (authenticated) non si numera né si tocca dopo l''uscita, salvo cliente, causale e pagamento dopo uno scarto. Il numero lo dà solo emetti_fattura (13/11/2026).';

drop trigger if exists fatture_emesse_guardia on fatture_emesse;
create trigger fatture_emesse_guardia
  before insert or update or delete on fatture_emesse
  for each row execute function fatture_emesse_guardia();

create or replace function fatture_emesse_righe_guardia()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_id     uuid;
  v_stato  text;
  v_numero integer;
begin
  -- ⚠️ Si guardano TUTTE e due le fatture di un update (revisione del
  --    13/11): spostare una riga da una fattura uscita a una bozza la
  --    toglierebbe dalla prima.
  foreach v_id in array array_remove(array[
      case when tg_op <> 'INSERT' then old.fattura_id end,
      case when tg_op <> 'DELETE' then new.fattura_id end], null) loop
    -- «for share»: aspetta un «Emetti» in corso sulla stessa fattura, e
    -- dopo vede lo stato nuovo — così una riga non scivola dentro mentre
    -- i totali si congelano.
    select stato, numero into v_stato, v_numero
      from fatture_emesse where id = v_id for share;
    -- La fattura se ne sta andando (cancellazione di una bozza): passa.
    continue when v_stato is null;
    if v_stato not in ('bozza', 'scartata') then
      raise exception 'La fattura % è già uscita: le righe si cambiano solo in bozza o dopo uno scarto dello SDI.', v_numero
        using errcode = 'P0001';
    end if;
  end loop;
  return coalesce(new, old);
end;
$fn$;

comment on function fatture_emesse_righe_guardia() is
  'Le righe di una fattura si toccano solo in bozza o dopo uno scarto dello SDI (13/11/2026).';

drop trigger if exists fatture_emesse_righe_guardia on fatture_emesse_righe;
create trigger fatture_emesse_righe_guardia
  before insert or update or delete on fatture_emesse_righe
  for each row execute function fatture_emesse_righe_guardia();

drop trigger if exists trg_log_delete on fatture_emesse;
create trigger trg_log_delete before delete on fatture_emesse
  for each row execute function log_deleted_record();
drop trigger if exists trg_log_delete on clienti_fattura;
create trigger trg_log_delete before delete on clienti_fattura
  for each row execute function log_deleted_record();

-- ---------------------------------------------------------------------
-- 5. EMETTERE: il numero, i totali, la data in ordine
-- ---------------------------------------------------------------------
create or replace function emetti_fattura(p_fattura uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_f          fatture_emesse%rowtype;
  v_e          entities%rowtype;
  v_numero     integer;
  v_ultima     date;
  v_imponibile numeric(12,2);
  v_imposta    numeric(12,2);
  v_righe      integer;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare emette le fatture.' using errcode = '42501';
  end if;

  select * into v_f from fatture_emesse where id = p_fattura for update;
  if not found then
    raise exception 'Questa fattura non esiste.' using errcode = 'P0002';
  end if;
  if v_f.stato <> 'bozza' then
    raise exception 'La fattura % è già uscita.', v_f.numero using errcode = 'P0001';
  end if;

  select * into v_e from entities where id = v_f.entity_id;
  if v_e.entity_type <> 'srls' then
    raise exception 'Le fatture ai clienti le emette solo la S.r.l.s.' using errcode = 'P0001';
  end if;
  if nullif(btrim(v_e.legal_name), '') is null or nullif(btrim(v_e.vat_number), '') is null
     or nullif(btrim(v_e.sede_indirizzo), '') is null or v_e.sede_cap is null
     or nullif(btrim(v_e.sede_comune), '') is null or v_e.sede_provincia is null then
    raise exception 'Mancano dei dati della società (ragione sociale, partita IVA o sede): completali prima di emettere.'
      using errcode = 'P0001';
  end if;

  select count(*),
         coalesce(sum(round(quantita * prezzo_unitario, 2)), 0)
    into v_righe, v_imponibile
    from fatture_emesse_righe where fattura_id = p_fattura;
  if v_righe = 0 then
    raise exception 'La fattura non ha righe.' using errcode = 'P0001';
  end if;
  -- L'imposta si calcola per aliquota, come la riepiloga la fattura.
  select coalesce(sum(round(imp * aliquota_iva / 100, 2)), 0) into v_imposta
    from (select aliquota_iva, sum(round(quantita * prezzo_unitario, 2)) as imp
            from fatture_emesse_righe where fattura_id = p_fattura
           group by aliquota_iva) g;
  if v_imponibile + v_imposta <= 0 then
    raise exception 'Il totale della fattura deve essere più di zero.' using errcode = 'P0001';
  end if;

  -- Un lucchetto per società e anno: due «Emetti» insieme non prendono lo
  -- stesso numero, e il secondo vede la data del primo.
  perform pg_advisory_xact_lock(hashtext('fatture_emesse:' || v_f.entity_id::text || ':' || v_f.anno::text));

  select max(numero), max(data) into v_numero, v_ultima
    from fatture_emesse
   where entity_id = v_f.entity_id and anno = v_f.anno and numero is not null;
  if v_ultima is not null and v_f.data < v_ultima then
    raise exception 'La data della fattura (%) è prima dell''ultima fattura già uscita (%): i numeri devono seguire le date.',
      to_char(v_f.data, 'DD/MM/YYYY'), to_char(v_ultima, 'DD/MM/YYYY')
      using errcode = 'P0001';
  end if;
  v_numero := coalesce(v_numero, 0) + 1;

  update fatture_emesse
     set numero = v_numero,
         stato = 'da_inviare',
         imponibile = v_imponibile,
         imposta = v_imposta,
         totale = v_imponibile + v_imposta,
         emessa_il = now()
   where id = p_fattura;

  return v_numero;
end;
$fn$;

comment on function emetti_fattura(uuid) is
  'Fa uscire una fattura dalla bozza: le dà il numero (progressivo per società e anno, sotto lucchetto), controlla che la data non sia prima dell''ultima fattura numerata e congela i totali (13/11/2026). Solo il titolare.';

revoke all on function emetti_fattura(uuid) from public, anon;
grant execute on function emetti_fattura(uuid) to authenticated;
revoke all on function fatture_emesse_guardia() from public, anon, authenticated;
revoke all on function fatture_emesse_righe_guardia() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. SOLO IL TITOLARE
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['clienti_fattura', 'fatture_emesse', 'fatture_emesse_righe'] loop
    execute format('alter table %I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_titolare') then
      execute format('create policy %I on %I for all using ((select is_titolare())) with check ((select is_titolare()))', t || '_titolare', t);
    end if;
    execute format('revoke all on table %I from public, anon', t);
    execute format('grant select, insert, update, delete on table %I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione che si annulla
-- ---------------------------------------------------------------------
--   (1) senza i dati della società non si emette;
--   (2) con i dati: la prima fattura prende 1, la seconda 2; totali giusti
--       (IVA calcolata per aliquota);
--   (3) una bozza buttata non lascia buchi: la terza prende 3;
--   (4) una data prima dell'ultima fattura numerata è rifiutata;
--   (5) una fattura numerata non si cancella, non cambia numero né data,
--       e le sue righe non si toccano; il numero a mano è rifiutato;
--   (6) dopo uno scarto le righe si correggono;
--   (7) lo staff non vede né emette niente;
--   (8) ogni vincolo nuovo ha la sua frase.
do $verifica$
declare
  v_foto      jsonb := foto_righe();
  v_titolare  uuid;
  v_staff     uuid;
  v_srls      uuid;
  v_vecchia   entities%rowtype;
  v_cli       uuid;
  v_f1        uuid;
  v_f2        uuid;
  v_f3        uuid;
  v_f4        uuid;
  v_n         integer;
  v_ok        boolean;
  v_visti     integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role <> 'titolare' limit 1;
  select * into v_vecchia from entities where entity_type = 'srls' limit 1;
  v_srls := v_vecchia.id;
  if v_titolare is null or v_srls is null then
    raise exception 'VERIFICA: servono un titolare e Borgo 58.';
  end if;

  begin  -- <<< la sotto-transazione che verrà annullata
    -- Una società senza dati, come oggi in produzione.
    update entities set vat_number = null, sede_indirizzo = null where id = v_srls;

    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;

    insert into clienti_fattura (denominazione, partita_iva, indirizzo, cap, comune, provincia, codice_destinatario)
    values ('ZZ Ditta della verifica srl', '01234567890', 'Via Prova 1', '84043', 'Agropoli', 'SA', 'ABC1234')
    returning id into v_cli;

    insert into fatture_emesse (entity_id, cliente_id, data) values (v_srls, v_cli, date '2099-01-10') returning id into v_f1;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario, aliquota_iva)
    values (v_f1, 1, 'ZZ Cena di prova', 4, 25.00, 10),
           (v_f1, 2, 'ZZ Servizio di prova', 1, 100.00, 22);

    -- (1) Senza i dati della società.
    v_ok := false;
    begin
      perform emetti_fattura(v_f1);
    exception when others then
      v_ok := sqlerrm like 'Mancano dei dati della società%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (1): una fattura è uscita senza i dati della società.';
    end if;

    reset role;
    update entities set vat_number = '01343950869', legal_name = 'Borgo 58 S.r.l.s.',
           sede_indirizzo = 'Via Prova 58', sede_cap = '84043', sede_comune = 'Agropoli', sede_provincia = 'SA'
     where id = v_srls;
    set local role authenticated;

    -- (2) Prima e seconda.
    v_n := emetti_fattura(v_f1);
    if v_n <> 1 or not exists (select 1 from fatture_emesse where id = v_f1
         and stato = 'da_inviare' and imponibile = 200.00 and imposta = 32.00 and totale = 232.00 and emessa_il is not null) then
      raise exception 'VERIFICA (2): la prima fattura non ha preso 1 o i totali (200 + 10%% di 100 + 22%% di 100 = 232) sono sbagliati.';
    end if;
    insert into fatture_emesse (entity_id, cliente_id, data) values (v_srls, v_cli, date '2099-01-11') returning id into v_f2;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, prezzo_unitario) values (v_f2, 1, 'ZZ Pranzo', 50);
    if emetti_fattura(v_f2) <> 2 then
      raise exception 'VERIFICA (2): la seconda fattura non ha preso 2.';
    end if;

    -- (3) Una bozza buttata non lascia buchi.
    insert into fatture_emesse (entity_id, cliente_id, data) values (v_srls, v_cli, date '2099-01-12') returning id into v_f3;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, prezzo_unitario) values (v_f3, 1, 'ZZ Bozza buttata', 10);
    delete from fatture_emesse where id = v_f3;
    insert into fatture_emesse (entity_id, cliente_id, data) values (v_srls, v_cli, date '2099-01-12') returning id into v_f3;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, prezzo_unitario) values (v_f3, 1, 'ZZ Terza', 10);
    if emetti_fattura(v_f3) <> 3 then
      raise exception 'VERIFICA (3): dopo una bozza buttata la fattura non ha preso 3.';
    end if;

    -- (4) Una data prima dell'ultima numerata.
    insert into fatture_emesse (entity_id, cliente_id, data) values (v_srls, v_cli, date '2099-01-05') returning id into v_f4;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, prezzo_unitario) values (v_f4, 1, 'ZZ Data indietro', 10);
    v_ok := false;
    begin
      perform emetti_fattura(v_f4);
    exception when others then
      v_ok := sqlerrm like 'La data della fattura%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (4): una fattura con la data prima dell''ultima numerata è uscita.';
    end if;

    -- (5) Una fattura numerata resta com'è.
    v_ok := false;
    begin delete from fatture_emesse where id = v_f1;
    exception when others then v_ok := sqlerrm like '%non si cancella%'; end;
    if not v_ok then raise exception 'VERIFICA (5): una fattura numerata si è cancellata.'; end if;
    v_ok := false;
    begin update fatture_emesse set data = date '2099-02-01' where id = v_f1;
    exception when others then v_ok := sqlerrm like '%non cambiano più%'; end;
    if not v_ok then raise exception 'VERIFICA (5): una fattura numerata ha cambiato data.'; end if;
    v_ok := false;
    begin update fatture_emesse_righe set prezzo_unitario = 1 where fattura_id = v_f1;
    exception when others then v_ok := sqlerrm like '%le righe si cambiano solo%'; end;
    if not v_ok then raise exception 'VERIFICA (5): le righe di una fattura uscita si sono cambiate.'; end if;
    v_ok := false;
    begin update fatture_emesse set numero = 99, stato = 'da_inviare' where id = v_f4;
    exception when others then v_ok := sqlerrm like '%si dà con «Emetti»%'; end;
    if not v_ok then raise exception 'VERIFICA (5): un numero è entrato a mano.'; end if;

    v_ok := false;
    begin insert into fatture_emesse (entity_id, cliente_id, data, numero, stato) values (v_srls, v_cli, date '2099-01-20', 57, 'da_inviare');
    exception when others then v_ok := sqlerrm like '%nasce in bozza%'; end;
    if not v_ok then raise exception 'VERIFICA (5): una fattura è nata già numerata.'; end if;
    v_ok := false;
    begin update fatture_emesse_righe set fattura_id = v_f4 where fattura_id = v_f1 and posizione = 1;
    exception when others then v_ok := sqlerrm like '%le righe si cambiano solo%'; end;
    if not v_ok then raise exception 'VERIFICA (5): una riga è uscita da una fattura già emessa.'; end if;
    v_ok := false;
    begin update fatture_emesse set totale = 1 where id = v_f1;
    exception when others then v_ok := sqlerrm like '%da qui non si cambia%'; end;
    if not v_ok then raise exception 'VERIFICA (5): il totale di una fattura uscita si è cambiato a mano.'; end if;
    v_ok := false;
    begin update fatture_emesse set stato = 'scartata' where id = v_f2;
    exception when others then v_ok := sqlerrm like '%da qui non si cambia%'; end;
    if not v_ok then raise exception 'VERIFICA (5): lo stato di una fattura uscita si è cambiato a mano.'; end if;

    -- (6) Dopo uno scarto (lo segna la funzione delle ricevute, qui il
    --     proprietario) le righe e il cliente si correggono.
    reset role;
    update fatture_emesse set stato = 'scartata' where id = v_f2;
    set local role authenticated;
    update fatture_emesse_righe set descrizione = 'ZZ Pranzo corretto' where fattura_id = v_f2;
    update fatture_emesse set causale = 'ZZ corretta' where id = v_f2;

    -- (7) Lo staff non vede né emette.
    if v_staff is not null then
      reset role;
      perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
      set local role authenticated;
      select count(*) into v_visti from fatture_emesse;
      if v_visti <> 0 or exists (select 1 from clienti_fattura) then
        raise exception 'VERIFICA (7): lo staff vede le fatture o i clienti delle fatture.';
      end if;
      v_ok := false;
      begin perform emetti_fattura(v_f4);
      exception when others then v_ok := sqlstate = '42501'; end;
      if not v_ok then raise exception 'VERIFICA (7): lo staff ha potuto emettere.'; end if;
    end if;

    reset role;

    -- (8) Le frasi (la rete la interroga solo il titolare).
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    if exists (select 1 from vincoli_senza_frase() v
                where v.tabella in ('clienti_fattura', 'fatture_emesse', 'fatture_emesse_righe')
                   or v.conname like 'entities\_sede\_%' or v.conname in (
                      'entities_rea_ufficio_forma', 'entities_capitale_non_negativo',
                      'entities_socio_unico_check', 'entities_pec_forma', 'entities_iban_forma')) then
      raise exception 'VERIFICA (8): un vincolo delle fatture ai clienti non ha la sua frase in italiano.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica delle fatture ai clienti');

  raise notice 'Fatto: senza i dati della società non si emette; i numeri partono da 1 e non lasciano buchi; la data segue i numeri; una fattura uscita non si cancella e non cambia; dopo uno scarto le righe si correggono; lo staff non vede niente. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261113000002', 'le_fatture_ai_clienti_hanno_un_archivio')
on conflict (version) do nothing;
