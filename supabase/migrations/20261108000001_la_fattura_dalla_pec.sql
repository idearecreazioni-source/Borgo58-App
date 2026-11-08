-- =====================================================================
-- LA FATTURA CHE ARRIVA DALLA PEC SI REGISTRA DALLA POSTA — 08/11/2026
-- =====================================================================
--
-- Una fattura d'acquisto arriva dallo SdI come PEC, con la fattura
-- elettronica firmata (.xml.p7m) fra gli allegati. Fino a oggi la Posta la
-- vedeva come «formato che non so aprire», e il modello improvvisava il
-- consiglio di un programma per aprirla. Da oggi:
--
--   · la funzione che legge la posta (`posta-leggi`) apre la busta firmata
--     e, quando dentro c'è una fattura registrabile, propone LEI l'azione
--     «Registra la fattura» — costruita dal CODICE a partire dall'XML, non
--     dal modello: numero, data, importi e partita IVA si leggono dai loro
--     campi;
--   · Alessio la conferma dalla Posta, e la fattura entra con
--     `registra_fattura_elettronica`, la stessa porta dell'«Importa fattura
--     elettronica» (anti-doppioni per file SdI e per fornitore + numero +
--     data, fornitore trovato per partita IVA o creato).
--
-- ⚠️ SEMPRE SU BORGO 58 (Alessio, 08/11: «sempre a borgo58, non ho altre
--    p. IVA»). La società è quella di tipo `srls`, e deve essercene una
--    sola: se fossero due non si sceglie a caso. Il controllo della
--    partita IVA del cliente resta quello di `registra_fattura_elettronica`:
--    una fattura intestata a un'altra partita IVA viene rifiutata.
--
-- ⚠️ I DATI DELLA FATTURA NON VIAGGIANO CON LA CONFERMA. Si prendono dai
--    parametri scritti da `posta-leggi` quando ha letto l'XML, e la
--    conferma porta solo QUALE proposta: la schermata non ha campi da
--    correggere, perché correggerli vorrebbe dire registrare una fattura
--    diversa da quella che lo SdI ha consegnato. Chi vuole cambiare
--    qualcosa la rifiuta e la registra a mano.
--    Detto onestamente (revisione ECC dell'08/11): NON è una barriera di
--    sicurezza. Il titolare può comunque scrivere `posta_azioni` (la RLS
--    glielo permette) e chiamare `registra_fattura_elettronica` da sé: è lo
--    stesso permesso che ha già oggi, qui non si apre niente di nuovo.
--
-- ⚠️ `esegui_azione_posta` NON SI RISCRIVE. È una funzione di 300 righe
--    ripresa dal corpo vivo cinque volte (vedi 20260921000002): aggiungerle
--    un ramo vorrebbe dire ricopiarla tutta un'altra volta. Questa funzione
--    registra la fattura e poi chiama `esegui_azione_posta`, che per un tipo
--    senza ramo fa proprio quello che serve: segna l'azione «fatta» e
--    chiude la mail quando non resta niente da decidere. Tutto nella stessa
--    transazione: se la registrazione fallisce, l'azione resta proposta.
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Il tipo nuovo fra quelli ammessi
-- ---------------------------------------------------------------------
-- La colonna è testo con un vincolo (20260812000007 ha tolto l'enum); la
-- lista che segue è quella di 20260812000011 più `registra_fattura`.
alter table posta_azioni drop constraint if exists posta_azioni_tipo_check;
alter table posta_azioni add constraint posta_azioni_tipo_check check (tipo in (
  'archivia_documento',    -- un allegato diventa un documento
  'archivia_testo',        -- il contenuto che conta è nella mail
  'promemoria',            -- una data in Agenda
  'promemoria_multipli',   -- più date dello stesso documento, in un colpo
  'carico_magazzino',      -- le righe di una fattura diventano lotti + HACCP
  'registra_fattura',      -- la fattura elettronica arrivata dalla PEC
  'da_fare_a_mano',        -- cose che il gestionale non sa ancora fare
  'nessuna'
));

-- ---------------------------------------------------------------------
-- 2. La registrazione dalla Posta
-- ---------------------------------------------------------------------
create or replace function registra_fattura_dalla_posta(p_azione_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_az     posta_azioni%rowtype;
  v_srls   uuid;
  v_n      integer;
  v_esito  jsonb;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' decidere sulla posta';
  end if;

  select * into v_az from posta_azioni where id = p_azione_id for update;
  if not found then
    raise exception 'Questa proposta non esiste piu''';
  end if;
  if v_az.tipo <> 'registra_fattura' then
    raise exception 'Questa proposta non e'' la registrazione di una fattura.';
  end if;
  if v_az.stato = 'fatta' then
    return jsonb_build_object('gia_fatta', true, 'fattura_id', v_az.parametri->>'fattura_id');
  end if;
  if v_az.stato <> 'proposta' then
    raise exception 'Questa proposta e'' gia'' stata decisa.';
  end if;
  if jsonb_typeof(v_az.parametri->'fattura') is distinct from 'object' then
    raise exception 'Alla proposta mancano i dati della fattura: registrala a mano da Fatture fornitori.';
  end if;

  -- Sempre Borgo 58: la società di tipo srls, e una sola.
  select count(*), min(id::text)::uuid into v_n, v_srls from entities where entity_type = 'srls';
  if v_n <> 1 then
    raise exception 'Per registrare la fattura serve una sola societa'' Borgo 58 (srls): ne trovo %.', v_n;
  end if;

  v_esito := registra_fattura_elettronica(v_srls, v_az.parametri->'fattura');

  -- L'azione si chiude dalla sua porta di sempre: per un tipo senza ramo
  -- `esegui_azione_posta` la segna fatta e chiude la mail se non resta
  -- niente da decidere. I parametri si conservano con la fattura nata.
  perform esegui_azione_posta(
    p_azione_id,
    v_az.parametri || jsonb_build_object('fattura_id', v_esito->>'fattura_id')
  );

  return v_esito;
end $fn$;

comment on function registra_fattura_dalla_posta(uuid) is
  'Conferma dalla Posta la registrazione di una fattura elettronica arrivata via PEC: sempre su Borgo 58 (srls), con i dati letti dall''XML da posta-leggi (non dal browser), attraverso registra_fattura_elettronica; poi chiude l''azione con esegui_azione_posta. Piu'' tabelle, quindi dal corridoio.';
revoke all on function registra_fattura_dalla_posta(uuid) from public, anon, authenticated;
grant execute on function registra_fattura_dalla_posta(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. VERIFICA — in una sotto-transazione che viene ANNULLATA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_srls     uuid;
  v_piva     text;
  v_posta    uuid;
  v_az       uuid;
  v_az2      uuid;
  v_az3      uuid;
  v_fattura  jsonb;
  v_esito    jsonb;
  v_n        integer;
  v_rifiuto  boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  select id, vat_number into v_srls, v_piva from entities where entity_type = 'srls' limit 1;
  if v_titolare is null or v_staff is null or v_srls is null then
    raise exception 'VERIFICA: servono un titolare, uno staff e Borgo 58.';
  end if;

  begin
    v_fattura := jsonb_build_object(
      'tipo', 'TD01', 'numero', 'ZZ-PEC-1', 'data', current_date::text,
      'scadenza', (current_date + 30)::text,
      'totale', 122.00, 'imponibile', 100.00, 'imposta', 22.00,
      'file_sdi', 'ZZ00000000001_pec01.xml.p7m',
      'note', 'Dalla fattura elettronica ZZ00000000001_pec01.xml.p7m.',
      'fornitore', jsonb_build_object('denominazione', 'ZZ fornitore dalla PEC', 'partita_iva', 'IT09999999991'),
      'cliente', jsonb_build_object('partita_iva', v_piva));

    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-PEC-VERIFICA', 'pec@verifica.resend.app', 'sdi01@pec.fatturapa.it', 'Invio File 1', 'proposta')
    returning id into v_posta;
    insert into posta_azioni (posta_id, tipo, titolo, parametri)
    values (v_posta, 'registra_fattura', 'Registra la fattura ZZ-PEC-1', jsonb_build_object('fattura', v_fattura))
    returning id into v_az;
    -- Un'altra azione con la STESSA fattura: dovrà essere rifiutata come doppione.
    insert into posta_azioni (posta_id, tipo, titolo, parametri)
    values (v_posta, 'registra_fattura', 'La stessa, di nuovo', jsonb_build_object('fattura', v_fattura))
    returning id into v_az2;
    insert into posta_azioni (posta_id, tipo, titolo, parametri)
    values (v_posta, 'promemoria', 'Non è una fattura', '{}'::jsonb)
    returning id into v_az3;

    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;

    -- (1) Si registra: fattura su Borgo 58 col file SdI, fornitore nuovo.
    v_esito := registra_fattura_dalla_posta(v_az);
    if (v_esito->>'fattura_id') is null or not (v_esito->>'fornitore_nuovo')::boolean then
      raise exception 'VERIFICA (1): esito inatteso %.', v_esito;
    end if;
    reset role;
    select count(*) into v_n from supplier_invoices
     where id = (v_esito->>'fattura_id')::uuid and entity_id = v_srls
       and file_sdi = 'ZZ00000000001_pec01.xml.p7m' and amount = 122.00 and invoice_number = 'ZZ-PEC-1';
    if v_n <> 1 then raise exception 'VERIFICA (1): la fattura non e'' nata su Borgo 58 con i suoi dati.'; end if;

    -- (2) L'azione è fatta e ricorda la fattura; la mail resta aperta (ce ne sono altre).
    select count(*) into v_n from posta_azioni
     where id = v_az and stato = 'fatta' and parametri->>'fattura_id' = v_esito->>'fattura_id';
    if v_n <> 1 then raise exception 'VERIFICA (2): l''azione non risulta fatta con la sua fattura.'; end if;
    if (select stato from posta_ricevuta where id = v_posta) <> 'proposta' then
      raise exception 'VERIFICA (2): la mail si e'' chiusa con altre proposte ancora aperte.';
    end if;
    set local role authenticated;

    -- (3) Ripremere non registra due volte.
    if not (registra_fattura_dalla_posta(v_az)->>'gia_fatta')::boolean then
      raise exception 'VERIFICA (3): la seconda pressione non ha detto «gia'' fatta».';
    end if;

    -- (4) La stessa fattura da un'altra proposta: rifiutata come doppione, e la proposta resta.
    v_rifiuto := false;
    begin
      perform registra_fattura_dalla_posta(v_az2);
    exception when raise_exception then v_rifiuto := sqlerrm like '%gia'' stata registrata%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (4): il doppione non e'' stato rifiutato.'; end if;

    -- (5) Un'azione di altro tipo non passa da qui.
    v_rifiuto := false;
    begin
      perform registra_fattura_dalla_posta(v_az3);
    exception when raise_exception then v_rifiuto := sqlerrm like '%non e'' la registrazione di una fattura%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (5): un promemoria e'' passato per la registrazione.'; end if;
    reset role;
    if (select stato from posta_azioni where id = v_az2) <> 'proposta' then
      raise exception 'VERIFICA (4): il doppione rifiutato ha cambiato lo stato della proposta.';
    end if;

    -- (6) Lo staff riceve un rifiuto.
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_rifiuto := false;
    begin
      perform registra_fattura_dalla_posta(v_az2);
    exception when raise_exception then v_rifiuto := sqlerrm like '%Solo il titolare%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (6): lo staff ha registrato una fattura dalla posta.'; end if;
    reset role;
    perform set_config('request.jwt.claims', null, true);

    if has_function_privilege('anon', 'registra_fattura_dalla_posta(uuid)', 'execute') then
      raise exception 'VERIFICA (7): anon puo'' registrare una fattura dalla posta.';
    end if;

    -- (8) Il vincolo accetta il tipo nuovo e rifiuta quelli inventati.
    v_rifiuto := false;
    begin
      insert into posta_azioni (posta_id, tipo, titolo) values (v_posta, 'registra_tutto', 'no');
    exception when check_violation then v_rifiuto := true;
    end;
    if not v_rifiuto then raise exception 'VERIFICA (8): il vincolo ha accettato un tipo inventato.'; end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della fattura dalla PEC');

  raise notice 'Fatto: la fattura arrivata dalla PEC si registra dalla Posta su Borgo 58, con i dati letti dall''XML; ripremere non la duplica, la stessa fattura da un''altra proposta e'' rifiutata, un''azione di altro tipo non passa, lo staff riceve un rifiuto. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261108000001', 'la_fattura_dalla_pec')
on conflict (version) do nothing;
