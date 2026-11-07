-- =====================================================================
-- IL PIANO DELL'INVESTIMENTO — 07/11/2026.
-- =====================================================================
--
-- 🔴 A CHE DOMANDA RISPONDE: *sto sforando il budget?* Il «Costo del
--    progetto» dice quanto è stato SPESO; mancava quanto era PREVISTO, voce
--    per voce, con l'acconto prima dell'apertura e le rate dei mesi dopo.
--    Il punto di partenza è il foglio di Alessio del 21/05/2026 (82.650 €
--    IVA inclusa, 5 gruppi).
--
-- 🔴 SUPERA LA DECISIONE DEL 31/08 «nessuna tabella nuova»: quella
--    decisione riguardava lo SPESO, che resta un'etichetta su prima nota e
--    anticipazioni (migrazione 20260921000003) e qui non si copia. Il
--    PREVISTO invece non esiste da nessuna parte, e una simulazione da
--    aggiustare ha bisogno di un posto suo. Alessio ha scelto il 07/11 di
--    tenerlo anche dopo l'apertura: le rate arrivano a ottobre 2027.
--
-- Le scelte di Alessio del 07/11, tutte qui dentro:
--   · l'acconto è quello che si paga prima di aprire (mese 0);
--   · il mese 1 è il mese dell'apertura, aprile 2027, e le rate si contano
--     dall'apertura: se l'apertura slitta, si cambia una data sola;
--   · l'IVA si sceglie voce per voce (affitto, bolli, assicurazione: 0);
--   · le spese vere si collegano a mano alla voce: nessuna regola le
--     indovina da parole, date o importi;
--   · una voce con le rate che non tornano si salva lo stesso: è una
--     simulazione, e il ✗ lo calcola il gestionale (non si salva).
--
-- ⚠️ QUESTA MIGRAZIONE NON SCRIVE NESSUNA VOCE. Il foglio del 21/05 entra
--    più avanti, su work, solo dopo che Alessio ha visto l'elenco corretto.
--    Su Prova si usano dati finti.
--
-- ⚠️ SOLO IL TITOLARE, su tutte e quattro le tabelle: RLS «for all» con
--    is_titolare(), e niente ad anon.

-- ---------------------------------------------------------------------
-- 1. LA DATA DELL'APERTURA (una riga sola)
-- ---------------------------------------------------------------------
create table if not exists piano_impostazioni (
  id            boolean primary key default true,
  mese_apertura date not null default '2027-04-01',
  aggiornato_il timestamptz not null default now(),
  constraint piano_impostazioni_una_sola check (id),
  constraint piano_apertura_primo_del_mese check (extract(day from mese_apertura) = 1)
);

comment on table piano_impostazioni is
  'Il mese dell''apertura del locale, per il piano dell''investimento (07/11/2026). Le rate sono scritte come «mesi dall''apertura»: cambiando questa data si sposta tutto il calendario dei pagamenti.';
comment on constraint piano_impostazioni_una_sola on piano_impostazioni is
  'Il piano dell''investimento ha una sola data di apertura: si cambia quella che c''è, non se ne aggiunge un''altra.';
comment on constraint piano_apertura_primo_del_mese on piano_impostazioni is
  'L''apertura si indica come mese: scegli il primo giorno del mese (per esempio 1 aprile 2027).';

