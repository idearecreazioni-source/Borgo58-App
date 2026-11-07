-- =====================================================================
-- IL PIANO DELL'INVESTIMENTO, PARTE 6 — LE FATTURE E LA VOCE OBBLIGATORIA
-- (07/11/2026)
-- =====================================================================
--
-- Due richieste di Alessio del 07/11 (B e C):
--
-- 🔴 B. LA SPUNTA «INVESTIMENTO» ANCHE SULLE FATTURE DA PAGARE. Una
--    fattura segnata e collegata a una voce conta come IMPEGNATA (parte 5).
--    Quando si paga, il pagamento EREDITA la spunta e i collegamenti:
--      · in Prima nota, con pay_supplier_invoice (anche dalla banca);
--      · con un anticipo, con registra_anticipazione.
--    Così lo speso arriva da solo, e la fattura pagata non conta più come
--    impegnata: una volta sola, mai due (parte 5).
--
-- 🔴 C. SPUNTANDO «INVESTIMENTO» LA VOCE È OBBLIGATORIA, in Prima nota,
--    negli Anticipi e nelle Fatture. Il gesto passa da segna_investimento(),
--    che mette la spunta e il collegamento insieme, in una transazione.
--
-- ⚠️ SOLO PER LE SPUNTE NUOVE (richiesta della chat madre del 07/11): le
--    righe già segnate senza voce restano come sono, si salvano e si
--    modificano come sempre, e stanno nelle «Spese da assegnare» della
--    pagina del piano. L'obbligo scatta solo quando una riga DIVENTA
--    investimento: nasce segnata, oppure passa da non segnata a segnata.
--    Si controlla alla fine della transazione (trigger «deferred»), così
--    la spunta e il collegamento possono arrivare uno dopo l'altro.
--
-- ⚠️ IL PASSAGGIO DELLA SPUNTA AL PAGAMENTO È L'UNICA ECCEZIONE alla regola
--    «la spunta si mette a mano» (20260921000003): non è un'etichetta
--    indovinata, è quella che Alessio ha messo sulla fattura, che passa a
--    chi la paga. Una fattura segnata ma senza più collegamenti non la
--    passa: il pagamento si bloccherebbe sull'obbligo della voce.

-- ---------------------------------------------------------------------
-- 1. LA SPUNTA SULLA FATTURA
-- ---------------------------------------------------------------------
alter table supplier_invoices
  add column if not exists e_investimento boolean not null default false;

comment on column supplier_invoices.e_investimento is
  'Etichetta manuale (07/11/2026): questa fattura è una spesa per mettere in piedi il locale. Da pagare conta come impegnata nel piano dell''investimento; quando si paga, la spunta e i collegamenti alle voci passano al movimento o all''anticipo che la paga. Non è un dato fiscale e non entra nel costo del progetto da sé: ci entra il pagamento.';

-- ⚠️ LE FATTURE GIÀ COLLEGATE AL PIANO PRENDONO LA SPUNTA (revisione del
--    07/11): le parti 1 e 2 permettevano di collegare una fattura senza
--    spunta, e da qui il portiere la pretende. Senza questa riga quei
--    collegamenti resterebbero bloccati. Hanno già la voce, quindi l'obbligo
--    è rispettato.
update supplier_invoices set e_investimento = true
 where not e_investimento
   and id in (select supplier_invoice_id from piano_collegamenti where supplier_invoice_id is not null);

-- Una fattura dell'orto non è un investimento del locale.
create or replace function guardia_investimento_fattura()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_tipo text;
begin
  if not coalesce(new.e_investimento, false) then
    return new;
  end if;
  select entity_type::text into v_tipo from entities where id = new.entity_id;
  if v_tipo is distinct from 'srls' and v_tipo is distinct from 'tasca' then
    raise exception 'Questa fattura è dell''orto: il piano dell''investimento conta solo Borgo 58 e la tua tasca.';
  end if;
  return new;
end;
$fn$;

revoke all on function guardia_investimento_fattura() from public, anon, authenticated;

drop trigger if exists trg_guardia_investimento_fattura on supplier_invoices;
create trigger trg_guardia_investimento_fattura
  before insert or update on supplier_invoices
  for each row execute function guardia_investimento_fattura();

