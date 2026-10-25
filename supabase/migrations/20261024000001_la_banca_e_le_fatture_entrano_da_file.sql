-- =====================================================================
-- LA BANCA E LE FATTURE ENTRANO DA FILE — 24/10/2026
-- =====================================================================
-- 🔴 RICHIESTA DI ALESSIO, 24/10/2026: «prima di registrare la fattura
--    manualmente non possiamo collegare il sistema per le fatture
--    elettroniche al gestionale? e mentre aspetto la banca non posso
--    scaricare un estratto conto e farlo elaborare automaticamente?»
--
-- DUE PORTE NUOVE, e nessuna delle due indovina niente:
--
--   1. LA FATTURA ELETTRONICA (l'XML firmato che arriva dallo SdI). Il
--      browser la legge (`src/lib/calcoli/fatturaPA.js`), Alessio guarda
--      cosa ne è uscito, e conferma: `registra_fattura_elettronica`
--      trova il fornitore per PARTITA IVA — o lo crea — e registra la
--      fattura col percorso di sempre (`create_supplier_invoice`, quindi
--      anche il promemoria in Agenda). Numero, data e importi vengono dai
--      campi dell'XML: nessun modello, nessuna lettura da una foto.
--
--   2. IL FLUSSO CBI DELLA BANCA (il file giornaliero di saldi e
--      movimenti, da Credem «Scarico flussi CBI»). Il browser lo legge
--      (`src/lib/calcoli/cbi.js`) e lo controlla due volte con i numeri
--      che il file stesso dichiara; `carica_movimenti_banca` lo mette in
--      `movimenti_banca`. Da lì ogni movimento si ABBINA: alla fattura
--      che paga (e la fattura risulta pagata, con la sua uscita in prima
--      nota), a un movimento di prima nota già scritto, oppure si
--      registra come movimento nuovo con la sua causale.
--
-- ⚠️ IL SISTEMA PROPONE, ALESSIO CONFERMA (regola di sempre, §10).
--    Caricare il file NON scrive niente in prima nota: i movimenti della
--    banca stanno in una tabella loro finché non vengono abbinati. Un
--    bonifico letto non è ancora un costo — è un fatto della banca a cui
--    manca il perché, e il perché lo dice lui.
--
-- ⚠️ PERCHÉ UNA TABELLA A PARTE E NON SUBITO `cash_movements`: un
--    movimento di prima nota ha una causale, un documento, un perché. La
--    banca dice solo quanto, quando e una descrizione troncata. Scrivere
--    subito in prima nota vorrebbe dire inventare la causale — oppure
--    lasciarla vuota e avere centinaia di righe «da classificare» che
--    sembrano contabilità.
--
-- ⚠️ IL CARICAMENTO NON SI RIPETE: ogni movimento ha la sua impronta
--    (conto, date, importo, causali, riferimento, descrizione completa),
--    e un file ricaricato — o due file che si sovrappongono di un giorno —
--    non fa entrare niente due volte. Lo dice: «N nuovi, M già presenti».
--
-- ⚠️ E SI TORNA INDIETRO: un movimento ignorato si riapre, un
--    abbinamento si scioglie. Se si cancella il movimento di prima nota a
--    cui era abbinato (per esempio annullando il pagamento di una
--    fattura), quello della banca torna da abbinare da solo
--    (`on delete set null`): la banca il bonifico l'ha fatto lo stesso.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La partita IVA in una forma sola
-- ---------------------------------------------------------------------
-- «IT 12345678903», «it12345678903», «12345678903» sono la stessa partita
-- IVA. Il confronto si fa su una forma sola, scritta in un posto solo.
create or replace function partita_iva_normale(p_testo text)
returns text
language sql
immutable
set search_path = public
as $fn$
  select nullif(
    regexp_replace(
      regexp_replace(upper(coalesce(p_testo, '')), '[^A-Z0-9]', '', 'g'),
      '^IT(\d{11})$', '\1'),
    '');
$fn$;
comment on function partita_iva_normale(text) is
  'La partita IVA (o il codice fiscale) in una forma sola: maiuscole, senza spazi né punteggiatura, senza «IT» davanti alle 11 cifre italiane. Serve a riconoscere lo stesso fornitore scritto in modi diversi.';
revoke all on function partita_iva_normale(text) from public, anon, authenticated;
grant execute on function partita_iva_normale(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. La fattura ricorda da quale file elettronico è nata
-- ---------------------------------------------------------------------
-- ⚠️ Tre colonne VUOTE sulle fatture scritte a mano, e vuoto è il vero:
--    per quelle nessuno ha detto imponibile e imposta. Nessun predefinito.
alter table supplier_invoices add column if not exists imponibile numeric(14,2);
alter table supplier_invoices add column if not exists imposta numeric(14,2);
alter table supplier_invoices add column if not exists file_sdi text;

comment on column supplier_invoices.imponibile is
  'L''imponibile, dai riepiloghi IVA della fattura elettronica. Vuoto sulle fatture scritte a mano: nessuno l''ha detto.';
comment on column supplier_invoices.imposta is
  'L''IVA, dai riepiloghi della fattura elettronica. Vuota sulle fatture scritte a mano.';
comment on column supplier_invoices.file_sdi is
  'Il nome del file della fattura elettronica da cui è nata (es. IT01234567890_abcde.xml.p7m). Lo SdI lo assegna una volta sola: è ciò che impedisce di caricarla due volte. Vuoto sulle fatture scritte a mano.';

create unique index if not exists uq_supplier_invoices_file_sdi
  on supplier_invoices (file_sdi) where file_sdi is not null;

-- ---------------------------------------------------------------------
-- 3. Registrare una fattura elettronica
-- ---------------------------------------------------------------------
-- Gli importi arrivano in EURO (il browser converte i centesimi): la
-- stessa unità di `create_supplier_invoice`, che questa funzione chiama.
create or replace function registra_fattura_elettronica(p_entity_id uuid, p_fattura jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ent        entities%rowtype;
  v_tipo       text := p_fattura->>'tipo';
  v_numero     text := nullif(btrim(coalesce(p_fattura->>'numero', '')), '');
  v_data       date := nullif(p_fattura->>'data', '')::date;
  v_scadenza   date := nullif(p_fattura->>'scadenza', '')::date;
  v_totale     numeric := nullif(p_fattura->>'totale', '')::numeric;
  v_file       text := nullif(btrim(coalesce(p_fattura->>'file_sdi', '')), '');
  v_forn       jsonb := coalesce(p_fattura->'fornitore', '{}'::jsonb);
  v_piva       text := partita_iva_normale(v_forn->>'partita_iva');
  v_cf         text := partita_iva_normale(v_forn->>'codice_fiscale');
  v_nome_forn  text := nullif(btrim(coalesce(v_forn->>'denominazione', '')), '');
  v_cli_piva   text := partita_iva_normale(p_fattura#>>'{cliente,partita_iva}');
  v_cli_cf     text := partita_iva_normale(p_fattura#>>'{cliente,codice_fiscale}');
  v_fornitori  uuid[];
  v_fornitore  uuid;
  v_nuovo      boolean := false;
  v_doppia     record;
  v_inv        uuid;
begin
  if not is_titolare() then
    raise exception 'Registrare una fattura e'' riservato al titolare.';
  end if;

  select * into v_ent from entities where id = p_entity_id;
  if v_ent.id is null then
    raise exception 'La societa'' indicata non esiste.';
  end if;
  if v_ent.entity_type::text = 'tasca' then
    raise exception 'Una fattura d''acquisto si registra su una societa'', non sulla tasca del titolare.';
  end if;

  -- ⚠️ Una fattura intestata a un''altra partita IVA non è una fattura di
  --    questa società. Il controllo scatta solo se la partita IVA della
  --    società è scritta: se è vuota non la si indovina, e la schermata
  --    mostra a chi è intestata prima della conferma.
  if partita_iva_normale(v_ent.vat_number) is not null
     and partita_iva_normale(v_ent.vat_number) is distinct from v_cli_piva
     and partita_iva_normale(v_ent.vat_number) is distinct from v_cli_cf then
    raise exception 'Questa fattura e'' intestata alla partita IVA %, non a % (%): non e'' una fattura di questa societa''.',
      coalesce(v_cli_piva, v_cli_cf, '(nessuna)'), v_ent.name, v_ent.vat_number;
  end if;

  -- ⚠️ Le note di credito qui NON entrano: registrate come fattura farebbero
  --    crescere il debito invece di ridurlo. Il browser le ferma già; il
  --    controllo vive anche qui perché la porta è questa.
  if v_tipo is null or v_tipo not in ('TD01', 'TD02', 'TD06', 'TD24', 'TD25') then
    raise exception 'Il documento di tipo % non si registra da qui: va registrato a mano.', coalesce(v_tipo, '(mancante)');
  end if;
  if v_numero is null or v_data is null then
    raise exception 'Alla fattura mancano il numero o la data.';
  end if;
  if v_totale is null or v_totale <= 0 then
    raise exception 'Il totale della fattura manca o non e'' positivo.';
  end if;
  if v_piva is null and v_cf is null then
    raise exception 'Il fornitore non ha ne'' partita IVA ne'' codice fiscale.';
  end if;
  if v_nome_forn is null then
    raise exception 'Il fornitore non ha un nome.';
  end if;

  -- Gia' caricata? Il nome del file lo assegna lo SdI una volta sola.
  if v_file is not null then
    select si.invoice_number, si.invoice_date into v_doppia
      from supplier_invoices si where si.file_sdi = v_file;
    if found then
      raise exception 'Questa fattura elettronica e'' gia'' stata registrata (n. % del %).',
        coalesce(v_doppia.invoice_number, '—'), to_char(v_doppia.invoice_date, 'DD/MM/YYYY');
    end if;
  end if;

  -- Il fornitore: per partita IVA (o codice fiscale), sulla stessa società.
  select array_agg(s.id order by s.created_at) into v_fornitori
    from suppliers s
   where s.entity_id = p_entity_id
     and partita_iva_normale(s.tax_code) is not null
     and partita_iva_normale(s.tax_code) in (v_piva, v_cf);

  if coalesce(array_length(v_fornitori, 1), 0) > 1 then
    raise exception 'Ci sono % fornitori con la partita IVA % (%): tienine uno solo da Magazzino → Fornitori e riprova.',
      array_length(v_fornitori, 1), coalesce(v_piva, v_cf),
      (select string_agg(name, ', ' order by name) from suppliers where id = any(v_fornitori));
  end if;

  if v_fornitori is null then
    insert into suppliers (entity_id, name, tax_code, contact_email)
    values (p_entity_id, v_nome_forn, coalesce(v_piva, v_cf),
            nullif(btrim(coalesce(v_forn->>'email', '')), ''))
    returning id into v_fornitore;
    v_nuovo := true;
  else
    v_fornitore := v_fornitori[1];
  end if;

  -- La stessa fattura scritta prima a mano: stesso fornitore, numero e data.
  select si.id, si.amount into v_doppia
    from supplier_invoices si
   where si.supplier_id = v_fornitore
     and si.invoice_date = v_data
     and regexp_replace(upper(coalesce(si.invoice_number, '')), '[^A-Z0-9]', '', 'g')
       = regexp_replace(upper(v_numero), '[^A-Z0-9]', '', 'g');
  if found then
    raise exception 'La fattura n. % del % di questo fornitore e'' gia'' registrata (%, forse a mano). Se e'' la stessa, non serve caricarla; se quella a mano era sbagliata, toglila prima da Fatture fornitori.',
      v_numero, to_char(v_data, 'DD/MM/YYYY'), euro(v_doppia.amount);
  end if;

  -- Il percorso di sempre: fattura + promemoria in Agenda.
  v_inv := create_supplier_invoice(
    p_entity_id, v_fornitore, v_data, v_totale, v_numero, v_scadenza, null,
    nullif(btrim(coalesce(p_fattura->>'note', '')), ''));

  update supplier_invoices
     set imponibile = nullif(p_fattura->>'imponibile', '')::numeric,
         imposta    = nullif(p_fattura->>'imposta', '')::numeric,
         file_sdi   = v_file
   where id = v_inv;

  return jsonb_build_object('fattura_id', v_inv, 'fornitore_id', v_fornitore, 'fornitore_nuovo', v_nuovo);
end $fn$;
comment on function registra_fattura_elettronica(uuid, jsonb) is
  'Registra una fattura d''acquisto letta da un file elettronico (FatturaPA): trova il fornitore per partita IVA o lo crea, rifiuta i doppioni (stesso file, oppure stesso fornitore + numero + data) e registra col percorso di create_supplier_invoice. Fornitore e fattura: due tabelle, quindi dal corridoio.';
revoke all on function registra_fattura_elettronica(uuid, jsonb) from public, anon, authenticated;
grant execute on function registra_fattura_elettronica(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 4. I movimenti della banca
-- ---------------------------------------------------------------------
create table if not exists movimenti_banca (
  id               uuid primary key default gen_random_uuid(),
  conto_id         uuid not null references conti_bancari(id) on delete restrict,
  impronta         text not null,
  data_contabile   date not null,
  data_valuta      date not null,
  importo          numeric(14,2) not null,
  causale_abi      text,
  causale_interna  text,
  riferimento_banca text,
  numero_assegno   text,
  descrizione      text not null,
  dettagli         text,
  iban_controparte text,
  flusso           text not null,
  caricato_il      timestamptz not null default now(),
  caricato_da      uuid default auth.uid(),
  cash_movement_id uuid unique references cash_movements(id) on delete set null,
  ignorato_il      timestamptz,
  ignorato_perche  text,
  unique (conto_id, impronta)
);

comment on table movimenti_banca is
  'I movimenti del conto corrente come li dice la banca, caricati dal flusso CBI. NON sono prima nota: lo diventano quando Alessio li abbina a una fattura o a un movimento, o li registra con la loro causale. Si leggono solo; si scrivono dalle funzioni.';
comment on column movimenti_banca.impronta is
  'Tutto ciò che la banca scrive del movimento, messo insieme: impedisce di caricarlo due volte se il file si ricarica o due file si sovrappongono.';
comment on column movimenti_banca.importo is
  'Con segno, come in banca: negativo è un''uscita, positivo un''entrata.';
comment on column movimenti_banca.flusso is
  'Il nome del file della banca (supporto CBI) da cui è entrato.';
comment on column movimenti_banca.cash_movement_id is
  'Il movimento di prima nota a cui è abbinato. Se quello viene cancellato, questo torna da abbinare: la banca il movimento l''ha fatto lo stesso.';

do $vincoli$
begin
  alter table movimenti_banca drop constraint if exists movimenti_banca_importo_non_zero;
  alter table movimenti_banca add constraint movimenti_banca_importo_non_zero check (importo <> 0);
  alter table movimenti_banca drop constraint if exists movimenti_banca_abbinato_o_ignorato;
  alter table movimenti_banca add constraint movimenti_banca_abbinato_o_ignorato
    check (cash_movement_id is null or ignorato_il is null);
  alter table movimenti_banca drop constraint if exists movimenti_banca_ignorato_col_perche;
  alter table movimenti_banca add constraint movimenti_banca_ignorato_col_perche
    check (ignorato_il is null or nullif(btrim(coalesce(ignorato_perche, '')), '') is not null);
end $vincoli$;
comment on constraint movimenti_banca_importo_non_zero on movimenti_banca is
  'Un movimento di banca da zero euro non esiste.';
comment on constraint movimenti_banca_abbinato_o_ignorato on movimenti_banca is
  'Un movimento della banca o è abbinato o è ignorato, non tutte e due: scioglilo prima di ignorarlo.';
comment on constraint movimenti_banca_ignorato_col_perche on movimenti_banca is
  'Per ignorare un movimento della banca serve scrivere il perché.';

create index if not exists idx_movimenti_banca_conto_data on movimenti_banca (conto_id, data_contabile);

alter table movimenti_banca enable row level security;
drop policy if exists movimenti_banca_titolare on movimenti_banca;
create policy movimenti_banca_titolare on movimenti_banca
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ⚠️ DAL BROWSER SI LEGGE E BASTA: abbinare vuol dire anche controllare
--    importo, verso e conto, e un `update` diretto non controllerebbe niente.
revoke all on movimenti_banca from public, anon, authenticated;
grant select on movimenti_banca to authenticated;

insert into perimetro_registro (tabella, dentro, ragione) values
  ('movimenti_banca', false,
   'La copia di ciò che dice la banca: si ricarica dal suo file in qualunque momento e dall''app non si cancella (si ignora, e resta). Il dato contabile vero vive in cash_movements, che ha la sua traccia. Fuori dal 24/10/2026.')
on conflict (tabella) do nothing;

-- ---------------------------------------------------------------------
-- 5. Caricare un file della banca
-- ---------------------------------------------------------------------
-- Una tabella sola: si chiama dritta (rpc), il corridoio non serve.
create or replace function carica_movimenti_banca(p_iban text, p_flusso text, p_movimenti jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_iban   text := regexp_replace(upper(coalesce(p_iban, '')), '[^A-Z0-9]', '', 'g');
  v_conto  conti_bancari%rowtype;
  v_tot    integer := coalesce(jsonb_array_length(p_movimenti), 0);
  v_nuovi  integer;
  m        jsonb;
begin
  if not is_titolare() then
    raise exception 'Caricare i movimenti della banca e'' riservato al titolare.';
  end if;
  if v_iban = '' then
    raise exception 'Il file della banca non dice di quale conto si tratta.';
  end if;
  if nullif(btrim(coalesce(p_flusso, '')), '') is null then
    raise exception 'Manca il nome del file della banca.';
  end if;

  select * into v_conto
    from conti_bancari c
   where regexp_replace(upper(coalesce(c.iban, '')), '[^A-Z0-9]', '', 'g') = v_iban;
  if v_conto.id is null then
    raise exception 'Il conto % non e'' fra i tuoi conti correnti: aggiungilo da Cassa → Conti correnti con questo IBAN, poi ricarica il file.', v_iban;
  end if;
  if not v_conto.attivo then
    raise exception 'Il conto «%» e'' segnato come chiuso: riaprilo da Cassa → Conti correnti se vuoi caricarne i movimenti.', v_conto.nome;
  end if;

  for m in select * from jsonb_array_elements(coalesce(p_movimenti, '[]'::jsonb)) loop
    if nullif(m->>'impronta', '') is null or nullif(m->>'importo', '') is null
       or nullif(m->>'data_contabile', '') is null or nullif(m->>'data_valuta', '') is null then
      raise exception 'Un movimento del file e'' incompleto: non si carica niente.';
    end if;
  end loop;

  with nuovi as (
    insert into movimenti_banca (
      conto_id, impronta, data_contabile, data_valuta, importo, causale_abi,
      causale_interna, riferimento_banca, numero_assegno, descrizione, dettagli,
      iban_controparte, flusso)
    select v_conto.id, x->>'impronta', (x->>'data_contabile')::date, (x->>'data_valuta')::date,
           (x->>'importo')::numeric, nullif(x->>'causale_abi', ''), nullif(x->>'causale_interna', ''),
           nullif(x->>'riferimento_banca', ''), nullif(x->>'numero_assegno', ''),
           coalesce(x->>'descrizione', ''), nullif(x->>'dettagli', ''),
           nullif(x->>'iban_controparte', ''), btrim(p_flusso)
      from jsonb_array_elements(coalesce(p_movimenti, '[]'::jsonb)) x
    on conflict (conto_id, impronta) do nothing
    returning 1
  )
  select count(*) into v_nuovi from nuovi;

  return jsonb_build_object('conto', v_conto.nome, 'nuovi', v_nuovi, 'gia_presenti', v_tot - v_nuovi);
end $fn$;
comment on function carica_movimenti_banca(text, text, jsonb) is
  'Carica i movimenti di un flusso CBI sul conto con quell''IBAN. Quelli già caricati (stessa impronta) non entrano due volte; restituisce quanti nuovi e quanti già presenti. Non scrive niente in prima nota.';
revoke all on function carica_movimenti_banca(text, text, jsonb) from public, anon, authenticated;
grant execute on function carica_movimenti_banca(text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Le proposte per un movimento
-- ---------------------------------------------------------------------
-- Due generi, sempre con lo STESSO importo al centesimo (un abbinamento a
-- importo diverso non si propone mai):
--   · 'fattura'   — una fattura non pagata della stessa società, per le uscite;
--   · 'movimento' — un movimento di prima nota «banca» già scritto, stesso
--                   verso, entro sette giorni, non abbinato ad altro.
-- I punti ordinano soltanto: il nome del fornitore o il numero della
-- fattura dentro la descrizione della banca contano di più.
create or replace function proposte_movimento_banca(p_movimento uuid)
returns table (genere text, rif_id uuid, titolo text, importo numeric, data date, punti integer)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_m      movimenti_banca%rowtype;
  v_entita uuid;
  v_testo  text;
begin
  if not is_titolare() then
    raise exception 'Le proposte di abbinamento sono riservate al titolare.';
  end if;
  select * into v_m from movimenti_banca where id = p_movimento;
  if v_m.id is null then
    raise exception 'Movimento della banca non trovato.';
  end if;
  select entity_id into v_entita from conti_bancari where id = v_m.conto_id;
  v_testo := upper(v_m.descrizione || ' ' || coalesce(v_m.dettagli, ''));

  return query
  select 'fattura'::text, si.id,
         ('Fattura ' || coalesce(si.invoice_number, 's.n.') || ' — ' || s.name
           || ' del ' || to_char(si.invoice_date, 'DD/MM/YYYY'))::text,
         da_pagare(si), si.invoice_date,
         ( case when exists (
               select 1 from regexp_split_to_table(upper(s.name), '[^A-Z0-9]+') w
                where length(w) >= 4 and w not in ('SRLS', 'SOCIETA', 'SNC', 'SPA')
                  and position(w in v_testo) > 0) then 2 else 0 end
         + case when si.invoice_number is not null
                 and length(regexp_replace(upper(si.invoice_number), '[^A-Z0-9]', '', 'g')) >= 3
                 and position(left(regexp_replace(upper(si.invoice_number), '[^A-Z0-9]', '', 'g'), 5)
                              in regexp_replace(v_testo, '[^A-Z0-9]', '', 'g')) > 0 then 2 else 0 end
         + case when v_m.iban_controparte is not null and position(v_m.iban_controparte in coalesce(si.note, '')) > 0 then 1 else 0 end
         )::integer
    from supplier_invoices si
    join suppliers s on s.id = si.supplier_id
   where v_m.importo < 0
     and si.entity_id = v_entita
     and si.status::text <> 'pagata'
     and da_pagare(si) = -v_m.importo
  union all
  select 'movimento'::text, cm.id,
         (coalesce(nullif(cm.business_purpose, ''), cc.label, 'Movimento')
           || ' del ' || to_char(cm.movement_date, 'DD/MM/YYYY'))::text,
         cm.amount, cm.movement_date,
         (3 - abs(cm.movement_date - v_m.data_contabile) / 3)::integer
    from cash_movements cm
    left join cash_causali cc on cc.id = cm.causale_id
   where cm.entity_id = v_entita
     and cm.mezzo = 'banca'
     and (cm.conto_id is null or cm.conto_id = v_m.conto_id)
     and cm.direction::text = case when v_m.importo < 0 then 'uscita' else 'entrata' end
     and cm.amount = abs(v_m.importo)
     and abs(cm.movement_date - v_m.data_contabile) <= 7
     and not exists (select 1 from movimenti_banca mb where mb.cash_movement_id = cm.id)
   order by 6 desc, 5;
end $fn$;
comment on function proposte_movimento_banca(uuid) is
  'Per un movimento della banca, le fatture non pagate e i movimenti di prima nota con lo stesso importo al centesimo che potrebbero corrispondergli, i più probabili prima. Propone soltanto: abbinare lo decide Alessio.';
revoke all on function proposte_movimento_banca(uuid) from public, anon, authenticated;
grant execute on function proposte_movimento_banca(uuid) to authenticated;

-- Il controllo comune: il movimento esiste ed è ancora da abbinare.
create or replace function movimento_banca_da_abbinare(p_movimento uuid)
returns movimenti_banca
language plpgsql
security definer
set search_path = public
as $fn$
declare v_m movimenti_banca%rowtype;
begin
  if not is_titolare() then
    raise exception 'Abbinare i movimenti della banca e'' riservato al titolare.';
  end if;
  select * into v_m from movimenti_banca where id = p_movimento for update;
  if v_m.id is null then
    raise exception 'Movimento della banca non trovato.';
  end if;
  if v_m.cash_movement_id is not null then
    raise exception 'Questo movimento della banca e'' gia'' abbinato: scioglilo prima, se l''abbinamento era sbagliato.';
  end if;
  if v_m.ignorato_il is not null then
    raise exception 'Questo movimento della banca e'' ignorato: riaprilo prima di abbinarlo.';
  end if;
  return v_m;
end $fn$;
revoke all on function movimento_banca_da_abbinare(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. I gesti
-- ---------------------------------------------------------------------
-- 7a. Questo bonifico paga questa fattura. Tre tabelle (fattura, prima
--     nota, banca) → corridoio. Il pagamento passa da `pay_supplier_invoice`,
--     cioè dalla stessa strada del pulsante «Pagata»: note di credito,
--     promemoria in Agenda e movimento di prima nota compresi.
create or replace function paga_fattura_da_movimento_banca(p_movimento uuid, p_fattura uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_m      movimenti_banca%rowtype := movimento_banca_da_abbinare(p_movimento);
  v_entita uuid;
  v_inv    supplier_invoices%rowtype;
  v_cm     uuid;
begin
  select entity_id into v_entita from conti_bancari where id = v_m.conto_id;
  select * into v_inv from supplier_invoices where id = p_fattura;
  if v_inv.id is null then
    raise exception 'Fattura non trovata.';
  end if;
  if v_m.importo > 0 then
    raise exception 'Questo movimento e'' un''entrata: non puo'' pagare una fattura d''acquisto.';
  end if;
  if v_inv.entity_id is distinct from v_entita then
    raise exception 'La fattura e il conto appartengono a due societa'' diverse.';
  end if;
  if v_inv.status::text = 'pagata' then
    raise exception 'Questa fattura risulta gia'' pagata: abbina il bonifico al suo movimento di prima nota invece.';
  end if;
  if da_pagare(v_inv) is distinct from -v_m.importo then
    raise exception 'Il bonifico e'' di % e la fattura chiede %: non si abbinano importi diversi.',
      euro(-v_m.importo), euro(da_pagare(v_inv));
  end if;

  perform pay_supplier_invoice(p_fattura, 'bonifico', v_m.data_contabile, v_m.riferimento_banca, null);

  select id into v_cm from cash_movements where supplier_invoice_id = p_fattura;
  if v_cm is null then
    raise exception 'Il pagamento non ha scritto il movimento di prima nota: non si abbina niente.';
  end if;
  update cash_movements set conto_id = v_m.conto_id where id = v_cm;
  update movimenti_banca set cash_movement_id = v_cm where id = v_m.id;

  return jsonb_build_object('cash_movement_id', v_cm);
end $fn$;
comment on function paga_fattura_da_movimento_banca(uuid, uuid) is
  'Il bonifico della banca paga la fattura: la segna pagata col percorso di sempre (data dell''uscita = data contabile della banca, riferimento = quello della banca), mette il movimento di prima nota su quel conto e lo abbina. Solo a importo identico.';
revoke all on function paga_fattura_da_movimento_banca(uuid, uuid) from public, anon, authenticated;
grant execute on function paga_fattura_da_movimento_banca(uuid, uuid) to authenticated;

-- 7b. Questo movimento della banca È quel movimento di prima nota. Una
--     tabella sola → rpc.
create or replace function abbina_movimento_banca(p_movimento uuid, p_cash_movement uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_m      movimenti_banca%rowtype := movimento_banca_da_abbinare(p_movimento);
  v_entita uuid;
  v_cm     cash_movements%rowtype;
begin
  select entity_id into v_entita from conti_bancari where id = v_m.conto_id;
  select * into v_cm from cash_movements where id = p_cash_movement;
  if v_cm.id is null then
    raise exception 'Movimento di prima nota non trovato.';
  end if;
  if v_cm.mezzo is distinct from 'banca' then
    raise exception 'Quel movimento di prima nota e'' di cassa, non di banca.';
  end if;
  if v_cm.entity_id is distinct from v_entita
     or (v_cm.conto_id is not null and v_cm.conto_id is distinct from v_m.conto_id) then
    raise exception 'Quel movimento di prima nota e'' su un altro conto.';
  end if;
  if v_cm.direction::text is distinct from (case when v_m.importo < 0 then 'uscita' else 'entrata' end)
     or v_cm.amount is distinct from abs(v_m.importo) then
    raise exception 'Gli importi non coincidono: in banca % , in prima nota % (%).',
      euro(v_m.importo), euro(v_cm.amount), v_cm.direction;
  end if;
  if exists (select 1 from movimenti_banca where cash_movement_id = p_cash_movement) then
    raise exception 'Quel movimento di prima nota e'' gia'' abbinato a un altro movimento della banca.';
  end if;

  update movimenti_banca set cash_movement_id = p_cash_movement where id = v_m.id;
end $fn$;
comment on function abbina_movimento_banca(uuid, uuid) is
  'Abbina un movimento della banca a un movimento di prima nota «banca» già scritto: stesso conto, stesso verso, stesso importo al centesimo.';
revoke all on function abbina_movimento_banca(uuid, uuid) from public, anon, authenticated;
grant execute on function abbina_movimento_banca(uuid, uuid) to authenticated;

-- 7c. Un movimento che in prima nota non c'è ancora (una commissione, un
--     addebito della banca): si scrive, con la causale e il documento che
--     dice Alessio, e si abbina. Due tabelle → corridoio.
--
-- ⚠️ IL TIPO DI DOCUMENTO SI CHIEDE, non si mette un predefinito: «senza
--    documento» viene prima di ogni regola di deducibilità (§6), e
--    sceglierlo al posto suo deciderebbe una cosa fiscale in silenzio.
create or replace function registra_movimento_banca(
  p_movimento uuid, p_causale uuid, p_tipo_documento text, p_descrizione text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_m      movimenti_banca%rowtype := movimento_banca_da_abbinare(p_movimento);
  v_entita uuid;
  v_cm     uuid;
begin
  -- ⚠️ Le causali DI SISTEMA (versamenti, differenze di cassa, rimborsi)
  --    sono spostamenti di denaro, non spese: sceglierne una qui farebbe
  --    sparire un costo vero dai conti in silenzio. E il verso deve
  --    combaciare: una causale d'entrata su un addebito è un errore.
  if p_causale is null or not exists (
       select 1 from cash_causali
        where id = p_causale and active and not di_sistema
          and kind = (case when v_m.importo < 0 then 'uscita' else 'entrata' end)) then
    raise exception 'Scegli una causale di %: fra le tue, attiva.',
      case when v_m.importo < 0 then 'uscita' else 'entrata' end;
  end if;
  if nullif(btrim(coalesce(p_tipo_documento, '')), '') is null then
    raise exception 'Di'' se c''e'' un documento per questo movimento.';
  end if;
  select entity_id into v_entita from conti_bancari where id = v_m.conto_id;

  insert into cash_movements (
    entity_id, direction, amount, movement_date, mezzo, conto_id, causale_id,
    tipo_documento, business_purpose, riferimento_pagamento)
  values (
    v_entita,
    (case when v_m.importo < 0 then 'uscita' else 'entrata' end)::cash_direction,
    abs(v_m.importo), v_m.data_contabile, 'banca', v_m.conto_id, p_causale,
    p_tipo_documento::cash_document_type,
    coalesce(nullif(btrim(coalesce(p_descrizione, '')), ''), v_m.descrizione),
    v_m.riferimento_banca)
  returning id into v_cm;

  update movimenti_banca set cash_movement_id = v_cm where id = v_m.id;
  return jsonb_build_object('cash_movement_id', v_cm);
end $fn$;
comment on function registra_movimento_banca(uuid, uuid, text, text) is
  'Scrive in prima nota un movimento che c''è in banca e non ancora nel gestionale (con la causale e il tipo di documento scelti da Alessio) e lo abbina.';
revoke all on function registra_movimento_banca(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function registra_movimento_banca(uuid, uuid, text, text) to authenticated;

-- 7d. Ignorare (col perché) e tornare indietro. Una tabella → rpc.
create or replace function ignora_movimento_banca(p_movimento uuid, p_perche text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare v_m movimenti_banca%rowtype := movimento_banca_da_abbinare(p_movimento);
begin
  if nullif(btrim(coalesce(p_perche, '')), '') is null then
    raise exception 'Per ignorare un movimento della banca serve scrivere il perche''.';
  end if;
  update movimenti_banca set ignorato_il = now(), ignorato_perche = btrim(p_perche) where id = v_m.id;
end $fn$;
comment on function ignora_movimento_banca(uuid, text) is
  'Toglie un movimento della banca da quelli da abbinare, col perché. Resta visibile fra gli ignorati e si riapre.';
revoke all on function ignora_movimento_banca(uuid, text) from public, anon, authenticated;
grant execute on function ignora_movimento_banca(uuid, text) to authenticated;

-- ⚠️ Riaprire scioglie l'abbinamento ma NON cancella il movimento di prima
--    nota: se quello era sbagliato si toglie da Prima nota (o si annulla il
--    pagamento della fattura), con le sue regole. Due gesti diversi.
create or replace function riapri_movimento_banca(p_movimento uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not is_titolare() then
    raise exception 'Riaprire un movimento della banca e'' riservato al titolare.';
  end if;
  update movimenti_banca
     set cash_movement_id = null, ignorato_il = null, ignorato_perche = null
   where id = p_movimento;
  if not found then
    raise exception 'Movimento della banca non trovato.';
  end if;
end $fn$;
comment on function riapri_movimento_banca(uuid) is
  'Riporta un movimento della banca fra quelli da abbinare: scioglie l''abbinamento o toglie l''ignorato. Non cancella niente in prima nota.';
revoke all on function riapri_movimento_banca(uuid) from public, anon, authenticated;
grant execute on function riapri_movimento_banca(uuid) to authenticated;

-- =====================================================================
-- VERIFICA — tutto dentro una sotto-transazione che si annulla
-- =====================================================================
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_entita   uuid;
  v_conto    uuid;
  v_iban     text := 'IT00Z9999999999000000000001';
  v_r        jsonb;
  v_fatt     uuid;
  v_forn     uuid;
  v_mb_f     uuid;
  v_mb_c     uuid;
  v_mb_e     uuid;
  v_cm       uuid;
  v_causale  uuid;
  v_n        integer;
  v_respinto boolean;
  v_fattura  jsonb;
  v_movs     jsonb;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles.';
  end if;

  if has_function_privilege('anon', 'registra_fattura_elettronica(uuid, jsonb)', 'execute')
     or has_function_privilege('anon', 'carica_movimenti_banca(text, text, jsonb)', 'execute')
     or has_function_privilege('anon', 'paga_fattura_da_movimento_banca(uuid, uuid)', 'execute')
     or has_function_privilege('anon', 'registra_movimento_banca(uuid, uuid, text, text)', 'execute')
     or has_function_privilege('authenticated', 'movimento_banca_da_abbinare(uuid)', 'execute') then
    raise exception 'VERIFICA: una porta della banca o delle fatture elettroniche e'' aperta a chi non deve.';
  end if;
  if has_table_privilege('authenticated', 'movimenti_banca', 'insert')
     or has_table_privilege('authenticated', 'movimenti_banca', 'update')
     or has_table_privilege('authenticated', 'movimenti_banca', 'delete') then
    raise exception 'VERIFICA: dal browser si scrive dritto nei movimenti della banca.';
  end if;
  if partita_iva_normale(' it 123-4567 8903 ') is distinct from '12345678903'
     or partita_iva_normale('DE123456789') is distinct from 'DE123456789'
     or partita_iva_normale('') is not null then
    raise exception 'VERIFICA: la partita IVA non si normalizza come previsto.';
  end if;

  begin  -- <<< la sotto-transazione che verra' annullata
    select id into v_entita from entities where entity_type::text = 'srls' order by created_at limit 1;
    if v_entita is null then raise exception 'VERIFICA: manca la societa''.'; end if;

    -- ⚠️ DUE conti propri, e quello dei movimenti NON è il predefinito: il
    --    pagamento di una fattura nasce senza conto e il trigger lo mette sul
    --    predefinito. Solo così si vede che il gesto lo sposta sul conto
    --    giusto — con un conto solo il controllo passerebbe anche senza.
    update conti_bancari set predefinito = false where entity_id = v_entita;
    insert into conti_bancari (entity_id, nome, iban, attivo, predefinito)
    values (v_entita, 'ZZ verifica altro', 'IT00Z9999999999000000000002', true, true);
    insert into conti_bancari (entity_id, nome, iban, attivo, predefinito)
    values (v_entita, 'ZZ verifica', 'IT00 Z999 9999 9990 0000 0000 001', true, false)
    returning id into v_conto;
    insert into cash_causali (label, kind) values ('ZZ verifica commissioni', 'uscita')
    returning id into v_causale;

    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- 1. La fattura elettronica: fornitore creato, fattura registrata.
    v_fattura := jsonb_build_object(
      'tipo', 'TD01', 'numero', 'ZZ 12/26', 'data', '2026-10-09', 'scadenza', '2026-10-30',
      'totale', 122.00, 'imponibile', 100.00, 'imposta', 22.00, 'file_sdi', 'ZZ_verifica_00001.xml.p7m',
      'fornitore', jsonb_build_object('denominazione', 'ZZ Verificatrice Forniture srl',
        'partita_iva', 'IT99999999901', 'email', 'zz@example.invalid'),
      'cliente', jsonb_build_object('partita_iva', 'IT99999999902'));
    v_r := registra_fattura_elettronica(v_entita, v_fattura);
    v_fatt := (v_r->>'fattura_id')::uuid;
    v_forn := (v_r->>'fornitore_id')::uuid;
    if not (v_r->>'fornitore_nuovo')::boolean
       or (select tax_code from suppliers where id = v_forn) is distinct from '99999999901'
       or not exists (select 1 from supplier_invoices where id = v_fatt and amount = 122.00
                        and imponibile = 100.00 and imposta = 22.00 and invoice_number = 'ZZ 12/26'
                        and due_date = '2026-10-30' and task_id is not null) then
      raise exception 'VERIFICA: la fattura elettronica non e'' stata registrata come attesa (%).', v_r;
    end if;

    -- 2. Lo stesso file non entra due volte.
    v_respinto := false;
    begin perform registra_fattura_elettronica(v_entita, v_fattura);
    exception when others then v_respinto := sqlerrm like '%gia'' stata registrata%'; end;
    if not v_respinto then raise exception 'VERIFICA: lo stesso file e'' entrato due volte.'; end if;

    -- 3. Stesso fornitore + numero + data da un altro file: è la stessa fattura.
    v_respinto := false;
    begin perform registra_fattura_elettronica(v_entita,
      v_fattura || jsonb_build_object('file_sdi', 'ZZ_verifica_00002.xml', 'numero', 'zz12-26'));
    exception when others then v_respinto := sqlerrm like '%gia'' registrata%'; end;
    if not v_respinto then raise exception 'VERIFICA: la stessa fattura e'' entrata da un altro file.'; end if;

    -- 4. La seconda fattura dello stesso fornitore lo RITROVA, non lo rifà.
    v_r := registra_fattura_elettronica(v_entita,
      v_fattura || jsonb_build_object('file_sdi', 'ZZ_verifica_00003.xml', 'numero', 'ZZ 13/26', 'totale', 50,
        'fornitore', jsonb_build_object('denominazione', 'altro nome', 'partita_iva', '99999999901')));
    if (v_r->>'fornitore_nuovo')::boolean or (v_r->>'fornitore_id')::uuid is distinct from v_forn then
      raise exception 'VERIFICA: il fornitore non e'' stato ritrovato per partita IVA.';
    end if;

    -- 5. Una nota di credito non entra.
    v_respinto := false;
    begin perform registra_fattura_elettronica(v_entita,
      v_fattura || jsonb_build_object('tipo', 'TD04', 'file_sdi', 'ZZ_verifica_00004.xml', 'numero', 'NC1'));
    exception when others then v_respinto := sqlerrm like '%non si registra da qui%'; end;
    if not v_respinto then raise exception 'VERIFICA: una nota di credito e'' entrata come fattura.'; end if;

    -- 6. Intestata a un'altra partita IVA: respinta, se quella della società è scritta.
    update entities set vat_number = 'IT99999999909' where id = v_entita;
    v_respinto := false;
    begin perform registra_fattura_elettronica(v_entita,
      v_fattura || jsonb_build_object('file_sdi', 'ZZ_verifica_00005.xml', 'numero', 'ZZ 14/26'));
    exception when others then v_respinto := sqlerrm like '%non e'' una fattura di questa societa''%'; end;
    if not v_respinto then raise exception 'VERIFICA: una fattura intestata ad altri e'' entrata.'; end if;

    -- 7. Il file della banca: tre movimenti, ricaricato non raddoppia.
    v_movs := jsonb_build_array(
      jsonb_build_object('impronta', 'zz§1', 'data_contabile', '2026-10-20', 'data_valuta', '2026-10-20',
        'importo', -122.00, 'causale_abi', '26', 'riferimento_banca', 'ZZRIF1',
        'descrizione', 'BONIFICO A DEBITO', 'dettagli', 'A FAVORE DI ZZ Verificatrice Forniture fattura nr. ZZ 12/26'),
      jsonb_build_object('impronta', 'zz§2', 'data_contabile', '2026-10-20', 'data_valuta', '2026-10-20',
        'importo', -1.00, 'causale_abi', '16', 'descrizione', 'COMM. BONIFICO'),
      jsonb_build_object('impronta', 'zz§3', 'data_contabile', '2026-10-20', 'data_valuta', '2026-10-20',
        'importo', 500.00, 'causale_abi', '48', 'descrizione', 'BONIFICO A CREDITO'));
    v_r := carica_movimenti_banca('it00z9999999999000000000001', 'ZZ_FLUSSO', v_movs);
    if (v_r->>'nuovi')::int <> 3 or (v_r->>'gia_presenti')::int <> 0 then
      raise exception 'VERIFICA: il primo caricamento non ha messo tre movimenti (%).', v_r;
    end if;
    v_r := carica_movimenti_banca(v_iban, 'ZZ_FLUSSO_BIS', v_movs);
    if (v_r->>'nuovi')::int <> 0 or (v_r->>'gia_presenti')::int <> 3 then
      raise exception 'VERIFICA: ricaricare lo stesso file ha fatto entrare qualcosa (%).', v_r;
    end if;
    select id into v_mb_f from movimenti_banca where conto_id = v_conto and impronta = 'zz§1';
    select id into v_mb_c from movimenti_banca where conto_id = v_conto and impronta = 'zz§2';
    select id into v_mb_e from movimenti_banca where conto_id = v_conto and impronta = 'zz§3';

    -- ⚠️ Caricare non scrive in prima nota.
    if exists (select 1 from cash_movements where conto_id = v_conto) then
      raise exception 'VERIFICA: caricare il file della banca ha scritto in prima nota.';
    end if;

    -- 8. Un IBAN che non è un conto registrato si ferma con la strada.
    v_respinto := false;
    begin perform carica_movimenti_banca('IT00Z0000000000000000000000', 'ZZ', v_movs);
    exception when others then v_respinto := sqlerrm like '%Cassa → Conti correnti%'; end;
    if not v_respinto then raise exception 'VERIFICA: un conto sconosciuto e'' stato caricato.'; end if;

    -- 9. La proposta: la fattura giusta, coi punti del nome e del numero.
    select count(*) into v_n from proposte_movimento_banca(v_mb_f) p
     where p.genere = 'fattura' and p.rif_id = v_fatt and p.punti >= 4;
    if v_n <> 1 then
      raise exception 'VERIFICA: la fattura non e'' fra le proposte del bonifico (o senza i suoi punti).';
    end if;
    if exists (select 1 from proposte_movimento_banca(v_mb_c) p where p.rif_id = v_fatt) then
      raise exception 'VERIFICA: e'' stata proposta una fattura a importo diverso.';
    end if;

    -- 10. Il bonifico paga la fattura.
    v_r := paga_fattura_da_movimento_banca(v_mb_f, v_fatt);
    v_cm := (v_r->>'cash_movement_id')::uuid;
    if (select status::text from supplier_invoices where id = v_fatt) is distinct from 'pagata'
       or not exists (select 1 from cash_movements where id = v_cm and conto_id = v_conto
                        and amount = 122.00 and movement_date = '2026-10-20'
                        and riferimento_pagamento = 'ZZRIF1' and supplier_invoice_id = v_fatt)
       or (select cash_movement_id from movimenti_banca where id = v_mb_f) is distinct from v_cm then
      raise exception 'VERIFICA: il bonifico non ha pagato la fattura come atteso.';
    end if;
    v_respinto := false;
    begin perform paga_fattura_da_movimento_banca(v_mb_f, v_fatt);
    exception when others then v_respinto := sqlerrm like '%gia'' abbinato%'; end;
    if not v_respinto then raise exception 'VERIFICA: lo stesso bonifico ha pagato due volte.'; end if;

    -- 11. La commissione si registra con la sua causale.
    v_respinto := false;
    begin perform registra_movimento_banca(v_mb_c, v_causale, null);
    exception when others then v_respinto := sqlerrm like '%documento%'; end;
    if not v_respinto then raise exception 'VERIFICA: un movimento e'' stato registrato senza dire del documento.'; end if;
    v_r := registra_movimento_banca(v_mb_c, v_causale, 'non_documentato', null);
    if not exists (select 1 from cash_movements where id = (v_r->>'cash_movement_id')::uuid
                     and direction::text = 'uscita' and amount = 1.00 and mezzo = 'banca'
                     and conto_id = v_conto and causale_id = v_causale and business_purpose = 'COMM. BONIFICO') then
      raise exception 'VERIFICA: la commissione non e'' stata scritta come attesa.';
    end if;

    -- 12. L'entrata si abbina a un movimento già scritto — e solo se combacia.
    insert into cash_movements (entity_id, direction, amount, movement_date, mezzo, conto_id, causale_id, business_purpose)
    values (v_entita, 'entrata', 499.00, '2026-10-21', 'banca', v_conto, v_causale, 'ZZ sbagliato')
    returning id into v_cm;
    v_respinto := false;
    begin perform abbina_movimento_banca(v_mb_e, v_cm);
    exception when others then v_respinto := sqlerrm like '%non coincidono%'; end;
    if not v_respinto then raise exception 'VERIFICA: si e'' abbinato un importo diverso.'; end if;
    update cash_movements set amount = 500.00 where id = v_cm;
    if not exists (select 1 from proposte_movimento_banca(v_mb_e) p where p.genere = 'movimento' and p.rif_id = v_cm) then
      raise exception 'VERIFICA: il movimento gia'' scritto non e'' proposto.';
    end if;
    perform abbina_movimento_banca(v_mb_e, v_cm);

    -- 13. Cancellato il movimento di prima nota, quello della banca torna da abbinare.
    delete from cash_movements where id = v_cm;
    if (select cash_movement_id from movimenti_banca where id = v_mb_e) is not null then
      raise exception 'VERIFICA: il movimento della banca e'' rimasto abbinato a un movimento cancellato.';
    end if;

    -- 14. Ignorare vuole il perché; riaprire torna indietro.
    v_respinto := false;
    begin perform ignora_movimento_banca(v_mb_e, '  ');
    exception when others then v_respinto := sqlerrm like '%perche''%'; end;
    if not v_respinto then raise exception 'VERIFICA: si e'' ignorato un movimento senza perche''.'; end if;
    perform ignora_movimento_banca(v_mb_e, 'ZZ prova');
    perform riapri_movimento_banca(v_mb_e);
    if exists (select 1 from movimenti_banca where id = v_mb_e and ignorato_il is not null) then
      raise exception 'VERIFICA: riaprire non ha tolto l''ignorato.';
    end if;

    -- 15. Il portiere: lo staff riceve un rifiuto.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_respinto := false;
    begin perform carica_movimenti_banca(v_iban, 'ZZ', v_movs);
    exception when others then v_respinto := sqlerrm like '%riservato al titolare%'; end;
    if not v_respinto then raise exception 'VERIFICA: lo staff ha caricato movimenti della banca.'; end if;
    v_respinto := false;
    begin perform registra_fattura_elettronica(v_entita, v_fattura);
    exception when others then v_respinto := sqlerrm like '%riservato al titolare%'; end;
    if not v_respinto then raise exception 'VERIFICA: lo staff ha registrato una fattura.'; end if;
    v_respinto := false;
    begin perform proposte_movimento_banca(v_mb_e);
    exception when others then v_respinto := sqlerrm like '%riservate al titolare%'; end;
    if not v_respinto then raise exception 'VERIFICA: lo staff ha visto le proposte di abbinamento.'; end if;

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della banca e delle fatture elettroniche');

  raise notice 'Fatto: la fattura elettronica entra una volta sola e ritrova il fornitore per partita IVA; il file della banca non raddoppia e non scrive in prima nota; il bonifico paga la fattura a importo identico; commissioni registrate con causale e documento; abbinamenti solo se combaciano; staff respinto. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261024000001', 'la_banca_e_le_fatture_entrano_da_file')
on conflict (version) do nothing;