insert into piano_impostazioni (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. LE VOCI
-- ---------------------------------------------------------------------
create table if not exists piano_voci (
  id            uuid primary key default gen_random_uuid(),
  gruppo        text not null,
  ordine        integer not null default 0,
  descrizione   text not null,
  importo_ivato numeric(12,2) not null,
  aliquota_iva  numeric(4,2) not null default 22,
  netto         numeric(12,2) generated always as (round(importo_ivato / (1 + aliquota_iva / 100), 2)) stored,
  stato         text not null default 'stimato',
  dilazione     text not null default 'nessuna',
  nota          text,
  archiviata_il timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint piano_voce_gruppo_noto check (gruppo in ('A', 'B', 'C', 'D', 'E')),
  constraint piano_voce_con_nome check (btrim(descrizione) <> ''),
  constraint piano_voce_importo_non_negativo check (importo_ivato >= 0),
  constraint piano_voce_aliquota_nota check (aliquota_iva in (0, 4, 5, 10, 22)),
  constraint piano_voce_stato_noto check (stato in ('stimato', 'preventivato', 'confermato')),
  constraint piano_voce_dilazione_nota check (dilazione in ('nessuna', 'stimata', 'confermata'))
);

comment on table piano_voci is
  'Le voci del piano dell''investimento: quanto si prevede di spendere per ogni cosa, IVA inclusa (07/11/2026). È una simulazione: stato e dilazione dicono quanto è sicuro il numero. Lo speso vero NON è qui: viene dalle spese segnate «investimento», collegate a mano in piano_collegamenti.';
comment on column piano_voci.importo_ivato is
  'Quanto si prevede di pagare, IVA inclusa: è quello che esce davvero dalla cassa, ed è il numero che si confronta con lo speso.';
comment on column piano_voci.netto is
  'Calcolato dal database dall''importo e dall''aliquota della voce: non si scrive.';
comment on constraint piano_voce_gruppo_noto on piano_voci is
  'Il gruppo della voce è una lettera da A a E: attrezzature, impianti, lavori edili, arredi, avvio e spese tecniche.';
comment on constraint piano_voce_con_nome on piano_voci is
  'Una voce del piano ha bisogno di un nome: scrivi che cosa è (per esempio «Cappa aspirazione»).';
comment on constraint piano_voce_importo_non_negativo on piano_voci is
  'L''importo previsto di una voce non può essere negativo: se la voce non costa niente, scrivi zero.';
comment on constraint piano_voce_aliquota_nota on piano_voci is
  'L''IVA di una voce può essere 0, 4, 5, 10 o 22 per cento.';
comment on constraint piano_voce_stato_noto on piano_voci is
  'Lo stato di una voce è «stimato», «preventivato» o «confermato».';
comment on constraint piano_voce_dilazione_nota on piano_voci is
  'La dilazione di una voce è «nessuna», «stimata» o «confermata».';

create index if not exists idx_piano_voci_gruppo on piano_voci(gruppo, ordine) where archiviata_il is null;

drop trigger if exists piano_voci_aggiornata on piano_voci;
create trigger piano_voci_aggiornata
  before update on piano_voci
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 3. L'ACCONTO E LE RATE
-- ---------------------------------------------------------------------
create table if not exists piano_rate (
  id        uuid primary key default gen_random_uuid(),
  voce_id   uuid not null references piano_voci(id) on delete cascade,
  mese_rel  smallint not null,
  importo   numeric(12,2) not null,
  constraint piano_rata_mese_nel_piano check (mese_rel between 0 and 12),
  constraint piano_rata_importo_positivo check (importo > 0),
  constraint piano_rata_una_per_mese unique (voce_id, mese_rel)
);

comment on table piano_rate is
  'Come si paga una voce del piano: mese 0 = acconto, prima dell''apertura; mese 1 = il mese dell''apertura (piano_impostazioni), mese 2 il seguente, e così via fino a 12 (07/11/2026). Che la somma faccia l''importo della voce lo calcola il gestionale (il ✓): non è un vincolo, perché una simulazione si salva anche quando non torna.';
comment on constraint piano_rata_mese_nel_piano on piano_rate is
  'Una rata va dall''acconto (prima dell''apertura) al dodicesimo mese dopo l''apertura.';
comment on constraint piano_rata_importo_positivo on piano_rate is
  'Una rata deve essere più di zero: un mese senza pagamento si lascia vuoto.';
comment on constraint piano_rata_una_per_mese on piano_rate is
  'Questa voce ha già una rata in quel mese: cambia l''importo di quella invece di aggiungerne un''altra.';

create index if not exists idx_piano_rate_voce on piano_rate(voce_id);

-- ---------------------------------------------------------------------
-- 4. IL COLLEGAMENTO FRA LA VOCE E LA SPESA VERA
-- ---------------------------------------------------------------------
-- 🔴 SEMPRE A MANO, E SEMPRE CON UN IDENTIFICATIVO: una riga di prima nota,
--    un'anticipazione o una fattura. Mai riconosciuto da parole o importi.
--    `importo_attribuito` serve quando un pagamento copre più voci.
-- ⚠️ Se la spesa sparisce, sparisce anche il collegamento (cascade): un
--    collegamento a niente sarebbe un numero senza origine.
create table if not exists piano_collegamenti (
  id                  uuid primary key default gen_random_uuid(),
  voce_id             uuid not null references piano_voci(id) on delete restrict,
  rata_id             uuid references piano_rate(id) on delete set null,
  cash_movement_id    uuid references cash_movements(id) on delete cascade,
  anticipazione_id    uuid references anticipazioni_socio(id) on delete cascade,
  supplier_invoice_id uuid references supplier_invoices(id) on delete cascade,
  importo_attribuito  numeric(12,2) not null,
  created_at          timestamptz not null default now(),
  constraint piano_collegamento_una_origine
    check (num_nonnulls(cash_movement_id, anticipazione_id, supplier_invoice_id) = 1),
  constraint piano_collegamento_importo_positivo check (importo_attribuito > 0),
  -- Vincoli veri e non indici parziali, perché abbiano la loro frase: i
  -- NULL sono distinti, quindi valgono solo per l'origine riempita.
  constraint piano_collegamento_movimento_una_volta unique (voce_id, cash_movement_id),
  constraint piano_collegamento_anticipo_una_volta unique (voce_id, anticipazione_id),
  constraint piano_collegamento_fattura_una_volta unique (voce_id, supplier_invoice_id)
);

comment on table piano_collegamenti is
  'Quale spesa vera va a quale voce del piano, scelto a mano da Alessio (07/11/2026). Una spesa può andare su più voci, con un importo per ognuna.';
comment on constraint piano_collegamento_una_origine on piano_collegamenti is
  'Un collegamento del piano indica una spesa sola: una riga di prima nota, un anticipo o una fattura.';
comment on constraint piano_collegamento_importo_positivo on piano_collegamenti is
  'La parte di spesa che assegni a una voce deve essere più di zero.';
comment on constraint piano_collegamenti_voce_id_fkey on piano_collegamenti is
  'Questa voce del piano ha delle spese collegate: archiviala invece di cancellarla, oppure togli prima i collegamenti.';

comment on constraint piano_collegamento_movimento_una_volta on piano_collegamenti is
  'Questa riga di prima nota è già collegata a questa voce: cambia l''importo assegnato invece di collegarla di nuovo.';
comment on constraint piano_collegamento_anticipo_una_volta on piano_collegamenti is
  'Questo anticipo è già collegato a questa voce: cambia l''importo assegnato invece di collegarlo di nuovo.';
comment on constraint piano_collegamento_fattura_una_volta on piano_collegamenti is
  'Questa fattura è già collegata a questa voce: cambia l''importo assegnato invece di collegarla di nuovo.';

-- ⚠️ UNA FATTURA NON HA L'ETICHETTA «investimento»: il trigger non può
--    chiederla. Che la stessa fattura non conti due volte (collegata qui e
--    pagata con un movimento o un anticipo collegati) lo decide il calcolo
--    dello speso, nella PR 3: una fattura conta tramite il suo pagamento.
create index if not exists idx_piano_collegamenti_voce on piano_collegamenti(voce_id);
create index if not exists idx_piano_collegamenti_movimento on piano_collegamenti(cash_movement_id) where cash_movement_id is not null;
create index if not exists idx_piano_collegamenti_anticipo on piano_collegamenti(anticipazione_id) where anticipazione_id is not null;
create index if not exists idx_piano_collegamenti_fattura on piano_collegamenti(supplier_invoice_id) where supplier_invoice_id is not null;

-- Il portiere del collegamento: l'origine deve essere una spesa del
-- progetto (Borgo 58 o la tasca, mai l'orto), la somma assegnata non può
-- superarla, e la rata indicata deve essere della stessa voce.
create or replace function piano_collegamento_controlla()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_importo  numeric;
  v_tipo     text;
  v_marcata  boolean;
  v_gia      numeric;
begin
  -- 🔴 LA RIGA D'ORIGINE SI BLOCCA PRIMA DI SOMMARE (for no key update):
  --    due collegamenti insieme sulla stessa spesa, altrimenti, sommerebbero
  --    ognuno senza vedere l'altro, e insieme potrebbero superarla.
  if new.rata_id is not null
     and not exists (select 1 from piano_rate where id = new.rata_id and voce_id = new.voce_id) then
    raise exception 'La rata scelta non è di questa voce del piano: scegli una rata della stessa voce, oppure nessuna.';
  end if;

  if new.cash_movement_id is not null then
    select m.amount, e.entity_type::text, m.e_investimento and m.direction = 'uscita'
      into v_importo, v_tipo, v_marcata
      from cash_movements m join entities e on e.id = m.entity_id
     where m.id = new.cash_movement_id
       for no key update of m;
    if not coalesce(v_marcata, false) then
      raise exception 'Questa riga di prima nota non è segnata «investimento»: segnala prima, poi collegala a una voce del piano.';
    end if;
    select coalesce(sum(importo_attribuito), 0) into v_gia
      from piano_collegamenti
     where cash_movement_id = new.cash_movement_id and id is distinct from new.id;
  elsif new.anticipazione_id is not null then
    select a.importo, e.entity_type::text, a.e_investimento
      into v_importo, v_tipo, v_marcata
      from anticipazioni_socio a join entities e on e.id = a.entity_id
     where a.id = new.anticipazione_id
       for no key update of a;
    if not coalesce(v_marcata, false) then
      raise exception 'Questo anticipo non è segnato «investimento»: segnalo prima, poi collegalo a una voce del piano.';
    end if;
    select coalesce(sum(importo_attribuito), 0) into v_gia
      from piano_collegamenti
     where anticipazione_id = new.anticipazione_id and id is distinct from new.id;
  else
    select i.amount, e.entity_type::text
      into v_importo, v_tipo
      from supplier_invoices i join entities e on e.id = i.entity_id
     where i.id = new.supplier_invoice_id
       for no key update of i;
    select coalesce(sum(importo_attribuito), 0) into v_gia
      from piano_collegamenti
     where supplier_invoice_id = new.supplier_invoice_id and id is distinct from new.id;
  end if;

  if v_tipo is null then
    raise exception 'La spesa da collegare non esiste più.';
  end if;
  if v_tipo not in ('srls', 'tasca') then
    raise exception 'Questa spesa è dell''orto: il piano dell''investimento conta solo Borgo 58 e la tua tasca.';
  end if;
  if v_gia + new.importo_attribuito > v_importo then
    raise exception 'Stai assegnando % € in tutto, ma la spesa è di % €: hai già assegnato % € ad altre voci.',
      to_char(v_gia + new.importo_attribuito, 'FM999G999G990D00'),
      to_char(v_importo, 'FM999G999G990D00'),
      to_char(v_gia, 'FM999G999G990D00');
  end if;
  return new;
end;
$fn$;

revoke all on function piano_collegamento_controlla() from public, anon, authenticated;

drop trigger if exists piano_collegamento_controlla on piano_collegamenti;
create trigger piano_collegamento_controlla
  before insert or update on piano_collegamenti
  for each row execute function piano_collegamento_controlla();

-- 🔴 UNA SPESA COLLEGATA NON PERDE L'ETICHETTA DI NASCOSTO (scelta del
--    07/11): se Alessio toglie «investimento» a una riga che sta in una voce
--    del piano, la riga resterebbe contata nel piano e non nel costo del
--    progetto — due numeri che non tornano, in silenzio. Si rifiuta, e si
--    dice cosa fare.
-- ⚠️ E PER LA STESSA RAGIONE non scende sotto quanto è già assegnato, e
--    non passa all'orto: il piano resterebbe incoerente in silenzio.
create or replace function piano_spesa_collegata_resta_investimento()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_assegnato numeric;
  v_importo   numeric;
  v_tipo      text;
  v_cosa      text;
  v_coll      text;
begin
  if tg_table_name = 'cash_movements' then
    select sum(importo_attribuito) into v_assegnato from piano_collegamenti where cash_movement_id = new.id;
    v_importo := new.amount;
    v_cosa := 'Questa spesa';
    v_coll := 'collegata';
  else
    select sum(importo_attribuito) into v_assegnato from piano_collegamenti where anticipazione_id = new.id;
    v_importo := new.importo;
    v_cosa := 'Questo anticipo';
    v_coll := 'collegato';
  end if;
  if v_assegnato is null then
    return new;
  end if;

  if not coalesce(new.e_investimento, false) then
    raise exception '% è % a una voce del piano dell''investimento: togli prima il collegamento dal piano, poi togli l''etichetta «investimento».', v_cosa, v_coll;
  end if;
  if v_importo < v_assegnato then
    raise exception '% ha % € assegnati a voci del piano dell''investimento: non può scendere a % €. Riduci prima l''importo assegnato nel piano.',
      v_cosa, to_char(v_assegnato, 'FM999G999G990D00'), to_char(v_importo, 'FM999G999G990D00');
  end if;
  select entity_type::text into v_tipo from entities where id = new.entity_id;
  if v_tipo is distinct from 'srls' and v_tipo is distinct from 'tasca' then
    raise exception '% è % a una voce del piano dell''investimento, che conta solo Borgo 58 e la tua tasca: togli prima il collegamento dal piano.', v_cosa, v_coll;
  end if;
  return new;
end;
$fn$;

revoke all on function piano_spesa_collegata_resta_investimento() from public, anon, authenticated;

drop trigger if exists piano_movimento_resta_investimento on cash_movements;
create trigger piano_movimento_resta_investimento
  before update on cash_movements
  for each row
  when (old.e_investimento and (new.e_investimento is distinct from true
        or new.amount < old.amount or new.entity_id is distinct from old.entity_id))
  execute function piano_spesa_collegata_resta_investimento();

drop trigger if exists piano_anticipo_resta_investimento on anticipazioni_socio;
create trigger piano_anticipo_resta_investimento
  before update on anticipazioni_socio
  for each row
  when (old.e_investimento and (new.e_investimento is distinct from true
        or new.importo < old.importo or new.entity_id is distinct from old.entity_id))
  execute function piano_spesa_collegata_resta_investimento();

-- ---------------------------------------------------------------------
-- 5. SOLO IL TITOLARE
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['piano_impostazioni', 'piano_voci', 'piano_rate', 'piano_collegamenti'] loop
    execute format('alter table %I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_titolare') then
      execute format('create policy %I on %I for all using ((select is_titolare())) with check ((select is_titolare()))', t || '_titolare', t);
    end if;
    execute format('revoke all on table %I from public, anon', t);
    -- Esplicito, non affidato ai privilegi predefiniti: senza, lo staff
    -- avrebbe «permission denied» invece di zero righe, e la prova della
    -- RLS passerebbe per la ragione sbagliata.
    execute format('grant select, insert, update, delete on table %I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_srls     uuid;
  v_agri     uuid;
  v_caus     uuid;
  v_voce     uuid;
  v_voce2    uuid;
  v_rata2    uuid;
  v_mov      uuid;
  v_mov_no   uuid;
  v_mov_orto uuid;
  v_n        integer;
  v_rifiuto  boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  select id into v_srls from entities where entity_type = 'srls' limit 1;
  select id into v_agri from entities where entity_type = 'azienda_agricola' limit 1;
  select id into v_caus from cash_causali where kind = 'uscita' and active and not di_sistema order by created_at limit 1;
  if v_titolare is null or v_staff is null or v_srls is null or v_agri is null or v_caus is null then
    raise exception 'VERIFICA: servono un titolare, uno staff, Borgo 58, l''orto e una causale d''uscita.';
  end if;
  if (select mese_apertura from piano_impostazioni) is null then
    raise exception 'VERIFICA: manca la data di apertura del piano.';
  end if;

  begin
    -- Tre spese vere finte: una segnata investimento, una no, una dell'orto.
    insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo, business_purpose, e_investimento)
    values (v_srls, 'uscita', 100.00, current_date, v_caus, 'cassa', 'ZZ verifica piano - investimento', true)
    returning id into v_mov;
    insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo, business_purpose)
    values (v_srls, 'uscita', 50.00, current_date, v_caus, 'cassa', 'ZZ verifica piano - non investimento')
    returning id into v_mov_no;
    insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo, business_purpose, e_investimento)
    values (v_agri, 'uscita', 30.00, current_date, v_caus, 'cassa', 'ZZ verifica piano - orto', true)
    returning id into v_mov_orto;

    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;

    -- (1) Il titolare scrive una voce e le sue rate; il netto lo fa il database.
    insert into piano_voci (gruppo, descrizione, importo_ivato, aliquota_iva, stato, dilazione)
    values ('B', 'ZZ cappa della verifica', 1220.00, 22, 'preventivato', 'stimata')
    returning id into v_voce;
    insert into piano_rate (voce_id, mese_rel, importo) values (v_voce, 0, 610.00), (v_voce, 1, 610.00);
    if (select netto from piano_voci where id = v_voce) <> 1000.00 then
      raise exception 'VERIFICA (1): il netto di 1.220 € al 22%% non è 1.000 €.';
    end if;
    insert into piano_voci (gruppo, descrizione, importo_ivato, aliquota_iva)
    values ('E', 'ZZ affitto della verifica', 1500.00, 0)
    returning id into v_voce2;
    if (select netto from piano_voci where id = v_voce2) <> 1500.00 then
      raise exception 'VERIFICA (1b): con IVA 0 il netto non è uguale all''importo.';
    end if;
    insert into piano_rate (voce_id, mese_rel, importo) values (v_voce2, 0, 1500.00) returning id into v_rata2;

    -- (2) Un'aliquota inventata si rifiuta.
    v_rifiuto := false;
    begin
      update piano_voci set aliquota_iva = 7 where id = v_voce;
    exception when check_violation then v_rifiuto := true;
    end;
    if not v_rifiuto then raise exception 'VERIFICA (2): un''IVA del 7%% è passata.'; end if;

    -- (3) Una spesa segnata investimento si collega; la stessa non supera il suo importo.
    insert into piano_collegamenti (voce_id, cash_movement_id, importo_attribuito) values (v_voce, v_mov, 60.00);
    v_rifiuto := false;
    begin
      insert into piano_collegamenti (voce_id, cash_movement_id, importo_attribuito) values (v_voce2, v_mov, 50.00);
    exception when raise_exception then v_rifiuto := sqlerrm like '%in tutto%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (3): 110 € assegnati su una spesa da 100 € sono passati.'; end if;

    -- (4) Una spesa NON segnata investimento, o dell'orto, non si collega.
    v_rifiuto := false;
    begin
      insert into piano_collegamenti (voce_id, cash_movement_id, importo_attribuito) values (v_voce, v_mov_no, 10.00);
    exception when raise_exception then v_rifiuto := sqlerrm like '%non è segnata%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (4a): una spesa non segnata investimento si è collegata.'; end if;
    v_rifiuto := false;
    begin
      insert into piano_collegamenti (voce_id, cash_movement_id, importo_attribuito) values (v_voce, v_mov_orto, 10.00);
    exception when raise_exception then v_rifiuto := sqlerrm like '%dell%orto%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (4b): una spesa dell''orto si è collegata.'; end if;

    -- (5) La rata di un'altra voce non si usa.
    v_rifiuto := false;
    begin
      insert into piano_collegamenti (voce_id, rata_id, cash_movement_id, importo_attribuito) values (v_voce, v_rata2, v_mov, 10.00);
    exception when raise_exception then v_rifiuto := sqlerrm like '%rata scelta%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (5): un collegamento con la rata di un''altra voce è passato.'; end if;

    -- (6) Una spesa collegata non perde l'etichetta «investimento».
    reset role;
    v_rifiuto := false;
    begin
      update cash_movements set e_investimento = false where id = v_mov;
    exception when raise_exception then v_rifiuto := sqlerrm like '%togli prima il collegamento%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (6a): una spesa collegata al piano ha perso l''etichetta.'; end if;
    v_rifiuto := false;
    begin
      update cash_movements set amount = 40.00 where id = v_mov;
    exception when raise_exception then v_rifiuto := sqlerrm like '%non può scendere%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (6b): una spesa collegata per 60 € è scesa a 40 €.'; end if;
    v_rifiuto := false;
    begin
      update cash_movements set entity_id = v_agri where id = v_mov;
    exception when raise_exception then v_rifiuto := sqlerrm like '%solo Borgo 58%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (6c): una spesa collegata al piano è passata all''orto.'; end if;

    -- (7) Lo staff non vede e non scrive niente del piano.
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_n from piano_voci;
    if v_n <> 0 then raise exception 'VERIFICA (7a): lo staff vede % voci del piano.', v_n; end if;
    select count(*) into v_n from piano_impostazioni;
    if v_n <> 0 then raise exception 'VERIFICA (7b): lo staff vede la data di apertura del piano.'; end if;
    v_rifiuto := false;
    begin
      insert into piano_voci (gruppo, descrizione, importo_ivato) values ('A', 'ZZ voce dello staff', 1);
    exception when insufficient_privilege then v_rifiuto := true;
    end;
    if not v_rifiuto then raise exception 'VERIFICA (7c): lo staff ha scritto una voce del piano.'; end if;
    reset role;
    perform set_config('request.jwt.claims', null, true);

    if has_table_privilege('anon', 'piano_voci', 'select')
       or has_table_privilege('anon', 'piano_collegamenti', 'select') then
      raise exception 'VERIFICA (8): anon può leggere il piano.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica del piano dell''investimento');

  raise notice 'Fatto: il piano dell''investimento ha voci, rate e collegamenti; il netto lo calcola il database; un''IVA inventata, una spesa non segnata o dell''orto e un''assegnazione oltre l''importo si rifiutano; una spesa collegata non perde l''etichetta; lo staff e anon non vedono niente. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261107000001', 'il_piano_dell_investimento')
on conflict (version) do nothing;