-- ---------------------------------------------------------------------
-- 2. IL PORTIERE DEI COLLEGAMENTI: ANCHE LA FATTURA DEV'ESSERE SEGNATA
-- ---------------------------------------------------------------------
-- Come la parte 1 (20261107000001), con una cosa in più: la fattura
-- collegata dev'essere segnata «investimento», come il movimento e l'anticipo.
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
  -- 🔴 LA RIGA D'ORIGINE SI BLOCCA PRIMA DI SOMMARE (for no key update).
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
    select i.amount, e.entity_type::text, i.e_investimento
      into v_importo, v_tipo, v_marcata
      from supplier_invoices i join entities e on e.id = i.entity_id
     where i.id = new.supplier_invoice_id
       for no key update of i;
    if v_tipo is not null and not coalesce(v_marcata, false) then
      raise exception 'Questa fattura non è segnata «investimento»: segnala prima, poi collegala a una voce del piano.';
    end if;
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

-- ---------------------------------------------------------------------
-- 3. UNA FATTURA COLLEGATA NON PERDE LA SPUNTA DI NASCOSTO
-- ---------------------------------------------------------------------
-- Come per movimenti e anticipi (parte 1): stessa funzione, un ramo in più.
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
  elsif tg_table_name = 'anticipazioni_socio' then
    select sum(importo_attribuito) into v_assegnato from piano_collegamenti where anticipazione_id = new.id;
    v_importo := new.importo;
    v_cosa := 'Questo anticipo';
    v_coll := 'collegato';
  else
    select sum(importo_attribuito) into v_assegnato from piano_collegamenti where supplier_invoice_id = new.id;
    v_importo := new.amount;
    v_cosa := 'Questa fattura';
    v_coll := 'collegata';
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

drop trigger if exists piano_fattura_resta_investimento on supplier_invoices;
create trigger piano_fattura_resta_investimento
  before update on supplier_invoices
  for each row
  when (old.e_investimento and (new.e_investimento is distinct from true
        or new.amount < old.amount or new.entity_id is distinct from old.entity_id))
  execute function piano_spesa_collegata_resta_investimento();

-- ---------------------------------------------------------------------
-- 4. IL PAGAMENTO EREDITA SPUNTA E COLLEGAMENTI
-- ---------------------------------------------------------------------
-- ⚠️ SOLO DA UNA FATTURA SEGNATA E COLLEGATA: senza collegamenti non c'è
--    niente da ereditare, e la spunta sola farebbe scattare l'obbligo della
--    voce dentro il pagamento.
-- ⚠️ IL NOME COMINCIA PER «piano_»: i trigger «before» girano in ordine
--    alfabetico, e questo deve mettere la spunta PRIMA che
--    trg_guardia_investimento la controlli (causale di sistema, la stessa
--    fattura contata due volte).
create or replace function piano_pagamento_eredita_spunta()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.supplier_invoice_id is null or coalesce(new.e_investimento, false) then
    return new;
  end if;
  if tg_table_name = 'cash_movements' and new.direction is distinct from 'uscita' then
    return new;
  end if;
  -- Una nota della tasca non si segna (guardia_investimento_anticipazione).
  if tg_table_name = 'anticipazioni_socio' and e_una_tasca(new.entity_id) then
    return new;
  end if;
  if exists (
    select 1 from supplier_invoices i
     where i.id = new.supplier_invoice_id and i.e_investimento
       and exists (select 1 from piano_collegamenti c where c.supplier_invoice_id = i.id)
  ) then
    new.e_investimento := true;
  end if;
  return new;
end;
$fn$;

revoke all on function piano_pagamento_eredita_spunta() from public, anon, authenticated;

-- I collegamenti si copiano dopo: il portiere vuole la riga già segnata.
-- ⚠️ MAI OLTRE IL PAGAMENTO: con una nota di credito si paga meno della
--    fattura, e i collegamenti si riempiono in ordine fino all'importo.
create or replace function piano_pagamento_eredita_collegamenti()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_resto numeric;
  v_parte numeric;
  r       record;
begin
  if new.supplier_invoice_id is null or not coalesce(new.e_investimento, false) then
    return null;
  end if;
  if tg_table_name = 'cash_movements' then
    if exists (select 1 from piano_collegamenti where cash_movement_id = new.id) then return null; end if;
    v_resto := new.amount;
  else
    if exists (select 1 from piano_collegamenti where anticipazione_id = new.id) then return null; end if;
    v_resto := new.importo;
  end if;

  for r in
    select c.voce_id, c.rata_id, c.importo_attribuito
      from piano_collegamenti c
      join supplier_invoices i on i.id = c.supplier_invoice_id
     where c.supplier_invoice_id = new.supplier_invoice_id and i.e_investimento
     -- ⚠️ Un ordine che non dipende dal caso (revisione del 07/11): due
     --    collegamenti scritti insieme hanno lo stesso created_at, e prima
     --    decideva l'id, cioè la sorte. Prima il più grande.
     order by c.created_at, c.importo_attribuito desc, c.id
  loop
    exit when v_resto <= 0;
    v_parte := least(r.importo_attribuito, v_resto);
    if tg_table_name = 'cash_movements' then
      insert into piano_collegamenti (voce_id, rata_id, cash_movement_id, importo_attribuito)
      values (r.voce_id, r.rata_id, new.id, v_parte);
    else
      insert into piano_collegamenti (voce_id, rata_id, anticipazione_id, importo_attribuito)
      values (r.voce_id, r.rata_id, new.id, v_parte);
    end if;
    v_resto := v_resto - v_parte;
  end loop;
  return null;
end;
$fn$;

revoke all on function piano_pagamento_eredita_collegamenti() from public, anon, authenticated;

drop trigger if exists piano_pagamento_eredita_spunta on cash_movements;
create trigger piano_pagamento_eredita_spunta
  before insert on cash_movements
  for each row execute function piano_pagamento_eredita_spunta();
drop trigger if exists piano_pagamento_eredita_collegamenti on cash_movements;
create trigger piano_pagamento_eredita_collegamenti
  after insert on cash_movements
  for each row execute function piano_pagamento_eredita_collegamenti();

drop trigger if exists piano_pagamento_eredita_spunta on anticipazioni_socio;
create trigger piano_pagamento_eredita_spunta
  before insert on anticipazioni_socio
  for each row execute function piano_pagamento_eredita_spunta();
drop trigger if exists piano_pagamento_eredita_collegamenti on anticipazioni_socio;
create trigger piano_pagamento_eredita_collegamenti
  after insert on anticipazioni_socio
  for each row execute function piano_pagamento_eredita_collegamenti();

-- ---------------------------------------------------------------------
-- 5. LA VOCE È OBBLIGATORIA (SOLO PER LE SPUNTE NUOVE)
-- ---------------------------------------------------------------------
-- Si guarda alla fine della transazione, e si rilegge la riga com'è
-- allora: se nel frattempo la spunta è stata tolta o la riga cancellata,
-- non c'è niente da pretendere.
create or replace function piano_voce_obbligatoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_marcata boolean;
  v_coll    boolean;
begin
  if tg_table_name = 'cash_movements' then
    select e_investimento into v_marcata from cash_movements where id = new.id;
    select exists (select 1 from piano_collegamenti where cash_movement_id = new.id) into v_coll;
  elsif tg_table_name = 'anticipazioni_socio' then
    select e_investimento into v_marcata from anticipazioni_socio where id = new.id;
    select exists (select 1 from piano_collegamenti where anticipazione_id = new.id) into v_coll;
  else
    select e_investimento into v_marcata from supplier_invoices where id = new.id;
    select exists (select 1 from piano_collegamenti where supplier_invoice_id = new.id) into v_coll;
  end if;
  if coalesce(v_marcata, false) and not v_coll then
    raise exception 'Hai segnato «investimento»: scegli anche la voce del piano a cui va questa spesa. Se non sai ancora quale, lascia la spunta vuota e mettila dopo.';
  end if;
  return null;
end;
$fn$;

revoke all on function piano_voce_obbligatoria() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['cash_movements', 'anticipazioni_socio', 'supplier_invoices'] loop
    execute format('drop trigger if exists piano_voce_obbligatoria_nuova on %I', t);
    execute format(
      'create constraint trigger piano_voce_obbligatoria_nuova after insert on %I deferrable initially deferred '
      'for each row when (new.e_investimento) execute function piano_voce_obbligatoria()', t);
    execute format('drop trigger if exists piano_voce_obbligatoria_segnata on %I', t);
    execute format(
      'create constraint trigger piano_voce_obbligatoria_segnata after update on %I deferrable initially deferred '
      'for each row when (new.e_investimento and not old.e_investimento) execute function piano_voce_obbligatoria()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. SEGNARE E TOGLIERE, IN UN GESTO SOLO
-- ---------------------------------------------------------------------
-- ⚠️ security invoker: valgono le regole di chi chiama. I collegamenti
--    sono del solo titolare (RLS della parte 1), quindi chi non lo è non
--    segna niente: il gesto si annulla tutto.
-- 🔴 La parte assegnata è quello che resta della spesa: se la spesa era già
--    divisa fra voci, la nuova voce prende il resto.
create or replace function segna_investimento(p_fonte text, p_id uuid, p_voce_id uuid, p_rata_id uuid default null)
returns void
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  v_importo numeric;
  v_gia     numeric;
begin
  if p_voce_id is null then
    raise exception 'Scegli la voce del piano a cui va questa spesa.';
  end if;
  if p_fonte = 'prima_nota' then
    update cash_movements set e_investimento = true where id = p_id returning amount into v_importo;
    select coalesce(sum(importo_attribuito), 0) into v_gia from piano_collegamenti where cash_movement_id = p_id;
  elsif p_fonte = 'anticipazione' then
    update anticipazioni_socio set e_investimento = true where id = p_id returning importo into v_importo;
    select coalesce(sum(importo_attribuito), 0) into v_gia from piano_collegamenti where anticipazione_id = p_id;
  elsif p_fonte = 'fattura' then
    update supplier_invoices set e_investimento = true where id = p_id returning amount into v_importo;
    select coalesce(sum(importo_attribuito), 0) into v_gia from piano_collegamenti where supplier_invoice_id = p_id;
  else
    raise exception 'Non so segnare «%»: le spese sono di prima nota, anticipi o fatture.', p_fonte;
  end if;
  if v_importo is null then
    raise exception 'La spesa da segnare non c''è più, oppure non puoi cambiarla.';
  end if;
  -- ⚠️ Già assegnata tutta: se è già su questa voce non c'è niente da fare,
  --    se è su altre voci si dice, invece di ignorare la voce scelta.
  if v_importo - v_gia <= 0 then
    if exists (
      select 1 from piano_collegamenti
       where voce_id = p_voce_id
         and (cash_movement_id = p_id or anticipazione_id = p_id or supplier_invoice_id = p_id)
    ) then
      return;
    end if;
    raise exception 'Questa spesa è già assegnata tutta ad altre voci del piano: togli prima quei collegamenti dalla pagina del piano, poi scegli questa voce.';
  end if;
  insert into piano_collegamenti (voce_id, rata_id, cash_movement_id, anticipazione_id, supplier_invoice_id, importo_attribuito)
  values (
    p_voce_id,
    p_rata_id,
    case when p_fonte = 'prima_nota' then p_id end,
    case when p_fonte = 'anticipazione' then p_id end,
    case when p_fonte = 'fattura' then p_id end,
    v_importo - v_gia
  );
end;
$fn$;

revoke all on function segna_investimento(text, uuid, uuid, uuid) from public, anon;
grant execute on function segna_investimento(text, uuid, uuid, uuid) to authenticated;

-- Togliere la spunta toglie anche i collegamenti: la spesa esce dal piano.
create or replace function togli_investimento(p_fonte text, p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  v_n integer;
begin
  if p_fonte = 'prima_nota' then
    delete from piano_collegamenti where cash_movement_id = p_id;
    update cash_movements set e_investimento = false where id = p_id;
  elsif p_fonte = 'anticipazione' then
    delete from piano_collegamenti where anticipazione_id = p_id;
    update anticipazioni_socio set e_investimento = false where id = p_id;
  elsif p_fonte = 'fattura' then
    delete from piano_collegamenti where supplier_invoice_id = p_id;
    update supplier_invoices set e_investimento = false where id = p_id;
  else
    raise exception 'Non so togliere «%»: le spese sono di prima nota, anticipi o fatture.', p_fonte;
  end if;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'La spesa non c''è più, oppure non puoi cambiarla.';
  end if;
end;
$fn$;

revoke all on function togli_investimento(text, uuid) from public, anon;
grant execute on function togli_investimento(text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_srls     uuid;
  v_agri     uuid;
  v_caus     uuid;
  v_forn     uuid;
  v_forn_agri uuid;
  v_voce     uuid;
  v_voce2    uuid;
  v_fat      uuid;
  v_fat_agri uuid;
  v_fat_vuota uuid;
  v_mov      uuid;
  v_mov2     uuid;
  v_vecchio  uuid;
  v_n        integer;
  v_imp      numeric;
  v_rifiuto  boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select id into v_srls from entities where entity_type = 'srls' limit 1;
  select id into v_agri from entities where entity_type = 'azienda_agricola' limit 1;
  select id into v_caus from cash_causali where kind = 'uscita' and active and not di_sistema order by created_at limit 1;
  if v_titolare is null or v_srls is null or v_agri is null or v_caus is null then
    raise exception 'VERIFICA: servono un titolare, Borgo 58, l''orto e una causale d''uscita.';
  end if;

  begin
    insert into suppliers (entity_id, name) values (v_srls, 'ZZ fornitore fatture piano') returning id into v_forn;
    insert into suppliers (entity_id, name) values (v_agri, 'ZZ fornitore orto piano') returning id into v_forn_agri;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount)
    values (v_srls, v_forn, 'ZZ-F1', current_date, 500.00) returning id into v_fat;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount)
    values (v_srls, v_forn, 'ZZ-F2', current_date, 70.00) returning id into v_fat_vuota;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount)
    values (v_agri, v_forn_agri, 'ZZ-F3', current_date, 30.00) returning id into v_fat_agri;
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;

    insert into piano_voci (gruppo, descrizione, importo_ivato) values ('A', 'ZZ forno delle fatture', 400.00) returning id into v_voce;
    insert into piano_voci (gruppo, descrizione, importo_ivato) values ('A', 'ZZ banco delle fatture', 100.00) returning id into v_voce2;

    -- Una riga «vecchia»: segnata e poi rimasta senza voce, com'erano tutte
    -- prima di oggi. Nasce con la sua voce (l'obbligo si guarda subito),
    -- poi il collegamento si toglie.
    insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo, business_purpose, e_investimento)
    values (v_srls, 'uscita', 20.00, current_date, v_caus, 'cassa', 'ZZ verifica fatture - vecchia senza voce', true)
    returning id into v_vecchio;
    insert into piano_collegamenti (voce_id, cash_movement_id, importo_attribuito) values (v_voce2, v_vecchio, 20.00);
    set constraints all immediate;
    set constraints all deferred;
    delete from piano_collegamenti where cash_movement_id = v_vecchio;

    -- (1) Si segna una fattura da pagare con la sua voce: impegnata.
    perform segna_investimento('fattura', v_fat, v_voce);
    set constraints all immediate;
    set constraints all deferred;
    select impegnato into v_imp from piano_speso_per_voce() where voce_id = v_voce;
    if v_imp <> 500.00 then
      raise exception 'VERIFICA (1): la fattura segnata doveva fare 500 € impegnati sul forno, fa %.', v_imp;
    end if;
    -- Divisa su due voci: 400 sul forno, 100 sul banco.
    update piano_collegamenti set importo_attribuito = 400.00 where supplier_invoice_id = v_fat and voce_id = v_voce;
    perform segna_investimento('fattura', v_fat, v_voce2);
    select count(*) into v_n from piano_collegamenti where supplier_invoice_id = v_fat and voce_id = v_voce2 and importo_attribuito = 100.00;
    if v_n <> 1 then raise exception 'VERIFICA (1b): la seconda voce doveva prendere i 100 € che restavano.'; end if;

    -- (2) Senza voce, la spunta nuova non passa.
    v_rifiuto := false;
    begin
      update supplier_invoices set e_investimento = true where id = v_fat_vuota;
      set constraints all immediate;
    exception when raise_exception then v_rifiuto := sqlerrm like '%scegli anche la voce%';
    end;
    set constraints all deferred;
    if not v_rifiuto then raise exception 'VERIFICA (2): una fattura è stata segnata senza voce.'; end if;
    v_rifiuto := false;
    begin
      insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo, business_purpose, e_investimento)
      values (v_srls, 'uscita', 10.00, current_date, v_caus, 'cassa', 'ZZ verifica fatture - nuova senza voce', true);
      set constraints all immediate;
    exception when raise_exception then v_rifiuto := sqlerrm like '%scegli anche la voce%';
    end;
    set constraints all deferred;
    if not v_rifiuto then raise exception 'VERIFICA (2b): un movimento nuovo è nato segnato senza voce.'; end if;

    -- (3) Una riga vecchia segnata senza voce si modifica come sempre.
    update cash_movements set business_purpose = 'ZZ verifica fatture - vecchia cambiata' where id = v_vecchio;
    set constraints all immediate;
    set constraints all deferred;

    -- (4) Una fattura dell'orto non si segna.
    v_rifiuto := false;
    begin
      update supplier_invoices set e_investimento = true where id = v_fat_agri;
    exception when raise_exception then v_rifiuto := sqlerrm like '%dell''orto%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (4): una fattura dell''orto è stata segnata investimento.'; end if;

    -- (5) Una fattura collegata non perde la spunta di nascosto.
    v_rifiuto := false;
    begin
      update supplier_invoices set e_investimento = false where id = v_fat;
    exception when raise_exception then v_rifiuto := sqlerrm like '%togli prima il collegamento%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (5): una fattura collegata ha perso la spunta.'; end if;

    -- (6) Il pagamento eredita spunta e collegamenti, e la fattura non è
    --     più impegnata: conta una volta sola, come speso.
    insert into cash_movements (entity_id, direction, amount, movement_date, mezzo, business_purpose, supplier_invoice_id)
    values (v_srls, 'uscita', 450.00, current_date, 'cassa', 'ZZ verifica fatture - paga con la nota di credito', v_fat)
    returning id into v_mov;
    update supplier_invoices set status = 'pagata', paid_at = now(), payment_method = 'contante' where id = v_fat;
    set constraints all immediate;
    set constraints all deferred;
    if not (select e_investimento from cash_movements where id = v_mov) then
      raise exception 'VERIFICA (6a): il pagamento non ha ereditato la spunta.';
    end if;
    -- 450 pagati: 400 sul forno, 50 sul banco (mai oltre il pagamento).
    select count(*) into v_n from piano_collegamenti
     where cash_movement_id = v_mov
       and ((voce_id = v_voce and importo_attribuito = 400.00) or (voce_id = v_voce2 and importo_attribuito = 50.00));
    if v_n <> 2 then raise exception 'VERIFICA (6b): i collegamenti ereditati non sono 400 sul forno e 50 sul banco.'; end if;
    select impegnato into v_imp from piano_speso_per_voce() where voce_id = v_voce;
    if v_imp <> 0 then raise exception 'VERIFICA (6c): la fattura pagata conta ancora % € impegnati.', v_imp; end if;

    -- (7) Una fattura non segnata non passa niente al suo pagamento.
    insert into cash_movements (entity_id, direction, amount, movement_date, mezzo, business_purpose, supplier_invoice_id)
    values (v_srls, 'uscita', 70.00, current_date, 'cassa', 'ZZ verifica fatture - paga una fattura normale', v_fat_vuota)
    returning id into v_mov2;
    if (select e_investimento from cash_movements where id = v_mov2) then
      raise exception 'VERIFICA (7): il pagamento di una fattura non segnata è diventato investimento.';
    end if;

    -- (8) Togliere la spunta toglie anche i collegamenti.
    perform togli_investimento('prima_nota', v_mov);
    if exists (select 1 from piano_collegamenti where cash_movement_id = v_mov)
       or (select e_investimento from cash_movements where id = v_mov) then
      raise exception 'VERIFICA (8): togli_investimento ha lasciato la spunta o i collegamenti.';
    end if;

    reset role;
    perform set_config('request.jwt.claims', null, true);

    if has_function_privilege('anon', 'segna_investimento(text, uuid, uuid, uuid)', 'execute')
       or has_function_privilege('anon', 'togli_investimento(text, uuid)', 'execute') then
      raise exception 'VERIFICA (9): anon può segnare o togliere un investimento.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica delle fatture dell''investimento');

  raise notice 'Fatto: le fatture si segnano «investimento» con la loro voce; il pagamento eredita spunta e collegamenti, mai oltre l''importo pagato; una spunta nuova senza voce non passa, una riga vecchia si modifica come sempre; l''orto non si segna. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261107000003', 'le_fatture_dell_investimento')
on conflict (version) do nothing;
